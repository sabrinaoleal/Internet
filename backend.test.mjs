import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createApp } from './server.mjs';
import { parseCSV, readCongregations, responsibleFor, fetchCongregations, validateUpload } from './sheets.mjs';

const csv = 'ID,NOME,COORDENADOR,TELEFONE,EMAIL\r\n' + Array.from({length:19},(_,i)=>`${i+1},${i===8?'Jardim imperial':`Congregação ${i+1}`},,,`).join('\r\n');
const list = readCongregations(csv);

test('CSV preserva acentos, vírgulas, aspas e quebras dentro de nomes',()=>{
  assert.deepEqual(parseCSV('\uFEFFID,NOME\r\n1,"São João, centro"\r\n2,"Vila ""Nova""\nSul"'),[['ID','NOME'],['1','São João, centro'],['2','Vila "Nova"\nSul']]);
  assert.throws(()=>parseCSV('ID,NOME\n1,"incompleto'));
});

test('cadastro exige exatamente 19 IDs únicos e nomes preenchidos',()=>{
  assert.equal(list.length,19);
  assert.throws(()=>readCongregations(csv.replace('19,Congregação 19','18,Congregação 19')));
  assert.throws(()=>readCongregations(csv.replace('1,Congregação 1,,,\r\n','')));
  assert.throws(()=>readCongregations(csv.replace('9,Jardim imperial','9,')));
});

test('rodízio começa em Jardim imperial e atravessa anos sem reiniciar',()=>{
  assert.equal(responsibleFor(list,'2026-10').id,9);
  assert.equal(responsibleFor(list,'2026-11').id,10);
  assert.equal(responsibleFor(list,'2026-12').id,11);
  assert.equal(responsibleFor(list,'2027-01').id,12);
  assert.equal(responsibleFor(list,'2027-09').id,1);
  assert.equal(responsibleFor(list,'2028-04').id,8);
  assert.equal(responsibleFor(list,'2028-05').id,9);
  assert.throws(()=>responsibleFor(list,'2026-09'));
  assert.throws(()=>responsibleFor(list,'2026-13'));
});

test('falha de leitura ou resposta de login não vira cadastro vazio',async()=>{
  await assert.rejects(fetchCongregations(async()=>({ok:false})),/ler a planilha/);
  await assert.rejects(fetchCongregations(async()=>({ok:true,text:async()=>'<html>login</html>'})),/não retornou/);
  assert.equal((await fetchCongregations(async()=>({ok:true,text:async()=>csv})))[8].name,'Jardim imperial');
});

test('comprovante exige conteúdo coerente com o tipo e tamanho',()=>{
  validateUpload({name:'comprovante.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nexemplo').toString('base64')});
  assert.throws(()=>validateUpload({name:'falso.pdf',type:'application/pdf',base64:Buffer.from('<script>').toString('base64')}));
  assert.throws(()=>validateUpload({name:'vazio.pdf',type:'application/pdf',base64:''}));
  assert.throws(()=>validateUpload({name:'grande.pdf',type:'application/pdf',base64:Buffer.alloc(10*1024*1024+1).toString('base64')}));
});

function request(server,path,{method='GET',body,origin='http://127.0.0.1:4173',host='127.0.0.1:4173'}={}){
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:host,Origin:origin,'Content-Type':'application/json'}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text,json:()=>JSON.parse(text)}));
    });
    req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
}

test('API consulta a fonte, bloqueia gravação sem autorização e não expõe arquivos',async()=>{
  let reads=0;
  const server=createApp({fetchCongregations:async()=>{reads++;return list;},writesAvailable:false});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const first=await request(server,'/api/state');
    assert.equal(first.status,200);assert.equal(first.json().paymentsAvailable,false);assert.deepEqual(first.json().payments,[]);
    assert.equal(first.json().firstCongregationId,9);
    await request(server,'/api/state');assert.equal(reads,2);
    assert.equal((await request(server,'/api/payment',{method:'POST',body:{key:'2026-10',paid:true}})).status,503);
    assert.equal((await request(server,'/api/payment',{method:'POST',origin:'https://outro-site.example',body:{}})).status,403);
    assert.equal((await request(server,'/api/state',{host:'outro-site.example'})).status,403);
    assert.equal((await request(server,'/.env')).status,404);
    assert.equal((await request(server,'/server.mjs')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('API com Google configurado só confirma gravações confirmadas pelo provedor',async()=>{
  const calls=[];
  const google=async(action,body)=>{
    calls.push(action);
    if(action==='getPayments')throw new Error('Google indisponível');
    return {key:body.key,paid:body.paid};
  };
  const server=createApp({fetchCongregations:async()=>list,writesAvailable:true,google});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const state=(await request(server,'/api/state')).json();
    assert.equal(state.congregations.length,19);assert.equal(state.paymentsAvailable,false);assert.equal(state.writesAvailable,false);assert.match(state.paymentError,/indisponível/);
    const body={key:'2026-10',paid:true,requestId:'12345678-1234-1234-1234-123456789abc'};
    assert.equal((await request(server,'/api/payment',{method:'POST',body:{...body,paid:'true'}})).status,400);
    const saved=await request(server,'/api/payment',{method:'POST',body});
    assert.equal(saved.status,200);assert.deepEqual(saved.json(),{key:'2026-10',paid:true});assert.deepEqual(calls,['getPayments','setPaid']);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
