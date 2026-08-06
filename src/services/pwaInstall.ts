// =====================================================================
// Instalação do PWA — detecção de ambiente e prompt nativo
// ---------------------------------------------------------------------
// O Tikatu Coleta é um PWA: não vem da Play Store nem da App Store, é
// instalado a partir do próprio navegador. Cada navegador faz isso de um
// jeito, e só alguns oferecem o botão nativo — por isso a tela de instalação
// precisa saber exatamente onde está rodando.
//
// Quem dispara o prompt nativo é o evento `beforeinstallprompt`, capturado
// em dist/index.html (ver scripts/prepare-web.js) e guardado em
// `window.__tikatuInstallPrompt`. Capturamos lá porque o evento costuma
// disparar antes do React montar; se esperássemos o componente, ele já teria
// passado. O index.html também emite `tikatu:installable` e `tikatu:installed`.
//
// IMPORTANTE: o evento só dispara se o site tiver manifest válido, ícones de
// 192 e 512 px REAIS e um service worker registrado com handler de fetch.
// Os três são produzidos por scripts/prepare-web.js.
// =====================================================================

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const CHAVE_DISPENSADO = 'pwa_install_dispensado_em';

/** Depois de dispensar, a tela só volta a aparecer daqui a tantos dias. */
export const DIAS_ATE_PERGUNTAR_DE_NOVO = 7;

export type Navegador =
  | 'android-chrome'   // Chrome/Edge/Samsung no Android — tem prompt nativo
  | 'ios-safari'       // Safari no iPhone/iPad — só manual, via Compartilhar
  | 'ios-outro'        // Chrome/Firefox no iOS — precisa abrir no Safari
  | 'desktop'          // Chrome/Edge no computador — ícone na barra de endereço
  | 'firefox-android'  // Firefox no Android — "Adicionar à tela inicial"
  | 'outro';

export interface EstadoInstalacao {
  /** Está rodando na web? Em build nativo nada disso se aplica. */
  naWeb: boolean;
  /** Já está instalado e aberto como app (standalone). */
  instalado: boolean;
  /** O navegador ofereceu o prompt nativo de instalação. */
  promptDisponivel: boolean;
  navegador: Navegador;
  /** Terminou de checar o AsyncStorage. Evita piscar a tela no arranque. */
  pronto: boolean;
  /** Deve abrir a tela de instalação agora. */
  deveMostrar: boolean;
}

function detectarNavegador(): Navegador {
  if (typeof window === 'undefined') return 'outro';
  const ua = window.navigator.userAgent || '';

  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  if (ios) {
    // No iOS todo navegador usa o motor do Safari, mas só o Safari de verdade
    // consegue adicionar à tela inicial. CriOS = Chrome, FxiOS = Firefox.
    const outroNoIOS = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return outroNoIOS ? 'ios-outro' : 'ios-safari';
  }

  const android = /Android/.test(ua);
  if (android) {
    if (/Firefox/.test(ua)) return 'firefox-android';
    return 'android-chrome';
  }

  if (/Chrome|Chromium|Edg\//.test(ua)) return 'desktop';
  return 'outro';
}

export function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as any).standalone === true;
  const displayStandalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches);
  return Boolean(iosStandalone || displayStandalone);
}

/**
 * Este navegador consegue instalar aqui mesmo? `false` significa que o
 * voluntário precisa trocar de navegador antes (caso do Chrome no iPhone).
 */
export function podeInstalarAqui(nav: Navegador): boolean {
  return nav !== 'ios-outro';
}

export async function dispensar(): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE_DISPENSADO, String(Date.now()));
  } catch {
    /* silencioso: dispensar nunca deve quebrar o app */
  }
}

export async function limparDispensa(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE_DISPENSADO);
  } catch {
    /* ignore */
  }
}

async function foiDispensadoRecentemente(): Promise<boolean> {
  try {
    const valor = await AsyncStorage.getItem(CHAVE_DISPENSADO);
    if (!valor) return false;
    const quando = Number(valor);
    if (!Number.isFinite(quando)) return false;
    const dias = (Date.now() - quando) / 86400000;
    return dias < DIAS_ATE_PERGUNTAR_DE_NOVO;
  } catch {
    return false;
  }
}

