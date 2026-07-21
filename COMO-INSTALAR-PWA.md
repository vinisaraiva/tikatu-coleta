# 🚀 Como Instalar o Tikatu Coleta na Tela Inicial

## 📱 **iPhone (Safari) - Passo a Passo**

1. ✅ Abra o **Safari** no iPhone
2. ✅ Acesse: `http://localhost:8081` (desenvolvimento) ou a URL de produção
3. ✅ Toque no botão **Compartilhar** (quadrado com seta ⬆️) na barra inferior
4. ✅ Role para baixo e toque em **"Adicionar à Tela Inicial"**
5. ✅ Toque em **"Adicionar"** (pode personalizar o nome se quiser)
6. 🎉 **Pronto!** O ícone aparecerá na sua tela inicial

## 🤖 **Android (Chrome) - Passo a Passo**

1. ✅ Abra o **Chrome** no Android
2. ✅ Acesse: `http://localhost:8081` (desenvolvimento) ou a URL de produção
3. ✅ Toque no **menu** (três pontos ⋮) no canto superior direito
4. ✅ Procure e toque em **"Instalar app"** ou **"Adicionar à tela inicial"**
   - ⚠️ Se não aparecer, o app precisa estar em HTTPS (ou localhost)
5. ✅ Confirme na janela popup
6. 🎉 **Pronto!** O ícone aparecerá na sua tela inicial

## 💻 **Chrome Desktop - Passo a Passo**

1. ✅ Abra o **Chrome** no computador
2. ✅ Acesse: `http://localhost:8081`
3. ✅ Procure o **ícone de instalação** na barra de endereço:
   - Ícone de **"+"** ou **computador com seta** 📥
   - Ou vá em **Menu (⋮) → Instalar Tikatu Coleta...**
4. ✅ Clique em **"Instalar"**
5. 🎉 **Pronto!** O app abrirá em uma janela separada

## 🔍 **Como Verificar se Está Funcionando**

### No Chrome Desktop (F12 → DevTools):

1. Abra **DevTools** (F12)
2. Vá na aba **"Application"** (Aplicativo)
3. Clique em **"Manifest"** no menu lateral
4. Verifique:
   - ✅ Manifest carregado sem erros
   - ✅ Ícones configurados
   - ✅ Nome: "Tikatu Coleta"

### No Smartphone:

- **Chrome Android**: Banner "Adicionar à tela inicial" aparece automaticamente
- **Safari iOS**: Opção sempre disponível no menu compartilhar

## ⚡ **Testando Agora**

### 1. Certifique-se que o servidor está rodando:

```bash
npm run web
```

### 2. Acesse no navegador:

- **Desktop**: `http://localhost:8081`
- **Smartphone na mesma rede**: `http://SEU-IP:8081`
  - Veja o IP no terminal do Expo (ex: `192.168.18.51:8081`)

### 3. Siga os passos acima para instalar! 🎯

## 📝 **Notas Importantes**

- ✅ **Localhost funciona** para desenvolvimento (não precisa HTTPS)
- ⚠️ **Produção precisa HTTPS** para funcionar como PWA
- ✅ **Safari iOS** sempre permite adicionar (mesmo sem manifest)
- ✅ **Chrome Android** precisa do manifest.json configurado

## 🐛 **Problemas?**

### Opção de instalação não aparece:

1. Verifique se está em **localhost** ou **HTTPS**
2. Abra **DevTools → Application → Manifest** e verifique erros
3. Faça **hard refresh**: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)

### Ícone não aparece:

1. Verifique se os arquivos existem em `assets/icon.png` e `assets/logo_app.png`
2. Limpe o cache do navegador
3. Refaça o build: `npm run build:web`

---

**Pronto para instalar! 🚀**




