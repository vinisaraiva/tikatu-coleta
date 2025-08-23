const XLSX = require('xlsx');
const fs = require('fs');

// Dados de teste
const testData = [
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
  },
  {
    "ID": "2",
    "Model Name": "Water Quality Sensor",
    "Date": "2024-01-15 14:45:00",
    "EC": "280.2",
    "EC(Unit)": "µS/cm",
    "TDS": "140.1",
    "TDS(Unit)": "mg/L",
    "SALT(%)": "0.12",
    "SALT(TDS)": "0.12",
    "SALT(TDS)(Unit)": "mg/L",
    "SALT(S.G.)": "1.001",
    "pH": "7.1",
    "Humidity(%)": "70",
    "ORP(mV)": "145",
    "H2(ppb)": "0",
    "H2(ppm)": "0",
    "DO(mg/L)": "7.8",
    "DO(%)": "78",
    "CF": "0.5",
    "CL(mg/L)": "0.3",
    "Temperature(°C)": "25.2",
    "Temperature(°F)": "77.4",
    "Location": "Ponto de Coleta 1",
    "Notes": "Coleta vespertina"
  }
];

// Criar workbook
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(testData);
XLSX.utils.book_append_sheet(workbook, worksheet, 'Coletas');

// Salvar arquivo
XLSX.writeFile(workbook, 'test-sonda.xlsx');

console.log('Arquivo test-sonda.xlsx criado com sucesso!'); 