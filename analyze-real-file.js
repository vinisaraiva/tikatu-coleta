const XLSX = require('xlsx');

try {
  // Ler o arquivo real da sonda
  const workbook = XLSX.readFile('ExportExcel.xlsx');
  console.log('Arquivo lido com sucesso!');
  console.log('Sheets encontradas:', workbook.SheetNames);
  
  // Pegar a primeira sheet
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log('Quantidade de linhas:', data.length);
  
  if (data.length > 0) {
    console.log('Cabeçalhos encontrados:');
    const headers = Object.keys(data[0]);
    headers.forEach((header, index) => {
      console.log(`${index + 1}. ${header}`);
    });
    
    console.log('\nPrimeira linha de dados:');
    console.log(JSON.stringify(data[0], null, 2));
  }
  
} catch (error) {
  console.error('Erro ao ler arquivo:', error);
} 