import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://okduzgpkahddkdpzibua.supabase.co";
// Service role key para bypass das políticas RLS
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZHV6Z3BrYWhkZGtkcHppYnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTQ0NzcwOSwiZXhwIjoyMDY1MDIzNzA5fQ.X4JHoj1CtKqAnIXno5PWH7nS0O8CsNZYk9oIonVzGs4";

export const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface UploadResult {
  success: boolean;
  message: string;
  filePath?: string;
}

export const uploadVolunteerFile = async (
  volunteerCode: string,
  fileBuffer: ArrayBuffer, // Changed from string to ArrayBuffer
  fileName: string
): Promise<UploadResult> => {
  try {
    // Validar volunteer_code existe e está ativo
    const { data: volunteer, error: volunteerError } = await supabaseService
      .from('volunteers')
      .select('code, is_active')
      .eq('code', volunteerCode)
      .eq('is_active', true)
      .single();

    if (volunteerError || !volunteer) {
      return {
        success: false,
        message: 'Código de voluntário inválido ou inativo'
      };
    }

    // Validar formato do nome do arquivo
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      return {
        success: false,
        message: 'Nome do arquivo deve terminar com .csv ou .xlsx'
      };
    }

    // Criar path: volunteer_code/YYYY-MM/filename
    const now = new Date();
    const yearMonth = now.toISOString().slice(0, 7); // YYYY-MM
    const filePath = `${volunteerCode}/${yearMonth}/${fileName}`;

    // Verificar se arquivo já existe
    const { data: existingFile } = await supabaseService.storage
      .from('coleta-voluntarios')
      .list(volunteerCode + '/' + yearMonth, {
        search: fileName
      });

    if (existingFile && existingFile.length > 0) {
      return {
        success: false,
        message: 'Arquivo já existe para esta data/hora'
      };
    }

    // Validar tamanho (máximo 10MB)
    if (fileBuffer.byteLength > 10 * 1024 * 1024) {
      console.log('Arquivo muito grande (tamanho em bytes):', fileBuffer.byteLength);
      return {
        success: false,
        message: 'Arquivo muito grande (máximo 10MB)'
      };
    }

    console.log('Tamanho do arquivo (bytes):', fileBuffer.byteLength);

    // Fazer upload usando service key
    let contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (fileName.endsWith('.csv')) {
      contentType = 'text/csv';
    }

    const { data, error } = await supabaseService.storage
      .from('coleta-voluntarios')
      .upload(filePath, fileBuffer, {
        contentType: contentType
      });

    if (error) {
      console.error('Erro no upload:', error);
      return {
        success: false,
        message: `Erro no upload: ${error.message}`
      };
    }

    return {
      success: true,
      message: 'Arquivo enviado com sucesso!',
      filePath: data.path
    };

  } catch (error) {
    console.error('Erro inesperado no upload:', error);
    return {
      success: false,
      message: `Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}; 