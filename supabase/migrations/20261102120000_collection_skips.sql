-- =====================================================================
-- Coletas IGNORADAS pelo voluntario, guardadas no SERVIDOR
-- ---------------------------------------------------------------------
-- Ate a v1.5.0, "Ignorar" na importacao do XLSX gravava a coleta so na
-- memoria do aparelho (AsyncStorage/localStorage). No iPhone essa memoria
-- e' apagada pelo Safari; trocar de celular ou limpar o navegador tem o
-- mesmo efeito. Resultado: tudo o que tinha sido ignorado voltava como
-- "pendente" na importacao seguinte — o principal problema relatado.
--
-- Com esta tabela, "ignorada" passa a valer em qualquer aparelho.
--
-- Uma linha por VISITA ignorada: `measured_at` e' a medicao representante
-- (a ultima do grupo, a mesma que seria enviada) e `descartadas` guarda as
-- demais medicoes do mesmo grupo, para que nenhuma delas volte sozinha.
--
-- Acesso: SOMENTE pelas Edge Functions (service role). RLS ligado e nenhuma
-- policy => a chave anon do app nao le nem grava nada aqui.
-- =====================================================================

create table if not exists public.collection_skips (
  id           bigint generated always as identity primary key,
  point_id     integer     not null references public.points(id)     on delete cascade,
  volunteer_id bigint      not null references public.volunteers(id) on delete cascade,
  measured_at  timestamptz not null,
  descartadas  timestamptz[] not null default '{}',
  created_at   timestamptz not null default now(),
  constraint collection_skips_ponto_horario_unico unique (point_id, measured_at)
);

comment on table public.collection_skips is
  'Visitas do XLSX que o voluntario marcou como "Ignorar" (nao enviadas). Acesso so via Edge Functions.';

create index if not exists collection_skips_volunteer_idx
  on public.collection_skips (volunteer_id);

alter table public.collection_skips enable row level security;
-- Sem policies de proposito: anon e authenticated nao tem acesso.
