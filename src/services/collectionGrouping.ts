// =====================================================================
// Agrupamento de medições da sonda em coletas
// ---------------------------------------------------------------------
// O PROBLEMA QUE ISTO RESOLVE
//
// A sonda grava uma linha no arquivo CADA VEZ que o voluntário aperta o botão.
// Numa única ida a campo ele mede várias vezes — o que é correto, é assim que
// se confere se a leitura estabilizou. Um arquivo real da voluntária tinha:
//
//     03/08 — 4 medições em 1 minuto
//     05/08 — 8 medições em 10 minutos
//     07/08 — 5 medições em 5 minutos
//
// 17 linhas, 3 idas a campo. Sem agrupamento o app tratava cada linha como uma
// coleta distinta — e não estava errado, os horários são mesmo diferentes — e
// pedia o questionário de fatores ambientais 8 vezes seguidas. Do dia 05/08
// nenhuma das 8 chegou ao banco: o cansaço venceu antes.
//
// COMO AGRUPAMOS
//
// Medições separadas por menos de `JANELA_MINUTOS` pertencem à mesma visita.
// De cada grupo enviamos a ÚLTIMA medição, que é a mais estabilizada — a sonda
// já assentou. As descartadas ficam registradas no `context` da leitura, para
// a coleta continuar auditável: nenhum dado do arquivo é perdido em silêncio.
// =====================================================================

export const JANELA_MINUTOS = 15;

export interface MedicaoBruta {
  measuredAt: string; // ISO UTC
  parameters: Array<{ parameter_id: number; value: number }>;
  originalRow: any;
}

export interface ColetaAgrupada extends MedicaoBruta {
  /** Quantas medições a sonda gravou nesta visita. */
  medicoesNoGrupo: number;
  /** Horários das medições descartadas (todas menos a representante). */
  descartadas: string[];
  /** Primeira medição da visita, para exibir o intervalo ao voluntário. */
  inicioDaVisita: string;
}

const minutos = (ms: number) => ms / 60000;

/**
 * Junta medições próximas no tempo e devolve uma coleta por visita.
 * A representante de cada grupo é a ÚLTIMA medição.
 */
export function agruparPorVisita<T extends MedicaoBruta>(
  medicoes: T[],
  janelaMinutos: number = JANELA_MINUTOS,
): Array<T & ColetaAgrupada> {
  if (medicoes.length === 0) return [];

  const ordenadas = [...medicoes].sort(
    (a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
  );

  const grupos: T[][] = [];
  let atual: T[] = [ordenadas[0]];

  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = new Date(atual[atual.length - 1].measuredAt).getTime();
    const agora = new Date(ordenadas[i].measuredAt).getTime();
    if (minutos(agora - anterior) <= janelaMinutos) {
      atual.push(ordenadas[i]);
    } else {
      grupos.push(atual);
      atual = [ordenadas[i]];
    }
  }
  grupos.push(atual);

  return grupos.map((g) => {
    const representante = g[g.length - 1]; // a última, já estabilizada
    return {
      ...representante,
      medicoesNoGrupo: g.length,
      descartadas: g.slice(0, -1).map((m) => m.measuredAt),
      inicioDaVisita: g[0].measuredAt,
    };
  });
}

/** 'DD/MM às HH:MM' no fuso do aparelho, para mostrar ao voluntário. */
export function descreverVisita(c: Pick<ColetaAgrupada, 'measuredAt' | 'medicoesNoGrupo' | 'inicioDaVisita'>): string {
  const fim = new Date(c.measuredAt);
  const dia = fim.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const hFim = fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  if (c.medicoesNoGrupo <= 1) return `${dia} às ${hFim}`;

  const hIni = new Date(c.inicioDaVisita).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dia}, ${hIni}–${hFim} (${c.medicoesNoGrupo} medições)`;
}
