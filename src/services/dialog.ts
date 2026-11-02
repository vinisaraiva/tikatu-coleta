// Diálogos compartilhados: Modal na web, Alert no aplicativo nativo.
import { Alert, Platform } from 'react-native';

export interface BotaoDialogo {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface Dialogo {
  titulo: string;
  mensagem?: string;
  botoes: BotaoDialogo[];
}

const fila: Dialogo[] = [];
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((ouvinte) => ouvinte());
export const obterDialogo = (): Dialogo | null => fila[0] ?? null;
export function observarDialogos(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

export function escolherBotao(dialogo: Dialogo, botao: BotaoDialogo): void {
  if (fila[0] !== dialogo || !dialogo.botoes.includes(botao)) return;
  fila.shift();
  notificar();
  botao.onPress?.();
}

export function alertar(titulo: string, mensagem?: string, botoes?: BotaoDialogo[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(titulo, mensagem, botoes);
    return;
  }
  fila.push({ titulo, mensagem, botoes: botoes?.length ? [...botoes] : [{ text: 'OK' }] });
  notificar();
}

/** Açúcar para o caso mais comum: só informar. */
export function informar(titulo: string, mensagem?: string, aoFechar?: () => void): void {
  alertar(titulo, mensagem, aoFechar ? [{ text: 'OK', onPress: aoFechar }] : undefined);
}

/** Açúcar para confirmação simples, em Promise. */
export function confirmar(titulo: string, mensagem?: string): Promise<boolean> {
  return new Promise((resolve) => {
    alertar(titulo, mensagem, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Confirmar', onPress: () => resolve(true) },
    ]);
  });
}

/** Pergunta sim/não com os rótulos reais dos botões. */
export function perguntar(
  titulo: string,
  mensagem: string,
  textoNao: string,
  textoSim: string
): Promise<boolean> {
  return new Promise((resolve) => {
    alertar(titulo, mensagem, [
      { text: textoNao, style: 'cancel', onPress: () => resolve(false) },
      { text: textoSim, onPress: () => resolve(true) },
    ]);
  });
}
