'use strict';
const assert=require('node:assert/strict');
const fs=require('fs'), vm=require('vm'),path=require('path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();',`  globalThis.TEST={detectPrintedIds,visibleCameraCanvas,recognizeIdFrame};`);
const actions=[];
function newCanvas(){
 const result={width:0,height:0,getContext(){return {drawImage(...args){actions.push(args)},set imageSmoothingEnabled(v){},set imageSmoothingQuality(v){},set filter(v){}}},setAttribute(){}};
 return result;
}
const el={width:0,height:0,getContext(){return {drawImage(){}}},setAttribute(){},innerHTML:'',textContent:'',classList:{toggle(){},remove(){}},addEventListener(){},dataset:{}};
const doc={querySelector(){return el},addEventListener(){},querySelectorAll(){return[]},createElement(tag){if(tag==='canvas')return newCanvas();throw Error('unexpected '+tag)}};
const store={};
const ctx={console,setTimeout,clearTimeout,setInterval:()=>{},crypto:require('crypto').webcrypto,Math,Date,JSON,Map,Set,Blob,URL,Intl,Number,String,Object,Array,window:{addEventListener(){}},document:doc,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v}}};
vm.createContext(ctx);vm.runInContext(source,ctx);
const T=ctx.TEST;
for(const [ocr,id] of [
 ['OP16-113', 'OP16-113'],
 ['OP14-10396','OP14-103'],
 ['P16-113','OP16-113'],
 ['OPI6-I13','OP16-113'],
 ['P-069','P-069'],
 ['OP05-015','OP05-015'],
])assert(T.detectPrintedIds(ocr).includes(id),`${ocr} should yield ${id}: ${T.detectPrintedIds(ocr)}`);
const v={videoWidth:1920,videoHeight:1080,getBoundingClientRect(){return {width:300,height:400}}};
const portrait=T.visibleCameraCanvas(v,2100);
assert.equal(portrait.width,810);assert.equal(portrait.height,1080);
const crop=actions[0];assert.equal(Math.round(crop[1]),555);assert.equal(crop[2],0);assert.equal(Math.round(crop[3]),810);assert.equal(crop[4],1080);
const calls=[];const worker={setParameters:async opts=>calls.push('psm'+opts.tessedit_pageseg_mode),recognize:async()=>{calls.push('ocr');return {data:{text:'OP16-113'}}}};
(async()=>{
 const r=await T.recognizeIdFrame(portrait,worker,{quick:true,attempt:1});
 assert.equal(r.ids[0],'OP16-113');
 assert.deepEqual(calls,['psm7','ocr','ocr']);
 assert.equal(r.confirmedInFrame,true,'two matching crops corroborate one captured frame');
 console.log('PASS: OCR parsing for both example cards, OCR confusing characters, promo, and portrait preview cropping; focused single-line scanner');
})().catch(err=>{console.error(err);process.exitCode=1});
