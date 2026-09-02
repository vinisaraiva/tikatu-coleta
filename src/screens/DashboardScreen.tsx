import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { alertar } from '../services/dialog';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import PointSelector from '../components/PointSelector';
import CollectionScheduleCard from '../components/CollectionScheduleCard';
import NotificationCard from '../components/NotificationCard';
import MissedCollectionCard from '../components/MissedCollectionCard';
import { agendaDoPonto } from '../services/schedule';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { volunteer, selectedPointId, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayCollections: 0,
    totalCollections: 0,
  });

  const currentPoint = getCurrentPoint(volunteer, selectedPointId);
  // Lembrete da agenda de coleta do ponto selecionado (cadastrada na plataforma web)
  const agenda = agendaDoPonto(volunteer?.schedules, currentPoint?.id ?? null);

  const fetchCollectionStats = async () => {
    if (!currentPoint?.id) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar coletas de hoje
      const { count: todayCount } = await supabase
        .from('readings')
        .select('*', { count: 'exact', head: true })
        .eq('point_id', currentPoint.id)
        .gte('measured_at', today.toISOString());

      // Buscar total de coletas
      const { count: totalCount } = await supabase
        .from('readings')
        .select('*', { count: 'exact', head: true })
        .eq('point_id', currentPoint.id);

      setStats({
        todayCollections: todayCount || 0,
        totalCollections: totalCount || 0,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar estatísticas quando a tela receber foco ou ponto selecionado mudar
  useFocusEffect(
    React.useCallback(() => {
      fetchCollectionStats();
    }, [volunteer, selectedPointId])
  );

  const handleLogout = () => {
    alertar(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', onPress: () => logout(), style: 'destructive' },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Carregando estatísticas...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo_app.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.welcomeText}>
          Olá, {volunteer?.nome || 'Voluntário'}
        </Text>
        {currentPoint && (
          <>
            <Text style={styles.locationText}>
              {currentPoint.river.city.name} - {currentPoint.river.name}
            </Text>
            <Text style={styles.pointText}>
              Ponto: {currentPoint.name}
            </Text>
          </>
        )}
        <View style={styles.selectorContainer}>
          <PointSelector />
        </View>
      </View>

      <View style={styles.agendaContainer}>
        {/* Pendencia primeiro: e' o unico item que pede uma acao do voluntario. */}
        <MissedCollectionCard />
        <CollectionScheduleCard schedule={agenda} pointName={currentPoint?.name} />
        <NotificationCard />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.todayCollections}</Text>
          <Text style={styles.statLabel}>Coletas Hoje</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalCollections}</Text>
          <Text style={styles.statLabel}>Total Coletas</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => navigation.navigate('XLSXImport' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="cloud-upload-outline" size={26} color="#ffffff" style={styles.actionIcon} />
          <View style={styles.actionTextGroup}>
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>Importar Dados da Sonda</Text>
            <Text style={[styles.actionButtonSubtext, styles.actionButtonSubtextPrimary]}>Upload do arquivo XLSX da sonda de coleta</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('History' as never)}
          activeOpacity={0.85}
        >
          <Ionicons name="time-outline" size={26} color="#0066CC" style={styles.actionIcon} />
          <View style={styles.actionTextGroup}>
            <Text style={styles.actionButtonText}>Histórico de Coletas</Text>
            <Text style={styles.actionButtonSubtext}>Ver coletas anteriores</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 14,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  logo: {
    width: 200,
    height: 88,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 4,
  },
  pointText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  selectorContainer: {
    marginTop: 12,
    paddingHorizontal: 20,
  },
  agendaContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0066CC',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionsContainer: {
    padding: 20,
    gap: 15,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonPrimary: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  actionIcon: {
    marginRight: 2,
  },
  actionTextGroup: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  actionButtonTextPrimary: {
    color: '#ffffff',
  },
  actionButtonSubtext: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  actionButtonSubtextPrimary: {
    color: 'rgba(255, 255, 255, 0.88)',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    margin: 20,
    padding: 15,
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
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 