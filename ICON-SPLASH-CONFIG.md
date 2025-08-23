# Configuração de Ícone e Splash Screen - Tikatu Coleta

## ✅ Configurações Implementadas

### 1. **Ícone do Aplicativo**
- **Arquivo:** `./assets/imagem-home.png`
- **Configurado para:**
  - iOS: Ícone principal e adaptive icon
  - Android: Ícone principal e adaptive icon
  - Web: Favicon

### 2. **Splash Screen (Tela de Carregamento)**
- **Arquivo:** `./assets/imagem-home.png`
- **Configurações:**
  - `resizeMode`: "contain" (mantém proporções)
  - `backgroundColor`: "#f8fafc" (tom claro que combina com o app)

### 3. **Informações do App**
- **Nome:** "Tikatu Coleta"
- **Slug:** "tikatu-coleta"
- **Versão:** "1.0.0"
- **Bundle ID iOS:** "com.tikatu.coleta"
- **Package Android:** "com.tikatu.coleta"

## 📁 Arquivos Modificados

### `app.config.js`
```javascript
export default {
  expo: {
    name: "Tikatu Coleta",
    slug: "tikatu-coleta",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/imagem-home.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/imagem-home.png",
      resizeMode: "contain",
      backgroundColor: "#f8fafc"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tikatu.coleta",
      icon: "./assets/imagem-home.png"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/imagem-home.png",
        backgroundColor: "#f8fafc"
      },
      edgeToEdgeEnabled: true,
      package: "com.tikatu.coleta",
      icon: "./assets/imagem-home.png"
    },
    web: {
      favicon: "./assets/imagem-home.png"
    }
  }
};
```

### `eas.json`
```json
{
  "cli": {
    "version": ">= 5.9.1"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

## 🎨 Características da Imagem

A imagem `imagem-home.png` é uma logo circular que representa:
- **Tema:** Monitoramento de qualidade da água
- **Cores:** Tons de verde, azul e marrom
- **Elementos:** Rio, paisagem natural, ícone da marca
- **Identidade:** Tikatu Coleta (Hydrosense)

## 📱 Como Testar

1. **Desenvolvimento:**
   ```bash
   npx expo start --tunnel
   ```

2. **Build de Preview:**
   ```bash
   npx eas build --profile preview
   ```

3. **Build de Produção:**
   ```bash
   npx eas build --profile production
   ```

## 🔧 Requisitos Técnicos

### Dimensões Recomendadas:
- **Ícone:** 1024x1024 pixels
- **Splash Screen:** 1242x2436 pixels (iPhone X)
- **Adaptive Icon Android:** 1024x1024 pixels

### Formatos Suportados:
- PNG (recomendado)
- JPG
- SVG (apenas para web)

## 🚀 Próximos Passos

1. **Testar no dispositivo físico** para verificar como a splash screen aparece
2. **Ajustar dimensões** se necessário
3. **Configurar EAS Build** para gerar APK/IPA
4. **Publicar nas lojas** (Google Play Store / App Store)

## 📝 Observações

- A imagem foi copiada da raiz do projeto para `./assets/imagem-home.png`
- O arquivo `app.json` foi removido em favor do `app.config.js`
- As configurações são compatíveis com Expo SDK 51+
- O background color (#f8fafc) combina com o tema do app
