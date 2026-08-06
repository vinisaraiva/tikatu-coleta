# Correção — botão "Forçar atualização do app" (tikatu-aqua-view)

## O bug

O painel publicou `min_version = 1.0.13`, mas a versão que está no ar é **1.0.4**.

Como a comparação é numérica por segmento, `1.0.4 < 1.0.13` (4 < 13). Ou seja:
**todo voluntário se considera desatualizado** e recarrega uma vez a cada nova
sessão — para sempre, porque nunca existirá um build 1.0.13. O guarda de
`sessionStorage` no app evita o loop infinito dentro da mesma aba, mas não evita
o recarregamento repetido a cada abertura.

O `1.0.13` também revela que o botão vinha **incrementando** `min_version` a cada
clique, em vez de igualá-la à versão publicada.

## Por que isso aconteceu

O botão nasceu para mexer em `reload_token`, não em `min_version` — é o que diz
`ADMIN-BOTAO-ATUALIZAR-PLATAFORMA.md`. Só que **o app nunca leu esse campo**: até
a v1.1.0, `checarAtualizacao()` selecionava apenas `min_version`. O botão parecia
não funcionar, e a saída encontrada foi incrementar a versão mínima.

Os dois campos têm papéis diferentes:

| campo | para quê | quando mexer |
|---|---|---|
| `reload_token` | "recarreguem agora" | sempre que publicar algo e quiser todo mundo na versão nova |
| `min_version` | "versão X é o mínimo aceitável" | só ao publicar a versão X, com o valor **igual** ao publicado |

## Lado do app — já corrigido

`src/services/appUpdate.ts` (Tikatu Coleta, v1.2.0) passou a ler os dois campos.
O `reload_token` é guardado em `AsyncStorage`; quando muda, o app recarrega uma
vez. Na primeira vez que o aparelho vê o token, ele apenas memoriza — senão todo
mundo recarregaria sem motivo na estreia do mecanismo.

## Lado da plataforma — o que mudar

### 1. Botão "Forçar atualização do app (todos)"

Deve mexer **só** no `reload_token`. Nunca em `min_version`.

```tsx
async function forcarAtualizacao() {
  const ok = window.confirm(
    'Forçar a atualização do app de TODOS os voluntários? ' +
    'Eles receberão a versão mais recente na próxima vez que abrirem o app.'
  );
  if (!ok) return;

  const { data, error: e1 } = await supabase
    .from('app_config').select('reload_token').eq('id', 1).single();
  if (e1) throw e1;

  const atual = parseInt(String(data?.reload_token ?? '0'), 10) || 0;

  const { error: e2 } = await supabase
    .from('app_config')
    .update({ reload_token: String(atual + 1), updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (e2) throw e2;

  toast.success('Atualização enviada. Os apps recarregarão na próxima abertura.');
}
```

A mensagem de sucesso **não deve** falar em "nova versão mínima publicada" — não
é isso que esse botão faz.

### 2. Se houver um controle de versão mínima, que ele receba a versão

Nada de incremento automático. O valor tem que ser digitado ou escolhido, e é a
versão que foi realmente publicada:

```tsx
async function exigirVersaoMinima(versao: string) {
  // versao vem de um input, ex.: "1.2.0" — a MESMA que está no ar.
  if (!/^\d+\.\d+\.\d+$/.test(versao)) {
    toast.error('Informe a versão no formato x.y.z');
    return;
  }
  const { error } = await supabase
    .from('app_config')
    .update({ min_version: versao, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
  toast.success(`Versão mínima definida como ${versao}.`);
}
```

Vale exibir um aviso na tela quando `min_version` for **maior** que a última
versão publicada — é exatamente o estado quebrado de hoje, e ele fica invisível.

### 3. Acertar o valor atual

Depois de publicar a v1.2.0 do app:

```sql
update public.app_config set min_version = '1.2.0', updated_at = now() where id = 1;
```

Enquanto a v1.2.0 não estiver no ar, `min_version` pode ficar em `1.0.13` sem
piorar nada — quem está em 1.0.4 já vinha recarregando. Assim que a 1.2.0
subir, o problema some sozinho, porque `1.2.0 > 1.0.13`.

## Observação sobre a comparação de versões

`1.0.13` ser maior que `1.0.4` está **correto** em versionamento semântico: cada
segmento é um número, não um decimal. O erro não é da comparação, é de usar o
campo de versão como contador de cliques.
