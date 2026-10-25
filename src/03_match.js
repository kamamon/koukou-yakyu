/* ================= 試合エンジン ================= */
function cpuRoster(name,strength,pref){
 const elite=strength>=90;const cap=elite?92:89;const maxR=elite?93.4:91.5;/* 無名のCPU選手は総合Sに届かない（Sは全国の注目選手だけ） */
 const q=strength;const mk=(pos,dq)=>{const p=genPlayer({grade:ri(1,3),q:clamp(q+dq,20,cap),pos,uniqProb:q>80?0.12:0.02});p.cpu=true;if(rating(p)>maxR)capRating(p,maxR);return p;};
 const lineupPos=['中','遊','三','一','左','捕','右','二'];
 const fielders=lineupPos.map((pos,i)=>mk(pos,i<4?ri(-2,6):ri(-8,2)));
 let ace=mk('投',ri(0,6));const rel=[mk('投',ri(-8,-2)),mk('投',ri(-14,-6))];
 /* 全国の注目選手が所属する学校なら、その選手を実際に入れる */
 for(const st of (typeof starsOf==='function'?starsOf(name,pref):[])){const sp=genPlayer({grade:st.grade,q:st.q,pos:st.pos,name:st.name,rank:st.rank,title:st.title,uniqProb:st.rank==='S'?0.8:0.5});sp.cpu=true;sp.nstar=st;sp.throws=st.throws;sp.bats=st.bats;
  if(st.pos==='投'){const vmin=st.rank==='S'?146:141;if(sp.pit.velo<vmin)sp.pit.velo=ri(vmin,vmin+8);sp.pit.pitches[0].velo=Math.round(sp.pit.velo);if(sp.pit.pitches.length<3){const names=shuffle(PITCH_NAMES.filter(n=>n!=='ナックル'&&!sp.pit.pitches.some(q=>q.name===n))).slice(0,3-sp.pit.pitches.length);for(const n of names){const off=PITCH_SPEED_OFF[n]||[-10,-20];sp.pit.pitches.push({name:n,velo:sp.pit.velo+ri(off[1],off[0]),move:ri(80,92),sharp:ri(80,92),ctrl:ri(78,90)});}}}
  boostToRating(sp,st.rank==='S'?ri(94,97):ri(88,92));if(st.rank!=='S'&&rating(sp)>93.2)capRating(sp,93.2);if(st.pos==='投'){if(ace.nstar){rel.unshift(ace);rel.length=Math.min(rel.length,3);}ace=sp;}
  else{let i=fielders.findIndex(f=>f.pos===st.pos&&!f.nstar);if(i<0)i=fielders.findIndex(f=>!f.nstar&&f.pos!=='捕');if(i<0)continue;sp.pos=fielders[i].pos;fielders[i]=sp;}}
 const benchF=[mk(pick(['一','二','三','左','右']),ri(-14,-6)),mk(pick(['捕','遊','中']),ri(-14,-6))];
 const lineup=fielders.map(p=>({p,pos:p.pos}));lineup.push({p:ace,pos:'投'});
 return {name,isUser:false,strength,pref,lineup,bench:rel.concat(benchF),pitcher:ace};
}
function userRoster(){ensureLineup();const a=active();const lineup=G.lineup.map(s=>({p:a.find(x=>x.id===s.pid),pos:s.pos})).filter(s=>s.p);const sp=lineup.find(s=>s.pos==='投');return {name:G.school.name,isUser:true,strength:teamStrength(),pref:G.school.pref,lineup,bench:benchPlayers(),pitcher:sp?sp.p:lineup[8].p,starters:new Set(lineup.map(s=>s.p.id))};}
function prepTeam(t){t.batIdx=0;t.pc={};t.stats={};t.pstats={};t.used=new Set(t.lineup.map(s=>s.p.id));t.starters=t.starters||new Set(t.lineup.map(s=>s.p.id));t.mound=0;t.compose=0;t.infieldIn=false;t.extraBoost=0;t.startPitcher=t.pitcher;calcDef(t);return t;}
function posCtx(pos){return {catcher:pos==='捕',infield:['一','二','三','遊'].includes(pos),outfield:['左','中','右'].includes(pos)};}
function calcDef(t){const f=t.lineup.filter(s=>s.pos!=='投');let errRes=0,defAdd=0;const fx=(s,r,b)=>{const p=s.p;const acc=abilAcc(p,posCtx(s.pos));let v=(p.bat.field+(acc.field||0))*0.4+p.bat[r]*0.2+p.bat[b]*0.2+p.bat.thr*0.2;errRes+=acc.errRes||0;defAdd+=acc.def||0;return v*posFit(p,s.pos);};
 t.defR=avg(f.map(s=>fx(s,'rfR','rbR')))+defAdd;t.defL=avg(f.map(s=>fx(s,'rfL','rbL')))+defAdd;t.errRes=clamp(errRes/8,-0.5,0.6);
 const c=t.lineup.find(s=>s.pos==='捕');if(c){const acc=abilAcc(c.p,posCtx('捕'));t.catcherArm=c.p.bat.arm*0.6+c.p.bat.thr*0.4+(acc.arm||0)*0.6+(acc.stealDef||0);}else t.catcherArm=40;
 const ps=t.pitcher?abilAcc(t.pitcher,posCtx('投')):{};t.defR+=(ps.def||0);t.defL+=(ps.def||0);t.errRes=clamp(t.errRes+(ps.errRes||0)/4,-0.5,0.6);}
