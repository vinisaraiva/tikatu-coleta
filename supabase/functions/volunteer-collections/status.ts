// Regra de classificacao das visitas do arquivo — funcao pura, sem banco,
// para poder ser testada (status.test.ts).

/** Mesma janela do agrupamento no app (src/services/collectionGrouping.ts). */
export const JANELA_MS = 15 * 60 * 1000;

export type Status = 'enviada' | 'ignorada' | 'antiga' | 'nova' | 'invalida';

export interface VisitaEntrada {
  measured_at?: unknown;
  descartadas?: unknown;
}

/** Converte para milissegundos; null se invalido. */
export function ms(v: unknown): number | null {
  if (typeof v !== 'string' || !v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

export function isoValidos(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista.filter((x) => ms(x) !== null).map((x) => new Date(x as string).toISOString());
}

/** Algum horario de `a` esta a ate 15 min de algum horario de `b`? */
export function perto(a: number[], b: number[]): boolean {
  for (const x of a) for (const y of b) if (Math.abs(x - y) <= JANELA_MS) return true;
  return false;
}

export interface VisitaPreparada {
  measured_at: string;
  rep: number | null;
  horarios: number[];
}

export function prepararVisitas(visitas: VisitaEntrada[]): VisitaPreparada[] {
  return visitas.map((v) => {
    const rep = ms(v?.measured_at);
    const extras = isoValidos(v?.descartadas).map((x) => new Date(x).getTime());
    return {
      measured_at: String(v?.measured_at ?? ''),
      rep,
      horarios: rep === null ? extras : [rep, ...extras],
    };
  });
}

/**
 * @param visitas    visitas do arquivo (preparadas)
 * @param enviadas   horarios (ms) das leituras ja gravadas deste ponto
 * @param ignoradas  grupos de horarios (ms) das visitas marcadas como ignoradas
 * @param ultimaMs   horario (ms) da ultima leitura gravada deste ponto, ou null
 */
export function classificar(
  visitas: VisitaPreparada[],
  enviadas: number[],
  ignoradas: number[][],
  ultimaMs: number | null
): Array<{ measured_at: string; status: Status }> {
  return visitas.map((i) => {
    let status: Status;
    if (i.horarios.length === 0) status = 'invalida';
    else if (perto(i.horarios, enviadas)) status = 'enviada';
    else if (ignoradas.some((g) => perto(i.horarios, g))) status = 'ignorada';
    else if (ultimaMs !== null && i.rep !== null && i.rep < ultimaMs - JANELA_MS) status = 'antiga';
    else status = 'nova';
    return { measured_at: i.measured_at, status };
  });
}
