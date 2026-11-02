import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { alertar, perguntar } from '../services/dialog';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';
import PointSelector from '../components/PointSelector';
import { CollectionService } from '../services/collectionService';
import { uploadVolunteerFile } from '../services/uploadService';
import {
  consultarStatus,
  separarPorStatus,
  ignorarNoServidor,
  restaurarIgnoradas,
  SemConexaoError,
} from '../services/collectionStatus';
import { APP_VERSION } from '../services/appUpdate';
import { agruparPorVisita, descreverVisita, JANELA_MINUTOS } from '../services/collectionGrouping';
import { fatoresParaLinhasDoArquivo } from '../services/xlsxFactors';

interface XLSXRow {
  ID: string;
  'Model Name': string;
  Date: string;
  EC: string;
  'EC(Unit)': string;
  TDS: string;
  'TDS(Unit)': string;
  'SALT(%)': string;
  'SALT(TDS)': string;
  'SALT(TDS)(Unit)': string;
  'SALT(S.G.)': string;
  pH: string;
  'Humidity(%)': string;
  'ORP(mV)': string;
  'H2(ppb)': string;
  'H2(ppm)': string;
  'DO(mg/L)': string;
  'DO(%)': string;
  CF: string;
  'CL(mg/L)': string;
  'Temperature(°C)': string;
  'Temperature(°F)': string;
  Location: string;
  Notes: string;
}

interface ProcessedRow {
  measuredAt: string;
  parameters: Array<{
    parameter_id: number;
    value: number;
  }>;
  originalRow: XLSXRow;
  environmentalFactors?: any; // Fatores ambientais específicos para esta linha
  // Preenchidos por agruparPorVisita (ver src/services/collectionGrouping.ts):
  // varias medicoes da sonda na mesma ida a campo viram UMA coleta.
  medicoesNoGrupo?: number;
  descartadas?: string[];
  inicioDaVisita?: string;
}

