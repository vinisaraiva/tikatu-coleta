# Publicar uma nova versão do Tikatu Coleta

Procedimento recorrente. Vale para qualquer versão daqui em diante.

## Resumo

```
1. package.json  ->  nova versão
2. git push      ->  Render reconstrói
3. conferir      ->  manifest.json, sw.js e a versão no ar
4. painel admin  ->  "Forçar atualização do app (todos)"
```

O passo 4 é o que faz os aparelhos pegarem a versão nova. Sem ele, cada
voluntário só recebe a atualização quando o navegador dele resolver revalidar.

---

## 1. Alterar a versão

**Só no `package.json`.** É a fonte única:

```
package.json ("version")
   └─> app.config.js          const { version } = require('./package.json')
         └─> appUpdate.ts     Constants.expoConfig?.version
               └─> Perfil     "Versão x.y.z"
                     └─> sw.js  nome do cache (tikatu-vX.Y.Z)
```

Não existe número de versão escrito à mão em nenhum outro arquivo. Se você
editar `app.config.js` ou `appUpdate.ts` procurando a versão, está no lugar errado.

Como escolher o número (semântico — cada segmento é um inteiro, não decimal;
`1.0.13` é **maior** que `1.0.4`):

| tipo de mudança | exemplo |
|---|---|
| correção pontual | `1.2.0` → `1.2.1` |
| funcionalidade nova | `1.2.1` → `1.3.0` |
| mudança que quebra compatibilidade | `1.3.0` → `2.0.0` |

## 2. Commitar e subir

```bash
cd C:\TIKATU-COLETA
git add -A
git commit -m "feat: <o que mudou> (v1.3.0)"
git push origin main
```

O Render (static site `tikatu-coleta`, domínio `coleta.tikatu.com.br`)
reconstrói sozinho ao receber o push.

## 3. Conferir o build

Nos logs do Render, o `prepare-web.js` tem que imprimir:

```
[prepare-web] 5 ícones copiados
[prepare-web] manifest.json escrito
[prepare-web] sw.js escrito
[prepare-web] index.html: manifest, meta tags iOS e registro do SW injetados
[prepare-web] .nojekyll criado
[prepare-web] 404.html criado (fallback de rota)
[prepare-web] mobile vX.Y.Z — dist/ pronto e instalável.
```

Se o script falhar, o build inteiro falha — de propósito. Melhor não publicar do
que publicar um PWA que não instala.

Depois, no ar:

- `https://coleta.tikatu.com.br/manifest.json` → tem que abrir (não 404)
- `https://coleta.tikatu.com.br/sw.js` → primeira linha deve trazer a versão nova
- no Perfil do app, "Versão X.Y.Z"

## 4. Forçar a atualização nos aparelhos

Painel admin → **Voluntários** → **Atualização do aplicativo** →
**"Forçar atualização do app (todos)"**.

Isso incrementa o `reload_token`. Cada aparelho recarrega **uma vez** na próxima
abertura, sem perder o login.

Ou, direto no SQL:

```sql
update public.app_config
set reload_token = (coalesce(reload_token, '0')::int + 1)::text,
    updated_at = now()
where id = 1;
```

## 5. Versão mínima — só quando precisar mesmo

O campo **"Versão mínima exigida"**, no mesmo card, existe para casos em que
versões antigas não podem continuar rodando (mudança de contrato com o banco,
correção de segurança). No dia a dia **não precisa mexer**: o passo 4 já resolve.

Se for usar, a regra é uma só:

> **Informe a versão que já está publicada. Nunca um número acima.**

Um valor maior que o que está no ar coloca todos os voluntários em
recarregamento atrás de uma versão que não existe — foi exatamente o que
aconteceu quando o campo ficou em `1.0.13` com a versão publicada em `1.0.4`.

O card mostra o estado atual e avisa quando o número parece alto demais.

---

## Como o app decide recarregar

`src/services/appUpdate.ts`, no arranque, lê `app_config` e recarrega se:

- o `reload_token` mudou desde a última vez que **este aparelho** viu (guardado
  em `AsyncStorage`), **ou**
- a versão do app é menor que `min_version`.

Na primeira vez que um aparelho vê o token, ele apenas memoriza — senão todo
mundo recarregaria sem motivo.

O recarregamento é gentil: não limpa `localStorage` nem a sessão, então o
voluntário não precisa refazer login. Como o service worker usa network-first
na navegação, o reload já traz a versão nova.

Há um guarda de `sessionStorage` que impede mais de um reload por sessão, para
que uma configuração errada não vire loop infinito.

## Ordem que importa

Publicar **antes**, mexer no `app_config` **depois**. Ao contrário, os aparelhos
recarregam procurando uma versão que ainda não subiu.
