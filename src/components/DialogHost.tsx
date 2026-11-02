import React, { useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { escolherBotao, obterDialogo, observarDialogos } from '../services/dialog';

export default function DialogHost() {
  const dialogo = useSyncExternalStore(observarDialogos, obterDialogo, () => null);
  if (Platform.OS !== 'web' || !dialogo) return null;
  const cancelar = () => {
    const botao = dialogo.botoes.find((b) => b.style === 'cancel');
    if (botao) escolherBotao(dialogo, botao);
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={cancelar}>
      <View style={styles.fundo}>
        <View style={styles.caixa} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.titulo}>{dialogo.titulo}</Text>
          <ScrollView style={styles.mensagem}>
            {!!dialogo.mensagem && <Text style={styles.texto}>{dialogo.mensagem}</Text>}
          </ScrollView>
          <View style={styles.botoes}>
            {dialogo.botoes.map((botao, indice) => (
              <Pressable key={indice} accessibilityRole="button"
                onPress={() => escolherBotao(dialogo, botao)}
                style={({ pressed }) => [styles.botao, pressed && styles.pressionado]}>
                <Text style={[styles.rotulo,
                  botao.style === 'cancel' && styles.cancelar,
                  botao.style === 'destructive' && styles.destrutivo]}>{botao.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  caixa: { width: '100%', maxWidth: 480, maxHeight: '90%', backgroundColor: '#ffffff', borderRadius: 16, padding: 20, flexShrink: 1 },
  titulo: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  mensagem: { flexShrink: 1 },
  texto: { fontSize: 16, lineHeight: 24, color: '#334155' },
  botoes: { marginTop: 16, gap: 8 },
  botao: { minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  pressionado: { backgroundColor: '#f1f5f9' },
  rotulo: { fontSize: 16, fontWeight: '600', color: '#0066CC', textAlign: 'center' },
  cancelar: { color: '#64748b', fontWeight: '400' },
  destrutivo: { color: '#b91c1c' },
});
