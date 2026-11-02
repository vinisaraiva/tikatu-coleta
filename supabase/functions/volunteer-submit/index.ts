// =====================================================================
// volunteer-submit — grava uma coleta enviada pelo app do voluntario
// ---------------------------------------------------------------------
// Copia versionada da funcao em producao (v4), com duas mudancas (v5):
//
// 1. TRAVA ANTI-DUPLICIDADE POR JANELA (+/- 15 min), nao so por horario exato.
//    A sonda grava varias medicoes por ida a campo, com segundos de diferenca.
//    Comparando so o horario exato, uma segunda medicao da mesma visita
//    passava como coleta nova (aconteceu em jul-ago/2026: 24/07 17:02:12,
//    17:02:38 e 17:03:08 gravadas como tres coletas). Mesma janela do
//    agrupamento no app (src/services/collectionGrouping.ts).
//
// 2. CONTEXTO COMPLETO. A v4 gravava so `observacoes` e `source` e jogava fora
//    o registro do agrupamento que o app manda (quantas medicoes havia na
//    visita, quais foram descartadas) — o comentario no app prometia que isso
//    ficava auditavel, mas nao ficava. Agora vai para `context`, junto com a
//    versao e a plataforma do app que enviou (para investigar problemas de
//    atualizacao: da para ver no banco qual versao mandou cada coleta).
// =====================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

const JANELA_MS = 15 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

/** Texto curto e seguro para o contexto (evita gravar objetos arbitrarios do cliente). */
function texto(v: unknown, max = 40): string | null {
  return typeof v === 'string' && v ? v.slice(0, max) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const volunteerId = await getSessionVolunteer(String(body?.token || ''));
  if (!volunteerId) return json({ error: 'Sessão inválida ou expirada' }, 401);

  const reading = body?.reading;
  if (!reading || typeof reading.point_id !== 'number' || !reading.measured_at) {
    return json({ error: 'Dados de coleta incompletos' }, 400);
  }
  const medidoEm = new Date(reading.measured_at).getTime();
  if (!Number.isFinite(medidoEm)) return json({ error: 'Horário da coleta inválido' }, 400);

  const { data: vp } = await admin
    .from('volunteer_points').select('point_id')
    .eq('volunteer_id', volunteerId).eq('point_id', reading.point_id).maybeSingle();
  if (!vp) return json({ error: 'Ponto não pertence a este voluntário' }, 403);

  // Trava anti-duplicidade por JANELA: ja existe leitura deste ponto a ate
  // 15 min deste horario? Entao e' a mesma ida a campo — nao grava de novo.
  const { data: existing } = await admin
    .from('readings').select('id')
    .eq('point_id', reading.point_id)
    .gte('measured_at', new Date(medidoEm - JANELA_MS).toISOString())
    .lte('measured_at', new Date(medidoEm + JANELA_MS).toISOString())
    .limit(1).maybeSingle();
  if (existing) {
    return json({ success: true, reading_id: existing.id, duplicate: true });
  }

  const factors = reading.factors || {};
  const app = reading.app || {};
  const descartadas = Array.isArray(factors.medicoes_descartadas)
    ? factors.medicoes_descartadas.filter((x: unknown) => typeof x === 'string').slice(0, 200)
    : [];

  try {
    const { data: inserted, error: readingError } = await admin
      .from('readings')
      .insert({
        point_id: reading.point_id,
        // Sem isto a leitura nao fica ligada a quem coletou. Alem de impedir
        // qualquer relatorio por voluntario, quebra a checagem "ja coletou hoje"
        // da funcao volunteer-collection-reminders, que compara volunteer_id:point_id.
        volunteer_id: volunteerId,
        measured_at: reading.measured_at,
        cor_alterada: factors.cor_alterada ?? null,
        cheiro_alterado: factors.cheiro_alterado ?? null,
        chuva_48h: factors.chuva_48h ?? null,
        residuos_visiveis: factors.residuos_visiveis ?? null,
        volume_reduzido: factors.volume_reduzido ?? null,
        context: {
          observacoes: factors.observacoes ?? null,
          source: 'volunteer-app',
          // Rastreabilidade do agrupamento (ver comentario no topo).
          medicoes_no_grupo: typeof factors.medicoes_no_grupo === 'number' ? factors.medicoes_no_grupo : 1,
          medicoes_descartadas: descartadas,
          inicio_da_visita: texto(factors.inicio_da_visita) ?? reading.measured_at,
          janela_agrupamento_min: typeof factors.janela_agrupamento_min === 'number' ? factors.janela_agrupamento_min : null,
          // Qual versao do app enviou (web/android/ios).
          app_version: texto(app.version, 20),
          app_platform: texto(app.platform, 20),
        },
      })
      .select().single();
    if (readingError) {
      // 23505 = violacao da constraint readings_ponto_horario_unico (corrida entre
      // dois envios do mesmo instante): trata como duplicata, nao como erro.
      if ((readingError as any).code === '23505') {
        const { data: dup } = await admin
          .from('readings').select('id')
          .eq('point_id', reading.point_id).eq('measured_at', reading.measured_at).maybeSingle();
        return json({ success: true, reading_id: dup?.id ?? null, duplicate: true });
      }
      console.error('reading:', readingError.message);
      return json({ error: 'Erro ao salvar coleta' }, 500);
    }

    const params = Array.isArray(reading.parameters) ? reading.parameters : [];
    if (params.length > 0) {
      const values = params
        .filter((p: any) => typeof p.parameter_id === 'number' && p.value !== null && p.value !== undefined)
        .map((p: any) => ({ reading_id: inserted.id, parameter_id: p.parameter_id, value: p.value }));
      if (values.length > 0) {
        const { error: valuesError } = await admin.from('reading_values').insert(values);
        if (valuesError) { console.error('values:', valuesError.message); return json({ error: 'Erro ao salvar valores dos parâmetros' }, 500); }
      }
    }

    // Se esta visita tinha sido ignorada antes e o voluntario a trouxe de volta
    // e enviou, a marca de "ignorada" deixa de fazer sentido.
    await admin.from('collection_skips').delete()
      .eq('point_id', reading.point_id).eq('measured_at', new Date(medidoEm).toISOString());

    return json({ success: true, reading_id: inserted.id });
  } catch (e) {
    console.error('Erro inesperado:', e);
    return json({ error: 'Erro interno' }, 500);
  }
});
