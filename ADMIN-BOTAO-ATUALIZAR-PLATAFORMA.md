# Botão "Forçar atualização do app" — especificação para a plataforma web

Este documento tem **tudo** que a plataforma (tikatu-aqua-view) precisa para ter um
botão no admin que force o app **Tikatu Coleta** (PWA) a se atualizar nos aparelhos
dos voluntários. O app e a plataforma **compartilham o mesmo Supabase**
(`okduzgpkahddkdpzibua`), e é por ele que a comunicação acontece — não há integração
direta entre os dois.

---

## 0. Stack da plataforma e recomendação

A plataforma `tikatu-aqua-view` é um projeto **Lovable**: Vite + TypeScript + **React** +
shadcn-ui + Tailwind, já com pasta `supabase/` e cliente Supabase configurado (`.env` com
`VITE_SUPABASE_*`). Para essa stack:

> **Recomendação: use a abordagem DIRETA (Opção B)** — o botão escreve direto na tabela
> `app_config` pelo cliente Supabase que a plataforma já tem, protegido por uma política
> RLS restrita a **admin**. Evita o segredo no bundle do frontend (problema da Opção A) e
> é o caminho mais limpo aqui.
>
> A Edge Function (Opção A) só vale a pena se os admins **não** se autenticam por Supabase
> Auth (ex.: login admin próprio/senha fixa). Nesse caso, veja a Opção A mais abaixo.

Como é um projeto Lovable, dá para colar este documento (ou a Opção B) como prompt no
Lovable, pedindo para adicionar o botão na área de admin.

### Onde colocar o botão (decisão do produto)

- **Local:** dentro do painel **admin**, na aba **Voluntários** (é onde o gestor pensa em
  "os apps dos voluntários"). Pode ser um card/seção no topo ou no rodapé da aba.
- **Acesso:** apenas administradores/gestores já autenticados no admin — os mesmos que
  hoje acessam essa área. O botão **não** deve aparecer para outros perfis.
