(function () {
  const endpoint = 'https://script.google.com/macros/s/AKfycbzeMbRWhmLhulO4x5BjjB_Z0t_706AgHTaBS4j4RLqWam_XHKHfCjdJqcXlcjjIftSR/exec';
  const clone = value => JSON.parse(JSON.stringify(value));
  const currency = value => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  function element(tag, className, text) {
    const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;
  }
  function safeImage(src) {
    return typeof src==='string' && (/^img\/[a-zA-Z0-9_.-]+$/.test(src) || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src) || /^https:\/\/[a-zA-Z0-9][a-zA-Z0-9.-]*(?::443)?(?:\/[^\s<>"\\]*)?$/.test(src));
  }
  function img(src,alt) {
    const image=element('img'); image.alt=alt;image.loading='lazy';image.referrerPolicy='no-referrer';
    if(safeImage(src))image.src=src;
    image.addEventListener('error',()=>{image.src='img/logoo.png.png';},{once:true});return image;
  }
  function setLines(node,text,highlight) {
    node.replaceChildren();
    text.split('\n').forEach((line,i,lines)=>{if(i)node.append(element('br'));node.append(highlight && i===lines.length-1?element('span','',line):document.createTextNode(line));});
  }
  function selectServices(select,content,other) {
    if(!select)return;
    const selected=select.value;
    select.replaceChildren(new Option('Escolha um serviço',''));
    content.services.concat(content.packages).forEach(item=>select.add(new Option(item.name+' · '+currency(item.price),item.name)));
    if(other)select.add(new Option('Outro','Outro'));
    select.value=selected;
  }
  function bookingLink(name,label) {
    const a=element('a','service-select',label||'AGENDAR SERVIÇO ↗');a.href='#bookingForm';
    a.addEventListener('click',()=>{document.getElementById('service').value=name;document.getElementById('name').focus({preventScroll:true});});
    return a;
  }
  function render(content,revision,preview) {
    const hero=document.querySelector('.hero h1');if(!hero)return;
    setLines(hero,content.heroTitle,true);
    document.querySelector('.hero .lead').textContent=content.heroText;
    setLines(document.querySelector('#about h2'),content.aboutTitle);
    document.querySelectorAll('#about .col-lg-6:last-child > p:not(.section-tag)').forEach((p,i)=>{p.textContent=content.aboutText[i]||'';});
    const hours=document.querySelector('.booking-card ul');hours.replaceChildren();
    content.hours.forEach(h=>{const li=element('li');li.append(element('span','',h.day),element('strong','',h.time));hours.append(li);});
    const services=document.querySelector('#services .row');services.replaceChildren();
    content.services.forEach(s=>{
      const col=element('div','col-md-6 col-lg-4'),card=element('div','service-card'),body=element('div','service-body'),meta=element('div','service-meta');
      meta.append(element('span','',s.duration),element('strong','',currency(s.price)));
      body.append(element('h3','',s.name),element('p','',s.description),meta,bookingLink(s.name));
      card.append(img(s.image,s.name),body);col.append(card);services.append(col);
    });
    const packages=document.querySelector('#pricing .row');packages.replaceChildren();
    document.getElementById('pricing').hidden=!content.packages.length;
    content.packages.forEach(p=>{
      const col=element('div','col-md-4'),card=element('div','price-card'+(p.featured?' featured':''));
      if(p.featured)card.append(element('span','badge','Mais procurado'));
      const list=element('ul');p.features.forEach(f=>list.append(element('li','',f)));
      const link=bookingLink(p.name,'Escolher plano');link.className='btn '+(p.featured?'btn-primary':'btn-outline-primary');
      card.append(element('h3','',p.name),element('div','price',currency(p.price)),list,link);col.append(card);packages.append(col);
    });
    const gallery=document.querySelector('.gallery-grid');gallery.replaceChildren();
    document.getElementById('gallery').hidden=!content.gallery.length;
    content.gallery.forEach(g=>{const col=element('div','col-6 col-md-4');const image=img(g.src,g.alt);image.className='img-fluid';col.append(image);gallery.append(col);});
    selectServices(document.getElementById('service'),content);
    renderPromo(content.promotion,revision,preview);
  }
  function renderPromo(promo,revision,preview) {
    document.getElementById('sitePromotion')?.remove();
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const date=['year','month','day'].map(type=>today.find(p=>p.type===type).value).join('-');
    if(!promo.enabled || (!preview && ((promo.start && date<promo.start)||(promo.end && date>promo.end))))return;
    const key='fullpackage-promo-'+JSON.stringify(promo);
    try{if(!preview && sessionStorage.getItem(key))return;}catch(_){}
    const dialog=element('dialog','site-promotion');dialog.id='sitePromotion';dialog.setAttribute('aria-labelledby','promotionTitle');
    const close=element('button','promo-close','×');close.type='button';close.setAttribute('aria-label','Fechar promoção');
    const title=element('h2','',promo.title);title.id='promotionTitle';
    const link=element('a','btn btn-primary',promo.button);link.href='#bookingForm';
    const dismiss=()=>{dialog.close();try{if(!preview)sessionStorage.setItem(key,'1');}catch(_){}};
    close.addEventListener('click',dismiss);link.addEventListener('click',dismiss);dialog.addEventListener('cancel',()=>{try{if(!preview)sessionStorage.setItem(key,'1');}catch(_){}});
    dialog.append(close,element('p','section-tag','FULL PACKAGE · PROMOÇÃO'),title,element('p','promo-text',promo.text),link);document.body.append(dialog);
    if(preview){dialog.showModal();return;}
    // Avoid interrupting someone already filling out a booking.
    if(!document.querySelector('dialog[open]') && !document.getElementById('bookingForm').contains(document.activeElement))dialog.showModal();
  }
  async function load() {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getSiteContent'}),signal:controller.signal});
      if(!response.ok)throw Error('Content unavailable');
      const data=await response.json();
      if(!data.ok || data.apiVersion<4)throw Error('Content update pending');
      return {content:data.content||clone(window.SITE_DEFAULTS),revision:data.revision};
    }finally{clearTimeout(timeout);}
  }
  window.BarberSite={render,load,selectServices,safeImage,clone};
  document.addEventListener('DOMContentLoaded',async()=>{
    if(!document.querySelector('.hero h1'))return;
    const preview=new URLSearchParams(location.search).has('preview');
    render(clone(window.SITE_DEFAULTS),null,false);
    if(preview && window.parent!==window){
      const banner=element('div','preview-banner','PRÉVIA · alterações ainda não publicadas');document.body.prepend(banner);
      document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();},true);
      window.addEventListener('message',e=>{
        if(e.source===window.parent && e.origin===location.origin && e.data?.type==='barber-preview')render(e.data.content,'preview',true);
      });
      window.parent.postMessage({type:'barber-preview-ready'},location.origin==='null'?'*':location.origin);
      return;
    }
    try {const site=await load();render(site.content,site.revision,false);}catch(_){/* Keep the bundled website available during backend outages. */}
  });
})();
