import { callFunction, getSessionToken } from './api';

// =====================================================================
// Status das coletas do arquivo — decidido pelo SERVIDOR
// ---------------------------------------------------------------------
// O arquivo do app YINMIK traz todo o historico da sonda a cada exportacao.
// Ate a v1.5.0 o app decidia "ja enviada / ignorada" com a memoria do
// aparelho, que o iPhone apaga, e tratava como NAO enviada qualquer coleta
// cuja consulta ao banco falhasse. Daqui em diante:
//
//  - o servidor e' a unica fonte da verdade (vale em qualquer aparelho);
//  - uma chamada so por arquivo;
//  - se a consulta falhar, o app NAO adivinha: avisa que precisa de internet.
//
// Edge Function: supabase/functions/volunteer-collections
// =====================================================================

export type StatusColeta = 'enviada' | 'ignorada' | 'antiga' | 'nova' | 'invalida';

export interface VisitaParaConsulta {
  measuredAt: string;
  descartadas?: string[];
}

export interface ResultadoStatus {
  /** Status por horario da medicao representante (measuredAt). */
  porHorario: Map<string, StatusColeta>;
  /** Ultima coleta ja enviada deste ponto (ISO), ou null. */
  ultimaEnviada: string | null;
}

/** Erro de "nao deu para falar com o servidor" — o app nao deve seguir sem a resposta. */
export class SemConexaoError extends Error {
  constructor(message = 'Sem conexão com o servidor') {
    super(message);
    this.name = 'SemConexaoError';
  }
}

async function token(): Promise<string> {
  const t = await getSessionToken();
  if (!t) throw new Error('Sessão expirada. Faça login novamente.');
  return t;
}

/**
 * Pergunta ao servidor o status de cada visita do arquivo.
 * Lanca SemConexaoError se a chamada falhar por rede/servidor.
 */
export async function consultarStatus(
  pointId: number,
  visitas: VisitaParaConsulta[]
): Promise<ResultadoStatus> {
  const tk = await token();
  let resp: { itens: Array<{ measured_at: string; status: StatusColeta }>; ultima_enviada: string | null };
  try {
    resp = await callFunction('volunteer-collections', {
      token: tk,
      action: 'status',
      point_id: pointId,
      visitas: visitas.map((v) => ({ measured_at: v.measuredAt, descartadas: v.descartadas ?? [] })),
    }, 30000);
  } catch (e: any) {
    const msg = String(e?.message || '');
    // Sessao expirada e ponto invalido nao sao "falta de internet": repassa.
    if (/sess[aã]o|ponto/i.test(msg)) throw e;
    throw new SemConexaoError(msg || undefined);
  }

  const porHorario = new Map<string, StatusColeta>();
  for (const item of resp?.itens ?? []) porHorario.set(item.measured_at, item.status);
  // Seguranca: o que o servidor nao respondeu NAO vira "nova" por omissao.
  for (const v of visitas) if (!porHorario.has(v.measuredAt)) {
    throw new SemConexaoError('Resposta incompleta do servidor');
  }
  return { porHorario, ultimaEnviada: resp?.ultima_enviada ?? null };
}

/** Marca a visita como ignorada no servidor (vale em qualquer aparelho). */
export async function ignorarNoServidor(
  pointId: number,
  measuredAt: string,
  descartadas: string[] = []
): Promise<void> {
  await callFunction('volunteer-collections', {
    token: await token(),
    action: 'ignorar',
    point_id: pointId,
    measured_at: measuredAt,
    descartadas,
  });
}

/** Quantas visitas o voluntario marcou como ignoradas (todos os pontos). */
export async function contarIgnoradas(): Promise<number> {
  const resp = await callFunction<{ total: number }>('volunteer-collections', {
    token: await token(),
    action: 'ignoradas',
  });
  return resp?.total ?? 0;
}

/** Desfaz as ignoradas: elas voltam a aparecer na proxima importacao. */
export async function restaurarIgnoradas(pointId?: number): Promise<void> {
  await callFunction('volunteer-collections', {
    token: await token(),
    action: 'restaurar',
    ...(typeof pointId === 'number' ? { point_id: pointId } : {}),
  });
}

// ---------------------------------------------------------------------
// Separacao das visitas por status — funcao pura, testada sem servidor
// ---------------------------------------------------------------------
export interface Separacao<T> {
  novas: T[];
  antigas: T[];
  enviadas: number;
  ignoradas: number;
  invalidas: number;
}

export function separarPorStatus<T extends { measuredAt: string }>(
  visitas: T[],
  porHorario: Map<string, StatusColeta>
): Separacao<T> {
  const out: Separacao<T> = { novas: [], antigas: [], enviadas: 0, ignoradas: 0, invalidas: 0 };
  for (const v of visitas) {
    switch (porHorario.get(v.measuredAt)) {
      case 'nova': out.novas.push(v); break;
      case 'antiga': out.antigas.push(v); break;
      case 'enviada': out.enviadas++; break;
      case 'ignorada': out.ignoradas++; break;
      default: out.invalidas++; break;
    }
  }
  return out;
}
