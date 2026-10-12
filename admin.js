const RESERVATIONS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw5CUgGI4QOFa5w_ni8_7DRLNPVIHI5aO_O1OBTIClFaNpkFQ5AqIaZrL-x12xTxI0w/exec';
const $ = id => document.getElementById(id);
const labels = { pending: 'Pendente', approved: 'Aprovada', completed: 'Concluída', cancelled: 'Cancelada', no_show: 'Não compareceu' };
const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
let adminKey = sessionStorage.getItem('fullPacakageAdminKey') || '';
let bookings = [], apiVersion = 0, busy = false, editingId = null, timer;
let pendingChange = null;
const message = (text, error = false) => {
  if($('walkInDialog').open) { $('walkInError').textContent=text; $('walkInError').classList.toggle('d-none',!error); }
  $('businessMessage').textContent = text;
  $('businessMessage').className = 'alert ' + (error ? 'alert-danger' : 'alert-success');
  if ($('changeDialog').open) { $('changeError').textContent = text; $('changeError').classList.toggle('d-none', !error); }
  if ($('completeDialog').open) { $('completeError').textContent = text; $('completeError').classList.toggle('d-none', !error); }
};
function localMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return parts.find(p => p.type === 'year').value + '-' + parts.find(p => p.type === 'month').value;
}

