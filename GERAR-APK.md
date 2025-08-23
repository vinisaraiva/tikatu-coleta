# Como Gerar o APK - Tikatu Coleta

## 🎯 Distribuição Direta para Voluntários

Este guia é otimizado para instalar o app diretamente nos smartphones dos voluntários, **sem precisar da Play Store**.

### Método 1: EAS Build (Recomendado)

1. **Instalar EAS CLI:**
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Fazer login no Expo:**
   ```bash
   npx eas login
   ```

3. **Configurar o projeto:**
   ```bash
   npx eas build:configure
   ```

4. **Gerar APK de Preview (RECOMENDADO para testes):**
   ```bash
   npx eas build --platform android --profile preview
   ```
   
   ⚠️ **IMPORTANTE:** Use sempre o perfil `preview` para gerar APK funcional. O perfil `development` gera um Dev Client que precisa de conexão com Metro.

### Método 2: Build Local (Alternativo)

1. **Instalar dependências:**
   ```bash
   npx expo install expo-dev-client
   ```

2. **Gerar build local:**
   ```bash
   npx eas build --platform android --profile development --local
   ```

### Método 3: Expo Classic Build (Legacy)

1. **Instalar expo-cli:**
   ```bash
   npm install -g expo-cli@latest
   ```

2. **Gerar APK:**
   ```bash
   expo build:android --type apk
   ```

## 📱 Configurações Atuais

### app.config.js
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

### eas.json
```json
{
  "cli": {
    "version": ">= 5.9.1"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Perfis disponíveis:**
- `development`: Dev Client (precisa Metro) - ❌ Não usar para distribuição
- `preview`: APK standalone - ✅ Usar para testes e distribuição
- `production`: APK standalone - ✅ Usar para versão final dos voluntários

## 🔧 Requisitos

### Para EAS Build:
- Conta Expo (gratuita)
- Conexão com internet
- Tempo de build: ~10-15 minutos

### Para Build Local:
- Android Studio instalado
- Android SDK configurado
- Java JDK 11+
- Tempo de build: ~5-10 minutos

## 📋 Passos Detalhados

### 1. Preparação
```bash
# Navegar para a pasta do projeto
cd apps/mobile

# Verificar se tudo está configurado
npx expo doctor
```

### 2. Build com EAS
```bash
# Login no Expo
npx eas login

# Para testes (recomendado primeiro)
npx eas build --platform android --profile preview

# Para versão final dos voluntários
npx eas build --platform android --profile production
```

**Comandos para distribuição:**
```bash
# Teste interno
npx eas build --platform android --profile preview

# Versão final para voluntários
npx eas build --platform android --profile production
```

### 3. Verificar Build
- Acessar: https://expo.dev
- Ir em "Projects" > "Tikatu Coleta"
- Verificar status do build
- Baixar APK quando concluído

### 4. Distribuir para Voluntários

**Opções de distribuição:**

1. **WhatsApp/Telegram:**
   - Enviar o arquivo APK diretamente
   - Voluntário clica no arquivo para instalar

2. **Google Drive/Dropbox:**
   - Fazer upload do APK
   - Compartilhar link de download
   - Voluntário baixa e instala

3. **Email:**
   - Anexar o APK no email
   - Voluntário baixa o anexo

**Instruções para os voluntários:**
- Baixar o APK
- Permitir "Fontes desconhecidas" nas configurações do Android
- Clicar no APK para instalar
- Aceitar as permissões solicitadas

## 🎯 Resultado Esperado

- **Nome do APK:** 
  - Preview: `tikatu-coleta-preview.apk`
  - Production: `tikatu-coleta-production.apk`
- **Tamanho:** ~15-25 MB
- **Ícone:** Logo circular da Tikatu Coleta
- **Splash Screen:** Imagem da marca durante carregamento
- **Instalação:** Direta no smartphone (sem Play Store)

## ⚠️ Observações Importantes

1. **Primeiro build:** Pode demorar mais tempo
2. **Ícone e Splash:** Já configurados com `imagem-home.png`
3. **Teste:** Sempre testar o APK antes de distribuir
4. **Versão:** Atualizar versão no `app.config.js` antes de cada build
5. **Distribuição:** APK pode ser instalado diretamente (sem Play Store)
6. **Permissões:** Voluntários precisam habilitar "Fontes desconhecidas"

## 🆘 Solução de Problemas

### APK abre esperando conexão com Metro:
**Problema:** APK foi gerado com perfil `development` (Dev Client)
**Solução:** Use sempre o perfil `preview`:
```bash
npx eas build --platform android --profile preview
```

### Erro de Login:
```bash
# Limpar cache
npx expo logout
npx expo login
```

### Erro de Build:
```bash
# Verificar configuração
npx expo doctor

# Limpar cache
npx expo start --clear
```

### Erro de Dependências:
```bash
# Reinstalar dependências
rm -rf node_modules
pnpm install
```
