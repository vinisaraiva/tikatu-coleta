#!/usr/bin/env node
/* =====================================================================
 * prepare-web.js — pós-processamento do build web (PWA)
 * ---------------------------------------------------------------------
 * ONDE O SITE FICA NO AR
 *   Render, static site `tikatu-coleta`, publicando a pasta `dist/`, com
 *   domínio próprio:
 *
 *       https://coleta.tikatu.com.br
 *
 *   (Existe também uma cópia antiga em GitHub Pages servindo `docs/`, de um
 *   build de 2025. Não é o que os voluntários usam.)
 *
 *   Mesmo estando na raiz do domínio, TODOS os caminhos gerados aqui são
 *   RELATIVOS e o service worker calcula a própria base em tempo de execução.
 *   Custa o mesmo e o build continua correto se o app um dia for servido a
 *   partir de um sub-caminho.
 *
 * POR QUE O APP NÃO OFERECIA A INSTALAÇÃO
 *   1. Não havia service worker — sem ele o Chrome nunca dispara
 *      `beforeinstallprompt`, que é quem abre a janela nativa de instalação.
 *   2. Os ícones eram falsos: o manifest declarava 192x192 e 512x512 apontando
 *      para um PNG de 450x450. O Chrome lê o arquivo e confere.
 *   3. O manifest do build nem era regenerado — o script antigo não rodava.
 *
 * O QUE ESTE SCRIPT FAZ (depois do `expo export --platform web`)
 *   1. copia os ícones PWA reais para dist/pwa/
 *   2. escreve dist/manifest.json com caminhos relativos
 *   3. escreve dist/sw.js (cache + notificações push)
 *   4. injeta no dist/index.html o manifest, meta tags do iOS e o registro do SW
 *   5. cria dist/.nojekyll e dist/404.html — inofensivos no Render, e deixam o
 *      build pronto caso a publicação volte para o GitHub Pages
 * ===================================================================== */

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
// O Render publica a pasta `dist/` (staticPublishPath do render.yaml), que é
// também a saída padrão do `expo export`. PWA_OUT_DIR permite apontar para
// outra pasta sem mexer no código.
const saida = path.join(raiz, process.env.PWA_OUT_DIR || 'dist');
const { version, name: pkgName } = require(path.join(raiz, 'package.json'));

const APP_NAME = 'Tikatu Coleta';
const SHORT_NAME = 'Tikatu';
const DESCRICAO = 'Sistema de Coleta de Dados de Qualidade da Água';
const THEME = '#0066CC';
const BACKGROUND = '#f8fafc';

function falhar(msg) {
  console.error(`\n[prepare-web] ERRO: ${msg}\n`);
  process.exit(1);
}

if (!fs.existsSync(saida)) {
  falhar(`${path.basename(saida)}/ não existe. Rode o export do Expo antes.`);
}

// ---------------------------------------------------------------------
// 1. Ícones
// ---------------------------------------------------------------------
const origemIcones = path.join(raiz, 'assets', 'pwa');
const destinoIcones = path.join(saida, 'pwa');

if (!fs.existsSync(origemIcones)) {
  falhar('assets/pwa/ não existe. Os ícones do PWA precisam estar versionados no repositório.');
}

fs.mkdirSync(destinoIcones, { recursive: true });

const icones = [
  'icon-192.png',
  'icon-512.png',
  'maskable-192.png',
  'maskable-512.png',
  'apple-touch-icon-180.png',
];

for (const arquivo of icones) {
  const de = path.join(origemIcones, arquivo);
  if (!fs.existsSync(de)) falhar(`ícone ausente: assets/pwa/${arquivo}`);
  fs.copyFileSync(de, path.join(destinoIcones, arquivo));
}
console.log(`[prepare-web] ${icones.length} ícones copiados`);

