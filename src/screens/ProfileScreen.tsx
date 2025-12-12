import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';

export default function ProfileScreen() {
  const { volunteer, selectedPointId } = useAuth();
  const currentPoint = getCurrentPoint(volunteer, selectedPointId);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Perfil do Voluntário</Text>
      <View style={styles.infoContainer}>
        <Text style={styles.label}>Nome:</Text>
        <Text style={styles.value}>{volunteer?.nome}</Text>
        
        <Text style={styles.label}>Código:</Text>
        <Text style={styles.value}>{volunteer?.code}</Text>
        
        {currentPoint && (
          <>
            <Text style={styles.label}>Cidade:</Text>
            <Text style={styles.value}>{currentPoint.river.city.name}</Text>
            
            <Text style={styles.label}>Rio:</Text>
            <Text style={styles.value}>{currentPoint.river.name}</Text>
            
            <Text style={styles.label}>Ponto de Coleta Atual:</Text>
            <Text style={styles.value}>{currentPoint.name}</Text>
          </>
        )}
        
        {volunteer?.points && volunteer.points.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Todos os Pontos de Coleta:</Text>
            {volunteer.points.map((point) => (
              <View key={point.id} style={styles.pointCard}>
                <View style={styles.pointHeader}>
                  <Text style={styles.pointName}>{point.name}</Text>
                  {point.is_primary && (
                    <Text style={styles.primaryBadge}>Principal</Text>
                  )}
                  {selectedPointId === point.id && (
                    <Text style={styles.selectedBadge}>Selecionado</Text>
                  )}
                </View>
                <Text style={styles.pointLocation}>
                  {point.river.city.name} - {point.river.name}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 15,
  },
  pointCard: {
    backgroundColor: '#f8fafc',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pointName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  primaryBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  selectedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  pointLocation: {
    fontSize: 14,
    color: '#64748b',
  },
}); 