export default function XLSXImportScreen() {
  const navigation = useNavigation();
  const { volunteer, selectedPointId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [readyToSync, setReadyToSync] = useState(false);
  const [webToast, setWebToast] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });

  const isWeb = Platform.OS === 'web';

  const showWebToast = (text: string) => {
    if (!isWeb) return;
    setWebToast({ visible: true, text });
    setTimeout(() => setWebToast({ visible: false, text: '' }), 3000);
  };

  // `alertar` ja resolve web e nativo (ver src/services/dialog.ts), entao este
  // wrapper existe so para nao mexer nas ~13 chamadas espalhadas pela tela.
  const showAlert = (title: string, message: string) => alertar(title, message);

  const expectedHeaders = [
    'ID', 'Model Name', 'Date', 'EC', 'EC(Unit)', 'TDS', 'TDS(Unit)', 
    'SALT(%)', 'SALT(TDS)', 'SALT(TDS)(Unit)', 'SALT(S.G.)', 'pH', 
    'Humidity(%)', 'ORP(mV)', 'H2(ppb)', 'H2(ppm)', 'DO(mg/L)', 
    'DO(%)', 'CF', 'CL(mg/L)', 'Temperature(°C)', 'Temperature(°F)', 
    'Location', 'Notes'
  ];

  const parameterMapping = {
    'EC': { parameter_id: 10, column: 'EC' }, // Condutividade Elétrica (COND)
    'TDS': { parameter_id: 29, column: 'TDS' }, // Sólidos Dissolvidos Totais
    'pH': { parameter_id: 2, column: 'pH' }, // pH
    'ORP(mV)': { parameter_id: 34, column: 'ORP(mV)' }, // Potencial de Oxirredução (ORP)
    'DO(mg/L)': { parameter_id: 3, column: 'DO(mg/L)' }, // Oxigênio Dissolvido (OD)
    'Temperature(°C)': { parameter_id: 1, column: 'Temperature(°C)' }, // Temperatura (TEMP)
    'SALT(%)': { parameter_id: 33, column: 'SALT(%)' }, // Salinidade (SAL)
  };

  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setSelectedFile(result);
      setReadyToSync(false);
      setCurrentRowIndex(0);
      showAlert('Arquivo Selecionado', 'Arquivo XLSX selecionado com sucesso!');
    } catch (error) {
      console.error('Erro ao selecionar arquivo:', error);
      showAlert('Erro', 'Erro ao selecionar arquivo');
    }
  };

  const validateHeaders = (headers: string[]): boolean => {
    console.log('Cabeçalhos encontrados no arquivo:', headers);
    console.log('Cabeçalhos esperados:', expectedHeaders);
    
    // Verificar se tem pelo menos os cabeçalhos essenciais
    const essentialHeaders = ['ID', 'Date', 'EC', 'pH', 'Temperature(°C)'];
    const hasEssentialHeaders = essentialHeaders.every(header => headers.includes(header));
    
    console.log('Tem cabeçalhos essenciais:', hasEssentialHeaders);
    
    // Verificar se tem pelo menos 70% dos cabeçalhos esperados
    const matchingHeaders = expectedHeaders.filter(header => headers.includes(header));
    const matchPercentage = (matchingHeaders.length / expectedHeaders.length) * 100;
    
    console.log('Cabeçalhos correspondentes:', matchingHeaders);
    console.log('Percentual de correspondência:', matchPercentage.toFixed(1) + '%');
    
    const isValid = hasEssentialHeaders && matchPercentage >= 70;
    console.log('Arquivo é válido:', isValid);
    
    return isValid;
  };

  /**
   * Converte o valor bruto da planilha da sonda em numero.
   *
   * CUIDADO COM O ZERO. A versao anterior comecava com `if (!value ...)`, e em
   * JavaScript `0` e' falsy — entao toda leitura igual a zero era descartada
   * como se nao existisse. No arquivo real da voluntaria a maioria das linhas
   * tem EC = 0.0 e TDS = 0.0; na coleta de 31/08 os dois vieram zero e os
   * parametros simplesmente sumiram, sobrando so temperatura, ORP e pH.
   *
   * Zero e' uma MEDICAO, nao ausencia de medicao. Descarta-lo esconde
   * justamente o caso que mais importa detectar: sensor fora d'agua, sujo ou
   * descalibrado. Melhor gravar o zero e deixar a analise decidir o que fazer
   * com ele do que perder o registro em silencio.
   *
   * Ausencia de leitura, na planilha desta sonda, e' o traco: "-".
   */
  const parseValue = (value: string): number | null => {
    if (value === null || value === undefined) return null;

    const texto = String(value).trim();
    // '-' e '--' sao como a sonda marca "sem leitura"; string vazia idem.
    if (texto === '' || /^-+$/.test(texto)) return null;

    // Aceita virgula decimal, caso a sonda seja configurada em outro idioma.
    const num = parseFloat(texto.replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  };

  // A sonda grava a data/hora em HORA LOCAL (ex.: "2023-08-21 10:27:12").
  // Convertemos para UTC verdadeiro (ISO) para ficar consistente com as sondas
  // automaticas e com a exibicao (que converte UTC -> local). Assim a hora
  // aparece correta no app e no site, sem o deslocamento de fuso.
  const sondaDateToUtcIso = (raw: string): string => {
    if (!raw) return raw;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(raw).trim());
    if (!m) return raw; // formato inesperado: envia como veio (fallback)
    const [, y, mo, d, h, mi, s] = m;
    const local = new Date(
      Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || '0')
    );
    if (isNaN(local.getTime())) return raw;
    return local.toISOString();
  };

  const processXLSXFile = async () => {
    if (!selectedFile || selectedFile.canceled) {
      showAlert('Erro', 'Nenhum arquivo selecionado');
      return;
    }

    // Verificar se há um ponto selecionado
    const currentPoint = getCurrentPoint(volunteer, selectedPointId);
    if (!currentPoint?.id) {
      showAlert('Erro', 'Selecione um ponto de coleta antes de processar o arquivo');
      return;
    }

    setProcessing(true);

    try {
      console.log('Iniciando processamento do arquivo...');
      
      // Ler arquivo
      const fileUri = selectedFile.assets[0].uri;
      console.log('URI do arquivo:', fileUri);

      let workbook: XLSX.WorkBook;
      if (isWeb) {
        // No web, usar fetch + ArrayBuffer
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        console.log('Arquivo lido (web), tamanho (bytes):', buffer.byteLength);
        workbook = XLSX.read(buffer, { type: 'array' });
      } else {
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log('Arquivo lido, tamanho (base64 len):', fileContent.length);
        // Parse XLSX
        workbook = XLSX.read(fileContent, { type: 'base64' });
      }
      console.log('Workbook criado, sheets:', workbook.SheetNames);
      
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<XLSXRow>(worksheet);

      console.log('Dados extraídos, quantidade de linhas:', data.length);
      if (data.length > 0) {
        console.log('Primeira linha:', data[0]);
        console.log('Última linha:', data[data.length - 1]);
      }

      if (data.length === 0) {
        showAlert('Erro', 'Arquivo não contém dados válidos');
        return;
      }

      // Validar cabeçalho
      const headers = Object.keys(data[0]);
      console.log('Validando cabeçalhos...');
      
      if (!validateHeaders(headers)) {
        showAlert('Erro', 'Formato do arquivo inválido. Verifique se é um arquivo da sonda de coleta.');
        return;
      }

      // Processar cada linha
      let processedRows: ProcessedRow[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        console.log(`Processando linha ${i + 1}:`, row.Date);
        
        if (!row.Date) {
          console.log(`Linha ${i + 1} sem data, pulando...`);
          continue; // Pular linhas sem data
        }

        const parameters: Array<{ parameter_id: number; value: number }> = [];

        // Extrair parâmetros válidos
        Object.entries(parameterMapping).forEach(([key, mapping]) => {
          const value = parseValue(row[mapping.column as keyof XLSXRow] as string);
          if (value !== null) {
            parameters.push({
              parameter_id: mapping.parameter_id,
              value: value,
            });
          }
        });

        console.log(`Linha ${i + 1} - parâmetros encontrados:`, parameters.length);

        if (parameters.length > 0) {
          processedRows.push({
            measuredAt: sondaDateToUtcIso(row.Date),
            parameters: parameters,
            originalRow: row,
          });
          console.log(`Linha ${i + 1} adicionada ao processamento`);
        } else {
          console.log(`Linha ${i + 1} sem parâmetros válidos, pulando...`);
        }
      }

      console.log('Total de linhas processadas:', processedRows.length);
      console.log('Detalhes das linhas processadas:');
      processedRows.forEach((row, index) => {
        console.log(`  Linha ${index + 1}: ${row.measuredAt} - ${row.parameters.length} parâmetros`);
      });

      if (processedRows.length === 0) {
        alertar('Erro', 'Nenhum dado válido encontrado no arquivo');
        setProcessing(false);
        return;
      }

      // -----------------------------------------------------------------
      // AGRUPAR MEDICOES DA MESMA VISITA
      // -----------------------------------------------------------------
      // A sonda grava uma linha a cada aperto de botao. Numa ida a campo isso
      // vira 4, 5, 8 linhas com horarios diferentes — que NAO sao duplicatas,
      // mas tambem nao sao coletas distintas. Sem agrupar, o app pedia o
      // questionario de fatores ambientais uma vez por linha.
      const totalMedicoes = processedRows.length;
      // COPIA, nao a mesma referencia: o filtro abaixo usa splice, e apontar
      // `processedRows` para o mesmo array de `visitas` esvaziava os dois —
      // fazendo a mensagem dizer "0 coleta(s)" quando havia coletas.
      const visitas = agruparPorVisita(processedRows, JANELA_MINUTOS);
      const totalVisitas = visitas.length;
      processedRows = [...visitas];

      // -----------------------------------------------------------------
      // O QUE JA FOI ENVIADO? Quem responde e' o SERVIDOR.
      // -----------------------------------------------------------------
      // O arquivo do YINMIK traz todo o historico a cada exportacao. Ate a
      // v1.5.0 o app decidia isso com a memoria do aparelho (que o iPhone
      // apaga) e, se a consulta ao banco falhasse, tratava a coleta como NAO
      // enviada — por isso coletas antigas voltavam como pendentes.
      //
      // Agora: uma consulta so, e sem resposta do servidor o app NAO adivinha.
      let status;
      try {
        status = await consultarStatus(currentPoint.id, visitas);
      } catch (e: any) {
        if (e instanceof SemConexaoError) {
          showAlert(
            'Sem conexão',
            'Não consegui verificar quais coletas já foram enviadas.\n\n' +
            'Conecte-se à internet (Wi-Fi ou dados) e toque em "Processar Dados" de novo. ' +
            'Nenhuma coleta foi perdida.'
          );
        } else {
          showAlert('Erro', String(e?.message || 'Não foi possível verificar as coletas.'));
        }
        setProcessing(false);
        return;
      }

      const sep = separarPorStatus(visitas, status.porHorario);
      const jaSincronizadas = sep.enviadas;
      const ignoradas = sep.ignoradas;
      processedRows = [...sep.novas];

      // Coletas ANTIGAS: anteriores a ultima coleta enviada deste ponto e
      // nunca enviadas. Quase sempre sao testes ou medicoes extras que ficaram
      // no historico do YINMIK — por isso nao entram sozinhas. Mas tambem nao
      // somem em silencio: o voluntario decide.
      if (sep.antigas.length > 0) {
        const ultima = status.ultimaEnviada
          ? new Date(status.ultimaEnviada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : '';
        const lista = sep.antigas.slice(0, 8).map((v: any) => `• ${descreverVisita(v)}`).join('\n');
        const mais = sep.antigas.length > 8 ? `\n… e mais ${sep.antigas.length - 8}` : '';
        const incluir = await perguntar(
          'Coletas antigas no arquivo',
          `Encontrei ${sep.antigas.length} coleta(s) mais antiga(s) que o seu último envio` +
          (ultima ? ` (${ultima})` : '') + ' e que nunca foram enviadas:\n\n' +
          `${lista}${mais}\n\n` +
          (sep.novas.length > 0
            ? `Além disso, há ${sep.novas.length} coleta(s) nova(s), depois do seu último envio, que serão enviadas.\n\n`
            : '') +
          'Normalmente são testes ou medições extras. Quer enviá-las também?',
          'Não, só as novas',
          'Sim, enviar também'
        );
        if (incluir) processedRows = [...sep.antigas, ...processedRows];
        else if (sep.novas.length > 0) {
          const listaNovas = sep.novas.map((v: any) => `• ${descreverVisita(v)}`).join('\n');
          const enviarNovas = await perguntar(
            'Coletas novas no arquivo',
            `${listaNovas}\n\nEnviar só estas ${sep.novas.length} coleta(s) nova(s)?`,
            'Cancelar',
            'Enviar só as novas'
          );
          if (!enviarNovas) {
            setProcessing(false);
            return;
          }
        }
      }

      if (processedRows.length === 0) {
        const base =
          `As ${totalMedicoes} medições deste arquivo correspondem a ${totalVisitas} coleta(s).`;

        if (ignoradas > 0) {
          // Nunca dizer "tudo sincronizado" aqui: as ignoradas NAO foram enviadas.
          alertar(
            'Nada a enviar',
            `${base}\n\n` +
            `${jaSincronizadas} já enviada(s) e ${ignoradas} que você marcou como ignorada(s). ` +
            'As ignoradas não foram enviadas.\n\n' +
            'Quer trazer as ignoradas de volta para poder enviá-las?',
            [
              { text: 'Não', style: 'cancel' },
              {
                text: 'Trazer de volta',
                onPress: async () => {
                  try {
                    await restaurarIgnoradas(currentPoint.id);
                    showAlert(
                      'Pronto',
                      'As coletas ignoradas voltaram. Toque em "Processar Dados" de novo.'
                    );
                  } catch {
                    showAlert('Sem conexão', 'Não consegui falar com o servidor. Tente de novo com internet.');
                  }
                },
              },
            ]
          );
        } else if (sep.antigas.length > 0) {
          showAlert('Nada a enviar', `${base} Nenhuma coleta nova desde o seu último envio.`);
        } else {
          showAlert(
            'Tudo sincronizado',
            `${base} Todas já foram enviadas — não há nada novo.`
          );
        }
        setProcessing(false);
        return;
      }

      const resumoVisitas = processedRows.map((v: any) => `• ${descreverVisita(v)}`).join('\n');
      const agrupou = totalMedicoes > totalVisitas;

      if (jaSincronizadas > 0 || ignoradas > 0 || agrupou) {
        const plural = processedRows.length > 1 ? 's' : '';
        const partes: string[] = [];
        if (agrupou) {
          partes.push(
            `As ${totalMedicoes} medições do arquivo foram agrupadas em ${totalVisitas} coleta(s) — ` +
            `medições feitas com menos de ${JANELA_MINUTOS} min de diferença contam como a mesma ida a campo.`
          );
        }
        if (jaSincronizadas > 0) {
          partes.push(`${jaSincronizadas} coleta(s) já enviada(s) foram puladas.`);
        }
        if (ignoradas > 0) {
          partes.push(`${ignoradas} coleta(s) que você ignorou não aparecem aqui (dá para trazer de volta pelo Perfil).`);
        }
        partes.push(
          `${processedRows.length} coleta${plural} pendente${plural}:\n${resumoVisitas}\n\n` +
          'Responda as perguntas a seguir.'
        );
        showAlert('Coletas encontradas', partes.join('\n\n'));
      }

      // Limpar estado anterior e definir novos dados
      setProcessedData([]);
      setCurrentRowIndex(0);
      setReadyToSync(false);
      
      // Definir dados processados primeiro
      setProcessedData(processedRows);
      
      // Aguardar um pouco para garantir que o estado foi atualizado
      await new Promise(resolve => setTimeout(resolve, 300));

      // Navegar para fatores ambientais
      console.log('Dados processados, total de linhas:', processedRows.length);
      console.log('Primeira linha:', processedRows[0]);
      
      if (isWeb) {
        // No web, navegar diretamente (sem alerta bloqueante)
        console.log('Navegando para fatores ambientais (web)...');
        // Aguardar um pouco para garantir que o estado foi atualizado
        setTimeout(() => {
          startEnvironmentalFactors(processedRows[0], 0, processedRows.length);
        }, 100);
      } else {
        // No mobile, mostrar alerta primeiro
        if (processedRows.length === 1) {
          alertar(
            'Arquivo Processado',
            `Encontrada ${processedRows.length} coleta válida. Agora responda os fatores ambientais.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { 
                text: 'Continuar', 
                onPress: () => {
                  console.log('Navegando para fatores ambientais (mobile)...');
                  startEnvironmentalFactors(processedRows[0], 0, processedRows.length);
                }
              },
            ]
          );
        } else {
          alertar(
            'Arquivo Processado',
            `Encontradas ${processedRows.length} coletas válidas. Você responderá os fatores ambientais para cada coleta individualmente.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { 
                text: 'Continuar', 
                onPress: () => {
                  console.log('Navegando para fatores ambientais (mobile)...');
                  startEnvironmentalFactors(processedRows[0], 0, processedRows.length);
                }
              },
            ]
          );
        }
      }

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      showAlert('Erro', 'Erro ao processar arquivo XLSX');
    } finally {
      setProcessing(false);
    }
  };

  const startEnvironmentalFactors = async (
    row: ProcessedRow,
    rowIndex: number,
    totalRowsOverride?: number
  ) => {
    // Usar totalRowsOverride se fornecido, senão usar processedData.length
    const totalRows = typeof totalRowsOverride === 'number' ? totalRowsOverride : processedData.length;
    
    console.log(`Iniciando fatores ambientais para linha ${rowIndex + 1}/${totalRows}`);
    console.log('Dados da linha:', {
      measuredAt: row.measuredAt,
      parametersCount: row.parameters.length,
      totalRows: totalRows,
      currentRow: rowIndex + 1
    });

    // Verificar se há um ponto selecionado antes de navegar
    const currentPoint = getCurrentPoint(volunteer, selectedPointId);
    if (!currentPoint?.id) {
      showAlert('Erro', 'Selecione um ponto de coleta antes de continuar');
      return;
    }

    // Navegar para fatores ambientais com os dados da coleta específica
    try {
      console.log('Tentando navegar para EnvironmentalFactors...');
      (navigation as any).navigate('EnvironmentalFactors', {
      measuredAt: row.measuredAt,
      parameters: row.parameters,
      totalRows: totalRows,
      currentRow: rowIndex + 1,
      onFactorsComplete: (factors: any) => {
        console.log(`Fatores ambientais completados para linha ${rowIndex + 1}:`, factors);
        
        // Atualizar a linha específica com os fatores ambientais
        setProcessedData(prevData => {
          const updatedData = [...prevData];
          if (updatedData[rowIndex]) {
            updatedData[rowIndex] = {
              ...updatedData[rowIndex],
              environmentalFactors: factors
            };
            console.log(`Linha ${rowIndex + 1} atualizada com fatores ambientais`);
          } else {
            console.error(`Erro: linha ${rowIndex} não encontrada no processedData`);
          }
          
          console.log('Estado atualizado, total de linhas:', updatedData.length);
          console.log('Linhas com fatores ambientais:', updatedData.filter(r => r.environmentalFactors).length);
          
          // Verificar se é a última linha
          const completedRows = updatedData.filter(r => r.environmentalFactors).length;
          const totalRows = updatedData.length;
          
          console.log(`Verificação: ${completedRows}/${totalRows} linhas completas`);
          
          if (rowIndex === totalRows - 1) {
            console.log('Todas as linhas processadas, pronto para sincronizar');
            setReadyToSync(true);
            if (isWeb) {
              try { window.alert('Processamento Concluído\n\nTodos os fatores ambientais foram respondidos. Agora você pode sincronizar os dados.'); } catch {}
            } else {
              alertar(
                'Processamento Concluído',
                'Todos os fatores ambientais foram respondidos. Agora você pode sincronizar os dados.',
                [{ text: 'OK' }]
              );
            }
          } else {
            // Ir para a próxima linha
            const nextRow = updatedData[rowIndex + 1];
            if (nextRow) {
              if (isWeb) {
                // No web, abrir automaticamente a próxima coleta
                startEnvironmentalFactors(nextRow, rowIndex + 1, updatedData.length);
              } else {
                alertar(
                  'Fatores Ambientais Salvos',
                  `Fatores ambientais da coleta ${rowIndex + 1} salvos. Próxima coleta: ${nextRow.measuredAt}`,
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Próxima Coleta', onPress: () => startEnvironmentalFactors(nextRow, rowIndex + 1, updatedData.length) },
                  ]
                );
              }
            } else {
              console.error('Próxima linha não encontrada');
            }
          }
          
          return updatedData;
        });
      },
    });
      console.log('Navegação para EnvironmentalFactors iniciada com sucesso');
    } catch (navError) {
      console.error('Erro ao navegar para EnvironmentalFactors:', navError);
      showAlert('Erro', 'Não foi possível abrir a tela de fatores ambientais. Tente novamente.');
    }
  };

  /**
   * Ignora uma coleta pendente.
   *
   * Necessario porque `syncToSupabase` exige fatores ambientais em TODAS as
   * pendentes: uma visita antiga sem resposta bloqueia o envio das novas. E
   * como as medicoes continuam no arquivo da sonda, ela reapareceria a cada
   * importacao — travando o voluntario indefinidamente.
   *
   * A marca de "ignorada" fica no SERVIDOR (tabela collection_skips), junto
   * com as medicoes descartadas do mesmo grupo, para nao voltar em nenhum
   * aparelho. Ate a v1.5.0 ela ficava so na memoria do celular, que o iPhone
   * apaga — e tudo o que tinha sido ignorado reaparecia como pendente.
   * Nenhuma leitura e' gravada: a coleta simplesmente nao existe, em vez de
   * existir com fatores ambientais inventados.
   */
  const ignorarColeta = async (indice: number) => {
    const row = processedData[indice];
    if (!row) return;

    const currentPoint = getCurrentPoint(volunteer, selectedPointId);
    if (!currentPoint?.id) return;

    const rotulo = descreverVisita(row as any);
    alertar(
      'Ignorar esta coleta?',
      `A coleta de ${rotulo} NÃO será enviada e deixará de aparecer nas próximas ` +
      'importações. Use quando não for possível lembrar as condições ' +
      'do dia (cor da água, cheiro, chuva).\n\n' +
      'Dá para trazer de volta depois, pelo Perfil.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ignorar',
          style: 'destructive',
          onPress: async () => {
            try {
              await ignorarNoServidor(currentPoint.id, row.measuredAt, row.descartadas ?? []);
            } catch {
              showAlert(
                'Sem conexão',
                'Não consegui registrar. Conecte-se à internet e tente ignorar de novo.'
              );
              return;
            }
            const restantes = processedData.filter((_, i) => i !== indice);
            setProcessedData(restantes);
            if (restantes.length === 0) {
              setReadyToSync(false);
              setCurrentRowIndex(0);
              showWebToast("Nada pendente neste arquivo.");
            } else {
              setCurrentRowIndex(Math.min(currentRowIndex, restantes.length - 1));
              setReadyToSync(restantes.every((r) => !!r.environmentalFactors));
            }
          },
        },
      ]
    );
  };

  const syncToSupabase = async () => {
    if (!readyToSync || !selectedFile) {
      alertar('Erro', 'Complete o processamento antes de sincronizar');
      return;
    }

    // Verificar se todas as linhas têm fatores ambientais
    const incompleteRows = processedData.filter(row => !row.environmentalFactors);
    if (incompleteRows.length > 0) {
      alertar('Erro', `${incompleteRows.length} coletas ainda não têm fatores ambientais respondidos.`);
      return;
    }

    setLoading(true);

    try {
      // Verificar dados do voluntário e ponto selecionado
      const currentPoint = getCurrentPoint(volunteer, selectedPointId);
      
      console.log('Dados do voluntário antes da sincronização:');
      console.log('Current Point:', currentPoint);

      if (!currentPoint?.id) {
        throw new Error('Selecione um ponto de coleta antes de sincronizar');
      }

      // Processar todas as linhas com seus fatores ambientais específicos
      for (let i = 0; i < processedData.length; i++) {
        const row = processedData[i];
        const readingData = {
          point_id: currentPoint.id,
          measured_at: row.measuredAt,
          factors: {
            ...row.environmentalFactors,
            // Rastreabilidade do agrupamento: a sonda gravou N medicoes nesta
            // visita e enviamos a ultima. Guardar as descartadas mantem a coleta
            // auditavel — nenhum dado do arquivo some em silencio.
            medicoes_no_grupo: row.medicoesNoGrupo ?? 1,
            medicoes_descartadas: row.descartadas ?? [],
            inicio_da_visita: row.inicioDaVisita ?? row.measuredAt,
            janela_agrupamento_min: JANELA_MINUTOS,
          },
          parameters: row.parameters,
          // Qual versao enviou: ajuda a investigar problemas de atualizacao.
          app: { version: APP_VERSION, platform: Platform.OS },
        };

        console.log(`Inserindo reading ${i + 1}/${processedData.length} com dados:`, readingData);
        // Nao ha mais registro local de "ja enviada": o servidor e' a fonte da
        // verdade (volunteer-collections) e recusa duplicatas por janela.
        await CollectionService.insertReading(readingData);
      }

      // Modificar o arquivo XLSX original com todos os fatores ambientais
      const fileUri = selectedFile.assets![0].uri;

      let workbook: XLSX.WorkBook;
      if (isWeb) {
        // Web: ler via fetch + ArrayBuffer
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const buffer = await blob.arrayBuffer();
        workbook = XLSX.read(buffer, { type: 'array' });
      } else {
        // Nativo: ler via FileSystem em base64
        const fileContent = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        // Ler o workbook original
        workbook = XLSX.read(fileContent, { type: 'base64' });
      }
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      
      // Converter para JSON para adicionar as colunas
      const originalData = XLSX.utils.sheet_to_json(worksheet);
      console.log('Dados originais:', originalData.length, 'linhas');
      
      // Respostas do questionario em cada linha do arquivo, casadas pelo
      // HORARIO da medicao (antes era pela posicao, e depois do agrupamento as
      // respostas caiam em linhas de outros dias). Ver src/services/xlsxFactors.ts.
      const modifiedData = fatoresParaLinhasDoArquivo(
        originalData as any[],
        processedData,
        (linha: any) => (linha?.Date ? sondaDateToUtcIso(String(linha.Date)) : null)
      );

      console.log('Dados modificados:', modifiedData.length, 'linhas');

      // Criar nova planilha com os dados modificados
      const newWorksheet = XLSX.utils.json_to_sheet(modifiedData);
      
      // Substituir a planilha original
      workbook.Sheets[worksheetName] = newWorksheet;

      // Gerar buffer XLSX
      const xlsxBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      console.log('XLSX modificado gerado, tamanho (bytes):', (xlsxBuffer as ArrayBuffer).byteLength || xlsxBuffer.length);

      // Upload para storage usando service key
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `coleta-voluntarios-${volunteer?.code || 'unknown'}-${timestamp}.xlsx`;
      
      const uploadResult = await uploadVolunteerFile(
        volunteer?.code || '',
        xlsxBuffer,
        fileName
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.message);
      }

      console.log('Arquivo enviado para storage com sucesso:', uploadResult.filePath);

      // Excluir arquivo local após sincronização bem-sucedida (apenas mobile/nativo)
      let fileDeleted = false;
      if (!isWeb) {
        try {
          const fileUri = selectedFile.assets![0].uri;
          console.log('Tentando excluir arquivo local:', fileUri);
          
          // Verificar se o arquivo existe antes de tentar excluir
          const fileInfo = await FileSystem.getInfoAsync(fileUri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            fileDeleted = true;
            console.log('Arquivo local excluído com sucesso');
          } else {
            console.log('Arquivo já não existe ou foi movido');
          }
        } catch (deleteError) {
          console.warn('Erro ao excluir arquivo local:', deleteError);
          // Não falhar a sincronização por erro na exclusão
          // O arquivo pode ter sido movido ou já excluído pelo sistema
        }
      }

      if (isWeb) {
        showWebToast(`Sincronização concluída: ${processedData.length} coletas enviadas e arquivo salvo no storage.`);
        // Garantir render do toast antes de navegar
        await new Promise(res => setTimeout(res, 50));
        // Limpar estado e voltar
        setSelectedFile(null);
        setProcessedData([]);
        setCurrentRowIndex(0);
        setReadyToSync(false);
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        // Mensagem de sucesso incluindo informação sobre exclusão do arquivo
        const successMessage = fileDeleted
          ? `${processedData.length} coletas foram sincronizadas com o Supabase e o arquivo XLSX modificado foi enviado para o storage com sucesso!\n\n📱 O arquivo local foi excluído do dispositivo.`
          : `${processedData.length} coletas foram sincronizadas com o Supabase e o arquivo XLSX modificado foi enviado para o storage com sucesso!`;
        
        const limparEVoltar = () => {
          setSelectedFile(null);
          setProcessedData([]);
          setCurrentRowIndex(0);
          setReadyToSync(false);
          navigation.goBack();
        };

        // `alertar` ja trata web e nativo (ver src/services/dialog.ts)
        alertar('Sincronização Concluída', successMessage, [
          { text: 'OK', onPress: limparEVoltar },
        ]);
      }

    } catch (error) {
      console.error('Erro na sincronização:', error);
      showAlert('Erro', 'Erro ao sincronizar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular progresso das coletas
  const completedRows = processedData.filter(row => row.environmentalFactors).length;
  const totalRows = processedData.length;

  if (isWeb) {
    return (
      <View style={styles.webRoot}>
      <ScrollView 
        style={styles.webScroll} 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        alwaysBounceVertical={false}
        bounces={false}
      >
        <View style={styles.header}>
        <Text style={styles.title}>Importar Dados da Sonda</Text>
        <Text style={styles.subtitle}>
          Upload do arquivo XLSX da sonda de coleta
        </Text>
        </View>

        <View style={styles.content}>
        <View style={styles.fileSection}>
          <Text style={styles.sectionTitle}>1. Selecionar Arquivo</Text>
          
          <TouchableOpacity
            style={styles.selectButton}
            onPress={selectFile}
            disabled={loading}
          >
            <Text style={styles.selectButtonText}>
              {selectedFile && !selectedFile.canceled 
                ? '📄 Arquivo Selecionado' 
                : '📁 Selecionar Arquivo XLSX'
              }
            </Text>
          </TouchableOpacity>

          {selectedFile && !selectedFile.canceled && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>
                {selectedFile.assets[0].name}
              </Text>
              <Text style={styles.fileSize}>
                {((selectedFile.assets[0]?.size || 0) / 1024).toFixed(1)} KB
              </Text>
            </View>
          )}
        </View>

        <View style={styles.processSection}>
          <Text style={styles.sectionTitle}>2. Processar Arquivo</Text>
          
          <TouchableOpacity
            style={[
              styles.processButton,
              (!selectedFile || selectedFile.canceled) && styles.processButtonDisabled,
            ]}
            onPress={processXLSXFile}
            disabled={!selectedFile || selectedFile.canceled || processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.processButtonText}>
                🔄 Processar Dados
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {processedData.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>3. Progresso das Coletas</Text>
            <View style={styles.resultsCard}>
              <Text style={styles.resultsText}>
                📊 {completedRows}/{totalRows} coletas processadas
              </Text>
              <Text style={styles.resultsSubtext}>
                {completedRows === totalRows 
                  ? 'Todas as coletas têm fatores ambientais respondidos' 
                  : `${totalRows - completedRows} coletas aguardando fatores ambientais`
                }
              </Text>
              
              {totalRows > 1 && (
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(completedRows / totalRows) * 100}%` }
                    ]} 
                  />
                </View>
              )}
            </View>

            {/* Uma linha por VISITA (medicoes proximas ja foram agrupadas). */}
            {processedData.map((row, i) => (
              <View key={`${row.measuredAt}-${i}`} style={styles.coletaLinha}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coletaTitulo}>{descreverVisita(row as any)}</Text>
                  <Text style={styles.coletaEstado}>
                    {row.environmentalFactors
                      ? 'Fatores ambientais respondidos'
                      : 'Aguardando os fatores ambientais'}
                  </Text>
                </View>
                {!row.environmentalFactors && (
                  <TouchableOpacity
                    onPress={() => ignorarColeta(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ignorar a coleta de ${descreverVisita(row as any)}`}
                  >
                    <Text style={styles.coletaIgnorar}>Ignorar</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {readyToSync && (
          <View style={styles.syncSection}>
            <Text style={styles.sectionTitle}>4. Sincronizar</Text>
            
            <TouchableOpacity
              style={styles.syncButton}
              onPress={syncToSupabase}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>
                  🔄 Sincronizar com Supabase
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>📋 Formato Esperado</Text>
          <Text style={styles.helpText}>
            O arquivo deve conter as colunas: ID, Date, EC, pH, ORP(mV), DO(mg/L), Temperature(°C), CL(mg/L), etc.
          </Text>
          {totalRows > 1 && (
            <Text style={styles.helpText}>
              {'\n'}💡 <Text style={styles.boldText}>Múltiplas coletas:</Text> Você responderá os fatores ambientais para cada coleta individualmente, permitindo diferentes condições para cada dia.
            </Text>
          )}
        </View>
        </View>
      </ScrollView>
      {webToast.visible && (
        <View style={styles.webToast} pointerEvents="none">
          <Text style={styles.webToastText}>{webToast.text}</Text>
        </View>
      )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        alwaysBounceVertical={false}
        bounces={false}
      >
        <View style={styles.header}>
        <Text style={styles.title}>Importar Dados da Sonda</Text>
        <Text style={styles.subtitle}>
          Upload do arquivo XLSX da sonda de coleta
        </Text>
        </View>

        <View style={styles.content}>
        <View style={styles.fileSection}>
          <Text style={styles.sectionTitle}>1. Selecionar Arquivo</Text>
          
          <TouchableOpacity
            style={styles.selectButton}
            onPress={selectFile}
            disabled={loading}
          >
            <Text style={styles.selectButtonText}>
              {selectedFile && !selectedFile.canceled 
                ? '📄 Arquivo Selecionado' 
                : '📁 Selecionar Arquivo XLSX'
              }
            </Text>
          </TouchableOpacity>

          {selectedFile && !selectedFile.canceled && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>
                {selectedFile.assets[0].name}
              </Text>
              <Text style={styles.fileSize}>
                {((selectedFile.assets[0]?.size || 0) / 1024).toFixed(1)} KB
              </Text>
            </View>
          )}
        </View>

        <View style={styles.processSection}>
          <Text style={styles.sectionTitle}>2. Processar Arquivo</Text>
          
          <TouchableOpacity
            style={[
              styles.processButton,
              (!selectedFile || selectedFile.canceled) && styles.processButtonDisabled,
            ]}
            onPress={processXLSXFile}
            disabled={!selectedFile || selectedFile.canceled || processing}
          >
            {processing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.processButtonText}>
                🔄 Processar Dados
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {processedData.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>3. Progresso das Coletas</Text>
            <View style={styles.resultsCard}>
              <Text style={styles.resultsText}>
                📊 {completedRows}/{totalRows} coletas processadas
              </Text>
              <Text style={styles.resultsSubtext}>
                {completedRows === totalRows 
                  ? 'Todas as coletas têm fatores ambientais respondidos' 
                  : `${totalRows - completedRows} coletas aguardando fatores ambientais`
                }
              </Text>
              
              {totalRows > 1 && (
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${(completedRows / totalRows) * 100}%` }
                    ]} 
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {readyToSync && (
          <View style={styles.syncSection}>
            <Text style={styles.sectionTitle}>4. Sincronizar</Text>
            
            <TouchableOpacity
              style={styles.syncButton}
              onPress={syncToSupabase}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>
                  🔄 Sincronizar com Supabase
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>📋 Formato Esperado</Text>
          <Text style={styles.helpText}>
            O arquivo deve conter as colunas: ID, Date, EC, pH, ORP(mV), DO(mg/L), Temperature(°C), CL(mg/L), etc.
          </Text>
          {totalRows > 1 && (
            <Text style={styles.helpText}>
              {'\n'}💡 <Text style={styles.boldText}>Múltiplas coletas:</Text> Você responderá os fatores ambientais para cada coleta individualmente, permitindo diferentes condições para cada dia.
            </Text>
          )}
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
    minHeight: '100%',
  },
  scroll: {
    flex: 1,
  },
  webScroll: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  webRoot: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
    height: '100%',
  },
  webToast: {
    position: 'absolute',
    left: '5%',
    right: '5%',
    bottom: 20,
    backgroundColor: '#16a34a',
    padding: 14,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 9999,
  },
  webToastText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#0066CC',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  content: {
    padding: 20,
  },
  fileSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  selectorContainer: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  selectButton: {
    backgroundColor: '#0066CC',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fileInfo: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  fileSize: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 5,
  },
  processSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  processButton: {
    backgroundColor: '#00AA44',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  processButtonDisabled: {
    backgroundColor: '#ccc',
  },
  processButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  coletaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  coletaTitulo: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  coletaEstado: { fontSize: 12, color: '#64748b', marginTop: 2 },
  coletaIgnorar: { fontSize: 13, fontWeight: '600', color: '#b91c1c', paddingHorizontal: 8, paddingVertical: 4 },
  resultsSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultsCard: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00AA44',
  },
  resultsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00AA44',
  },
  resultsSubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00AA44',
    borderRadius: 4,
  },
  syncSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  syncButton: {
    backgroundColor: '#FF6600',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
}); 