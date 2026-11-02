import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, getCurrentPoint } from '../contexts/AuthContext';
import { APP_VERSION } from '../services/appUpdate';
import { usePwaInstall } from '../services/pwaInstall';
import InstallScreen from './InstallScreen';
import NotificationCard from '../components/NotificationCard';
import { alertar } from '../services/dialog';
import { contarIgnoradas, restaurarIgnoradas } from '../services/collectionStatus';
import { useFocusEffect } from '@react-navigation/native';

export default function ProfileScreen() {
  const { volunteer, selectedPointId } = useAuth();
  const currentPoint = getCurrentPoint(volunteer, selectedPointId);
  const { naWeb, instalado, navegador, promptDisponivel, instalar } = usePwaInstall();
  const [mostrarInstalacao, setMostrarInstalacao] = useState(false);

  // Coletas que o voluntario marcou como "Ignorar" na tela de importacao.
  // Sem um lugar para ver e desfazer isso, um toque por engano escondia a
  // coleta para sempre — e o app ainda dizia "tudo sincronizado", o que era
  // falso. A lista fica no SERVIDOR (vale em qualquer aparelho); sem internet
  // o cartao simplesmente nao aparece.
  const [ignoradas, setIgnoradas] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      contarIgnoradas()
        .then((n) => {
          if (vivo) setIgnoradas(n);
        })
        .catch(() => {
          if (vivo) setIgnoradas(0);
        });
      return () => {
        vivo = false;
      };
    }, [])
  );

  const restaurarIgnoradas = () => {
    alertar(
      'Trazer coletas de volta',
      `${ignoradas} coleta(s) foram marcadas como ignoradas e não ` +
      'foram enviadas. Quer que voltem a aparecer na próxima importação do arquivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Trazer de volta',
          onPress: async () => {
            try {
              await restaurarIgnoradas();
              setIgnoradas(0);
            } catch {
              alertar('Sem conexão', 'Não consegui falar com o servidor. Tente de novo com internet.');
            }
          },
        },
      ]
    );
  };

  if (mostrarInstalacao) {
    return (
      <InstallScreen
        modoManual
        navegador={navegador}
        promptDisponivel={promptDisponivel}
        onInstalar={instalar}
        onDispensar={() => setMostrarInstalacao(false)}
        onFechar={() => setMostrarInstalacao(false)}
      />
    );
  }

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

      {/* Avisos de coleta — sempre visível aqui, mesmo quando já ativos */}
      {naWeb && (
        <View style={styles.notificacaoBox}>
          <NotificationCard compacto />
        </View>
      )}

      {ignoradas > 0 && (
        <TouchableOpacity
          style={styles.ignoradasRow}
          onPress={restaurarIgnoradas}
          accessibilityRole="button"
        >
          <Ionicons name="archive-outline" size={20} color="#9a3412" />
          <View style={styles.installTextBox}>
            <Text style={styles.ignoradasTitle}>
              {ignoradas} coleta(s) ignorada(s)
            </Text>
            <Text style={styles.installSubtitle}>
              Não foram enviadas. Toque para trazê-las de volta.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9a3412" />
        </TouchableOpacity>
      )}

      {/* Instalação do app — só faz sentido na web e se ainda não estiver instalado */}
      {naWeb && !instalado && (
        <TouchableOpacity
          style={styles.installRow}
          onPress={() => setMostrarInstalacao(true)}
          accessibilityRole="button"
          accessibilityLabel="Ver como instalar o aplicativo"
        >
          <Ionicons name="download-outline" size={20} color="#0066CC" />
          <View style={styles.installTextBox}>
            <Text style={styles.installTitle}>Instalar o aplicativo</Text>
            <Text style={styles.installSubtitle}>
              Ícone na tela inicial, lembretes de coleta e uso sem depender do navegador.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
      )}

      {naWeb && instalado && (
        <View style={styles.installedRow}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={styles.installedText}>Aplicativo instalado neste aparelho.</Text>
        </View>
      )}

      <Text style={styles.versionText}>Versão {APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
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
    borderRadius: 12,
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
    color: '#1e293b',
    marginTop: 15,
    marginBottom: 5,
  },
  value: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
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
  notificacaoBox: { marginTop: 16 },
  ignoradasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 16,
    marginTop: 16,
  },
  ignoradasTitle: { fontSize: 15, fontWeight: '600', color: '#9a3412', marginBottom: 2 },
  installRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginTop: 16,
  },
  installTextBox: { flex: 1 },
  installTitle: { fontSize: 15, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  installSubtitle: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  installedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  installedText: { fontSize: 13, color: '#059669' },
  versionText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 24,
  },
});