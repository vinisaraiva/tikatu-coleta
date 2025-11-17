# 📱 Guia de Instalação do PWA - Tikatu Coleta

## 🎯 Instalação Automática em Smartphones

**✨ NOVIDADE:** O app agora mostra automaticamente um banner de instalação quando você acessa em um smartphone! O banner aparece automaticamente após 1 segundo em dispositivos móveis.

### 📱 **iPhone (Safari)**

1. **Abra o Safari** no iPhone (não use Chrome ou outros navegadores)
2. **Acesse a URL** do app:
   - Desenvolvimento: `http://localhost:8081` (quando servidor estiver rodando)
   - Produção: URL do seu servidor (ex: GitHub Pages, Netlify, etc.)
3. **Aguarde o banner aparecer** no topo da tela (aparece automaticamente após 1 segundo)
4. **Toque em "Como Instalar"** no banner, ou:
   - **Toque no botão de compartilhar** (ícone de quadrado com seta para cima) na barra inferior
   - **Role para baixo** e selecione **"Adicionar à Tela Inicial"** (ou "Add to Home Screen")
5. **Personalize o nome** (opcional) e toque em **"Adicionar"**
6. O ícone do app aparecerá na sua tela inicial! 🎉

### 🤖 **Android (Chrome)**

1. **Abra o Chrome** no Android
2. **Acesse a URL** do app
3. **Aguarde o banner aparecer** no topo da tela (aparece automaticamente após 1 segundo)
4. **Toque em "Instalar"** no banner para instalação rápida, ou:
   - **Toque no menu** (três pontos no canto superior direito)
   - Selecione **"Instalar app"** ou **"Adicionar à tela inicial"**
5. **Confirme a instalação** na janela popup
6. O ícone do app aparecerá na sua tela inicial! 🎉

### 💻 **Chrome Desktop (Windows/Mac/Linux)**

1. **Abra o Chrome** no computador
2. **Acesse a URL** do app
3. **Procure pelo ícone de instalação** na barra de endereço (ícone de "+" ou de computador com seta)
   - Ou vá em **Menu (⋮) → Instalar Tikatu Coleta...**
4. **Clique em "Instalar"** na janela popup
5. O app abrirá em uma janela separada, como um aplicativo nativo! 🎉

### 🌐 **Edge Desktop (Windows/Mac)**

1. **Abra o Microsoft Edge**
2. **Acesse a URL** do app
3. **Procure pelo ícone de instalação** na barra de endereço
   - Ou vá em **Menu (⋯) → Aplicativos → Instalar este site como um aplicativo**
4. **Clique em "Instalar"**
5. O app abrirá como um aplicativo nativo! 🎉

## ⚠️ Requisitos para Instalação

Para que a opção de instalação apareça, o app precisa:

1. ✅ Estar servido via **HTTPS** (ou localhost para desenvolvimento)
2. ✅ Ter um **manifest.json** válido
3. ✅ Ter um **service worker** registrado (opcional, mas recomendado)
4. ✅ Ter **ícones** configurados corretamente

## 🔧 Verificando se o PWA está Configurado

### No Chrome/Edge Desktop:

1. Abra o **DevTools** (F12)
2. Vá na aba **"Application"** (Aplicativo)
3. No menu lateral, clique em **"Manifest"**
4. Verifique se:
   - ✅ O manifest está sendo carregado
   - ✅ Os ícones estão configurados
   - ✅ Não há erros em vermelho

### No Smartphone:

1. Abra o app no navegador
2. **O banner de instalação aparecerá automaticamente** após 1 segundo no topo da tela
3. Se o app estiver instalável, você verá:
   - **Chrome Android**: Banner azul "Instalar Tikatu Coleta" com botão de instalação
   - **Safari iOS**: Banner azul "Instalar Tikatu Coleta" com instruções de instalação
   - Você pode fechar o banner clicando no "✕" se não quiser instalar agora

## 🚀 Testando Localmente

### 1. Iniciar o servidor de desenvolvimento:

```bash
npm run web
```

### 2. Acessar no navegador:

- **Desktop**: `http://localhost:8081`
- **Smartphone na mesma rede**: `http://SEU-IP:8081` (veja o IP no terminal do Expo)

### 3. Para gerar build de produção:

```bash
npx expo export --platform web
```

Isso gerará os arquivos na pasta `dist/` que podem ser servidos estaticamente.

## 📝 Notas Importantes

- **✨ Banner Automático**: O app mostra automaticamente um banner de instalação em smartphones após 1 segundo
- **Safari iOS**: O banner mostra instruções de como adicionar à tela inicial manualmente
- **Chrome Android**: O banner permite instalação com um toque usando o prompt nativo do navegador
- **Não aparece novamente**: Se você fechar o banner, ele não aparecerá novamente (salvo no navegador)
- **HTTPS obrigatório**: Em produção, o app DEVE estar em HTTPS para funcionar como PWA
- **Service Worker**: Não é obrigatório, mas melhora a experiência offline

## 🐛 Problemas Comuns

### A opção de instalação não aparece:

1. Verifique se está usando HTTPS (ou localhost)
2. Verifique se o manifest.json está sendo carregado (DevTools → Application → Manifest)
3. Verifique se os ícones estão acessíveis
4. Tente fazer um hard refresh (Ctrl+Shift+R ou Cmd+Shift+R)

### O ícone não aparece corretamente:

1. Verifique se os arquivos de ícone existem em `assets/`
2. Verifique se os caminhos no manifest estão corretos
3. Limpe o cache do navegador

## 📞 Suporte

Se tiver problemas, verifique:
- Console do navegador (F12 → Console)
- Aba Application → Manifest no DevTools
- Logs do servidor Expo


