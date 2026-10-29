'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
let source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
source=source.replace('  render();loadCatalog();', '  globalThis.__pw={sync,state,cloudView};');
const actions={},elements=new Map(),store={};
const el=(id)=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',dataset:{},style:{},classList:{toggle(){},remove(){},add(){}},addEventListener(){},setAttribute(){},focus(){},querySelectorAll(){return []}});return elements.get(id)};
class MockFormData {constructor(form){this.fields=form.fields}get(k){return this.fields[k]||''}}
const events={};
const ctx={console,crypto:require('node:crypto').webcrypto,localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},window:{addEventListener(){},scrollTo(){}},document:{querySelector:el,querySelectorAll(){return[]},addEventListener(name,fn){events[name]=fn}},FormData:MockFormData,Date,Set,Map,Intl,JSON,Number,Math,Object,Array,Blob,URL,confirm:()=>true,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0};
vm.createContext(ctx);vm.runInContext(source,ctx);
const {sync,state,cloudView}=ctx.__pw;
let calls=[];
sync.config={url:'https://example.supabase.co',key:'sb_publishable_test'};
sync.client={auth:{
 signInWithPassword:async x=>{calls.push({type:'signIn',email:x.email,password:x.password});return {error:{message:'mock invalid credentials'}}},
 updateUser:async x=>{calls.push({type:'update',password:x.password});return {error:null}},
}};
function submit(type,fields){const form={dataset:{form:type},fields,reset(){calls.push({type:'reset'})},closest(sel){return sel==='form[data-form]'?this:null}};events.submit({target:form,preventDefault(){}})}
(async()=>{
  assert(cloudView().includes('Sign in with email and password'));
  assert(cloudView().includes('type="password"'));
  assert(!cloudView().includes('name="password" value='));
  submit('cloud-password-login',{email:'owner@example.com',password:'notTheRealSecret'});
  await new Promise(r=>setImmediate(r));
  assert.equal(calls.find(x=>x.type==='signIn').email,'owner@example.com');
  sync.user={id:'one',email:'owner@example.com'};
  assert(cloudView().includes('Set or change your password'));
  submit('cloud-set-password',{password:'a-strong-long-demo-passphrase',confirm:'a-strong-long-demo-passphrase'});
  await new Promise(r=>setImmediate(r));
  assert.equal(calls.find(x=>x.type==='update').password,'a-strong-long-demo-passphrase');
  assert(calls.some(x=>x.type==='reset'));
  const before=calls.length;
  submit('cloud-set-password',{password:'a-strong-long-demo-passphrase',confirm:'differentpassphrase'});
  await new Promise(r=>setImmediate(r));
  assert.equal(calls.length,before,'mismatched passwords must not be submitted');
  assert(source.includes('persistSession:true,autoRefreshToken:true'));
  assert(source.includes('shouldCreateUser:false'));
  assert(source.includes("signOut({scope:'local'})"));
  console.log('PASS: password login, changing password, mismatch safety, persistent device sessions, no automatic account signup');
})().catch(e=>{console.error(e);process.exitCode=1});
