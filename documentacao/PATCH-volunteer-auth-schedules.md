# Patch — `volunteer-auth` passa a devolver a agenda de coleta

O app já lê `volunteer.schedules` e mostra o lembrete no Dashboard. Falta a Edge
Function `volunteer-auth` incluir esse campo na resposta de `login` e `validate`.

## Por que na Edge Function, e não direto do app

O app não tem service key e os voluntários **não** usam Supabase Auth (a sessão é a
tabela `volunteer_sessions`). Consultar `volunteer_schedules` direto do cliente exigiria
abrir RLS para `anon`, o que expõe a agenda de todos os voluntários. Devolver junto do
login mantém a superfície fechada e não custa round-trip extra.

## Alteração

Em `supabase/functions/volunteer-auth/index.ts`, dentro de `getVolunteerData`:

```ts
async function getVolunteerData(volunteerId: number) {
  const { data: volunteer, error } = await admin
    .from('volunteers')
    .select('id, code, nome, is_active')
    .eq('id', volunteerId)
    .maybeSingle();
  if (error || !volunteer || !volunteer.is_active) return null;

  const { data: vps } = await admin
    .from('volunteer_points')
    .select('point_id, is_primary, point:points(id, name, river:rivers(id, name, city:cities(id, name)))')
    .eq('volunteer_id', volunteerId);

  const points = (vps || []).map((vp: any) => ({
    ...vp.point,
    is_primary: vp.is_primary,
  }));

  // >>> NOVO: agenda de coleta cadastrada pelo admin na plataforma web
  const { data: schedules } = await admin
    .from('volunteer_schedules')
    .select('id, point_id, weekdays, scheduled_time, tolerance_minutes, is_active')
    .eq('volunteer_id', volunteerId)
    .eq('is_active', true);

  return {
    id: volunteer.id,
    code: volunteer.code,
    nome: volunteer.nome,
    points,
    schedules: schedules || [],   // <<< NOVO
  };
}
```

É a única mudança. `login` e `validate` já usam `getVolunteerData`, então os dois
passam a devolver a agenda automaticamente.

## Deploy

```bash
supabase functions deploy volunteer-auth --project-ref okduzgpkahddkdpzibua
```

Não há migration: a tabela `volunteer_schedules` já existe.

## Compatibilidade

O app trata `schedules` ausente como lista vazia e mostra "Nenhuma agenda definida".
Ou seja, versões antigas do app continuam funcionando, e o app novo funciona mesmo
antes do deploy da função — só não mostra a agenda até o deploy sair.

## Convenção sincronizada com a plataforma

Retirada da Edge Function `volunteer-collection-reminders`, que é quem dispara o push:

| Item | Valor |
|---|---|
| `weekdays` | `smallint[]`, **0 = domingo … 6 = sábado** |
| `scheduled_time` | `time` no fuso **America/Sao_Paulo** |
| `tolerance_minutes` | padrão 60 |
| Janela de coleta | de `horário − tolerância` a `horário + tolerância` (padrão: 07:00–09:00 para 08:00) |
| Aviso prévio (`due`) | `horário − 15 min` |
| Aviso de ausência (`missed`) | `horário + tolerância`, se nada foi registrado |
| Unicidade | `UNIQUE (volunteer_id, point_id)` — uma agenda por ponto |

O app usa **exatamente** essas regras em `src/services/schedule.ts`, para que o card do
Dashboard e os pushes falem do mesmo horário. Ver `PATCH-reminders-duas-notificacoes.md`.
