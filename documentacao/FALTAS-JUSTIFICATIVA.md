# Justificativa de dias sem coleta

## Por que

A série temporal tem buracos. Hoje um dia sem coleta é indistinguível de um dia
em que nada foi medido por qualquer razão — e num relatório de vários meses
"sem coleta em 05/08" não explica nada. Registrar o motivo transforma a lacuna
em dado: o rio não foi medido **porque** o acesso estava alagado.

Isso também vale para a análise: um resultado atípico logo depois de uma
sequência de faltas por chuva forte se lê de outro jeito.

## O que já existe e não precisa ser refeito

A função `volunteer-collection-reminders` **já detecta** os dias falhados: ao
fechar a janela de coleta, se nenhuma leitura foi registrada, ela grava em
`volunteer_reminder_log` com `kind = 'missed'`. O sistema já sabe quais dias
falharam — falta apenas perguntar o motivo e guardar a resposta.

## Decisões tomadas

| Questão | Decisão |
|---|---|
| Formato | Motivo escolhido de uma lista **+** texto livre opcional |
| Obrigatoriedade | Pode adiar; a pendência permanece no dashboard e não bloqueia nada |
| Retroatividade | Últimos **30 dias**, nunca antes do cadastro da agenda |

O motivo em lista é o que permite agregar ("40% das faltas foram por chuva").
O texto livre guarda o detalhe do caso, que é o que serve na hora de investigar
um resultado estranho. Só texto livre exigiria classificar tudo à mão depois.

A varredura para no `created_at` da agenda. Sem isso, um voluntário cadastrado
hoje abriria o app com um mês de pendências que nunca foram combinadas — e
responderia qualquer coisa para se livrar delas. Na simulação com a agenda real
da Lahys (cadastrada em 05/08), a varredura sem essa guarda produzia **12
pendências**, sendo 11 de julho.

Adiar em vez de obrigar é coerente com a decisão de que o aviso de coleta não
bloqueia nada. Um voluntário que abre o app com pressa, no meio da coleta, não
deve ser barrado por uma pendência administrativa.

---

## 1. Migração — APLICADA

A `volunteer_schedules` já tinha `created_at`, então o `ALTER` previsto não foi
necessário.

```sql
-- Motivos fechados: e' o que permite somar por tipo no relatorio.
-- 'outro' existe como escape, sempre acompanhado do texto livre.
create type public.absence_reason as enum (
  'chuva',         -- chuva forte / tempo ruim
  'acesso',        -- acesso ao ponto impedido
  'equipamento',   -- problema com a SONDA (o instrumento de medicao)
  'bomba',         -- bomba do poco com defeito (infraestrutura do ponto)
  'pessoal',       -- motivo pessoal ou de saude
  'esquecimento',  -- esqueceu ou nao conseguiu no horario
  'outro'
);

create table public.collection_absences (
  id            bigint generated always as identity primary key,
  volunteer_id  bigint      not null references public.volunteers(id) on delete cascade,
  point_id      integer     not null references public.points(id)     on delete cascade,
  schedule_id   uuid                 references public.volunteer_schedules(id) on delete set null,
  -- Dia da falta no fuso America/Sao_Paulo (date, nao timestamp: a granularidade
  -- do fato e' o dia, e comparar datas evita confusao de fuso no relatorio).
  absence_date  date        not null,
  reason        public.absence_reason not null,
  notes         text,
  reported_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  -- Uma justificativa por voluntario/ponto/dia.
  constraint collection_absences_unicas unique (volunteer_id, point_id, absence_date),
  -- Texto livre e' obrigatorio quando o motivo e' 'outro', senao o registro
  -- nao informa nada.
  constraint collection_absences_outro_exige_texto
    check (reason <> 'outro' or (notes is not null and length(btrim(notes)) >= 3))
);

comment on table public.collection_absences is
  'Motivo informado pelo voluntario para um dia previsto de coleta em que nao houve coleta. Preenche as lacunas da serie temporal.';

create index collection_absences_por_data
  on public.collection_absences (absence_date desc);

-- RLS: os voluntarios NAO usam Supabase Auth (sessao propria em
-- volunteer_sessions), entao toda a escrita passa pela Edge Function com
-- service role. Aqui apenas fechamos o acesso direto e liberamos leitura ao
-- admin, que e' quem monta o relatorio.
alter table public.collection_absences enable row level security;

create policy "Admins leem as faltas"
  on public.collection_absences for select to authenticated
  using (has_role(auth.uid(), 'admin'::app_role));
```

