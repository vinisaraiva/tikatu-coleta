# Como subir a v1.2.0

Rode na pasta `C:\TIKATU-COLETA`.

## 1. Conferir o que vai entrar

```bash
git status
```

Devem aparecer como **novos**:

```
assets/pwa/                                  (5 ícones PWA reais)
scripts/prepare-web.js
src/components/CollectionScheduleCard.tsx
src/components/InstallGate.tsx
src/components/NotificationCard.tsx
src/screens/InstallScreen.tsx
src/services/dialog.ts
src/services/pushNotifications.ts
src/services/pwaInstall.ts
src/services/schedule.ts
documentacao/
ADMIN-BOTAO-ATUALIZAR-PLATAFORMA.md
```

E como **apagados**:

```
scripts/generate-manifest.js      (gerava manifest errado e nunca rodava no deploy)
src/components/InstallPrompt.tsx  (substituído pela tela de instalação)
```

> Vários arquivos que você não tocou aparecem como modificados. É ruído de
> fim de linha (CRLF/LF), não mudança de conteúdo.

## 2. Commitar

```bash
git add -A
git commit -F COMMIT.txt
git push origin main
```

O Render reconstrói sozinho ao receber o push.

## 3. Conferir o build no Render

Nos logs, o `prepare-web.js` deve imprimir:

```
[prepare-web] 5 ícones copiados
[prepare-web] manifest.json escrito
[prepare-web] sw.js escrito
[prepare-web] index.html: manifest, meta tags iOS e registro do SW injetados
[prepare-web] .nojekyll criado
[prepare-web] 404.html criado (fallback de rota)
[prepare-web] mobile v1.2.0 — dist/ pronto e instalável.
```

Se ele falhar, o build inteiro falha — é de propósito. Melhor não publicar do
que publicar um PWA que não instala.

## 4. Conferir no ar

Estes dois endereços respondem **404 hoje**. Depois do deploy têm que abrir:

- https://coleta.tikatu.com.br/manifest.json
- https://coleta.tikatu.com.br/sw.js

No Chrome do computador, `F12` → aba **Application**:

- **Manifest**: sem erros, os dois ícones renderizados;
- **Service Workers**: `sw.js` com *activated and is running*;
- ícone de instalar visível na barra de endereço.

## 5. Só então, a versão mínima

```sql
update public.app_config set min_version = '1.2.0', updated_at = now() where id = 1;
```

Nessa ordem. Ao contrário, todos os voluntários entram em recarregamento
buscando uma versão que ainda não existe — que é exatamente o estado de hoje,
com `min_version` em `1.0.13` e a versão publicada em `1.0.4`.

Ver `documentacao/CORRIGIR-BOTAO-ATUALIZACAO-PLATAFORMA.md` para a correção do
botão na plataforma web.

## 6. Testar de ponta a ponta

1. Abrir `coleta.tikatu.com.br` no celular → deve aparecer a tela de instalação.
2. Instalar.
3. Entrar com o código da Lahys → o dashboard mostra "Seg, Qua e Sex", 08:00,
   janela das 07:00 às 09:00.
4. Tocar em **Ativar avisos** e aceitar a permissão.
5. Conferir que o aparelho foi registrado:

```sql
select volunteer_id, left(endpoint, 60) as endpoint, created_at
from volunteer_push_subscriptions;
```

6. Testar o envio sem esperar sexta-feira:

```sql
select net.http_post(
  url := 'https://okduzgpkahddkdpzibua.supabase.co/functions/v1/volunteer-collection-reminders',
  headers := '{"Content-Type": "application/json"}'::jsonb,
  body := '{"schedule_id":"cf9084bf-8136-4363-aae9-f628d70666ae","kind":"missed"}'::jsonb
);
```

> Esse disparo manual exige token de admin no header `Authorization`. Sem ele a
> função responde 401 — é a proteção do envio manual. O disparo automático do
> cron não precisa de nada disso.

7. O botão **Sair** no Dashboard tem que abrir a confirmação e realmente sair.
