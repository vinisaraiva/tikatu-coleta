import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  FaltaPendente,
  MOTIVOS,
  MotivoFalta,
  descreverFalta,
  justificar,
  listarPendentes,
} from '../services/absences';

/**
 * Pergunta o motivo dos dias previstos que passaram sem coleta.
 *
 * Trata uma pendência por vez, da mais recente para a mais antiga — é a que o
 * voluntário lembra melhor, e uma lista com 12 itens na tela leva a responder
 * qualquer coisa para se livrar.
 *
 * "Agora não" fecha o card até a próxima abertura do app. A pendência não some:
 * ela continua no servidor e volta a aparecer. Nada aqui bloqueia coleta —
 * mesma regra do aviso de coleta.
 */
export default function MissedCollectionCard() {
  const [pendentes, setPendentes] = useState<FaltaPendente[]>([]);
  const [motivo, setMotivo] = useState<MotivoFalta | null>(null);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [adiado, setAdiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      listarPendentes().then((p) => {
        if (vivo) setPendentes(p);
      });
      return () => {
        vivo = false;
      };
    }, []),
  );

  if (adiado || pendentes.length === 0) return null;

  const atual = pendentes[0];
  const precisaTexto = motivo === 'outro';
  const podeSalvar =
    motivo !== null && (!precisaTexto || observacao.trim().length >= 3) && !salvando;

  const enviar = async () => {
    if (!motivo) return;
    setSalvando(true);
    setErro(null);
    const r = await justificar(atual, motivo, observacao);
    setSalvando(false);

    if (!r.ok) {
      setErro(r.mensagem ?? 'Não foi possível salvar.');
      return;
    }
    // Passa para a próxima pendência, se houver.
    setPendentes((antes) => antes.slice(1));
    setMotivo(null);
    setObservacao('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.linha}>
        <Ionicons name="help-circle-outline" size={20} color="#9a3412" />
        <Text style={styles.titulo}>Dia sem coleta</Text>
        {pendentes.length > 1 && (
          <View style={styles.contador}>
            <Text style={styles.contadorTexto}>{pendentes.length}</Text>
          </View>
        )}
      </View>

      <Text style={styles.pergunta}>
        <Text style={styles.diaDestaque}>{descreverFalta(atual)}</Text> era dia de coleta em{' '}
        {atual.point_name}, às {atual.scheduled_time}, e não recebemos nada. O que aconteceu?
      </Text>

      <View style={styles.opcoes}>
        {MOTIVOS.map((m) => {
          const escolhido = motivo === m.valor;
          return (
            <TouchableOpacity
              key={m.valor}
              style={[styles.opcao, escolhido && styles.opcaoEscolhida]}
              onPress={() => setMotivo(m.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: escolhido }}
            >
              <Ionicons
                name={escolhido ? 'radio-button-on' : 'radio-button-off'}
                size={17}
                color={escolhido ? '#0066CC' : '#94a3b8'}
              />
              <Text style={[styles.opcaoTexto, escolhido && styles.opcaoTextoEscolhido]}>
                {m.rotulo}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {motivo && (
        <>
          <Text style={styles.rotuloCampo}>
            {precisaTexto ? 'Descreva o que aconteceu' : 'Quer detalhar? (opcional)'}
          </Text>
          <TextInput
            style={styles.campo}
            value={observacao}
            onChangeText={setObservacao}
            placeholder={
              precisaTexto ? 'Conte o que impediu a coleta' : 'Ex.: o rio subiu e cobriu a passarela'
            }
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            maxLength={1000}
          />
        </>
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}

      <View style={styles.acoes}>
        <TouchableOpacity onPress={() => setAdiado(true)} accessibilityRole="button">
          <Text style={styles.adiar}>Agora não</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.botao, !podeSalvar && styles.botaoDesabilitado]}
          onPress={enviar}
          disabled={!podeSalvar}
          accessibilityRole="button"
        >
          {salvando ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.botaoTexto}>Registrar</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.nota}>
        Isso não é cobrança. Serve para o relatório explicar por que faltou dado naquele dia.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  titulo: { fontSize: 15, fontWeight: '700', color: '#9a3412', flex: 1 },
  contador: {
    backgroundColor: '#9a3412',
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: 'center',
  },
  contadorTexto: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  pergunta: { fontSize: 14, color: '#431407', lineHeight: 20, marginBottom: 12 },
  diaDestaque: { fontWeight: '700' },

  opcoes: { gap: 2 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  opcaoEscolhida: {},
  opcaoTexto: { fontSize: 14, color: '#57534e', flex: 1 },
  opcaoTextoEscolhido: { color: '#0f172a', fontWeight: '600' },

  rotuloCampo: { fontSize: 12, color: '#78716c', marginTop: 10, marginBottom: 4 },
  campo: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e7e5e4',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#1c1917',
    minHeight: 64,
    textAlignVertical: 'top',
  },

  erro: { fontSize: 13, color: '#b91c1c', marginTop: 8 },

  acoes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  adiar: { fontSize: 14, color: '#78716c', fontWeight: '600', padding: 6 },
  botao: {
    backgroundColor: '#0066CC',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    minWidth: 110,
    alignItems: 'center',
  },
  botaoDesabilitado: { opacity: 0.45 },
  botaoTexto: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  nota: { fontSize: 11, color: '#a8a29e', marginTop: 10, lineHeight: 16 },
});
