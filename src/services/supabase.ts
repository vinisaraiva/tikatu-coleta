import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Configurações do ambiente
const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

// Debug: identificar o ambiente
const isWeb = Platform.OS === 'web';
const isDev = __DEV__;

// Variável para armazenar a instância única
let supabaseInstance: SupabaseClient | null = null;

// Função para obter a instância do Supabase
export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    if (isDev) {
      console.log('Inicializando cliente Supabase...');
    }
    
    const options = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: isWeb, // Só detectar sessão na URL no ambiente web
        storage: isWeb ? window.localStorage : undefined, // Usar localStorage apenas no web
      },
      global: {
        headers: {
          'X-Client-Info': `app-${Platform.OS}`,
        },
      },
    };
    
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, options);
    
    if (isDev) {
      console.log('Cliente Supabase inicializado com sucesso');
      
      // Adicionar listeners para debug
      supabaseInstance.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
      });
    }
  }
  
  return supabaseInstance;
};

// Exportar a instância para compatibilidade com código existente
export const supabase = getSupabase();

// Função de teste para verificar conexão
export const testSupabaseConnection = async (): Promise<boolean> => {
  const startTime = Date.now();
  
  try {
    if (isDev) {
      console.log('Testando conexão com Supabase...');
    }
    
    // Timeout de 10 segundos
    const timeoutPromise = new Promise<boolean>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao conectar ao Supabase')), 10000)
    );
    
    // Testar conexão básica
    const connectionPromise = (async () => {
      try {
        const { data, error, status } = await supabase
          .from('volunteers')
          .select('count')
          .limit(1);
        
        if (isDev) {
          console.log(`Teste de conexão concluído em ${Date.now() - startTime}ms`);
          console.log('Status:', status);
          console.log('Dados:', data);
          if (error) console.error('Erro:', error);
        }
        
        return !error;
      } catch (error) {
        console.error('Erro no teste de conexão:', error);
        return false;
      }
    })();
    
    // Usar Promise.race para implementar timeout
    return await Promise.race([connectionPromise, timeoutPromise]);
    
  } catch (error) {
    console.error('Erro no teste de conexão:', error);
    return false;
  }
};

// Função para limpar a sessão (útil para logout)
export const clearSupabaseSession = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
    
    // Limpar storage local no web
    if (isWeb && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        // Chaves usadas pelo supabase-js v2 no navegador
        if (key && (key.startsWith('supabase.') || key.startsWith('sb-'))) {
          keysToRemove.push(key);
        }
      }

      // Chaves legadas/derivadas que podem existir
      const legacyKeys = [
        'supabase.auth.token',
        'supabase.auth.admin',
        'supabase.auth.user',
        'supabase.auth.token.expires_at',
        'supabase.auth.token.expires_in',
        'supabase.auth.token.refresh_token',
      ];

      [...new Set([...keysToRemove, ...legacyKeys])].forEach((key) => {
        try {
          window.localStorage.removeItem(key);
        } catch {}
      });
    }
    
  } catch (error) {
    console.error('Erro ao limpar sessão do Supabase:', error);
  }
}; 