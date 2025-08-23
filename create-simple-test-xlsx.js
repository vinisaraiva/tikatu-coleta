const XLSX = require('xlsx');

// Dados de teste simplificados
const simpleTestData = [
  {
    "ID": "1",
    "Model Name": "Water Quality Sensor",
    "Date": "2024-01-15 10:30:00",
    "EC": "250.5",
    "EC(Unit)": "µS/cm",
    "TDS": "125.3",
    "TDS(Unit)": "mg/L",
    "SALT(%)": "0.1",
    "SALT(TDS)": "0.1",
    "SALT(TDS)(Unit)": "mg/L",
    "SALT(S.G.)": "1.000",
    "pH": "7.2",
    "Humidity(%)": "65",
    "ORP(mV)": "150",
    "H2(ppb)": "0",
    "H2(ppm)": "0",
    "DO(mg/L)": "8.5",
    "DO(%)": "85",
    "CF": "0.5",
    "CL(mg/L)": "0.2",
    "Temperature(°C)": "22.5",
    "Temperature(°F)": "72.5",
    "Location": "Ponto de Coleta 1",
    "Notes": "Coleta matinal"
  }
];

// Criar workbook
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(simpleTestData);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Coletas');

// Salvar arquivo
XLSX.writeFile(workbook, 'simple-test-sonda.xlsx');

console.log('Arquivo simple-test-sonda.xlsx criado com sucesso!');
console.log('Cabeçalhos incluídos:', Object.keys(simpleTestData[0])); 