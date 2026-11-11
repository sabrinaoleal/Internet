// Instalar em Extensões > Apps Script da planilha informada pelo usuário.
// Este código só atende chamadas com o token privado definido nas propriedades.
const INTERNET_SHEET_ID = '1q6U4F_z4N3CKOy-8QZE7KcUgHbagLBB-AvV1u0tGF_0';
const PAYMENT_TAB = 'Pagamentos Internet';
const PAYMENT_HEADERS = ['MES','CONGREGACAO_ID','CONGREGACAO','PAGO','COMPROVANTE_ID','COMPROVANTE_NOME','ATUALIZADO_EM'];

function prepararConexao() {
  const sheet = SpreadsheetApp.openById(INTERNET_SHEET_ID);
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('APP_TOKEN')) properties.setProperty('APP_TOKEN', Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,''));
  let payments = sheet.getSheetByName(PAYMENT_TAB);
  if (!payments) {
    payments = sheet.insertSheet(PAYMENT_TAB);
    payments.getRange(1,1,1,PAYMENT_HEADERS.length).setValues([PAYMENT_HEADERS]);
    payments.setFrozenRows(1);
  }
  verifyHeaders_(payments);
  console.log('Conexão preparada. O token está em Configurações do projeto > Propriedades do script > APP_TOKEN. Não compartilhe esse valor.');
}

function doPost(event) {
  let lock;
  try {
    if (!event || !event.postData || event.postData.contents.length > 15*1024*1024) throw new Error('Requisição inválida.');
    const body = JSON.parse(event.postData.contents);
    const expectedToken = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (!expectedToken || typeof body.token !== 'string' || body.token !== expectedToken) throw new Error('A conexão não foi autorizada.');
    if (body.action === 'getPayments') return output_({ok:true,data:{payments:readPayments_()}});
    if (!['setPaid','uploadReceipt'].includes(body.action)) throw new Error('Operação inválida.');
    validateKey_(body.key);
    if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new Error('Identificador inválido.');
    if (body.action === 'setPaid' && typeof body.paid !== 'boolean') throw new Error('Estado de pagamento inválido.');
    lock = LockService.getScriptLock(); lock.waitLock(30000);
    const cache = CacheService.getScriptCache(), cacheKey = 'request:' + body.requestId;
    const fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify({action:body.action,key:body.key,paid:body.paid,file:body.file})));
    const previous = cache.get(cacheKey);
    if (previous) {
      const saved = JSON.parse(previous);
      if (saved.fingerprint !== fingerprint) throw new Error('Este envio já foi usado para outra alteração. Atualize a página.');
      return output_({ok:true,data:saved.data});
    }
    const oldRecord = readPayments_().find(item => item.key === body.key);
    const congregation = congregationFor_(body.key);
    const record = oldRecord || {key:body.key,congregationId:congregation.id,congregationName:congregation.name,paid:false,receiptId:'',receiptName:''};
    if (body.action === 'setPaid') record.paid = body.paid;
    else {
      const upload = checkedFile_(body.file);
      const folder = receiptFolder_();
      // O mesmo envio reutiliza o arquivo em caso de queda após o upload.
      const storedName = body.key + '_' + body.requestId + '_' + upload.name;
      const matches = folder.getFilesByName(storedName);
      const file = matches.hasNext() ? matches.next() : folder.createFile(Utilities.newBlob(upload.bytes,upload.type,storedName));
      record.receiptId = file.getId(); record.receiptName = upload.name;
    }
    record.updatedAt = new Date().toISOString();
    writePayment_(record);
    const data = publicRecord_(record);
    cache.put(cacheKey,JSON.stringify({fingerprint:fingerprint,data:data}),21600);
    return output_({ok:true,data:data});
  } catch (error) { return output_({ok:false,error:error.message || 'Não foi possível concluir a operação.'}); }
  finally { if (lock && lock.hasLock()) lock.releaseLock(); }
}

