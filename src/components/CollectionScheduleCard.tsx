import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Schedule,
  formatarDias,
  formatarHora,
  faixaDaJanela,
  situacaoDaColeta,
} from '../services/schedule';

interface Props {
  schedule: Schedule | null;
  pointName?: string;
}

/**
 * Lembrete da agenda de coleta do voluntário no ponto selecionado.
 * Os dados vêm de `volunteer_schedules`, cadastrada pelo admin na plataforma web.
 */
export default function CollectionScheduleCard({ schedule, pointName }: Props) {
  const situacao = situacaoDaColeta(schedule);

  if (!schedule) {
    return (
      <View style={[styles.card, styles.cardNeutro]}>
        <View style={styles.linha}>
          <Ionicons name="calendar-outline" size={20} color="#64748b" />
          <Text style={styles.titulo}>Agenda de coleta</Text>
        </View>
        <Text style={styles.textoNeutro}>
          Nenhuma agenda definida para este ponto. Fale com a coordenação.
        </Text>
      </View>
    );
  }

  const destaque = situacao.tipo === 'na_janela';
  const hoje = situacao.tipo === 'hoje_antes' || situacao.tipo === 'hoje_apos';

  return (
    <View
      style={[
        styles.card,
        destaque ? styles.cardAgora : hoje ? styles.cardHoje : styles.cardNeutro,
      ]}
    >
      <View style={styles.linha}>
        <Ionicons
          name={destaque ? 'notifications' : 'calendar-outline'}
          size={20}
          color={destaque ? '#166534' : hoje ? '#9a3412' : '#0066CC'}
        />
        <Text style={[styles.titulo, destaque && styles.tituloAgora]}>
          {destaque ? 'Hora da sua coleta' : 'Seus dias de coleta'}
        </Text>
      </View>

      <Text style={[styles.situacao, destaque && styles.situacaoAgora]}>{situacao.texto}</Text>

      <View style={styles.detalhes}>
        <Text style={styles.detalhe}>
          <Text style={styles.rotulo}>Dias: </Text>
          {formatarDias(schedule.weekdays)}
        </Text>
        <Text style={styles.detalhe}>
          <Text style={styles.rotulo}>Horário: </Text>
          {formatarHora(schedule.scheduled_time)}
        </Text>
        {pointName ? (
          <Text style={styles.detalhe}>
            <Text style={styles.rotulo}>Ponto: </Text>
            {pointName}
          </Text>
        ) : null}
        <Text style={styles.detalhe}>
          <Text style={styles.rotulo}>Janela: </Text>
          {faixaDaJanela(schedule)}
        </Text>
        <Text style={styles.tolerancia}>
          Você recebe um aviso 15 min antes e outro ao fim da janela, se a coleta não tiver sido enviada. Nada é bloqueado.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardNeutro: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  cardHoje: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  cardAgora: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  titulo: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  tituloAgora: { color: '#166534' },
  situacao: { fontSize: 15, color: '#334155', marginBottom: 10 },
  situacaoAgora: { color: '#166534', fontWeight: '600' },
  textoNeutro: { fontSize: 14, color: '#64748b' },
  detalhes: { gap: 3 },
  detalhe: { fontSize: 13, color: '#475569' },
  rotulo: { fontWeight: '600', color: '#334155' },
  tolerancia: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
});
