'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'),vm=require('vm'),path=require('path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();',`  globalThis.TEST={scanIdRegions,scanNameRegions,scannerGuideRect,findCardsByName,recognizeNameFallback,setCatalog:cs=>{state.catalog=cs;}};`);
const frame={classList:{contains:x=>x==='live'},getBoundingClientRect:()=>({left:0,top:0,width:300,height:400})};
const name={getBoundingClientRect:()=>({left:60,top:296,width:159,height:40})};
const code={getBoundingClientRect:()=>({left:207,top:332,width:87,height:36})};
const blank={getContext:()=>({drawImage(){}}),setAttribute(){},addEventListener(){},classList:{toggle(){},add(){},remove(){},contains(){return false}},dataset:{},width:0,height:0};
const doc={querySelector:s=>s==='#scanPreview'?frame:s==='.scan-name-target'?name:s==='.scan-id-target'?code:blank,querySelectorAll:()=>[],addEventListener(){},createElement:()=>blank};
const ctx={console,setTimeout,clearTimeout,setInterval:()=>{},crypto:require('crypto').webcrypto,window:{addEventListener(){}},document:doc,localStorage:{getItem:()=>null,setItem(){}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
const id=ctx.TEST.scanIdRegions(true)[0],nm=ctx.TEST.scanNameRegions(true)[0];
assert.equal(id.label,'BLUE · printed ID');
assert(Math.abs(id.left-207/300)<.001);assert(Math.abs(id.top-332/400)<.001);
assert(Math.abs(id.width-87/300)<.001);assert(Math.abs(id.height-36/400)<.001);
assert.equal(nm.label,'PINK · printed name');
assert(Math.abs(nm.left-60/300)<.001);assert(Math.abs(nm.top-296/400)<.001);
assert(Math.abs(nm.width-159/300)<.001);assert(Math.abs(nm.height-40/400)<.001);
assert.equal(ctx.TEST.scanIdRegions(false)[0].label,'photo bottom right');
const catalog=[
 {id:'OP14-048',name:'Shiryu',colors:'Blue'},
 {id:'OP02-072',name:'Shiryu',colors:'Black'},
 {id:'OP16-113',name:'Boa Marigold',colors:'Yellow'}
];
ctx.TEST.setCatalog(catalog);
assert.equal(ctx.TEST.findCardsByName('Shiryu').length,2,'two Shiryu IDs should not be guessed');
assert.equal(ctx.TEST.findCardsByName('Boa Marigold').length,1);
assert.equal(ctx.TEST.findCardsByName('Boa MarigoId').length,1,'single OCR typo may use unique fuzzy match');
console.log('PASS: Two independent visible OCR windows align with image crops; ambiguous names require user selection; unique/fuzzy name matching works');
(async()=>{
  const calls=[];
  const worker={setParameters:async p=>calls.push(p), recognize:async()=>({data:{text:'Shiryu'}})};
  const r=await ctx.TEST.recognizeNameFallback({width:900,height:1200},worker,{fromCamera:true});
  assert.equal(r.id,'','same-name duplicates must not auto-resolve an ID');
  assert.equal(r.candidates.length,2);
  assert(calls.some(p=>p.tessedit_char_whitelist===''),'name OCR must disable the ID-only whitelist');
  assert.equal(calls.at(-1).tessedit_char_whitelist,'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-');
  console.log('PASS: name fallback recognizes shared names, does not auto-guess an ID, and restores OCR parameters');
})().catch(err=>{console.error(err);process.exitCode=1});
