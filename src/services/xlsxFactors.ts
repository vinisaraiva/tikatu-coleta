// =====================================================================
// Respostas do questionario -> linhas do arquivo XLSX enviado ao storage
// ---------------------------------------------------------------------
// BUG CORRIGIDO: a copia do arquivo enviada ao storage recebia as respostas
// (cor, cheiro, chuva...) pela POSICAO da linha: linha 0 do arquivo <- coleta
// 0 do app. Mas desde o agrupamento (v1.3) e o filtro de ja enviadas, a
// coleta 0 do app nao e' a linha 0 do arquivo — as respostas iam parar em
// medicoes de outros dias.
//
// Agora o casamento e' pelo HORARIO: cada linha do arquivo recebe as
// respostas da coleta a que ela pertence (a medicao enviada ou uma das
// descartadas do mesmo grupo). Linhas que nao foram enviadas agora ficam como
// estavam.
// =====================================================================

export interface ColetaComRespostas {
  measuredAt: string;
  descartadas?: string[];
  environmentalFactors?: any;
}

export interface ColunasDeRespostas {
  Cor_Alterada: string;
  Cheiro_Alterado: string;
  Chuva_48h: string;
  Residuos_Visiveis: string;
  Volume_Reduzido: string;
  Observacoes: string;
  /** "enviada" para a medicao gravada no banco; "mesma visita" para as descartadas. */
  Tikatu_Status: string;
}

const simNao = (v: unknown) => (v ? 'Sim' : 'Não');

function colunas(f: any, status: string): ColunasDeRespostas {
  return {
    Cor_Alterada: simNao(f.cor_alterada),
    Cheiro_Alterado: simNao(f.cheiro_alterado),
    Chuva_48h: simNao(f.chuva_48h),
    Residuos_Visiveis: simNao(f.residuos_visiveis),
    Volume_Reduzido: simNao(f.volume_reduzido),
    Observacoes: f.observacoes || '',
    Tikatu_Status: status,
  };
}

/**
 * Devolve as linhas do arquivo com as colunas de respostas acrescentadas nas
 * linhas que pertencem a alguma coleta respondida.
 *
 * @param linhas    linhas originais do arquivo (sheet_to_json)
 * @param coletas   coletas do app, com as respostas
 * @param horarioDe converte a linha do arquivo no mesmo ISO usado em measuredAt
 */
export function fatoresParaLinhasDoArquivo<L extends Record<string, any>>(
  linhas: L[],
  coletas: ColetaComRespostas[],
  horarioDe: (linha: L) => string | null
): Array<L | (L & ColunasDeRespostas)> {
  const porHorario = new Map<string, ColunasDeRespostas>();
  for (const c of coletas) {
    if (!c.environmentalFactors) continue;
    porHorario.set(c.measuredAt, colunas(c.environmentalFactors, 'enviada'));
    for (const d of c.descartadas ?? []) {
      if (!porHorario.has(d)) porHorario.set(d, colunas(c.environmentalFactors, 'mesma visita'));
    }
  }

  return linhas.map((linha) => {
    const h = horarioDe(linha);
    const extra = h ? porHorario.get(h) : undefined;
    return extra ? { ...linha, ...extra } : linha;
  });
}
