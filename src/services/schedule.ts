// =====================================================================
// Agenda de coleta do voluntário — leitura e formatação
// ---------------------------------------------------------------------
// FONTE DA VERDADE: tabela `volunteer_schedules` (mesmo Supabase da
// plataforma tikatu-aqua-view), consumida pela Edge Function
// `volunteer-collection-reminders`.
//
// REGRA COMBINADA:
//   - o voluntário tem dias fixos e um horário (ex.: Seg/Qua/Sex às 08:00);
//   - a janela é de `tolerance_minutes` ANTES e DEPOIS (padrão 60 -> 07:00 às 09:00);
//   - ao FECHAR a janela, se nenhuma coleta foi enviada, o servidor manda um
//     aviso de "coleta não registrada". Não bloqueia nada, é só um lembrete.
//
// Convenção dos dias — extraída da própria função de lembrete:
//   const weekdayMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }
// Ou seja: 0 = domingo ... 6 = sábado.
// Fuso usado pelo servidor: America/Sao_Paulo.
//
// Se a plataforma algum dia gravar outra convenção, o aviso dispararia no dia
// errado — então esta é a referência a manter.
// =====================================================================

export const TIME_ZONE = 'America/Sao_Paulo';

/** 0 = domingo ... 6 = sábado (igual à Edge Function de lembretes). */
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_LONGOS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export interface Schedule {
  id: string;
  point_id: number;
  weekdays: number[];        // 0..6
  scheduled_time: string;    // 'HH:MM:SS'
  tolerance_minutes: number;
  is_active: boolean;
}

/** 'HH:MM:SS' -> 'HH:MM' */
export function formatarHora(scheduledTime: string): string {
  return String(scheduledTime || '').slice(0, 5);
}

/** [1,3,5] -> 'Seg, Qua e Sex' */
export function formatarDias(weekdays: number[]): string {
  const dias = (weekdays || [])
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b)
    .map((d) => DIAS_CURTOS[d]);
  if (dias.length === 0) return 'sem dias definidos';
  if (dias.length === 1) return dias[0];
  if (dias.length === 7) return 'todos os dias';
  return `${dias.slice(0, -1).join(', ')} e ${dias[dias.length - 1]}`;
}

/** Data/hora atual no fuso do servidor, para não divergir do lembrete. */
export function agoraLocal(): { weekday: number; minutes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date());

  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: mapa[get('weekday')] ?? 0,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

function paraMinutos(hhmmss: string): number {
  const [h, m] = String(hhmmss || '0:0').split(':');
  return Number(h) * 60 + Number(m);
}

export type SituacaoColeta =
  | { tipo: 'na_janela'; texto: string }   // dentro da janela de coleta
  | { tipo: 'hoje_antes'; texto: string }  // é hoje, ainda não abriu a janela
  | { tipo: 'hoje_apos'; texto: string }   // é hoje, janela já fechou
  | { tipo: 'proximo'; texto: string }     // próximo dia da agenda
  | { tipo: 'sem_agenda'; texto: string };

/**
 * JANELA DE COLETA: `tolerance_minutes` ANTES e DEPOIS do horário previsto.
 * Com a tolerância padrão de 60 min e horário 08:00, a janela vai das 07:00 às 09:00.
 *
 * Ao FECHAR a janela (horário + tolerância), se nenhuma coleta tiver sido enviada,
 * a Edge Function envia o aviso de coleta não registrada. Nada é bloqueado.
 */
export function situacaoDaColeta(s: Schedule | null): SituacaoColeta {
  if (!s || !s.is_active || !Array.isArray(s.weekdays) || s.weekdays.length === 0) {
    return { tipo: 'sem_agenda', texto: 'Nenhuma agenda de coleta definida.' };
  }

  const { weekday, minutes } = agoraLocal();
  const alvo = paraMinutos(s.scheduled_time);
  const tol = s.tolerance_minutes ?? 60;
  const hora = formatarHora(s.scheduled_time);
  const fecha = formatarMinutos(alvo + tol);

  if (s.weekdays.includes(weekday)) {
    if (minutes < alvo - tol) {
      return { tipo: 'hoje_antes', texto: `Sua coleta é hoje, às ${hora}.` };
    }
    if (minutes <= alvo + tol) {
      return { tipo: 'na_janela', texto: `Sua coleta é hoje, às ${hora}. Você pode registrar até ${fecha}.` };
    }
    return { tipo: 'hoje_apos', texto: `A coleta de hoje estava prevista para ${hora} (janela até ${fecha}).` };
  }

  for (let i = 1; i <= 7; i++) {
    const d = (weekday + i) % 7;
    if (s.weekdays.includes(d)) {
      const nome = i === 1 ? 'amanhã' : DIAS_LONGOS[d];
      return { tipo: 'proximo', texto: `Próxima coleta: ${nome}, às ${hora}.` };
    }
  }
  return { tipo: 'sem_agenda', texto: 'Nenhuma agenda de coleta definida.' };
}

/** minutos do dia -> 'HH:MM' (aceita valores fora de 0..1439 sem quebrar) */
export function formatarMinutos(m: number): string {
  const t = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const min = t % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Faixa da janela, para exibir no app: 'das 07:00 às 09:00' */
export function faixaDaJanela(s: Schedule): string {
  const alvo = paraMinutos(s.scheduled_time);
  const tol = s.tolerance_minutes ?? 60;
  return `das ${formatarMinutos(alvo - tol)} às ${formatarMinutos(alvo + tol)}`;
}

/** Agenda do ponto selecionado (a tabela tem UNIQUE por volunteer_id + point_id). */
export function agendaDoPonto(schedules: Schedule[] | undefined, pointId: number | null): Schedule | null {
  if (!schedules || !pointId) return null;
  return schedules.find((s) => s.point_id === pointId && s.is_active) || null;
}
