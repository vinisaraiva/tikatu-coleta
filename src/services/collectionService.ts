import { supabase } from './supabase';
import { callFunction, getSessionToken } from './api';

export interface EnvironmentalFactors {
  cor_alterada: boolean | null;
  cheiro_alterado: boolean | null;
  chuva_48h: boolean | null;
  residuos_visiveis: boolean | null;
  volume_reduzido: boolean | null;
  observacoes?: string;
}

export interface ReadingData {
  point_id: number;
  measured_at: string;
  factors: EnvironmentalFactors;
  parameters?: Array<{
    parameter_id: number;
    value: number;
  }>;
}

export class CollectionService {
  /**
   * Insere uma nova coleta via Edge Function (validação de sessão no servidor).
   */
  static async insertReading(readingData: ReadingData) {
    const token = await getSessionToken();
    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const result = await callFunction<{ success: boolean; reading_id: number }>(
      'volunteer-submit',
      { token, reading: readingData }
    );

    return { id: result.reading_id };
  }

  /**
   * Busca coletas de um ponto específico (leitura pública).
   */
  static async getReadingsByPoint(pointId: number, limit = 50) {
    const { data, error } = await supabase
      .from('readings')
      .select(`
        *,
        reading_values(
          *,
          parameter:parameters(*)
        )
      `)
      .eq('point_id', pointId)
      .order('measured_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar coletas:', error);
      throw error;
    }
    return data;
  }

  /**
   * Busca parâmetros disponíveis (leitura pública).
   */
  static async getParameters() {
    const { data, error } = await supabase
      .from('parameters')
      .select('*')
      .order('description');

    if (error) {
      console.error('Erro ao buscar parâmetros:', error);
      throw error;
    }
    return data;
  }
}
