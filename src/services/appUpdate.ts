import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// =====================================================================
// Auto-atualizacao do PWA — versao GENTIL (nao derruba o login)
// ---------------------------------------------------------------------
// Como funciona:
//  - No arranque, o app le `min_version` na tabela `app_config` (mesmo banco
//    da plataforma). Se a versao que ele roda for menor, ele apenas RECARREGA.
//  - NAO limpa cache, NAO mexe em service worker, NAO toca no localStorage.
//    -> a sessao/login do voluntario e' preservada.
//  - Combinado com o `index.html` servido como no-cache no Render, o reload
//    busca a versao nova (os bundles tem nome com hash).
//
//  Contrato com a plataforma: o botao do admin define `min_version` igual a'
//  versao publicada. Quem estiver abaixo recarrega e pega a versao nova.
//
//  IMPORTANTE: a cada publicacao, suba APP_VERSION aqui E em app.config.js.
// =====================================================================

export const APP_VERSION = '1.0.3'; // <<< BUMP a cada publicacao (igual ao app.config.js)

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

export async function checarAtualizacao(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // Ja recarregou nesta sessao? Evita loop caso min_version esteja mal configurado.
  try {
    if (window.sessionStorage.getItem(GUARD_KEY) === '1') return;
  } catch {
    /* ignore */
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('app_config')
      .select('min_version')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const minVersion = String((data as any).min_version ?? '0.0.0');

    if (versaoMenor(APP_VERSION, minVersion)) {
      try {
        window.sessionStorage.setItem(GUARD_KEY, '1');
      } catch {
        /* ignore */
      }
      // Atualizacao gentil: apenas recarrega. Nao limpa cache/SW/localStorage.
      window.location.reload();
    }
  } catch {
    // Silencioso: uma falha na checagem nunca deve travar o app.
  }
}
