// =====================================================================
// volunteer-absences — dias previstos sem coleta e sua justificativa
// ---------------------------------------------------------------------
// Duas acoes, ambas autenticadas pelo session_token do voluntario (mesmo
// padrao de volunteer-submit — os voluntarios nao usam Supabase Auth):
//
//   { action: 'list', session_token }
//     -> { pendentes: [{ date, weekday, point_id, point_name, schedule_id }] }
//     Dias previstos nos ultimos 30 dias sem leitura e sem justificativa.
//
//   { action: 'report', session_token, point_id, absence_date, reason, notes? }
//     -> { success: true }
//
// O calculo fica aqui, e nao no app, porque cruza volunteer_schedules x
// readings x collection_absences — e a tabela de faltas nao e' legivel pelo
// cliente (o texto livre pode conter motivo de saude).
//
// A varredura NUNCA volta antes do cadastro da agenda (volunteer_schedules.
// created_at): antes disso nao havia combinado, entao nao houve falta.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const TIME_ZONE = 'America/Sao_Paulo';
const DIAS_RETROATIVOS = 30;

const MOTIVOS = ['chuva', 'acesso', 'equipamento', 'bomba', 'pessoal', 'esquecimento', 'outro'];

/** 'YYYY-MM-DD' e dia da semana (0=domingo) no fuso de Sao Paulo. */
function diaLocal(d: Date): { data: string; weekday: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    data: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: mapa[get('weekday')] ?? 0,
  };
}

async function volunteerDaSessao(token: string): Promise<number | null> {
  if (!token) return null;
  const { data } = await admin
    .from('volunteer_sessions')
    .select('volunteer_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  return data.volunteer_id as number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const volunteerId = await volunteerDaSessao(String(body?.session_token || ''));
  if (!volunteerId) return json({ error: 'Sessão inválida ou expirada' }, 401);

  // -------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------
  if (body.action === 'list') {
    const { data: schedules } = await admin
      .from('volunteer_schedules')
      .select('id, point_id, weekdays, scheduled_time, is_active, created_at')
      .eq('volunteer_id', volunteerId)
      .eq('is_active', true);

    if (!schedules || schedules.length === 0) return json({ pendentes: [] });

    const pointIds = [...new Set(schedules.map((s: any) => s.point_id))];
    const { data: points } = await admin.from('points').select('id, name').in('id', pointIds);
    const nomes = new Map((points ?? []).map((p: any) => [p.id, p.name]));

    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - DIAS_RETROATIVOS * 86400000);

    // Leituras do periodo, por ponto e dia local
    const { data: readings } = await admin
      .from('readings')
      .select('point_id, volunteer_id, measured_at')
      .eq('volunteer_id', volunteerId)
      .gte('measured_at', inicio.toISOString());
    const comColeta = new Set(
      (readings ?? []).map((r: any) => `${r.point_id}|${diaLocal(new Date(r.measured_at)).data}`),
    );

    // Justificativas ja registradas
    const { data: faltas } = await admin
      .from('collection_absences')
      .select('point_id, absence_date')
      .eq('volunteer_id', volunteerId)
      .gte('absence_date', diaLocal(inicio).data);
    const jaJustificado = new Set(
      (faltas ?? []).map((a: any) => `${a.point_id}|${a.absence_date}`),
    );

    const hojeStr = diaLocal(hoje).data;
    const pendentes: unknown[] = [];

    // Varre dia a dia. Comeca em 1 (ontem): o dia de hoje ainda pode ser coletado.
    for (let i = 1; i <= DIAS_RETROATIVOS; i++) {
      const d = new Date(hoje.getTime() - i * 86400000);
      const { data: dataStr, weekday } = diaLocal(d);
      if (dataStr >= hojeStr) continue;

      for (const s of schedules as any[]) {
        if (!Array.isArray(s.weekdays) || !s.weekdays.includes(weekday)) continue;

        // Nao cobrar dias ANTERIORES ao cadastro da agenda: naquela data nao
        // havia combinado nenhum, entao nao houve falta. Sem esta guarda, um
        // voluntario cadastrado hoje abriria o app com um mes de pendencias
        // inventadas — e responderia qualquer coisa para se livrar delas.
        if (s.created_at && dataStr < diaLocal(new Date(s.created_at)).data) continue;

        const chave = `${s.point_id}|${dataStr}`;
        if (comColeta.has(chave) || jaJustificado.has(chave)) continue;

        pendentes.push({
          date: dataStr,
          weekday,
          point_id: s.point_id,
          point_name: nomes.get(s.point_id) ?? 'ponto de coleta',
          schedule_id: s.id,
          scheduled_time: String(s.scheduled_time).slice(0, 5),
        });
      }
    }

    // Mais recentes primeiro: sao os que o voluntario lembra melhor.
    pendentes.sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    return json({ pendentes });
  }

  // -------------------------------------------------------------------
  // REPORT
  // -------------------------------------------------------------------
  if (body.action === 'report') {
    const pointId = Number(body?.point_id);
    const absenceDate = String(body?.absence_date || '');
    const reason = String(body?.reason || '');
    const notes = body?.notes ? String(body.notes).slice(0, 1000).trim() : null;

    if (!Number.isFinite(pointId)) return json({ error: 'Ponto inválido' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(absenceDate)) return json({ error: 'Data inválida' }, 400);
    if (!MOTIVOS.includes(reason)) return json({ error: 'Motivo inválido' }, 400);
    if (reason === 'outro' && (!notes || notes.length < 3)) {
      return json({ error: 'Descreva o motivo quando escolher "Outro".' }, 400);
    }

    // O ponto tem que ser mesmo deste voluntario.
    const { data: vp } = await admin
      .from('volunteer_points')
      .select('point_id')
      .eq('volunteer_id', volunteerId)
      .eq('point_id', pointId)
      .maybeSingle();
    if (!vp) return json({ error: 'Ponto não pertence a este voluntário' }, 403);

    const { data: sched } = await admin
      .from('volunteer_schedules')
      .select('id')
      .eq('volunteer_id', volunteerId)
      .eq('point_id', pointId)
      .maybeSingle();

    const { error } = await admin.from('collection_absences').upsert(
      {
        volunteer_id: volunteerId,
        point_id: pointId,
        schedule_id: sched?.id ?? null,
        absence_date: absenceDate,
        reason,
        notes,
        reported_at: new Date().toISOString(),
      },
      { onConflict: 'volunteer_id,point_id,absence_date' },
    );

    if (error) {
      console.error('volunteer-absences report:', error.message);
      return json({ error: 'Não foi possível salvar a justificativa' }, 500);
    }
    return json({ success: true });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
