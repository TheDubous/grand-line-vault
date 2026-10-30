'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'),path=require('node:path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();updateCloudBadge();','  globalThis.TEST={state,scanner,inventoryFilteredRecords,selectedPhysicalRecords,bulkSelectionTools,scanView,recognizeIdFrame,recordAutoEvidence,diffData};');
function node(){return {classList:{toggle(){},remove(){},add(){},contains(){return false}},addEventListener(){},getContext(){return {drawImage(){}}},setAttribute(){},focus(){},dataset:{},innerHTML:'',textContent:''};}
const doc={querySelector(){return node()},querySelectorAll(){return []},addEventListener(){},createElement(tag){if(tag==='canvas')return {width:0,height:0,getContext(){return {drawImage(){},set imageSmoothingEnabled(v){},set imageSmoothingQuality(v){},set filter(v){}}},setAttribute(){}}; throw Error(tag);}};
const store={};const ctx={console,crypto:require('node:crypto').webcrypto,setTimeout,clearTimeout,setInterval(){},window:{addEventListener(){}},document:doc,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},Intl,Date,Map,Set,URL,JSON,Math,Number,String,Object,Array,Blob};
vm.createContext(ctx);vm.runInContext(source,ctx);
const T=ctx.TEST;
assert(T.scanView().includes('data-action="toggle-auto"'),'Auto toggle must render');
assert(T.scanView().includes('Capture card'),'manual Capture remains');
T.state.data.locations=[{id:'box-1',name:'Box 1',kind:'Box'},{id:'box-2',name:'Box 2',kind:'Box'}];
T.state.data.entries=[
 {id:'a',cardId:'OP14-048',name:'Shiryu',qty:2,locationId:'box-1',slot:'',note:''},
 {id:'b',cardId:'OP14-048',name:'Shiryu',qty:1,locationId:'box-2',slot:'',note:''},
 {id:'c',cardId:'OP16-110',name:'Vasco Shot',qty:4,locationId:'box-1',slot:'',note:''},
];
T.state.bulkInventoryIds.add('a');
assert.equal(T.selectedPhysicalRecords('inventory').length,1);
assert.equal(T.selectedPhysicalRecords('inventory')[0].qty,2);
T.state.bulkCatalogIds.add('OP14-048');
assert.equal(T.selectedPhysicalRecords('catalog').length,2,'catalog selection covers same ID in both boxes');
assert(T.bulkSelectionTools('inventory').includes('Move owned copies'));
assert(T.bulkSelectionTools('catalog').includes('Add selected to box'));
const before=JSON.parse(JSON.stringify(T.state.data));
const after=JSON.parse(JSON.stringify(T.state.data));
after.entries=after.entries.filter(e=>e.id!=='a');
after.entries.find(e=>e.id==='b').qty+=2;
const patches=T.diffData(before,after).filter(x=>x.kind==='inventory');
assert.equal(patches.length,2,'moving records uses one negative and one positive delta');
assert.equal(patches.reduce((n,x)=>n+x.delta,0),0,'moving cards preserves total quantity');
(async()=>{
 const worker={async setParameters(){},async recognize(){return {data:{text:'OP14-048'}}}};
 const result=await T.recognizeIdFrame({width:900,height:1400},worker,{quick:true});
 assert.equal(result.ids[0],'OP14-048');
 assert.equal(result.confirmedInFrame,true,'same-frame second crop should confirm ID');
 console.log('PASS v1.2.6: manual toggle, bulk selection, cloud patches and single-frame OCR corroboration');
})().catch(e=>{console.error(e);process.exitCode=1});