function bst(t,p){if(!t.stats[p.id])t.stats[p.id]={p,pa:0,ab:0,h:0,hr:0,rbi:0,bb:0,so:0,sb:0,r:0,d:0,tr:0};return t.stats[p.id];}
function pst(t,p){if(!t.pstats[p.id])t.pstats[p.id]={p,ipo:0,h:0,r:0,er:0,bb:0,so:0,np:0,hr:0,order:Object.keys(t.pstats).length,maxV:0};return t.pstats[p.id];}
function isSummer(){return G.month===7||G.month===8;}
function isSpring(){return G.month>=3&&G.month<=5;}

class Match{
 constructor(A,B,opt){this.A=prepTeam(A);this.B=prepTeam(B);this.opt=opt||{};const u=this.A.isUser?this.A:this.B.isUser?this.B:null;if(u){if(G.coach.spec==='采配')u.extraBoost+=2;if(G.coach.spec==='メンタル'&&this.opt.importance>=1.6)u.extraBoost+=2;}this.inn=1;this.top=true;this.outs=0;this.bases=[null,null,null];this.score=[0,0];this.line=[[],[]];this.log=[];this.done=false;this.winner=null;this.errInn=false;this.endReason='';this.autoUntil=null;this.subsLog=[];this.startHalf();}
 bat(){return this.top?this.A:this.B}
 def(){return this.top?this.B:this.A}
 bi(){return this.top?0:1}
 user(){return this.A.isUser?this.A:this.B.isUser?this.B:null}
 userBatting(){return this.bat().isUser}
 userFielding(){return this.def().isUser}
 addLog(text,kind){this.log.push({inn:this.inn,top:this.top,text,kind:kind||'',s:this.score.slice()});}
 startHalf(){this.outs=0;this.bases=[null,null,null];this.errInn=false;const d=this.def();d.infieldIn=false;d.lastKey=null;this.line[this.bi()][this.inn-1]=0;
  if(d.needPitcher){const rel=d.bench.filter(x=>isPitcher(x)||x.sub.includes('投')).sort((a,b)=>pitRating(b)-pitRating(a))[0];const slot=d.lineup.find(s=>s.pos==='投');if(rel)this.changePitcher(d,rel);else{d.pitcher=slot?slot.p:d.pitcher;pst(d,d.pitcher);d.needPitcher=false;this.addLog(`${d.name} 投手がいないため${d.pitcher.name}が登板`,'sub');}}
  this.addLog(`${this.inn}回${this.top?'表':'裏'} ${this.bat().name}の攻撃`,'inn');
  if(this.inn>=10){const t=this.bat(),n=t.lineup.length;this.bases[0]=t.lineup[(t.batIdx+n-1)%n].p;this.bases[1]=t.lineup[(t.batIdx+n-2)%n].p;this.addLog('タイブレーク：無死一・二塁から開始','note');}}
 situation(){const t=this.bat(),d=this.def();const s=t.lineup[t.batIdx];return {inn:this.inn,top:this.top,outs:this.outs,bases:this.bases.map(b=>b?b.name:null),batter:s.p,batPos:s.pos,order:t.batIdx+1,pitcher:d.pitcher,pc:d.pc[d.pitcher.id]||0,score:this.score.slice(),batTeam:t.name,defTeam:d.name};}
 bigStage(){return this.opt.importance>=1.6}
 /* 状況フラグ */
 baseCtx(side){const bi=side==='bat'?this.bi():1-this.bi();const diff=this.score[bi]-this.score[1-bi];const bat=this.bat();
  return {risp:!!(this.bases[1]||this.bases[2]),loaded:this.bases.every(Boolean),runners:this.bases.some(Boolean),empty:!this.bases.some(Boolean),twoOut:this.outs===2,noOut:this.outs===0,late:this.inn>=7,early:this.inn<=3,extra:this.inn>=10,big:this.bigStage(),behind:diff<=-3,behind1:diff<0,ahead:diff>0,tie:diff===0,close:Math.abs(diff)<=1,walkoff:!this.top&&this.inn>=9&&this.score[1]<=this.score[0],summer:isSummer(),spring:isSpring()};}
 batCtx(b,p,pitch){const t=this.bat();const c=this.baseCtx('bat');const bs=bst(t,b);const idx=t.batIdx;Object.assign(c,{firstPA:bs.pa===0,hot:bs.h>=2,cold:bs.ab>=2&&bs.h===0,vsL:p.throws==='左',vsR:p.throws==='右',vsAce:pitRating(p)>=70,vsWeak:pitRating(p)<50,vsBreak:pitch.name!=='ストレート',vsFast:pitch.name==='ストレート',pinch:!t.starters.has(b.id),leadoff:idx===0,cleanup:idx>=2&&idx<=4,lower:idx>=6});return c;}
 pitCtx(p,b,pitch){const d=this.def();const c=this.baseCtx('def');const ps=pst(d,p);const bHand=b.bats==='両'?(p.throws==='右'?'左':'右'):b.bats;Object.assign(c,{pL:bHand==='左',pR:bHand==='右',vsPower:(b.bat.powR+b.bat.powL)/2>=68,vsWeak:batRating(b)<48,fast:pitch.name==='ストレート',break:pitch.name!=='ストレート',reliever:ps.order>0,starter:ps.order===0,tired:(d.pc[p.id]||0)>this.pitchCap(p),fresh:(d.pc[p.id]||0)<40,left:p.throws==='左'});return c;}
 teamBoost(t,ctx){let b=t.extraBoost||0;for(const s of t.lineup){const acc=abilAcc(s.p,Object.assign({},ctx,posCtx(s.pos)));b+=acc.team||0;}return Math.min(b,8);}
 pitchCap(p){let cap=50+p.pit.stamina*1.2+abilStatic(p,'cap');return cap;}
 tired(d,p,acc){const pc=d.pc[p.id]||0;let t=Math.max(0,(pc-this.pitchCap(p)-(acc?acc.cap||0:0))/60)*(acc&&acc.tiredMul!=null?acc.tiredMul:abilStatic(p,'tiredMul'));t=Math.min(t,0.45);if(p.fatigue>60)t+=(p.fatigue-60)/250;return Math.min(t,0.55);}
 battingEff(b,p,pitch){const t=this.bat();const ctx=this.batCtx(b,p,pitch);const acc=abilAcc(b,ctx);const vsR=p.throws==='右';
  let meet=(vsR?b.bat.meetR:b.bat.meetL)+(acc.meet||0),pow=(vsR?b.bat.powR:b.bat.powL)+(acc.pow||0),eye=b.bat.eye+(acc.eye||0);
  let mult=(acc.mult||0);if(ctx.risp)mult+=(b.bat.clutch-50)/100*0.5;
  const boost=this.teamBoost(t,ctx)+condOf(b)*4;meet+=boost;pow+=boost;
  meet*=1+mult;pow*=1+mult;
  const f=1-clamp((b.fatigue-50)/100,0,0.3);
  return {meet:meet*f,pow:pow*f,eye,kRes:acc.kRes||0,bunt:b.bat.bunt+(acc.bunt||0),speed:b.bat.speed+(acc.speed||0),steal:b.bat.steal+(acc.steal||0),hrp:acc.hrp||0,xb:acc.xb||0,dpRes:acc.dpRes||0,safeBunt:acc.safeBunt||0};}
 pitchingEff(p,b,pitch){const d=this.def();const ctx=this.pitCtx(p,b,pitch);const acc=abilAcc(p,ctx);const vsR=ctx.pR;
  let hit=(vsR?p.pit.hitR:p.pit.hitL)+(acc.hit||0),hr=(vsR?p.pit.hrR:p.pit.hrL)+(acc.hr||0),k=(vsR?p.pit.kR:p.pit.kL)+(acc.k||0),velo=p.pit.velo+(acc.velo||0);
  const boost=this.teamBoost(d,ctx)+condOf(p)*4;hit+=boost;k+=boost;
  let tired=this.tired(d,p,acc);if(d.compose>0)tired=Math.max(0,tired-0.12);
  const f=1-tired;
  let ctrlMod=(acc.ctrl||0)+(d.compose>0?5:0);
  return {hit:hit*f,hr:hr*f,k:k*f,velo:velo-tired*8,tired,ctrlMod,sharpMod:acc.sharp||0,moveMod:acc.move||0,stealDef:acc.stealDef||0};}
 pickPitch(p){const ps=p.pit.pitches;if(!ps.length)return {name:'ストレート',velo:p.pit.velo,move:40,sharp:40,ctrl:40};const w=ps.map(x=>Math.max(5,(x.move+x.sharp+x.ctrl)/3)*(x.name==='ストレート'?1.5:1));let r=R()*sum(w);for(let i=0;i<ps.length;i++){r-=w[i];if(r<=0)return ps[i];}return ps[0];}
 scoreRun(runner,batter,rbi){const t=this.bat(),d=this.def();this.score[this.bi()]++;this.line[this.bi()][this.inn-1]++;bst(t,runner).r++;if(rbi&&batter)bst(t,batter).rbi++;const ps=pst(d,d.pitcher);ps.r++;if(!this.errInn)ps.er++;if(this.scoredNow)this.scoredNow.push(runner.id);}
 advanceAll(n,batter,rbi){for(let i=2;i>=0;i--){const r=this.bases[i];if(!r)continue;const to=i+n;this.bases[i]=null;if(to>=3)this.scoreRun(r,batter,rbi);else this.bases[to]=r;}}
 forceAdvance(batter){if(this.bases[0]){if(this.bases[1]){if(this.bases[2])this.scoreRun(this.bases[2],batter,true);this.bases[2]=this.bases[1];}this.bases[1]=this.bases[0];}this.bases[0]=batter;}
 runnerSpeed(r){return r.bat.speed+abilStatic(r,'speed');}
 placeSingle(b){const sp=r=>this.runnerSpeed(r);
  if(this.bases[2]){this.scoreRun(this.bases[2],b,true);this.bases[2]=null;}
  if(this.bases[1]){const r=this.bases[1];this.bases[1]=null;if(R()<0.62+(sp(r)-50)/220)this.scoreRun(r,b,true);else this.bases[2]=r;}
  if(this.bases[0]){const r=this.bases[0];this.bases[0]=null;if(!this.bases[2]&&R()<0.25+(sp(r)-50)/250)this.bases[2]=r;else if(!this.bases[1])this.bases[1]=r;else this.bases[2]=r;}
  this.bases[0]=b;}
 placeDouble(b){const sp=r=>this.runnerSpeed(r);if(this.bases[2]){this.scoreRun(this.bases[2],b,true);this.bases[2]=null;}if(this.bases[1]){this.scoreRun(this.bases[1],b,true);this.bases[1]=null;}if(this.bases[0]){const r=this.bases[0];this.bases[0]=null;if(R()<0.42+(sp(r)-50)/200)this.scoreRun(r,b,true);else this.bases[2]=r;}this.bases[1]=b;}
 outsUp(n){this.outs+=n;const d=this.def();const ps=pst(d,d.pitcher);ps.ipo+=n;}
 /* 1打席処理 cmd: null|'bunt'|'steal'|'hitrun'|'ibb' */
 playPA(cmd){
  const t=this.bat(),d=this.def();const slot=t.lineup[t.batIdx];const b=slot.p;const p=d.pitcher;
  const bs=bst(t,b),ps=pst(d,p);
  const pitch=this.pickPitch(p);
  const be=this.battingEff(b,p,pitch),pe=this.pitchingEff(p,b,pitch);
  const name=b.name;const pre=`${this.outs}死${this.basesStr()} `;
  /* 最速計測 */
  if(pitch.name==='ストレート'){const v=Math.min(Math.round(p.pit.velo)+2,Math.round(p.pit.velo+gauss(0,1.2)-this.tired(d,p)*6));if(v>ps.maxV)ps.maxV=v;}
  if(cmd==='ibb'){bs.pa++;bs.bb++;ps.bb++;this.forceAdvance(b);d.pc[p.id]=(d.pc[p.id]||0)+4;ps.np+=4;this.addLog(`${pre}${name} 敬遠四球`,'bb');this.nextBatter();return 'ibb';}
  if(cmd==='steal'){this.trySteal(pe);if(this.outs>=3){this.endHalf();return 'steal';}}
  if(cmd==='bunt'&&(this.bases[0]||this.bases[1])&&this.outs<2){return this.doBunt(b,be,pe);}
  const sharp=pitch.sharp+pe.sharpMod,ctrl=pitch.ctrl+pe.ctrlMod,move=pitch.move+pe.moveMod;
  let kp=0.16+(pe.k-50)/750+(sharp-50)/850+(pe.velo-120)/400-(be.meet-50)/750-(be.eye-50)/1100-be.kRes/300;kp=clamp(kp,0.04,0.45);
  let bbp=0.085+(be.eye-50)/700-(ctrl-50)/600+pe.tired*0.08;bbp=clamp(bbp,0.02,0.28);
  const hbp=0.008;
  let r=R();let np=0;
  const hitrun=cmd==='hitrun'&&this.bases[0]&&!this.bases[1];
  if(hitrun){kp*=0.9;}
  let ev=null;
  if(r<kp){np=ri(4,6);bs.pa++;bs.ab++;bs.so++;ps.so++;this.outsUp(1);this.addLog(`${pre}${name} 三振（${pitch.name}）`,'k');if(hitrun&&this.bases[0]&&R()<0.55){const rn=this.bases[0];this.bases[0]=null;this.outsUp(1);this.addLog(`${rn.name} 盗塁失敗（三振ゲッツー）`,'out');}ev='K';}
  else if(r<kp+bbp){np=ri(5,7);bs.pa++;bs.bb++;ps.bb++;this.forceAdvance(b);this.addLog(`${pre}${name} 四球`,'bb');ev='BB';}
  else if(r<kp+bbp+hbp){np=ri(2,5);bs.pa++;ps.bb++;this.forceAdvance(b);this.addLog(`${pre}${name} 死球`,'bb');ev='HBP';}
  else{np=ri(1,5);bs.pa++;bs.ab++;
   const bHand=b.bats==='両'?(p.throws==='右'?'左':'右'):b.bats;const def=bHand==='右'?d.defR:d.defL;
   let hrp=0.013+(be.pow-50)/1000-(pe.hr-50)/1200-(sharp-50)/3000+be.hrp;hrp=clamp(hrp,0.002,0.1);
   let hp=0.31+(be.meet-50)/850-(pe.hit-50)/850-(def-50)/1200-(move-50)/1800+(be.pow-50)/1400-(pe.velo-120)/1600+(d.infieldIn?0.05:0);hp=clamp(hp*(1+pe.tired*0.2),0.16,0.46);
   let ep=clamp((0.02-(def-50)/3000)*(1-d.errRes),0.004,0.05);
   const r2=R();
   if(r2<hrp){bs.h++;bs.hr++;ps.h++;ps.hr++;const nOn=this.bases.filter(Boolean).length;this.advanceAll(3,b,true);this.scoreRun(b,b,true);this.addLog(`${pre}${name} ${nOn+1}ラン本塁打！！`,'hr');ev='HR';}
   else if(r2<hrp+hp){bs.h++;ps.h++;const x=R();const dp=clamp(0.17+(be.pow-50)/300+(be.speed-50)/700+be.xb,0.05,0.45),tp=clamp(0.015+(be.speed-50)/400,0.003,0.1);
    if(x<tp){bs.tr++;this.advanceAll(3,b,true);this.bases[2]=b;this.addLog(`${pre}${name} 三塁打！`,'hit');ev='3B';}
    else if(x<tp+dp){bs.d++;this.placeDouble(b);this.addLog(`${pre}${name} 二塁打！`,'hit');ev='2B';}
    else{if(hitrun&&this.bases[0]){const rn=this.bases[0];this.bases[0]=null;if(this.bases[2]){this.scoreRun(this.bases[2],b,true);this.bases[2]=null;}if(this.bases[1]){this.scoreRun(this.bases[1],b,true);this.bases[1]=null;}this.bases[2]=rn;this.bases[0]=b;this.addLog(`${pre}${name} ヒット！エンドラン成功で走者三塁へ`,'hit');}else{this.placeSingle(b);this.addLog(`${pre}${name} ${pick(['センター前','レフト前','ライト前','内野安打','左中間へ','右中間へ'])}ヒット`,'hit');}ev='1B';}}
   else if(r2<hrp+hp+ep){this.errInn=true;this.forceAdvance(b);this.addLog(`${pre}${name} 相手のエラーで出塁`,'err');ev='E';}
   else{const g=R();const r3=this.bases[2],r2b=this.bases[1],r1=this.bases[0];
    if(g<0.52){
     if(r1&&this.outs<2&&!hitrun){const dpp=clamp(0.4-(this.runnerSpeed(r1)-50)/150-(be.speed-50)/300+(def-50)/400-be.dpRes,0.05,0.6);
      if(R()<dpp){this.bases[0]=null;this.outsUp(2);this.addLog(`${pre}${name} 併殺打`,'out');ev='DP';}
      else{if(R()<0.5){this.bases[0]=b;this.addLog(`${pre}${name} 野選/ゴロで一塁走者封殺`,'out');}else this.addLog(`${pre}${name} ${pick(['ショートゴロ','セカンドゴロ','サードゴロ','ファーストゴロ'])}`,'out');this.outsUp(1);
       if(this.outs<3){if(r3&&!d.infieldIn&&R()<0.4){this.scoreRun(r3,b,true);this.bases[2]=null;}if(this.bases[1]&&!this.bases[2]&&R()<0.35){this.bases[2]=this.bases[1];this.bases[1]=null;}}ev='GO';}}
     else{this.outsUp(1);this.addLog(`${pre}${name} ${pick(['ショートゴロ','セカンドゴロ','サードゴロ','ピッチャーゴロ'])}`,'out');
      if(this.outs<3){if(r3&&!d.infieldIn&&R()<0.45){this.scoreRun(r3,b,true);this.bases[2]=null;}if(r2b&&!r3&&R()<0.4){this.bases[2]=r2b;this.bases[1]=null;}if(hitrun&&r1&&!this.bases[1]){this.bases[1]=r1;this.bases[0]=null;}}ev='GO';}}
    else if(g<0.88){
     this.outsUp(1);const isDeep=R()<0.5;this.addLog(`${pre}${name} ${pick(['センターフライ','レフトフライ','ライトフライ','左中間フライ'])}`,'out');
     if(this.outs<3){if(r3&&R()<(d.infieldIn?0.3:0.55)+(this.runnerSpeed(r3)-50)/300){this.scoreRun(r3,b,true);this.bases[2]=null;this.addLog(`犠牲フライで${r3.name}生還`,'run');bs.ab--;}if(this.bases[1]&&!this.bases[2]&&isDeep&&R()<0.3){this.bases[2]=this.bases[1];this.bases[1]=null;}}ev='FO';}
    else{this.outsUp(1);this.addLog(`${pre}${name} ${pick(['ライナー','ファウルフライ','内野フライ'])}`,'out');ev='LO';}}}
  d.pc[p.id]=(d.pc[p.id]||0)+np;ps.np+=np;
  if(d.compose>0)d.compose--;
  this.nextBatter();return ev;}
 basesStr(){const b=this.bases;if(!b.some(Boolean))return '走者なし';const s=[];if(b[0])s.push('一');if(b[1])s.push('二');if(b[2])s.push('三');return (b.every(Boolean)?'満':s.join('・'))+'塁';}
 nextBatter(){const t=this.bat();t.batIdx=(t.batIdx+1)%t.lineup.length;if(this.outs>=3){this.endHalf();return;}this.checkWalkoff();}
 checkWalkoff(){if(!this.top&&this.inn>=9&&this.score[1]>this.score[0]){this.finish(1,'サヨナラ');}}
 trySteal(pe,bonus){const t=this.bat(),d=this.def();let i=this.bases[1]&&!this.bases[2]?1:(this.bases[0]&&!this.bases[1]?0:-1);if(i<0)return false;const r=this.bases[i];const st=r.bat.steal+abilStatic(r,'steal');const sd=(pe?pe.stealDef:0)+abilStatic(d.pitcher,'stealDef')+(bonus||0);let pr=0.47+(st-50)/150-(d.catcherArm-50)/220-sd/100-(i===1?0.12:0);pr=clamp(pr,0.1,0.95);if(R()<pr){this.bases[i]=null;this.bases[i+1]=r;bst(t,r).sb++;this.addLog(`${r.name} ${i===1?'三':'二'}盗成功！`,'run');return true;}else{this.bases[i]=null;this.outsUp(1);this.addLog(`${r.name} 盗塁失敗（アウト）`,'out');return false;}}
 doBunt(b,be,pe){const t=this.bat(),d=this.def();const bs=bst(t,b),ps=pst(d,d.pitcher);const np=ri(1,3);d.pc[d.pitcher.id]=(d.pc[d.pitcher.id]||0)+np;ps.np+=np;bs.pa++;
  const pr=clamp(0.62+(be.bunt-50)/150-(d.defR-50)/500,0.2,0.95);const x=R();
  if(x<pr){const safe=R()<(be.bunt>=72?0.15:0.05)+be.safeBunt;if(this.bases[1]&&!this.bases[2]){this.bases[2]=this.bases[1];this.bases[1]=null;}if(this.bases[0]&&!this.bases[1]){this.bases[1]=this.bases[0];this.bases[0]=null;}
   if(safe){bs.ab++;bs.h++;ps.h++;this.bases[0]=b;this.addLog(`${b.name} セーフティバント成功！内野安打`,'hit');}else{this.outsUp(1);this.addLog(`${b.name} 送りバント成功`,'out');}}
  else if(x<pr+0.2){bs.ab++;this.outsUp(1);this.addLog(`${b.name} バント失敗（小フライ）`,'out');}
  else{bs.ab++;const lead=this.bases[1]&&!this.bases[2]?1:0;this.bases[lead]=null;this.outsUp(1);if(!this.bases[0])this.bases[0]=b;else if(!this.bases[1])this.bases[1]=b;this.addLog(`${b.name} バント失敗、走者が封殺される`,'out');}
  this.nextBatter();return 'BUNT';}
 endHalf(){
  const home=this.score[1],away=this.score[0];
  if(this.top){
   if(this.inn>=9&&home>away){this.finish(1,'');return;}
   if(this.opt.mercy&&this.inn>=5&&home-away>=(this.inn>=7?7:10)){this.finish(1,'コールド');return;}
   this.top=false;this.startHalf();return;}
  if(this.inn>=9&&home!==away){this.finish(home>away?1:0,'');return;}
  if(this.opt.mercy&&this.inn>=5&&Math.abs(home-away)>=(this.inn>=7?7:10)){this.finish(home>away?1:0,'コールド');return;}
  if(this.inn>=15){this.finish(R()<0.5?0:1,'延長打ち切り(抽選)');return;}
  this.inn++;this.top=true;this.startHalf();}
 finish(w,reason){this.done=true;this.winner=w;this.endReason=reason;const W=w?this.B:this.A,L=w?this.A:this.B;this.addLog(`試合終了 ${W.name} ${this.score[w]}-${this.score[1-w]} ${L.name}${reason?'（'+reason+'）':''}`,'end');
  const wp=this.winPitcher(W),lp=this.lastPitcher(L);if(wp)wp.w=1;if(lp)lp.l=1;
  const last=this.lastPitcher(W);if(last&&last!==wp&&last.ipo>=3&&Math.abs(this.score[0]-this.score[1])<=3)last.sv=1;}
 winPitcher(t){const list=Object.values(t.pstats).sort((a,b)=>a.order-b.order);return list.length?list[list.length>1&&list[0].ipo<15?list.length-1:0]:null;}
 lastPitcher(t){const list=Object.values(t.pstats).sort((a,b)=>a.order-b.order);return list[list.length-1]||null;}
 changePitcher(team,np){const old=team.pitcher;const slot=team.lineup.find(s=>s.pos==='投')||team.lineup.find(s=>s.p.id===old.id);const outName=slot?slot.p.name:old.name;team.pitcher=np;team.used.add(np.id);team.bench=team.bench.filter(x=>x.id!==np.id);if(slot){slot.p=np;slot.pos='投';}team.needPitcher=false;pst(team,np);team.compose=0;calcDef(team);this.addLog(`${team.name} 投手交代：${outName}→${np.name}`,'sub');this.subsLog.push({team:team.name,out:old.id,in:np.id});}
 pinchHit(team,idx,np){const slot=team.lineup[idx];const old=slot.p;slot.p=np;team.used.add(np.id);team.bench=team.bench.filter(x=>x.id!==np.id);if(old.id===team.pitcher.id)team.needPitcher=true;calcDef(team);this.addLog(`${team.name} 代打：${old.name}→${np.name}`,'sub');}
 pinchRun(team,base,np){const old=this.bases[base];this.bases[base]=np;team.used.add(np.id);team.bench=team.bench.filter(x=>x.id!==np.id);const slot=team.lineup.find(s=>s.p.id===old.id);if(slot){slot.p=np;if(old.id===team.pitcher.id)team.needPitcher=true;}calcDef(team);this.addLog(`${team.name} 代走：${old.name}→${np.name}`,'sub');}
 timeout(team){if(team.mound>=3)return false;team.mound++;team.compose=4;this.addLog(`${team.name} タイム（マウンドへ）`,'note');return true;}
 aiPitchingChange(team){const p=team.pitcher;const tired=this.tired(team,p);const ps=pst(team,p);const relievers=team.bench.filter(x=>isPitcher(x)||x.sub.includes('投'));if(!relievers.length)return;const best=relievers.sort((a,b)=>pitRating(b)-pitRating(a))[0];const need=tired>0.3||(ps.r>=6&&this.inn>=4&&pitRating(best)>pitRating(p)-8)||(tired>0.15&&this.inn>=7&&pitRating(best)>pitRating(p)-5&&R()<0.4);if(need)this.changePitcher(team,best);}
 aiBatCommand(){const t=this.bat();const slot=t.lineup[t.batIdx];const b=slot.p;const diff=this.score[this.bi()]-this.score[1-this.bi()];
  if(this.outs<2&&(this.bases[0]||this.bases[1])&&!this.bases[2]&&Math.abs(diff)<=2&&(b.bat.meetR+b.bat.meetL)/2<62&&b.bat.bunt>=45&&R()<(this.inn>=7?0.5:0.3))return 'bunt';
  if(this.bases[0]&&!this.bases[1]&&this.outs<2){const r=this.bases[0];const st=r.bat.steal+abilStatic(r,'steal');if(st>=66&&R()<0.2)return 'steal';}
  return null;}
 aiDefCommand(){const d=this.def();const diff=this.score[1-this.bi()]-this.score[this.bi()];if(this.bases[2]&&this.outs<2&&this.inn>=8&&diff<=0&&!d.infieldIn)d.infieldIn=true;
  if(this.bases[1]&&!this.bases[0]&&this.outs===2&&this.inn>=8){const b=this.bat().lineup[this.bat().batIdx].p;const nxt=this.bat().lineup[(this.bat().batIdx+1)%9].p;if(batRating(b)>batRating(nxt)+15&&R()<0.3)return 'ibb';}return null;}
 step(cmd){if(this.done)return;const d=this.def();
  if(!cmd||cmd==='auto'){if(!d.isUser||this.autoUntil)this.aiPitchingChange(d);const dc=(!d.isUser||this.autoUntil)?this.aiDefCommand():null;const bc=(!this.bat().isUser||this.autoUntil)?this.aiBatCommand():null;this.playPA(dc||bc||null);}
  else this.playPA(cmd);}
 needsDecision(){if(this.done||this.autoUntil==='end')return null;const u=this.user();if(!u)return null;if(this.autoUntil==='inning'&&this.autoInn===this.inn&&this.autoTop===this.top)return null;this.autoUntil=null;
  const t=this.bat(),d=this.def();
  if(t.isUser){const opts=[];if(this.bases[0]||this.bases[1]||this.bases[2]||(this.inn>=7)){if(this.outs<2&&(this.bases[0]||this.bases[1])&&!this.bases.every(Boolean))opts.push('bunt');if((this.bases[0]&&!this.bases[1])||(this.bases[1]&&!this.bases[2]))opts.push('steal');if(this.bases[0]&&!this.bases[1]&&this.outs<2)opts.push('hitrun');if(t.bench.some(x=>!isPitcher(x)))opts.push('pinch');if(this.bases.some(Boolean)&&t.bench.length)opts.push('pinchrun');return opts.length?{side:'bat',opts}:null;}return null;}
  if(d.isUser){const tired=this.tired(d,d.pitcher);const risp=this.bases[1]||this.bases[2];const start=this.outs===0&&!this.bases.some(Boolean)&&this.log[this.log.length-1]&&this.log[this.log.length-1].kind==='inn';
   const key=`${this.inn}-${this.top}-${this.outs}-${this.bases.map(x=>x?1:0).join('')}-${t.batIdx}`;if(d.lastKey===key)return null;
   if(start||tired>0.12||risp||pst(d,d.pitcher).r>=5){d.lastKey=key;const opts=[];if(d.bench.some(x=>isPitcher(x)||x.sub.includes('投')))opts.push('change');if(this.bases[1]&&!this.bases[0])opts.push('ibb');if(this.bases[2]&&this.outs<2)opts.push(d.infieldIn?'normal':'infield');if(d.mound<3)opts.push('timeout');return {side:'def',opts,tired};}}
  return null;}
}
/* ================= 試合後処理 ================= */
function applyMatchResult(m,ctx){
 const u=m.user();if(!u)return null;const ui=m.A.isUser?0:1;const won=m.winner===ui;const diff=m.score[ui]-m.score[1-ui];
 let imp=ctx.importance||1;if(!won&&diff<=-7)imp*=0.3;else if(!won&&diff<=-4)imp*=0.6;
 const opp=ui?m.A:m.B;const mkBat=s=>({name:s.p.name,pid:s.p.id,num:s.p.number,pos:s.p.pos,pa:s.pa,ab:s.ab,h:s.h,hr:s.hr,rbi:s.rbi,bb:s.bb,so:s.so,sb:s.sb,r:s.r});const mkPit=s=>({name:s.p.name,pid:s.p.id,num:s.p.number,ipo:s.ipo,h:s.h,r:s.r,er:s.er,bb:s.bb,so:s.so,np:s.np,hr:s.hr,order:s.order,w:s.w,l:s.l,maxV:s.maxV});
 const res={won,score:[m.score[ui],m.score[1-ui]],opp:opp.name,teams:[m.A.name,m.B.name],log:m.log,line:m.line,ui,box:{bat:Object.values(u.stats).map(mkBat),pit:Object.values(u.pstats).sort((a,b)=>a.order-b.order).map(mkPit)},oppBox:{bat:Object.values(opp.stats).map(mkBat),pit:Object.values(opp.pstats).sort((a,b)=>a.order-b.order).map(mkPit)},reason:m.endReason,kind:ctx.kind,label:ctx.label,inn:m.inn,mvpName:'',mvpId:null,date:dateStr(),events:[]};
 let best=null,bestv=-1,bestLine='';
 const walkoff=won&&m.endReason==='サヨナラ';
 for(const s of Object.values(u.stats)){const p=s.p;if(p.cpu)continue;const ps=p.season,pc=p.career;ps.g++;pc.g++;for(const k of ['pa','ab','h','hr','rbi','bb','so','sb','r']){ps[k]+=s[k];pc[k]+=s[k];}
  const xp=(2+s.h*3+s.hr*8+s.rbi*2+s.sb*2+s.bb*1+(won?3:0))*imp*abilStatic(p,'xp');p.xp+=xp;growFromXp(p,xp,false);p.fatigue=clamp(p.fatigue+7,0,100);
  const v=s.h*2+s.hr*4+s.rbi*2+s.sb;if(v>bestv){bestv=v;best=p;bestLine=`${s.ab}打数${s.h}安打${s.hr?s.hr+'本塁打':''}${s.rbi?s.rbi+'打点':''}${s.sb?s.sb+'盗塁':''}`;}
  if(s.h>=3)learnMatchAbility(p,'hits',0.12);if(s.hr>=2)learnMatchAbility(p,'hr',0.25);if(s.sb>=2)learnMatchAbility(p,'sb',0.2);if(s.rbi>=3)learnMatchAbility(p,'rbi',0.12);if(walkoff&&s.rbi>=1&&s.h>=1&&R()<0.3)learnMatchAbility(p,'walkoff',0.5);
  if(s.so>=3&&s.h===0&&R()<(G.coach.spec==='メンタル'?0.02:0.04)){const a=giveNegative(p,['スランプ','三振癖']);if(a)notice(`${p.name}が「${a}」に陥った…`);}
  if(imp>=1.3&&v>=6)tryAwaken(p,ctx.importance||1,v);
  injuryCheck(p,0.6);
  recordCheck(p,'bat',s,ctx);}
 for(const s of Object.values(u.pstats)){const p=s.p;if(p.cpu)continue;const ps=p.season,pc=p.career;ps.ipo+=s.ipo;pc.ipo+=s.ipo;ps.ph+=s.h;pc.ph+=s.h;ps.pr+=s.r;pc.pr+=s.r;ps.per+=s.er;pc.per+=s.er;ps.pbb+=s.bb;pc.pbb+=s.bb;ps.pk+=s.so;pc.pk+=s.so;if(s.w){ps.w++;pc.w++;}if(s.l){ps.l++;pc.l++;}if(s.sv){ps.sv=(ps.sv||0)+1;pc.sv=(pc.sv||0)+1;}if(s.order===0){ps.gs++;pc.gs++;}
  const xp=(s.ipo+s.so*1.2+(s.w?10:0)-s.er*1.5+5)*imp*abilStatic(p,'xp');p.xp+=Math.max(0,xp);growFromXp(p,Math.max(0,xp),true);p.fatigue=clamp(p.fatigue+Math.round(s.np/7),0,100);
  const v=s.ipo/3*2+s.so-s.er*2+(s.w?4:0);if(v>bestv){bestv=v;best=p;bestLine=`${ipStr(s.ipo)}回${s.h}安打${s.er}失点${s.so}奪三振`;}
  if(s.so>=10)learnMatchAbility(p,'k',0.2);if(s.ipo>=27&&s.r<=1)learnMatchAbility(p,'cg',0.18);if(s.sv)learnMatchAbility(p,'save',0.2);
  if(s.bb>=6&&R()<0.1){const a=giveNegative(p,['四球病','力み']);if(a)notice(`${p.name}が「${a}」を患った…`);}
  if(s.np>120)injuryCheck(p,1.5);
  if(s.maxV>(p.maxVelo||0)){const old=p.maxVelo||0;p.maxVelo=s.maxV;if(s.maxV>=140&&(s.maxV>=150||s.maxV>=old+1))veloRecord(p,s.maxV,ctx,old);}
  if(imp>=1.3&&v>=10)tryAwaken(p,ctx.importance||1,v);
  recordCheck(p,'pit',s,ctx);}
 /* 信頼度：出場で上がる、勝てばさらに */for(const s of Object.values(u.stats)){const p=s.p;if(p.cpu)continue;p.trust=clamp((p.trust||40)+1+(won?1:0)+(s.h>=2||s.hr?1:0),0,100);}for(const s of Object.values(u.pstats)){const p=s.p;if(p.cpu)continue;p.trust=clamp((p.trust||40)+1+(won?1:0)+(s.w?1:0),0,100);}
 if(best){res.mvpName=best.name;res.mvpId=best.id;res.mvpLine=bestLine;
  if((ctx.importance||1)>=1.6&&bestv>=8)addNews('特集',`${best.name}、大舞台で${isPitcher(best)&&bestLine.includes('回')?'快投':'大暴れ'}`,`${ctx.label}。${G.school.name}の${best.name}（${best.grade}年・${posName(best.pos)}）が${bestLine}の活躍。${won?G.school.name+'は'+res.score[0]+'-'+res.score[1]+'で'+opp.name+'を下した':'チームは敗れたが、その存在感は際立っていた'}。${best.unique.length?'「'+best.unique[0]+'」の名に恥じない内容だった。':''}`,{imp:3,pid:best.id});}
 G.lastMatch=res;return res;}
function growFromXp(p,xp,pitching){const pts=xp/10;if(pts<=0)return;if(pitching){const keys=['hitR','hitL','kR','kL','hrR','hrL','stamina'];for(let i=0;i<3;i++){const k=pick(keys);grow(p,'pit',k,pts*0.5);}growPitch(p,pick(['ctrl','move','sharp']),pts*0.5);}else{const keys=['meetR','meetL','powR','powL','eye','clutch','speed','field'];for(let i=0;i<3;i++)grow(p,'bat',pick(keys),pts*0.5);}}
