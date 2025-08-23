import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ReadingDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Detalhes da Coleta</Text>
      <Text style={styles.subtitle}>Funcionalidade em desenvolvimento</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
}); 