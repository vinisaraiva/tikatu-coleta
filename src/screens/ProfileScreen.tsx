import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { volunteer } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil do Voluntário</Text>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Nome:</Text>
        <Text style={styles.value}>{volunteer?.nome}</Text>
        
        <Text style={styles.label}>Código:</Text>
        <Text style={styles.value}>{volunteer?.code}</Text>
        
        <Text style={styles.label}>Cidade:</Text>
        <Text style={styles.value}>{volunteer?.point?.river?.city?.name}</Text>
        
        <Text style={styles.label}>Rio:</Text>
        <Text style={styles.value}>{volunteer?.point?.river?.name}</Text>
        
        <Text style={styles.label}>Ponto de Coleta:</Text>
        <Text style={styles.value}>{volunteer?.point?.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoContainer: {
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
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
}); 