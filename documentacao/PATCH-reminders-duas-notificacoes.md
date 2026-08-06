# Patch — duas notificações de coleta (aviso prévio + aviso de ausência)

## O que muda

A função `volunteer-collection-reminders` que está no ar hoje manda **um** push,
com título `Hora da coleta 💧`, em qualquer momento entre `horário − 15 min` e
`horário + tolerância` (75 minutos de janela). Como o log impede repetição, na
prática ela dispara na primeira execução dentro dessa faixa — e nada é enviado
para quem simplesmente não coletou.

A versão nova manda **dois** avisos, cada um em um instante definido:

| # | `kind` | Quando dispara | Condição | Mensagem |
|---|---|---|---|---|
| 1 | `due` | `horário − 15 min` | coleta ainda não registrada | "Sua coleta é daqui a pouco 💧 — Coleta prevista em *Ponto* às 08:00. Você pode registrar até 09:00." |
| 2 | `missed` | `horário + tolerância` | nenhuma coleta registrada no dia | "Coleta de hoje não registrada — Não recebemos sua coleta em *Ponto* (prevista para 08:00). Se ainda puder registrar, é só abrir o app." |

Exemplo com Seg/Qua/Sex às 08:00 e tolerância 60: aviso 1 às **07:45**, aviso 2 às
**09:00**. Quem registrar a coleta em qualquer momento antes de 09:00 não recebe o
aviso 2. Nada é bloqueado — o registro continua possível depois das 09:00.

## Arquivo

`docs/edge-functions/volunteer-collection-reminders.index.ts` é o `index.ts`
completo, pronto para substituir
`supabase/functions/volunteer-collection-reminders/index.ts` no repositório
`tikatu-aqua-view`.

Diferenças em relação ao atual:

- a janela única foi trocada por **dois instantes de disparo** com folga `FOLGA = 10 min`;
- `collected` agora bloqueia os **dois** tipos (antes só existia um);
- a consulta ao `volunteer_reminder_log` deixou de filtrar `kind = 'due'` e passou
  a indexar por `schedule_id:kind`, para os dois tipos conviverem no mesmo dia;
- o envio manual do admin aceita `{ schedule_id, kind }` — se `kind` for omitido, vale `'due'`.

**Nenhuma migration é necessária.** A coluna `volunteer_reminder_log.kind` e a
`UNIQUE (schedule_id, reminder_date, kind)` já existem; hoje só o valor `'due'`
é usado, e `'missed'` entra sem alteração de schema.

## Agendamento — isto ainda não existe

Verifiquei o banco: o projeto **não tem `pg_cron` nem `pg_net` instalados**
(extensões presentes: `pg_stat_statements`, `pgcrypto`, `plpgsql`,
`supabase_vault`, `uuid-ossp`). Ou seja, **nada dentro do Supabase chama essa
função periodicamente** — ela só roda no disparo manual do admin.

Sem resolver isso, os dois avisos continuam não saindo sozinhos. Duas opções:

**A) pg_cron + pg_net no próprio Supabase** (recomendado — fica tudo num lugar só)

```sql
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

select cron.schedule(
  'coleta-lembretes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := 'https://okduzgpkahddkdpzibua.supabase.co/functions/v1/volunteer-collection-reminders',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
               ),
    body    := '{}'::jsonb
  );
  $$
);
```

A service role key não deve ficar escrita no SQL — guarde-a no Vault
(`vault.create_secret`) e leia de lá, ou use `verify_jwt = false`, que já é o caso
desta função (então o header `Authorization` é dispensável).

**B) Agendador externo** (GitHub Actions com `schedule`, cron-job.org, etc.)
chamando a mesma URL a cada 5 minutos.

O intervalo de 5 min precisa ser **menor que `FOLGA` (10 min)**, senão um disparo
pode cair entre duas execuções e o aviso não sai. Se optar por 15 min de cron,
suba `FOLGA` para 20.

## Teste antes de ligar o cron

```bash
# aviso prévio
curl -X POST 'https://okduzgpkahddkdpzibua.supabase.co/functions/v1/volunteer-collection-reminders' \
  -H 'Authorization: Bearer <TOKEN_ADMIN>' -H 'Content-Type: application/json' \
  -d '{"schedule_id":"<UUID>","kind":"due"}'

# aviso de ausência
curl -X POST '.../volunteer-collection-reminders' \
  -H 'Authorization: Bearer <TOKEN_ADMIN>' -H 'Content-Type: application/json' \
  -d '{"schedule_id":"<UUID>","kind":"missed"}'
```

Lembrando que `volunteer_schedules` está com **0 linhas** hoje: é preciso cadastrar
ao menos uma agenda na plataforma web para testar.

## Deploy

```bash
supabase functions deploy volunteer-collection-reminders --project-ref okduzgpkahddkdpzibua
```
