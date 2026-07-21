import { callFunction, getSessionToken } from './api';

export interface UploadResult {
  success: boolean;
  message: string;
  filePath?: string;
}

/**
 * Converte um ArrayBuffer em string Base64 (compatível web e nativo).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
  }
  // btoa existe no web e no runtime RN moderno (Hermes)
  return typeof btoa !== 'undefined'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Envia o arquivo XLSX da coleta para o storage via Edge Function.
 * O nome final do arquivo é gerado no servidor (padrão AAAAMMDD_HHMMSS_coleta.xlsx),
 * então o nome informado aqui é apenas indicativo.
 */
export const uploadVolunteerFile = async (
  _volunteerCode: string, // mantido por compatibilidade; o servidor usa o code da sessão
  fileBuffer: ArrayBuffer,
  fileName: string
): Promise<UploadResult> => {
  try {
    const token = await getSessionToken();
    if (!token) {
      return { success: false, message: 'Sessão expirada. Faça login novamente.' };
    }

    if (fileBuffer.byteLength > 10 * 1024 * 1024) {
      return { success: false, message: 'Arquivo muito grande (máximo 10MB)' };
    }

    const fileBase64 = arrayBufferToBase64(fileBuffer);

    const result = await callFunction<{ success: boolean; filePath: string }>(
      'volunteer-upload',
      { token, fileName, fileBase64 },
      30000
    );

    return { success: true, message: 'Arquivo enviado com sucesso!', filePath: result.filePath };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro desconhecido no upload',
    };
  }
};
