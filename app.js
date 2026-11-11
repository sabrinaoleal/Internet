'use strict';
const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const dateParts = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric'}).formatToParts(new Date());
const today = {year:Number(dateParts.find(p=>p.type==='year').value),month:Number(dateParts.find(p=>p.type==='month').value)-1};
const $ = id => document.getElementById(id);
const keyFor = (year,month) => `${year}-${String(month+1).padStart(2,'0')}`;
const escapeHTML = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let state=null, selectedYear=Math.max(2026,today.year), selectedPayment, busy=false, loading=false, stale=false, toastTimer;
const payments = new Map();
const initialsFor = name => name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();

async function api(path,body){
  const response=await fetch(path,{cache:'no-store',signal:AbortSignal.timeout(55000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  let result;
  try{result=await response.json();}catch{throw new Error('Abra o programa pelo arquivo iniciar.cmd e tente novamente.');}
  if(!response.ok)throw new Error(result.error||'Não foi possível confirmar a operação. Atualize antes de tentar novamente.');
  return result;
}

function responsible(year,month){
  if(!state||keyFor(year,month)<state.startMonth)return null;
  const saved=payments.get(keyFor(year,month));
  if(saved?.congregationName)return saved.congregationName;
  const [startYear,startMonth]=state.startMonth.split('-').map(Number);
  const offset=(year-startYear)*12+month+1-startMonth;
  const first=state.congregations.findIndex(item=>item.id===state.firstCongregationId);
  return state.congregations[(first+offset)%state.congregations.length].name;
}

function statusHTML(key){
  const paid=payments.get(key)?.paid===true;
  return `<span class="pill ${paid?'paid':'pending'}"><span class="symbol" aria-hidden="true">${paid?'✓':'×'}</span>${paid?'Confirmado':'Pendente'}</span>`;
}

function render(){
  const name=responsible(today.year,today.month);
  $('current-name').textContent=name||(state?'Rodízio ainda não iniciado':'Sem conexão com a planilha');
  $('current-month').textContent=`${monthNames[today.month]} de ${today.year}`;
  $('selected-year').textContent=selectedYear;
  $('previous-year').disabled=selectedYear<=2026;
  $('share-year-label').textContent=`Enviar ${today.year} no WhatsApp`;
  $('share-year').setAttribute('aria-label',`Enviar ${today.year} no WhatsApp`);
  $('share-year').title=`Enviar ${today.year} no WhatsApp`;
  $('share-year').disabled=!state||stale||loading||busy;
  $('months').innerHTML=monthNames.map((name,month)=>{
    const congregation=responsible(selectedYear,month),key=keyFor(selectedYear,month);
    if(!congregation)return '';
    const current=selectedYear===today.year&&month===today.month;
    return `<tr class="${current?'is-current':''}"><td><div class="month-cell"><span class="month-tile" aria-hidden="true"><span class="month-number">${String(month+1).padStart(2,'0')}</span><span class="month-short">${name.slice(0,3).toUpperCase()}</span></span><div><span class="month-name">${name}</span><span class="month-year">${selectedYear}</span>${current?'<span class="month-tag">Mês atual</span>':''}</div></div></td><td><div class="congregation-cell"><span class="congregation-avatar" aria-hidden="true">${escapeHTML(initialsFor(congregation))}</span><span class="congregation-text">${escapeHTML(congregation)}</span></div></td><td>${statusHTML(key)}</td><td><button class="button details-button" data-month="${month}" aria-label="Abrir pagamento de ${name} de ${selectedYear}">Detalhes <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15 15 5M5 5h10v10"/></svg></button></td></tr>`;
  }).join('');
}

function canWrite(){return Boolean(state?.writesAvailable&&!stale&&!loading&&!busy);}
function renderDialog(){
  if(!selectedPayment)return;
  const {year,month}=selectedPayment,key=keyFor(year,month),record=payments.get(key)||{paid:false};
  $('dialog-month').textContent=`${monthNames[month]} de ${year}`;
  $('dialog-congregation').textContent=responsible(year,month);
  $('dialog-status').innerHTML=statusHTML(key);
  $('toggle-paid').textContent=record.paid?'Marcar como pendente':'Confirmar pagamento';
  $('toggle-paid').classList.toggle('primary',!record.paid);
  $('toggle-paid').disabled=!canWrite();$('choose-receipt').disabled=!canWrite();
  $('receipt-description').textContent=record.receiptName?`Arquivo: ${record.receiptName}`:state?.paymentsAvailable?'Nenhum comprovante anexado.':'Os comprovantes ainda não puderam ser consultados.';
  $('receipt-file').value='';
  $('choose-receipt').textContent=record.receiptName?'Trocar comprovante':'Escolher comprovante';
  const validURL=typeof record.receiptURL==='string'&&/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(record.receiptURL);
  $('receipt-link').hidden=!validURL;
  if(validURL)$('receipt-link').href=record.receiptURL;else $('receipt-link').removeAttribute('href');
  $('local-note').textContent=stale?'Atualize a página antes de alterar um pagamento.':state?.writesAvailable?'O pagamento será salvo na planilha e o comprovante no Google Drive. Anexar um arquivo não marca o pagamento como pago.':'Falta autorizar a gravação na conta Google. Os botões serão liberados após a conexão.';
}

function feedback(message,error=false){$('dialog-feedback').textContent=message;$('dialog-feedback').className=error?'feedback error':'feedback';}
function showToast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4000);}
function setBusy(value){busy=value;$('close-dialog').disabled=value;$('refresh-data').disabled=value;$('share-year').disabled=!state||stale||loading||busy;renderDialog();}
function openPayment(year,month){selectedPayment={year,month};feedback('');renderDialog();$('payment-dialog').showModal();}

async function loadState(){
  if(loading||busy)return;
  loading=true;$('refresh-data').disabled=true;$('share-year').disabled=true;$('connection-status').textContent='Consultando a planilha…';renderDialog();
  try{
    if(location.protocol==='file:')throw new Error('Para conectar à planilha, abra iniciar.cmd e acesse http://127.0.0.1:4173.');
    const next=await api('/api/state');
    if(!Array.isArray(next.congregations)||next.congregations.length!==19||next.congregations.findIndex(item=>item.id===next.firstCongregationId)<0)throw new Error('A lista de congregações retornada está incompleta.');
    state=next;stale=false;payments.clear();
    for(const record of next.payments)payments.set(record.key,record);
    $('connection-status').textContent=`Planilha conectada · ${next.congregations.length} congregações`;
    $('storage-warning').hidden=Boolean(next.paymentsAvailable);
    $('storage-warning').textContent=next.paymentError?'Os nomes foram carregados, mas os pagamentos não puderam ser consultados. Clique em Atualizar para tentar novamente.':'Os nomes já vêm da planilha. Falta autorizar a conta Google para consultar e salvar pagamentos e comprovantes.';
  }catch(error){
    stale=true;$('connection-status').textContent='Não foi possível atualizar a planilha';$('storage-warning').hidden=false;
    $('storage-warning').textContent=(state?'Os nomes exibidos são da última consulta. ':'')+(error.name==='TimeoutError'?'A conexão demorou demais. Clique em Atualizar para tentar novamente.':error.message);
  }finally{loading=false;$('refresh-data').disabled=false;render();renderDialog();}
}

async function saveChange(path,body){
  setBusy(true);feedback('Salvando no Google…');
  try{
    const record=await api(path,{...body,requestId:crypto.randomUUID()});
    if(record.key!==body.key||typeof record.paid!=='boolean')throw new Error('O Google não confirmou os dados salvos.');
    payments.set(record.key,record);render();renderDialog();feedback('Salvo na sua conta Google.');showToast(path==='/api/receipt'?'Comprovante anexado ao mês escolhido.':'Pagamento atualizado.');
  }catch(error){
    stale=true;render();renderDialog();feedback('Não foi possível confirmar o salvamento. Feche esta janela e clique em Atualizar antes de tentar novamente.',true);
  }finally{setBusy(false);}
}

function annualMessage(){
  const year=today.year;
  const lines=[`*PAGAMENTO DE INTERNET — ${year}*`,''];
  if(!state?.paymentsAvailable)lines.push('Pagamentos aguardam consulta ao Google. Pendente = ainda sem confirmação no programa.','');
  for(let month=0;month<12;month++){
    const congregation=responsible(year,month);
    if(!congregation)continue;
    const paid=payments.get(keyFor(year,month))?.paid===true;
    lines.push(`*${monthNames[month]}* — ${congregation.replace(/[\r\n]+/g,' ')}`,`${paid?'🟢 Confirmado':'🔴 Pendente'}`,'');
  }
  if(state?.fetchedAt){
    const date=new Date(state.fetchedAt);
    if(!Number.isNaN(date.getTime()))lines.push(`Consulta: ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(date)}.`);
  }
  return lines.join('\n').trim();
}

$('share-year').addEventListener('click',()=>{
  if(!state||stale||loading||busy)return;
  const message=annualMessage();
  $('share-title').textContent=`Enviar informações de ${today.year}`;
  $('share-message').value=message;
  $('open-whatsapp').href=`https://wa.me/?text=${encodeURIComponent(message)}`;
  $('share-dialog').showModal();
});
$('close-share').addEventListener('click',()=>$('share-dialog').close());
$('cancel-share').addEventListener('click',()=>$('share-dialog').close());
$('refresh-data').addEventListener('click',loadState);
$('previous-year').addEventListener('click',()=>{if(selectedYear>2026){selectedYear--;render();}});
$('next-year').addEventListener('click',()=>{selectedYear++;render();});
$('months').addEventListener('click',event=>{const button=event.target.closest('button[data-month]');if(button)openPayment(selectedYear,Number(button.dataset.month));});
$('close-dialog').addEventListener('click',()=>$('payment-dialog').close());
$('payment-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('toggle-paid').addEventListener('click',()=>{
  if(!canWrite())return;
  const key=keyFor(selectedPayment.year,selectedPayment.month);
  saveChange('/api/payment',{key,paid:!(payments.get(key)?.paid===true)});
});
$('choose-receipt').addEventListener('click',()=>{if(canWrite())$('receipt-file').click();});
$('receipt-file').addEventListener('change',async()=>{
  const file=$('receipt-file').files[0];if(!file||!canWrite())return;
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024||file.size===0){feedback('Escolha um PDF, JPG, PNG ou WebP de até 10 MB, com conteúdo.',true);$('receipt-file').value='';return;}
  const key=keyFor(selectedPayment.year,selectedPayment.month);
  setBusy(true);feedback('Preparando comprovante…');
  try{
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
    // Mantém a janela travada durante a leitura e o envio, para não trocar o mês.
    await saveChange('/api/receipt',{key,file:{name:file.name,type:file.type,base64}});
  }catch{feedback('Não foi possível ler o comprovante. Escolha o arquivo novamente.',true);}
  finally{setBusy(false);}
});
loadState();
