// deno test supabase/functions/volunteer-collections/status.test.ts
import { classificar, prepararVisitas, perto, JANELA_MS, escolherReferencia } from './status.ts';

function eq(a: unknown, b: unknown, msg: string) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg}: ${sa} != ${sb}`);
}

const t = (iso: string) => new Date(iso).getTime();

// Leituras ja gravadas do ponto (como no banco: so a medicao representante).
const enviadas = [
  t('2026-10-26T01:06:34Z'), // 26/10 22:06 local
  t('2026-10-30T15:05:57Z'), // 30/10 12:05 local (ultima)
];
const ultima = t('2026-10-30T15:05:57Z');

// Visita ignorada pelo voluntario (com uma medicao descartada).
const ignoradas = [[t('2026-10-28T11:00:00Z'), t('2026-10-28T10:58:00Z')]];

Deno.test('classifica o arquivo acumulado do YINMIK', () => {
  const visitas = prepararVisitas([
    // ja enviada, mesmo horario
    { measured_at: '2026-10-30T15:05:57Z' },
    // ja enviada, mas o arquivo agora agrupou diferente: a representante e' outra
    // medicao da mesma visita (2 min depois) -> continua "enviada"
    { measured_at: '2026-10-26T01:08:40Z', descartadas: ['2026-10-26T01:06:34Z'] },
    // ignorada antes (mesmo horario)
    { measured_at: '2026-10-28T11:00:00Z' },
    // teste antigo nunca enviado -> "antiga"
    { measured_at: '2026-10-20T12:00:00Z' },
    // coleta nova, depois da ultima
    { measured_at: '2026-11-01T11:30:00Z' },
    // horario invalido
    { measured_at: 'lixo' },
  ]);
  const r = classificar(visitas, enviadas, ignoradas, ultima).map((x) => x.status);
  eq(r, ['enviada', 'enviada', 'ignorada', 'antiga', 'nova', 'invalida'], 'status');
});

Deno.test('medicao descartada perto de uma enviada conta como enviada', () => {
  const v = prepararVisitas([{ measured_at: '2026-10-30T15:30:00Z', descartadas: ['2026-10-30T15:10:00Z'] }]);
  eq(classificar(v, enviadas, [], ultima)[0].status, 'enviada', 'descartada');
});

Deno.test('ponto sem nenhuma coleta: tudo e nova', () => {
  const v = prepararVisitas([{ measured_at: '2025-01-01T00:00:00Z' }, { measured_at: '2026-11-01T00:00:00Z' }]);
  eq(classificar(v, [], [], null).map((x) => x.status), ['nova', 'nova'], 'sem historico');
});

Deno.test('mais de 15 min antes da ultima e antiga; depois da ultima e nova', () => {
  const v = prepararVisitas([{ measured_at: new Date(ultima - JANELA_MS - 60_000).toISOString() },
                             { measured_at: new Date(ultima + 20 * 60_000).toISOString() }]);
  eq(classificar(v, [], [], ultima).map((x) => x.status), ['antiga', 'nova'], 'limite');
});

Deno.test('janela de 15 min inclusiva', () => {
  eq(perto([0], [JANELA_MS]), true, '15 min');
  eq(perto([0], [JANELA_MS + 1]), false, '15 min + 1 ms');
});

Deno.test('referencia prioriza envio proprio mesmo com outro mais recente', () => {
  const propria = '2026-11-01T08:00:00Z';
  const outro = '2026-11-01T09:51:00Z';
  const referencia = escolherReferencia(propria, outro);
  eq(referencia, propria, 'envio proprio');
  const visitas = prepararVisitas([{ measured_at: '2026-11-01T09:00:00Z' }, { measured_at: outro }]);
  eq(classificar(visitas, [t(outro)], [], t(referencia!)).map((x) => x.status), ['nova', 'enviada'], 'deduplicacao por ponto preservada');
});

Deno.test('sem envio proprio usa ultima leitura do ponto', () => {
  const ponto = '2026-11-01T09:51:00Z';
  eq(escolherReferencia(null, ponto), ponto, 'reserva pelo ponto');
  eq(classificar(prepararVisitas([{ measured_at: '2026-10-01T00:00:00Z' }]), [], [], t(escolherReferencia(null, ponto)!))[0].status, 'antiga', 'historico da sonda');
});

Deno.test('sem historico proprio nem do ponto referencia e null', () => {
  const referencia = escolherReferencia(null, null);
  eq(referencia, null, 'sem referencia');
  eq(classificar(prepararVisitas([{ measured_at: '2026-10-01T00:00:00Z' }]), [], [], referencia)[0].status, 'nova', 'sem historico');
});
