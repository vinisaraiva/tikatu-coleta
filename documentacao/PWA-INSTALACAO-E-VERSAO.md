# PWA: instalação e versionamento

## Por que o app nunca oferecia a instalação

Não era um problema de interface. O `InstallPrompt` antigo até aparecia, mas o
botão "Instalar" não tinha como funcionar: o navegador nunca chegava a
considerar o site instalável. Três causas somadas.

**1. Não havia service worker.** Nenhum arquivo `sw.js`, nenhum registro no
`index.html`. O Chrome só dispara `beforeinstallprompt` — o evento que abre a
janela nativa de instalação — para sites com um service worker registrado que
tenha handler de `fetch`. Sem ele o evento simplesmente não existe, então o
botão caía sempre no modal de instruções.

**2. Os ícones tinham o tamanho errado.** O manifest declarava
`imagem-home.png` como `192x192` e `512x512`, mas o arquivo real tem
**450x450**. O Chrome lê o PNG e confere: como não havia nenhum ícone de 512 px
de verdade, o critério de instalabilidade falhava mesmo com o manifest presente.

**3. O build não rodava o script de manifest.** O `render.yaml` executava só
`npx expo export`; o `npm run build:web`, que chamava
`scripts/generate-manifest.js`, nunca era usado no deploy. Esse script também
apontava para `/assets/icon.png` e `/assets/logo_app.png` — e `logo_app.png` é
500x200, não é sequer quadrado.

## O que passou a existir

`scripts/prepare-web.js` roda depois do export e deixa o `dist/` instalável:

- copia `assets/pwa/*.png` (ícones 192 e 512 **reais**, mais maskable e apple-touch) para `dist/pwa/`;
- escreve `dist/manifest.json` com `id`, `scope`, `start_url` e os ícones certos;
- escreve `dist/sw.js`;
- injeta no `dist/index.html` o link do manifest, as meta tags do iOS, o registro
  do service worker e a captura do `beforeinstallprompt`;
- remove as tags equivalentes que o próprio Expo emite, para não ficar duplicado;
- é idempotente: rodar duas vezes não acumula nada.

O `render.yaml` passou a rodar `npx expo export --platform web && node
scripts/prepare-web.js`, e `sw.js` e `manifest.json` ganharam header de
`no-cache` — o service worker é justamente quem entrega a versão nova, então ele
nunca pode vir do cache.

### Estratégia do service worker

Escolhida para não brigar com a atualização forçada por `min_version`:

| Tipo de requisição | Estratégia | Motivo |
|---|---|---|
| Navegação (HTML) | **network-first**, cache como reserva | uma publicação nova aparece na hora; o cache só entra quando o voluntário está sem sinal no campo |
| `/_expo/`, `/assets/`, `/pwa/` | **cache-first** | os nomes têm hash, nunca ficam velhos |
| Outras origens (Supabase, push) | **não intercepta** | dados e autenticação nunca passam pelo cache |

O nome do cache carrega a versão. Ao publicar, o service worker novo assume
imediatamente (`skipWaiting` + `clients.claim`) e apaga os caches anteriores.

## A tela de instalação

`src/screens/InstallScreen.tsx`, controlada por `src/components/InstallGate.tsx`
e pela lógica em `src/services/pwaInstall.ts`.

Aparece no arranque para quem está na web, ainda não instalou e não dispensou
nos últimos **7 dias**. Some sozinha quando a instalação acontece. Também fica
acessível de forma permanente em **Perfil → Instalar o aplicativo**.

Ela sempre mostra o passo a passo, porque o botão nativo não existe em todo
lugar:

| Onde | Botão nativo | Caminho |
|---|---|---|
| Chrome/Edge/Samsung no Android | sim | menu ⋮ → "Instalar app" |
| Safari no iPhone/iPad | **não** | Compartilhar → "Adicionar à Tela de Início" |
| Chrome/Firefox no iPhone | **não** | precisa abrir no Safari primeiro |
| Firefox no Android | não | menu ⋮ → "Instalar" |
| Chrome/Edge no computador | sim | ícone na barra de endereço |

O caso do iPhone é o que mais confunde: a Apple não expõe API de instalação, e
nenhum navegador que não seja o Safari consegue adicionar à tela de início. A
tela detecta isso e diz o que fazer, em vez de mostrar um botão que não faria nada.

## Versionamento — fonte única

Antes a versão estava escrita em três lugares e eles divergiam:
`package.json` dizia `1.0.0`, `app.config.js` dizia `1.0.4` e
`src/services/appUpdate.ts` tinha `APP_VERSION = '1.0.4'` no código.

Agora existe **uma** fonte:

```
package.json ("version")
   └─> app.config.js          const { version } = require('./package.json')
         └─> appUpdate.ts     Constants.expoConfig?.version
               └─> Perfil     "Versão x.y.z"
```

Para publicar uma versão nova, altere **apenas o `package.json`**. Nenhum outro
arquivo tem número de versão escrito à mão.

### Como publicar

1. `package.json` → nova `version` (esta entrega já subiu para **1.1.0**).
2. Commit e push — o Render reconstrói sozinho.
3. Conferir `https://<site>/manifest.json` e `https://<site>/sw.js` no ar.
4. Só então, no painel admin, definir `app_config.min_version` igual à versão
   publicada. Quem estiver abaixo recarrega uma vez e pega a versão nova, sem
   perder o login.

Fazer o passo 4 antes do 2 colocaria todos os voluntários em recarregamento
buscando uma versão que ainda não existe.

## Conferindo depois do deploy

No Chrome (computador), `F12` → aba **Application**:

- **Manifest**: sem erros, e os dois ícones aparecem renderizados;
- **Service Workers**: `sw.js` com status *activated and is running*;
- o ícone de instalar deve estar visível na barra de endereço.

Em **Lighthouse**, a categoria de PWA deve passar em "installable".

## Documentos antigos

`COMO-INSTALAR-PWA.md`, `GUIA-INSTALACAO-PWA.md` e
`BANNER-INSTALACAO-AUTOMATICO.md`, na raiz, descrevem o banner que foi
substituído. Estão desatualizados — este documento é o vigente.
