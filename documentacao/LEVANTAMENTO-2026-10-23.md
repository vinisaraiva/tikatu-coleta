# Levantamento do Tikatu Coleta — 23/10/2026

Feito por Claude (coordenação), somente leitura. Nada foi alterado no código, no banco ou no deploy.

## 1. O que é

App de coleta de dados de qualidade da água para voluntários: login com código de voluntário,
dashboard, coleta manual, importação de planilha XLSX, fatores ambientais, histórico, perfil,
avisos de coleta (push) e justificativa de faltas.

| Item | Situação |
|---|---|
| Stack | Expo 53 + React Native 0.79 + React 19, publicado como **PWA** (react-native-web) |
| Produção | Render, static site `tikatu-coleta`, https://coleta.tikatu.com.br — no ar (200), **versão 1.5.0** (build de 02/09) |
| Backend | Supabase `okduzgpkahddkdpzibua` (conta separada da do SimulaProfi) + Edge Functions |
| Login | Próprio: código + senha do voluntário via Edge Function `volunteer-auth`; token de sessão no AsyncStorage |
| Painel admin | Outro app (provavelmente `tikatu-aqua-view`), que lê `version.json` deste |
| Tamanho | ~5.900 linhas em `src/` (15 telas/componentes, 12 serviços) |

## 2. Pontos de atenção (prioridade)

### P1 — risco de perder trabalho
- **Há trabalho não publicado na sua máquina**: versão **1.6.0** com mudanças em `ProfileScreen`,
  `XLSXImportScreen` e `syncedCollections` (separar coletas *ignoradas* das *sincronizadas* e permitir
  restaurar). Não está commitado nem no GitHub. Se o computador falhar, perde-se. Antes de qualquer
  outra coisa: revisar, testar e publicar (commit + PR) essa 1.6.0.

### P1 — Edge Functions fora do repositório
- O app depende de `volunteer-auth`, `volunteer-absences`, upload e lembretes, mas só há cópias soltas
  de 2 delas em `documentacao/edge-functions/`. O código do servidor (inclusive o login) não está
  versionado: não dá para revisar, testar nem recuperar se algo for apagado no painel.
  Recomendação: trazer todas para `supabase/functions/` no repositório.

### P2 — segurança (verificado de fora, com a chave pública do app)
- ✅ `volunteers` e `volunteer_sessions`: a chave pública não lê nada (bom: códigos/senhas protegidos).
- ✅ `volunteer_points`: acesso negado à chave pública.
- ℹ️ `readings`, `parameters`, `points`, `rivers`, `cities`, `app_config`: leitura pública. Faz sentido
  para dados abertos de qualidade da água, mas `readings` expõe `volunteer_id` — confirmar se é aceitável.
- ❓ **Não foi possível verificar** se a chave pública consegue **gravar** em `readings` (testar exigiria
  escrever dados). Precisa de acesso ao banco (ver item 4).
- A chave anon está fixa no código (normal para chave pública), mas URL/chave poderiam vir de config.

### P2 — dependências
- `npm audit` (produção): 3 críticas, 17 altas — quase todas em ferramentas de build do Expo (CLI,
  tar, node-forge…), que não vão para o navegador. A que importa no app é **`xlsx` 0.18.5** (alta,
  sem correção no npm: a SheetJS publica as versões novas só no CDN dela). Ela processa planilhas
  enviadas pelo voluntário — migrar para a 0.20.x oficial.
- Expo 53 / RN 0.79: subir para a linha suportada atual em um passo planejado (não junto de outras mudanças).

### P3 — qualidade e organização
- `tsc` acusa 1 erro real: `EnvironmentalFactorsScreen.tsx:347` (`'100vh'` não é `DimensionValue`);
  os demais erros vêm de `documentacao/edge-functions/*.ts` (código Deno) entrando no typecheck —
  excluir essa pasta do `tsconfig`.
- Build antigo versionado: `docs/` (GitHub Pages antigo) e `dist/` — 33 arquivos de build no git.
  `README.md` aponta para GitHub Pages/Netlify (desatualizado; produção é o Render).
- Muitos `.md` soltos na raiz (instalação PWA, APK, render…) — consolidar em `documentacao/`.
- `package.json` com nome `mobile` e sem scripts de typecheck/lint/teste; não há testes automatizados.
- `server.err`/`server.log` na raiz (o `.gitignore` ignora `*.log`, mas não `server.err`).

## 3. Proposta de fila (quando a Carcará assumir, depois do lançamento do SimulaProfi)

1. Publicar a 1.6.0 que está local (revisão + teste no navegador + PR + deploy no Render).
2. Versionar todas as Edge Functions em `supabase/functions/` (copiadas do projeto, sem segredos).
3. Corrigir o erro de tipo e excluir `documentacao/edge-functions` do typecheck; criar scripts
   `typecheck` e `build:web` como gates; adicionar `AGENTS.md`.
4. Auditoria de RLS completa no banco (precisa do acesso — item 4), incluindo escrita em `readings`.
5. Trocar `xlsx` 0.18.5 pela 0.20.x oficial, com teste de importação de planilha real anonimizada.
6. Limpeza: remover `docs/`/`dist/` do git (o Render gera o build), atualizar README, organizar `.md`.
7. Suas melhorias e correções (lista a receber do Vinícius).
8. Atualização planejada do Expo/React Native.

## 4. O que precisa do Vinícius

- **Sua lista de melhorias/correções** que você já tem em mente.
- **Acesso ao Supabase do Tikatu** para a auditoria do banco: o conector `supabase-tikatu-coleta` deste
  ambiente está sem token (Unauthorized). Basta reconectá-lo em /mcp, ou me dizer em qual conta
  Supabase está o projeto `okduzgpkahddkdpzibua`.
- **Token do GitHub da Carcará** incluir o repositório `tikatu-coleta` (hoje ela só enxerga o profi-app),
  quando formos trocar a aplicação ativa.
- Confirmar se o painel admin é o repositório `tikatu-aqua-view` e se ele entra no escopo.
