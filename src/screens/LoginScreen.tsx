import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { login, loading } = useAuth();

  // Debug: monitorar mudanças no errorMessage
  useEffect(() => {
    console.log('errorMessage mudou para:', errorMessage);
  }, [errorMessage]);

  const handleLogin = async () => {
    console.log('=== INICIANDO LOGIN ===');
    
    if (!code.trim() || !password.trim()) {
      setErrorMessage('Por favor, preencha todos os campos');
      return;
    }

    // Limpar erro anterior apenas se os campos estiverem preenchidos
    setErrorMessage('');
    
    const success = await login(code.trim(), password);
    
    if (!success) {
      console.log('Login falhou, definindo mensagem de erro...');
      setErrorMessage('Código ou senha incorretos');
      // Limpar campos apenas se o login falhar
      setCode('');
      setPassword('');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Image 
            source={require('../../assets/imagem-home.png')} 
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Tikatu Coleta</Text>
          <Text style={styles.subtitle}>Sistema de Coleta de Dados de Qualidade da Água</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Código do Voluntário"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>
            
            {errorMessage && (
              <View style={styles.errorContainer}>
                <View style={styles.errorCard}>
                  <Text style={styles.errorTitle}>❌ Erro de Login</Text>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.infoTitle}>💧 Ciência Cidadã</Text>
            <Text style={styles.infoText}>
              A ciência cidadã se constrói em muitas mãos: sua coleta ajuda a revelar a qualidade da nossa água.
            </Text>
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
    justifyContent: 'center',
    padding: 20,
    paddingTop: 40,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 30,
    paddingVertical: 20,
  },
  image: {
    width: '90%',
    height: 250,
    maxWidth: 350,
  },
  content: {
    // Content styles are now handled by scrollContent
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  form: {
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  button: {
    backgroundColor: '#0066CC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoContainer: {
    backgroundColor: '#f1f5f9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0066CC',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 4,
    lineHeight: 22,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  errorContainer: {
    width: '100%',
    marginTop: 15,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#B91C1C',
    marginBottom: 8,
    textAlign: 'left',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
}); 