function summarize(rows) {
  const reservations=rows.filter(b=>b.source!=='walk_in');
  const completed=rows.filter(b=>b.status==='completed');
  const bookedCompleted=completed.filter(b=>b.source!=='walk_in');
  const walkIns=completed.filter(b=>b.source==='walk_in');
  const sum=items=>items.reduce((n,b)=>n+Math.round(Number(b.amountPaid||0)*100),0)/100;
  const revenue=sum(completed);
  return {total:reservations.length,completed:completed.length,bookedCompleted:bookedCompleted.length,walkIns:walkIns.length,revenue,bookedRevenue:sum(bookedCompleted),walkInRevenue:sum(walkIns),conversion:reservations.length?bookedCompleted.length/reservations.length*100:0,average:completed.length?revenue/completed.length:0};
}
function render() {
  const rows = bookings.filter(b => $('period').value === 'all' || String(b.date).slice(0, 7) === localMonth());
  const stats = summarize(rows);
  $('totalMetric').textContent = stats.total;
  $('completedMetric').textContent = stats.completed;
  $('completedBreakdown').textContent = stats.bookedCompleted+' com reserva · '+stats.walkIns+' sem agendamento';
  $('revenueBreakdown').textContent = 'Com reserva: '+money(stats.bookedRevenue)+' · Sem agendamento: '+money(stats.walkInRevenue);
  $('conversionMetric').textContent = stats.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  $('revenueMetric').textContent = money(stats.revenue);
  $('averageMetric').textContent = 'Ticket médio: ' + money(stats.average);
  $('pendingMetric').textContent = rows.filter(b => ['pending', 'approved'].includes(b.status)).length + ' aguardando atendimento';
  const groups = new Map();
  rows.forEach(b => { const name = b.service || 'Sem serviço'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(b); });
  $('serviceSummary').innerHTML = [...groups].map(([name, items]) => {
    const s = summarize(items);
    return '<tr><td>' + escapeHtml(name) + '</td><td>' + s.total + '</td><td>' + s.completed + '</td><td>' + s.conversion.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%</td><td>' + money(s.revenue) + '</td></tr>';
  }).join('') || '<tr><td colspan="5">Nenhum resultado neste período.</td></tr>';
  const visible = rows.filter(b => (!b.archivedAt || $('showArchived').checked) && ($('statusFilter').value === 'all' || b.status === $('statusFilter').value));
  $('listCount').textContent = '(' + visible.length + ')';
  $('reservationsBody').innerHTML = visible.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(b => {
    const locked = busy || b.id == null || String(b.id).trim() === '' || !!b.archivedAt;
    const button = (action, label) => '<button type=button class="btn btn-sm btn-outline-light" data-action="' + action + '" data-id="' + escapeHtml(b.id) + '" ' + (locked || (apiVersion < 2 && !['approved', 'cancelled'].includes(action)) ? 'disabled' : '') + '>' + label + '</button>';
    const date = String(b.date || '').slice(0, 10).split('-').reverse().join('/');
    return '<tr><td>' + escapeHtml(b.name) + '<br><small>' + (b.source==='walk_in'?'Sem agendamento · ':'') + escapeHtml(b.phone) + '</small></td><td>' + escapeHtml(b.service) + '</td><td>' + escapeHtml(date) + '<br>' + escapeHtml(b.time) + '</td><td>' + escapeHtml(b.notes) + '</td><td>' + escapeHtml(labels[b.status] || 'Pendente') + (b.archivedAt ? ' · Arquivada' : '') + '</td><td>' + (b.status === 'completed' ? money(b.amountPaid) : '—') + '</td><td><div class="actions">' + (b.status === 'completed' ? button('complete', 'Editar valor') + (b.source==='walk_in'?button('cancelled', 'Anular'):button('pending', 'Reabrir')) : b.source==='walk_in' ? button('complete', 'Restaurar atendimento') : button('complete', 'Concluir') + (b.status !== 'approved' ? button('approved', 'Aprovar') : '') + (b.status !== 'cancelled' ? button('cancelled', 'Cancelar') : '') + (b.status !== 'no_show' ? button('no_show', 'Faltou') : '')) + '</div></td></tr>';
  }).join('') || '<tr><td colspan="7">Nenhuma reserva nesta lista.</td></tr>';
  const columnLabels = ['Cliente', 'Serviço', 'Data / hora', 'Observações', 'Status', 'Recebido', 'Ações'];
  $('reservationsBody').querySelectorAll('tr').forEach(row => { if(row.cells.length === 7) Array.from(row.cells).forEach((cell,index) => cell.dataset.label = columnLabels[index]); });
  $('clearHistoryButton').disabled = busy || apiVersion < 2 || !bookings.some(b => !b.archivedAt && ['completed', 'cancelled', 'no_show'].includes(b.status));
  $('walkInButton').disabled=busy;
  $('walkInSubmit').disabled=busy||apiVersion<3;
  $('walkInClose').disabled=busy;
  $('refreshButton').disabled = busy;
  $('completeSubmit').disabled = busy;
  $('confirmChange').disabled = busy;
  $('completeSubmit').textContent = busy ? 'Salvando…' : 'Salvar atendimento';
}
function requiresUpgrade(action, values = {}) { if(action==='createWalkIn') return apiVersion<3; return apiVersion < 2 && !(action === 'updateStatus' && ['approved', 'cancelled'].includes(values.status)); }
async function request(action, extra = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(RESERVATIONS_ENDPOINT, { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...extra, action, adminKey }) });
    if (!response.ok) throw new Error('Erro HTTP ' + response.status + '. Verifique a implantação do Google Apps Script.');
    const data = await response.json();
    if (!data.ok) {
      const error = new Error(data.error || 'Resposta inválida do servidor.');
      error.denied = data.error === 'Acesso negado';
      throw error;
    }
    return data;
  } finally { clearTimeout(timeout); }
}
function reportError(error) {
  if (error.denied) logout();
  if (error.name === 'AbortError') { message('O servidor demorou mais de 20 segundos. Atualize antes de repetir; a alteração pode já ter sido salva.', true); return; }
  message(error instanceof TypeError ? 'Falha na conexão. A operação pode não ter sido confirmada; atualize antes de tentar novamente.' : error instanceof SyntaxError ? 'Resposta inválida. Verifique a implantação do Google Apps Script.' : error.message, true);
}
async function refresh() {
  const data = await request('list');
  bookings = data.bookings || [];
  apiVersion = Number(data.apiVersion || 1);
  $('accessCard').classList.add('d-none');
  $('dashboard').classList.remove('d-none');
  $('toolbar').classList.remove('d-none');
  sessionStorage.setItem('fullPacakageAdminKey', adminKey);
  render();
  $('backendNotice').classList.toggle('d-none', apiVersion >= 2);
  $('backendVersion').textContent = 'Servidor: versão ' + apiVersion;
  $('clearHistoryButton').title = apiVersion < 2 ? 'Atualize a implantação para preservar os indicadores ao arquivar.' : 'Disponível quando houver reservas concluídas, canceladas ou faltas.';
}
async function load() {
  if (busy) return;
  busy = true; render();
  try { await refresh(); } catch (error) { reportError(error); }
  finally { busy = false; render(); }
}
async function mutate(action, values, success) {
  if (busy) return;
  if (requiresUpgrade(action, values)) { message('Esta ação exige a nova implantação do Google Apps Script.', true); return; }
  busy = true; render();
  let saved = false;
  try {
    await request(action, values);
    saved = true;
    if(action==='createWalkIn') $('walkInDialog').close();
    $('completeDialog').close();
    $('changeDialog').close();
    message(success);
    await refresh();
  } catch (error) {
    if (saved) message(success + ' A lista não pôde ser atualizada. Clique em Atualizar.', true);
    else reportError(error);
  } finally { busy = false; render(); }
}
function logout() {
  $('walkInDialog').close();
  adminKey = ''; bookings = []; apiVersion = 0; sessionStorage.removeItem('fullPacakageAdminKey'); clearInterval(timer);
  $('accessForm').reset(); $('accessCard').classList.remove('d-none'); $('dashboard').classList.add('d-none'); $('toolbar').classList.add('d-none'); $('completeDialog').close();
}
function startRefresh() {
  clearInterval(timer);
  timer = setInterval(() => { if (adminKey && !document.hidden && !$('completeDialog').open && !$('changeDialog').open && !$('walkInDialog').open) load(); }, 30000);
}
$('accessForm').addEventListener('submit', async event => {
  event.preventDefault();
  adminKey = new FormData($('accessForm')).get('adminKey').toString().trim();
  $('businessMessage').classList.add('d-none');
  await load(); if (adminKey) startRefresh();
});
$('logoutButton').addEventListener('click', logout);
$('refreshButton').addEventListener('click', () => load());
['period', 'statusFilter', 'showArchived'].forEach(id => $(id).addEventListener('change', render));
$('reservationsBody').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || button.disabled || busy) return;
  const booking = bookings.find(b => String(b.id) === button.dataset.id);
  if (!booking) return;
  if (button.dataset.action === 'complete') {
    editingId = booking.id;
    $('completeError').classList.add('d-none');
    $('completeDescription').textContent = booking.name + ' · ' + booking.service;
    $('completeTitle').textContent = booking.status === 'completed' ? 'Editar valor recebido' : 'Concluir atendimento';
    $('amountPaid').value = booking.status === 'completed' ? Number(booking.amountPaid || 0).toFixed(2).replace('.', ',') : '';
    $('completeDialog').showModal(); $('amountPaid').focus();
  } else {
    const status = button.dataset.action;
    pendingChange = { id: booking.id, status };
    $('changeDescription').textContent = 'Alterar a reserva de ' + booking.name + ' para ' + labels[status] + '?' + (booking.status === 'completed' ? (booking.source==='walk_in' ? ' Anular retira este atendimento e seu valor dos indicadores.' : ' Reabrir remove este atendimento e seu valor dos indicadores de serviços concluídos.') : '');
    $('changeError').classList.add('d-none');
    $('changeDialog').showModal();
  }
});
$('completeForm').addEventListener('submit', event => {
  event.preventDefault();
  const raw = $('amountPaid').value.trim();
  const amount = /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) { message('Informe um valor entre 0 e 100000, com até duas casas decimais. Exemplo: 35,50.', true); return; }
  mutate('updateStatus', { id: editingId, status: 'completed', amountPaid: amount }, 'Atendimento concluído e receita registrada.');
});
$('closeComplete').addEventListener('click', () => $('completeDialog').close());
$('clearHistoryButton').addEventListener('click', () => {
  if (!confirm('Arquivar TODAS as reservas concluídas, canceladas e faltas, de todos os períodos? Elas sairão da lista, mas continuarão nos indicadores e em Mostrar arquivados. Reservas pendentes e aprovadas serão mantidas.')) return;
  mutate('archiveHistory', {}, 'Histórico arquivado. Os indicadores foram preservados.');
});
$('confirmChange').addEventListener('click', () => { if(pendingChange) mutate('updateStatus', pendingChange, 'Reserva atualizada.'); });
$('cancelChange').addEventListener('click', () => $('changeDialog').close());
if (adminKey) { load(); startRefresh(); }


