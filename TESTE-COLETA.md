# 🧪 Guia de Teste - Primeira Coleta

## 📱 Como Testar o App

### 1. **Limpeza de Dados Antigos**
- O app agora limpa automaticamente dados de teste antigos
- Se ainda estiver logado com dados de teste, faça logout e login novamente

### 2. **Login**
- Abra o app no seu dispositivo
- Use as credenciais:
  - **Código**: `VOL368731`
  - **Senha**: `123456` (ou qualquer senha com 3+ caracteres)
- Verifique se aparece "Olá, {nome}" no dashboard

### 3. **Teste de Importação XLSX**
- No Dashboard, clique em **"📊 Importar Dados da Sonda"**
- Selecione o arquivo `test-sonda.xlsx` (criado para teste)
- Clique em **"🔄 Processar Dados"**
- **IMPORTANTE**: Após processar, deve aparecer a tela de fatores ambientais
- Responda as 5 perguntas de fatores ambientais
- Clique em **"🔄 Sincronizar com Supabase"**

## 📊 Arquivo de Teste

O arquivo `test-sonda.xlsx` foi criado com dados de exemplo que contêm:
- 2 coletas com dados válidos
- Parâmetros: EC, TDS, pH, ORP, DO, Temperature, CL
- Formato correto da sonda

## 🔍 Debug e Logs

### **Verificar no Console:**
1. **Login**: `Tentando login com código: VOL368731`
2. **Processamento**: `Encontradas X coletas válidas`
3. **Navegação**: `Navegando para fatores ambientais com: {...}`
4. **Tela Fatores**: `EnvironmentalFactorsScreen carregada com: {...}`

### **Problemas Comuns:**

#### **1. Login com dados de teste**
- **Solução**: Faça logout e login novamente
- O app agora limpa dados de teste automaticamente

#### **2. Tela de fatores ambientais não aparece**
- **Verificar**: Logs no console sobre navegação
- **Possível causa**: Erro no processamento do XLSX
- **Solução**: Verificar formato do arquivo

#### **3. Erro no processamento**
- **Verificar**: Se o arquivo tem as colunas corretas
- **Colunas obrigatórias**: ID, Date, EC, pH, ORP(mV), DO(mg/L), Temperature(°C), CL(mg/L)

## 🔄 Fluxo Completo Esperado

1. **Dashboard**: "Olá, {nome}" + localização
2. **Upload XLSX**: Selecionar `test-sonda.xlsx`
3. **Processar**: Validar e extrair dados
4. **Fatores Ambientais**: Tela deve aparecer automaticamente
5. **Responder**: 5 perguntas obrigatórias
6. **Sincronizar**: Enviar para Supabase
7. **Sucesso**: Arquivo modificado no storage

## 🎯 Resultado Esperado

- ✅ Login com dados reais do Supabase
- ✅ Dashboard personalizado
- ✅ Processamento de XLSX
- ✅ Tela de fatores ambientais aparece
- ✅ Sincronização com Supabase
- ✅ Arquivo no storage: `coleta-voluntarios-VOL368731-{timestamp}.xlsx`

## 🐛 Se Algo Não Funcionar

1. **Verifique os logs** no console do Metro
2. **Teste o login** primeiro
3. **Use o arquivo** `test-sonda.xlsx` fornecido
4. **Verifique** se a tela de fatores ambientais aparece
5. **Reporte** os logs de erro para debug 