'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../deck-intelligence.js');

const leader={id:'OP05-002',name:'Test Leader',category:'Leader',colors:'Red / Yellow',types:[],effect:''};
const ids=Array.from({length:13},(_,i)=>'OP05-'+String(100+i).padStart(3,'0'));
const catalog=[
 leader,
 ...ids.map((id,i)=>({id,name:'Test Character '+i,category:'Character',colors:'Red',cost:i%5+1,
 counter:i%3===0?2000:1000,types:['Revolutionary Army'],effect:i===0?'Look at up to 5 cards and add up to 1 card to your hand.':'Give this Character +1000 power during this turn.'})),
 {id:'OP05-201',name:'Alternate Searcher',category:'Character',colors:'Red',cost:1,counter:2000,types:['Revolutionary Army'],effect:'Look at up to 5 cards from the top of your deck and add 1 to your hand.'},
 {id:'OP05-202',name:'Other color',category:'Character',colors:'Blue',cost:1,counter:2000,types:['Revolutionary Army'],effect:'Search your deck'},
 {id:'OP05-203',name:'Different color combo',category:'Character',colors:'Red / Blue',cost:1,counter:1000,types:[],effect:''},
 {id:'EB05-001',name:'Restricted Pair Test',category:'Character',colors:'Red',cost:2,counter:1000,types:[],effect:''},
];
const source={id:'event-1',leaderId:leader.id,cards:ids.map((cardId,i)=>({cardId,qty:i===12?2:4})),name:'Reference Deck',
  source:'Limitless TCG',sourceType:'tournament',url:'https://play.limitlesstcg.com/tournament/abc',event:'Example Tournament',placing:1};
const ref=D.normalize(source);
assert(ref&&ref.cards.reduce((sum,c)=>sum+c.qty,0)===50);
assert(D.normalize({...source,cards:[{cardId:ids[0],qty:5} ]})===null,'invalid count rejected');
assert(D.normalize({...source,cards:[{cardId:ids[0],qty:4},{cardId:ids[0],qty:4}]})===null,'duplicates over four rejected');
assert(D.parseTextDeck(D.exported(ref)),'OPTCGSim list roundtrips');
assert(D.parseTextDeck('1xOP05-002\n4xOP05-015')===null,'incomplete deck is rejected');
assert(D.roles(catalog.find(c=>c.id===ids[0])).has('Searcher'));
assert(D.matchesLeader(catalog.find(c=>c.id==='OP05-201'),leader));
assert(!D.matchesLeader(catalog.find(c=>c.id==='OP05-202'),leader),'reject wrong-color');
assert(!D.matchesLeader(catalog.find(c=>c.id==='OP05-203'),leader),'reject off-color dual');
const inventory=[{cardId:leader.id,qty:1},
 ...ids.map((cardId,i)=>({cardId,qty:i===0?0:i===12?2:4})),
 {cardId:'OP05-201',qty:4},
 {cardId:'OP05-202',qty:4}
];
const found=D.availability(ref,inventory);
assert.equal(found.missingCopies,4);assert.equal(found.ownedCopies,46);
const choices=D.alternatives(ids[0],ref,{catalog,inventory,cap:6});
assert(choices.some(c=>c.cardId==='OP05-201'),'same-role owned substitute exists');
assert(!choices.some(c=>c.cardId==='OP05-202'),'off-color is never proposed');
const owned=D.generateOwned(ref,{catalog,inventory,mode:'balanced'});
assert.equal(owned.unfilled,0,'with replacement available, all 50 slots should be filled');
assert.equal(owned.draft.cards.reduce((n,r)=>n+r.qty,0),50);
assert(owned.changes.some(c=>c.from===ids[0]&&c.to==='OP05-201'));
assert.deepEqual(D.guard(owned.draft,catalog).errors,[]);
const swapped=D.applySwap(ref,ids[0],'OP05-201',{catalog,inventory});
assert.equal(swapped.cards.reduce((n,c)=>n+c.qty,0),50,'swap preserves exact size');
assert.throws(()=>D.applySwap(ref,ids[0],'OP05-202',{catalog,inventory}),/Incompatible/);
assert.throws(()=>D.applySwap(ref,ids[0],ids[1],{catalog,inventory}),/Four-copy/);
assert.equal(D.generateOwned(ref,{catalog,inventory:inventory.filter(e=>e.cardId!=='OP05-201'),mode:'conservative'}).unfilled,4);
const banned={leaderId:'OP13-001',cards:[{cardId:'EB05-001',qty:1}]};
assert(D.guard(banned,[...catalog,{id:'OP13-001',category:'Leader',colors:'Red',types:[]}],false).errors.some(e=>e.includes('Restricted pairing')),'known banned pair flagged');
const generated=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
assert(generated.includes('deck-intelligence.js?v=1.4.0')&&generated.includes('data-view="intelligence"'));
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
assert(app.includes("state.view==='intelligence'")&&app.includes("engine().generateOwned"));
assert(app.includes("if(!requireCloudEdit())return;"),'cloud authorization is retained');
assert(!app.includes('state.data.entries.push(d)'), 'recommender never adds physical copies');
console.log('PASS: verified-size reference lists, source-aware owned substitution, Leader legality, four-copy cap, experimental swaps, and no inventory mutation');