let walkInRetry = null;
function shopToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  return ['year','month','day'].map(key=>parts.find(p=>p.type===key).value).join('-');
}
$('walkInButton').addEventListener('click', () => {
  if(busy) return;
  $('walkInForm').reset();
  walkInRetry = null;
  $('walkInDate').value = shopToday();
  $('walkInDate').max = shopToday();
  $('walkInError').classList.add('d-none');
  $('walkInUpgrade').classList.toggle('d-none',apiVersion>=3);
  $('walkInSubmit').disabled = apiVersion<3;
  $('walkInDialog').showModal();
  $('walkInName').focus();
});
$('walkInClose').addEventListener('click', () => { if(!busy) $('walkInDialog').close(); });
$('walkInDialog').addEventListener('cancel', event => { if(busy) event.preventDefault(); });
$('walkInForm').addEventListener('submit', async event => {
  event.preventDefault();
  if(busy || apiVersion<3 || !$('walkInForm').reportValidity()) return;
  const values = Object.fromEntries(new FormData($('walkInForm')));
  const raw = values.amountPaid.trim();
  const amount = /^\d+(?:[.,]\d{1,2})?$/.test(raw) ? Number(raw.replace(',','.')) : NaN;
  if(!Number.isFinite(amount) || amount<0 || amount>100000) { message('Informe um valor de 0 a 100000, com até duas casas decimais.',true); return; }
  values.amountPaid = amount;
  const fingerprint = JSON.stringify(values);
  if(!walkInRetry || walkInRetry.fingerprint!==fingerprint) {
    walkInRetry = {fingerprint,id:window.crypto?.randomUUID ? window.crypto.randomUUID() : Date.now()+'-'+Math.random().toString(16).slice(2)};
  }
  await mutate('createWalkIn',{...values,id:walkInRetry.id},'Atendimento sem agendamento registrado. Receita atualizada.');
});
