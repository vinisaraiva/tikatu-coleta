// =====================================================================
// volunteer-collections — o SERVIDOR decide o que ja foi enviado
// ---------------------------------------------------------------------
// O arquivo exportado pelo app YINMIK traz TODO o historico da sonda, a cada
// exportacao. Ate a v1.5.0 o Tikatu decidia "ja enviada / ignorada / nova"
// com a memoria do aparelho — que o iPhone apaga — e, quando a consulta ao
// banco falhava (sem sinal no campo), tratava a coleta como NAO enviada.
// Resultado: coletas antigas voltavam como pendentes.
//
// Agora uma unica chamada responde, para cada visita do arquivo:
//   enviada  -> ja existe leitura deste ponto a ate 15 min de alguma medicao da visita
//   ignorada -> o voluntario marcou "Ignorar" (tabela collection_skips)
//   antiga   -> anterior a ultima coleta enviada deste ponto e nunca enviada
//               (quase sempre teste ou medicao extra; o app pergunta antes de incluir)
//   nova     -> pendente de verdade
//
// Acoes (POST JSON, sempre com `token` da sessao do voluntario):
//   status    { point_id, visitas: [{ measured_at, descartadas? }] }
//   ignorar   { point_id, measured_at, descartadas? }
//   ignoradas {}                       -> total de visitas ignoradas do voluntario
//   restaurar { point_id? }            -> desfaz as ignoradas (todas ou de um ponto)
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { JANELA_MS, ms, isoValidos, prepararVisitas, classificar } from './status.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

const MAX_VISITAS = 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getSessionVolunteer(token: string): Promise<number | null> {
  if (!token) return null;
  const { data: session } = await admin
    .from('volunteer_sessions').select('volunteer_id, expires_at').eq('token', token).maybeSingle();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    await admin.from('volunteer_sessions').delete().eq('token', token);
    return null;
  }
  return session.volunteer_id;
}

async function pontoDoVoluntario(volunteerId: number, pointId: unknown): Promise<boolean> {
  if (typeof pointId !== 'number') return false;
  const { data } = await admin
    .from('volunteer_points').select('point_id')
    .eq('volunteer_id', volunteerId).eq('point_id', pointId).maybeSingle();
  return !!data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const volunteerId = await getSessionVolunteer(String(body?.token || ''));
  if (!volunteerId) return json({ error: 'Sessão inválida ou expirada' }, 401);

  const action = String(body?.action || '');

  try {
    // -----------------------------------------------------------------
    if (action === 'status') {
      if (!(await pontoDoVoluntario(volunteerId, body.point_id))) {
        return json({ error: 'Ponto não pertence a este voluntário' }, 403);
      }
      const pointId = body.point_id as number;
      const visitas = Array.isArray(body.visitas) ? body.visitas.slice(0, MAX_VISITAS) : [];

      const itens = prepararVisitas(visitas);

      const todos = itens.flatMap((i) => i.horarios);

      // Ultima coleta enviada deste ponto (qualquer origem: voluntario ou sonda automatica).
      const { data: ultima } = await admin
        .from('readings').select('measured_at')
        .eq('point_id', pointId)
        .order('measured_at', { ascending: false }).limit(1).maybeSingle();
      const ultimaMs = ms(ultima?.measured_at ?? null);

      let enviadas: number[] = [];
      if (todos.length > 0) {
        const de = new Date(Math.min(...todos) - JANELA_MS).toISOString();
        const ate = new Date(Math.max(...todos) + JANELA_MS).toISOString();
        // Paginado: um ponto com sonda automatica pode ter milhares de leituras
        // no intervalo, e um limite fixo cortaria resultados — o que faria uma
        // coleta ja enviada aparecer como "nova".
        const PAGINA = 1000;
        for (let desde = 0; ; desde += PAGINA) {
          const { data, error } = await admin
            .from('readings').select('measured_at')
            .eq('point_id', pointId).gte('measured_at', de).lte('measured_at', ate)
            .order('measured_at', { ascending: true })
            .range(desde, desde + PAGINA - 1);
          if (error) throw error;
          for (const r of data ?? []) {
            const t = ms((r as any).measured_at);
            if (t !== null) enviadas.push(t);
          }
          if (!data || data.length < PAGINA) break;
        }
      }

      const { data: skips, error: skipsError } = await admin
        .from('collection_skips').select('measured_at, descartadas')
        .eq('point_id', pointId);
      if (skipsError) throw skipsError;
      const ignoradas = (skips ?? []).map((s: any) =>
        [ms(s.measured_at), ...((s.descartadas ?? []) as string[]).map(ms)].filter((x): x is number => x !== null)
      );

      const resultado = classificar(itens, enviadas, ignoradas, ultimaMs);

      return json({
        success: true,
        ultima_enviada: ultima?.measured_at ?? null,
        itens: resultado,
      });
    }

    // -----------------------------------------------------------------
    if (action === 'ignorar') {
      if (!(await pontoDoVoluntario(volunteerId, body.point_id))) {
        return json({ error: 'Ponto não pertence a este voluntário' }, 403);
      }
      if (ms(body.measured_at) === null) return json({ error: 'Horário inválido' }, 400);
      const { error } = await admin.from('collection_skips').upsert(
        {
          point_id: body.point_id,
          volunteer_id: volunteerId,
          measured_at: new Date(body.measured_at).toISOString(),
          descartadas: isoValidos(body.descartadas),
        },
        { onConflict: 'point_id,measured_at' }
      );
      if (error) throw error;
      return json({ success: true });
    }

    // -----------------------------------------------------------------
    if (action === 'ignoradas') {
      const { count, error } = await admin
        .from('collection_skips').select('id', { count: 'exact', head: true })
        .eq('volunteer_id', volunteerId);
      if (error) throw error;
      return json({ success: true, total: count ?? 0 });
    }

    // -----------------------------------------------------------------
    if (action === 'restaurar') {
      let q = admin.from('collection_skips').delete().eq('volunteer_id', volunteerId);
      if (typeof body.point_id === 'number') q = q.eq('point_id', body.point_id);
      const { error } = await q;
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: 'Ação desconhecida' }, 400);
  } catch (e) {
    console.error('volunteer-collections:', action, e);
    return json({ error: 'Erro interno' }, 500);
  }
});