Nada de leitura anônima: o texto livre pode conter motivo de saúde.

`bomba` foi acrescentado depois, a pedido: o defeito não está no instrumento de
medição e sim na infraestrutura do ponto — sem bomba não há água para amostrar.
Separar os dois deixa o relatório distinguir falha de instrumento de falha de
acesso à amostra.

## 2. Edge Function `volunteer-absences` — PUBLICADA

Duas ações, ambas autenticadas pelo `session_token` do voluntário (mesmo padrão
de `volunteer-submit`):

- **`list`** — devolve os dias previstos dos últimos 30 dias que não têm leitura
  nem justificativa. O cálculo fica no servidor porque depende de cruzar
  `volunteer_schedules` × `readings` × `collection_absences`, e a tabela de
  faltas não é legível pelo cliente.
- **`report`** — grava a justificativa (`upsert` pela chave única, para um toque
  duplo não gerar erro).

O código completo está em `documentacao/edge-functions/volunteer-absences.index.ts`.

Testada de ponta a ponta com a sessão real da voluntária: listar (200), "Outro"
sem texto (400), ponto de outro voluntário (403), gravação válida (200).

## 3. App

| Arquivo | Papel |
|---|---|
| `src/services/absences.ts` | Chama a Edge Function; lista de motivos com rótulos |
| `src/components/MissedCollectionCard.tsx` | Card no dashboard, com a lista e o campo de texto |
| `src/screens/DashboardScreen.tsx` | Renderiza o card acima do lembrete de agenda |

O card só aparece quando há pendências. "Agora não" fecha até a próxima abertura
do app — a pendência não some, só deixa de ocupar a tela naquele momento.

## 3b. Plataforma web (tikatu-aqua-view)

Sem isso, as justificativas ficariam invisíveis para quem monta o relatório.

| Arquivo | Mudança |
|---|---|
| `src/hooks/admin/useCollectionCompliance.ts` | busca `collection_absences` e devolve `absence_reason` / `absence_notes` |
| `src/components/admin/volunteers/PendingCollectionsCard.tsx` | coluna **Justificativa** + resumo por motivo acima da tabela |
| `src/integrations/supabase/types.ts` | tabela e enum novos (a consulta não compilaria sem eles) |

Duas observações menores, nenhuma urgente: o hook usa `America/Bahia` enquanto o
resto do sistema usa `America/Sao_Paulo` (hoje equivalentes, mas é uma
inconsistência esperando um horário de verão), e a janela padrão do card é de 7
dias — faltas mais antigas só aparecem trocando o filtro.

## 4. Relatório

Com a tabela preenchida, a contagem por motivo sai direto:

```sql
select reason, count(*) as vezes,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as percentual
from collection_absences
where absence_date >= current_date - interval '6 months'
group by reason order by vezes desc;
```

E os dias sem coleta **e** sem justificativa — o que ainda escapa — assim:

```sql
select vs.volunteer_id, vs.point_id, d::date as dia
from volunteer_schedules vs
cross join generate_series(current_date - interval '30 days', current_date, '1 day') d
where vs.is_active
  and extract(dow from d)::int = any(vs.weekdays)
  and not exists (select 1 from readings r
                  where r.point_id = vs.point_id
                    and r.volunteer_id = vs.volunteer_id
                    and r.measured_at::date = d::date)
  and not exists (select 1 from collection_absences a
                  where a.volunteer_id = vs.volunteer_id
                    and a.point_id = vs.point_id
                    and a.absence_date = d::date)
order by dia desc;
```

> Essa segunda consulta depende de `readings.volunteer_id` estar preenchido —
> que era nulo em todas as leituras até a correção do `volunteer-submit`.

## 5. Registro retroativo (agosto/2026)

As 8 faltas de agosto da voluntária do POÇO-01 foram informadas por ela em outro
canal e registradas pela coordenação — não digitadas por ela no app. O campo
`notes` de cada uma diz isso explicitamente, para que meses depois seja possível
distinguir o que veio do voluntário do que veio da coordenação.

| Dias | Motivo |
|---|---|
| 05, 10, 14 e 19/08 | `chuva` |
| 21, 24, 26 e 28/08 | `bomba` |
