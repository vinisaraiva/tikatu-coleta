import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import PointSelector from '../components/PointSelector';

export default function HistoryScreen() {
  const { volunteer, selectedPointId } = useAuth();
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const currentPoint = getCurrentPoint(volunteer, selectedPointId);

  useEffect(() => {
    fetchReadings();
  }, [selectedPointId, volunteer]);

  const fetchReadings = async () => {
    if (!currentPoint?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('readings')
        .select(`
          *,
          reading_values(
            *,
            parameter:parameters(*)
          )
        `)
        .eq('point_id', currentPoint.id)
        .order('measured_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Erro ao buscar coletas:', error);
        setReadings([]);
      } else {
        setReadings(data || []);
      }
    } catch (error) {
      console.error('Erro ao buscar coletas:', error);
      setReadings([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Histórico de Coletas</Text>
        <View style={styles.selectorContainer}>
          <PointSelector onPointSelected={fetchReadings} />
        </View>
      </View>

      {!currentPoint ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Selecione um ponto de coleta para ver o histórico</Text>
        </View>
      ) : readings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhuma coleta encontrada para este ponto</Text>
        </View>
      ) : (
        <View style={styles.readingsContainer}>
          {readings.map((reading) => (
            <View key={reading.id} style={styles.readingCard}>
              <Text style={styles.readingDate}>
                {new Date(reading.measured_at).toLocaleString('pt-BR')}
              </Text>
              {reading.reading_values && reading.reading_values.length > 0 && (
                <View style={styles.parametersContainer}>
                  {reading.reading_values.map((rv: any) => (
                    <Text key={rv.id} style={styles.parameter}>
                      {rv.parameter?.description || 'Parâmetro'}: {rv.value}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1e293b',
  },
  selectorContainer: {
    marginTop: 10,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  readingsContainer: {
    padding: 20,
  },
  readingCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  readingDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  parametersContainer: {
    marginTop: 8,
  },
  parameter: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
}); 