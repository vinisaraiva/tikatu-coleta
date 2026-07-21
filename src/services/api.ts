import AsyncStorage from '@react-native-async-storage/async-storage';

// URL base do projeto Supabase
const SUPABASE_URL = 'https://okduzgpkahddkdpzibua.supabase.co';
// Chave anon (publicável). NÃO é segredo: apenas permite chamar as Edge Functions.
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';

export const SESSION_TOKEN_KEY = 'volunteer_session_token';

export async function getSessionToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // ignorar
  }
}

/**
 * Chama uma Edge Function do Supabase via POST com JSON.
 * Lança Error com a mensagem retornada pelo servidor em caso de falha.
 */
export async function callFunction<T = any>(
  name: string,
  body: Record<string, unknown>,
  timeoutMs = 20000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(FUNCTIONS_URL + '/' + name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // resposta sem corpo JSON
    }

    if (!response.ok) {
      const message =
        (data && (data.error || data.message)) ||
        ('Erro ' + response.status + ' ao chamar ' + name);
      throw new Error(message);
    }

    return data as T;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('Tempo de conexão esgotado. Verifique sua internet.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
