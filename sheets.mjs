export const SHEET_ID = '1q6U4F_z4N3CKOy-8QZE7KcUgHbagLBB-AvV1u0tGF_0';
export const FIRST_CONGREGATION_ID = 9; // Jardim imperial: confirmado pelo usuário.
export const START_MONTH = '2026-10';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function parseCSV(source) {
  const rows = []; let row = [], cell = '', quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (!quoted && cell !== '') throw new Error('Formato da planilha inválido.');
      else quoted = !quoted;
    } else if (!quoted && (ch === ',' || ch === '\n' || ch === '\r')) {
      row.push(cell); cell = '';
      if (ch !== ',') {
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      }
    } else cell += ch;
  }
  if (quoted) throw new Error('A planilha contém um campo incompleto.');
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

export function readCongregations(csv) {
  const [header, ...rows] = parseCSV(csv);
  const names = (header || []).map(value => value.trim().toUpperCase());
  const idColumn = names.indexOf('ID'), nameColumn = names.indexOf('NOME');
  if (idColumn < 0 || nameColumn < 0) throw new Error('A planilha precisa das colunas ID e NOME.');
  const result = rows.map(row => ({ id: Number(row[idColumn]), name: (row[nameColumn] || '').trim() }));
  if (result.length !== 19 || result.some(item => !Number.isSafeInteger(item.id) || item.id < 1 || !item.name || item.name.length > 200) || new Set(result.map(item => item.id)).size !== 19) {
    throw new Error('Confira a planilha: são necessárias 19 congregações, com IDs diferentes e nomes preenchidos.');
  }
  result.sort((a, b) => a.id - b.id);
  if (!result.some(item => item.id === FIRST_CONGREGATION_ID)) throw new Error('Jardim imperial (ID 9) não foi encontrada na planilha.');
  return result;
}

export function validateMonth(key) {
  if (typeof key !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || key < START_MONTH) throw new Error('Escolha um mês a partir de outubro de 2026.');
  return key;
}

export function responsibleFor(congregations, key) {
  validateMonth(key);
  const [year, month] = key.split('-').map(Number);
  const offset = (year - 2026) * 12 + month - 10;
  const first = congregations.findIndex(item => item.id === FIRST_CONGREGATION_ID);
  if (first < 0 || congregations.length !== 19) throw new Error('A ordem das congregações está incompleta.');
  return congregations[(first + offset) % congregations.length];
}

export async function fetchCongregations(fetcher = fetch) {
  const response = await fetcher(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível ler a planilha. Confira o acesso de leitura.');
  const text = await response.text();
  if (text.length > 1024 * 1024 || /^\s*</.test(text)) throw new Error('O Google não retornou os dados da planilha.');
  return readCongregations(text);
}

export function validateUpload(file) {
  if (!file || !FILE_TYPES.includes(file.type) || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || typeof file.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) throw new Error('Escolha um comprovante PDF, JPG, PNG ou WebP.');
  const bytes = Buffer.from(file.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE_BYTES || bytes.toString('base64') !== file.base64) throw new Error('O comprovante deve ter até 10 MB e não pode estar vazio.');
  const matches = {
    'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-',
    'image/jpeg': bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
    'image/webp': bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'
  };
  if (!matches[file.type]) throw new Error('O conteúdo do arquivo não corresponde ao tipo informado.');
}
