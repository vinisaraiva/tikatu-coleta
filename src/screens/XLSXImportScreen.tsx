import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { CollectionService } from '../services/collectionService';
import { uploadVolunteerFile } from '../services/uploadService';

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
  const { volunteer } = useAuth();
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedRow[]>([]);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [readyToSync, setReadyToSync] = useState(false);

  const isWeb = Platform.OS === 'web';

  const showAlert = (title: string, message: string) => {
    if (isWeb && typeof window !== 'undefined') {
      try { window.alert(`${title}\n\n${message}`); } catch {}
      return;
    }
    Alert.alert(title, message);
  };

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

  const processXLSXFile = async () => {
    if (!selectedFile || selectedFile.canceled) {
      showAlert('Erro', 'Nenhum arquivo selecionado');
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
            measuredAt: row.Date,
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
        Alert.alert('Erro', 'Nenhum dado válido encontrado no arquivo');
        return;
      }

      // Limpar estado anterior e definir novos dados
      setProcessedData([]);
      setCurrentRowIndex(0);
      setReadyToSync(false);
      
      // Usar setTimeout para garantir que o estado foi limpo
      setTimeout(() => {
        setProcessedData(processedRows);

        if (isWeb) {
          // No web, seguir direto para fatores ambientais da primeira linha
          startEnvironmentalFactors(processedRows[0], 0);
          return;
        }

        if (processedRows.length === 1) {
          Alert.alert(
            'Arquivo Processado',
            `Encontrada ${processedRows.length} coleta válida. Agora responda os fatores ambientais.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Continuar', onPress: () => startEnvironmentalFactors(processedRows[0], 0) },
            ]
          );
        } else {
          Alert.alert(
            'Arquivo Processado',
            `Encontradas ${processedRows.length} coletas válidas. Você responderá os fatores ambientais para cada coleta individualmente.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Continuar', onPress: () => startEnvironmentalFactors(processedRows[0], 0) },
            ]
          );
        }
      }, 100);

    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      showAlert('Erro', 'Erro ao processar arquivo XLSX');
    } finally {
      setProcessing(false);
    }
  };

  const startEnvironmentalFactors = async (row: ProcessedRow, rowIndex: number) => {
    console.log(`Iniciando fatores ambientais para linha ${rowIndex + 1}/${processedData.length}`);
    console.log('Dados da linha:', {
      measuredAt: row.measuredAt,
      parametersCount: row.parameters.length,
      totalRows: processedData.length,
      currentRow: rowIndex + 1
    });

    // Navegar para fatores ambientais com os dados da coleta específica
    (navigation as any).navigate('EnvironmentalFactors', {
      measuredAt: row.measuredAt,
      parameters: row.parameters,
      totalRows: processedData.length,
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
            Alert.alert(
              'Processamento Concluído',
              'Todos os fatores ambientais foram respondidos. Agora você pode sincronizar os dados.',
              [{ text: 'OK' }]
            );
          } else {
            // Ir para a próxima linha
            const nextRow = updatedData[rowIndex + 1];
            if (nextRow) {
              Alert.alert(
                'Fatores Ambientais Salvos',
                `Fatores ambientais da coleta ${rowIndex + 1} salvos. Próxima coleta: ${nextRow.measuredAt}`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Próxima Coleta', onPress: () => startEnvironmentalFactors(nextRow, rowIndex + 1) },
                ]
              );
            } else {
              console.error('Próxima linha não encontrada');
            }
          }
          
          return updatedData;
        });
      },
    });
  };

  const syncToSupabase = async () => {
    if (!readyToSync || !selectedFile) {
      Alert.alert('Erro', 'Complete o processamento antes de sincronizar');
      return;
    }

    // Verificar se todas as linhas têm fatores ambientais
    const incompleteRows = processedData.filter(row => !row.environmentalFactors);
    if (incompleteRows.length > 0) {
      Alert.alert('Erro', `${incompleteRows.length} coletas ainda não têm fatores ambientais respondidos.`);
      return;
    }

    setLoading(true);

    try {
      // Verificar dados do voluntário
      console.log('Dados do voluntário antes da sincronização:');
      console.log('Volunteer:', volunteer);
      console.log('Point ID:', volunteer?.point_id);
      console.log('Point:', volunteer?.point);

      if (!volunteer?.point_id) {
        throw new Error('Point ID do voluntário não encontrado');
      }

      // Processar todas as linhas com seus fatores ambientais específicos
      for (let i = 0; i < processedData.length; i++) {
        const row = processedData[i];
        const readingData = {
          point_id: volunteer.point_id,
          measured_at: row.measuredAt,
          factors: row.environmentalFactors,
          parameters: row.parameters,
        };

        console.log(`Inserindo reading ${i + 1}/${processedData.length} com dados:`, readingData);
        await CollectionService.insertReading(readingData);
      }

      // Modificar o arquivo XLSX original com todos os fatores ambientais
      const fileUri = selectedFile.assets![0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Ler o workbook original
      const workbook = XLSX.read(fileContent, { type: 'base64' });
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

      // Excluir arquivo local após upload bem-sucedido
      try {
        const fileUri = selectedFile.assets![0].uri;
        await FileSystem.deleteAsync(fileUri);
        console.log('Arquivo local excluído com sucesso');
      } catch (deleteError) {
        console.warn('Erro ao excluir arquivo local:', deleteError);
        // Não falhar a sincronização por erro na exclusão
      }

      Alert.alert(
        'Sincronização Concluída',
        `${processedData.length} coletas foram sincronizadas com o Supabase e o arquivo XLSX modificado foi enviado para o storage com sucesso!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Limpar estado
              setSelectedFile(null);
              setProcessedData([]);
              setCurrentRowIndex(0);
              setReadyToSync(false);
              navigation.goBack();
            },
          },
        ]
      );

    } catch (error) {
      console.error('Erro na sincronização:', error);
      Alert.alert('Erro', 'Erro ao sincronizar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Calcular progresso das coletas
  const completedRows = processedData.filter(row => row.environmentalFactors).length;
  const totalRows = processedData.length;

  return (
    <ScrollView style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
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
    color: '#333',
    marginBottom: 10,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  boldText: {
    fontWeight: 'bold',
  },
}); 