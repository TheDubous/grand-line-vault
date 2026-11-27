#!/usr/bin/env node
/**
 * Refresh a public, provenance-rich sample of real One Piece tournament decklists.
 * Uses Limitless' documented tournament API (no access token). Strict validation:
 * never produce incomplete/fictional decks and never overwrite good data with
 * a failed or empty sync.
 * Docs: https://docs.limitlesstcg.com/developer/tournaments.html
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';

const ROOT='https://play.limitlesstcg.com/api';
const OUT=resolve('data/recommended-decks.json');
const ID=/^(?:OP|EB|ST|PRB)\d{1,3}-\d{2,4}$|^P-\d{2,4}$/;
const now=new Date();
const cutoff=Date.now()-1000*60*60*24*95;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const asId=s=>String(s||'').trim().toUpperCase().replace(/_P\d+$/,'');
function cardId(c){
 if(!c||typeof c!=='object')return '';
 const id=asId(c.cardId||c.id||(c.set&&c.number!=null?String(c.set)+'-'+String(c.number):''));
 return ID.test(id)?id:'';
}
function parseDecklist(raw){
 if(!raw)return null;
 let leader='',cards=[];
 if(typeof raw==='object'&&!Array.isArray(raw)){
   leader=cardId(raw.leader);
   for(const group of ['character','event','stage']){
     for(const item of Array.isArray(raw[group])?raw[group]:[]){
       const id=cardId(item),qty=Number(item.count??item.qty??1);
       if(id)cards.push({cardId:id,qty});
     }
   }
 }else if(typeof raw==='string'){
   const lines=raw.replaceAll(';','\n').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const ids=[];
   for(const line of lines){
     const match=/^(\d{1,2})\s*[xX×]?\s*((?:OP|EB|ST|PRB)\d{1,3}-\d{2,4}|P-\d{2,4})$/i.exec(line);
     if(!match)return null;
     ids.push({cardId:asId(match[2]),qty:Number(match[1])});
   }
   if(ids[0]?.qty===1){leader=ids[0].cardId;cards=ids.slice(1);}
 }else return null;
 if(!leader||!cards.length)return null;
 const byId=new Map();
 for(const row of cards){
   if(!ID.test(row.cardId)||!Number.isInteger(row.qty)||row.qty<1||row.qty>4)return null;
   byId.set(row.cardId,(byId.get(row.cardId)||0)+row.qty);
 }
 if([...byId.values()].some(qty=>qty>4))return null;
 if([...byId.values()].reduce((n,q)=>n+q,0)!==50)return null;
 return {leaderId:leader,cards:[...byId].map(([cardId,qty])=>({cardId,qty}))};
}
async function getJson(path){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),19000);
 try{
   const response=await fetch(ROOT+path,{headers:{'Accept':'application/json','User-Agent':'GrandLineVault/1.4-deck-recommender'} ,signal:controller.signal});
   if(!response.ok)throw Error(path+' HTTP '+response.status);
   return await response.json();
 }finally{clearTimeout(timeout);}
}
async function main(){
 const tournaments=await getJson('/tournaments?game=OP&limit=90');
 if(!Array.isArray(tournaments))throw Error('Unexpected tournament payload');
 const events=tournaments
   .filter(e=>e.game==='OP'&&Date.parse(e.date)>=cutoff&&Number(e.players)>=8)
   .sort((a,b)=>Date.parse(b.date)-Date.parse(a.date))
   .slice(0,30);
 const decks=[];
 for(const event of events){
   await sleep(300); // avoid bursting public rate limit
   let standings;
   try{standings=await getJson('/tournaments/'+encodeURIComponent(event.id)+'/standings');}
   catch(e){console.warn('Skipping',event.id,String(e));continue;}
   if(!Array.isArray(standings))continue;
   const maxPlace=Number(event.players)>=32?8:Number(event.players)>=16?4:2;
   for(const row of standings){
     const placing=Number(row.placing);
     if(!Number.isInteger(placing)||placing<1||placing>maxPlace)continue;
     const list=parseDecklist(row.decklist);
     if(!list)continue;
     const player=String(row.player||row.name||'unknown').slice(0,120);
     decks.push({
       id:String(event.id)+':'+player,
       leaderId:list.leaderId,cards:list.cards,
       name:String(row.deck?.name||row.decklist?.leader?.name||list.leaderId).slice(0,100),
       player:String(row.name||player).slice(0,100),
       placing,event:String(event.name||'Limitless event').slice(0,130),
       eventDate:String(event.date||'').slice(0,40),players:Number(event.players),
       source:'Limitless TCG',sourceType:'tournament',
       url:'https://play.limitlesstcg.com/tournament/'+encodeURIComponent(event.id)+'/player/'+encodeURIComponent(row.player||player)+'/decklist',
       format:String(event.format||'unknown'),
       // We cannot infer bans, legal pool or environment solely from event metadata.
       legality:'not-verified',collectedAt:now.toISOString()
     });
   }
   if(decks.length>=180)break;
 }
 if(decks.length===0)throw Error('No validated 50-card One Piece decklists; existing feed retained');
 const output={version:1,generatedAt:now.toISOString(),source:'Limitless TCG public tournament API',note:'Historical tournament lists. Format and current bans/restrictions must be checked separately.',decks:decks.slice(0,180)};
 await mkdir(dirname(OUT),{recursive:true});
 const old=await readFile(OUT,'utf8').catch(()=>null);
 const next=JSON.stringify(output,null,2)+'\n';
 if(old===next){console.log('Feed unchanged');return;}
 await writeFile(OUT,next);
 console.log('Saved',output.decks.length,'verified-size event decklists from',events.length,'recent tournaments');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
