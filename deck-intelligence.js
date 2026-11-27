/* Grand Line Vault Deck Intelligence v1.4.0.
   Pure, explainable card matching. No AI-generated card IDs or fabricated results.
   Tournament feeds are third-party references and not current legality certificates.
*/
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DeckIntelligence=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ID=/^(?:(?:OP|EB|ST|PRB)\d{1,3}-\d{2,4}|P-\d{2,4})$/;
  const norm=s=>String(s||'').trim().toUpperCase().replace(/_(?:P|R)\d+$/i,'');
  const text=s=>String(s||'').toLowerCase();
  const CARD_CATEGORIES=new Set(['Character','Event','Stage']);
  const COLOR_NAMES=['Red','Green','Blue','Purple','Black','Yellow'];
  function colors(c){return String(c?.colors||'').split(/\s*\/\s*/).map(x=>x.toLowerCase().trim()).filter(Boolean);}
  function catalogMap(catalog){return new Map((catalog||[]).map(c=>[norm(c.id),c]));}
  function ownedMap(inventory){const map=new Map();for(const e of (inventory||[])){const id=norm(e.cardId),qty=Number(e.qty);if(ID.test(id)&&Number.isInteger(qty)&&qty>0)map.set(id,(map.get(id)||0)+qty);}return map;}
  function normalize(ref){
    if(!ref||typeof ref!=='object')return null;
    const leaderId=norm(ref.leaderId);
    if(!ID.test(leaderId)||!Array.isArray(ref.cards)||ref.cards.length>65)return null;
    const cards=new Map();
    for(const line of ref.cards){
      const id=norm(line?.cardId),qty=Number(line?.qty);
      if(!ID.test(id)||id===leaderId||!Number.isInteger(qty)||qty<1||qty>4)return null;
      const next=(cards.get(id)||0)+qty;
      if(next>4)return null;cards.set(id,next);
    }
    const total=[...cards.values()].reduce((a,b)=>a+b,0);
    if(total!==50)return null;
    const result={
      id:String(ref.id||'import-'+leaderId).slice(0,160),leaderId,
      cards:[...cards].map(([cardId,qty])=>({cardId,qty})),
      name:String(ref.name||leaderId).slice(0,100),
      source:String(ref.source||'User-imported list').slice(0,100),
      sourceType:ref.sourceType==='tournament'?'tournament':'manual',
      url: /^https:\/\//.test(String(ref.url||''))?String(ref.url).slice(0,650):'',
      event:String(ref.event||'').slice(0,140),
      eventDate:String(ref.eventDate||'').slice(0,40),
      player:String(ref.player||'').slice(0,100),
      placing:Number.isInteger(Number(ref.placing))?Number(ref.placing):null,
      players:Number.isInteger(Number(ref.players))?Number(ref.players):null,
      format:String(ref.format||'unknown').slice(0,60)
    };
    return result;
  }
  function parseTextDeck(textList){
    const lines=String(textList||'').replaceAll(';','\n').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    if(lines.length>60)return null;
    const cards=[];
    for(const line of lines){
      const m=/^(\d{1,2})\s*[xX×]?\s*((?:(?:OP|ST|EB|PRB)-?\d{1,3}-\d{2,4}|P-\d{2,4})(?:_p\d+)?)$/i.exec(line);
      if(!m)return null;
      cards.push({cardId:norm(m[2]),qty:Number(m[1])});
    }
    const leader=cards.shift();
    if(!leader||leader.qty!==1)return null;
    return normalize({leaderId:leader.cardId,cards,name:'Imported '+leader.cardId,source:'User imported',sourceType:'manual'});
  }
  function matchesLeader(card,leader){
    if(!leader||!card)return false;
    if(!COLOR_NAMES.some(c=>colors(leader).includes(c.toLowerCase())))return false;
    const allowed=colors(leader);
    return colors(card).length>0&&colors(card).every(c=>allowed.includes(c));
  }
  function roles(card){
    if(!card)return new Set();
    const fx=text(card.effect)+' '+text(card.trigger);
    const r=new Set();
    if(/\[blocker\]|blocker/.test(fx))r.add('Blocker');
    if(/\[rush\]|\brush\b/.test(fx))r.add('Rush');
    if(/draw (?:up to )?\d+ card|draw a card|draw \d+ card/.test(fx))r.add('Card draw');
    if(/look at (?:up to )?.{0,45}cards|reveal (?:up to )?.{0,45}cards|search your deck|search (?:up to )?.{0,50}card/.test(fx))r.add('Searcher');
    if(/k\.o\.|knock out|bottom of the owner's deck|bottom of their deck|return.{0,40}to (?:the )?(?:owner.?s )?hand/.test(fx))r.add('Removal');
    if(/give.{0,30}don!!|add.{0,30}don!!|rested don!!|active don!!|don!! from your don!! deck/.test(fx))r.add('DON acceleration');
    if(/reduce.{0,45}cost|cost by -|give.{0,25}-\d+ cost/.test(fx))r.add('Cost reduction');
    if(/discard|trash.{0,35}hand/.test(fx))r.add('Hand disruption');
    if(/trash.{0,25}card.{0,25}play|play.{0,60}trash/.test(fx))r.add('Recursion');
    if(/life cards?|from your life|top of your life/.test(fx))r.add('Life manipulation');
    if(/rest.{0,35}character|set.{0,35}rested/.test(fx))r.add('Rest control');
    if(/power|during this turn|when attacking/.test(fx))r.add('Power/pressure');
    if(card.counter===2000)r.add('2000 counter');
    if(card.category==='Event'&&/counter/.test(fx))r.add('Counter event');
    if(card.category==='Character'&&Number(card.cost)>=7)r.add('Finisher');
    if(card.category==='Character'&&Number(card.cost)<=3)r.add('Early play');
    return r;
  }
  function confidence(a,b){
    const ra=roles(a),rb=roles(b);
    const strategic=[...ra].filter(k=>!['Finisher','Early play','2000 counter','Power/pressure'].includes(k));
    const matches=strategic.filter(r=>rb.has(r));
    const role=matches.length?matches.length/Math.max(strategic.length,1):strategic.length?0:0.35;
    const typeA=(a.types||[]).map(x=>text(x).trim()),typeB=(b.types||[]).map(x=>text(x).trim());
    const shared=typeA.filter(x=>typeB.includes(x));
    const trait=typeA.length?Math.min(1,shared.length/Math.max(1,Math.min(2,typeA.length))):0.25;
    const c1=Number(a.cost),c2=Number(b.cost);
    const curve=Number.isFinite(c1)&&Number.isFinite(c2)?Math.max(0,1-Math.abs(c1-c2)/6):0.4;
    const ca=a.counter===null?0:Number(a.counter)||0,cb=b.counter===null?0:Number(b.counter)||0;
    const defense=ca===cb?1:Math.abs(ca-cb)===1000?.5:0;
    const score=Math.round(100*(role*.45+trait*.23+curve*.22+defense*.10));
    const reasons=[];
    if(matches.length)reasons.push('Shared role: '+matches.slice(0,3).join(', '));
    if(shared.length)reasons.push('Shared trait: '+shared.slice(0,2).join(', '));
    if(Number.isFinite(c1)&&Number.isFinite(c2))reasons.push('Cost '+c1+' → '+c2);
    if(ca!==cb)reasons.push('Counter '+ca+' → '+cb);
    if(!matches.length)reasons.push('No verified matching strategic effect; experimental alternative');
    return {score,roleMatches:matches.length,reasons,exactRole:matches.length>0};
  }
  function guard(ref,catalog,strict50=true){
    const map=catalogMap(catalog),errors=[],warnings=[],leader=map.get(ref?.leaderId);
    if(!ref||!ID.test(ref.leaderId)){errors.push('Leader missing or invalid');return {errors,warnings};}
    if(leader&&leader.category!=='Leader')errors.push('Selected leader is not a Leader card');
    if(!leader)warnings.push('Leader not present in the current English card catalog; legality cannot be fully checked');
    const counts=new Map();
    for(const row of ref.cards||[]){
      const id=norm(row.cardId),qty=Number(row.qty);
      if(!ID.test(id)||!Number.isInteger(qty)||qty<1)errors.push('Invalid card ID or quantity '+id);
      counts.set(id,(counts.get(id)||0)+qty);
      if(counts.get(id)>4)errors.push('More than four copies of '+id);
      const c=map.get(id);
      if(!c)warnings.push('Unknown card in catalog: '+id);
      else if(!CARD_CATEGORIES.has(c.category))errors.push('Non-main-deck card '+id);
      else if(leader&&!matchesLeader(c,leader))errors.push('Wrong Leader color: '+id);
    }
    const total=[...counts.values()].reduce((n,v)=>n+v,0);
    if(strict50&&total!==50)errors.push('Main deck contains '+total+'/50 cards');
    // Known banned *pair* in the international format, effective 2026-11-27.
    // This is not an exhaustive live bans/restrictions service.
    if(['OP13-001','OP01-002'].includes(ref.leaderId)&&counts.has('EB05-001'))
      errors.push('Restricted pairing: EB05-001 cannot be combined with this Leader (2026-11-27)');
    warnings.push('Current official bans, restricted pairs, release eligibility and event format require manual verification');
    return {errors:[...new Set(errors)],warnings:[...new Set(warnings)],total};
  }
  function availability(ref,inventory){
    const owned=ownedMap(inventory),missing=[];
    for(const line of ref.cards){
      const have=owned.get(line.cardId)||0;
      if(have<line.qty)missing.push({cardId:line.cardId,required:line.qty,owned:have,missing:line.qty-have});
    }
    const leaderOwned=owned.get(ref.leaderId)||0;
    const ownedCopies=ref.cards.reduce((sum,c)=>sum+Math.min(c.qty,owned.get(c.cardId)||0),0);
    const needed=ref.cards.reduce((n,c)=>n+c.qty,0);
    return {ownedCopies,needed,missing,leaderOwned,missingCopies:needed-ownedCopies,coverage:needed?Math.round(ownedCopies/needed*100):0};
  }
  function alternatives(cardId,ref,{catalog=[],inventory=[],basis=null,strictOwned=true,cap=8,references=[]}={}){
    const map=catalogMap(catalog),needed=map.get(norm(cardId)),leader=map.get(ref.leaderId);
    if(!needed||!leader)return [];
    const own=ownedMap(inventory),inList=new Map((basis?.cards||ref.cards).map(x=>[x.cardId,x.qty]));
    const results=[];
    const peers=references.filter(x=>x.leaderId===ref.leaderId&&Array.isArray(x.cards)&&x.sourceType==='tournament');
    for(const c of map.values()){
      const id=norm(c.id);
      if(id===cardId||!CARD_CATEGORIES.has(c.category)||c.category!==needed.category)continue;
      if(!matchesLeader(c,leader))continue;
      const already=inList.get(id)||0;
      const available=Math.min(4-already,(strictOwned?(own.get(id)||0)-already:4-already));
      if(available<=0)continue;
      const fit=confidence(needed,c);
      const appearances=peers.filter(x=>x.cards.some(line=>line.cardId===id)).length;
      const evidence=peers.length>=3?Math.round(8*appearances/peers.length):0;
      const why=fit.reasons.slice();
      if(peers.length>=3&&appearances)why.push('Used in '+appearances+'/'+peers.length+' sampled tournament lists with this Leader');
      results.push({cardId:id,name:c.name||id,available,score:Math.min(100,fit.score+evidence),
        roleMatches:fit.roleMatches,why,confidence:fit.exactRole?'Role-supported':'Experimental',evidence:{appearances,sample:peers.length}});
    }
    results.sort((a,b)=>b.score-a.score||b.roleMatches-a.roleMatches||a.cardId.localeCompare(b.cardId));
    return results.slice(0,cap);
  }
  function generateOwned(ref,{catalog=[],inventory=[],mode='balanced',references=[]}={}){
    const map=catalogMap(catalog),own=ownedMap(inventory),leader=map.get(ref.leaderId);
    const placed=new Map(),changes=[],unfilled=[];
    for(const line of ref.cards){
      const qty=Math.min(line.qty,own.get(line.cardId)||0);
      if(qty)placed.set(line.cardId,qty);
      if(qty<line.qty)unfilled.push({cardId:line.cardId,missing:line.qty-qty});
    }
    if(!leader)return {draft:{...ref,cards:[...placed].map(([cardId,qty])=>({cardId,qty}))},changes,unfilled,errors:['Unknown Leader; cannot verify substitution color']};
    for(const gap of unfilled){
      let remaining=gap.missing;
      // Recalculate allowed quantities after each inserted alternative.
      const desired=map.get(gap.cardId);
      if(!desired)continue;
      for(const c of alternatives(gap.cardId,ref,{catalog,inventory,basis:{cards:[...placed].map(([cardId,qty])=>({cardId,qty}))},cap:25,references})){
        if(remaining<=0)break;
        if(mode==='conservative'&&c.roleMatches===0)continue;
        if(mode!=='experimental'&&c.score<35)continue;
        const available=Math.min(4-(placed.get(c.cardId)||0),(own.get(c.cardId)||0)-(placed.get(c.cardId)||0));
        const take=Math.min(remaining,available);
        if(take<=0)continue;
        placed.set(c.cardId,(placed.get(c.cardId)||0)+take);remaining-=take;
        changes.push({from:gap.cardId,to:c.cardId,qty:take,score:c.score,why:c.why,confidence:c.confidence});
      }
    }
    const cards=[...placed].map(([cardId,qty])=>({cardId,qty}));
    const total=cards.reduce((n,x)=>n+x.qty,0);
    const draft={...ref,cards,sourceType:'personal-variant',name:ref.name+' · owned adaptation'};
    return {draft,changes,unfilled:Math.max(0,50-total),issues:guard(draft,catalog,total===50)};
  }
  function upgradeIdeas(ref,{catalog=[],inventory=[],cap=10,references=[]}={}){
    const map=catalogMap(catalog),owner=ownedMap(inventory),out=[];
    const leader=map.get(ref.leaderId);
    if(!leader)return [];
    const counts=new Map(ref.cards.map(c=>[c.cardId,c.qty]));
    for(const item of ref.cards){
      const current=map.get(item.cardId);
      if(!current||!CARD_CATEGORIES.has(current.category))continue;
      const alts=alternatives(item.cardId,ref,{catalog,inventory,basis:ref,cap:6,references});
      for(const alt of alts.filter(x=>x.score>=50)){
        const newer=map.get(alt.cardId),sameCost=Math.abs((Number(newer.cost)||0)-(Number(current.cost)||0));
        const reason=alt.why.slice();
        // These are hypotheses, not empirical win-rate claims.
        if(sameCost<=1)reason.unshift('Similar DON cost; investigate as a flex-slot experiment');
        out.push({from:item.cardId,to:alt.cardId,score:alt.score,qty:1,why:reason,confidence:alt.confidence});
      }
    }
    out.sort((a,b)=>b.score-a.score||a.from.localeCompare(b.from)||a.to.localeCompare(b.to));
    const seen=new Set();
    return out.filter(x=>{const key=x.from+':'+x.to;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,cap);
  }
  function applySwap(draft,from,to,{catalog=[],inventory=[],ownedOnly=true}={}){
    const id1=norm(from),id2=norm(to);if(id1===id2)throw Error('Same card');
    const map=catalogMap(catalog),leader=map.get(draft.leaderId),c=map.get(id2);
    if(!leader||!c||!matchesLeader(c,leader)||!CARD_CATEGORIES.has(c.category))throw Error('Incompatible or unknown replacement');
    const copy={...draft,cards:draft.cards.map(x=>({...x}))};
    const fromLine=copy.cards.find(x=>x.cardId===id1);
    const toLine=copy.cards.find(x=>x.cardId===id2);
    if(!fromLine||fromLine.qty<1)throw Error('Original card not in the draft');
    if((toLine?.qty||0)>=4)throw Error('Four-copy limit reached');
    if(ownedOnly&&((ownedMap(inventory).get(id2)||0)<((toLine?.qty||0)+1)))throw Error('Replacement card not physically available');
    fromLine.qty--;if(fromLine.qty===0)copy.cards=copy.cards.filter(x=>x!==fromLine);
    if(toLine)toLine.qty++;else copy.cards.push({cardId:id2,qty:1});
    const v=guard(copy,catalog,false);
    if(v.errors.length)throw Error(v.errors[0]);
    return copy;
  }
  function exported(ref){
    return ['1x'+ref.leaderId,...ref.cards.slice().sort((a,b)=>a.cardId.localeCompare(b.cardId))
      .map(c=>c.qty+'x'+c.cardId)].join('\n')+'\n';
  }
  return {normalize,parseTextDeck,roles,confidence,guard,availability,alternatives,generateOwned,upgradeIdeas,applySwap,exported,ownedMap,matchesLeader,catalogMap};
});
