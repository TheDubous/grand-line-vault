/* Grand Line Vault v1.2.3 — cloud-first shared inventory and standard-card OCR.
   Existing collections migrated by 01-CREATE-AND-MIGRATE.sql. */
(() => {
  'use strict';

  const KEY = 'grand-line-vault-v1';
  const SOURCE = 'https://cdn.jsdelivr.net/gh/michalkiral/optcg-data-limitless@main/data/index/cards_by_id.json';
  const SOURCE_BACKUP = 'https://raw.githubusercontent.com/michalkiral/optcg-data-limitless/main/data/index/cards_by_id.json';
  const SOURCE_FALLBACK = 'https://raw.githubusercontent.com/michalkiral/optcg-data/main/data/index/cards_by_id.json';
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
  const SCANNER_BOX_KEY = 'grand-line-vault-last-box-v1';
  const scanner = {stream:null,worker:null,workerLoading:null,scriptLoading:null,busy:false,session:0,lastLocationId:(localStorage.getItem(SCANNER_BOX_KEY)||'box-1'),lastSlot:'',saved:0, autoEnabled:true, autoPaused:false, autoTimer:null, scanToken:0, autoHistory:[], autoAttempt:0, autoIgnoreId:'', autoClearFrames:0, facing:'environment', dialogOpen:false, matchId:'', nameCandidates:[], detectedName:''};
  const state = {view:'dashboard', data:loadData(), catalog:[], loaded:false, catalogError:'', catalogLoadedAt:null, query:'', color:'all', set:'all', perPage:48, inventoryQuery:'', inventoryLocation:'all', activeDeckId:'', filters: {effect:'',effectMode:'all',effectTarget:'both',trait:'',traitMode:'any',category:'all',rarity:'all',attribute:'all',counter:'all',powerMin:'',powerMax:'',costs:new Set(),ownedOnly:false,sort:'id',hideVariants:false}};
  const CLOUD_KEY = 'grand-line-vault-cloud-settings-v1';

  // v1.2: Supabase is the only editable source; localStorage is read-only cache.
  const sync={client:null,user:null,ready:false,busy:false,connecting:false,config:null,lastStatus:'Sign in to edit',lastSuccess:null,diagnostic:'Not connected',pendingEmail:'',baseline:null,optimistic:null,queue:[],writing:false,loading:false,dirty:false,refreshTimer:null,channel:null,lastWrite:Promise.resolve(),writeError:null};
  const copyData=d=>JSON.parse(JSON.stringify(d));
  function syncStatus(message){sync.lastStatus=message;const el=document.querySelector('#cloudState');if(el)el.textContent=message;updateCloudBadge();}
  function updateCloudBadge(){
    const el=document.querySelector('#globalCloudStatus');if(!el)return;
    const label=sync.writing?'Saving to cloud…':sync.ready?'Cloud live · synced':sync.user?'Cloud unavailable':'Sign in · read only';
    el.textContent=label;el.dataset.state=sync.ready?(sync.writing?'warning':'synced'):'warning';el.title=sync.lastStatus;
  }
  function entryKey(e){return `${String(e.cardId).toUpperCase()}\u0000${String(e.locationId)}\u0000${String(e.slot||'').trim().toLowerCase()}`;}
  function objectPatches(before,after,kind){
    const a=new Map(before.map(x=>[x.id,x])),b=new Map(after.map(x=>[x.id,x]));const patches=[];
    for(const id of new Set([...a.keys(),...b.keys()])){
      const old=a.get(id)||null,now=b.get(id)||null;
      if(JSON.stringify(old)!==JSON.stringify(now))patches.push({kind,id,before:old,after:now});
    }
    return patches;
  }
  function diffData(before,after){
    const early=[],later=[];
    for(const op of objectPatches(before.locations,after.locations,'locations'))(op.after?early:later).push(op);
    const a=new Map(before.entries.map(x=>[entryKey(x),x])),b=new Map(after.entries.map(x=>[entryKey(x),x]));
    const changes=[];
    for(const key of new Set([...a.keys(),...b.keys()])){
      const old=a.get(key),now=b.get(key);const delta=(now?.qty||0)-(old?.qty||0);
      if(delta){const e=now||old;changes.push({kind:'inventory',cardId:e.cardId,locationId:e.locationId,slot:String(e.slot||'').trim().toLowerCase(),delta,name:e.name||e.cardId,rarity:e.rarity||'',colors:e.colors||'',note:e.note||''});}
      if(old&&now&&['name','note','rarity','colors'].some(k=>(old[k]||'')!==(now[k]||''))){
        const fields=e=>({name:e.name||'',note:e.note||'',rarity:e.rarity||'',colors:e.colors||''});
        changes.push({kind:'inventory_meta',cardId:now.cardId,locationId:now.locationId,slot:String(now.slot||'').trim().toLowerCase(),before:fields(old),after:fields(now)});
      }
    }
    return [...early,...changes,...later,...objectPatches(before.decks,after.decks,'decks'),...objectPatches(before.presets,after.presets,'presets')];
  }
  function restoreCloudSnapshot(message){
    state.data=copyData(sync.baseline||loadData());sync.optimistic=copyData(state.data);
    if(state.view!=='scan')render();syncStatus(message);toast(message,true);
  }
  function canEditNow(){return !!(sync.ready&&sync.user&&navigator.onLine);}
  function requireCloudEdit(){if(canEditNow())return true;toast('Sign in and connect to the shared cloud before changing cards or decks.',true);return false;}
  function persist(){
    if(!sync.ready||!sync.user||!navigator.onLine){
      restoreCloudSnapshot('Cloud unavailable: this change was NOT saved. Reconnect before editing.');return false;
    }
    const before=sync.optimistic||sync.baseline||state.data,after=copyData(state.data);
    const ops=diffData(before,after);
    if(!ops.length)return true;
    sync.optimistic=after;
    for(let i=0;i<ops.length;i+=200){sync.queue.push({id:uid(),ops:ops.slice(i,i+200)});}
    syncStatus('Saving to the shared cloud…');
    sync.lastWrite=flushCloudQueue();
    return true;
  }
  async function flushCloudQueue(){
    if(sync.writing)return sync.currentFlush||Promise.resolve();
    sync.writing=true;
    sync.currentFlush=(async()=>{
      try{
        while(sync.queue.length){
          const item=sync.queue[0];
          // Supabase RPC runs the entire batch in one Postgres transaction.
          const {error}=await sync.client.rpc('vault_v12_apply',{p_request_id:item.id,p_ops:item.ops});
          if(error)throw error;
          sync.queue.shift();sync.lastSuccess=new Date();
        }
        sync.baseline=copyData(sync.optimistic);syncStatus('All changes saved to shared cloud');sync.writeError=null;
      }catch(err){
        sync.writeError=err;
        sync.ready=false;sync.queue.length=0;
        restoreCloudSnapshot('Cloud save failed: '+(err.message||String(err))+'. Refresh before editing.');
      }finally{
        sync.writing=false;sync.currentFlush=null;updateCloudBadge();
        if(sync.user)await establishCloud({silent:true});
      }
    })();
    return sync.currentFlush;
  }
  async function waitForCloudSave(){const pending=sync.currentFlush||sync.lastWrite;await pending;return Boolean(sync.ready&&!sync.writeError);}
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
  const miniImg = (id) => `<img class="card-mini" loading="lazy" src="${escapeHtml(catalogCard(id)?.image||imageUrl(id))}" alt=""/>`;
  const cardMeta = card => [card.rarity,card.colors || ''].filter(Boolean).join(' · ') || card.category || 'One Piece TCG';


  // Camera access requires HTTPS (such as GitHub Pages) or localhost; photo import is the fallback.
  function scanView() {
    return pageHeading('FAST CARD ENTRY','Scan your cards','Place the printed name in the pink window and the card number in the blue window. Auto-detect or press Capture.',`<button class="button btn-outline" data-view="inventory" type="button">View inventory →</button>`)+
    `<div class="scanner-layout"><section class="panel scanner-panel">
      <div class="scan-preview" id="scanPreview"><video id="scanVideo" autoplay playsinline muted></video><div class="scan-placeholder" id="scanPlaceholder"><span class="scan-camera-icon">◎</span><strong>Point your camera at one card</strong><small>Align its printed name and ID with the two colored windows.</small></div><div class="scan-name-target scan-ocr-target" aria-hidden="true"><span>NAME</span></div><div class="scan-id-target scan-ocr-target" aria-hidden="true"><span>ID</span></div></div>
      <div class="scan-guide-legend" aria-hidden="true"><span><i></i>Card name</span><span><i class="id-swatch"></i>Printed ID</span></div><p class="scan-hint">Only the name and ID need to be readable. The whole card does not have to fit inside an outline.</p><div class="scanner-controls"><button class="button btn-primary" type="button" id="scanStart" data-action="start-camera">◎ Start camera</button><button class="button btn-primary" type="button" id="scanCapture" data-action="capture-card" disabled>▣ Capture card</button><button class="button btn-outline scan-auto" type="button" id="scanAuto" data-action="toggle-auto" aria-pressed="${scanner.autoEnabled}">${scanner.autoEnabled?'● Auto on':'○ Auto off'}</button><button class="button btn-outline" type="button" id="scanFlip" data-action="flip-camera" disabled>⇄ Flip</button><button class="button btn-ghost" type="button" id="scanStop" data-action="stop-camera" disabled>Stop</button></div>
      <label class="photo-import button btn-outline">↥ Use photo instead<input id="scanPhoto" type="file" accept="image/*" capture="environment" /></label>
      <p class="scan-status" id="scanStatus" role="status" aria-live="polite">Start the camera. Detection will suggest a card automatically, or tap Capture card.</p>
      <div class="scan-session"><strong>Cards saved in this session: <span id="scanSaved">${fmt(scanner.saved)}</span></strong><span id="scanResult"></span></div>
      <details class="scan-diagnostics"><summary>Having trouble? Open OCR diagnostics</summary><p id="scanDiagnostics">No recognition attempted yet.</p><canvas id="scanCropPreview" aria-label="Latest close-up used for OCR"></canvas></details>
      <p class="hint">Frames are analyzed on your device. The popup uses English card catalog images. Camera frames are processed temporarily and discarded.</p>
    </section></div>`;
  }

  const isCardCode = id => /^(?:(?:OP|ST|EB|PRB)\d{1,3}-\d{2,4}|P-\d{2,4})(?:_p\d+)?$/i.test(id);
  function detectPrintedIds(text) {
    const found=[];
    const input=String(text||'').toUpperCase().replace(/[‐‑–—−]/g,'-').replace(/[\r\n]+/g,' ');
    const normalizeNum=x=>String(x).replace(/[OQD]/g,'0').replace(/[IL|]/g,'1').replace(/Z/g,'2').replace(/S/g,'5').replace(/G/g,'6').replace(/B/g,'8');
    const add=id=>{if(isCardCode(id)&&!found.includes(id))found.push(id);};
    // First, prefer ordinary IDs. The digits after the three-digit card number
    // can be a rarity indicator or DON count recognized as more digits.
    let match;
    const standard=/(?:^|[^A-Z0-9])((?:[O0]P|ST|EB|PRB))\s*[- ]?\s*([0-9OQDILSBZG]{1,3})\s*[- .:_,~]\s*([0-9OQDILSBZG]{3})/g;
    while((match=standard.exec(input))!==null){
      const prefix=match[1].replace(/^0P/,'OP');
      add(`${prefix}${normalizeNum(match[2]).padStart(2,'0')}-${normalizeNum(match[3])}`);
    }
    const compact=/(?:^|[^A-Z0-9])((?:[O0]P|ST|EB|PRB))\s*([0-9OQDILSBZG]{2})([0-9OQDILSBZG]{3})/g;
    while((match=compact.exec(input))!==null){
      add(`${match[1].replace(/^0P/,'OP')}${normalizeNum(match[2])}-${normalizeNum(match[3])}`);
    }
    const promo=/(?:^|[^A-Z0-9])P\s*-\s*([0-9OQDILSBZG]{2,4})(?![A-Z0-9])/g;
    while((match=promo.exec(input))!==null)add(`P-${normalizeNum(match[1]).padStart(3,'0')}`);
    // The tiny O in OP16-113 is occasionally lost at the edge of the OCR crop.
    // This fallback only triggers for a two-digit numbered set plus 3 digits.
    const missingO=/(?:^|[^A-Z0-9])P\s*([0-9OQDILSBZG]{2})\s*-\s*([0-9OQDILSBZG]{3})/g;
    while((match=missingO.exec(input))!==null)add(`OP${normalizeNum(match[1])}-${normalizeNum(match[2])}`);
    return found;
  }
  function setScanStatus(message) {const el=document.querySelector('#scanStatus');if(el)el.textContent=message;}
  function setScanDiagnostics(message){const el=document.querySelector('#scanDiagnostics');if(el)el.textContent=String(message||'No text recognized').slice(0,450);}
  function setScanResult(markup) {const el=document.querySelector('#scanResult');if(el)el.innerHTML=markup||empty('▤','Ready for the next card','Present the next card to the live camera. The app will identify it automatically.');}
  function updateScanButtons() {
    if(state.view!=='scan')return;
    const ready=Boolean(scanner.stream)&&!scanner.busy;
    const capture=document.querySelector('#scanCapture'),start=document.querySelector('#scanStart'),stop=document.querySelector('#scanStop'),auto=document.querySelector('#scanAuto'),flip=document.querySelector('#scanFlip');
    if(capture)capture.disabled=!ready;
    if(start){start.disabled=scanner.busy||!!scanner.stream;start.textContent=scanner.stream?'Camera running':'◎ Start rear camera';}
    if(stop)stop.disabled=!scanner.stream;
    if(flip)flip.disabled=!scanner.stream||scanner.busy;
    if(auto){auto.textContent=scanner.autoEnabled?'● Automatic detection ON':'○ Automatic detection OFF';auto.setAttribute('aria-pressed',String(scanner.autoEnabled));auto.classList.toggle('is-on',scanner.autoEnabled);}
    const picker=document.querySelector('#scanPhoto');if(picker)picker.disabled=scanner.busy;
  }
  function clearAutoTimer(){if(scanner.autoTimer!==null){clearTimeout(scanner.autoTimer);scanner.autoTimer=null;}}
  function clearAutoProgress(){scanner.autoHistory=[];scanner.autoAttempt=0;scanner.autoClearFrames=0;}
  function scheduleAutoScan(delay=900){
    clearAutoTimer();
    if(state.view!=='scan'||!scanner.stream||!scanner.autoEnabled||scanner.autoPaused||scanner.busy||document.hidden)return;
    scanner.autoTimer=setTimeout(()=>{scanner.autoTimer=null;runAutoScan();},delay);
  }
  function stopCamera(){
    clearAutoTimer();scanner.scanToken++;clearAutoProgress();scanner.autoPaused=false;scanner.autoIgnoreId='';
    const current=scanner.stream;scanner.stream=null;
    if(current)current.getTracks().forEach(track=>track.stop());
    const video=document.querySelector('#scanVideo');if(video)video.srcObject=null;
    const placeholder=document.querySelector('#scanPlaceholder');if(placeholder)placeholder.hidden=false;
    const preview=document.querySelector('#scanPreview');if(preview)preview.classList.remove('live');
  }
  function toggleAuto(){
    scanner.autoEnabled=!scanner.autoEnabled;
    scanner.autoPaused=false;scanner.scanToken++;clearAutoProgress();scanner.autoIgnoreId='';clearAutoTimer();
    if(scanner.autoEnabled){setScanResult('');setScanStatus(scanner.stream?'Automatic detection enabled. Align the card name in pink and its printed ID in blue.':'Automatic detection enabled. Start the camera.');scheduleAutoScan(400);}
    else setScanStatus('Automatic detection paused. Use Capture once to recognize a card manually.');
    updateScanButtons();
  }
  async function flipCamera(){
    if(scanner.busy||!scanner.stream)return;
    scanner.facing=scanner.facing==='environment'?'user':'environment';
    stopCamera();updateScanButtons();await startCamera();
  }
  async function startCamera(){
    if(scanner.stream||scanner.busy)return;
    if(!navigator.mediaDevices?.getUserMedia){setScanStatus('Live camera is not available here. Open the app at its GitHub Pages HTTPS address or choose Take / upload photo.');return;}
    const session=scanner.session;
    setScanStatus('Requesting permission for rear camera…');
    try {
      // Ask for the selected lens explicitly on phones; ideal-only constraints
      // can silently select a front-facing camera on some devices.
      let stream;
      try{stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:scanner.facing},width:{ideal:1920},height:{ideal:1080}}});}
      catch(err){if(!['OverconstrainedError','NotFoundError','TypeError'].includes(err.name))throw err;
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:scanner.facing},width:{ideal:1920},height:{ideal:1080}}});
      }
      if(session!==scanner.session||state.view!=='scan'){stream.getTracks().forEach(track=>track.stop());return;}
      scanner.stream=stream;
      const video=document.querySelector('#scanVideo');if(!video){stopCamera();return;}
      video.srcObject=stream;
      await video.play();
      if(session!==scanner.session||!scanner.stream){stopCamera();return;}
      document.querySelector('#scanPlaceholder').hidden=true;
      document.querySelector('#scanPreview').classList.add('live');
      const actualLens=stream.getVideoTracks()[0]?.getSettings?.().facingMode;
      setScanStatus(actualLens==='user'?'Front camera selected. Use Switch camera to try the rear lens and get sharper card text.':scanner.autoEnabled?'Automatic detection active. Keep the name near pink and the printed code near blue.':'Camera ready. Use Capture once.');
      updateScanButtons();scheduleAutoScan(600);
    }catch(err){stopCamera();setScanStatus('Could not start camera: '+(err.name==='NotAllowedError'?'permission denied. Allow camera in browser settings, or use Take / upload photo.':`${err.message || 'camera not available'}. You can still use a photo.`));updateScanButtons();}
  }
  function scaledCanvas(source,width,height,maxEdge=1800) {
    if(!width||!height)throw new Error('Image could not be decoded.');
    const scale=Math.min(1,maxEdge/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(source,0,0,canvas.width,canvas.height);
    return canvas;
  }
  function visibleCameraCanvas(video,maxEdge=2100){
    // object-fit:cover means the displayed portrait preview is a CROP of the
    // intrinsic camera stream (often landscape on iPhones). Analyze that crop,
    // not the full frame: the printed code is otherwise dramatically smaller.
    const w=video.videoWidth,h=video.videoHeight;
    if(!w||!h)throw new Error('Camera not ready.');
    const rect=video.getBoundingClientRect();
    const aspect=(rect.width>0&&rect.height>0)?rect.width/rect.height:w/h;
    let sx=0,sy=0,sw=w,sh=h;
    if(w/h>aspect){sw=Math.min(w,h*aspect);sx=(w-sw)/2;}
    else {sh=Math.min(h,w/aspect);sy=(h-sh)/2;}
    const factor=Math.min(1,maxEdge/Math.max(sw,sh));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(sw*factor));canvas.height=Math.max(1,Math.round(sh*factor));
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(video,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    return canvas;
  }
  async function captureCard(){
    if(scanner.busy||!scanner.stream)return;
    const video=document.querySelector('#scanVideo');
    if(!video||!video.videoWidth){setScanStatus('Camera is still warming up. Try again.');return;}
    clearAutoTimer();scanner.autoPaused=true;scanner.autoIgnoreId='';clearAutoProgress();scanner.nameCandidates=[];scanner.detectedName='';
    await recognizeCanvas(visibleCameraCanvas(video,2100),{fromCamera:true});
  }
  async function recognizePhoto(file){
    if(!file||scanner.busy)return;
    if(!file.type.startsWith('image/')){setScanStatus('Choose an image file.');return;}
    if(file.size>25*1024*1024){setScanStatus('Image is too large; please choose one smaller than 25 MB.');return;}
    const session=scanner.session;
    clearAutoTimer();scanner.autoPaused=true;scanner.autoIgnoreId='';clearAutoProgress();scanner.nameCandidates=[];scanner.detectedName='';
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
      await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'});
      scanner.worker=worker;return worker;
    })().catch(err=>{scanner.workerLoading=null;throw err;});
    return scanner.workerLoading;
  }
  function ocrCrop(source,{left=0,top=.5,width=1,height=.5,scale=3,highContrast=false}={}){
    const x=Math.max(0,Math.floor(source.width*left)),y=Math.max(0,Math.floor(source.height*top));
    const sw=Math.max(1,Math.min(source.width-x,Math.floor(source.width*width)));
    const sh=Math.max(1,Math.min(source.height-y,Math.floor(source.height*height)));
    const factor=Math.min(scale,2200/sw,1600/sh);
    const crop=document.createElement('canvas');
    crop.width=Math.max(1,Math.round(sw*factor));crop.height=Math.max(1,Math.round(sh*factor));
    const ctx=crop.getContext('2d',{willReadFrequently:true});
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    // Keep grayscale smooth: harsh thresholding can destroy thin 1 or 3 glyphs.
    ctx.filter=highContrast?'grayscale(1) contrast(2.2) brightness(1.05)':'grayscale(1) contrast(1.55) brightness(1.06)';
    ctx.drawImage(source,x,y,sw,sh,0,0,crop.width,crop.height);
    return crop;
  }
  function showOcrCrop(canvas, label=''){
    const el=document.querySelector('#scanCropPreview');
    if(!el)return;
    el.width=canvas.width;el.height=canvas.height;
    el.getContext('2d').drawImage(canvas,0,0);
    el.setAttribute('aria-label',`OCR crop: ${label}`);
  }
  function bestCandidate(ids){
    // Favor known card IDs; names/artwork must still be manually confirmed.
    return [...ids].sort((a,b)=>Number(Boolean(catalogCard(b)))-Number(Boolean(catalogCard(a))))[0]||'';
  }
  // The blue overlay and OCR primary crop use the SAME live camera rectangle.
  // Both getBoundingClientRect coordinates refer to the object-fit:cover preview;
  // visibleCameraCanvas() captures those exact pixels from the video stream.
  function scannerGuideRect(selector){
    const frame=document.querySelector('#scanPreview'), element=document.querySelector(selector);
    if(!frame||!element||!frame.classList?.contains('live')||!frame.getBoundingClientRect||!element.getBoundingClientRect)return null;
    const a=frame.getBoundingClientRect(), b=element.getBoundingClientRect();
    if(a.width<=0||a.height<=0||b.width<=0||b.height<=0)return null;
    const left=Math.max(0,Math.min(1,(b.left-a.left)/a.width));
    const top=Math.max(0,Math.min(1,(b.top-a.top)/a.height));
    return {left,top,width:Math.max(.01,Math.min(1-left,b.width/a.width)),height:Math.max(.01,Math.min(1-top,b.height/a.height))};
  }
  function expandedScanRegion(rect,dx,dy,label,scale){
    const left=Math.max(0,rect.left-dx),top=Math.max(0,rect.top-dy);
    return {label,left,top,width:Math.min(1-left,rect.left+rect.width+dx-left),height:Math.min(1-top,rect.top+rect.height+dy-top),scale};
  }
  function scanIdRegions(fromCamera){
    // Both OCR targets are direct children of the preview. This avoids the
    // old nested card frame, which did not match cards held close to a phone.
    const focus=fromCamera&&scannerGuideRect('.scan-id-target');
    if(focus)return [
      {...focus,label:'BLUE · printed ID',scale:4.4},
      expandedScanRegion(focus,.05,.035,'ID · expanded',3.6),
      expandedScanRegion(focus,.10,.07,'ID · wide',3),
      {label:'lower-right safety scan',left:.52,top:.73,width:.45,height:.23,scale:2.6}
    ];
    return [
      {label:'photo bottom right',left:.51,top:.75,width:.40,height:.15,scale:3.5},
      {label:'photo bottom-right expanded',left:.44,top:.67,width:.50,height:.24,scale:2.8},
      {label:'photo lower',left:.43,top:.80,width:.53,height:.18,scale:3},
      {label:'photo whole lower edge',left:.15,top:.63,width:.80,height:.34,scale:2.2}
    ];
  }
  function scanNameRegions(fromCamera){
    const focus=fromCamera&&scannerGuideRect('.scan-name-target');
    if(focus)return [
      {...focus,label:'PINK · printed name',scale:3.5},
      expandedScanRegion(focus,.07,.025,'name · expanded',3),
      {label:'name · lower card fallback',left:.17,top:.68,width:.70,height:.20,scale:2.5}
    ];
    return [
      {label:'photo name band',left:.16,top:.71,width:.70,height:.17,scale:3.3},
      {label:'photo name fallback',left:.10,top:.64,width:.80,height:.25,scale:2.5}
    ];
  }
  async function recognizeIdFrame(canvas,worker,{quick=false,attempt=0,fromCamera=false}={}){
    const regions=scanIdRegions(fromCamera);
    const order=quick?(attempt%3===0?[2,0]:attempt%2===0?[1,0]:[0,1]):[0,1,2,3];
    let text='', candidates=[], lastRegion='';
    for(const idx of order){
      const opts=regions[idx];
      const crop=ocrCrop(canvas,{...opts,highContrast:idx===2});
      showOcrCrop(crop,opts.label);
      // 7 = one line, more suitable for card codes than sparse-text mode 11.
      await worker.setParameters({tessedit_pageseg_mode:idx===3?'11':'7',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'});
      const response=await worker.recognize(crop);
      const line=String(response?.data?.text||'').trim();
      lastRegion=opts.label;
      text+=`${opts.label}: ${line||'(none)'}\n`;
      candidates=detectPrintedIds(line);
      if(candidates.length)break;
    }
    // Manual Capture can afford a fallback that searches more of the frame.
    if(!candidates.length&&!quick){
      await worker.setParameters({tessedit_pageseg_mode:'11',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'});
      const resp=await worker.recognize(canvas);
      const line=String(resp?.data?.text||'').trim();
      text+=`whole image: ${line||'(none)'}\n`;
      candidates=detectPrintedIds(line);
    }
    return {ids:candidates,text:text.trim(),lastRegion};
  }
  async function runAutoScan(){
    if(scanner.busy||!scanner.stream||scanner.autoPaused||!scanner.autoEnabled||state.view!=='scan'||document.hidden)return;
    const video=document.querySelector('#scanVideo');
    if(!video||!video.videoWidth){scheduleAutoScan(800);return;}
    const session=scanner.session, token=scanner.scanToken;
    scanner.busy=true;scanner.autoAttempt++;
    updateScanButtons();setScanStatus('Scanning the ID and name areas…');
    try{
      const canvas=visibleCameraCanvas(video,2100);
      const worker=await getOcrWorker();
      if(token!==scanner.scanToken||session!==scanner.session||!scanner.stream)return;
      const result=await recognizeIdFrame(canvas,worker,{quick:true,attempt:scanner.autoAttempt,fromCamera:true});
      if(token!==scanner.scanToken||session!==scanner.session||!scanner.stream||state.view!=='scan')return;
      setScanDiagnostics(`Image analyzed: ${canvas.width}×${canvas.height}px.\n`+(result.text.trim()||'(no readable text)'));
      let found=bestCandidate(result.ids);
      if(found){scanner.nameCandidates=[];scanner.detectedName='';}
      if(!found&&state.loaded&&scanner.autoAttempt%4===0){
        const fallback=await recognizeNameFallback(canvas,worker,{fromCamera:true});found=fallback.id;
        scanner.nameCandidates=fallback.candidates||[];scanner.detectedName=fallback.name||'';
        if(fallback.text)setScanDiagnostics((result.text||'')+'\nName OCR: '+fallback.text);
        if(!found&&fallback.candidates?.length>1)setScanStatus(`Name detected: ${fallback.name}. Multiple card IDs share this name — use Capture to choose one.`);
      }
      if(found===scanner.autoIgnoreId){
        // The just-saved card is still in view. Do not immediately scan it again.
        scanner.autoClearFrames=0;scanner.autoHistory=[];
        setScanStatus(`${found} is already saved. Remove it and present the next card.`);
      }else if(!found){
        scanner.autoHistory.push('');scanner.autoHistory=scanner.autoHistory.slice(-4);
        if(scanner.autoIgnoreId && ++scanner.autoClearFrames>=2)scanner.autoIgnoreId='';
        setScanStatus(scanner.nameCandidates.length>1?`Name found: ${scanner.detectedName}. Multiple IDs exist; tap Capture to choose the correct one.`:'Looking for the printed ID… Keep the blue target over the number and the pink target over the name.');
      }else{
        scanner.autoClearFrames=0;
        scanner.autoHistory.push(found);scanner.autoHistory=scanner.autoHistory.slice(-4);
        const hits=scanner.autoHistory.filter(id=>id===found).length;
        const needed=catalogCard(found)?2:3;
        if(hits>=needed){
          scanner.autoPaused=true;clearAutoTimer();
          renderScanMatch(found,false);
          setScanStatus(`Detected ${found} automatically. Confirm the English card and box, or scan again.`);
        }else setScanStatus(`Possible ${found} (${hits}/${needed} checks). Hold steady for confirmation…`);
      }
    }catch(err){
      if(token===scanner.scanToken&&state.view==='scan'){
        scanner.autoEnabled=false;clearAutoTimer();
        setScanStatus(`Automatic OCR unavailable: ${err.message||err}. Use Capture once, Take / upload photo, or turn Auto on to retry.`);
      }
    }finally{
      scanner.busy=false;updateScanButtons();scheduleAutoScan(850);
    }
  }
  function normalizeCardName(s){return String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
  function editDistance(a,b){
    let previous=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const next=[i];
      for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,previous[j]+1,previous[j-1]+(a[i-1]===b[j-1]?0:1));
      previous=next;
    }
    return previous[b.length];
  }
  function findCardsByName(raw){
    const normalized=normalizeCardName(raw);
    if(normalized.length<4||!/^[a-z]/.test(normalized))return [];
    const exact=state.catalog.filter(c=>normalizeCardName(c.name)===normalized);
    if(exact.length)return [...new Map(exact.map(c=>[baseCardId(c.id),c])).values()];
    // OCR sometimes confuses a letter in large card names. Fuzzy matching only
    // returns a name when there is a *clear*, unique best name, not a guess.
    if(normalized.length<6)return [];
    const uniqueNames=new Map();
    for(const c of state.catalog){const name=normalizeCardName(c.name);if(name.length>=5 && !uniqueNames.has(name))uniqueNames.set(name,[]);if(uniqueNames.has(name))uniqueNames.get(name).push(c);}
    let bestName='',bestScore=0,secondScore=0;
    for(const name of uniqueNames.keys()){
      if(Math.abs(name.length-normalized.length)>Math.max(2,normalized.length*.2))continue;
      const score=1-editDistance(normalized,name)/Math.max(name.length,normalized.length);
      if(score>bestScore){secondScore=bestScore;bestScore=score;bestName=name;}
      else if(score>secondScore)secondScore=score;
    }
    if(bestScore<.86||bestScore-secondScore<.09)return [];
    return [...new Map(uniqueNames.get(bestName).map(c=>[baseCardId(c.id),c])).values()];
  }
  function findCardByName(raw){const matches=findCardsByName(raw);return matches.length===1?baseCardId(matches[0].id):'';}
  async function recognizeNameFallback(canvas,worker,{fromCamera=false}={}){
    const regions=scanNameRegions(fromCamera),texts=[];
    let matches=[];
    try{
      // Restore spaces and mixed case: the ID-only whitelist blocks real names.
      await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'7'});
      for(const opts of regions){
        const crop=ocrCrop(canvas,opts);
        showOcrCrop(crop,opts.label);
        await worker.setParameters({tessedit_pageseg_mode:opts.label.includes('fallback')?'11':'7'});
        const result=await worker.recognize(crop);
        const lines=String(result?.data?.text||'').split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
        texts.push(`${opts.label}: ${lines.join(' | ')||'(none)'}`);
        for(const line of lines){
          matches=findCardsByName(line);
          if(matches.length)return {id:matches.length===1?baseCardId(matches[0].id):'',text:texts.join('\n'),name:matches[0].name,candidates:matches};
        }
      }
    }finally{
      await worker.setParameters({tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'});
    }
    return {id:'',text:texts.join('\n'),name:'',candidates:[]};
  }
  async function recognizeCanvas(canvas,{fromCamera=false}={}){
    if(scanner.busy)return;
    clearAutoTimer();scanner.autoPaused=true;
    scanner.busy=true;const session=scanner.session,token=scanner.scanToken;updateScanButtons();
    setScanResult(`<div class="scan-working"><span class="scan-spinner"></span><h3>Recognizing card number…</h3><p>This can take longer on the first scan.</p></div>`);
    setScanStatus('Analyzing the bottom card-number region…');
    try {
      const worker=await getOcrWorker();
      if(token!==scanner.scanToken||session!==scanner.session||state.view!=='scan')return;
      const result=await recognizeIdFrame(canvas,worker,{fromCamera});
      if(token!==scanner.scanToken||session!==scanner.session||state.view!=='scan')return;
      setScanDiagnostics(`Image analyzed: ${canvas.width}×${canvas.height}px.\n`+(result.text.trim()||'(no readable text)'));
      let id=bestCandidate(result.ids);
      if(id){scanner.nameCandidates=[];scanner.detectedName='';}
      if(!id && state.loaded){
        const alt=await recognizeNameFallback(canvas,worker,{fromCamera});id=alt.id;
        scanner.nameCandidates=alt.candidates||[];scanner.detectedName=alt.name||'';
        setScanDiagnostics((result.text||'')+'\nCard-name fallback: '+(alt.text||'(none)'));
      }
      renderScanMatch(id,!id);
      setScanStatus(id?'Possible ID found — confirm the standard English card before saving.':scanner.nameCandidates.length>1?'Name recognized, but more than one card has this name. Choose the correct ID in the popup.':'No ID found. Check the blue number window and pink name window, or enter the ID manually.');
    }catch(err){if(session===scanner.session&&state.view==='scan'){renderScanMatch('',true);setScanStatus(`Recognition failed: ${err.message}. You can type the printed ID manually.`);}}
    finally{scanner.busy=false;updateScanButtons();}
  }
  function variantOptions(baseId) {
    if(!baseId)return [];
    const base=baseId.replace(/_p\d+$/i,'');
    return state.catalog.filter(c=>c.id===base||c.id.startsWith(`${base}_p`)).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  }
  // Scan confirmations live in the modal layer above the camera, not in the
  // below-camera result column. Camera remains open but automatic OCR pauses.
  function scanImageHtml(id, known){
    const src=known?.image||imageUrl(baseCardId(id));
    return `<div class="scan-popup-art"><img class="scan-confirm-image" id="scanMatchImage" data-fallback-src="${escapeHtml(imageUrl(id))}" data-attempt="0" src="${escapeHtml(src)}" alt="Catalog image of ${escapeHtml(known?.name||id||'card')}"/><div class="scan-art-fallback" hidden>Card image unavailable</div></div>`;
  }
  function scanModal(content,step){
    scanner.dialogOpen=true;scanner.autoPaused=true;clearAutoTimer();
    modalLayer.innerHTML=`<div class="modal-overlay scan-modal-overlay" id="modalOverlay"><section class="modal scan-modal" role="dialog" aria-modal="true" aria-label="${step==='confirm'?'Confirm detected card':'Add scanned card'}"><button class="modal-close" type="button" data-action="scan-reject" aria-label="Close card scanner dialog">×</button>${content}</section></div>`;
    const first=modalLayer.querySelector(step==='edit'?'.scan-save-buttons [type="submit"]':'[data-action="scan-reject"]');
    first?.focus({preventScroll:true});
  }
  function resumeScanning({ignoreId='',message='Ready for the next card.'}={}){
    scanner.dialogOpen=false;scanner.matchId='';closeModal();
    scanner.autoPaused=false;scanner.autoIgnoreId=ignoreId;scanner.autoClearFrames=0;
    scanner.scanToken++;clearAutoProgress();
    setScanResult('');setScanStatus(message);updateScanButtons();scheduleAutoScan(950);
  }
  function renderScanMatch(detectedId,manual=false){
    if(state.view!=='scan')return;
    const id=baseCardId(safeId(detectedId));
    scanner.matchId=id;
    renderScanEditor(id,manual);
    setScanResult('');
  }
  function renderScanEditor(detectedId='',manual=false){
    const id=baseCardId(safeId(detectedId)),known=catalogCard(id),variants=[];
    scanner.matchId=id;
    const nameChoices=!id&&scanner.nameCandidates.length?`<label class="scan-candidate-label">Detected name: ${escapeHtml(scanner.detectedName)} — choose the matching card ID<select id="scanCandidateSelect" class="select"><option value="">Choose card ID…</option>${scanner.nameCandidates.slice(0,50).map(c=>`<option value="${escapeHtml(baseCardId(c.id))}">${escapeHtml(baseCardId(c.id))} · ${escapeHtml(c.name)} · ${escapeHtml(c.colors||'')}</option>`).join('')}</select></label>`:'';
    const pic=scanImageHtml(id,known);
    const ambiguous=!known || !known.image;
    scanModal(`<div class="scan-popup-eyebrow">${manual?'MANUAL CARD MATCH':'CARD FOUND'}</div><h2>${manual?'Enter the card number':'Is this your card?'}</h2>
      <form data-form="scan-add" class="scan-add-form">
      <div class="scan-match-card scan-popup-match">${pic}<div><strong id="scanMatchName">${escapeHtml(known?.name||'Card not in catalog')}</strong><span id="scanMatchMeta">${escapeHtml((id||'Unknown ID')+(known?.colors?' · '+known.colors:''))}</span><small id="scanOwnedCount">${fmt(qtyFor(id))} already owned</small>${ambiguous?'<small class="scan-art-warning">Catalog picture unavailable. Confirm the ID before saving.</small>':''}</div></div>
      ${nameChoices}<div class="scan-fields-two"><label>Copies<input class="field" name="qty" type="number" min="1" max="${MAX_QTY}" value="1" required /></label><label>Box<select class="select" name="locationId">${locationOptions(scanner.lastLocationId)}</select></label></div>
      <details class="scan-advanced"><summary>Wrong ID or name? Correct it</summary><div class="form-fields"><label>Printed card ID<input id="scanCardId" class="field" name="cardId" maxlength="40" required spellcheck="false" autocapitalize="characters" placeholder="OP05-015" value="${escapeHtml(id)}" /></label>
      <label>Card name<input class="field" id="scanCardName" name="name" maxlength="150" value="${escapeHtml(known?.name||id)}" placeholder="Card name" /></label><label>Optional box slot<input class="field" name="slot" maxlength="100" value="${escapeHtml(scanner.lastSlot)}" placeholder="Optional" /></label></div></details>
      <div class="scan-confirm-buttons scan-save-buttons"><button class="button btn-outline" type="button" data-action="scan-reject">No · scan again</button><button class="button btn-primary" type="submit">✓ Add & next card</button></div>
      </form>`, 'edit');
    // Hidden detail controls stay in the same FORM for a one-tap positive path.
  }
  function syncScanCard(){
    const input=document.querySelector('#scanCardId');if(!input)return;
    const id=baseCardId(safeId(input.value)),known=catalogCard(id),variants=[];
    const wrap=document.querySelector('#scanVariantWrap'),select=document.querySelector('#scanVariantSelect');
    if(wrap&&select){wrap.hidden=variants.length<=1;select.innerHTML=variants.map(c=>`<option value="${escapeHtml(c.id)}" ${c.id===id?'selected':''}>${escapeHtml(c.id)} · ${escapeHtml(c.name)}</option>`).join('');}
    const name=document.querySelector('#scanCardName');if(name&&(!name.dataset.custom||name.value===name.dataset.previous)){name.value=known?.name||id;name.dataset.previous=name.value;}
    const matchName=document.querySelector('#scanMatchName'),matchMeta=document.querySelector('#scanMatchMeta'),owned=document.querySelector('#scanOwnedCount'),img=document.querySelector('#scanMatchImage');
    if(matchName)matchName.textContent=known?.name||id||'Enter card ID';
    if(matchMeta)matchMeta.textContent=(id||'Unknown ID')+(known?.colors?' · '+known.colors:'');
    if(owned)owned.textContent=`${fmt(qtyFor(id))} copies owned`;
    if(img){img.dataset.fallbackSrc=imageUrl(id);img.dataset.attempt='0';img.src=known?.image||imageUrl(id);img.alt='Catalog image of '+(known?.name||id||'card');img.hidden=false;const fallback=img.parentElement?.querySelector('.scan-art-fallback');if(fallback)fallback.hidden=true;}
  }

  function dashboardView() {
    const total=allQty(), locations=state.data.locations;
    const sortedLocs=[...locations].sort((a,b)=>entryCounts(b.id)-entryCounts(a.id)).slice(0,5);
    const latest=[...state.data.entries].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,6);
    const locMarkup=sortedLocs.map(l=>`<div class="storage-row"><div class="storage-icon">${l.kind==='Binder'?'▦':l.kind==='Deck'?'♠':'▣'}</div><div class="storage-info"><strong>${escapeHtml(l.name)}</strong><small>${escapeHtml(l.kind)} · ${fmt(state.data.entries.filter(e=>e.locationId===l.id).length)} entries</small><div class="progress-track"><div class="progress-fill" style="width:${total?Math.round(100*entryCounts(l.id)/total):0}%"></div></div></div><div class="qty-tag">${fmt(entryCounts(l.id))}</div></div>`).join('');
    return pageHeading('YOUR COLLECTION','Dashboard','One shared, cloud-saved collection.',`<div class="actions"><button class="button btn-primary" data-view="scan" type="button">◎ Scan cards</button><button class="button btn-outline" data-action="import-inventory-csv" type="button">↑ Import CSV</button></div>`)+
    `<div class="hero"><div><div class="overline">READY TO ORGANIZE?</div><h2>Know exactly where every card lives.</h2><p>Search cards by ID or name, track duplicates, and record binder pages or box slots.</p></div><button class="button btn-primary" data-view="catalog" type="button">＋ Add cards</button></div>
    <div class="stats"><div class="stat"><div class="stat-label">Total cards</div><div class="stat-number">${fmt(total)}</div><div class="stat-hint">Across all locations</div></div><div class="stat"><div class="stat-label">Unique card IDs</div><div class="stat-number">${fmt(uniqueCards())}</div><div class="stat-hint">Standard English card numbers</div></div><div class="stat"><div class="stat-label">Storage locations</div><div class="stat-number">${fmt(locations.length)}</div><div class="stat-hint">Binders, boxes and decks</div></div><div class="stat"><div class="stat-label">Inventory records</div><div class="stat-number">${fmt(state.data.entries.length)}</div><div class="stat-hint">Individual card/slot entries</div></div></div>
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
    ${advancedFilters()}<div class="panel" style="margin-bottom:16px"><h3>English catalog health</h3><p class="hint">${state.loaded?`${fmt(state.catalog.length)} distinct English card IDs loaded · ${fmt(state.catalog.filter(c=>!!c.image).length)} image links supplied · Checked ${escapeHtml(state.catalogLoadedAt||'now')}`:`Catalog unavailable / loading. ${escapeHtml(state.catalogError||'')}`}. This count is not proof that every released card is present; use the official English card list if a scan cannot find a card.</p></div><div class="catalog-info"><span id="catalogCount"></span><span>Source: community-maintained English card catalog; artwork belongs to its owners.</span></div><div class="catalog-grid" id="catalogGrid"></div><div id="catalogMore" class="text-center" style="padding:24px"></div>`;
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
  function catalogCard(id) {return state.catalog.find(c=>c.id===baseCardId(id));}
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
    const accountPanel=signedIn?`
      <p class="hint"><strong>Signed in as ${escapeHtml(sync.user.email||'your account')}</strong>. Your password and membership are unchanged from v1.1.5.</p>
      <div class="actions"><button class="button btn-outline" data-action="cloud-refresh" type="button">Refresh from cloud</button><button class="button btn-ghost" data-action="cloud-signout" type="button">Sign out of this device</button></div>
      <hr/><h3>Set or change your password</h3><p class="hint">If you previously used an email code, create a password here while signed in. Afterward, use it on both phone and laptop. No login email is sent for normal password sign-ins.</p>
      <form data-form="cloud-set-password" class="auth-password-form">
        <label>New password<input class="field" type="password" name="password" required minlength="12" maxlength="200" autocomplete="new-password" placeholder="At least 12 characters" /></label>
        <label>Repeat new password<input class="field" type="password" name="confirm" required minlength="12" maxlength="200" autocomplete="new-password" placeholder="Repeat new password" /></label>
        <button type="submit" class="button btn-primary">Save my password</button>
      </form>
      <p class="hint">Use a unique password. If Supabase requires additional reauthentication, its error message will tell you. Your decks and collection are not affected.</p>
    `:`
      <hr/><h3>Sign in with email and password</h3>
      <p class="hint">Enter the email approved for this shared vault and your password. No email verification code is needed for normal logins.</p>
      <form data-form="cloud-password-login" class="auth-password-form">
        <label>Email<input class="field" type="email" name="email" required autocomplete="username" placeholder="you@example.com" value="${escapeHtml(sync.pendingEmail||'')}" /></label>
        <label>Password<input class="field" type="password" name="password" required autocomplete="current-password" placeholder="Your password" /></label>
        <button class="button btn-primary" type="submit">Sign in</button>
      </form>
      <details class="auth-legacy"><summary>Existing account without a password? Use an email code once</summary>
        <p class="hint">Only use this to enter an existing account and set its password above. Supabase email rate limits still apply; if emails are blocked, wait for the limit to reset or configure your own SMTP provider. Don't create a duplicate account.</p>
        <form data-form="cloud-login" class="auth-password-form"><label>Approved email<input class="field" type="email" name="email" value="${escapeHtml(sync.pendingEmail||'')}" autocomplete="email" required placeholder="you@example.com" /></label><button type="submit" class="button btn-outline">Send one-time code</button></form>
        <form data-form="cloud-verify" class="auth-password-form"><label>Same email<input class="field" type="email" name="email" value="${escapeHtml(sync.pendingEmail||'')}" autocomplete="email" required placeholder="you@example.com" /></label><label>Code from email<input class="field" name="token" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,8}" minlength="6" maxlength="8" required placeholder="6–8 digit code" /></label><button class="button btn-outline" type="submit">Verify code and sign in</button></form>
      </details>
    `;
    return pageHeading('PRIVATE FRIENDS-ONLY COLLECTION','Live shared cloud','Approved friends use one online inventory and the same deck plans.')+
      `<section class="panel"><h3>Cloud status</h3><p id="cloudState">${escapeHtml(sync.lastStatus)}</p>
       <p class="hint"><strong>Online-only editing:</strong> Supabase is authoritative. Other signed-in devices automatically reload when something changes. Local data is only a read-only cache. Set up the v1.2 SQL migration before logging in.</p>
       <div class="sync-inspector"><strong>Loaded collection:</strong> ${fmt(state.data.entries.reduce((n,e)=>n+e.qty,0))} cards · ${state.data.locations.filter(l=>/^Box\s*\d+$/i.test(l.name)).length} numbered boxes · ${state.data.decks.length} decks<br><strong>Cloud:</strong> ${escapeHtml(sync.diagnostic)}<br><strong>Last saved:</strong> ${escapeHtml(sync.lastSuccess?sync.lastSuccess.toLocaleString():'Not confirmed in this session')}</div>
       ${signedIn?`<button class="button btn-primary" type="button" data-action="cloud-diagnose">Refresh shared collection</button>`:''}
       <form data-form="cloud-config"><div class="form-fields"><label>Supabase project URL<input class="field" type="url" name="url" placeholder="https://yourproject.supabase.co" value="${escapeHtml(sync.config?.url||'')}" required></label><label>Supabase publishable (anon) key<input class="field" name="key" placeholder="sb_publishable_..." value="${escapeHtml(sync.config?.key||'')}" required></label></div><p class="hint">Never paste a Supabase secret or service_role key into this app.</p><button type="submit" class="button btn-outline">${configured?'Update connection':'Connect Supabase'}</button></form>
       ${configured?accountPanel:'<p class="hint">Configure your Supabase connection first, then sign in with your approved email and password.</p>'}
       <p class="hint">${signedIn?`Signed in: ${escapeHtml(sync.user.email||'Account')} · `:''}${sync.ready?'Online-only edits enabled.':'Read-only until connected.'}</p></section>`;
  }
  // Page records in batches: PostgREST defaults to 1,000 rows per response.
  async function readTable(name){
    const rows=[];let offset=0;
    do{
      const {data,error}=await sync.client.from(name).select('*').range(offset,offset+999);
      if(error)throw error;
      rows.push(...(data||[]));offset+=data?.length||0;
      if(!data||data.length<1000)break;
      if(offset>150000)throw new Error('Too many rows in '+name);
    }while(true);
    return rows;
  }
  async function establishCloud({fromButton=false,silent=false}={}){
    if(!sync.client||!sync.user||sync.loading||sync.writing||sync.queue.length||scanner.dialogOpen)return;
    if(!navigator.onLine){sync.ready=false;syncStatus('Offline: read-only cache. Reconnect to edit.');return;}
    sync.loading=true;
    try{
      const [boxes,entries,decks,presets]=await Promise.all([
        readTable('vault_v12_locations'),readTable('vault_v12_inventory'),
        readTable('vault_v12_decks'),readTable('vault_v12_presets')
      ]);
      // DB keeps single per-card/box records; local format retains the same IDs
      // and deck structures as the previous 1.1.5 app.
      const normalized=normalizeData({version:1,
        locations:boxes.map(x=>x.payload),
        entries:entries.map(x=>({id:x.id,cardId:x.card_id,locationId:x.location_id,slot:x.slot,qty:x.qty,name:x.name,rarity:x.rarity,colors:x.colors,note:x.note,updatedAt:x.updated_at})),
        decks:decks.map(x=>x.payload),presets:presets.map(x=>x.payload)
      });
      state.data=normalized;sync.baseline=copyData(normalized);sync.optimistic=copyData(normalized);
      try{localStorage.setItem(KEY,JSON.stringify(normalized));}catch{}
      sync.ready=true;sync.writeError=null;sync.lastSuccess=new Date();
      sync.diagnostic=`${fmt(entries.reduce((n,e)=>n+e.qty,0))} copies · ${boxes.length} boxes · ${decks.length} decks`;
      syncStatus('Live cloud ready · '+sync.diagnostic);
      if(state.view!=='scan')render();
      if(fromButton&&!silent)toast('Cloud collection reloaded successfully.');
      subscribeCloud();
    }catch(err){
      sync.ready=false;
      syncStatus('Cloud unavailable or v1.2 migration missing: '+(err.message||String(err)));
      if(!silent||fromButton)toast(sync.lastStatus,true);
    }finally{sync.loading=false;updateCloudBadge();}
  }
  function scheduleCloudRefresh(){
    clearTimeout(sync.refreshTimer);
    if(sync.writing||sync.queue.length){sync.dirty=true;return;}
    sync.refreshTimer=setTimeout(()=>{
      if(scanner.dialogOpen){sync.dirty=true;return;}
      if(sync.user&&!document.hidden)establishCloud({silent:true});
    },550);
  }
  function subscribeCloud(){
    if(sync.channel||!sync.client)return;
    let chan=sync.client.channel('grand-line-v12-live');
    for(const table of ['vault_v12_locations','vault_v12_inventory','vault_v12_decks','vault_v12_presets']){
      chan=chan.on('postgres_changes',{event:'*',schema:'public',table},()=>scheduleCloudRefresh());
    }
    sync.channel=chan.subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')syncStatus('Realtime disconnected · refresh when back online');
    });
  }
  async function connectCloud(){
    if(!sync.config?.url||!sync.config.key)return;
    syncStatus('Connecting to Supabase…');
    try{
      if(sync.client&&sync.channel){await sync.client.removeChannel(sync.channel);sync.channel=null;}
      const sdk=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      sync.client=sdk.createClient(sync.config.url,sync.config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      sync.client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'){
          sync.ready=false;sync.user=null;sync.baseline=null;sync.optimistic=null;
          if(sync.channel){sync.client.removeChannel(sync.channel);sync.channel=null;}
          syncStatus('Signed out · cached collection is read-only');if(state.view==='cloud')render();return;
        }
        if(session?.user&&session.user.id!==sync.user?.id){sync.user=session.user;setTimeout(()=>establishCloud(),0);}
      });
      const {data:{user},error}=await sync.client.auth.getUser();
      if(error&&error.name!=='AuthSessionMissingError')throw error;
      if(user){sync.user=user;await establishCloud();}
      else syncStatus('Configured. Sign in with your email and password to edit shared cards.');
    }catch(err){sync.ready=false;syncStatus('Cloud client error: '+(err.message||String(err)));}
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
    if(state.view==='scan' && next!=='scan'){scanner.dialogOpen=false;scanner.matchId='';closeModal();stopCamera();scanner.session++;scanner.busy=false;}
    state.view=next;document.querySelector('.sidebar').classList.remove('open');
    render();window.scrollTo({top:0,behavior:'instant'});
  }

  function paintFilterResults(){if(state.view==='catalog')paintCatalog();if(state.view==='decks')paintDeckPool();}
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
    const btn=e.target.closest('[data-action]');if(!btn)return;
    const action=btn.dataset.action, id=btn.dataset.id;
    const writes=['add-numbered-box','clone-deck','save-filter','delete-filter','new-deck','rename-deck','delete-deck','deck-set-leader','deck-add','deck-plus','deck-minus','add-location','edit-location','remove-location','delete-entry','plus','minus','add-card','open-custom','open-bulk','open-import','edit-entry'];
    if(writes.includes(action)&&!requireCloudEdit())return;
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
    if(action==='cloud-refresh'||action==='cloud-diagnose'){establishCloud({fromButton:true});return;}
    if(action==='cloud-signout'){sync.client?.auth.signOut({scope:'local'}).catch(err=>toast('Sign-out failed: '+err.message,true));return;}
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
    if(action==='close-modal'){if(scanner.dialogOpen){resumeScanning({message:'Confirmation dismissed. Present a card to scan again.'});}else closeModal();return;}
    if(action==='scan-reject'){resumeScanning({message:'Card not added. Hold a card steady to scan again.'});return;}
    if(action==='scan-confirm-yes'){if(scanner.dialogOpen)renderScanEditor(scanner.matchId);return;}
    if(action==='scan-edit-id'){if(scanner.dialogOpen)renderScanEditor(scanner.matchId);return;}
    if(action==='open-custom'){openAdd();return;}
    if(action==='open-bulk'){openBulk();return;}
    if(action==='open-import'){toast('Full backup replacement is disabled. Use CSV import or the migration instructions.',true);return;}
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
    if(action==='flip-camera'){flipCamera();return;}
    if(action==='toggle-auto'){toggleAuto();return;}
    if(action==='stop-camera'){stopCamera();updateScanButtons();setScanStatus('Camera stopped. You can start it again or choose a photo.');return;}
    if(action==='capture-card'){captureCard();return;}
    if(action==='scan-again'){resumeScanning({message:scanner.autoEnabled?'Looking for the next card automatically…':'Ready for another card. Use Capture once.'});return;}
    if(action==='confirm-restore'){toast('Direct backup restore is disabled in cloud-first v1.2.0 to protect the shared inventory. Contact the owner for a reviewed import.',true);return;}
    /* if(action==='confirm-restore'){
      const inp=document.querySelector('#restoreFile');const file=inp?.files?.[0];if(!file){toast('Choose a JSON file first.',true);return;}
      if(file.size>20*1024*1024){toast('File is too large (max 20 MB).',true);return;}
      file.text().then(text=>{
        const data=normalizeData(JSON.parse(text));
        if(!confirm('Replace all current cards and locations with this backup? This cannot be undone.'))return;
        state.data=data;persist();closeModal();render();toast('Collection successfully restored.');
      }).catch(err=>toast(`Could not restore: ${err.message}`,true));return;
    }
    */
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('form[data-form]');if(!form)return;e.preventDefault();
    const f=new FormData(form), type=form.dataset.form;
    if(['import-deck','import-inventory-csv','new-deck','rename-deck','scan-add','add-entry','edit-entry','location','bulk'].includes(type)&&!requireCloudEdit())return;
    if(type==='import-deck'){readDeckImport(form).catch(err=>toast(err.message||String(err),true));return;}
    if(type==='import-inventory-csv'){importExternalCsv(form).catch(err=>toast(err.message||String(err),true));return;}
    if(type==='cloud-config'){
      const url=String(f.get('url')||'').trim(),key=String(f.get('key')||'').trim();
      if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)||!/^(sb_publishable_|eyJ)/.test(key)||/service_role|secret/i.test(key)){
        toast('Use your Supabase project HTTPS URL and PUBLIC publishable / anon key only.',true);return;
      }
      sync.config={url:url.replace(/\/$/,''),key};localStorage.setItem(CLOUD_KEY,JSON.stringify(sync.config));connectCloud();render();return;
    }
    if(type==='cloud-password-login'){
      if(!sync.client){toast('Configure Supabase first.',true);return;}
      const email=String(f.get('email')||'').trim().toLowerCase();
      const password=String(f.get('password')||'');
      if(!email||!password){toast('Enter your email and password.',true);return;}
      sync.pendingEmail=email;
      sync.client.auth.signInWithPassword({email,password}).then(async ({data,error})=>{
        if(error){toast('Sign-in failed: '+error.message,true);return;}
        if(!data?.user){toast('Sign-in did not return a user.',true);return;}
        sync.user=data.user;
        toast('Signed in. Checking the shared collection…');
        await establishCloud({fromButton:true});
        if(state.view==='cloud')render();
      }).catch(err=>toast('Sign-in failed: '+err.message,true));return;
    }
    if(type==='cloud-set-password'){
      if(!sync.client||!sync.user){toast('Sign in first to set a password.',true);return;}
      const password=String(f.get('password')||'');
      const confirmPassword=String(f.get('confirm')||'');
      if(password.length<12||password.length>200){toast('Use a password of at least 12 characters.',true);return;}
      if(password!==confirmPassword){toast('The passwords do not match.',true);return;}
      sync.client.auth.updateUser({password}).then(({error})=>{
        if(error){toast('Could not set password: '+error.message,true);return;}
        form.reset();toast('Password saved. You can use it to sign in on your other devices.');
      }).catch(err=>toast('Could not set password: '+err.message,true));return;
    }
    if(type==='cloud-login'){
      if(!sync.client){toast('Configure Supabase first.',true);return;}
      const email=String(f.get('email')||'').trim().toLowerCase();
      if(!email){toast('Enter your email address.',true);return;}
      sync.pendingEmail=email;
      sync.client.auth.signInWithOtp({email,options:{shouldCreateUser:false}}).then(({error})=>{
        if(error){toast('Could not send login code: '+error.message,true);return;}
        if(state.view==='cloud')render();
        toast('Check your email for the login code. Return here to enter it.');
      }).catch(err=>toast('Sign-in error: '+err.message,true));return;
    }
    if(type==='cloud-verify'){
      if(!sync.client){toast('Configure Supabase first.',true);return;}
      const email=String(f.get('email')||sync.pendingEmail||'').trim().toLowerCase();
      const token=String(f.get('token')||'').trim();
      if(!email || !/^\d{6,8}$/.test(token)){toast('Enter the same email and your 6–8 digit code.',true);return;}
      sync.client.auth.verifyOtp({email,token,type:'email'}).then(async ({data,error})=>{
        if(error){toast('Code not accepted: '+error.message,true);return;}
        if(!data?.user){toast('Supabase did not return a signed-in user.',true);return;}
        sync.pendingEmail='';sync.user=data.user;
        toast('Signed in. Checking the shared vault…');
        await establishCloud({fromButton:true});
        if(state.view==='cloud')render();
      }).catch(err=>toast('Code verification failed: '+err.message,true));return;
    }
    if(type==='new-deck'){
      const name=String(f.get('name')||'').trim();if(!name){toast('Enter a deck name.',true);return;}
      const id=uid();state.data.decks.push({id,name:name.slice(0,100),leaderId:'',cards:[],reserved:false,createdAt:dateNow(),updatedAt:dateNow()});state.activeDeckId=id;persist();closeModal();setView('decks');render();toast('Deck created.');return;
    }
    if(type==='rename-deck'){const d=selectedDeck();if(!d)return;const name=String(f.get('name')||'').trim();if(!name)return;d.name=name.slice(0,100);d.updatedAt=dateNow();persist();closeModal();render();return;}
    if(type==='scan-add'){
      const id=baseCardId(safeId(f.get('cardId'))),qty=qtyValue(f.get('qty')),loc=String(f.get('locationId')),slot=String(f.get('slot')||'').trim();
      if(!isCardCode(id)||!qty||!locationById(loc)){toast('Check the printed card ID, quantity and location.',true);return;}
      const known=catalogCard(id),name=known?.name||String(f.get('name')||'').trim()||id;
      if(addCopies(id,name,qty,loc,slot,'',known?.rarity||'',known?.colors||'',false)){
        scanner.lastLocationId=loc;localStorage.setItem(SCANNER_BOX_KEY,loc);scanner.lastSlot=slot;
        setScanStatus('Saving card to shared cloud…');
        const saveButton=form.querySelector('button[type=submit]');if(saveButton)saveButton.disabled=true;
        waitForCloudSave().then(ok=>{
          if(!ok){if(saveButton)saveButton.disabled=false;toast('Card was NOT saved. Check Cloud sync and retry.',true);return;}
          scanner.saved+=qty;scanner.dialogOpen=false;scanner.matchId='';closeModal();
          const count=document.querySelector('#scanSaved');if(count)count.textContent=fmt(scanner.saved);
          scanner.autoPaused=false;scanner.autoIgnoreId=id;scanner.autoClearFrames=0;scanner.autoHistory=[];
          setScanResult('');setScanStatus(`Cloud saved ${qty} × ${id} (${name}). Remove this card and present the next one.`);updateScanButtons();scheduleAutoScan(1300);
          toast(`Cloud saved ${qty} × ${id}.`);establishCloud({silent:true});
        });
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
    if(e.target.id==='reserveDeck'&&!requireCloudEdit()){e.target.checked=!e.target.checked;return;}
    if(e.target.id==='reserveDeck'){const d=selectedDeck();if(d){d.reserved=e.target.checked;d.updatedAt=dateNow();persist();render();}}
    if(e.target.id==='savedFilterPreset'){const p=state.data.presets.find(x=>x.id===e.target.value);if(p)applySavedPreset(p);}
    if(e.target.id==='inventoryLocation'){state.inventoryLocation=e.target.value;render();}
    if(e.target.id==='scanPhoto' && e.target.files?.[0]){const file=e.target.files[0];e.target.value='';recognizePhoto(file);}
    if(e.target.id==='scanVariantSelect'){const input=document.querySelector('#scanCardId');if(input){input.value=e.target.value;syncScanCard();}}
    if(e.target.id==='scanCandidateSelect'){const input=document.querySelector('#scanCardId');if(input){input.value=e.target.value;syncScanCard();}}
    if(e.target.id==='scanCardId'){syncScanCard();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='scanCardId')syncScanCard();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalLayer.childElementCount){if(scanner.dialogOpen)resumeScanning({message:'Confirmation dismissed. Scanning resumes.'});else closeModal();}});
  modalLayer.addEventListener('click',e=>{if(e.target.id==='modalOverlay'){if(scanner.dialogOpen)resumeScanning({message:'Confirmation dismissed. Scanning resumes.'});else closeModal();}});
  document.querySelector('#menuToggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  document.querySelector('#backupBtn').addEventListener('click',downloadBackup);
  document.addEventListener('visibilitychange',()=>{if(document.hidden && scanner.stream){stopCamera();updateScanButtons();setScanStatus('Camera paused. Press Start camera to resume.');}});
  window.addEventListener('pagehide',()=>{stopCamera();if(scanner.worker)scanner.worker.terminate();});
  document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement && e.target.matches('.scan-confirm-image')){if(e.target.dataset.attempt==='0'&&e.target.dataset.fallbackSrc&&e.target.src!==e.target.dataset.fallbackSrc){e.target.dataset.attempt='1';e.target.src=e.target.dataset.fallbackSrc;return;}e.target.hidden=true;const fallback=e.target.parentElement?.querySelector('.scan-art-fallback');if(fallback)fallback.hidden=false;}else if(e.target instanceof HTMLImageElement && e.target.closest('.card-art,.card-cell,.modal-card-heading'))e.target.style.visibility='hidden';},true);

  function normalizeCatalog(source) {
    const records=Array.isArray(source)?source:Object.entries(source).map(([id,v])=>({...v,id:v?.id||id}));
    const full=records.map(c=>({
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
    const byBase=new Map();for(const c of full){const base=baseCardId(c.id);if(!byBase.has(base)||c.id===base)byBase.set(base,{...c,id:base});}
    return [...byBase.values()].sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
  }
  async function loadCatalog() {
    const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),20000);
    try{
      let source, lastError;
      for(const url of [SOURCE,SOURCE_BACKUP,SOURCE_FALLBACK]){
        try{const response=await fetch(url,{signal:abort.signal,cache:'default'});if(!response.ok)throw new Error(`HTTP ${response.status}`);source=await response.json();break;}
        catch(err){lastError=err;}
      }
      if(!source)throw lastError||new Error('Catalog unavailable');
      const cards=normalizeCatalog(source);if(cards.length<200)throw new Error('Incomplete English catalog');
      if(cards.filter(c=>c.types.length||c.effect||c.cost!==null).length<100)throw new Error('Catalog lacks detailed fields');
      state.catalog=cards;state.loaded=true;state.catalogError='';state.catalogLoadedAt=new Date().toLocaleString();
      catalogStatus.textContent=`${fmt(cards.length)} English cards available`;catalogStatus.className='source-status ready';
      const byId=new Map(cards.map(c=>[c.id,c]));let modified=false;
      for(const entry of state.data.entries){const match=byId.get(entry.cardId);if(match&&entry.name===entry.cardId){entry.name=match.name;entry.rarity=match.rarity;entry.colors=match.colors;modified=true;}}
      if(modified&&(!sync.config||!sync.user))persist();
    }catch(err){state.catalog=fallbackCards;state.loaded=false;state.catalogError=err.message;
      catalogStatus.textContent='Catalog offline · limited search';catalogStatus.className='source-status offline';
      toast('Full card catalog unavailable. Saved inventory and decks still work.',true);
    }finally{clearTimeout(timeout);if(state.view!=='scan')render();}
  }
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&sync.user&&!sync.writing)establishCloud({silent:true});
  });
  window.addEventListener('focus',()=>{if(sync.user&&!sync.writing)establishCloud({silent:true});});
  window.addEventListener('online',()=>{if(sync.user)establishCloud({silent:true});});
  window.addEventListener('offline',()=>{sync.ready=false;syncStatus('Offline · read-only cached collection');});
  setInterval(()=>{if(sync.user&&!document.hidden&&!sync.writing&&!scanner.dialogOpen)establishCloud({silent:true});},90000);
  render();loadCatalog();updateCloudBadge();
  try{sync.config=JSON.parse(localStorage.getItem(CLOUD_KEY)||'null');if(sync.config?.url&&sync.config?.key)connectCloud();}catch(err){console.warn('Cloud config unreadable',err);}
  if(state.view==='catalog')paintCatalog();
})();
