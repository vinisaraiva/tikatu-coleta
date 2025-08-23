import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://okduzgpkahddkdpzibua.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDc3MDksImV4cCI6MjA2NTAyMzcwOX0.-CIuPMipeet_jpTjj6kAdn3YRqBWrvrSCxDtV82kIRw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Função de teste para verificar conexão
export const testSupabaseConnection = async () => {
  try {
    console.log('Testando conexão com Supabase...');
    
    // Testar conexão básica
    const { data, error } = await supabase
      .from('volunteers')
      .select('count')
      .limit(1);
    
    console.log('Teste de conexão - dados:', data);
    console.log('Teste de conexão - erro:', error);
    
    if (error) {
      console.error('Erro na conexão:', error);
      return false;
    }
    
    console.log('Conexão com Supabase OK!');
    return true;
  } catch (error) {
    console.error('Erro no teste de conexão:', error);
    return false;
  }
}; 