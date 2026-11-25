'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();updateCloudBadge();',
  '  globalThis.UX={state,filteredCatalog,colorFilterHtml,buildDeckPickPlan,prepareDeckPanel,deckCostCurve,decksView,catalogView,openCardDetail,paintDeckPool,normalizeData,snapshotFilters,applySavedPreset};');
assert(source.includes('globalThis.UX='));
const elements=new Map(),store={};
function node(key){
 if(!elements.has(key))elements.set(key,{
   innerHTML:'',textContent:'',dataset:{},style:{},childElementCount:0,
   classList:{toggle(){},add(){},remove(){},contains(){return false}},
   setAttribute(){},getContext(){return {drawImage(){}}},
   addEventListener(){},focus(){},querySelector(){return null},querySelectorAll(){return[]}
 });
 return elements.get(key);
}
const doc={hidden:false,querySelector:node,querySelectorAll(){return[]},addEventListener(){},
 createElement(tag){return node('created-'+tag);},body:{appendChild(){}}};
const ctx={console,crypto:require('node:crypto').webcrypto,document:doc,
 window:{addEventListener(){},scrollTo(){},matchMedia(){return{matches:false}}},
 navigator:{onLine:true},localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},
 setTimeout,clearTimeout,setInterval(){},Intl,Date,Map,Set,URL,JSON,Math,Number,String,Object,Array,Blob};
vm.createContext(ctx);vm.runInContext(source,ctx);
const ux=ctx.UX,state=ux.state;
state.catalog=[
 {id:'OP05-002',name:'Belo Betty',category:'Leader',colors:'Red / Yellow',cost:null,power:5000,counter:null,attributes:[],types:['Revolutionary Army'],effect:'Leader effect',trigger:'',rarity:'L',image:''},
 {id:'OP14-048',name:'Shiryu',category:'Character',colors:'Blue',cost:4,power:5000,counter:1000,attributes:['Slash'],types:['Blackbeard Pirates'],effect:'On Play: test effect',trigger:'',rarity:'R',image:''},
 {id:'OP11-052',name:'Charlotte Lola',category:'Character',colors:'Red',cost:3,power:4000,counter:1000,attributes:[],types:['Big Mom Pirates'],effect:'',trigger:'',rarity:'C',image:''},
 {id:'OP16-110',name:'Vasco Shot',category:'Character',colors:'Black',cost:5,power:7000,counter:2000,attributes:[],types:['Blackbeard Pirates'],effect:'',trigger:'',rarity:'C',image:''},
 {id:'OP22-001',name:'Placeholder',category:'Character',colors:'Green / Yellow',cost:2,power:3000,counter:1000,attributes:[],types:[],effect:'',trigger:'',rarity:'C',image:''}
];
state.loaded=true;
state.data.locations=[{id:'box-1',name:'Box 1',kind:'Box'},{id:'box-2',name:'Box 2',kind:'Box'}];
state.data.entries=[
 {id:'a',cardId:'OP14-048',name:'Shiryu',qty:2,locationId:'box-1',slot:'A1',note:''},
 {id:'b',cardId:'OP14-048',name:'Shiryu',qty:1,locationId:'box-2',slot:'B5',note:''},
 {id:'c',cardId:'OP11-052',name:'Charlotte Lola',qty:1,locationId:'box-1',slot:'A2',note:''}
];
const deck={id:'d1',name:'Working deck',leaderId:'OP05-002',cards:[{cardId:'OP14-048',qty:4},{cardId:'OP11-052',qty:1}],reserved:false};
state.data.decks=[deck];state.activeDeckId='d1';
state.colors=new Set(['Red','Blue']);
let found=ux.filteredCatalog().map(c=>c.id);
assert(found.includes('OP14-048')&&found.includes('OP11-052')&&found.includes('OP05-002'));
assert(!found.includes('OP16-110'),'Black not selected, must be filtered out');
assert(ux.colorFilterHtml().includes('data-filter-color="Red"'));
assert(ux.colorFilterHtml().includes('data-filter-color="Blue"'));
const stored=ux.snapshotFilters();assert.deepEqual(Array.from(stored.colors),['Red','Blue']);
const normalized=ux.normalizeData({...state.data,presets:[{id:'p1',name:'Two colors',...stored}]});
assert.equal(normalized.presets[0].colors.length,2,'presets retain multiple colors');
ux.applySavedPreset({query:'',color:'Black',set:'all',filters:{...stored.filters,costs:[]}});
assert(state.colors.has('Black'),'legacy one-color presets still work');
state.colors.clear();
const plan=ux.buildDeckPickPlan(deck);
assert.equal(plan.groups.length,2,'picks grouped by physical boxes');
assert.equal(plan.rows.reduce((sum,r)=>sum+r.count,0),4,'three Shiryu and one Lola physically available');
assert.equal(plan.missing.length,2,'missing leader and one Shiryu');
assert(plan.missing.some(x=>x.cardId==='OP14-048'&&x.count===1));
assert(plan.missing.some(x=>x.cardId==='OP05-002'&&x.count===1));
state.deckPickOpen=true;
const html=ux.prepareDeckPanel(deck);
assert(html.includes('Box 1')&&html.includes('Box 2'));
assert(html.includes('Missing physical cards'));
assert(ux.deckCostCurve(deck).includes('DON!! cost curve'));
assert(ux.deckCostCurve(deck).includes('4</strong>'));
assert(ux.decksView().includes('deck-studio-layout'));
assert(ux.decksView().includes('deck-availability'));
assert(ux.catalogView().includes('data-filter-color="Red"'));
ux.openCardDetail('OP14-048');
const modal=elements.get('#modalLayer').innerHTML;
assert(modal.includes('Shiryu')&&modal.includes('On Play: test effect'));
assert(modal.includes('Box 1')&&modal.includes('Box 2'));
assert(modal.includes('detail-add-deck'));
state.view='decks';
state.deckAvailability='owned';
ux.paintDeckPool();
let pool=elements.get('#deckPool').innerHTML;
assert(!pool.includes('Vasco Shot'),'unowned card hidden in owned-only deck pool');
state.deckAvailability='all';state.deckValidOnly=true;ux.paintDeckPool();
pool=elements.get('#deckPool').innerHTML;
assert(!pool.includes('Shiryu'),'blue card incompatible with red/yellow Leader');
assert(pool.includes('Charlotte Lola'),'red card compatible with red/yellow Leader');
console.log('PASS: multi-color OR filters, legacy presets, card details, deck-cost chart, mobile studio and read-only box picking');
