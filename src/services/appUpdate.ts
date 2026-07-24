import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// =====================================================================
// Auto-atualizacao do PWA (forca pegar a versao nova, sem derrubar o login)
// ---------------------------------------------------------------------
// Como funciona:
//  - No arranque, o app le a tabela `app_config` no Supabase (mesmo banco
//    da plataforma) e compara com a versao que ele esta' rodando.
//  - Se estiver atras (min_version) OU se o admin mudou o `reload_token`,
//    ele limpa SO' o cache de arquivos + service worker e recarrega.
//  - O localStorage (token de sessao/login) NAO e' tocado -> continua logado.
//
//  IMPORTANTE: sempre que publicar uma versao nova, suba o numero em
//  APP_VERSION abaixo E no app.config.js ("version"), mantendo-os iguais.
// =====================================================================

export const APP_VERSION = '1.0.1'; // <<< BUMP a cada publicacao (igual ao app.config.js)

const TOKEN_KEY = 'app_reload_token';
const GUARD_KEY = 'app_update_done'; // evita loop de reload na mesma sessao

function versaoMenor(a: string, b: string): boolean {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

async function limparCacheDeArquivos(): Promise<void> {
  // Limpa apenas o Cache Storage (arquivos do PWA) e o service worker.
  // NAO mexe no localStorage -> a sessao do voluntario e' preservada.
  try {
    if (typeof caches !== 'undefined') {
      const chaves = await caches.keys();
      await Promise.all(chaves.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
}

export async function checarAtualizacao(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  // Ja tentamos atualizar nesta sessao? Evita loop caso a config esteja errada.
  try {
    if (window.sessionStorage.getItem(GUARD_KEY) === '1') return;
  } catch {
    /* ignore */
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_config')
      .select('min_version, reload_token')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const tokenServidor = String((data as any).reload_token ?? '0');
    const tokenLocal = window.localStorage.getItem(TOKEN_KEY);

    const versaoAtrasada = versaoMenor(APP_VERSION, String((data as any).min_version ?? '0.0.0'));
    const tokenMudou = tokenLocal !== null && tokenLocal !== tokenServidor;

    // Primeira visita (sem token local): so' registra, nao recarrega.
    if (tokenLocal === null) {
      window.localStorage.setItem(TOKEN_KEY, tokenServidor);
    }

    if (versaoAtrasada || tokenMudou) {
      try {
        window.sessionStorage.setItem(GUARD_KEY, '1');
      } catch {
        /* ignore */
      }
      window.localStorage.setItem(TOKEN_KEY, tokenServidor);
      await limparCacheDeArquivos();
      window.location.reload();
    }
  } catch {
    // Silencioso: uma falha na checagem nunca deve travar o app.
  }
}
