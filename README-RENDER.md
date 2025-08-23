# Tikatu Coleta - Deploy no Render.com

## 🚀 Como fazer o deploy no Render.com

### 1. **Criar conta no Render**
- Acesse [render.com](https://render.com)
- Faça login com GitHub

### 2. **Conectar repositório**
- Clique em "New +"
- Selecione "Static Site"
- Conecte o repositório `tikatu-coleta`

### 3. **Configurar build**
- **Name**: `tikatu-coleta-pwa`
- **Build Command**: `npm install && npx expo export`
- **Publish Directory**: `dist`
- **Branch**: `main`

### 4. **Variáveis de ambiente**
- `NODE_ENV`: `production`

### 5. **Deploy**
- Clique em "Create Static Site"
- Aguarde o build (pode levar 5-10 minutos)

### 6. **URL final**
- Render fornecerá uma URL como: `https://tikatu-coleta-pwa.onrender.com`

## 📱 Vantagens do Render

✅ **Melhor performance** que GitHub Pages  
✅ **Build automático** a cada push  
✅ **HTTPS automático**  
✅ **CDN global**  
✅ **Suporte a React Native Web**  
✅ **Logs detalhados**  

## 🔧 Troubleshooting

Se o build falhar:
1. Verifique os logs no Render
2. Teste localmente: `npm install && npx expo export`
3. Verifique se todas as dependências estão no `package.json`

## 📞 Suporte

Para problemas com o deploy, verifique:
- Logs do build no Render
- Console do navegador
- Configuração do repositório