// ---------------------------------------------------------------------
// 2. manifest.json — tudo relativo ao próprio manifest
// ---------------------------------------------------------------------
// Caminhos relativos dentro do manifest resolvem contra a URL DELE, então
// './pwa/icon-192.png' funciona tanto em coleta.tikatu.com.br/manifest.json
// quanto em qualquer sub-caminho.
const manifest = {
  name: APP_NAME,
  short_name: SHORT_NAME,
  description: DESCRICAO,
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  theme_color: THEME,
  background_color: BACKGROUND,
  lang: 'pt-BR',
  dir: 'ltr',
  categories: ['utilities', 'productivity'],
  icons: [
    { src: './pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './pwa/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: './pwa/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

fs.writeFileSync(path.join(saida, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('[prepare-web] manifest.json escrito');

// ---------------------------------------------------------------------
// 3. service worker
// ---------------------------------------------------------------------
// A BASE é calculada a partir da própria URL do sw.js, então o mesmo arquivo
// serve para o site na raiz do domínio e em sub-caminho.
//
// Estratégia de cache, escolhida para não brigar com a atualização forçada
// por `min_version` (src/services/appUpdate.ts):
//   - navegação (HTML) -> NETWORK-FIRST: publicação nova aparece na hora; o
//     cache só entra quando o voluntário está sem sinal, que é o caso de campo.
//   - assets (nome com hash) -> CACHE-FIRST.
//   - outras origens (Supabase) -> não intercepta.
const sw = `/* Service worker do ${APP_NAME} — gerado por scripts/prepare-web.js
 * Versão: ${version}
 * NÃO EDITE À MÃO: este arquivo é reescrito a cada build.
 */
const VERSAO = '${version}';
const CACHE = 'tikatu-v' + VERSAO;

// Base = pasta onde este sw.js está. Em coleta.tikatu.com.br/sw.js -> '/'
const BASE = new URL('./', self.location).pathname;
const FALLBACK = BASE + 'index.html';

const PRECACHE = [BASE, FALLBACK, BASE + 'manifest.json', BASE + 'pwa/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET e só a nossa própria origem. Chamadas ao Supabase passam intocadas.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(BASE)) return;

  // Navegação: rede primeiro, cache como rede de segurança (offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(FALLBACK, copia)).catch(() => undefined);
          return resp;
        })
        .catch(() => caches.match(FALLBACK).then((r) => r || Response.error())),
    );
    return;
  }

  // Assets estáticos: cache primeiro. Os nomes têm hash, não ficam velhos.
  if (!/\\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico|json)$/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(req).then((emCache) => {
      if (emCache) return emCache;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => undefined);
          }
          return resp;
        })
        .catch(() => caches.match(FALLBACK));
    }),
  );
});

// ---------------------------------------------------------------------
// Notificações push
// ---------------------------------------------------------------------
// Quem envia é a Edge Function volunteer-collection-reminders, com o corpo
// { title, body, tag, url }. Sem este handler o push chega ao aparelho e é
// descartado em silêncio — ou aparece como "site atualizado em segundo plano".
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch (e) {
    dados = { title: '${APP_NAME}', body: event.data ? event.data.text() : '' };
  }

  const opcoes = {
    body: dados.body || '',
    icon: BASE + 'pwa/icon-192.png',
    badge: BASE + 'pwa/icon-192.png',
    // A tag faz o aviso novo SUBSTITUIR o anterior do mesmo tipo, em vez de
    // empilhar vários avisos da mesma coleta.
    tag: dados.tag || 'tikatu',
    renotify: true,
    requireInteraction: false,
    data: { url: dados.url && dados.url !== '/' ? dados.url : BASE },
  };

  event.waitUntil(self.registration.showNotification(dados.title || '${APP_NAME}', opcoes));
});

// Tocar na notificação foca uma aba já aberta, em vez de abrir uma nova a cada aviso.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || BASE;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if (aba.url.indexOf(BASE) !== -1 && 'focus' in aba) return aba.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
`;

fs.writeFileSync(path.join(saida, 'sw.js'), sw);
console.log('[prepare-web] sw.js escrito');

// ---------------------------------------------------------------------
// 4. index.html
// ---------------------------------------------------------------------
const indexPath = path.join(saida, 'index.html');
if (!fs.existsSync(indexPath)) falhar('index.html não existe. O export do Expo falhou?');

let html = fs.readFileSync(indexPath, 'utf8');

const MARCA_INICIO = '<!-- tikatu-pwa:inicio -->';
const MARCA_FIM = '<!-- tikatu-pwa:fim -->';

// Idempotente: se já foi injetado antes, remove o bloco anterior.
html = html.replace(new RegExp(`${MARCA_INICIO}[\\s\\S]*?${MARCA_FIM}`, 'g'), '');

// O Expo já emite algumas destas tags a partir do bloco `web` do app.config.js,
// inclusive um apple-touch-icon apontando para o PNG de 450x450 que quebrava o
// critério de ícone. Removemos as dele (o navegador usa a PRIMEIRA que acha).
const duplicadas = [
  /\s*<link[^>]*rel=["']manifest["'][^>]*>/gi,
  /\s*<link[^>]*rel=["']apple-touch-icon["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']theme-color["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']description["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']mobile-web-app-capable["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']apple-mobile-web-app-capable["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']apple-mobile-web-app-status-bar-style["'][^>]*>/gi,
  /\s*<meta[^>]*name=["']apple-mobile-web-app-title["'][^>]*>/gi,
];
for (const re of duplicadas) html = html.replace(re, '');

const bloco = `${MARCA_INICIO}
    <link rel="manifest" href="./manifest.json" />
    <meta name="theme-color" content="${THEME}" />
    <meta name="application-name" content="${APP_NAME}" />
    <meta name="description" content="${DESCRICAO}" />

    <!-- iOS: o Safari ignora o manifest, precisa destas meta tags -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="${SHORT_NAME}" />
    <link rel="apple-touch-icon" href="./pwa/apple-touch-icon-180.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="./pwa/icon-192.png" />

    <script>
      // Base = pasta onde o index.html está ('/' em coleta.tikatu.com.br).
      // O escopo do service worker NÃO pode ser mais amplo que essa pasta.
      (function () {
        var BASE = location.pathname.replace(/[^/]*$/, '');

        // Sem service worker o Chrome nunca oferece a instalação do app.
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function () {
            navigator.serviceWorker.register(BASE + 'sw.js', { scope: BASE }).catch(function (e) {
              console.warn('[tikatu] service worker não registrado:', e);
            });
          });
        }

        // Guardado aqui porque o evento costuma disparar ANTES do React montar;
        // se esperássemos o componente, ele já teria passado.
        window.__tikatuInstallPrompt = null;
        window.addEventListener('beforeinstallprompt', function (e) {
          e.preventDefault();
          window.__tikatuInstallPrompt = e;
          window.dispatchEvent(new Event('tikatu:installable'));
        });
        window.addEventListener('appinstalled', function () {
          window.__tikatuInstallPrompt = null;
          window.dispatchEvent(new Event('tikatu:installed'));
        });
      })();
    </script>
    ${MARCA_FIM}`;

if (!html.includes('</head>')) falhar('index.html sem </head> — formato inesperado.');
html = html.replace('</head>', `    ${bloco}\n  </head>`);
fs.writeFileSync(indexPath, html);
console.log('[prepare-web] index.html: manifest, meta tags iOS e registro do SW injetados');

// ---------------------------------------------------------------------
// 5. .nojekyll
// ---------------------------------------------------------------------
// Inofensivo no Render. Existe porque o GitHub Pages passa o site pelo Jekyll,
// que IGNORA toda pasta começando com underscore — e o Expo exporta o bundle em
// `_expo/`. Sem este arquivo, numa publicação por GitHub Pages o JS retornaria
// 404 e a tela ficaria em branco.
fs.writeFileSync(path.join(saida, '.nojekyll'), '');
console.log('[prepare-web] .nojekyll criado');

// ---------------------------------------------------------------------
// 6. 404.html
// ---------------------------------------------------------------------
// O Render já reescreve /* para /index.html (render.yaml). Este arquivo é a
// mesma rede de segurança para hospedagens sem reescrita de rota.
fs.copyFileSync(indexPath, path.join(saida, '404.html'));
console.log('[prepare-web] 404.html criado (fallback de rota)');

// ---------------------------------------------------------------------
// Conferência final
// ---------------------------------------------------------------------
const obrigatorios = [
  'index.html',
  '404.html',
  '.nojekyll',
  'manifest.json',
  'sw.js',
  'pwa/icon-192.png',
  'pwa/icon-512.png',
];
const faltando = obrigatorios.filter((f) => !fs.existsSync(path.join(saida, f)));
if (faltando.length) falhar(`arquivos ausentes: ${faltando.join(', ')}`);

console.log(`\n[prepare-web] ${pkgName} v${version} — ${path.basename(saida)}/ pronto e instalável.\n`);
