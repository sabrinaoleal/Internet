import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SHEET_ID, FIRST_CONGREGATION_ID, START_MONTH, fetchCongregations, validateMonth, validateUpload } from './sheets.mjs';

if (existsSync(new URL('.env', import.meta.url))) process.loadEnvFile(fileURLToPath(new URL('.env', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const scriptURL = process.env.GOOGLE_APPS_SCRIPT_URL || '';
const scriptToken = process.env.GOOGLE_APPS_SCRIPT_TOKEN || '';
const writesAvailable = Boolean(scriptURL && scriptToken);
if (scriptURL && !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(scriptURL)) throw new Error('A URL do Apps Script precisa ser uma implantação /exec do Google.');
const origin = `http://127.0.0.1:${port}`;
const assets = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]]);

async function google(action, payload = {}) {
  const response = await fetch(scriptURL, {
    method: 'POST', redirect: 'follow', signal: AbortSignal.timeout(45000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: scriptToken, action, ...payload })
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('O Google não confirmou a operação. Atualize a página antes de tentar novamente.'); }
  if (!response.ok || result.ok !== true) throw new Error(result.error || 'O Google não confirmou a operação. Atualize a página antes de tentar novamente.');
  return result.data;
}

async function readBody(request) {
  let length = 0; const parts = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 15 * 1024 * 1024) throw Object.assign(new Error('O comprovante deve ter até 10 MB.'), { status: 413 });
    parts.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Object.assign(new Error('Os dados enviados são inválidos.'), { status: 400 }); }
}

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}

export function createApp(dependencies = {}) {
  const readSource = dependencies.fetchCongregations || fetchCongregations;
  const callGoogle = dependencies.google || google;
  const canWrite = dependencies.writesAvailable ?? writesAvailable;
  return http.createServer(async (request, response) => {
    try {
      // Somente o computador local; recusa páginas de outros sites e DNS rebinding.
      if (request.headers.host !== `127.0.0.1:${port}` && request.headers.host !== `localhost:${port}`) return json(response, 403, { error: 'Abra o endereço local do programa.' });
      const url = new URL(request.url, origin);
      if (request.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" });
        return response.end(readFileSync(new URL(file, import.meta.url)));
      }
      if (request.method === 'GET' && url.pathname === '/api/state') {
        const congregations = await readSource();
        let payments = [], paymentError = null, paymentsAvailable = false;
        if (canWrite) {
          try {
            const state = await callGoogle('getPayments');
            if (!Array.isArray(state.payments)) throw new Error('Resposta de pagamentos inválida.');
            payments = state.payments; paymentsAvailable = true;
          } catch (error) { paymentError = error.message; }
        }
        return json(response, 200, { congregations, firstCongregationId: FIRST_CONGREGATION_ID, startMonth: START_MONTH, payments, paymentsAvailable, writesAvailable: canWrite && paymentsAvailable, paymentError, sourceURL: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=0`, fetchedAt: new Date().toISOString() });
      }
      if (request.method === 'POST' && ['/api/payment', '/api/receipt'].includes(url.pathname)) {
        if (![origin, `http://localhost:${port}`].includes(request.headers.origin) || !/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return json(response, 403, { error: 'Abra o programa para fazer esta alteração.' });
        if (!canWrite) return json(response, 503, { error: 'Falta autorizar a gravação na sua conta Google. Nenhum dado foi salvo.' });
        const body = await readBody(request);
        try {
          validateMonth(body.key);
          if (typeof body.requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw new Error('Identificador de envio inválido.');
          if (url.pathname === '/api/payment') {
            if (typeof body.paid !== 'boolean') throw new Error('Informe se o pagamento foi realizado.');
          } else validateUpload(body.file);
        } catch (error) { return json(response, 400, { error: error.message }); }
        const data = await callGoogle(url.pathname === '/api/payment' ? 'setPaid' : 'uploadReceipt', { key: body.key, paid: body.paid, file: body.file, requestId: body.requestId });
        return json(response, 200, data);
      }
      json(response, 404, { error: 'Endereço não encontrado.' });
    } catch (error) {
      const message = error.name === 'TimeoutError' ? 'A conexão com o Google demorou demais. Atualize antes de tentar novamente.' : error.message;
      json(response, error.status || 502, { error: message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const server = createApp();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'O programa já está aberto nesta porta.' : 'Não foi possível iniciar o programa.'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Programa: ${origin}\nCongregações: Google Sheets ao vivo.\nGravação no Google: ${writesAvailable ? 'configurada; será conferida ao abrir' : 'aguardando autorização'}.`));
}
