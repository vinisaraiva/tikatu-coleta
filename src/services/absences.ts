// =====================================================================
// Justificativa de dias sem coleta
// ---------------------------------------------------------------------
// Um dia previsto que passou sem leitura vira um buraco na série temporal.
// Sem motivo registrado, "sem coleta em 05/08" não diz nada num relatório de
// vários meses. Com motivo, diz: o rio não foi medido PORQUE o acesso estava
// alagado — e isso muda a leitura de um resultado atípico logo depois.
//
// O cálculo de quais dias estão pendentes fica na Edge Function
// `volunteer-absences`, porque cruza volunteer_schedules x readings x
// collection_absences, e a tabela de faltas não é legível pelo cliente (o
// texto livre pode conter motivo de saúde).
// =====================================================================

import { callFunction, getSessionToken } from './api';

/** Motivos fechados — é o que permite somar por tipo no relatório. */
export type MotivoFalta =
  | 'chuva'
  | 'acesso'
  | 'equipamento'
  | 'bomba'
  | 'pessoal'
  | 'esquecimento'
  | 'outro';

export const MOTIVOS: Array<{ valor: MotivoFalta; rotulo: string }> = [
  { valor: 'chuva', rotulo: 'Chuva forte ou tempo ruim' },
  { valor: 'acesso', rotulo: 'Acesso ao ponto impedido' },
  { valor: 'equipamento', rotulo: 'Problema com a sonda ou equipamento' },
  // Distinto de 'equipamento': o defeito nao esta no instrumento de medicao,
  // e sim na infraestrutura do ponto — sem bomba nao ha agua para amostrar.
  { valor: 'bomba', rotulo: 'Bomba do poço com defeito' },
  { valor: 'pessoal', rotulo: 'Motivo pessoal ou de saúde' },
  { valor: 'esquecimento', rotulo: 'Não consegui ir no horário' },
  { valor: 'outro', rotulo: 'Outro' },
];

export interface FaltaPendente {
  date: string; // 'YYYY-MM-DD'
  weekday: number; // 0 = domingo
  point_id: number;
  point_name: string;
  schedule_id: string | null;
  scheduled_time: string; // 'HH:MM'
}

const DIAS_LONGOS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

/** 'Quarta-feira, 05/08' — sem depender de Date, para não escorregar de fuso. */
export function descreverFalta(f: FaltaPendente): string {
  const [, mes, dia] = f.date.split('-');
  return `${DIAS_LONGOS[f.weekday] ?? ''}, ${dia}/${mes}`;
}

export async function listarPendentes(): Promise<FaltaPendente[]> {
  const token = await getSessionToken();
  if (!token) return [];
  try {
    const r = await callFunction<{ pendentes: FaltaPendente[] }>('volunteer-absences', {
      action: 'list',
      session_token: token,
    });
    return Array.isArray(r?.pendentes) ? r.pendentes : [];
  } catch {
    // Silencioso: uma falha aqui nunca deve atrapalhar o uso do app.
    return [];
  }
}

export async function justificar(
  falta: FaltaPendente,
  motivo: MotivoFalta,
  observacao?: string,
): Promise<{ ok: boolean; mensagem?: string }> {
  const token = await getSessionToken();
  if (!token) return { ok: false, mensagem: 'Faça login novamente.' };

  try {
    await callFunction('volunteer-absences', {
      action: 'report',
      session_token: token,
      point_id: falta.point_id,
      absence_date: falta.date,
      reason: motivo,
      notes: observacao?.trim() || null,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, mensagem: e?.message || 'Não foi possível salvar.' };
  }
}
