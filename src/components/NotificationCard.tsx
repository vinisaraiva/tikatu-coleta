import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  DiagnosticoPush,
  EstadoPush,
  ativar,
  desativar,
  diagnosticar,
} from '../services/pushNotifications';
import { alertar } from '../services/dialog';

/**
 * Pede a permissão de notificação — a partir de um TOQUE, nunca no carregamento.
 * O Chrome ignora pedidos automáticos e, pior, passa a negar sem perguntar.
 *
 * Some quando os avisos já estão ativos, para não virar ruído permanente no
 * Dashboard; o controle continua disponível no Perfil.
 */
export default function NotificationCard({ compacto = false }: { compacto?: boolean }) {
  const [diag, setDiag] = useState<DiagnosticoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(() => {
    let vivo = true;
    diagnosticar().then((d) => {
      if (vivo) setDiag(d);
    });
    return () => {
      vivo = false;
    };
  }, []);

  useFocusEffect(recarregar);

  if (!diag) return null;
  if (diag.estado === 'indisponivel') return null;
  // No Dashboard some quando já está ativo; no Perfil (compacto) continua visível.
  if (diag.estado === 'ativo' && !compacto) return null;

  const handleAtivar = async () => {
    setOcupado(true);
    const r = await ativar();
    setOcupado(false);
    setDiag({ estado: r.estado, motivo: r.mensagem });
    if (!r.ok) alertar('Notificações', r.mensagem);
  };

  const handleDesativar = async () => {
    setOcupado(true);
    const r = await desativar();
    setOcupado(false);
    setDiag({ estado: r.estado, motivo: r.mensagem });
  };

  const visual: Record<EstadoPush, { cor: string; fundo: string; borda: string; icone: keyof typeof Ionicons.glyphMap }> = {
    ativo: { cor: '#166534', fundo: '#f0fdf4', borda: '#86efac', icone: 'notifications' },
    desativado: { cor: '#0066CC', fundo: '#eff6ff', borda: '#bfdbfe', icone: 'notifications-outline' },
    negado: { cor: '#9a3412', fundo: '#fff7ed', borda: '#fed7aa', icone: 'notifications-off-outline' },
    'precisa-instalar': { cor: '#9a3412', fundo: '#fff7ed', borda: '#fed7aa', icone: 'phone-portrait-outline' },
    indisponivel: { cor: '#64748b', fundo: '#f8fafc', borda: '#e2e8f0', icone: 'notifications-off-outline' },
  };
  const v = visual[diag.estado];

  const titulo =
    diag.estado === 'ativo'
      ? 'Avisos de coleta ativos'
      : diag.estado === 'negado'
        ? 'Avisos bloqueados'
        : diag.estado === 'precisa-instalar'
          ? 'Instale o app para receber avisos'
          : 'Ative os avisos de coleta';

  return (
    <View style={[styles.card, { backgroundColor: v.fundo, borderColor: v.borda }]}>
      <View style={styles.linha}>
        <Ionicons name={v.icone} size={20} color={v.cor} />
        <Text style={[styles.titulo, { color: v.cor }]}>{titulo}</Text>
      </View>

      <Text style={styles.descricao}>{diag.motivo}</Text>

      {diag.estado === 'desativado' && (
        <>
          <Text style={styles.detalhe}>
            São dois avisos: um 15 minutos antes do seu horário e outro se a coleta não for
            registrada até o fim da janela. Nada é bloqueado.
          </Text>
          <TouchableOpacity
            style={[styles.botao, ocupado && styles.botaoDesabilitado]}
            onPress={handleAtivar}
            disabled={ocupado}
            accessibilityRole="button"
          >
            {ocupado ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="notifications-outline" size={17} color="#FFFFFF" />
                <Text style={styles.botaoTexto}>Ativar avisos</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      {diag.estado === 'ativo' && compacto && (
        <TouchableOpacity onPress={handleDesativar} disabled={ocupado} accessibilityRole="button">
          <Text style={styles.link}>Desligar avisos neste aparelho</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  titulo: { fontSize: 15, fontWeight: '700' },
  descricao: { fontSize: 13, color: '#475569', lineHeight: 19 },
  detalhe: { fontSize: 12, color: '#64748b', lineHeight: 18, marginTop: 8 },
  botao: {
    backgroundColor: '#0066CC',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  link: { fontSize: 13, color: '#0066CC', fontWeight: '600', marginTop: 12 },
});
