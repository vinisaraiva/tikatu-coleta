// =====================================================================
// Diálogos que funcionam no PWA
// ---------------------------------------------------------------------
// PROBLEMA: no react-native-web o `Alert` é literalmente
//
//     class Alert { static alert() {} }
//
// ou seja, uma função VAZIA. Toda chamada de `Alert.alert(...)` no navegador
// não faz absolutamente nada — sem erro, sem aviso, sem console. Foi por isso
// que o botão "Sair" do Dashboard parecia morto: o diálogo de confirmação nunca
// aparecia, então o `onPress` do "Sair" nunca era executado.
//
// Como o Tikatu Coleta é usado principalmente como PWA, qualquer confirmação
// feita por `Alert.alert` estava silenciosamente sumindo — eram 16 chamadas.
//
// SOLUÇÃO: este módulo mantém a MESMA assinatura do `Alert.alert`, para ser
// uma troca direta, e no navegador usa `window.alert` / `window.confirm`.
//
//   import { alertar } from '../services/dialog';
//   alertar('Sair', 'Tem certeza?', [
//     { text: 'Cancelar', style: 'cancel' },
//     { text: 'Sair', style: 'destructive', onPress: () => logout() },
//   ]);
//
// Regra no navegador:
//   0 ou 1 botão  -> window.alert   e depois dispara o onPress do botão
//   2 ou mais     -> window.confirm e dispara o onPress do botão escolhido
// =====================================================================

import { Alert, Platform } from 'react-native';

export interface BotaoDialogo {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

const naWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

/** Junta título e mensagem no texto único que o navegador sabe mostrar. */
function texto(titulo: string, mensagem?: string): string {
  if (!mensagem) return titulo;
  return `${titulo}\n\n${mensagem}`;
}

export function alertar(titulo: string, mensagem?: string, botoes?: BotaoDialogo[]): void {
  if (!naWeb()) {
    Alert.alert(titulo, mensagem, botoes as any);
    return;
  }

  const lista = botoes ?? [];

  // Sem escolha: apenas informa e executa o único callback, se houver.
  if (lista.length <= 1) {
    try {
      window.alert(texto(titulo, mensagem));
    } catch {
      /* ignore */
    }
    lista[0]?.onPress?.();
    return;
  }

  // Com escolha: o "cancelar" é o botão marcado como cancel (ou o primeiro),
  // e o "confirmar" é o último que não seja o cancelar.
  const iCancelar = lista.findIndex((b) => b.style === 'cancel');
  const cancelar = iCancelar >= 0 ? lista[iCancelar] : lista[0];
  const confirmar = [...lista].reverse().find((b) => b !== cancelar) ?? lista[lista.length - 1];

  let ok = false;
  try {
    ok = window.confirm(texto(titulo, mensagem));
  } catch {
    ok = false;
  }

  if (ok) confirmar?.onPress?.();
  else cancelar?.onPress?.();
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
