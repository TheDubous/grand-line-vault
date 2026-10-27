/* Grand Line Vault v1.0.0 — One Piece TCG collection + deck planner.
   Local-first data with optional user-owned Supabase cloud sync. */
(() => {
  'use strict';

  const KEY = 'grand-line-vault-v1';
  const SOURCE = 'https://cdn.jsdelivr.net/gh/michalkiral/optcg-data@main/data/index/cards_by_id.json';
  const SOURCE_BACKUP = 'https://raw.githubusercontent.com/michalkiral/optcg-data/main/data/index/cards_by_id.json';
  const IMG_BASE = 'https://en.onepiece-cardgame.com/images/cardlist/card/';
  const app = document.querySelector('#app');
  const modalLayer = document.querySelector('#modalLayer');
  const catalogStatus = document.querySelector('#catalogStatus');
  const toasts = document.querySelector('#toast');
  const views = new Set(['dashboard', 'catalog', 'inventory', 'locations', 'scan', 'decks', 'cloud']);
  const DEFAULT_LOCATION_ID = 'unsorted';
  const MAX_QTY = 999999;
  const dateNow = () => new Date().toISOString();
  const baseCardId = value => String(value || '').trim().toUpperCase().replace(/_(?:P|R)\d+$/i, '');
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeId = value => String(value ?? '').trim().toUpperCase().replace(/\s/g, '').replace(/_P(\d+)$/, (_,n) => `_p${n}`);
  const validId = value => /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/.test(value);
  const qtyValue = value => { const n = Number(value); return Number.isSafeInteger(n) && n >= 1 && n <= MAX_QTY ? n : null; };
  const imageUrl = id => validId(id) ? IMG_BASE + encodeURIComponent(id) + '.png' : '';
  const fmt = value => Number(value || 0).toLocaleString('en-US');

  function initialData() {
    return {
      version: 1,
      decks: [],
      presets: [],
      locations: [
        {id: 'unsorted', name: 'Unsorted', kind: 'Box', note: 'Cards waiting to be organized.'},
        {id: 'box-1', name: 'Box 1', kind: 'Box', note: ''},
        {id: 'box-2', name: 'Box 2', kind: 'Box', note: ''},
        {id: 'box-3', name: 'Box 3', kind: 'Box', note: ''},
      ],
      entries: []
    };
  }

  function normalizeData(input) {
    if (!input || typeof input !== 'object' || !Array.isArray(input.locations) || !Array.isArray(input.entries)) {
      throw new Error('This is not a Grand Line Vault backup.');
    }
    if (input.locations.length > 5000 || input.entries.length > 100000) throw new Error('Backup is too large.');
    const locs = []; const seenLocs = new Set();
    for (const l of input.locations) {
      if (!l || typeof l !== 'object' || !String(l.id || '').trim()) continue;
      const id = String(l.id).slice(0, 100);
      if (seenLocs.has(id)) continue;
      seenLocs.add(id);
      locs.push({ id, name: String(l.name || 'Unnamed location').slice(0, 100), kind: String(l.kind || 'Box').slice(0, 40), note: String(l.note || '').slice(0, 500) });
    }
    if (!seenLocs.has(DEFAULT_LOCATION_ID)) locs.unshift({id:'unsorted', name:'Unsorted', kind:'Box', note:'Cards waiting to be organized.'});
    const entries = []; const unique = new Map();
    for (const e of input.entries) {
      if (!e || typeof e !== 'object') continue;
      const cardId = safeId(e.cardId); const qty = qtyValue(e.qty);
      if (!validId(cardId) || qty === null) continue;
      const locationId = seenLocs.has(String(e.locationId)) ? String(e.locationId) : DEFAULT_LOCATION_ID;
      const slot = String(e.slot || '').slice(0, 100).trim();
      const name = String(e.name || cardId).slice(0, 150);
      const rarity = String(e.rarity || '').slice(0, 45);
      const colors = String(e.colors || '').slice(0, 100);
      const note = String(e.note || '').slice(0, 1000);
      const key = `${cardId}\u0000${locationId}\u0000${slot.toLowerCase()}`;
      if (unique.has(key)) {
        const existing = unique.get(key);
        existing.qty = Math.min(MAX_QTY, existing.qty + qty);
      } else {
        const entry = {id: String(e.id || uid()).slice(0, 100), cardId, name, rarity, colors, qty, locationId, slot, note, updatedAt:String(e.updatedAt || dateNow()).slice(0, 60)};
        entries.push(entry); unique.set(key, entry);
      }
    }
    // A deck is a saved list of base card IDs, separate from the physical printing and position.
    // Keep the localStorage key stable across future app upgrades to preserve collections.
    const decks=[]; const seenDecks=new Set();
    for(const d of (Array.isArray(input.decks)?input.decks:[]).slice(0,1000)) {
      if(!d || typeof d!=='object')continue;
      const id=String(d.id||uid()).slice(0,100); if(seenDecks.has(id))continue;seenDecks.add(id);
      const cards=[];const byBase=new Map();
      for(const c of (Array.isArray(d.cards)?d.cards:[]).slice(0,100)){
        const cardId=baseCardId(c.cardId);const qty=Number(c.qty);
        if(!validId(cardId)||!Number.isInteger(qty)||qty<1||qty>4)continue;
        byBase.set(cardId,Math.min(4,(byBase.get(cardId)||0)+qty));
      }
      for(const [cardId,qty] of byBase)cards.push({cardId,qty});
      const leaderId=baseCardId(d.leaderId||'');
      decks.push({id,name:String(d.name||'Unnamed deck').slice(0,100),leaderId:validId(leaderId)?leaderId:'',cards,reserved:Boolean(d.reserved),createdAt:String(d.createdAt||dateNow()).slice(0,60),updatedAt:String(d.updatedAt||dateNow()).slice(0,60)});
    }
    const presets=[];const seenPresets=new Set();
    for(const p of (Array.isArray(input.presets)?input.presets:[]).slice(0,100)){
      if(!p||typeof p!=='object')continue;
      const id=String(p.id||uid()).slice(0,100);
      if(seenPresets.has(id))continue;seenPresets.add(id);
      const f=p.filters||{};
      const safeFilters={effect:String(f.effect||'').slice(0,300),effectMode:['all','any','phrase'].includes(f.effectMode)?f.effectMode:'all',effectTarget:['both','effect','trigger'].includes(f.effectTarget)?f.effectTarget:'both',trait:String(f.trait||'').slice(0,300),traitMode:f.traitMode==='all'?'all':'any',category:String(f.category||'all').slice(0,50),rarity:String(f.rarity||'all').slice(0,50),attribute:String(f.attribute||'all').slice(0,50),counter:String(f.counter||'all').slice(0,50),powerMin:String(f.powerMin||'').slice(0,15),powerMax:String(f.powerMax||'').slice(0,15),costs:Array.isArray(f.costs)?f.costs.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<100):[],ownedOnly:Boolean(f.ownedOnly),sort:String(f.sort||'id'),hideVariants:Boolean(f.hideVariants)};
      presets.push({id,name:String(p.name||'Unnamed preset').slice(0,80),query:String(p.query||'').slice(0,100),color:String(p.color||'all').slice(0,20),set:String(p.set||'all').slice(0,25),filters:safeFilters});
    }
    return {version:1,locations:locs,entries,decks,presets};
  }

  function loadData() {
    try { const raw=localStorage.getItem(KEY); return raw ? normalizeData(JSON.parse(raw)) : initialData(); }
    catch (err) { console.warn('Cannot load saved collection:', err); return initialData(); }
  }
  const scanner = {stream:null,worker:null,workerLoading:null,scriptLoading:null,busy:false,session:0,lastLocationId:'unsorted',lastSlot:'',saved:0};
  const state = {view:'dashboard', data:loadData(), catalog:[], loaded:false, catalogError:'', query:'', color:'all', set:'all', perPage:48, inventoryQuery:'', inventoryLocation:'all', activeDeckId:'', filters: {effect:'',effectMode:'all',effectTarget:'both',trait:'',traitMode:'any',category:'all',rarity:'all',attribute:'all',counter:'all',powerMin:'',powerMax:'',costs:new Set(),ownedOnly:false,sort:'id',hideVariants:false}};
  const CLOUD_KEY = 'grand-line-vault-cloud-settings-v1';
  const sync = {client:null,user:null,revision:null,ready:false,busy:false,timer:null,connecting:false,lastStatus:'Local only',config:null};
  const isEmptyCollection = data => !data.entries.length && !data.decks.length && !(data.presets||[]).length;
  function syncStatus(message) {sync.lastStatus=message;const el=document.querySelector('#cloudState');if(el)el.textContent=message;}
  function scheduleCloudSave(){
    if(!sync.ready||!sync.user)return;
    clearTimeout(sync.timer);sync.timer=setTimeout(()=>sendCloudSave(),1200);
    syncStatus('Changes saved locally · cloud sync pending');
  }
  async function sendCloudSave(){
    if(!sync.ready||!sync.user||sync.busy)return;
    sync.busy=true;
    const payload=JSON.parse(JSON.stringify(state.data));
    const expected=sync.revision;
    try{
      const {data,error}=await sync.client.rpc('save_shared_vault',{p_document:payload,p_expected_revision:expected});
      if(error)throw error;
      sync.revision=Number(data);
      syncStatus('Shared vault synced · revision '+sync.revision);
      // Changes made during the request must also be written.
      if(JSON.stringify(state.data)!==JSON.stringify(payload))scheduleCloudSave();
    } catch(err){
      sync.ready=false;
      syncStatus('Sync paused: '+(err.message||'conflict')+' · local edits are safe');
      toast('Cloud sync paused. Open Cloud settings to resolve it. Your local changes remain saved.',true);
    } finally {sync.busy=false;}
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state.data));scheduleCloudSave(); return true; }
    catch (err) {toast('Could not save in this browser. Export a backup and check storage settings.',true);return false;}
  }
  function toast(message, error = false) {
    toasts.textContent=message; toasts.className=error ? 'show error' : 'show';
    clearTimeout(toast.timeout); toast.timeout=setTimeout(()=>{toasts.className='';},3900);
  }
  const locationById = id => state.data.locations.find(l=>l.id===id);
  const allQty = () => state.data.entries.reduce((n,e)=>n+e.qty,0);
  const uniqueCards = () => new Set(state.data.entries.map(e=>e.cardId)).size;
  const qtyFor = cardId => state.data.entries.reduce((n,e)=>n+(e.cardId===cardId?e.qty:0),0);
  const entryCounts = id => state.data.entries.filter(e=>e.locationId===id).reduce((n,e)=>n+e.qty,0);
  const locationOptions = (selected = '') => state.data.locations.map(l=>`<option value="${escapeHtml(l.id)}" ${l.id===selected?'selected':''}>${escapeHtml(l.name)}</option>`).join('');
  const friendlyDate = value => { try {return new Intl.DateTimeFormat('en', {month:'short',day:'numeric',year:'numeric'}).format(new Date(value));} catch { return '—'; } };
  const setFrom = id => id.replace(/_p\d+$/i,'').split('-')[0] || 'Other';
  const cardName = card => (card && card.name) || (card && card.id) || 'Unknown card';
  const badgeColor = str => `<span class="badge">${escapeHtml(str || 'Unknown')}</span>`;
  const fallbackCards = [
    {id:'OP05-002', name:'Belo Betty', rarity:'Leader', colors:'Red / Yellow', category:'Leader', types:['Revolutionary Army'],effect:'',cost:null,counter:null,attributes:[]},
    {id:'OP01-001', name:'Roronoa Zoro', rarity:'Leader', colors:'Red', category:'Leader', types:['Supernovas','Straw Hat Crew'],effect:'',cost:null,counter:null,attributes:[]}
  ];

  function render() {
    document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===state.view));
    if (state.view==='scan') app.innerHTML=scanView();
    else if (state.view==='catalog') app.innerHTML = catalogView();
    else if (state.view==='inventory') app.innerHTML=inventoryView();
    else if (state.view==='locations') app.innerHTML=locationsView();
    else if (state.view==='decks') app.innerHTML=decksView();
    else if (state.view==='cloud') app.innerHTML=cloudView();
    else app.innerHTML=dashboardView();
    if(state.view==='catalog')paintCatalog();
    if(state.view==='decks')paintDeckPool();
  }
  const pageHeading = (label,title,description,button='') => `<div class="headerline"><div><div class="overline">${escapeHtml(label)}</div><h1>${escapeHtml(title)}</h1><p class="subhead">${escapeHtml(description)}</p></div>${button}</div>`;
  const empty = (icon,title,description,button='') => `<div class="empty"><div class="empty-icon">${icon}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${button}</div>`;
  const pill = (id) => `<span class="location-pill">${escapeHtml(locationById(id)?.name || 'Unsorted')}</span>`;
  const miniImg = (id) => `<img class="card-mini" loading="lazy" src="${imageUrl(id)}" alt=""/>`;
  const cardMeta = card => [card.rarity,card.colors || ''].filter(Boolean).join(' · ') || card.category || 'One Piece TCG';


  // Camera access requires HTTPS (such as GitHub Pages) or localhost; photo import is the fallback.
  function scanView() {
    return pageHeading('FAST COLLECTION ENTRY','Scan with your phone','Point your camera at a physical One Piece TCG card. We read its printed card ID using on-device text recognition.',`<button class="button btn-outline" data-view="inventory" type="button">View inventory →</button>`)+
    `<div class="scanner-layout"><section class="panel scanner-panel">
      <div class="scan-preview" id="scanPreview"><video id="scanVideo" autoplay playsinline muted></video><div class="scan-placeholder" id="scanPlaceholder"><span class="scan-camera-icon">◎</span><strong>Your camera appears here</strong><small>For best results, hold the whole card steady, with the card number clearly visible near its bottom edge.</small></div><div class="scan-outline" aria-hidden="true"><div class="scan-bottom-highlight"></div></div></div>
      <div class="scanner-controls"><button class="button btn-primary" type="button" id="scanStart" data-action="start-camera">◎ Start rear camera</button><button class="button btn-primary" type="button" id="scanCapture" data-action="capture-card" disabled>▣ Capture & recognize</button><button class="button btn-ghost" type="button" id="scanStop" data-action="stop-camera" disabled>Stop</button></div>
      <label class="photo-import button btn-outline">↥ Take / upload photo<input id="scanPhoto" type="file" accept="image/*" capture="environment" /></label>
      <p class="scan-status" id="scanStatus" role="status" aria-live="polite">Tap Start rear camera, or use your phone's camera/photo picker. Allow camera access when prompted.</p>
      <p class="hint">The image is processed on this device and is not uploaded to us. First-time OCR needs an internet connection to load its recognition engine. Photo access works even when live camera permission is unavailable.</p>
    </section><section class="panel scanner-result-panel"><div class="scanner-result-top"><h3>Identify and store</h3><span class="location-pill">Saved this session: <strong id="scanSaved">${fmt(scanner.saved)}</strong></span></div><div id="scanResult">${empty('▤','No scan yet','Capture a card to detect its ID, review the match and choose where it lives.')}</div></section></div>`;
  }
  const isCardCode = id => /^(?:(?:OP|ST|EB|PRB)\d{1,3}-\d{2,4}|P-\d{2,4})(?:_p\d+)?$/i.test(id);
  function detectPrintedIds(text) {
    const result=[];
    const clean=String(text||'').toUpperCase().replace(/[‐‑–—]/g,'-').replace(/\r/g,' ');
    const normalizeNum=x=>x.replace(/[OQD]/g,'0').replace(/[IL|]/g,'1').replace(/S/g,'5').replace(/B/g,'8');
    const main=/(?:^|[^A-Z0-9])((?:[O0]P|ST|EB|PRB))\s*[- ]?\s*([0-9OQDILSB]{1,3})\s*[- ]\s*([0-9OQDILSB]{2,4})(?![0-9A-Z])/g;
    let m;
    while((m=main.exec(clean))!==null) {
      const p=m[1].replace(/^0P/,'OP'),set=normalizeNum(m[2]).padStart(2,'0'),number=normalizeNum(m[3]).padStart(3,'0');
      const id=`${p}${set}-${number}`;if(isCardCode(id)&&!result.includes(id))result.push(id);
    }
    const promo=/(?:^|[^A-Z0-9])P\s*-\s*([0-9OQDILSB]{2,4})(?![0-9A-Z])/g;
    while((m=promo.exec(clean))!==null){const id=`P-${normalizeNum(m[1]).padStart(3,'0')}`;if(!result.includes(id))result.push(id);}
    return result;
  }
  function setScanStatus(message) {const el=document.querySelector('#scanStatus');if(el)el.textContent=message;}
  function setScanResult(markup) {const el=document.querySelector('#scanResult');if(el)el.innerHTML=markup||empty('▤','Ready for the next card','Capture another card or choose another photo.');}
  function updateScanButtons() {
    if(state.view!=='scan')return;
    const ready=Boolean(scanner.stream)&&!scanner.busy;
    const capture=document.querySelector('#scanCapture'),start=document.querySelector('#scanStart'),stop=document.querySelector('#scanStop');
    if(capture)capture.disabled=!ready;
    if(start){start.disabled=scanner.busy||!!scanner.stream;start.textContent=scanner.stream?'Camera running':'◎ Start rear camera';}
    if(stop)stop.disabled=!scanner.stream;
    const picker=document.querySelector('#scanPhoto');if(picker)picker.disabled=scanner.busy;
  }
  function stopCamera(){
    const current=scanner.stream;scanner.stream=null;
    if(current)current.getTracks().forEach(track=>track.stop());
    const video=document.querySelector('#scanVideo');if(video)video.srcObject=null;
    const placeholder=document.querySelector('#scanPlaceholder');if(placeholder)placeholder.hidden=false;
    const preview=document.querySelector('#scanPreview');if(preview)preview.classList.remove('live');
  }
  async function startCamera(){
    if(scanner.stream||scanner.busy)return;
    if(!navigator.mediaDevices?.getUserMedia){setScanStatus('Live camera is not available here. Open the app at its GitHub Pages HTTPS address or choose Take / upload photo.');return;}
    const session=scanner.session;
    setScanStatus('Requesting permission for rear camera…');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
      if(session!==scanner.session||state.view!=='scan'){stream.getTracks().forEach(track=>track.stop());return;}
      scanner.stream=stream;
      const video=document.querySelector('#scanVideo');if(!video){stopCamera();return;}
      video.srcObject=stream;
      await video.play();
      if(session!==scanner.session){stopCamera();return;}
      document.querySelector('#scanPlaceholder').hidden=true;
      document.querySelector('#scanPreview').classList.add('live');
      setScanStatus('Camera is ready. Keep the bottom card code visible, then tap Capture & recognize.');
      updateScanButtons();
    }catch(err){stopCamera();setScanStatus('Could not start camera: '+(err.name==='NotAllowedError'?'permission denied. Allow camera in browser settings, or use Take / upload photo.':`${err.message || 'camera not available'}. You can still use a photo.`));updateScanButtons();}
  }
  function scaledCanvas(source,width,height,maxEdge=1800) {
    if(!width||!height)throw new Error('Image could not be decoded.');
    const scale=Math.min(1,maxEdge/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function captureCard(){
    if(scanner.busy||!scanner.stream)return;
    const video=document.querySelector('#scanVideo');
    if(!video||!video.videoWidth){setScanStatus('Camera is still warming up. Try again.');return;}
    await recognizeCanvas(scaledCanvas(video,video.videoWidth,video.videoHeight));
  }
  async function recognizePhoto(file){
    if(!file||scanner.busy)return;
    if(!file.type.startsWith('image/')){setScanStatus('Choose an image file.');return;}
    if(file.size>25*1024*1024){setScanStatus('Image is too large; please choose one smaller than 25 MB.');return;}
    const session=scanner.session;
    setScanStatus('Reading your photo…');
    let bitmap=null,objectUrl='';
    try {
      if(typeof createImageBitmap==='function') {
        // Some iOS photo formats cannot be decoded via createImageBitmap, but do
        // work as regular <img> elements. Fall back instead of rejecting them.
        try {bitmap=await createImageBitmap(file);} catch {bitmap=null;}
      }
      if(bitmap){
        if(session!==scanner.session)return;
        await recognizeCanvas(scaledCanvas(bitmap,bitmap.width,bitmap.height));
      } else {
        objectUrl=URL.createObjectURL(file);
        const img=new Image();img.src=objectUrl;
        if(img.decode) await img.decode();
        else await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('Cannot decode this photo format.'));});
        if(session!==scanner.session)return;
        await recognizeCanvas(scaledCanvas(img,img.naturalWidth,img.naturalHeight));
      }
    }catch(err){setScanStatus('Could not read image: '+err.message);}
    finally{bitmap?.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);}
  }
  function loadOcrScript(){
    if(window.Tesseract)return Promise.resolve();
    if(!scanner.scriptLoading)scanner.scriptLoading=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.async=true;
      script.onload=()=>resolve();script.onerror=()=>reject(new Error('Cannot download text-recognition library. Check your connection.'));
      document.head.appendChild(script);
    }).catch(err=>{scanner.scriptLoading=null;throw err;});
    return scanner.scriptLoading;
  }
  async function getOcrWorker(){
    if(scanner.worker)return scanner.worker;
    if(!scanner.workerLoading)scanner.workerLoading=(async()=>{
      await loadOcrScript();
      // Tesseract.js uses WebAssembly in your browser and downloads its English model once.
      const worker=await window.Tesseract.createWorker('eng',1,{logger:message=>{
        if(state.view==='scan'&&scanner.busy&&message.status==='loading language traineddata')setScanStatus('Loading language data for first scan…');
      }});
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      scanner.worker=worker;return worker;
    })().catch(err=>{scanner.workerLoading=null;throw err;});
    return scanner.workerLoading;
  }
  function bottomCrop(source){
    // A printed code is generally at the card's bottom. Include most of the lower frame,
    // then fall back to whole-frame OCR when the crop does not contain an ID.
    const crop=document.createElement('canvas');
    crop.width=source.width;crop.height=Math.round(source.height*.55);
    const ctx=crop.getContext('2d',{willReadFrequently:true});
    ctx.filter='grayscale(1) contrast(1.5)';
    ctx.drawImage(source,0,source.height-crop.height,source.width,crop.height,0,0,crop.width,crop.height);
    return crop;
  }
  async function recognizeCanvas(canvas){
    if(scanner.busy)return;
    scanner.busy=true;const session=scanner.session;updateScanButtons();
    setScanResult(`<div class="scan-working"><span class="scan-spinner"></span><h3>Recognizing card number…</h3><p>This can take longer on the first scan.</p></div>`);
    setScanStatus('Analyzing the bottom of the card…');
    try {
      const worker=await getOcrWorker();
      let first=await worker.recognize(bottomCrop(canvas));
      if(session!==scanner.session||state.view!=='scan')return;
      let candidates=detectPrintedIds(first.data.text);
      if(!candidates.length){setScanStatus('Looking for the card number in the whole photo…');const second=await worker.recognize(canvas);candidates=detectPrintedIds(second.data.text);}
      if(session!==scanner.session||state.view!=='scan')return;
      // Favor known IDs, while still allowing manually verified codes not in the dataset.
      candidates.sort((a,b)=>Number(Boolean(catalogCard(b)))-Number(Boolean(catalogCard(a))));
      renderScanMatch(candidates[0]||'',!candidates.length);
      setScanStatus(candidates.length?'Possible ID detected — verify it and choose the right printing before saving.':'No card ID found. Enter the code manually or take another picture with less glare.');
    }catch(err){if(session===scanner.session&&state.view==='scan'){renderScanMatch('',true);setScanStatus(`Recognition failed: ${err.message}. You can type the printed ID manually.`);}}
    finally{scanner.busy=false;updateScanButtons();}
  }
  function variantOptions(baseId) {
    if(!baseId)return [];
    const base=baseId.replace(/_p\d+$/i,'');
    return state.catalog.filter(c=>c.id===base||c.id.startsWith(`${base}_p`)).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  }
  function renderScanMatch(detectedId,manual=false) {
    const id=safeId(detectedId);const known=catalogCard(id);
    const variants=variantOptions(id);
    const defaultName=known?.name||id;
    setScanResult(`<form data-form="scan-add" class="scan-add-form"><div class="scan-match-label">${manual?'MANUAL VERIFICATION':'POSSIBLE CARD MATCH'}</div>
      <div class="scan-match-card"><img id="scanMatchImage" src="${imageUrl(id)}" alt="Card artwork preview"/><div><strong id="scanMatchName">${escapeHtml(defaultName||'Enter card ID')}</strong><span id="scanMatchMeta">${escapeHtml(known?cardMeta(known):'Check the card number below')}</span><small id="scanOwnedCount">${fmt(qtyFor(id))} copies owned</small></div></div>
      <div class="form-fields"><label>Printed card ID<input id="scanCardId" class="field" name="cardId" maxlength="40" required spellcheck="false" autocapitalize="characters" placeholder="OP05-015" value="${escapeHtml(id)}" /></label>
      <label id="scanVariantWrap" ${variants.length>1?'':'hidden'}>Printing / alternate artwork<select class="select" id="scanVariantSelect">${variants.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===id?'selected':''}>${escapeHtml(c.id)} · ${escapeHtml(c.name)}</option>`).join('')}</select></label>
      <label>Card name (editable for uncatalogued cards)<input class="field" id="scanCardName" name="name" maxlength="150" value="${escapeHtml(defaultName)}" placeholder="Name of the card" /></label>
      <div class="scan-fields-two"><label>Copies<input class="field" name="qty" type="number" min="1" max="${MAX_QTY}" value="1" required /></label><label>Storage location<select class="select" name="locationId">${locationOptions(scanner.lastLocationId)}</select></label></div>
      <label>Optional note / position<input class="field" name="slot" maxlength="100" value="${escapeHtml(scanner.lastSlot)}" placeholder="Optional" /></label></div>
      <p class="hint">When a foil or alternate art cannot be identified, try a different photo or choose the printing. Recognition still relies on OCR; exact artwork matching is not automatic yet.</p>
      <div class="scan-result-actions"><button class="button btn-outline" type="button" data-action="scan-again">Scan again</button><button class="button btn-primary" type="submit">＋ Save & next card</button></div>
    </form>`);
  }
  function syncScanCard(){
    const input=document.querySelector('#scanCardId');if(!input)return;
    const id=safeId(input.value),known=catalogCard(id),variants=variantOptions(id);
    const wrap=document.querySelector('#scanVariantWrap'),select=document.querySelector('#scanVariantSelect');
    if(wrap&&select){wrap.hidden=variants.length<=1;select.innerHTML=variants.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===id?'selected':''}>${escapeHtml(c.id)} · ${escapeHtml(c.name)}</option>`).join('');}
    const name=document.querySelector('#scanCardName');if(name&&(!name.dataset.custom||name.value===name.dataset.previous)){name.value=known?.name||id;name.dataset.previous=name.value;}
    const matchName=document.querySelector('#scanMatchName'),matchMeta=document.querySelector('#scanMatchMeta'),owned=document.querySelector('#scanOwnedCount'),img=document.querySelector('#scanMatchImage');
    if(matchName)matchName.textContent=known?.name||id||'Enter card ID';
    if(matchMeta)matchMeta.textContent=known?cardMeta(known):'Check the card number below';
    if(owned)owned.textContent=`${fmt(qtyFor(id))} copies owned`;
    if(img)img.src=imageUrl(id);
  }

  function dashboardView() {
    const total=allQty(), locations=state.data.locations;
    const sortedLocs=[...locations].sort((a,b)=>entryCounts(b.id)-entryCounts(a.id)).slice(0,5);
    const latest=[...state.data.entries].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,6);
    const locMarkup=sortedLocs.map(l=>`<div class="storage-row"><div class="storage-icon">${l.kind==='Binder'?'▦':l.kind==='Deck'?'♠':'▣'}</div><div class="storage-info"><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.kind)} · ${fmt(state.data.entries.filter(e=>e.locationId===l.id).length)} entries</small><div class="progress-track"><div class="progress-fill" style="width:${total?Math.round(100*entryCounts(l.id)/total):0}%"></div></div></div><div class="qty-tag">${fmt(entryCounts(l.id))}</div></div>`).join('');
    return pageHeading('YOUR COLLECTION','Dashboard','A home for every card, deck, binder and storage box.',`<div class="actions"><button class="button btn-primary" data-view="scan" type="button">◎ Scan cards</button><button class="button btn-outline" data-action="open-import" type="button">↑ Restore backup</button></div>`)+
    `<div class="hero"><div><div class="overline">READY TO ORGANIZE?</div><h2>Know exactly where every card lives.</h2><p>Search cards by ID or name, track duplicates, and record binder pages or box slots.</p></div><button class="button btn-primary" data-view="catalog" type="button">＋ Add cards</button></div>
    <div class="stats"><div class="stat"><div class="stat-label">Total cards</div><div class="stat-number">${fmt(total)}</div><div class="stat-hint">Across all locations</div></div><div class="stat"><div class="stat-label">Unique printings</div><div class="stat-number">${fmt(uniqueCards())}</div><div class="stat-hint">Card ID and art variants</div></div><div class="stat"><div class="stat-label">Storage locations</div><div class="stat-number">${fmt(locations.length)}</div><div class="stat-hint">Binders, boxes and decks</div></div><div class="stat"><div class="stat-label">Inventory records</div><div class="stat-number">${fmt(state.data.entries.length)}</div><div class="stat-hint">Individual card/slot entries</div></div></div>
    <div class="section-heading"><h2>Collection overview</h2><button class="text-button" data-view="inventory" type="button">View all cards →</button></div><div class="columns"><section class="panel"><h3>Latest inventory changes</h3>${latest.length?inventoryTable(latest,true):empty('▤','No cards yet','Use the catalog or import a decklist to add your first cards.',`<button class="button btn-primary" data-action="open-bulk">Import card list</button>`)}</section><section class="panel"><h3>Where your cards are stored</h3><div class="storage-list">${locMarkup}</div><p class="hint">Use Storage locations to create a binder, deck box, trade box, or shelf.</p><div class="actions"><button class="button btn-outline small" data-view="locations" type="button">Manage locations</button><button class="button btn-outline small" data-action="open-bulk" type="button">Import card list</button><button class="button btn-outline small" data-action="import-inventory-csv" type="button">Import CSV</button></div></section></div>`;
  }

  const deckTotal = d => (d?.cards||[]).reduce((n,c)=>n+c.qty,0);
  const ownedBaseQty = id => state.data.entries.reduce((n,e)=>n+(baseCardId(e.cardId)===baseCardId(id)?e.qty:0),0);
  const selectedDeck = () => state.data.decks.find(d=>d.id===state.activeDeckId) || state.data.decks[0] || null;
  const baseCatalogCard = id => state.catalog.find(c=>c.id===baseCardId(id)) || state.catalog.find(c=>baseCardId(c.id)===baseCardId(id));
  const selectedOption = (value,current) => value===current?'selected':'';
  const selectOptions=(values,current,allLabel='Any')=>`<option value="all">${allLabel}</option>${values.map(v=>`<option value="${escapeHtml(v)}" ${selectedOption(v,current)}>${escapeHtml(v)}</option>`).join('')}`;
  const allTraits = () => [...new Set(state.catalog.flatMap(c=>c.types))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  const costsInCatalog = () => [...new Set(state.catalog.map(c=>c.cost).filter(n=>Number.isInteger(n)&&n>=0))].sort((a,b)=>a-b);

  function advancedFilters() {
    const f=state.filters;
    const costs=costsInCatalog();
    const attributes=[...new Set(state.catalog.flatMap(c=>c.attributes))].sort();
    const rarities=[...new Set(state.catalog.map(c=>c.rarity).filter(Boolean))].sort();
    const traits=allTraits();
    return `<section class="advanced-filters" aria-label="Detailed card filters">
      <div class="filter-heading"><strong>Advanced card filters</strong><div class="actions"><button class="button btn-outline tiny" data-action="save-filter" type="button">☆ Save preset</button><button class="button btn-ghost tiny" data-action="clear-filters" type="button">Reset filters</button></div></div>
      <div class="preset-controls"><label>Saved filter presets<select class="select" id="savedFilterPreset"><option value="">Choose saved preset…</option>${(state.data.presets||[]).map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}</select></label><button class="button btn-ghost tiny" data-action="delete-filter" type="button">Delete selected</button></div>
      <div class="filter-grid">
        <label>Card type<select class="select" id="catalogCategory">${selectOptions(['Leader','Character','Event','Stage'],f.category,'All card types')}</select></label>
        <label>Traits / Crews<input class="field" id="catalogTrait" list="traitHints" placeholder="Straw Hat Crew, Supernovas" value="${escapeHtml(f.trait)}" autocomplete="off"/><datalist id="traitHints">${traits.map(t=>`<option value="${escapeHtml(t)}"></option>`).join('')}</datalist></label>
        <label>Card rarity<select class="select" id="catalogRarity">${selectOptions(rarities,f.rarity,'All rarities')}</select></label>
        <label>Attribute<select class="select" id="catalogAttribute">${selectOptions(attributes,f.attribute,'All attributes')}</select></label>
        <label>Counter<select class="select" id="catalogCounter">${[['all','Any counter'],['none','No counter'],['0','0'],['1000','+1000'],['2000','+2000']].map(([v,label])=>`<option value="${v}" ${selectedOption(v,f.counter)}>${label}</option>`).join('')}</select></label>
        <label>Sort<select class="select" id="catalogSort">${[['id','Set / card ID'],['name','Name A–Z'],['cost','Cost low–high'],['power','Power high–low'],['owned','Most owned']].map(([v,label])=>`<option value="${v}" ${selectedOption(v,f.sort)}>${label}</option>`).join('')}</select></label>
        <label>Min. power<input class="field" type="number" id="catalogPowerMin" min="0" step="1000" placeholder="Any" value="${escapeHtml(f.powerMin)}"></label>
        <label>Max. power<input class="field" type="number" id="catalogPowerMax" min="0" step="1000" placeholder="Any" value="${escapeHtml(f.powerMax)}"></label>
      </div>
      <div class="filter-sublabel">Multiple crew traits separated by commas <select class="select" id="catalogTraitMode"><option value="any" ${selectedOption('any',f.traitMode)}>Match any trait</option><option value="all" ${selectedOption('all',f.traitMode)}>Match all traits</option></select></div>
      <div class="cost-filter"><div class="filter-mini-title"><strong>Exact DON!! cost</strong><small>Select one or several, or none for every cost</small><button type="button" data-action="clear-costs" class="text-button">All costs</button></div><div class="cost-options">${(costs.length?costs:Array.from({length:11},(_,i)=>i)).map(n=>`<label class="cost-chip"><input type="checkbox" data-filter-cost="${n}" ${f.costs.has(n)?'checked':''}><span>${n}</span></label>`).join('')}</div></div>
      <div class="effect-filter"><label>Search printed effect / Trigger text<input class="field" type="search" id="catalogEffect" placeholder="e.g. Give 1 rested DON!! or On K.O." value="${escapeHtml(f.effect)}"/></label>
      <div class="filter-sublabel">Text search: <select class="select" id="catalogEffectMode"><option value="all" ${selectedOption('all',f.effectMode)}>All words (any order)</option><option value="any" ${selectedOption('any',f.effectMode)}>Any word</option><option value="phrase" ${selectedOption('phrase',f.effectMode)}>Exact phrase</option></select><select class="select" id="catalogEffectTarget"><option value="both" ${selectedOption('both',f.effectTarget)}>Effect + Trigger</option><option value="effect" ${selectedOption('effect',f.effectTarget)}>Effects only</option><option value="trigger" ${selectedOption('trigger',f.effectTarget)}>Triggers only</option></select></div>
      <div class="effect-presets">${['[On Play]','[On K.O.]','[When Attacking]','[Blocker]','[Rush]','[Activate: Main]','rested DON!!'].map(v=>`<button type="button" class="filter-preset" data-action="effect-preset" data-value="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('')}</div></div>
      <div class="filter-options"><label><input type="checkbox" id="catalogOwned" ${f.ownedOnly?'checked':''}> Only cards I own</label><label><input type="checkbox" id="catalogNoVariants" ${f.hideVariants?'checked':''}> One listing per card number (group alternate arts)</label></div>
    </section>`;
  }

  function catalogView() {
    const sets=[...new Set(state.catalog.map(c=>setFrom(c.id)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const colors=['Red','Green','Blue','Purple','Black','Yellow'];
    return pageHeading('EXPLORE','Card catalog','Find cards by exact cost, crew, power, counter and effect text, then save them to your collection.',`<div class="actions"><button class="button btn-primary" data-view="scan" type="button">◎ Scan card</button><button class="button btn-outline" data-action="open-custom">＋ Manual card</button></div>`)+
    `<div class="toolbar"><label class="search-box"><span>⌕</span><input id="catalogSearch" type="search" placeholder="Search card name / ID" value="${escapeHtml(state.query)}" aria-label="Search cards" /></label><select id="catalogSet" class="select" aria-label="Filter set"><option value="all">All sets</option>${sets.map(s=>`<option value="${escapeHtml(s)}" ${s===state.set?'selected':''}>${escapeHtml(s)}</option>`).join('')}</select><select class="select" id="catalogColor" aria-label="Filter color"><option value="all">All colors</option>${colors.map(c=>`<option value="${c}" ${c===state.color?'selected':''}>${c}</option>`).join('')}</select></div>
    ${advancedFilters()}<div class="catalog-info"><span id="catalogCount"></span><span>Data: English third-party catalog · Card artwork belongs to its owners.</span></div><div class="catalog-grid" id="catalogGrid"></div><div id="catalogMore" class="text-center" style="padding:24px"></div>`;
  }

  function normalizeEffect(value) {return String(value??'').toLowerCase().replace(/\b(one|two|three|four)\b/g,w=>({one:'1',two:'2',three:'3',four:'4'}[w])).replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
  function matchesEffect(c,term,mode,target='both') {
    if(!term.trim())return true;
    const content=normalizeEffect((target==='effect'?[c.effect]:target==='trigger'?[c.trigger]:[c.effect,c.trigger]).filter(Boolean).join(' '));
    const query=normalizeEffect(term);
    const words=query.split(' ').filter(Boolean);const hay=content.split(' ');return mode==='phrase'?content.includes(query):mode==='any'?words.some(w=>hay.includes(w)):words.every(w=>hay.includes(w));
  }
  function filteredCatalog() {
    const f=state.filters;
    const q=state.query.trim().toLowerCase().replaceAll(' ','');
    let cards=state.catalog.filter(c=>{
      if(q && !`${c.id} ${c.name}`.toLowerCase().replaceAll(' ','').includes(q))return false;
      if(state.color!=='all' && !c.colors.toLowerCase().split(/\s*\/\s*/).includes(state.color.toLowerCase()))return false;
      if(state.set!=='all'&&setFrom(c.id)!==state.set)return false;
      if(f.category!=='all'&&c.category.toLowerCase()!==f.category.toLowerCase())return false;
      if(f.rarity!=='all'&&c.rarity!==f.rarity)return false;
      if(f.attribute!=='all'&&!c.attributes.includes(f.attribute))return false;
      if(f.trait){const terms=f.trait.toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);const matches=x=>c.types.some(t=>t.toLowerCase().includes(x));if(f.traitMode==='all'?!terms.every(matches):!terms.some(matches))return false;}
      if(f.costs.size && !f.costs.has(c.cost))return false;
      if(f.counter==='none'&&c.counter!==null)return false;
      if(f.counter!=='all'&&f.counter!=='none'&&c.counter!==Number(f.counter))return false;
      if(f.powerMin!==''&&(!Number.isFinite(c.power)||c.power<Number(f.powerMin)))return false;
      if(f.powerMax!==''&&(!Number.isFinite(c.power)||c.power>Number(f.powerMax)))return false;
      if(f.ownedOnly&&!ownedBaseQty(c.id))return false;
      return matchesEffect(c,f.effect,f.effectMode,f.effectTarget);
    });
    if(f.hideVariants){const byBase=new Map(); for(const c of cards){const id=baseCardId(c.id);if(!byBase.has(id)||c.id===id)byBase.set(id,c);} cards=[...byBase.values()];}
    if(f.sort==='name')cards.sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
    else if(f.sort==='cost')cards.sort((a,b)=>(a.cost??999)-(b.cost??999)||a.id.localeCompare(b.id));
    else if(f.sort==='power')cards.sort((a,b)=>(b.power??-1)-(a.power??-1)||a.id.localeCompare(b.id));
    else if(f.sort==='owned')cards.sort((a,b)=>ownedBaseQty(b.id)-ownedBaseQty(a.id)||a.id.localeCompare(b.id));
    else cards.sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
    return cards;
  }
  function paintCatalog() {
    if(state.view!=='catalog')return;
    const results=filteredCatalog();const shown=results.slice(0,state.perPage);
    document.querySelector('#catalogCount').textContent=`${fmt(results.length)} printings found ${!state.loaded?'· limited offline preview':''}`;
    document.querySelector('#catalogGrid').innerHTML=shown.length?shown.map(c=>`<article class="card-tile"><div class="card-art"><img loading="lazy" src="${escapeHtml(c.image || imageUrl(c.id))}" alt="Artwork for ${escapeHtml(c.name)}"/><span class="art-id">${escapeHtml(c.id)}</span></div><div class="card-body"><strong title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</strong><div class="meta">${escapeHtml(cardMeta(c))}<div>Cost ${c.cost??'—'} · Power ${c.power??'—'} · Counter ${c.counter===null?'—':c.counter}</div>${c.types.length?`<div title="${escapeHtml(c.types.join(', '))}">${escapeHtml(c.types.join(' · '))}</div>`:''}</div><button type="button" class="button btn-primary small" data-action="add-card" data-id="${escapeHtml(c.id)}">＋ Add to collection</button><div class="owned">${qtyFor(c.id)?`${fmt(qtyFor(c.id))} owned`:'Not yet in your collection'}</div></div></article>`).join('') : empty('⌕','No matching cards','Try removing a filter or searching another effect.',`<button class="button btn-outline" data-action="clear-filters">Clear filters</button>`);
    document.querySelector('#catalogMore').innerHTML=shown.length<results.length?`<button class="button btn-outline" type="button" data-action="more-cards">Show more (${fmt(results.length-shown.length)} remaining)</button>`:'';
  }

  function physicalLocations(id) {
    const matches=state.data.entries.filter(e=>baseCardId(e.cardId)===baseCardId(id));
    return matches.length?matches.slice(0,3).map(e=>`${e.qty}× ${locationById(e.locationId)?.name||'Unsorted'}${e.slot?` (${e.slot})`:''}`).join(' · ')+(matches.length>3?` · +${matches.length-3} more`:''):'Not owned';
  }
  const reservedByDeck = (cardId,excludeDeckId='')=>state.data.decks.filter(d=>d.reserved&&d.id!==excludeDeckId).map(d=>({deck:d,qty:d.cards.find(c=>c.cardId===baseCardId(cardId))?.qty||0})).filter(x=>x.qty>0);
  const reservedTotal = cardId => reservedByDeck(cardId).reduce((n,x)=>n+x.qty,0);
  const freeQty = cardId => Math.max(0,ownedBaseQty(cardId)-reservedTotal(cardId));
  function reservedSummary(cardId){const uses=reservedByDeck(cardId);return uses.length?uses.map(x=>`${x.qty}× ${x.deck.name}`).join(' · '):'No reservations';}
  function deckListHtml(d) {
    if(!d)return '';
    const entries=[...d.cards].sort((a,b)=>(baseCatalogCard(a.cardId)?.cost??100)-(baseCatalogCard(b.cardId)?.cost??100)||a.cardId.localeCompare(b.cardId));
    return entries.length?`<div class="deck-entries">${entries.map(c=>{
      const card=baseCatalogCard(c.cardId);const owned=ownedBaseQty(c.cardId);
      return `<div class="deck-row"><img loading="lazy" src="${escapeHtml(card?.image||imageUrl(c.cardId))}" alt=""/><div class="deck-card-name"><strong>${escapeHtml(card?.name||c.cardId)}</strong><small>${escapeHtml(c.cardId)} · Cost ${card?.cost??'—'} · <span class="${owned<c.qty?'deck-missing':''}">${owned} owned / ${c.qty} needed</span><br/><span title="${escapeHtml(physicalLocations(c.cardId))}">${escapeHtml(physicalLocations(c.cardId))}</span>${reservedTotal(c.cardId)?`<br/><span title="${escapeHtml(reservedSummary(c.cardId))}">Reserved: ${reservedTotal(c.cardId)} · Free: ${freeQty(c.cardId)}</span>`:''}</small></div><div class="quantity-ctrl"><button data-action="deck-minus" data-id="${escapeHtml(c.cardId)}" title="Remove one">−</button><strong>${c.qty}</strong><button data-action="deck-plus" data-id="${escapeHtml(c.cardId)}" title="Add one" ${c.qty>=4?'disabled':''}>+</button></div></div>`;
    }).join('')}</div>`:empty('♠','No cards in this deck yet','Choose a Leader, then add Characters, Events and Stages from the filtered card pool.');
  }
  function reservationWarnings(d){
    if(!d.reserved)return '';
    const warnings=d.cards.map(c=>({id:c.cardId,requested:reservedTotal(c.cardId),owned:ownedBaseQty(c.cardId)})).filter(x=>x.requested>x.owned);
    return warnings.length?`<div class="deck-draft">Reservation conflicts: ${warnings.map(x=>`${escapeHtml(x.id)} (${x.requested} reserved, ${x.owned} owned)`).join(' · ')}. This is a warning, not a block.</div>`:`<div class="deck-valid">Reservations fit your current inventory. Copies remain in their numbered boxes.</div>`;
  }
  function decksView() {
    const d=selectedDeck();if(d)state.activeDeckId=d.id;
    const leader=d?baseCatalogCard(d.leaderId):null;
    const sum=deckTotal(d),missing=d?.cards.reduce((n,c)=>n+Math.max(0,c.qty-ownedBaseQty(c.cardId)),0)||0;
    const invalidColors=d?.leaderId?d.cards.filter(c=>{const card=baseCatalogCard(c.cardId);return card&&!validForLeader(card,d.leaderId);}).length:0;
    const sets=[...new Set(state.catalog.map(c=>setFrom(c.id)))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const colors=['Red','Green','Blue','Purple','Black','Yellow'];
    const deckPanel=d?`<section class="panel deck-workspace"><div class="deck-toolbar"><label class="deck-select-label">Current deck<select class="select" id="activeDeck">${state.data.decks.map(x=>`<option value="${escapeHtml(x.id)}" ${selectedOption(x.id,d.id)}>${escapeHtml(x.name)}</option>`).join('')}</select></label><div class="actions"><button class="button btn-outline small" data-action="rename-deck">Rename</button><button class="button btn-outline small" data-action="import-deck">↑ Import plan</button><button class="button btn-outline small" data-action="clone-deck">Duplicate</button><button class="button btn-outline small" data-action="export-deck">↓ OPTCGSim</button><button class="button btn-outline small" data-action="export-deck-json">↓ Plan JSON</button><button class="button btn-danger small" data-action="delete-deck">Delete</button></div></div>
      <div class="deck-overview"><div class="deck-leader">${leader?`<img src="${escapeHtml(leader.image||imageUrl(leader.id))}" alt=""/>`:''}<div><small>LEADER</small><strong>${escapeHtml(leader?.name||'Choose a Leader below')}</strong><span>${escapeHtml(d.leaderId||'Not selected')}</span></div></div><div class="deck-stat"><strong>${sum}/50</strong><small>main deck cards</small></div><div class="deck-stat"><strong>${missing}</strong><small>missing copies</small></div></div>
      ${sum===50&&leader&&!invalidColors?`<div class="deck-valid">✓ Deck has 50 cards and a Leader (check current restrictions before tournaments)</div>`:`<div class="deck-draft">Draft deck · ${leader?'':'Leader needed · '}${sum<50?`${50-sum} cards to fill`:sum>50?`${sum-50} cards over 50`:'50 cards'}${invalidColors?` · ${invalidColors} color-incompatible card types`:''} · Check official bans/restrictions separately</div>`}
      <label class="reservation-switch"><input type="checkbox" id="reserveDeck" ${d.reserved?'checked':''}><strong>Reserve physical copies for this deck</strong><small>Virtual plans do not reserve cards unless enabled. See conflicts below.</small></label>
      ${reservationWarnings(d)}
      <h3>Main deck <span class="muted">(${sum})</span></h3>${deckListHtml(d)}</section>`:empty('♠','Create your first deck','Decks are saved independently of your collection. Your inventory is never consumed when you add a card to a deck.',`<div class="actions"><button class="button btn-primary" data-action="new-deck">＋ Create deck</button><button class="button btn-outline" data-action="import-deck">↑ Import a plan</button></div>`);
    return pageHeading('DECK WORKSHOP','Deck builder','Build from your collection or the English card catalog. Your decks survive app updates and backups.',`<div class="actions"><button class="button btn-outline" type="button" data-action="import-deck">↑ Import plan</button><button class="button btn-primary" type="button" data-action="new-deck">＋ New deck</button></div>`)+
      deckPanel+(d?`<section class="panel deck-card-pool"><div class="section-heading"><h2>Find cards for this deck</h2><span class="hint">Leader: click Set leader · Other cards: click + Add</span></div>
      <div class="toolbar"><label class="search-box"><span>⌕</span><input id="catalogSearch" type="search" placeholder="Search by card name / ID" value="${escapeHtml(state.query)}"></label><select id="catalogSet" class="select">${selectOptions(sets,state.set,'All sets')}</select><select id="catalogColor" class="select">${selectOptions(colors,state.color,'All colors')}</select></div>
      ${advancedFilters()}<div class="catalog-info"><span id="deckPoolCount"></span><span>Cards sharing a number count toward the same four-copy limit.</span></div><div class="deck-pool-grid" id="deckPool"></div><div id="deckPoolMore" class="text-center" style="padding:20px"></div></section>`:'');
  }
  function paintDeckPool() {
    if(state.view!=='decks')return;
    const d=selectedDeck();if(!d)return;
    const base=new Map();for(const c of filteredCatalog()){const id=baseCardId(c.id);if(!base.has(id)||c.id===id)base.set(id,c);}
    const cards=[...base.values()];const list=cards.slice(0,state.perPage);
    document.querySelector('#deckPoolCount').textContent=`${fmt(cards.length)} unique card numbers found`;
    document.querySelector('#deckPool').innerHTML=list.length?list.map(c=>{
      const leader=c.category.toLowerCase()==='leader';const qty=d.cards.find(x=>x.cardId===baseCardId(c.id))?.qty||0;
      const allowed=leader?true:validForLeader(c,d.leaderId);
      return `<div class="deck-pool-card"><img loading="lazy" src="${escapeHtml(c.image||imageUrl(c.id))}" alt=""/><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(baseCardId(c.id))} · ${escapeHtml(c.colors)} · ${leader?'Leader':`Cost ${c.cost??'—'}`}<br/>${escapeHtml(c.types.join(' · '))}</small><div class="deck-pool-tools">${leader?`<button class="button btn-outline tiny" data-action="deck-set-leader" data-id="${escapeHtml(baseCardId(c.id))}">${d.leaderId===baseCardId(c.id)?'✓ Leader':'Set leader'}</button>`:`<button class="button btn-primary tiny" data-action="deck-add" data-id="${escapeHtml(baseCardId(c.id))}" ${qty>=4?'disabled':''}>＋ Add (${qty}/4)</button>`}<span title="${escapeHtml(reservedSummary(c.id))}">${ownedBaseQty(c.id)} owned · ${freeQty(c.id)} free${!allowed?' · ⚠ Color warning':''}</span></div></div></div>`;
    }).join(''):empty('⌕','No matching cards','Try adjusting your card filters.');
    document.querySelector('#deckPoolMore').innerHTML=cards.length>list.length?`<button class="button btn-outline" data-action="more-cards">Show more (${cards.length-list.length} remaining)</button>`:'';
  }
  function validForLeader(card,leaderId) {
    if(!leaderId)return false;
    const l=baseCatalogCard(leaderId);
    if(!l)return true; // unavailable catalog: do not delete or block historical deck contents
    const allowed=l.colors.split(' / '), colors=card.colors.split(' / ');
    return colors.every(c=>allowed.includes(c));
  }
  function addDeckCard(id,delta) {
    const d=selectedDeck();if(!d)return;
    const card=baseCatalogCard(id);
    if(delta>0){
      if(card&&!['Character','Event','Stage'].includes(card.category)){toast('Only Character, Event and Stage cards belong in the main deck.',true);return;}
          }
    const existing=d.cards.find(c=>c.cardId===id);
    if(delta>0){if(existing){if(existing.qty>=4){toast('Maximum four copies per card number.',true);return;}existing.qty++;}else d.cards.push({cardId:id,qty:1});}
    else if(existing){existing.qty--;if(existing.qty<=0)d.cards=d.cards.filter(c=>c!==existing);}
    d.updatedAt=dateNow();persist();render();
  }
  function exportDeck() {
    const d=selectedDeck();if(!d||!d.leaderId){toast('Choose a Leader before exporting.',true);return;}
    const lines=[`1x${d.leaderId}`,...[...d.cards].sort((a,b)=>a.cardId.localeCompare(b.cardId,undefined,{numeric:true})).map(c=>`${c.qty}x${c.cardId}`)];
    const blob=new Blob([lines.join('\n')+'\n'],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    a.download=`${d.name.toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,60)||'deck'}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    toast(deckTotal(d)===50?'OPTCGSim decklist exported.':'Draft deck exported (not yet 50 cards).');
  }

  function inventoryTable(entries, compact=false) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Card</th><th>Location / position</th><th>Copies</th>${compact?'':'<th>Actions</th>'}</tr></thead><tbody>${entries.map(e=>`<tr><td><div class="card-cell">${miniImg(e.cardId)}<div><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.cardId)} · ${escapeHtml(e.rarity||'Card')}${reservedTotal(e.cardId)?` · Reserved ${reservedTotal(e.cardId)} across decks`:''}</small></div></div></td><td>${pill(e.locationId)}${e.slot?`<div class="hint">${escapeHtml(e.slot)}</div>`:''}</td><td>${compact?`<strong>${fmt(e.qty)}</strong>`:`<div class="quantity-ctrl"><button aria-label="Remove one copy" data-action="minus" data-id="${escapeHtml(e.id)}" type="button">−</button><strong>${fmt(e.qty)}</strong><button aria-label="Add one copy" data-action="plus" data-id="${escapeHtml(e.id)}" type="button">＋</button></div>`}</td>${compact?'':`<td><button class="button btn-outline tiny" data-action="edit-entry" data-id="${escapeHtml(e.id)}" type="button">Edit</button></td>`}</tr>`).join('')}</tbody></table></div>`;
  }
  function inventoryView() {
    const query=state.inventoryQuery.trim().toLowerCase();
    const entries=state.data.entries.filter(e=>(state.inventoryLocation==='all'||e.locationId===state.inventoryLocation) && (!query || `${e.cardId} ${e.name} ${e.slot} ${e.note}`.toLowerCase().includes(query))).sort((a,b)=>a.cardId.localeCompare(b.cardId,undefined,{numeric:true}));
    return pageHeading('WHAT YOU OWN','My inventory','Every physical copy stays in its numbered box; deck reservations are shown as virtual claims.',`<div class="actions"><button class="button btn-primary" type="button" data-view="scan">◎ Scan card</button><button class="button btn-outline" type="button" data-action="open-custom">＋ Add card</button></div>`)+
    `<div class="toolbar"><label class="search-box"><span>⌕</span><input id="inventorySearch" type="search" placeholder="Find a card, position or note" value="${escapeHtml(state.inventoryQuery)}" aria-label="Search inventory" /></label><select id="inventoryLocation" class="select" aria-label="Filter by location"><option value="all">All locations</option>${locationOptions(state.inventoryLocation)}</select><button class="button btn-outline" data-action="open-bulk" type="button">↑ Import list</button><button class="button btn-outline" data-action="import-inventory-csv" type="button">↑ Import CSV</button><button class="button btn-outline" data-action="export-inventory-csv" type="button">↓ Export CSV</button></div>
    <div class="catalog-info"><span>${fmt(entries.length)} records · ${fmt(entries.reduce((n,e)=>n+e.qty,0))} copies</span><span>Tap Edit to move a card or update its binder position.</span></div>
    ${entries.length?inventoryTable(entries):empty('▤',state.data.entries.length?'No results':'Your inventory is empty',state.data.entries.length?'Try a different search or storage location.':'Search the catalog or import an OPTCGSim decklist.',`<button class="button btn-primary" data-view="catalog">Browse cards</button>`)}`;
  }
  function locationsView() {
    const types={Binder:'▦',Box:'▣',Deck:'♠',Shelf:'▤',Other:'✦'};
    return pageHeading('KEEP IT ORGANIZED','Storage locations','Use numbered boxes to organize your cards. Cards always stay in their physical box, even when reserved in a deck.',`<div class="actions"><button class="button btn-primary" data-action="add-numbered-box" type="button">＋ Next numbered box</button><button class="button btn-outline" data-action="add-location" type="button">Other location</button></div>`)+
    `<div class="location-cards">${state.data.locations.map(l=>`<article class="location-card"><div class="storage-icon">${types[l.kind]||types.Other}</div><h3>${escapeHtml(l.name)}</h3><div class="location-caption">${escapeHtml(l.note||'No description yet.')}</div><div class="location-count">${fmt(entryCounts(l.id))} <span class="muted" style="font:12px system-ui">copies</span></div><div class="actions"><button class="button btn-outline tiny" data-action="filter-location" data-id="${escapeHtml(l.id)}">View cards</button><button class="button btn-ghost tiny" data-action="edit-location" data-id="${escapeHtml(l.id)}">Edit</button>${l.id!==DEFAULT_LOCATION_ID?`<button class="button btn-danger tiny" data-action="remove-location" data-id="${escapeHtml(l.id)}">Delete</button>`:''}</div></article>`).join('')}</div><p class="help-note">Tip: Box numbers are automatically assigned when you press Next numbered box. Previous binder/slot information is preserved during upgrades.</p>`;
  }

  function modal(body) { modalLayer.innerHTML=`<div class="modal-overlay" id="modalOverlay"><section class="modal" role="dialog" aria-modal="true" aria-label="Collection dialog"><button type="button" class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>${body}</section></div>`; const focus=modalLayer.querySelector('input:not([type=hidden]),textarea,select'); if (focus) focus.focus(); }
  const closeModal=()=>{modalLayer.innerHTML='';};
  function openAdd(card) {
    const existing = card || {};
    modal(`<h2>Add to collection</h2><p class="subhead">Save copies of a card and the precise place you keep them.</p><form data-form="add-entry"><div class="form-fields"><label>Card ID<input class="field" name="cardId" maxlength="40" required placeholder="OP05-002" value="${escapeHtml(existing.id||'')}" /></label><label>Card name<input class="field" name="name" maxlength="150" required placeholder="Character name" value="${escapeHtml(existing.name||'')}" /></label><div class="quick-stats">${badgeColor(existing.rarity||'Manual entry')} ${escapeHtml(existing.colors||'')}</div><label>Number of copies<input class="field" name="qty" type="number" min="1" max="${MAX_QTY}" value="1" required /></label><label>Storage location<select class="select" name="locationId">${locationOptions('unsorted')}</select></label><label>Exact position (optional)<input class="field" name="slot" maxlength="100" placeholder="Page 2 / Pocket 7 or Row B" /></label><label>Notes (optional)<textarea name="note" maxlength="1000" placeholder="Condition, language, sleeves, etc."></textarea></label><input name="rarity" type="hidden" value="${escapeHtml(existing.rarity||'')}" /><input name="colors" type="hidden" value="${escapeHtml(existing.colors||'')}" /></div><div class="modal-actions"><button class="button btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="button btn-primary" type="submit">Save cards</button></div></form>`);
  }
  function openEdit(entry) {
    modal(`<h2>Edit stored card</h2><p class="subhead">${escapeHtml(entry.name)} · ${escapeHtml(entry.cardId)}</p><form data-form="edit-entry" data-id="${escapeHtml(entry.id)}"><div class="form-fields"><label>Number of copies<input class="field" name="qty" type="number" min="1" max="${MAX_QTY}" value="${entry.qty}" required /></label><label>Storage location<select class="select" name="locationId">${locationOptions(entry.locationId)}</select></label><label>Exact position<input class="field" name="slot" maxlength="100" value="${escapeHtml(entry.slot||'')}" placeholder="Binder page / pocket" /></label><label>Card name<input class="field" name="name" maxlength="150" required value="${escapeHtml(entry.name)}" /></label><label>Notes<textarea name="note" maxlength="1000">${escapeHtml(entry.note)}</textarea></label></div><div class="modal-actions" style="justify-content:space-between"><button class="button btn-danger" data-action="delete-entry" data-id="${escapeHtml(entry.id)}" type="button">Delete record</button><div class="actions"><button class="button btn-ghost" data-action="close-modal" type="button">Cancel</button><button class="button btn-primary" type="submit">Save changes</button></div></div></form>`);
  }
  function openLocation(loc) {
    const item=loc||{id:'',name:'',kind:'Binder',note:''};
    modal(`<h2>${loc?'Edit location':'Create storage location'}</h2><p class="subhead">Use a recognizable name so you can quickly find the physical cards.</p><form data-form="location" data-id="${escapeHtml(item.id)}"><div class="form-fields"><label>Location name<input class="field" name="name" maxlength="100" required placeholder="Binder A · Blue" value="${escapeHtml(item.name)}" /></label><label>Type<select class="select" name="kind">${['Binder','Box','Deck','Shelf','Other'].map(k=>`<option value="${k}" ${k===item.kind?'selected':''}>${k}</option>`).join('')}</select></label><label>Notes<textarea name="note" maxlength="500" placeholder="Where this is stored; what is inside">${escapeHtml(item.note)}</textarea></label></div><div class="modal-actions"><button class="button btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="button btn-primary" type="submit">Save location</button></div></form>`);
  }
  function openBulk() {
    modal(`<h2>Import OPTCGSim decklist</h2><p class="subhead">Paste one card per line. Quantities will be added to your existing inventory.</p><form data-form="bulk"><div class="form-fields"><label>Card list<textarea name="list" required rows="9" placeholder="1xOP05-002&#10;4xOP05-015&#10;4xST21-002"></textarea></label><label>Save into<select class="select" name="locationId">${locationOptions('unsorted')}</select></label><label>Optional position / label<input class="field" name="slot" maxlength="100" placeholder="Deck: Belo Betty" /></label></div><p class="help-note">Supports 4xOP05-015, 4 OP05-015 and OP05-015. Cards absent from the downloaded catalog are saved by their IDs; you can edit their names afterward.</p><div class="modal-actions"><button class="button btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="button btn-primary" type="submit">Import cards</button></div></form>`);
  }
  function openRestore() {
    modal(`<h2>Restore collection backup</h2><p class="subhead">Select a JSON file previously exported from Grand Line Vault.</p><div class="form-fields"><label>Backup file<input class="file-input" id="restoreFile" type="file" accept="application/json,.json"/></label></div><p class="help-note"><strong>Warning:</strong> Restoring replaces your current inventory and storage locations. Export a backup first if you want to keep them.</p><div class="modal-actions"><button class="button btn-ghost" type="button" data-action="close-modal">Cancel</button><button class="button btn-primary" data-action="confirm-restore" type="button">Restore file</button></div>`);
  }

  function upsert(entry, renderAfter=true) {
    const key=e=>`${e.cardId}\u0000${e.locationId}\u0000${e.slot.toLowerCase()}`;
    const target=state.data.entries.find(e=>key(e)===key(entry) && e.id!==entry.id);
    if (target) {
      const total=target.qty+entry.qty;
      if(total>MAX_QTY) {toast('Too many copies in one record.',true); return false;}
      target.qty=total; target.updatedAt=dateNow(); target.name=entry.name||target.name;
      state.data.entries=state.data.entries.filter(e=>e.id!==entry.id);
    } else {
      const idx=state.data.entries.findIndex(e=>e.id===entry.id);
      if (idx>=0) state.data.entries[idx]=entry; else state.data.entries.push(entry);
    }
    persist(); if(renderAfter)render(); return true;
  }
  function catalogCard(id) {return state.catalog.find(c=>c.id===id);}
  function addCopies(cardId, name, qty, locationId, slot='', note='',rarity='',colors='',renderAfter=true) {
    const c=catalogCard(cardId);
    return upsert({id:uid(),cardId,name:name || c?.name || cardId,qty,locationId,slot,note,rarity:rarity||c?.rarity||'',colors:colors||c?.colors||'',updatedAt:dateNow()},renderAfter);
  }
  function parseDecklist(raw) {
    const parsed=new Map(); const errors=[];
    const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length>1000) throw new Error('A maximum of 1,000 lines is supported.');
    for (let i=0;i<lines.length;i++) {
      const line=lines[i]; if (/^#|^\/\//.test(line)) continue;
      const m=line.match(/^(?:(\d+)\s*[xX×]?\s*)?((?:(?:OP|ST|EB|PRB)-?\d{1,3}-\d{2,4}|P-\d{2,4})(?:_p\d+)?)\s*$/i);
      if(!m){errors.push(`${i+1}: ${line.slice(0,55)}`);continue;}
      const id=safeId(m[2]);const count=Number(m[1]||1);
      if (!validId(id) || !qtyValue(count)) {errors.push(`${i+1}: invalid card/quantity`);continue;}
      parsed.set(id,(parsed.get(id)||0)+count);
      if(parsed.get(id)>MAX_QTY) errors.push(`${i+1}: too many copies of ${id}`);
    }
    return {parsed,errors};
  }

  function downloadText(name,body,mime='text/plain;charset=utf-8'){
    const blob=new Blob([body],{type:mime});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),3000);
  }
  function exportInventoryCsv(){
    const esc=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
    const rows=['card_id,qty,box,name',...state.data.entries.map(e=>[e.cardId,e.qty,locationById(e.locationId)?.name||'Unsorted',e.name].map(esc).join(','))];
    downloadText(`grand-line-vault-inventory-${dateNow().slice(0,10)}.csv`,rows.join('\n')+'\n','text/csv;charset=utf-8');toast('Inventory CSV exported.');
  }
  function exportDeckJson(){
    const d=selectedDeck();if(!d)return;
    downloadText(`${d.name.replace(/[^A-Za-z0-9-]+/g,'-')||'deck'}.grandline-deck.json`,JSON.stringify({format:'grand-line-vault-deck',version:1,deck:d,exportedAt:dateNow()},null,2),'application/json');toast('Deck plan exported.');
  }
  function importDeckDialog(){
    modal(`<h2>Import virtual deck plan</h2><p class="subhead">Paste an OPTCGSim decklist or import a previously exported Grand Line Vault deck JSON. This does not add cards to your physical collection.</p><form data-form="import-deck"><div class="form-fields"><label>Deck name<input class="field" name="name" maxlength="100" value="Imported deck" required></label><label>Leader ID (optional, auto-detected from catalog)<input class="field" name="leaderId" placeholder="OP05-002"></label><label>Paste OPTCGSim list<textarea class="field" name="list" rows="10" placeholder="1xOP05-002&#10;4xOP05-015"></textarea></label><label>Or select Grand Line Vault deck JSON<input class="file-input" type="file" id="deckImportFile" accept=".json,application/json"></label></div><p class="hint">Imported decks are virtual and unreserved. Invalid or excess copies show warnings, not silent deletions.</p><button class="button btn-primary" type="submit">Import plan</button></form>`);
  }
  async function readDeckImport(form){
    const f=new FormData(form),file=document.querySelector('#deckImportFile')?.files?.[0];
    let name=String(f.get('name')||'Imported deck').trim().slice(0,100),leaderId=baseCardId(f.get('leaderId')||''),cards=[];
    if(file){if(file.size>2*1024*1024)throw new Error('JSON deck file too large.');const obj=JSON.parse(await file.text());const d=obj.deck||obj;
      if(!Array.isArray(d.cards))throw new Error('Invalid Grand Line Vault deck JSON.');
      name=String(d.name||name).slice(0,100);leaderId=baseCardId(d.leaderId||leaderId);
      cards=d.cards.map(x=>({cardId:baseCardId(x.cardId),qty:Number(x.qty)}));
    }else{
      const parsed=parseDecklist(String(f.get('list')||''));if(parsed.errors.length)throw new Error('Decklist errors: '+parsed.errors.slice(0,3).join('; '));
      if(!leaderId){for(const [id,qty] of parsed.parsed){if(qty===1&&baseCatalogCard(id)?.category==='Leader'){leaderId=baseCardId(id);parsed.parsed.delete(id);break;}}}
      if(leaderId)parsed.parsed.delete(leaderId);
      cards=[...parsed.parsed].map(([id,qty])=>({cardId:baseCardId(id),qty}));
    }
    if(!name)throw new Error('Enter deck name.');
    const combined=new Map();for(const c of cards){if(!validId(c.cardId)||!Number.isInteger(c.qty)||c.qty<1||c.qty>4)throw new Error('Invalid card quantity or ID in deck: '+c.cardId);combined.set(c.cardId,(combined.get(c.cardId)||0)+c.qty);}
    if([...combined.values()].some(q=>q>4))throw new Error('More than four copies of the same card number.');
    const d={id:uid(),name,leaderId:validId(leaderId)?leaderId:'',cards:[...combined].map(([cardId,qty])=>({cardId,qty})),reserved:false,createdAt:dateNow(),updatedAt:dateNow()};
    state.data.decks.push(d);state.activeDeckId=d.id;persist();closeModal();setView('decks');render();toast(`Imported virtual deck plan: ${name}.`);
  }
  // Quoted CSV parser supports commas, semicolons, CRLF, embedded quotes and line breaks.
  function parseCsv(raw,delimiter=','){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<raw.length;i++){
      const c=raw[i];if(quoted){if(c==='"'&&raw[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
      else if(c==='"')quoted=true;else if(c===delimiter){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;
    }
    if(quoted)throw new Error('Unclosed quoted field in CSV.');row.push(field.replace(/\r$/,''));if(row.some(x=>x.trim()))rows.push(row);return rows;
  }
  function csvColumn(h,...names){return h.findIndex(x=>names.includes(x));}
  function importInventoryCsv(raw,defaultLocationId){
    if(raw.length>6*1024*1024)throw new Error('CSV too large (6 MB max).');
    const first=raw.split(/\r?\n/,1)[0],delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
    const rows=parseCsv(raw.replace(/^\uFEFF/,''),delim);if(rows.length<2)throw new Error('CSV needs header and data rows.');
    if(rows.length>50000)throw new Error('Too many CSV rows.');
    const header=rows[0].map(x=>x.toLowerCase().trim().replace(/[\s_-]+/g,''));
    const idcol=csvColumn(header,'cardid','cardnumber','cardcode','code','id','card');
    const qtycol=csvColumn(header,'qty','quantity','copies','count','amount');
    const loccol=csvColumn(header,'box','location','storage','boxnumber');
    const namecol=csvColumn(header,'name','cardname');
    if(idcol<0)throw new Error('Missing card ID column. Expected card_id, card number, code or id.');
    const pending=[];const madeBoxes=new Map();const existing=new Map(state.data.locations.map(l=>[l.name.toLowerCase(),l]));
    for(let i=1;i<rows.length;i++){
      const cols=rows[i],cardId=safeId(cols[idcol]||''),qty=qtycol<0?1:Number(cols[qtycol]);
      if(!validId(cardId)||!Number.isSafeInteger(qty)||qty<1||qty>MAX_QTY)throw new Error(`Invalid card or quantity on CSV row ${i+1}.`);
      const label=loccol>=0?String(cols[loccol]||'').trim().slice(0,100):'';
      const locname=/^\d+$/.test(label)?'Box '+Number(label):label;
      let locationId=defaultLocationId;
      if(locname){let loc=existing.get(locname.toLowerCase())||madeBoxes.get(locname.toLowerCase());
        if(!loc){loc={id:uid(),name:locname,kind:'Box',note:''};madeBoxes.set(locname.toLowerCase(),loc);}locationId=loc.id;}
      pending.push({cardId,qty,locationId,name:String(namecol>=0?cols[namecol]||'':'').slice(0,150)});
    }
    // All validation done before the first inventory mutation.
    const next=JSON.parse(JSON.stringify(state.data));next.locations.push(...madeBoxes.values());
    for(const x of pending){const key=next.entries.find(e=>e.cardId===x.cardId&&e.locationId===x.locationId&&!e.slot);
      if(key){if(key.qty+x.qty>MAX_QTY)throw new Error(`Quantity limit exceeded for ${x.cardId}.`);key.qty+=x.qty;key.updatedAt=dateNow();}
      else{const c=catalogCard(x.cardId);next.entries.push({id:uid(),cardId:x.cardId,name:x.name||c?.name||x.cardId,qty:x.qty,locationId:x.locationId,slot:'',note:'',rarity:c?.rarity||'',colors:c?.colors||'',updatedAt:dateNow()});}
    }
    state.data=normalizeData(next);persist();return pending.reduce((a,x)=>a+x.qty,0);
  }
  function openInventoryCsv(){modal(`<h2>Import inventory from another app</h2><p class="subhead">Upload a CSV containing your existing English cards. This adds physical copies; it does not create a deck.</p><form data-form="import-inventory-csv"><div class="form-fields"><label>CSV file<input type="file" class="file-input" id="externalCsvFile" accept=".csv,text/csv,text/plain" required></label><label>Default numbered box<select class="select" name="locationId">${locationOptions('box-1')}</select></label></div><p class="hint">Recognized headers: card_id / card number / id, qty / quantity / count, box / location, name. CSV can use comma or semicolon. A numeric box value such as 3 creates or uses Box 3. Export a backup before large imports.</p><button class="button btn-primary" type="submit">Import physical cards</button></form>`);}
  async function importExternalCsv(form){const f=new FormData(form),file=document.querySelector('#externalCsvFile')?.files?.[0];if(!file)throw new Error('Choose a CSV file.');const total=importInventoryCsv(await file.text(),String(f.get('locationId')));closeModal();setView('inventory');toast(`Imported ${fmt(total)} physical cards.`);}
  function snapshotFilters(){return {query:state.query,color:state.color,set:state.set,filters:{...state.filters,costs:[...state.filters.costs]}};}
  function applySavedPreset(p){state.query=p.query;state.color=p.color;state.set=p.set;state.filters={...p.filters,costs:new Set(p.filters.costs)};state.perPage=48;render();}
  function cloudView(){const configured=Boolean(sync.config);const signedIn=Boolean(sync.user);
    return pageHeading('PRIVATE FRIENDS-ONLY COLLECTION','Shared cloud synchronization','Approved friends use separate email logins but share the same numbered boxes, inventory, filters and deck plans.')+
      `<section class="panel"><h3>Cloud status</h3><p id="cloudState">${escapeHtml(sync.lastStatus)}</p><p class="hint">Inventory always saves locally first. Upload/download choices protect existing collections. Cloud sync requires the shared-vault SQL included in this ZIP. Only admin-approved email addresses can access shared data. Cloud changes on another device may require Refresh from cloud.</p>
      <form data-form="cloud-config"><div class="form-fields"><label>Supabase project URL<input class="field" type="url" name="url" placeholder="https://yourproject.supabase.co" value="${escapeHtml(sync.config?.url||'')}" required></label><label>Supabase publishable (anon) key<input class="field" name="key" placeholder="sb_publishable_..." value="${escapeHtml(sync.config?.key||'')}" required></label></div><p class="hint">Never paste a Supabase service_role or secret key into this app.</p><button type="submit" class="button btn-outline">${configured?'Update connection':'Connect Supabase'}</button></form>
      ${configured?`<hr/><form data-form="cloud-login"><label>Email for a magic sign-in link<input class="field" type="email" name="email" required placeholder="you@example.com"></label><div class="actions"><button type="submit" class="button btn-primary">Email me a sign-in link</button>${signedIn?`<button class="button btn-outline" data-action="cloud-refresh" type="button">Refresh from cloud</button><button class="button btn-ghost" data-action="cloud-signout" type="button">Sign out</button>`:''}</div></form>`:''}
      <p class="hint">${signedIn?`Signed in: ${escapeHtml(sync.user.email||'Account')} · `:''}${sync.ready?'Automatic sync enabled.':'Local mode remains available even without a cloud connection.'}</p></section>`;
  }
  function showCloudChoice(remote){
    sync.ready=false;
    modal(`<h2>Two different collections detected</h2><p class="subhead">Your browser has saved inventory/decks, and your group shared vault has a different saved collection. We will never silently overwrite either.</p><p class="hint">Download a JSON backup first, especially if you made changes on both devices.</p><div class="actions"><button class="button btn-outline" type="button" data-action="export-backup-cloud">Download local backup</button><button class="button btn-primary" type="button" data-action="cloud-choose-remote">Use cloud collection</button><button class="button btn-danger" type="button" data-action="cloud-choose-local">Replace shared vault with local</button></div>`);
    sync.remotePending=remote;
  }
  async function establishCloud(){
    if(!sync.client||!sync.user||sync.connecting)return;
    sync.connecting=true;sync.ready=false;clearTimeout(sync.timer);
    try{
      const {data,error}=await sync.client.from('shared_vault').select('document,revision').eq('id','main').maybeSingle();
      if(error)throw error;
      if(!data)throw new Error('No shared-vault access. Ask the project owner to approve your sign-in email in vault_members, then refresh.');
      const remote=normalizeData(data.document||{});
      sync.revision=Number(data.revision);
      if(isEmptyCollection(state.data)||JSON.stringify(remote)===JSON.stringify(state.data)){
        state.data=remote;localStorage.setItem(KEY,JSON.stringify(state.data));sync.ready=true;syncStatus('Shared vault loaded · revision '+sync.revision);render();
      } else {showCloudChoice(remote);syncStatus('Choose which collection to keep');}
    }catch(err){syncStatus('Cloud connection error: '+(err.message||String(err)));toast('Cloud connection failed. Local cards remain saved.',true);}
    finally{sync.connecting=false;}
  }
  async function connectCloud(){
    if(!sync.config?.url||!sync.config.key)return;
    syncStatus('Loading Supabase client…');
    try{
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      sync.client=sdk.createClient(sync.config.url,sync.config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      sync.client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'){sync.ready=false;sync.user=null;sync.revision=null;syncStatus('Signed out · local data remains');return;}
        if(session?.user && session.user.id!==sync.user?.id){sync.user=session.user;setTimeout(()=>establishCloud(),0);}
      });
      const {data:{user},error}=await sync.client.auth.getUser();
      if(error&&error.name!=='AuthSessionMissingError')throw error;
      if(user){sync.user=user;await establishCloud();}else syncStatus('Configured. Sign in by email to enable sync.');
    }catch(err){syncStatus('Cloud client error: '+(err.message||String(err)));}
  }
  function downloadBackup() {
    const blob=new Blob([JSON.stringify({...state.data,exportedAt:dateNow()},null,2)],{type:'application/json'});
    const href=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=href;a.download=`grand-line-vault-${new Date().toISOString().slice(0,10)}.json`;a.click();
    setTimeout(()=>URL.revokeObjectURL(href),3000);toast('Backup file downloaded.');
  }
  function setView(next) {
    if(!views.has(next)) return;
    if(next===state.view){document.querySelector('.sidebar').classList.remove('open');return;}
    if(state.view==='scan' && next!=='scan'){stopCamera();scanner.session++;scanner.busy=false;}
    state.view=next;document.querySelector('.sidebar').classList.remove('open');
    render();window.scrollTo({top:0,behavior:'instant'});
  }

  function paintFilterResults(){if(state.view==='catalog')paintCatalog();if(state.view==='decks')paintDeckPool();}
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action, id=btn.dataset.id;
    if(action==='add-numbered-box'){
      const used=new Set(state.data.locations.map(l=>{const m=/^box\s+(\d+)$/i.exec(l.name);return m?Number(m[1]):null}));
      let n=1;while(used.has(n))n++;state.data.locations.push({id:uid(),name:'Box '+n,kind:'Box',note:''});persist();render();toast('Created Box '+n);return;
    }
    if(action==='import-inventory-csv'){openInventoryCsv();return;}
    if(action==='export-inventory-csv'){exportInventoryCsv();return;}
    if(action==='import-deck'){importDeckDialog();return;}
    if(action==='export-deck-json'){exportDeckJson();return;}
    if(action==='clone-deck'){const d=selectedDeck();if(!d)return;const copy=JSON.parse(JSON.stringify(d));copy.id=uid();copy.name=(copy.name+' copy').slice(0,100);copy.reserved=false;copy.createdAt=dateNow();copy.updatedAt=dateNow();state.data.decks.push(copy);state.activeDeckId=copy.id;persist();render();toast('Created a virtual copy of the deck.');return;}
    if(action==='save-filter'){const name=prompt('Name this saved filter preset:');if(!name?.trim())return;state.data.presets.push({id:uid(),name:name.trim().slice(0,80),...snapshotFilters()});persist();render();toast('Saved filter preset.');return;}
    if(action==='delete-filter'){const sel=document.querySelector('#savedFilterPreset');const p=state.data.presets.find(x=>x.id===sel?.value);if(!p){toast('Select a saved preset first.',true);return;}if(confirm(`Delete filter preset “${p.name}”?`)){state.data.presets=state.data.presets.filter(x=>x.id!==p.id);persist();render();}return;}
    if(action==='export-backup-cloud'){downloadBackup();return;}
    if(action==='cloud-choose-remote'){
      if(!sync.remotePending)return;
      downloadBackup();state.data=sync.remotePending;sync.remotePending=null;localStorage.setItem(KEY,JSON.stringify(state.data));sync.ready=true;closeModal();syncStatus('Using shared collection · revision '+sync.revision);render();toast('Cloud collection loaded. Local JSON backup downloaded.');return;
    }
    if(action==='cloud-choose-local'){
      if(!sync.remotePending)return;
      if(!confirm("REPLACE EVERYONE'S shared vault with your local cards and decks? Other members' changes could be lost. Download a backup first."))return;
      sync.remotePending=null;sync.ready=true;closeModal();sendCloudSave();render();return;
    }
    if(action==='cloud-refresh'){establishCloud();return;}
    if(action==='cloud-signout'){sync.client?.auth.signOut();return;}
    if(action==='clear-filters'){
      state.query='';state.set='all';state.color='all';state.perPage=48;
      state.filters={effect:'',effectMode:'all',effectTarget:'both',trait:'',traitMode:'any',category:'all',rarity:'all',attribute:'all',counter:'all',powerMin:'',powerMax:'',costs:new Set(),ownedOnly:false,sort:'id',hideVariants:false};render();return;
    }
    if(action==='clear-costs'){state.filters.costs.clear();render();return;}
    if(action==='effect-preset'){state.filters.effect=String(btn.dataset.value||'');state.filters.effectMode='all';render();return;}
    if(action==='new-deck'){modal(`<h2>Create a deck</h2><p class="subhead">Your deck is saved independently from your physical collection.</p><form data-form="new-deck"><div class="form-fields"><label>Deck name<input class="field" name="name" maxlength="100" required placeholder="e.g. Belo Betty Aggro"></label></div><div class="modal-actions"><button class="button btn-ghost" data-action="close-modal" type="button">Cancel</button><button class="button btn-primary" type="submit">Create deck</button></div></form>`);return;}
    if(action==='rename-deck'){const d=selectedDeck();if(d)modal(`<h2>Rename deck</h2><form data-form="rename-deck"><div class="form-fields"><label>Deck name<input class="field" name="name" maxlength="100" required value="${escapeHtml(d.name)}"></label></div><div class="modal-actions"><button class="button btn-primary" type="submit">Save name</button></div></form>`);return;}
    if(action==='delete-deck'){const d=selectedDeck();if(d&&confirm(`Delete deck “${d.name}”? Your physical collection will not be affected.`)){state.data.decks=state.data.decks.filter(x=>x.id!==d.id);state.activeDeckId=state.data.decks[0]?.id||'';persist();render();toast('Deck deleted; physical cards unchanged.');}return;}
    if(action==='deck-set-leader'){const d=selectedDeck(),leader=baseCatalogCard(id);if(!d||!leader||leader.category!=='Leader')return;
      const incompatible=d.cards.filter(c=>{const item=baseCatalogCard(c.cardId);return item&&!validForLeader(item,id);});
      if(incompatible.length&&!confirm(`This leader is a different color. ${incompatible.length} existing card types may be ineligible; keep them in the draft?`))return;
      d.leaderId=id;d.updatedAt=dateNow();persist();render();toast(`Leader set: ${leader.name}.`);return;
    }
    if(action==='deck-add'||action==='deck-plus'){addDeckCard(id,1);return;}
    if(action==='deck-minus'){addDeckCard(id,-1);return;}
    if(action==='export-deck'){exportDeck();return;}
    if(action==='close-modal'){closeModal();return;}
    if(action==='open-custom'){openAdd();return;}
    if(action==='open-bulk'){openBulk();return;}
    if(action==='open-import'){openRestore();return;}
    if(action==='add-card'){openAdd(catalogCard(id));return;}
    if(action==='more-cards'){state.perPage+=48;paintFilterResults();return;}
    if(action==='add-location'){openLocation();return;}
    if(action==='edit-location'){const loc=locationById(id);if(loc)openLocation(loc);return;}
    if(action==='remove-location'){
      const loc=locationById(id);if(!loc)return;
      if(state.data.entries.some(en=>en.locationId===id)){toast('Move or delete the cards stored here before deleting this location.',true);return;}
      if(confirm(`Delete empty location “${loc.name}”?`)){state.data.locations=state.data.locations.filter(l=>l.id!==id);persist();render();toast('Location deleted.');}return;
    }
    if(action==='filter-location'){state.inventoryLocation=id;setView('inventory');return;}
    if(action==='edit-entry'){const item=state.data.entries.find(en=>en.id===id);if(item)openEdit(item);return;}
    if(action==='delete-entry'){
      const item=state.data.entries.find(en=>en.id===id);if(!item)return;
      if(confirm(`Delete all ${item.qty} copies of ${item.cardId} from this record?`)){state.data.entries=state.data.entries.filter(en=>en.id!==id);persist();closeModal();render();toast('Inventory record deleted.');}return;
    }
    if(action==='plus'||action==='minus'){
      const item=state.data.entries.find(en=>en.id===id);if(!item)return;
      if(action==='minus'&&item.qty===1){toast('Use Edit → Delete record to remove the last copy.',true);return;}
      if(action==='plus'&&item.qty>=MAX_QTY){toast('Maximum quantity reached.',true);return;}
      item.qty+=action==='plus'?1:-1;item.updatedAt=dateNow();persist();render();return;
    }
    if(action==='start-camera'){startCamera();return;}
    if(action==='stop-camera'){stopCamera();updateScanButtons();setScanStatus('Camera stopped. You can start it again or choose a photo.');return;}
    if(action==='capture-card'){captureCard();return;}
    if(action==='scan-again'){scanner.busy=false;setScanResult('');setScanStatus('Ready for another card. Hold its printed code in focus.');updateScanButtons();return;}
    if(action==='confirm-restore'){
      const inp=document.querySelector('#restoreFile');const file=inp?.files?.[0];if(!file){toast('Choose a JSON file first.',true);return;}
      if(file.size>20*1024*1024){toast('File is too large (max 20 MB).',true);return;}
      file.text().then(text=>{
        const data=normalizeData(JSON.parse(text));
        if(!confirm('Replace all current cards and locations with this backup? This cannot be undone.'))return;
        state.data=data;persist();closeModal();render();toast('Collection successfully restored.');
      }).catch(err=>toast(`Could not restore: ${err.message}`,true));return;
    }
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();
    const f=new FormData(form), type=form.dataset.form;
    if(type==='import-deck'){readDeckImport(form).catch(err=>toast(err.message||String(err),true));return;}
    if(type==='import-inventory-csv'){importExternalCsv(form).catch(err=>toast(err.message||String(err),true));return;}
    if(type==='cloud-config'){
      const url=String(f.get('url')||'').trim(),key=String(f.get('key')||'').trim();
      if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)||!/^(sb_publishable_|eyJ)/.test(key)||/service_role|secret/i.test(key)){
        toast('Use your Supabase project HTTPS URL and PUBLIC publishable / anon key only.',true);return;
      }
      sync.config={url:url.replace(/\/$/,''),key};localStorage.setItem(CLOUD_KEY,JSON.stringify(sync.config));connectCloud();render();return;
    }
    if(type==='cloud-login'){
      if(!sync.client){toast('Configure Supabase first.',true);return;}
      const email=String(f.get('email')||'').trim();
      sync.client.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}}).then(({error})=>{if(error)toast(error.message,true);else toast('Check your email for the sign-in link.');});return;
    }
    if(type==='new-deck'){
      const name=String(f.get('name')||'').trim();if(!name){toast('Enter a deck name.',true);return;}
      const id=uid();state.data.decks.push({id,name:name.slice(0,100),leaderId:'',cards:[],reserved:false,createdAt:dateNow(),updatedAt:dateNow()});state.activeDeckId=id;persist();closeModal();setView('decks');render();toast('Deck created.');return;
    }
    if(type==='rename-deck'){const d=selectedDeck();if(!d)return;const name=String(f.get('name')||'').trim();if(!name)return;d.name=name.slice(0,100);d.updatedAt=dateNow();persist();closeModal();render();return;}
    if(type==='scan-add'){
      const id=safeId(f.get('cardId')),qty=qtyValue(f.get('qty')),loc=String(f.get('locationId')),slot=String(f.get('slot')||'').trim();
      if(!isCardCode(id)||!qty||!locationById(loc)){toast('Check the printed card ID, quantity and location.',true);return;}
      const known=catalogCard(id),name=known?.name||String(f.get('name')||'').trim()||id;
      if(addCopies(id,name,qty,loc,slot,'',known?.rarity||'',known?.colors||'',false)){
        scanner.lastLocationId=loc;scanner.lastSlot=slot;scanner.saved+=qty;
        const count=document.querySelector('#scanSaved');if(count)count.textContent=fmt(scanner.saved);
        setScanResult('');setScanStatus(`Saved ${qty} × ${id} (${name}). Ready to scan the next card.`);updateScanButtons();
        toast(`Saved ${qty} × ${id}.`);
      }return;
    }
    if(type==='add-entry'){
      const id=safeId(f.get('cardId'));const qty=qtyValue(f.get('qty'));const locationId=String(f.get('locationId'));
      if(!validId(id)||qty===null||!locationById(locationId)){toast('Enter a valid card ID, quantity and location.',true);return;}
      const name=String(f.get('name')||'').trim();if(!name){toast('Enter the card name.',true);return;}
      if(addCopies(id,name,qty,locationId,String(f.get('slot')||'').trim(),String(f.get('note')||'').trim(),String(f.get('rarity')||''),String(f.get('colors')||''))){closeModal();toast(`Added ${qty} × ${id}.`);}return;
    }
    if(type==='edit-entry'){
      const item=state.data.entries.find(en=>en.id===form.dataset.id);if(!item)return;
      const qty=qtyValue(f.get('qty'));const loc=String(f.get('locationId'));
      if(qty===null||!locationById(loc)){toast('Check quantity and location.',true);return;}
      const name=String(f.get('name')||'').trim();if(!name){toast('Enter the card name.',true);return;}
      const updated={...item,qty,locationId:loc,slot:String(f.get('slot')||'').trim(),name,note:String(f.get('note')||'').trim(),updatedAt:dateNow()};
      if(upsert(updated)){closeModal();toast('Card updated.');}return;
    }
    if(type==='location'){
      const name=String(f.get('name')||'').trim();if(!name){toast('Enter a location name.',true);return;}
      const kind=String(f.get('kind')||'Box');const note=String(f.get('note')||'').trim();
      const exists=locationById(form.dataset.id);
      if(exists){Object.assign(exists,{name,kind,note});}else state.data.locations.push({id:uid(),name,kind,note});
      persist();closeModal();render();toast('Location saved.');return;
    }
    if(type==='bulk'){
      let result;try{result=parseDecklist(String(f.get('list')||''));}catch(err){toast(err.message,true);return;}
      if(result.errors.length){toast(`Invalid lines: ${result.errors.slice(0,3).join('; ')}`,true);return;}
      if(result.parsed.size===0){toast('No cards found in the pasted list.',true);return;}
      const locationId=String(f.get('locationId'));
      if(!locationById(locationId)){toast('Please choose a location.',true);return;}
      const slot=String(f.get('slot')||'').trim();
      // Validate the whole import before writing so the operation is atomic.
      for(const [cardId,qty] of result.parsed){
        const previous=state.data.entries.find(en=>en.cardId===cardId&&en.locationId===locationId&&en.slot.toLowerCase()===slot.toLowerCase());
        if(previous&&previous.qty+qty>MAX_QTY){toast(`Too many copies of ${cardId}.`,true);return;}
      }
      let total=0;
      for(const [cardId,qty] of result.parsed){
        const known=catalogCard(cardId);
        const previous=state.data.entries.find(en=>en.cardId===cardId&&en.locationId===locationId&&en.slot.toLowerCase()===slot.toLowerCase());
        if(previous){previous.qty+=qty;previous.updatedAt=dateNow();}else state.data.entries.push({id:uid(),cardId,name:known?.name||cardId,qty,locationId,slot,note:'',rarity:known?.rarity||'',colors:known?.colors||'',updatedAt:dateNow()});
        total+=qty;
      }
      persist();closeModal();setView('inventory');toast(`Imported ${fmt(total)} cards from ${fmt(result.parsed.size)} IDs.`);return;
    }
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='catalogSearch'){state.query=e.target.value;state.perPage=48;paintFilterResults();}
    if(['catalogTrait','catalogEffect','catalogPowerMin','catalogPowerMax'].includes(e.target.id)){
      const map={catalogTrait:'trait',catalogEffect:'effect',catalogPowerMin:'powerMin',catalogPowerMax:'powerMax'};
      state.filters[map[e.target.id]]=e.target.value;state.perPage=48;paintFilterResults();
    }
    if(e.target.id==='inventorySearch'){
      const value=e.target.value;const start=e.target.selectionStart;
      state.inventoryQuery=value;render();const inp=document.querySelector('#inventorySearch');inp.focus();try{inp.setSelectionRange(start,start);}catch{}
    }
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='catalogSet'){state.set=e.target.value;state.perPage=48;paintFilterResults();}
    if(e.target.id==='catalogColor'){state.color=e.target.value;state.perPage=48;paintFilterResults();}
    if(e.target.dataset.filterCost!==undefined){const n=Number(e.target.dataset.filterCost);if(e.target.checked)state.filters.costs.add(n);else state.filters.costs.delete(n);state.perPage=48;paintFilterResults();}
    const map={catalogCategory:'category',catalogRarity:'rarity',catalogAttribute:'attribute',catalogCounter:'counter',catalogSort:'sort',catalogEffectMode:'effectMode',catalogEffectTarget:'effectTarget',catalogTraitMode:'traitMode',catalogOwned:'ownedOnly',catalogNoVariants:'hideVariants'};
    if(e.target.id in map){state.filters[map[e.target.id]]=e.target.type==='checkbox'?e.target.checked:e.target.value;state.perPage=48;paintFilterResults();}
    if(e.target.id==='activeDeck'){state.activeDeckId=e.target.value;render();}
    if(e.target.id==='reserveDeck'){const d=selectedDeck();if(d){d.reserved=e.target.checked;d.updatedAt=dateNow();persist();render();}}
    if(e.target.id==='savedFilterPreset'){const p=state.data.presets.find(x=>x.id===e.target.value);if(p)applySavedPreset(p);}
    if(e.target.id==='inventoryLocation'){state.inventoryLocation=e.target.value;render();}
    if(e.target.id==='scanPhoto' && e.target.files?.[0]){const file=e.target.files[0];e.target.value='';recognizePhoto(file);}
    if(e.target.id==='scanVariantSelect'){const input=document.querySelector('#scanCardId');if(input){input.value=e.target.value;syncScanCard();}}
    if(e.target.id==='scanCardId'){syncScanCard();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='scanCardId')syncScanCard();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalLayer.childElementCount)closeModal();});
  modalLayer.addEventListener('click',e=>{if(e.target.id==='modalOverlay')closeModal();});
  document.querySelector('#menuToggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  document.querySelector('#backupBtn').addEventListener('click',downloadBackup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden && scanner.stream){stopCamera();updateScanButtons();setScanStatus('Camera paused. Press Start camera to resume.');}});
  window.addEventListener('pagehide',()=>{stopCamera();if(scanner.worker)scanner.worker.terminate();});
  document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement && e.target.closest('.card-art,.card-cell,.modal-card-heading'))e.target.style.visibility='hidden';},true);

  function normalizeCatalog(source) {
    const records=Array.isArray(source)?source:Object.entries(source).map(([id,v])=>({...v,id:v?.id||id}));
    return records.map(c=>({
      id:safeId(c.id||c.card_id),name:String(c.name||''),rarity:String(c.rarity||c.category||''),
      colors:Array.isArray(c.colors)?c.colors.join(' / '):String(c.colors||''),
      category:String(c.category||''),set:String(c.set||''),
      cost:c.cost===null||c.cost===undefined||c.cost===''?null:Number(c.cost),
      power:c.power===null||c.power===undefined||c.power===''?null:Number(c.power),
      counter:c.counter===null||c.counter===undefined||c.counter===''?null:Number(c.counter),
      attributes:Array.isArray(c.attributes)?c.attributes.map(String):[],
      types:Array.isArray(c.types)?c.types.map(String):[],
      effect:String(c.effect||''),trigger:String(c.trigger||''),
      image:typeof c.image==='string'&&/^https:\/\//.test(c.image)?c.image:''
    })).filter(c=>validId(c.id)&&c.name).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  }
  async function loadCatalog() {
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),20000);
    try{
      let source, lastError;
      for(const url of [SOURCE,SOURCE_BACKUP]){
        try{const response=await fetch(url,{signal:abort.signal,cache:'default'});if(!response.ok)throw new Error(`HTTP ${response.status}`);source=await response.json();break;}
        catch(err){lastError=err;}
      }
      if(!source)throw lastError||new Error('Catalog unavailable');
      const cards=normalizeCatalog(source);if(cards.length<200)throw new Error('Incomplete English catalog');
      if(cards.filter(c=>c.types.length||c.effect||c.cost!==null).length<100)throw new Error('Catalog lacks detailed fields');
      state.catalog=cards;state.loaded=true;state.catalogError='';
      catalogStatus.textContent=`${fmt(cards.length)} English cards available`;catalogStatus.className='source-status ready';
      const byId=new Map(cards.map(c=>[c.id,c]));let modified=false;
      for(const entry of state.data.entries){const match=byId.get(entry.cardId);if(match&&entry.name===entry.cardId){entry.name=match.name;entry.rarity=match.rarity;entry.colors=match.colors;modified=true;}}
      if(modified)persist();
    }catch(err){state.catalog=fallbackCards;state.loaded=false;state.catalogError=err.message;
      catalogStatus.textContent='Catalog offline · limited search';catalogStatus.className='source-status offline';
      toast('Full card catalog unavailable. Saved inventory and decks still work.',true);
    }finally{clearTimeout(timeout);render();}
  }
  render();loadCatalog();
  try {sync.config=JSON.parse(localStorage.getItem(CLOUD_KEY)||'null');if(sync.config?.url&&sync.config?.key)connectCloud();}catch(err){console.warn('Cloud config unreadable',err);}
  // Make the initial catalog panel useful even before network finishes.
  if(state.view==='catalog')paintCatalog();
})();
