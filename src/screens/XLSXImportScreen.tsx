import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { alertar } from '../services/dialog';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';
import PointSelector from '../components/PointSelector';
import { CollectionService } from '../services/collectionService';
import { uploadVolunteerFile } from '../services/uploadService';
import { isCollectionSynced, markCollectionSynced } from '../services/syncedCollections';

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

  const parseValue = (value: string): number | null => {
    if (!value || value === '-' || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
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
      const processedRows: ProcessedRow[] = [];

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

      // Pular coletas ja sincronizadas neste dispositivo (evita reperguntar/reenviar).
      // Chave = ponto + data/hora, a mesma da trava anti-duplicidade do banco.
      let jaSincronizadas = 0;
      for (let i = processedRows.length - 1; i >= 0; i--) {
        const mAt = processedRows[i].measuredAt;
        let sincronizada = false;
        try {
          // 1. memoria local (rapida, funciona offline)
          sincronizada = await isCollectionSynced(currentPoint.id, mAt);
          // 2. se nao achou local, confirma no banco (cobre envios antigos / outro aparelho)
          if (!sincronizada) {
            sincronizada = await CollectionService.existsReading(currentPoint.id, mAt);
            if (sincronizada) {
              await markCollectionSynced(currentPoint.id, mAt); // cacheia para as proximas
            }
          }
        } catch {
          // em caso de falha, mantem a linha (o servidor ainda deduplica no envio)
        }
        if (sincronizada) {
          processedRows.splice(i, 1);
          jaSincronizadas++;
        }
      }

      if (processedRows.length === 0) {
        showAlert(
          'Tudo sincronizado',
          'Todas as coletas deste arquivo já foram enviadas neste dispositivo. Nada novo para sincronizar.'
        );
        setProcessing(false);
        return;
      }

      if (jaSincronizadas > 0) {
        const plural = processedRows.length > 1 ? 's' : '';
        showAlert(
          'Leituras pendentes',
          `${jaSincronizadas} leitura(s) já sincronizada(s) foram ignoradas. ` +
          `${processedRows.length} leitura${plural} pendente${plural} — responda as perguntas a seguir.`
        );
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
          factors: row.environmentalFactors,
          parameters: row.parameters,
        };

        console.log(`Inserindo reading ${i + 1}/${processedData.length} com dados:`, readingData);
        await CollectionService.insertReading(readingData);
        // Registrar localmente que esta coleta ja foi enviada (evita reperguntar/reenviar)
        await markCollectionSynced(currentPoint.id, row.measuredAt);
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
      
      // Adicionar fatores ambientais ao arquivo (cada linha com seus próprios fatores)
      const modifiedData = originalData.map((row: any, index: number) => {
        const processedRow = processedData[index];
        if (processedRow && processedRow.environmentalFactors) {
          return {
            ...row,
            'Cor_Alterada': processedRow.environmentalFactors.cor_alterada ? 'Sim' : 'Não',
            'Cheiro_Alterado': processedRow.environmentalFactors.cheiro_alterado ? 'Sim' : 'Não',
            'Chuva_48h': processedRow.environmentalFactors.chuva_48h ? 'Sim' : 'Não',
            'Residuos_Visiveis': processedRow.environmentalFactors.residuos_visiveis ? 'Sim' : 'Não',
            'Volume_Reduzido': processedRow.environmentalFactors.volume_reduzido ? 'Sim' : 'Não',
            'Observacoes': processedRow.environmentalFactors.observacoes || '',
          };
        }
        return row;
      });

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