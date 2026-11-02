# AGENTS.md — Tikatu Coleta

Instruções para agentes de código (Hermes/Carcará, Claude Code, Codex e similares) que trabalham neste
repositório sem supervisão em tempo real. Leia este arquivo inteiro antes de começar qualquer tarefa.

## O projeto

App de coleta de dados de qualidade da água usado por voluntários (login por código, coleta manual,
importação XLSX, fatores ambientais, histórico, avisos de coleta e justificativa de faltas).

| Pasta / arquivo | O que é |
|---|---|
| `App.tsx`, `index.ts`, `src/` | App Expo 53 / React Native 0.79 / React 19, publicado como PWA (react-native-web) |
| `src/services/api.ts` | Chamadas às Edge Functions do Supabase (`callFunction`) |
| `src/services/supabase.ts` | Cliente Supabase com a chave **pública** (anon) |
| `src/contexts/AuthContext.tsx` | Login do voluntário (código + senha) via Edge Function `volunteer-auth` |
| `scripts/prepare-web.js` | Gera manifest, service worker, ícones e `version.json` após o `expo export` |
| `render.yaml` | Deploy de produção: Render static site `tikatu-coleta` → https://coleta.tikatu.com.br |
| `documentacao/` | Decisões, patches e cópias de Edge Functions |
| `docs/`, `dist/` | Builds antigos/gerados — **não editar à mão** |

A versão do app tem fonte única no `package.json` (não edite em `app.config.js` nem em `appUpdate.ts`).

## Como trabalhar

1. Nunca commitar direto na `main`: branch (`feat/…`, `fix/…`, `docs/…`, `chore/…`) → commits pequenos → PR.
2. Nunca reescrever histórico publicado (sem force push, rebase ou amend de commits enviados).
3. Nunca fazer merge do próprio PR. Quem faz merge é o Vinícius ou o auto-merge do Hermes
   (`automerge-tikatu.py`, sem LLM), e só quando **tudo** abaixo vale:
   - branch `hermes/*`, base `main`, sem rótulo `segurar`, sem conflito e não é rascunho;
   - comentário de revisão "Revisão: Marina … aprovada" (ou "Revisão: autorrevisão … aprovada");
   - o Fiscal deu ✅ no commit atual (gates de `.github/workflows/quality-gates.yml`);
   - o PR não toca `supabase/`, login (`src/contexts/AuthContext.tsx`, `src/services/supabase.ts`),
     deploy e PWA (`render.yaml`, `app.config.js`, `scripts/prepare-web.js`), `.github/` nem este arquivo —
     esses esperam o merge do Vinícius;
   - entre 7h e 22h (Bahia). Depois do merge ele confere se o Render publicou; se o site falhar,
     pausa o auto-merge, reverte e avisa no Telegram.
4. Uma tarefa por branch/PR; sem refatorações não pedidas junto da entrega.
5. Siga o estilo do código ao redor (português nos comentários e textos de interface).
6. Mensagens de commit: `tipo(escopo): resumo` (ex.: `fix(xlsx): …`, `feat: …`).

## Segurança (inegociável)

- O navegador é não confiável. Só a chave **anon** pode estar no app. Nunca colocar no cliente a
  service role, segredos de push (VAPID privada) ou qualquer outra chave secreta.
- Dados de voluntários (código, senha, sessões) só passam pelas Edge Functions; o cliente nunca lê
  `volunteers` nem `volunteer_sessions` diretamente.
- Mudanças de banco ou RLS: só por migration versionada e revisada; nunca SQL direto na produção.
- Nunca enfraquecer RLS para algo funcionar.
- Nunca commitar `.env`, chaves, tokens ou dados reais de voluntários.

## Antes de dizer "pronto"

```bash
npm ci
npx tsc --noEmit
npm run build:web
```

- Teste no navegador (desktop e celular) a tela alterada, incluindo o PWA instalado quando fizer sentido.
- Na descrição do PR: o que mudou, por quê, o que foi testado e o que não foi verificado.

## Quando parar e perguntar

- Qualquer mudança em login, Edge Functions, RLS ou dados de voluntários.
- Mudança de versão mínima (`app_config.min_version`) que force atualização dos voluntários.
- Pedido ambíguo ou decisão de produto não registrada.