export function usePwaInstall(): EstadoInstalacao & {
  instalar: () => Promise<'instalado' | 'recusado' | 'sem-prompt'>;
  dispensarAgora: () => Promise<void>;
  abrirManualmente: () => void;
  fechar: () => void;
} {
  const naWeb = Platform.OS === 'web' && typeof window !== 'undefined';

  const [instalado, setInstalado] = useState(false);
  const [promptDisponivel, setPromptDisponivel] = useState(false);
  const [navegador, setNavegador] = useState<Navegador>('outro');
  const [pronto, setPronto] = useState(false);
  const [deveMostrar, setDeveMostrar] = useState(false);

  useEffect(() => {
    if (!naWeb) {
      setPronto(true);
      return;
    }

    const nav = detectarNavegador();
    setNavegador(nav);

    const jaInstalado = estaInstalado();
    setInstalado(jaInstalado);
    setPromptDisponivel(Boolean((window as any).__tikatuInstallPrompt));

    const aoFicarInstalavel = () => setPromptDisponivel(true);
    const aoInstalar = () => {
      setInstalado(true);
      setPromptDisponivel(false);
      setDeveMostrar(false);
    };
    window.addEventListener('tikatu:installable', aoFicarInstalavel);
    window.addEventListener('tikatu:installed', aoInstalar);

    let vivo = true;
    (async () => {
      // Já instalado: nunca mostrar.
      if (jaInstalado) {
        if (vivo) setPronto(true);
        return;
      }
      const dispensado = await foiDispensadoRecentemente();
      if (!vivo) return;
      setDeveMostrar(!dispensado);
      setPronto(true);
    })();

    return () => {
      vivo = false;
      window.removeEventListener('tikatu:installable', aoFicarInstalavel);
      window.removeEventListener('tikatu:installed', aoInstalar);
    };
  }, [naWeb]);

  const instalar = useCallback(async (): Promise<'instalado' | 'recusado' | 'sem-prompt'> => {
    if (typeof window === 'undefined') return 'sem-prompt';
    const evento = (window as any).__tikatuInstallPrompt;
    if (!evento || typeof evento.prompt !== 'function') return 'sem-prompt';

    try {
      await evento.prompt();
      const escolha = await evento.userChoice;
      (window as any).__tikatuInstallPrompt = null;
      setPromptDisponivel(false);
      if (escolha?.outcome === 'accepted') {
        setInstalado(true);
        setDeveMostrar(false);
        return 'instalado';
      }
      return 'recusado';
    } catch {
      return 'sem-prompt';
    }
  }, []);

  const dispensarAgora = useCallback(async () => {
    setDeveMostrar(false);
    await dispensar();
  }, []);

  const abrirManualmente = useCallback(() => setDeveMostrar(true), []);
  const fechar = useCallback(() => setDeveMostrar(false), []);

  return {
    naWeb,
    instalado,
    promptDisponivel,
    navegador,
    pronto,
    deveMostrar,
    instalar,
    dispensarAgora,
    abrirManualmente,
    fechar,
  };
}

// ---------------------------------------------------------------------
// Textos das instruções, por navegador
// ---------------------------------------------------------------------

export interface Instrucoes {
  titulo: string;
  passos: string[];
  aviso?: string;
}

export function instrucoesPara(nav: Navegador): Instrucoes {
  switch (nav) {
    case 'android-chrome':
      return {
        titulo: 'No Android',
        passos: [
          'Toque no menu ⋮ no canto superior direito do navegador.',
          'Escolha "Instalar app" ou "Adicionar à tela inicial".',
          'Confirme em "Instalar".',
          'O ícone do Tikatu aparece junto com seus outros aplicativos.',
        ],
      };

    case 'ios-safari':
      return {
        titulo: 'No iPhone ou iPad',
        passos: [
          'Toque no botão Compartilhar — o quadrado com a seta para cima, na barra do Safari.',
          'Role a lista para baixo e escolha "Adicionar à Tela de Início".',
          'Toque em "Adicionar", no canto superior direito.',
          'O ícone do Tikatu aparece na sua tela de início.',
        ],
        aviso:
          'No iPhone o botão automático não existe: a Apple só permite a instalação por esse caminho, pelo próprio Safari.',
      };

    case 'ios-outro':
      return {
        titulo: 'Abra no Safari primeiro',
        passos: [
          'Toque no menu do navegador que você está usando.',
          'Escolha "Abrir no Safari".',
          'No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".',
        ],
        aviso:
          'No iPhone, só o Safari consegue instalar aplicativos web. Chrome, Firefox e Edge não têm essa opção.',
      };

    case 'firefox-android':
      return {
        titulo: 'No Firefox para Android',
        passos: [
          'Toque no menu ⋮ do navegador.',
          'Escolha "Instalar" ou "Adicionar à tela inicial".',
          'Confirme.',
        ],
      };

    case 'desktop':
      return {
        titulo: 'No computador',
        passos: [
          'Procure o ícone de instalação na barra de endereço, à direita — um monitor com uma seta.',
          'Se não aparecer, abra o menu ⋮ e escolha "Instalar Tikatu Coleta".',
          'Confirme em "Instalar".',
        ],
      };

    default:
      return {
        titulo: 'Como instalar',
        passos: [
          'Abra o menu do seu navegador.',
          'Procure por "Instalar app" ou "Adicionar à tela inicial".',
          'Confirme a instalação.',
        ],
        aviso:
          'Se não encontrar a opção, abra este endereço no Chrome (Android) ou no Safari (iPhone).',
      };
  }
}
