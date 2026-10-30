'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),path=require('path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();', '  globalThis.TEST={scanner,state,runAutoScan,scanIdRegions,scanNameRegions};');
function box(left,top,width,height){return {getBoundingClientRect(){return {left,top,width,height};},classList:{contains:k=>k==='live',add(){},remove(){},toggle(){}},dataset:{},getContext(){return {drawImage(){}}},setAttribute(){},focus(){},querySelector(){return node}};}
const node={classList:{contains(){return false},toggle(){},add(){},remove(){}},innerHTML:'',textContent:'',setAttribute(){},addEventListener(){},setAttribute(){},getContext(){return {drawImage(){}}},focus(){},dataset:{},querySelector(){return node}};
const video={videoWidth:435,videoHeight:579,getBoundingClientRect(){return {left:0,top:0,width:435,height:579}}};
const elements={
 '#scanPreview':box(0,0,435,579),
 '.scan-name-target':box(435*.22,579*.75,435*.57,579*.08),
 '.scan-id-target':box(435*.71,579*.83,435*.25,579*.065),
 '#scanVideo':video,
 '#modalLayer':node,
};
const doc={hidden:false,querySelector:sel=>elements[sel]||node,querySelectorAll(){return[]},addEventListener(){},createElement(tag){if(tag==='canvas')return {width:0,height:0,getContext(){return {drawImage(){},set imageSmoothingEnabled(v){},set imageSmoothingQuality(v){},set filter(v){}}},setAttribute(){}};throw Error(tag)}};
let ocrCalls=0;
const win={addEventListener(){},Tesseract:{async createWorker(){return {async setParameters(){},async recognize(){ocrCalls++;return {data:{text:'OP14-048'}}}}}}};
const ctx={console,crypto:require('crypto').webcrypto,setTimeout:()=>1,clearTimeout(){},setInterval(){},window:win,document:doc,localStorage:{getItem:()=>null,setItem(){}},navigator:{onLine:true},Intl,Date,Map,Set,URL,JSON,Math,Number,String,Array,Blob};
vm.createContext(ctx);vm.runInContext(source,ctx);
(async()=>{
  const {scanner,state,runAutoScan,scanIdRegions,scanNameRegions}=ctx.TEST;
  scanner.stream={};scanner.autoEnabled=true;state.view='scan';
  const id=scanIdRegions(true)[0],name=scanNameRegions(true)[0];
  assert.equal(id.left,.71);assert.equal(id.top,.83);assert.equal(name.left,.22);assert.equal(name.top,.75);
  await runAutoScan();
  assert.equal(scanner.dialogOpen,false,'one reading should not auto-accept');
  assert.equal(scanner.autoHistory[0],'OP14-048');
  await runAutoScan();
  assert.equal(scanner.dialogOpen,true,'two matching readings open one confirmation popup');
  assert.equal(scanner.autoPaused,true);
  assert(ocrCalls>=2);
  assert(!source.includes('data-action="toggle-auto"'), 'there is exactly one automatic mode; no toggle');
  console.log('PASS: fixed overlays align with OCR, always-on auto waits for two matching reads, then opens confirmation popup');
})().catch(e=>{console.error(e);process.exitCode=1});
