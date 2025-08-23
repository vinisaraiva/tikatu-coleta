import { supabase } from './supabase';

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
   * Insere uma nova coleta no banco de dados
   */
  static async insertReading(readingData: ReadingData) {
    try {
      console.log('Inserindo reading com point_id:', readingData.point_id);

      // 1. Inserir registro principal na tabela readings
      const { data: reading, error: readingError } = await supabase
        .from('readings')
        .insert({
          point_id: readingData.point_id,
          measured_at: readingData.measured_at,
          cor_alterada: readingData.factors.cor_alterada,
          cheiro_alterado: readingData.factors.cheiro_alterado,
          chuva_48h: readingData.factors.chuva_48h,
          residuos_visiveis: readingData.factors.residuos_visiveis,
          volume_reduzido: readingData.factors.volume_reduzido,
          context: {
            observacoes: readingData.factors.observacoes,
          },
        })
        .select()
        .single();

      if (readingError) {
        console.error('Erro ao inserir reading:', readingError);
        throw new Error('Erro ao salvar coleta principal');
      }

      console.log('Reading inserido com sucesso:', reading);

      // 2. Se houver parâmetros, inserir na tabela reading_values
      if (readingData.parameters && readingData.parameters.length > 0) {
        const values = readingData.parameters.map(param => ({
          reading_id: reading.id,
          parameter_id: param.parameter_id,
          value: param.value,
        }));

        const { error: valuesError } = await supabase
          .from('reading_values')
          .insert(values);

        if (valuesError) {
          console.error('Erro ao inserir reading_values:', valuesError);
          throw new Error('Erro ao salvar valores dos parâmetros');
        }

        console.log('Reading values inseridos com sucesso');
      }

      return reading;
    } catch (error) {
      console.error('Erro no CollectionService.insertReading:', error);
      throw error;
    }
  }

  /**
   * Verifica se já existe uma coleta para o mesmo ponto e horário
   */
  static async checkDuplicateReading(pointId: number, measuredAt: string) {
    try {
      const { data, error } = await supabase
        .from('readings')
        .select('id')
        .eq('point_id', pointId)
        .eq('measured_at', measuredAt)
        .maybeSingle();

      if (error) {
        console.error('Erro ao verificar duplicata:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Erro no checkDuplicateReading:', error);
      return false;
    }
  }

  /**
   * Busca coletas de um ponto específico
   */
  static async getReadingsByPoint(pointId: number, limit = 50) {
    try {
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
    } catch (error) {
      console.error('Erro no getReadingsByPoint:', error);
      throw error;
    }
  }

  /**
   * Busca parâmetros disponíveis
   */
  static async getParameters() {
    try {
      const { data, error } = await supabase
        .from('parameters')
        .select('*')
        .order('description');

      if (error) {
        console.error('Erro ao buscar parâmetros:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Erro no getParameters:', error);
      throw error;
    }
  }
} 