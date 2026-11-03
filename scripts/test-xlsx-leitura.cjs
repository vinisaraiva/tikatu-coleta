// Fixture sintética: nenhum dado real de voluntários.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

// Mantém a fixture alinhada aos nomes de coluna da tela, sem importar React Native.
const source = fs.readFileSync(path.join(__dirname, "../src/screens/XLSXImportScreen.tsx"), "utf8");
const block = source.match(/const expectedHeaders = \[([\s\S]*?)\];/);
assert.ok(block, "expectedHeaders não encontrado");
const headers = Array.from(block[1].matchAll(/'([^']+)'/g), match => match[1]);
assert.equal(headers.length, 24);
const row = Object.fromEntries(headers.map(header => [header, "-"]));
Object.assign(row, {
  ID: 12345, "Model Name": "Sonda teste", Date: "2026/11/03 14:25:36",
  EC: 123.45, "EC(Unit)": "µS/cm", TDS: 0, pH: 7.25,
  "ORP(mV)": -12.5, "DO(mg/L)": 8.75, "SALT(%)": 0.12,
  "Temperature(°C)": 24.75, Notes: "fixture sintética",
});
const excelDate = 46329.60111111111;
const rows = [row, { ...row, ID: 12346, Date: excelDate }];
const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
sheet.C3.z = "yyyy/mm/dd hh:mm:ss";
XLSX.utils.book_append_sheet(workbook, sheet, "ExportExcel");
const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
for (const type of ["array", "base64"]) {
  const input = type === "array" ? buffer : Buffer.from(buffer).toString("base64");
  const read = XLSX.read(input, { type });
  const result = XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]]);
  assert.deepEqual(result, rows, "Datas, decimais e IDs devem preservar valores e tipos");
  assert.equal(typeof result[0].ID, "number");
  assert.equal(typeof result[1].Date, "number");
  const date = XLSX.SSF.parse_date_code(result[1].Date);
  assert.deepEqual([date.y, date.m, date.d, date.H, date.M, date.S], [2026, 11, 3, 14, 25, 36]);
  console.log(`OK ${type}: 24 colunas, data/hora textual e serial Excel, decimais, zero e ID numérico`);
}
console.log(`SheetJS ${XLSX.version}: leitura e escrita compatíveis`);