- **Comportamento:** ao clicar, dispara a atualização de todos os apps (incrementa o
  `reload_token`). Ideal ter uma confirmação ("Deseja forçar a atualização do app de
  todos os voluntários?") e uma mensagem de sucesso.
- **Segurança:** como a política RLS (seção 3.1) já restringe a escrita a admin, mesmo
  que o botão vaze para outra tela, a escrita continua bloqueada para não-admins.

## 1. Como já está montado (não precisa mexer)

Já existe no Supabase a tabela `public.app_config` (uma única linha, `id = 1`):

| coluna | tipo | significado |
|---|---|---|
| `min_version` | text | versão mínima exigida (ex.: `"1.0.1"`). Apps abaixo disso são forçados a atualizar. |
| `reload_token` | text | "gatilho manual". Ao mudar seu valor, **todos** os apps recarregam na próxima abertura. |
| `updated_at` | timestamptz | atualizado a cada mudança. |

**Contrato com o app (já implementado no Tikatu Coleta):** no arranque, o app lê essa
linha. Se a versão dele for menor que `min_version` **ou** se o `reload_token` mudou
desde a última vez, o app limpa **apenas o cache de arquivos + service worker** e
recarrega (o login/sessão é preservado). A mudança faz efeito na **próxima vez** que
cada aparelho abre o app.

- Para **forçar todo mundo a recarregar agora** (ex.: acabei de publicar): mude o `reload_token`.
- Para **exigir uma versão mínima**: coloque `min_version` igual à versão publicada.

RLS: a tabela tem **leitura pública** (anon) e **escrita bloqueada** para anônimos.
Por isso o botão precisa escrever de forma autenticada — ver opções abaixo.

---

## 2. OPÇÃO A (recomendada) — botão chama uma Edge Function protegida por segredo

Funciona independentemente do modelo de login da plataforma. A escrita na tabela é
feita pela Edge Function com `service_role` (que ignora RLS), e o botão só a aciona
enviando um segredo.

### 2.1 Edge Function (Supabase) — `app-force-update`

Arquivo `supabase/functions/app-force-update/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-secret, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405, headers: cors });

  // Autenticação por segredo compartilhado (defina APP_UPDATE_SECRET nas secrets da função)
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== Deno.env.get("APP_UPDATE_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "content-type": "application/json" },
    });
  }

  let body: { min_version?: string; force_reload?: boolean } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  // SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente na função
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.min_version) update.min_version = String(body.min_version);
  if (body.force_reload) {
    const { data } = await supabase.from("app_config").select("reload_token").eq("id", 1).single();
    const atual = parseInt(String(data?.reload_token ?? "0"), 10) || 0;
    update.reload_token = String(atual + 1); // incrementa -> força recarga geral
  }

  const { error } = await supabase.from("app_config").update(update).eq("id", 1);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, ...update }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
```

**Deploy + segredo (uma vez):**
1. `supabase functions deploy app-force-update` (ou pelo dashboard).
2. No dashboard do Supabase → Edge Functions → Secrets, crie:
   `APP_UPDATE_SECRET = <um segredo forte à sua escolha>`.

URL final da função:
`https://okduzgpkahddkdpzibua.supabase.co/functions/v1/app-force-update`

### 2.2 Botão (React) no admin da plataforma

```tsx
import { useState } from "react";

const FUNCTION_URL =
  "https://okduzgpkahddkdpzibua.supabase.co/functions/v1/app-force-update";
// A anon key é a MESMA que a plataforma já usa no cliente Supabase.
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// Defina VITE_APP_UPDATE_SECRET no .env da plataforma, igual ao segredo da função.
const ADMIN_SECRET = import.meta.env.VITE_APP_UPDATE_SECRET as string;

export function BotaoForcarAtualizacao() {
  const [status, setStatus] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function forcar(payload: { force_reload?: boolean; min_version?: string }) {
    setEnviando(true);
    setStatus("Enviando...");
    try {
      const r = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          "x-admin-secret": ADMIN_SECRET,
        },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      setStatus(
        r.ok
          ? "Atualização disparada. Os apps recarregarão na próxima abertura."
          : `Erro: ${j.error ?? r.status}`,
      );
    } catch {
      setStatus("Falha de rede.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      <button disabled={enviando} onClick={() => forcar({ force_reload: true })}>
        Forçar atualização do app (todos os voluntários)
      </button>
      {/* Opcional: exigir uma versão mínima específica */}
      {/* <button disabled={enviando} onClick={() => forcar({ min_version: "1.0.2" })}>
        Exigir versão mínima 1.0.2
      </button> */}
      {status && <span>{status}</span>}
    </div>
  );
}
```

> Coloque o botão **dentro da área de admin** (atrás do login), pois o segredo fica no
> bundle do frontend e só deve ser exposto a administradores.

---

## 3. OPÇÃO B (mais simples) — se os admins fazem login via Supabase Auth

Se (e somente se) os administradores da plataforma se autenticam por **Supabase Auth**
(e os voluntários **não** — eles usam auth próprio por token, então não são
`authenticated` no Supabase), dá para dispensar a Edge Function e o segredo.

### 3.1 Política RLS (rodar uma vez no SQL editor)

Restrinja a escrita a **admin de verdade** — não a qualquer usuário logado. Adapte a
condição ao modelo de admin que a plataforma já usa (tabela `profiles`/`users` com um
campo de papel, uma coluna `is_admin`, etc.). Exemplo com uma tabela `profiles(role)`:

```sql
create policy app_config_update_admin on public.app_config
  for update
  to authenticated
  using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );
```

> Se a plataforma **não** tiver uma tabela de papéis, troque a condição por uma lista de
> IDs de admin conhecidos, por exemplo:
> `using ( auth.uid() = 'UUID-DO-ADMIN'::uuid )`.
> **Evite** `using (true)` — isso deixaria qualquer usuário autenticado forçar recargas.

### 3.2 Botão (React) — escrita direta com o cliente Supabase já existente

Componente pronto para colocar na aba **Voluntários** do admin. Usa shadcn-ui (Button,
Card) e o cliente Supabase que a plataforma já tem. Ajuste os imports ao projeto.

```tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // ajuste ao caminho do projeto
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner"; // ou o sistema de toast usado no projeto

export function ForcarAtualizacaoApp() {
  const [enviando, setEnviando] = useState(false);

  async function forcar() {
    const ok = window.confirm(
      "Deseja forçar a atualização do app de TODOS os voluntários? " +
      "Eles receberão a versão mais recente na próxima vez que abrirem o app."
    );
    if (!ok) return;

    setEnviando(true);
    try {
      // Incrementa o reload_token -> todos os apps recarregam na próxima abertura
      const { data, error: e1 } = await supabase
        .from("app_config").select("reload_token").eq("id", 1).single();
      if (e1) throw e1;
      const atual = parseInt(String(data?.reload_token ?? "0"), 10) || 0;

      const { error: e2 } = await supabase
        .from("app_config")
        .update({ reload_token: String(atual + 1), updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (e2) throw e2;

      toast.success("Atualização enviada. Os apps recarregarão na próxima abertura.");
    } catch (err: any) {
      toast.error("Não foi possível enviar: " + (err?.message ?? "erro desconhecido"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atualização do aplicativo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Força os aparelhos dos voluntários a carregarem a versão mais recente do app,
          sem que eles precisem refazer login.
        </p>
        <Button onClick={forcar} disabled={enviando} className="w-fit">
          {enviando ? "Enviando..." : "Forçar atualização do app (todos)"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

> Só será renderizado/efetivo para admins: a página já está protegida pelo login de
> admin, e a política RLS (3.1) garante que só admin consegue escrever.

> Cuidado: a política acima permite que **qualquer** usuário autenticado no Supabase
> atualize a linha. Use apenas se a plataforma restringe o login do Supabase a admins.
> Se houver dúvida, prefira a **Opção A** (Edge Function + segredo).

---

## 4. Resumo do comportamento

- Mudar `reload_token` → todos os apps (que já rodam a versão com o mecanismo)
  recarregam **uma vez** na próxima abertura, pegando os arquivos novos, **sem perder o login**.
- Definir `min_version` = versão publicada → força quem estiver abaixo.
- Efeito é por aparelho, na **próxima abertura** do app.
- A primeira adoção depende de cada aparelho receber a versão nova **uma vez**
  (o mecanismo passa a valer a partir daí).
