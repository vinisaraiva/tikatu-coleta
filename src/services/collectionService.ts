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
  /** Versao e plataforma do app que enviou (gravadas em readings.context). */
  app?: { version: string; platform: string };
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
   * Verifica se já existe uma coleta para este ponto e horário no banco.
   * Usado para não repetir perguntas/envio de coletas já sincronizadas
   * (inclusive as enviadas antes desta versão ou de outro dispositivo).
   */
  /**
   * Ja existe leitura deste ponto DENTRO da janela de +/- `janelaMinutos` em
   * torno do horario informado?
   *
   * Por que uma janela e nao o horario exato: a sonda grava varias medicoes
   * numa mesma ida a campo (ate 8 em 10 minutos, em arquivo real). O app agrupa
   * essas medicoes numa coleta so e envia apenas a ultima. As descartadas
   * continuam no arquivo do voluntario e voltariam a aparecer como novas na
   * proxima importacao se a checagem fosse por igualdade exata.
   *
   * Checar a janela resolve isso no SERVIDOR, entao funciona tambem quando o
   * voluntario troca de aparelho ou limpa os dados do navegador.
   */
  static async existsReadingNearby(
    pointId: number,
    measuredAt: string,
    janelaMinutos = 15
  ): Promise<boolean> {
    try {
      const t = new Date(measuredAt).getTime();
      if (isNaN(t)) return false;
      const de = new Date(t - janelaMinutos * 60000).toISOString();
      const ate = new Date(t + janelaMinutos * 60000).toISOString();

      const { data, error } = await supabase
        .from('readings')
        .select('id')
        .eq('point_id', pointId)
        .gte('measured_at', de)
        .lte('measured_at', ate)
        .limit(1);
      if (error) return false;
      return Array.isArray(data) && data.length > 0;
    } catch {
      return false;
    }
  }

  static async existsReading(pointId: number, measuredAt: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('id')
        .eq('point_id', pointId)
        .eq('measured_at', measuredAt)
        .maybeSingle();
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
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