function output_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function validateKey_(key) { if (typeof key !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(key) || key < '2026-10') throw new Error('Mês inválido.'); }
function paymentSheet_() {
  const tab = SpreadsheetApp.openById(INTERNET_SHEET_ID).getSheetByName(PAYMENT_TAB);
  if (!tab) throw new Error('Execute prepararConexao no Apps Script antes de usar.');
  verifyHeaders_(tab); return tab;
}
function verifyHeaders_(tab) {
  const actual = tab.getRange(1,1,1,PAYMENT_HEADERS.length).getDisplayValues()[0];
  if (actual.join('|') !== PAYMENT_HEADERS.join('|')) throw new Error('Confira os títulos da aba Pagamentos Internet. Nenhum dado foi alterado.');
}
function readPayments_() {
  const tab = paymentSheet_();
  if (tab.getLastRow() < 2) return [];
  const seen = {};
  return tab.getRange(2,1,tab.getLastRow()-1,PAYMENT_HEADERS.length).getValues().filter(row => row.some(value => value !== '')).map(row => {
    const key = String(row[0]); validateKey_(key);
    if (seen[key]) throw new Error('Há meses duplicados na aba de pagamentos.'); seen[key] = true;
    if (typeof row[3] !== 'boolean') throw new Error('O pagamento de ' + key + ' precisa de VERDADEIRO ou FALSO na planilha.');
    return publicRecord_({key:key,congregationId:Number(row[1]),congregationName:String(row[2]),paid:row[3],receiptId:String(row[4] || ''),receiptName:String(row[5] || ''),updatedAt:row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')});
  });
}
function publicRecord_(record) {
  return {key:record.key,congregationId:record.congregationId,congregationName:record.congregationName,paid:record.paid,receiptId:record.receiptId || '',receiptName:record.receiptName || '',receiptURL:record.receiptId ? 'https://drive.google.com/file/d/' + record.receiptId + '/view' : '',updatedAt:record.updatedAt || ''};
}
function congregationFor_(key) {
  const book = SpreadsheetApp.openById(INTERNET_SHEET_ID);
  const tab = book.getSheets().find(sheet => sheet.getSheetId() === 0);
  if (!tab) throw new Error('A aba de congregações não foi encontrada.');
  const rows = tab.getDataRange().getDisplayValues();
  const header = rows.shift().map(value => value.trim().toUpperCase());
  const idIndex = header.indexOf('ID'), nameIndex = header.indexOf('NOME');
  if (idIndex < 0 || nameIndex < 0) throw new Error('São necessárias as colunas ID e NOME.');
  const list = rows.filter(row => row.some(value => value.trim())).map(row => ({id:Number(row[idIndex]),name:row[nameIndex].trim()})).sort((a,b)=>a.id-b.id);
  if (list.length !== 19 || new Set(list.map(item=>item.id)).size !== 19 || list.some(item=>!Number.isSafeInteger(item.id)||item.id<1||!item.name||item.name.length>200)) throw new Error('Confira as 19 congregações cadastradas.');
  const first = list.findIndex(item => item.id === 9);
  if (first < 0) throw new Error('Jardim imperial (ID 9) não foi encontrada.');
  const parts = key.split('-').map(Number);
  return list[(first+(parts[0]-2026)*12+parts[1]-10)%19];
}
function sheetText_(value) { const text = String(value); return /^[=+@-]/.test(text) ? "'" + text : text; }
function writePayment_(record) {
  const tab = paymentSheet_();
  const keys = tab.getLastRow() < 2 ? [] : tab.getRange(2,1,tab.getLastRow()-1,1).getDisplayValues().map(row=>row[0]);
  const index = keys.indexOf(record.key), rowNumber = index < 0 ? tab.getLastRow()+1 : index+2;
  tab.getRange(rowNumber,1,1,PAYMENT_HEADERS.length).setValues([[record.key,record.congregationId,sheetText_(record.congregationName),record.paid,record.receiptId || '',sheetText_(record.receiptName || ''),record.updatedAt]]);
  SpreadsheetApp.flush();
}
function receiptFolder_() {
  const properties = PropertiesService.getScriptProperties(), id = properties.getProperty('RECEIPTS_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('Comprovantes - Internet congregações');
  properties.setProperty('RECEIPTS_FOLDER_ID',folder.getId());
  // Pasta e comprovantes mantêm o acesso privado padrão do Google Drive.
  return folder;
}
function checkedFile_(file) {
  if (!file || !['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || typeof file.name !== 'string' || !file.name.trim() || file.name.length>200 || typeof file.base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64)) throw new Error('Comprovante inválido.');
  const bytes = Utilities.base64Decode(file.base64);
  if (!bytes.length || bytes.length>10*1024*1024 || Utilities.base64Encode(bytes)!==file.base64) throw new Error('O comprovante deve ter até 10 MB.');
  const u = bytes.map(value=>(value+256)%256);
  const prefix = String.fromCharCode.apply(null,u.slice(0,12));
  const matches = {'application/pdf':prefix.slice(0,5)==='%PDF-','image/jpeg':u[0]===255&&u[1]===216&&u[2]===255,'image/png':[137,80,78,71,13,10,26,10].every((value,i)=>u[i]===value),'image/webp':prefix.slice(0,4)==='RIFF'&&prefix.slice(8,12)==='WEBP'};
  if (!matches[file.type]) throw new Error('O conteúdo não corresponde ao tipo do comprovante.');
  return {bytes:bytes,type:file.type,name:file.name.replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').slice(0,120)};
}
