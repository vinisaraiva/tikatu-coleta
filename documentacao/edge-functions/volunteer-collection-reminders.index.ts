// =====================================================================
// volunteer-collection-reminders — versão com DUAS notificações
// ---------------------------------------------------------------------
// Cada voluntário tem dias fixos e um horário (ex.: Seg/Qua/Sex às 08:00)
// e uma tolerância (`tolerance_minutes`, padrão 60).
//
//   1) AVISO PRÉVIO  (kind = 'due')
//      Dispara 15 min ANTES do horário previsto.
//      Não é enviado se a coleta do dia já foi registrada.
//
//   2) AVISO DE AUSÊNCIA (kind = 'missed')
//      Dispara ao FECHAR a janela: horário + tolerância (ex.: 09:00).
//      Só é enviado se NENHUMA coleta do dia foi registrada.
//      É apenas um aviso: não bloqueia nem impede o registro posterior.
//
// Cada tipo é enviado no máximo uma vez por dia por agenda — garantido pela
// UNIQUE (schedule_id, reminder_date, kind) em `volunteer_reminder_log`.
//
// ATENÇÃO — esta função precisa ser INVOCADA periodicamente (a cada 5 min).
// Ver docs/PATCH-reminders-duas-notificacoes.md, seção "Agendamento".
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sendWebPush } from '../_shared/webpush.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const TIME_ZONE = 'America/Sao_Paulo';

/** Antecedência do aviso prévio, em minutos. */
const ANTECEDENCIA = 15;

/**
 * Folga da janela de disparo, em minutos. Precisa ser >= ao intervalo do cron,
 * senão um instante exato pode ser "pulado" entre duas execuções.
 * Com cron de 5 min, 10 é seguro. O log impede envio duplicado.
 */
const FOLGA = 10;

function localNow() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

const timeToMinutes = (value: string) => {
  const [h, m] = String(value).split(':');
  return Number(h) * 60 + Number(m);
};

const hhmm = (value: string) => String(value).slice(0, 5);

