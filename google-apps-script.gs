const SHEET_ID = '1s7M4Ps75RqNpEIkDBLcJflQiUOzcuT_IaY-jHzpzuGQ';
const BOOKING_HEADERS = ['id', 'createdAt', 'updatedAt', 'status', 'name', 'phone', 'service', 'date', 'time', 'notes', 'amountPaid', 'completedAt', 'archivedAt', 'source'];
const STATUSES = ['pending', 'approved', 'completed', 'cancelled', 'no_show'];
function setupSheet() { return getBookingSheet(); }
function setUpSheet() { return getBookingSheet(); }
function getBookingSheet() {
  const book = SpreadsheetApp.openById(SHEET_ID);
  const sheet = book.getSheetByName('Bookings') || book.insertSheet('Bookings');
  if (!sheet.getLastRow()) sheet.appendRow(BOOKING_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  // Append missing columns without reordering or overwriting existing data.
  BOOKING_HEADERS.forEach(name => {
    if (!headers.includes(name)) {
      headers.push(name);
      sheet.getRange(1, headers.length).setValue(name);
    }
  });
  return sheet;
}
function normalizeStatus(value) {
  return STATUSES.includes(String(value)) ? String(value) : 'pending';
}
function getBookings() {
  const sheet = getBookingSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.filter(row => row.some(value => value !== '')).map(row => {
    const booking = Object.fromEntries(headers.map((key, i) => [key, row[i] == null ? '' : row[i]]));
    booking.status = normalizeStatus(booking.status);
    if (booking.date instanceof Date) booking.date = Utilities.formatDate(booking.date, 'America/Sao_Paulo', 'yyyy-MM-dd');
    if (booking.time instanceof Date) booking.time = Utilities.formatDate(booking.time, 'America/Sao_Paulo', 'HH:mm');
    return booking;
  });
}
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return jsonResponse({ok:false, error:'Método não permitido'}); }
function doPost(e) {
  let lock;
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const adminActions = ['list', 'updateStatus', 'archiveHistory', 'clearHistory', 'createWalkIn', 'saveSiteContent'];
    if (adminActions.includes(payload.action)) {
      const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
      if (!expected || payload.adminKey !== expected) return jsonResponse({ok:false, error:'Acesso negado'});
    }
    if (payload.action === 'clearHistory') {
      return jsonResponse({ok:false, error:'Atualize o painel e use Arquivar histórico. Exclusão permanente desativada para preservar os relatórios.'});
    }
    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    if (payload.action === 'getSiteContent') { const site=siteContentRead_(); return jsonResponse({ok:true,apiVersion:4,revision:site.revision,content:site.content}); }
    if (payload.action === 'saveSiteContent') return siteContentSave_(payload);
    if (payload.action === 'list') {
      return jsonResponse({ok:true, apiVersion:4, bookings:getBookings()});
    }
    if (payload.action === 'createWalkIn') {
      const site=siteContentRead_().content;
      const services = site ? site.services.concat(site.packages).map(item=>item.name).concat('Outro') : ['Corte Clássico','Pezinho de cabelo','Sobrelheca feminina','Aparar Barba','Corte personalizado','Fade & Taper','Essencial','Signature','Executivo','Outro'];
      const date = String(payload.date || '');
      const parsed = new Date(date + 'T12:00:00Z');
      const today = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
      if (!services.includes(payload.service) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date || date > today ||
          typeof payload.amountPaid !== 'number' || !Number.isFinite(payload.amountPaid) || payload.amountPaid < 0 || payload.amountPaid > 100000 ||
          typeof payload.id !== 'string' || !/^[a-zA-Z0-9-]{10,100}$/.test(payload.id)) {
        return jsonResponse({ok:false,error:'Confira serviço, data (até hoje) e valor recebido entre R$ 0 e R$ 100.000.'});
      }
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const previous = rows.slice(1).find(row => String(row[headers.indexOf('id')]) === payload.id);
      if (previous) return jsonResponse({ok:previous[headers.indexOf('source')] === 'walk_in', error:'Identificador já utilizado'});
      const now = new Date().toISOString();
      const clean = value => {
        const text = String(value || '').trim().slice(0,2000);
        return /^[=+@-]/.test(text) ? "'" + text : text;
      };
      const booking = {
        id:payload.id,source:'walk_in',status:'completed',createdAt:now,updatedAt:now,completedAt:now,
        name:clean(payload.name) || 'Cliente avulso',phone:clean(payload.phone),
        service:payload.service,date,time:'',notes:clean(payload.notes),
        amountPaid:Math.round(payload.amountPaid*100)/100,archivedAt:''
      };
      sheet.appendRow(headers.map(key => booking[key] == null ? '' : booking[key]));
      return jsonResponse({ok:true,id:booking.id});
    }

    if (payload.action === 'updateStatus') {
      if (!payload.id || !STATUSES.includes(payload.status)) return jsonResponse({ok:false,error:'Reserva ou status inválido'});
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const index = rows.findIndex((row, i) => i > 0 && String(row[headers.indexOf('id')]) === String(payload.id));
      if (index < 1) return jsonResponse({ok:false,error:'Reserva não encontrada'});
      const row = rows[index];
      if(row[headers.indexOf('source')] === 'walk_in' && !['completed','cancelled'].includes(payload.status)) return jsonResponse({ok:false,error:'Atendimento avulso deve ser concluído ou anulado.'});
      if (row[headers.indexOf('archivedAt')]) return jsonResponse({ok:false,error:'Restaure o histórico antes de editar esta reserva.'});
      let amount = '';
      if (payload.status === 'completed') {
        if (typeof payload.amountPaid !== 'number' || !Number.isFinite(payload.amountPaid) || payload.amountPaid < 0 || payload.amountPaid > 100000) {
          return jsonResponse({ok:false,error:'Informe um valor recebido válido entre R$ 0 e R$ 100.000.'});
        }
        amount = Math.round(payload.amountPaid * 100) / 100;
      }
      const now = new Date().toISOString();
      row[headers.indexOf('status')] = payload.status;
      row[headers.indexOf('updatedAt')] = now;
      row[headers.indexOf('amountPaid')] = amount;
      row[headers.indexOf('completedAt')] = payload.status === 'completed' ? (row[headers.indexOf('completedAt')] || now) : '';
      sheet.getRange(index + 1, 1, 1, headers.length).setValues([row]);
      return jsonResponse({ok:true});
    }
    if (payload.action === 'archiveHistory') {
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      let count = 0;
      const now = new Date().toISOString();
      for (let i = 1; i < rows.length; i++) {
        if (['completed','cancelled','no_show'].includes(rows[i][headers.indexOf('status')]) && !rows[i][headers.indexOf('archivedAt')]) {
          rows[i][headers.indexOf('archivedAt')] = now;
          count++;
        }
      }
      if (count) sheet.getRange(2, 1, rows.length - 1, headers.length).setValues(rows.slice(1));
      return jsonResponse({ok:true, count});
    }
    if (payload.action === 'save' || (!payload.action && payload.name && payload.phone)) {
      if (!['name','phone','service','date','time'].every(key => typeof payload[key] === 'string' && payload[key].trim())) {
        return jsonResponse({ok:false,error:'Preencha os campos obrigatórios'});
      }
      const sheet = getBookingSheet();
      const rows = sheet.getDataRange().getValues();
      const headers = rows[0].map(String);
      const id = String(payload.id || Utilities.getUuid());
      if (rows.slice(1).some(row => String(row[headers.indexOf('id')]) === id)) return jsonResponse({ok:true});
      const now = new Date().toISOString();
      // Public submissions cannot set revenue, completed status, or archival fields.
      const booking = {id,createdAt:now,updatedAt:now,status:'pending',source:'reservation'};
      ['name','phone','service','date','time','notes'].forEach(key => {
        const value = String(payload[key] || '').slice(0,2000);
        booking[key] = /^[=+@-]/.test(value) ? "'" + value : value;
      });
      sheet.appendRow(headers.map(key => booking[key] == null ? '' : booking[key]));
      return jsonResponse({ok:true});
    }
    return jsonResponse({ok:false,error:'Ação inválida'});
  } catch (error) {
    return jsonResponse({ok:false,error:error.safeMessage || 'Não foi possível processar a solicitação. Verifique a implantação e as permissões da planilha.'});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

// Website content is stored separately from bookings. Only validated content is public.
function siteContentRead_() {
  const raw = PropertiesService.getScriptProperties().getProperty('SITE_CONTENT_POINTER');
  if (!raw) return {revision:null,content:null};
  const pointer = JSON.parse(raw);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName('WebsiteContent');
  if (!sheet) throw new Error('Content sheet missing');
  const chunks = sheet.getRange(pointer.row, 3, pointer.count, 1).getValues();
  const content = JSON.parse(chunks.map(row => String(row[0]).slice(5)).join(''));
  return {revision:pointer.revision,updatedAt:pointer.updatedAt,requestId:pointer.requestId,content};
}
function siteContentInvalid_(message) {
  const error = new Error(message);
  error.safeMessage = message;
  throw error;
}
function validateSiteContent_(input) {
  if (!input || typeof input !== 'object') siteContentInvalid_('Conteúdo inválido.');
  const text = (value, max, label, required) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) siteContentInvalid_('Confira '+label+'.');
    return value.trim();
  };
  const array = (value, min, max, label) => {
    if (!Array.isArray(value) || value.length < min || value.length > max) siteContentInvalid_('Confira '+label+'.');
    return value;
  };
  const price = value => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000) siteContentInvalid_('Preço inválido.');
    return Math.round(value*100)/100;
  };
  const image = value => {
    if (typeof value !== 'string' || value.length > 220000) siteContentInvalid_('Imagem muito grande ou inválida.');
    if (/^img\/[a-zA-Z0-9_.-]+$/.test(value) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value;
    if (value.length <= 2048 && /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(?::443)?(?:\/[^\s<>"\\]*)?$/.test(value)) return value;
    siteContentInvalid_('Use uma imagem enviada ou um endereço HTTPS válido.');
  };
  const identity = value => {
    if(typeof value!=='string' || !/^[a-zA-Z0-9-]{1,60}$/.test(value)) siteContentInvalid_('Identificador inválido.');
    return value;
  };
  const content = {
    heroTitle:text(input.heroTitle,150,'título principal',true),
    heroText:text(input.heroText,600,'texto principal',true),
    aboutTitle:text(input.aboutTitle,150,'título sobre nós',true),
    aboutText:array(input.aboutText,2,2,'textos sobre nós').map(v=>text(v,1500,'texto sobre nós',true)),
    hours:array(input.hours,1,7,'horários').map(v=>({day:text(v.day,40,'dia',true),time:text(v.time,60,'horário',true)})),
    services:array(input.services,1,12,'serviços').map(v=>({id:identity(v.id),name:text(v.name,80,'nome do serviço',true),description:text(v.description,400,'descrição',false),duration:text(v.duration,40,'duração',false),price:price(v.price),image:image(v.image)})),
    packages:array(input.packages,0,6,'pacotes').map(v=>({id:identity(v.id),name:text(v.name,80,'nome do pacote',true),price:price(v.price),features:array(v.features,1,6,'itens do pacote').map(s=>text(s,150,'item do pacote',true)),featured:v.featured===true})),
    gallery:array(input.gallery,0,12,'galeria').map(v=>({src:image(v.src),alt:text(v.alt,200,'descrição da imagem',true)}))
  };
  const names=content.services.concat(content.packages).map(v=>v.name.toLowerCase());
  const ids=content.services.concat(content.packages).map(v=>v.id);
  if(new Set(names).size!==names.length || new Set(ids).size!==ids.length) siteContentInvalid_('Use nomes e identificadores diferentes para serviços e pacotes.');
  const promo = input.promotion || {};
  const day = value => {
    if(value==='') return '';
    if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) siteContentInvalid_('Data da promoção inválida.');
    return value;
  };
  content.promotion={enabled:promo.enabled===true,title:text(promo.title,100,'título da promoção',promo.enabled===true),text:text(promo.text,600,'texto da promoção',promo.enabled===true),button:text(promo.button,40,'botão da promoção',true),start:day(promo.start),end:day(promo.end)};
  if(content.promotion.start && content.promotion.end && content.promotion.start>content.promotion.end) siteContentInvalid_('O fim da promoção deve ser posterior ao início.');
  if(JSON.stringify(content).length>3000000) siteContentInvalid_('Limite de conteúdo atingido. Remova ou reduza algumas imagens.');
  return content;
}
function siteContentSave_(payload) {
  if(typeof payload.requestId!=='string' || !/^[a-zA-Z0-9-]{10,100}$/.test(payload.requestId)) siteContentInvalid_('Solicitação inválida.');
  const current=siteContentRead_();
  if(current.requestId===payload.requestId) return jsonResponse({ok:true,revision:current.revision,content:current.content});
  if((payload.baseRevision || null)!==current.revision) return jsonResponse({ok:false,error:'O site foi alterado em outra sessão. Recarregue o editor antes de publicar.',conflict:true});
  const content=validateSiteContent_(payload.content);
  const serialized=JSON.stringify(content),revision=Utilities.getUuid(),updatedAt=new Date().toISOString();
  const book=SpreadsheetApp.openById(SHEET_ID);
  const sheet=book.getSheetByName('WebsiteContent') || book.insertSheet('WebsiteContent');
  if(!sheet.getLastRow()) sheet.appendRow(['Revision','Part','Payload']);
  const row=sheet.getLastRow()+1, parts=[];
  for(let i=0;i<serialized.length;i+=40000) parts.push([revision,parts.length,'json:'+serialized.slice(i,i+40000)]);
  const requiredRows=row+parts.length-1;
  if(sheet.getMaxRows()<requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(),requiredRows-sheet.getMaxRows());
  // Switch the pointer only after the full snapshot has been written.
  sheet.getRange(row,1,parts.length,3).setValues(parts);
  PropertiesService.getScriptProperties().setProperty('SITE_CONTENT_POINTER',JSON.stringify({revision,updatedAt,requestId:payload.requestId,row,count:parts.length}));
  return jsonResponse({ok:true,revision,updatedAt,content});
}

