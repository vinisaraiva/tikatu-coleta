const fs = require('fs');
const path = require('path');

// Ler o app.config.js para pegar as configurações
// Como é um arquivo ES module, vamos ler diretamente e fazer parse
const configPath = path.join(__dirname, '..', 'app.config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

// Extrair valores do config manualmente (simples e direto)
const manifest = {
  name: 'Tikatu Coleta',
  short_name: 'Tikatu',
  description: 'Sistema de Coleta de Dados de Qualidade da Água',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  theme_color: '#0066CC',
  background_color: '#f8fafc',
  orientation: 'portrait',
  icons: [
    {
      src: '/assets/icon.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: '/assets/logo_app.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable any'
    }
  ]
};

const distPath = path.join(__dirname, '..', 'dist');
const manifestPath = path.join(distPath, 'manifest.json');

// Criar pasta dist se não existir
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

// Escrever manifest.json
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✅ manifest.json gerado com sucesso em dist/manifest.json');

