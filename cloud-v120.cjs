'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();',`  globalThis.__v120={initialData,normalizeData,diffData,normalizeCatalog,detectPrintedIds,findCardByName,addCopies,copyData,state,sync,persist,waitForCloudSave,establishCloud,readTable};`);
const elements=new Map(), store={};
const el=(x)=>{if(!elements.has(x))elements.set(x,{innerHTML:'',textContent:'',className:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},focus(){},addEventListener(){},setAttribute(){},querySelector(){return{focus(){}}},querySelectorAll(){return[]}});return elements.get(x)};
const crypto=require('node:crypto').webcrypto;
const ctx={console,crypto,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}},navigator:{onLine:true},document:{hidden:false,querySelector:el,querySelectorAll(){return[]},addEventListener(){}},window:{addEventListener(){},scrollTo(){}},setTimeout,clearTimeout,setInterval:()=>0,JSON,Math,Intl,Date,Set,Map,Object,Number,String,Array,Blob,URL};
vm.createContext(ctx);vm.runInContext(source,ctx);
const t=ctx.__v120;
const clone=x=>JSON.parse(JSON.stringify(x));
const initial=t.initialData();
const before=clone(initial);
before.entries=[{id:'e1',cardId:'OP05-015',locationId:'box-1',slot:'',name:'Belo Betty',rarity:'R',colors:'Red',note:'',qty:2,updatedAt:'2026'}];
const after=clone(before);after.entries[0].qty+=3;
let ops=clone(t.diffData(before,after));
assert.equal(ops.length,1);assert.equal(ops[0].delta,3);
const moved=clone(before);moved.entries[0].locationId='box-2';
ops=clone(t.diffData(before,moved));assert.equal(ops.length,2);
assert.equal(ops.find(x=>x.locationId==='box-1').delta,-2);assert.equal(ops.find(x=>x.locationId==='box-2').delta,2);
const note=clone(before);note.entries[0].note='Sleeved';
ops=clone(t.diffData(before,note));assert.equal(ops.length,1);assert.equal(ops[0].kind,'inventory_meta');
const deck=clone(before);deck.decks.push({id:'d1',name:'Test',leaderId:'OP05-002',cards:[],reserved:false});
ops=clone(t.diffData(before,deck));assert.equal(ops[0].kind,'decks');
const normalized=clone(t.normalizeData(deck));assert.equal(normalized.decks.length,1);
const cards=t.normalizeCatalog({
 'OP16-113':{name:'Boa Marigold',colors:['Yellow'],category:'Character',cost:3,types:['Kuja Pirates'],image:'https://cards.test/base.png'},
 'OP16-113_p1':{name:'Boa Marigold',colors:['Yellow'],category:'Character',cost:3,types:['Kuja Pirates'],image:'https://cards.test/alt.png'},
 'OP14-103':{name:'Gloriosa (Grandma Nyon)',colors:['Yellow'],category:'Character',cost:2,types:['Kuja Pirates'],image:'https://cards.test/nyon.png'}
});
assert.equal(cards.length,2,'standard and alternate art should be one base card');
t.state.catalog=cards;
assert.equal(t.findCardByName('Boa Marigold'),'OP16-113');
assert.equal(t.detectPrintedIds('OP16-113')[0],'OP16-113');
assert.equal(t.findCardByName('random text'),'');
let remote={
 vault_v12_locations:initial.locations.map(x=>({id:x.id,payload:x})),
 vault_v12_inventory:[{id:'entry1',card_id:'OP05-015',location_id:'box-1',slot:'',qty:2,name:'Belo Betty',rarity:'R',colors:'Red',note:''}],
 vault_v12_decks:[{id:'existingdeck',payload:{id:'existingdeck',name:'Saved deck',leaderId:'OP05-002',cards:[{cardId:'OP05-015',qty:4}],reserved:false}}],
 vault_v12_presets:[]
};
// Test client-side paging with >5,000 physical card entries in remote response.
for(let i=0;i<5200;i++)remote.vault_v12_inventory.push({id:'item'+i,card_id:'OP01-'+String(i).padStart(4,'0'),location_id:'box-1',slot:'',qty:1,name:'Test '+i,rarity:'C',colors:'Red',note:''});
const received=new Set();const rpc=[];
t.sync.client={
 from(name){return{select(){return{range:async(a,b)=>({data:clone(remote[name].slice(a,b+1)),error:null})}}}},
 channel(){return {on(){return this},subscribe(){return this}}},
 rpc:async(fn,p)=>{assert.equal(fn,'vault_v12_apply');rpc.push(p);if(received.has(p.p_request_id))return{data:{duplicate:true},error:null};received.add(p.p_request_id);
  for(let op of p.p_ops){if(op.kind==='inventory'){
   let row=remote.vault_v12_inventory.find(x=>x.card_id===op.cardId&&x.location_id===op.locationId&&x.slot===op.slot);
   if(row){row.qty+=op.delta;if(!row.qty)remote.vault_v12_inventory.splice(remote.vault_v12_inventory.indexOf(row),1);}else if(op.delta>0)remote.vault_v12_inventory.push({id:'fresh',card_id:op.cardId,location_id:op.locationId,slot:op.slot,qty:op.delta,name:op.name,rarity:op.rarity,colors:op.colors,note:op.note});
  }}return{data:{ok:true},error:null};}
};
t.sync.user={id:'u1',email:'owner@example.com'};
t.state.view='scan'; // suppress page renders: test only state management.
(async()=>{
 await t.establishCloud();assert(t.sync.ready);assert.equal(t.state.data.entries.length,5201);assert.equal(t.state.data.decks.length,1);
 t.state.data.entries.find(x=>x.cardId==='OP05-015').qty+=3;
 assert(t.persist());
 assert(await t.waitForCloudSave());
 assert.equal(remote.vault_v12_inventory[0].qty,5);
 assert.equal(rpc.length,1);assert.equal(rpc[0].p_ops[0].delta,3);
 // Retry same request ID is idempotent in the simulated RPC.
 await t.sync.client.rpc('vault_v12_apply',rpc[0]);assert.equal(remote.vault_v12_inventory[0].qty,5);
 await t.establishCloud();assert.equal(t.state.data.entries.find(x=>x.cardId==='OP05-015').qty,5);
 t.sync.ready=false;
 t.state.data.entries.find(x=>x.cardId==='OP05-015').qty=999;
 assert.equal(t.persist(),false);assert.equal(t.state.data.entries.find(x=>x.cardId==='OP05-015').qty,5);
 console.log('PASS: database paging >5,000 records, ID/name recognition and base-art grouping, deck preservation, atomic delta payloads, idempotent request IDs, cloud-only offline rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
