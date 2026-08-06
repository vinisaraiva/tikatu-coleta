import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Navegador,
  instrucoesPara,
  podeInstalarAqui,
} from '../services/pwaInstall';

interface Props {
  navegador: Navegador;
  promptDisponivel: boolean;
  onInstalar: () => Promise<'instalado' | 'recusado' | 'sem-prompt'>;
  /** "Agora não" — some por alguns dias. */
  onDispensar: () => void;
  /** Fechar sem marcar como dispensado (quando aberta pelo Perfil). */
  onFechar?: () => void;
  /** Aberta a partir do Perfil, e não no arranque. Muda o rodapé. */
  modoManual?: boolean;
}

const BENEFICIOS: { icone: keyof typeof Ionicons.glyphMap; titulo: string; texto: string }[] = [
  {
    icone: 'notifications-outline',
    titulo: 'Lembretes de coleta',
    texto: 'Avisos no seu dia e horário — e um aviso se a coleta não for registrada.',
  },
  {
    icone: 'cloud-offline-outline',
    titulo: 'Funciona no campo',
    texto: 'Abre mesmo com sinal ruim, sem depender do navegador.',
  },
  {
    icone: 'flash-outline',
    titulo: 'Abre direto',
    texto: 'Ícone na tela inicial, tela cheia, sem barra de endereço.',
  },
];

export default function InstallScreen({
  navegador,
  promptDisponivel,
  onInstalar,
  onDispensar,
  onFechar,
  modoManual = false,
}: Props) {
  const [status, setStatus] = useState<'inicial' | 'instalando' | 'recusado' | 'sem-prompt'>('inicial');
  const instrucoes = instrucoesPara(navegador);
  const instalavelAqui = podeInstalarAqui(navegador);

  const handleInstalar = async () => {
    setStatus('instalando');
    const r = await onInstalar();
    if (r === 'instalado') return; // a tela some sozinha pelo evento appinstalled
    setStatus(r === 'recusado' ? 'recusado' : 'sem-prompt');
  };

  return (
    <View style={styles.overlay}>
      <ScrollView
        style={styles.folha}
        contentContainerStyle={styles.conteudo}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cabecalho}>
          <View style={styles.iconeApp}>
            <Ionicons name="water" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.titulo}>Instale o Tikatu Coleta</Text>
          <Text style={styles.subtitulo}>
            O Tikatu não fica na Play Store nem na App Store. Ele é instalado direto pelo
            navegador, em poucos toques — e depois abre como qualquer outro aplicativo.
          </Text>
        </View>

        <View style={styles.beneficios}>
          {BENEFICIOS.map((b) => (
            <View key={b.titulo} style={styles.beneficio}>
              <View style={styles.beneficioIcone}>
                <Ionicons name={b.icone} size={19} color="#0066CC" />
              </View>
              <View style={styles.beneficioTexto}>
                <Text style={styles.beneficioTitulo}>{b.titulo}</Text>
                <Text style={styles.beneficioDescricao}>{b.texto}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Botão nativo — só existe onde o navegador oferece */}
        {promptDisponivel && instalavelAqui && (
          <TouchableOpacity
            style={[styles.botaoPrincipal, status === 'instalando' && styles.botaoDesabilitado]}
            onPress={handleInstalar}
            disabled={status === 'instalando'}
            accessibilityRole="button"
            accessibilityLabel="Instalar o aplicativo agora"
          >
            <Ionicons name="download-outline" size={20} color="#FFFFFF" />
            <Text style={styles.botaoPrincipalTexto}>
              {status === 'instalando' ? 'Aguardando confirmação…' : 'Instalar agora'}
            </Text>
          </TouchableOpacity>
        )}

        {status === 'recusado' && (
          <Text style={styles.recado}>
            Sem problema. Se mudar de ideia, siga o passo a passo abaixo a qualquer momento.
          </Text>
        )}
        {status === 'sem-prompt' && (
          <Text style={styles.recado}>
            Este navegador não abriu a janela de instalação. Use o passo a passo abaixo.
          </Text>
        )}

        {/* Passo a passo — sempre visível, é o caminho que funciona em todo lugar */}
        <View style={styles.passoBloco}>
          <View style={styles.passoCabecalho}>
            <Ionicons
              name={navegador.startsWith('ios') ? 'logo-apple' : 'phone-portrait-outline'}
              size={17}
              color="#334155"
            />
            <Text style={styles.passoTitulo}>{instrucoes.titulo}</Text>
          </View>

          {instrucoes.passos.map((passo, i) => (
            <View key={i} style={styles.passo}>
              <View style={styles.passoNumero}>
                <Text style={styles.passoNumeroTexto}>{i + 1}</Text>
              </View>
              <Text style={styles.passoTexto}>{passo}</Text>
            </View>
          ))}

          {instrucoes.aviso && (
            <View style={styles.aviso}>
              <Ionicons name="information-circle-outline" size={17} color="#9a3412" />
              <Text style={styles.avisoTexto}>{instrucoes.aviso}</Text>
            </View>
          )}
        </View>

        <View style={styles.rodape}>
          {modoManual ? (
            <TouchableOpacity style={styles.botaoSecundario} onPress={onFechar} accessibilityRole="button">
              <Text style={styles.botaoSecundarioTexto}>Fechar</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.botaoSecundario}
                onPress={onDispensar}
                accessibilityRole="button"
                accessibilityLabel="Continuar no navegador sem instalar"
              >
                <Text style={styles.botaoSecundarioTexto}>Continuar no navegador</Text>
              </TouchableOpacity>
              <Text style={styles.rodapeNota}>
                Você pode instalar depois pelo menu Perfil. Nada aqui é obrigatório.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...(Platform.OS === 'web' ? { position: 'fixed' as any } : { position: 'absolute' }),
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    zIndex: 10000,
  },
  folha: { flex: 1 },
  conteudo: { padding: 24, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },

  cabecalho: { alignItems: 'center', marginBottom: 24 },
  iconeApp: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titulo: { fontSize: 22, fontWeight: '700', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  subtitulo: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21 },

  beneficios: { gap: 14, marginBottom: 24 },
  beneficio: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  beneficioIcone: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beneficioTexto: { flex: 1 },
  beneficioTitulo: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 2 },
  beneficioDescricao: { fontSize: 13, color: '#64748b', lineHeight: 19 },

  botaoPrincipal: {
    backgroundColor: '#0066CC',
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  botaoDesabilitado: { opacity: 0.6 },
  botaoPrincipalTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  recado: {
    fontSize: 13,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    lineHeight: 19,
  },

  passoBloco: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  passoCabecalho: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  passoTitulo: { fontSize: 15, fontWeight: '700', color: '#334155' },
  passo: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  passoNumero: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  passoNumeroTexto: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  passoTexto: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 21 },

  aviso: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: '#9a3412', lineHeight: 19 },

  rodape: { marginTop: 24, alignItems: 'center' },
  botaoSecundario: { paddingVertical: 12, paddingHorizontal: 20 },
  botaoSecundarioTexto: { fontSize: 15, color: '#0066CC', fontWeight: '600' },
  rodapeNota: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
});
