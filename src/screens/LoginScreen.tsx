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
  const { login, loading, errorMessage } = useAuth();
  
  // Limpar mensagens de erro ao desmontar o componente
  useEffect(() => {
    return () => {
      // A limpeza do erro será feita no próprio contexto quando necessário
    };
  }, []);

  const handleLogin = async () => {
    // Validação básica dos campos
    if (!code.trim() || !password.trim()) {
      return; // A mensagem de erro será definida pelo contexto
    }
    
    // Chamar a função de login do contexto
    const success = await login(code.trim(), password);
    
    // Se o login falhar, aguardar um pouco antes de limpar os campos
    // para garantir que a mensagem de erro seja exibida primeiro
    if (!success) {
      setTimeout(() => {
        setCode('');
        setPassword('');
      }, 100); // Delay de 100ms para permitir que a mensagem de erro apareça
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
            
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>
                    {errorMessage}
                  </Text>
                </View>
              </View>
            ) : null}
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
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 