const minutosParaHora = (m: number) => {
  const t = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const vapid = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@tikatu.com.br',
  };

  if (!vapid.publicKey || !vapid.privateKey) {
    return json({ error: 'Chaves VAPID não configuradas' }, 500);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const payload = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const manualScheduleId: string | undefined = payload?.schedule_id;
    // 'due' | 'missed' — usado só no envio manual pelo admin
    const manualKind: 'due' | 'missed' = payload?.kind === 'missed' ? 'missed' : 'due';

    // Envio manual exige admin autenticado
    if (manualScheduleId) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autorizado' }, 401);
      const token = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user) return json({ error: 'Não autorizado' }, 401);
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: userData.user.id,
        _role: 'admin',
      });
      if (!isAdmin) return json({ error: 'Apenas administradores' }, 403);
    }

    const { date, minutes, weekday } = localNow();

    let query = supabase
      .from('volunteer_schedules')
      .select('id, volunteer_id, point_id, weekdays, scheduled_time, tolerance_minutes, is_active')
      .eq('is_active', true);

    if (manualScheduleId) query = query.eq('id', manualScheduleId);

    const { data: schedules, error: schedulesError } = await query;
    if (schedulesError) throw schedulesError;

    // ---------------------------------------------------------------
    // Decide, por agenda, se há algo a enviar AGORA e de qual tipo.
    // ---------------------------------------------------------------
    type Alvo = { schedule: any; kind: 'due' | 'missed' };
    const alvos: Alvo[] = [];

    for (const s of schedules ?? []) {
      if (manualScheduleId) {
        alvos.push({ schedule: s, kind: manualKind });
        continue;
      }
      if (!Array.isArray(s.weekdays) || !s.weekdays.includes(weekday)) continue;

      const target = timeToMinutes(s.scheduled_time);
      const tolerance = s.tolerance_minutes ?? 60;

      const inicioPrevio = target - ANTECEDENCIA;
      const fechamento = target + tolerance;

      if (minutes >= inicioPrevio && minutes < inicioPrevio + FOLGA) {
        alvos.push({ schedule: s, kind: 'due' });
      } else if (minutes >= fechamento && minutes < fechamento + FOLGA) {
        alvos.push({ schedule: s, kind: 'missed' });
      }
    }

    if (alvos.length === 0) {
      return json({
        checked: schedules?.length ?? 0,
        sent: 0,
        skipped: 'nenhuma agenda na janela de disparo',
      });
    }

    // Nomes dos pontos
    const pointIds = [...new Set(alvos.map((a) => a.schedule.point_id))];
    const { data: points } = await supabase.from('points').select('id, name').in('id', pointIds);
    const pointNames = new Map((points ?? []).map((p: any) => [p.id, p.name]));

    // Leituras de hoje — nenhum dos dois avisos vai para quem já coletou
    const dayStart = new Date(`${date}T00:00:00-03:00`).toISOString();
    const dayEnd = new Date(`${date}T23:59:59-03:00`).toISOString();
    const { data: todaysReadings } = await supabase
      .from('readings')
      .select('volunteer_id, point_id')
      .gte('measured_at', dayStart)
      .lte('measured_at', dayEnd);
    const collected = new Set((todaysReadings ?? []).map((r: any) => `${r.volunteer_id}:${r.point_id}`));

    // Avisos já enviados hoje, por tipo
    const { data: alreadySent } = await supabase
      .from('volunteer_reminder_log')
      .select('schedule_id, kind')
      .eq('reminder_date', date);
    const jaEnviado = new Set((alreadySent ?? []).map((r: any) => `${r.schedule_id}:${r.kind}`));

    let sent = 0;
    const results: unknown[] = [];

    for (const { schedule, kind } of alvos) {
      const chaveColeta = `${schedule.volunteer_id}:${schedule.point_id}`;

      if (!manualScheduleId) {
        if (collected.has(chaveColeta)) {
          results.push({ schedule: schedule.id, kind, status: 'coleta já registrada' });
          continue;
        }
        if (jaEnviado.has(`${schedule.id}:${kind}`)) {
          results.push({ schedule: schedule.id, kind, status: 'já avisado hoje' });
          continue;
        }
      }

      const { data: subs } = await supabase
        .from('volunteer_push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('volunteer_id', schedule.volunteer_id);

      if (!subs || subs.length === 0) {
        results.push({ schedule: schedule.id, kind, status: 'sem dispositivo registrado' });
        continue;
      }

      const pointName = pointNames.get(schedule.point_id) ?? 'ponto de coleta';
      const hora = hhmm(schedule.scheduled_time);
      const fecha = minutosParaHora(
        timeToMinutes(schedule.scheduled_time) + (schedule.tolerance_minutes ?? 60),
      );

      const body =
        kind === 'due'
          ? {
              title: 'Sua coleta é daqui a pouco 💧',
              body: `Coleta prevista em ${pointName} às ${hora}. Você pode registrar até ${fecha}.`,
              tag: `coleta-due-${schedule.id}-${date}`,
              url: '/',
            }
          : {
              title: 'Coleta de hoje não registrada',
              body: `Não recebemos sua coleta em ${pointName} (prevista para ${hora}). Se ainda puder registrar, é só abrir o app.`,
              tag: `coleta-missed-${schedule.id}-${date}`,
              url: '/',
            };

      let delivered = 0;
      for (const sub of subs) {
        const result = await sendWebPush(sub, body, vapid);
        if (result.ok) {
          delivered++;
          await supabase
            .from('volunteer_push_subscriptions')
            .update({ last_success_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else {
          console.error(`Push falhou [${result.status}] ${result.body}`);
          if (result.status === 404 || result.status === 410) {
            await supabase.from('volunteer_push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }

      if (delivered > 0) {
        sent += delivered;
        await supabase.from('volunteer_reminder_log').upsert(
          {
            schedule_id: schedule.id,
            volunteer_id: schedule.volunteer_id,
            point_id: schedule.point_id,
            reminder_date: date,
            kind,
            sent_count: delivered,
          },
          { onConflict: 'schedule_id,reminder_date,kind' },
        );
      }

      results.push({ schedule: schedule.id, kind, delivered });
    }

    return json({ checked: alvos.length, sent, results });
  } catch (error) {
    console.error('volunteer-collection-reminders error:', error);
    return json({ error: String((error as Error).message ?? error) }, 500);
  }
});
