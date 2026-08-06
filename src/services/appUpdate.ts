import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
//  VERSAO — FONTE UNICA: o campo "version" do package.json.
//    package.json  ->  app.config.js (require)  ->  Constants.expoConfig.version
//  Ou seja: para publicar uma versao nova, altere APENAS o package.json.
//  Nao existe mais numero de versao escrito a mao neste arquivo.
// =====================================================================

/**
 * Versao que este build esta rodando, lida do app.config.js (que por sua vez
 * le do package.json). O fallback '0.0.0' so ocorreria num build quebrado; nesse
 * caso o app se considera desatualizado e recarrega uma vez, o que e' o
 * comportamento seguro.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';

const GUARD_KEY = 'app_update_done'; // evita loop de reload na mesma sessao
const TOKEN_KEY = 'app_reload_token'; // ultimo reload_token visto neste aparelho

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
      .select('min_version, reload_token')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const minVersion = String((data as any).min_version ?? '0.0.0');
    const tokenAtual = String((data as any).reload_token ?? '');

    // ---------------------------------------------------------------
    // Gatilho 1: reload_token
    // ---------------------------------------------------------------
    // E' o mecanismo desenhado para o botao "Forcar atualizacao" do admin:
    // muda o token -> todo aparelho recarrega UMA vez na proxima abertura.
    //
    // Ate a v1.1.0 o app lia so `min_version` e IGNORAVA este campo, entao o
    // botao da plataforma nao surtia efeito nenhum. Por isso o admin passou a
    // incrementar `min_version` (chegou a 1.0.13 com a versao publicada em
    // 1.0.4) — o que fazia todo mundo se considerar desatualizado para sempre,
    // recarregando uma vez por sessao sem nunca alcancar a versao exigida.
    let precisaRecarregar = false;

    const tokenSalvo = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);

    if (tokenAtual) {
      if (tokenSalvo === null) {
        // Primeira vez que este aparelho ve o token: apenas memoriza.
        // Recarregar aqui faria todo mundo recarregar sem motivo na estreia.
        await AsyncStorage.setItem(TOKEN_KEY, tokenAtual).catch(() => undefined);
      } else if (tokenSalvo !== tokenAtual) {
        await AsyncStorage.setItem(TOKEN_KEY, tokenAtual).catch(() => undefined);
        precisaRecarregar = true;
      }
    }

    // ---------------------------------------------------------------
    // Gatilho 2: min_version
    // ---------------------------------------------------------------
    if (versaoMenor(APP_VERSION, minVersion)) precisaRecarregar = true;

    if (precisaRecarregar) {
      try {
        window.sessionStorage.setItem(GUARD_KEY, '1');
      } catch {
        /* ignore */
      }
      // Atualizacao gentil: apenas recarrega. Nao limpa cache/SW/localStorage,
      // entao a sessao do voluntario e' preservada. O service worker usa
      // network-first na navegacao, entao o reload ja traz a versao nova.
      window.location.reload();
    }
  } catch {
    // Silencioso: uma falha na checagem nunca deve travar o app.
  }
}
