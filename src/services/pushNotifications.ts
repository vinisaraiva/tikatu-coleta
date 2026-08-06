// =====================================================================
// Notificações push do voluntário
// ---------------------------------------------------------------------
// Fluxo completo, e por que cada peça existe:
//
//   1. O navegador precisa de PERMISSÃO. Só pode ser pedida a partir de um
//      gesto do usuário (um toque num botão). Pedir no carregamento da tela é
//      bloqueado pelo Chrome e queima a chance — o usuário não vê nada e o
//      navegador passa a negar automaticamente.
//   2. Precisa de um SERVICE WORKER registrado (scripts/prepare-web.js).
//   3. Assina no `pushManager` usando a chave pública VAPID, que vem da Edge
//      Function `volunteer-push-subscribe` (GET).
//   4. Manda a inscrição para a mesma função (POST), autenticada pelo
//      `session_token` do voluntário. Ela grava em `volunteer_push_subscriptions`.
//   5. A função `volunteer-collection-reminders` lê essa tabela e envia os
//      avisos. Sem o passo 4, ela responde "sem dispositivo registrado".
//
// No iPhone há uma exigência a mais: o Safari só permite push em PWA
// INSTALADO na tela de início. No navegador comum a API nem existe.
// =====================================================================

import { Platform } from 'react-native';
import { getSessionToken } from './api';

const SUPABASE_URL = 'https://okduzgpkahddkdpzibua.supabase.co';
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

export type EstadoPush =
  | 'indisponivel'      // navegador sem suporte (ou build nativo)
  | 'precisa-instalar'  // iOS fora do PWA instalado
  | 'negado'            // usuário bloqueou nas permissões do navegador
  | 'desativado'        // suportado, ainda não ativado
  | 'ativo';            // inscrito e salvo no servidor

export interface DiagnosticoPush {
  estado: EstadoPush;
  motivo: string;
}

const naWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

function ehIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
}

function estaInstaladoComoApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window.navigator as any).standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
  );
}

/** Converte a chave VAPID base64url no Uint8Array que o pushManager exige. */
function chaveParaBytes(base64url: string): Uint8Array {
  const preenchimento = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

export async function diagnosticar(): Promise<DiagnosticoPush> {
  if (!naWeb()) {
    return { estado: 'indisponivel', motivo: 'Notificações só funcionam na versão web do app.' };
  }

  const temAPI =
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  // No iPhone o Safari só expõe push quando o PWA está instalado na tela de
  // início. Antes disso a API simplesmente não existe — então esta checagem
  // vem primeiro, senão o usuário receberia "seu navegador não suporta".
  if (ehIOS() && !estaInstaladoComoApp()) {
    return {
      estado: 'precisa-instalar',
      motivo:
        'No iPhone, os avisos só funcionam depois de adicionar o Tikatu à tela de início. Instale o app e abra por lá.',
    };
  }

  if (!temAPI) {
    return { estado: 'indisponivel', motivo: 'Este navegador não suporta notificações.' };
  }

  if (Notification.permission === 'denied') {
    return {
      estado: 'negado',
      motivo:
        'As notificações estão bloqueadas para este site. Libere nas configurações do navegador (cadeado ao lado do endereço) e tente de novo.',
    };
  }

  try {
    const registro = await navigator.serviceWorker.getRegistration();
    const inscricao = await registro?.pushManager.getSubscription();
    if (inscricao && Notification.permission === 'granted') {
      return { estado: 'ativo', motivo: 'Você receberá os avisos de coleta neste aparelho.' };
    }
  } catch {
    /* cai no desativado */
  }

  return { estado: 'desativado', motivo: 'Ative para receber os avisos de coleta.' };
}

async function buscarChaveVapid(): Promise<string> {
  const resp = await fetch(`${FUNCTIONS_URL}/volunteer-push-subscribe`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY },
  });
  const dados = await resp.json().catch(() => ({}));
  const chave = dados?.vapid_public_key;
  if (!chave) throw new Error('Servidor não devolveu a chave de notificações.');
  return chave;
}

export interface ResultadoAtivacao {
  ok: boolean;
  estado: EstadoPush;
  mensagem: string;
}

/**
 * Ativa as notificações. DEVE ser chamada a partir de um toque do usuário,
 * senão o navegador ignora o pedido de permissão.
 */
export async function ativar(): Promise<ResultadoAtivacao> {
  const diag = await diagnosticar();
  if (diag.estado === 'indisponivel' || diag.estado === 'precisa-instalar' || diag.estado === 'negado') {
    return { ok: false, estado: diag.estado, mensagem: diag.motivo };
  }

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== 'granted') {
      return {
        ok: false,
        estado: permissao === 'denied' ? 'negado' : 'desativado',
        mensagem: 'Permissão não concedida. Sem ela não é possível enviar os avisos.',
      };
    }

    const registro = await navigator.serviceWorker.ready;

    // Reaproveita a inscrição existente, se houver; senão cria uma nova.
    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) {
      const chave = await buscarChaveVapid();
      inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(chave) as unknown as BufferSource,
      });
    }

    const token = await getSessionToken();
    if (!token) {
      return { ok: false, estado: 'desativado', mensagem: 'Faça login novamente e tente outra vez.' };
    }

    const resp = await fetch(`${FUNCTIONS_URL}/volunteer-push-subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ session_token: token, subscription: inscricao.toJSON() }),
    });

    const dados = await resp.json().catch(() => ({}));
    if (!resp.ok || dados?.error) {
      return {
        ok: false,
        estado: 'desativado',
        mensagem: dados?.error || 'Não foi possível registrar este aparelho.',
      };
    }

    return { ok: true, estado: 'ativo', mensagem: 'Pronto. Você receberá os avisos de coleta.' };
  } catch (erro: any) {
    console.error('[push] falha ao ativar:', erro);
    return {
      ok: false,
      estado: 'desativado',
      mensagem: erro?.message || 'Não foi possível ativar as notificações.',
    };
  }
}

/** Desliga os avisos neste aparelho e apaga a inscrição no servidor. */
export async function desativar(): Promise<ResultadoAtivacao> {
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    const inscricao = await registro?.pushManager.getSubscription();
    if (!inscricao) {
      return { ok: true, estado: 'desativado', mensagem: 'Avisos já estavam desligados.' };
    }

    const token = await getSessionToken();
    if (token) {
      await fetch(`${FUNCTIONS_URL}/volunteer-push-subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          session_token: token,
          unsubscribe: true,
          subscription: { endpoint: inscricao.endpoint },
        }),
      }).catch(() => undefined);
    }

    await inscricao.unsubscribe().catch(() => undefined);
    return { ok: true, estado: 'desativado', mensagem: 'Avisos desligados neste aparelho.' };
  } catch {
    return { ok: false, estado: 'desativado', mensagem: 'Não foi possível desligar os avisos.' };
  }
}
