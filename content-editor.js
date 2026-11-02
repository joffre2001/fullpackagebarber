(function () {
  const byId=id=>document.getElementById(id);
  let draft=null,revision=null,tab='general',dirty=false,working=false,ready=false,publishAttempt=null;
  const status=(text,error)=>{byId('editorStatus').textContent=text;byId('editorStatus').className='editor-status '+(error?'text-danger':'help');};
  function lock(value) {
    working=value;
    ['editorPublish','editorReload','editorPreviewButton','editorClose'].forEach(id=>byId(id).disabled=value || (id==='editorPublish' && !ready));
    byId('editorFields').querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=value);
    byId('editorPublish').textContent=value?'Aguarde…':'Publicar alterações';
  }
  function change() {dirty=true;publishAttempt=null;status('Alterações ainda não publicadas.');}
  function node(tag,cls,text) {const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el;}
  function button(text,fn) {const el=node('button','btn btn-outline-light',text);el.type='button';el.addEventListener('click',fn);return el;}
  function field(parent,label,value,update,options={}) {
    const wrap=node('label',options.full?'editor-full':'',label);
    const el=node(options.area?'textarea':'input','form-control');
    if(!options.area)el.type=options.type||'text';
    if(options.money)el.inputMode='decimal';
    el.value=value;el.maxLength=options.max||600;
    if(options.area)el.rows=3;
    el.addEventListener('input',()=>{update(options.money ? Number(el.value.trim().replace(',','.')) : el.value);change();});
    wrap.append(el);parent.append(wrap);return el;
  }
  function checkbox(parent,label,value,update) {
    const wrap=node('label','d-flex gap-2 align-items-center',label),input=node('input');input.type='checkbox';input.checked=value;
    input.addEventListener('change',()=>{update(input.checked);change();});wrap.prepend(input);parent.append(wrap);
  }
  async function upload(file) {
    if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>15*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 15 MB.');
    const url=URL.createObjectURL(file),image=new Image();
    try {
      image.src=url;await image.decode();
      if(!image.width || !image.height || image.width*image.height>60000000)throw Error('A imagem é grande demais. Use uma foto menor.');
      const ratio=Math.min(1,1200/image.width,1200/image.height),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let result;
      for(const quality of [.82,.68,.5,.35]) {result=canvas.toDataURL('image/jpeg',quality);if(result.length<=220000)return result;}
      throw Error('A foto ficou muito grande. Recorte a imagem ou escolha uma versão menor.');
    } finally {URL.revokeObjectURL(url);}
  }
  function imageField(parent,label,src,update) {
    const wrap=node('div','editor-full'),preview=node('img');preview.alt='Prévia da imagem';
    if(BarberSite.safeImage(src))preview.src=src;
    preview.addEventListener('error',()=>{preview.alt='Imagem indisponível';});
    wrap.append(node('p','help',label),preview);
    const fileLabel=node('label','','Enviar foto (JPG, PNG ou WebP)');
    const file=node('input','form-control');file.type='file';file.accept='image/jpeg,image/png,image/webp';
    file.addEventListener('change',async()=>{
      if(!file.files[0])return;
      lock(true);status('Preparando imagem…');
      try{const data=await upload(file.files[0]);update(data);preview.src=data;change();}catch(e){status(e.message,true);}finally{lock(false);}
    });
    fileLabel.append(file);wrap.append(fileLabel);
    const urlInput=field(wrap,'Ou cole o endereço HTTPS de uma imagem',src.startsWith('data:')?'':src,value=>{
      if(BarberSite.safeImage(value)){update(value);preview.src=value;}else status('Endereço inválido. Use HTTPS. A imagem anterior foi mantida.',true);
    },{max:2048});
    urlInput.addEventListener('input',()=>urlInput.setCustomValidity(urlInput.value && !BarberSite.safeImage(urlInput.value)?'Use um endereço HTTPS válido.':''));
    parent.append(wrap);
  }
  const id=prefix=>prefix+'-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
  function controls(parent,items,index,min) {
    const bar=node('div','editor-controls');
    if(index>0)bar.append(button('↑ Mover para cima',()=>{[items[index-1],items[index]]=[items[index],items[index-1]];change();render();}));
    if(index<items.length-1)bar.append(button('↓ Mover para baixo',()=>{[items[index+1],items[index]]=[items[index],items[index+1]];change();render();}));
    bar.append(button('Remover',()=>{if(items.length<=min){status('Mantenha pelo menos '+min+' item.',true);return;}items.splice(index,1);change();render();}));
    parent.append(bar);
  }
  function render() {
    const root=byId('editorFields');root.replaceChildren();if(!draft)return;
    byId('siteEditor').querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
    if(tab==='general'){
      const grid=node('div','editor-grid');
      field(grid,'Título principal (uma linha por trecho)',draft.heroTitle,v=>draft.heroTitle=v,{area:true,max:150});
      field(grid,'Texto de apresentação',draft.heroText,v=>draft.heroText=v,{area:true});
      field(grid,'Título “Sobre nós”',draft.aboutTitle,v=>draft.aboutTitle=v,{area:true,max:150});
      draft.aboutText.forEach((v,i)=>field(grid,'Sobre nós — parágrafo '+(i+1),v,text=>draft.aboutText[i]=text,{area:true,max:1500}));
      root.append(grid,node('h3','h5 mt-4','Horários exibidos no site'));
      root.append(node('p','help','Estes textos informam o horário de funcionamento. A grade de horários do agendamento permanece como está.'));
      draft.hours.forEach((h,i)=>{const card=node('div','editor-item'),g=node('div','editor-grid');field(g,'Dias',h.day,v=>h.day=v,{max:40});field(g,'Horário',h.time,v=>h.time=v,{max:60});card.append(g);controls(card,draft.hours,i,1);root.append(card);});
      if(draft.hours.length<7)root.append(button('Adicionar horário',()=>{draft.hours.push({day:'Novo dia',time:'09:00 - 18:00'});change();render();}));
    }
    if(tab==='services'){
      root.append(node('p','help','Os preços são exibidos no site e no formulário. Pagamentos já registrados não são alterados.'));
      draft.services.forEach((s,i)=>{
        const card=node('article','editor-item'),grid=node('div','editor-grid');card.append(node('h3','',s.name));
        field(grid,'Nome',s.name,v=>s.name=v,{max:80});field(grid,'Preço (R$)',s.price,v=>s.price=v,{money:true});
        field(grid,'Descrição',s.description,v=>s.description=v,{area:true,max:400});field(grid,'Duração (ex.: 30 min)',s.duration,v=>s.duration=v,{max:40});
        imageField(grid,'Foto do serviço',s.image,v=>s.image=v);card.append(grid);controls(card,draft.services,i,1);root.append(card);
      });
      if(draft.services.length<12)root.append(button('Adicionar serviço',()=>{draft.services.push({id:id('service'),name:'Novo serviço',description:'',duration:'',price:0,image:'img/image3.png.png'});change();render();}));
    }
    if(tab==='packages'){
      draft.packages.forEach((p,i)=>{
        const card=node('article','editor-item'),grid=node('div','editor-grid');card.append(node('h3','',p.name));
        field(grid,'Nome',p.name,v=>p.name=v,{max:80});field(grid,'Preço (R$)',p.price,v=>p.price=v,{money:true});
        field(grid,'O que inclui (um item por linha)',p.features.join('\n'),v=>p.features=v.split('\n').map(s=>s.trim()).filter(Boolean),{area:true,full:true,max:900});
        checkbox(grid,'Destacar como mais procurado',p.featured,v=>p.featured=v);card.append(grid);controls(card,draft.packages,i,0);root.append(card);
      });
      if(draft.packages.length<6)root.append(button('Adicionar pacote',()=>{draft.packages.push({id:id('package'),name:'Novo pacote',price:0,features:['Serviços incluídos'],featured:false});change();render();}));
    }
    if(tab==='gallery'){
      root.append(node('p','help','Até 12 imagens. As fotos enviadas são otimizadas antes de salvar. Adicione uma descrição para acessibilidade.'));
      draft.gallery.forEach((g,i)=>{
        const card=node('article','editor-item');imageField(card,'Imagem '+(i+1),g.src,v=>g.src=v);
        field(card,'Descrição da imagem',g.alt,v=>g.alt=v,{max:200});controls(card,draft.gallery,i,0);root.append(card);
      });
      if(draft.gallery.length<12)root.append(button('Adicionar imagem',()=>{draft.gallery.push({src:'img/image1.png.png',alt:'Novo trabalho da barbearia'});change();render();}));
    }
    if(tab==='promotion'){
      const p=draft.promotion,g=node('div','editor-grid');
      checkbox(g,'Exibir pop-up promocional',p.enabled,v=>p.enabled=v);
      field(g,'Título',p.title,v=>p.title=v,{max:100});field(g,'Mensagem',p.text,v=>p.text=v,{area:true,full:true,max:600});
      field(g,'Texto do botão de agendamento',p.button,v=>p.button=v,{max:40});
      field(g,'Começa em (opcional)',p.start,v=>p.start=v,{type:'date'});
      field(g,'Termina em (opcional)',p.end,v=>p.end=v,{type:'date'});
      root.append(g,node('p','help mt-3','O botão leva ao formulário de agendamento. A promoção aparece uma vez por sessão, dentro das datas definidas (horário de São Paulo). A prévia mostra a promoção mesmo fora dessas datas. Desative e publique para removê-la.'));
    }
    lock(working);
  }
  async function read() {
    lock(true);status('Carregando conteúdo publicado…');
    try {
      const data=await request('getSiteContent');
      if(data.apiVersion<4)throw Error('Publique a versão 4 de google-apps-script.gs para ativar o editor.');
      draft=BarberSite.clone(data.content||SITE_DEFAULTS);revision=data.revision||null;dirty=false;ready=true;publishAttempt=null;
      render();status('Conteúdo carregado. As alterações só aparecem no site após publicar.');
    } catch(e) {
      ready=false;
      if(!draft)draft=BarberSite.clone(SITE_DEFAULTS);
      render();status('Não foi possível carregar o editor. Publique a versão 4 do Google Apps Script e tente recarregar. '+e.message,true);
    } finally {lock(false);}
  }
  function closeEditor() {
    if(working)return;
    if(dirty && !confirm('Descartar as alterações que ainda não foram publicadas?'))return;
    byId('siteEditor').close();draft=null;dirty=false;
  }
  byId('editSiteButton').addEventListener('click',()=>{if(busy)return;byId('siteEditor').showModal();read();});
  byId('editorClose').addEventListener('click',closeEditor);
  byId('siteEditor').addEventListener('cancel',e=>{e.preventDefault();closeEditor();});
  byId('editorReload').addEventListener('click',()=>{if(dirty && !confirm('Descartar alterações e carregar a última publicação?'))return;read();});
  byId('siteEditor').querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{if(working)return;tab=b.dataset.tab;render();}));
  byId('editorPublish').addEventListener('click',async()=>{
    if(working||!ready)return;
    for(const input of byId('editorFields').querySelectorAll('input,textarea'))if(!input.reportValidity())return;
    lock(true);status('Publicando… mantenha esta janela aberta.');
    try{
      if(!publishAttempt)publishAttempt=id('publish');
      const result=await request('saveSiteContent',{content:draft,baseRevision:revision,requestId:publishAttempt});
      revision=result.revision;draft=BarberSite.clone(result.content);dirty=false;publishAttempt=null;
      BarberSite.selectServices(byId('walkInService'),draft,true);
      status('Publicado! As alterações aparecerão na próxima abertura ou atualização do site.');
    }catch(e){status(e.name==='AbortError'?'A resposta demorou. Tente publicar novamente sem alterar os campos para confirmar o envio.':e.message,true);}
    finally{lock(false);}
  });
  const sendPreview=()=>{const frame=byId('previewFrame');frame.contentWindow?.postMessage({type:'barber-preview',content:draft},location.origin==='null'?'*':location.origin);};
  byId('editorPreviewButton').addEventListener('click',()=>{byId('editorPreview').showModal();byId('previewFrame').src='index.html?preview=1';});
  window.addEventListener('message',e=>{if(e.source===byId('previewFrame').contentWindow && e.origin===location.origin && e.data?.type==='barber-preview-ready')sendPreview();});
  byId('previewClose').addEventListener('click',()=>{byId('editorPreview').close();byId('previewFrame').removeAttribute('src');});
  byId('previewSize').addEventListener('click',()=>{const p=byId('editorPreview');p.dataset.mobile=String(p.dataset.mobile!=='true');byId('previewSize').textContent=p.dataset.mobile==='true'?'Ver no computador':'Ver no celular';});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.SiteEditor={close:()=>{byId('editorPreview').close();byId('siteEditor').close();dirty=false;draft=null;}};
  BarberSite.selectServices(byId('walkInService'),SITE_DEFAULTS,true);
  BarberSite.load().then(site=>BarberSite.selectServices(byId('walkInService'),site.content,true)).catch(()=>{});
})();

