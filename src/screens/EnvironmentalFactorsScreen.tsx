import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { EnvironmentalFactors } from '../services/collectionService';

interface RouteParams {
  measuredAt?: string;
  parameters?: Array<{
    parameter_id: number;
    value: number;
  }>;
  totalRows?: number;
  currentRow?: number;
  onFactorsComplete?: (factors: EnvironmentalFactors) => void;
}

export default function EnvironmentalFactorsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { volunteer } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const routeParams = route.params as RouteParams;
  const measuredAt = routeParams?.measuredAt || new Date().toISOString();
  const parameters = routeParams?.parameters;
  const totalRows = routeParams?.totalRows || 1;
  const currentRow = routeParams?.currentRow || 1;
  const onFactorsComplete = routeParams?.onFactorsComplete;
  
  console.log('EnvironmentalFactorsScreen carregada com:', {
    measuredAt,
    parametersCount: parameters?.length,
    totalRows,
    currentRow,
    hasOnFactorsComplete: !!onFactorsComplete
  });
  
  const [factors, setFactors] = useState<EnvironmentalFactors>({
    cor_alterada: null,
    cheiro_alterado: null,
    chuva_48h: null,
    residuos_visiveis: null,
    volume_reduzido: null,
    observacoes: '',
  });

  const questions = [
    {
      key: 'cor_alterada' as keyof EnvironmentalFactors,
      question: 'A cor da água está alterada?',
      description: 'Observe se a água apresenta coloração diferente do normal',
    },
    {
      key: 'cheiro_alterado' as keyof EnvironmentalFactors,
      question: 'Há odor perceptível na água?',
      description: 'Verifique se há cheiro forte ou desagradável',
    },
    {
      key: 'chuva_48h' as keyof EnvironmentalFactors,
      question: 'Choveu nas últimas 48 horas?',
      description: 'Considere chuvas nas últimas 48 horas',
    },
    {
      key: 'residuos_visiveis' as keyof EnvironmentalFactors,
      question: 'Existem resíduos visíveis?',
      description: 'Observe se há lixo, plásticos ou outros resíduos',
    },
    {
      key: 'volume_reduzido' as keyof EnvironmentalFactors,
      question: 'O volume está reduzido?',
      description: 'Verifique se o nível da água está baixo',
    },
  ];

  const handleAnswer = (key: keyof EnvironmentalFactors, value: boolean) => {
    setFactors(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const isFormComplete = () => {
    return Object.entries(factors).every(([key, value]) => {
      if (key === 'observacoes') return true; // Campo opcional
      return value !== null;
    });
  };

  const handleSubmit = async () => {
    if (!isFormComplete()) {
      Alert.alert('Atenção', 'Por favor, responda todas as perguntas obrigatórias');
      return;
    }

    if (!volunteer) {
      Alert.alert('Erro', 'Dados do voluntário não encontrados');
      return;
    }

    // Se recebemos um callback, apenas chama e volta, sem mostrar alerta local
    if (onFactorsComplete) {
      try {
        onFactorsComplete(factors);
        navigation.goBack();
      } catch (error) {
        console.error('Erro ao salvar fatores ambientais:', error);
        Alert.alert('Erro', 'Erro ao salvar os dados. Tente novamente.');
      }
      return;
    }

    // Fallback: fluxo local (quando não há callback)
    setLoading(true);
    try {
      Alert.alert(
        'Fatores Ambientais Registrados',
        'Respostas salvas com sucesso! Agora você pode sincronizar os dados.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Erro ao salvar fatores ambientais:', error);
      Alert.alert('Erro', 'Erro ao salvar os dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const QuestionCard = ({ question, questionKey }: { question: any; questionKey: keyof EnvironmentalFactors }) => (
    <View style={styles.questionCard}>
      <Text style={styles.questionText}>{question.question}</Text>
      <Text style={styles.questionDescription}>{question.description}</Text>
      
      <View style={styles.answerContainer}>
        <TouchableOpacity
          style={[
            styles.answerButton,
            factors[questionKey] === true && styles.answerButtonSelected,
          ]}
          onPress={() => handleAnswer(questionKey, true)}
        >
          <Text style={[
            styles.answerButtonText,
            factors[questionKey] === true && styles.answerButtonTextSelected,
          ]}>
            Sim
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.answerButton,
            factors[questionKey] === false && styles.answerButtonSelected,
          ]}
          onPress={() => handleAnswer(questionKey, false)}
        >
          <Text style={[
            styles.answerButtonText,
            factors[questionKey] === false && styles.answerButtonTextSelected,
          ]}>
            Não
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Fatores Ambientais</Text>
          <Text style={styles.subtitle}>
            Responda as perguntas baseadas na sua observação do local
          </Text>
          {measuredAt && (
            <Text style={styles.dateText}>
              Data/Hora: {new Date(measuredAt).toLocaleString('pt-BR')}
            </Text>
          )}
          {totalRows > 1 && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Coleta {currentRow} de {totalRows}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(currentRow / totalRows) * 100}%` }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.content}>
          {questions.map((question, index) => (
            <QuestionCard key={index} question={question} questionKey={question.key} />
          ))}

          <View style={styles.observationsContainer}>
            <Text style={styles.observationsLabel}>Observações Adicionais (Opcional)</Text>
            <Text style={styles.observationsDescription}>
              Adicione qualquer observação relevante sobre o local
            </Text>
            <TextInput
              style={styles.observationsInput}
              placeholder="Digite suas observações..."
              value={factors.observacoes}
              onChangeText={(text) => setFactors(prev => ({ ...prev, observacoes: text }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              !isFormComplete() && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isFormComplete() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                Confirmar Respostas
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  progressContainer: {
    marginTop: 10,
    paddingHorizontal: 10,
  },
  progressText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 5,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  content: {
    padding: 20,
  },
  questionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  questionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  answerContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  answerButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  answerButtonSelected: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  answerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  answerButtonTextSelected: {
    color: '#fff',
  },
  observationsContainer: {
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
  observationsLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  observationsDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  observationsInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
  },
  submitButton: {
    backgroundColor: '#00AA44',
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 