/* ================= 采配カード（栄冠ナイン風） ================= */
const PERSONAS=[
 {id:'ふつう',name:'ごくふつう',desc:'クセがなく、どの指示もそれなりにこなす',aff:[]},
 {id:'熱血',name:'熱血',desc:'強気の指示で燃える。大舞台で力を出す',aff:['power','fullpower','straight','pull','strikeout']},
 {id:'内気',name:'内気',desc:'堅実な指示が得意。信頼度は上がりにくい',aff:['meet','bunt','careful','wait','contact']},
 {id:'したたか',name:'したたか',desc:'走塁と駆け引きがうまい',aff:['steal','hitrun','safety','dirty','change','aggrorun']},
 {id:'クール',name:'クール',desc:'冷静で正確。コース攻めが得意',aff:['meet','low','outside','inside','strikefirst']},
 {id:'お調子者',name:'お調子者',desc:'リードしているとノリノリ、劣勢だと弱い',aff:['power','aggrorun','first','straight']},
 {id:'天才肌',name:'天才肌',desc:'どんな指示もそこそここなす',aff:[]},
 {id:'インテリ',name:'インテリ',desc:'待球や緩急など頭を使う指示が得意',aff:['wait','change','contact','oppo','ground']},
];
const PERSONA_W={ふつう:30,熱血:14,内気:12,したたか:11,クール:12,お調子者:10,天才肌:4,インテリ:7};
function pickPersona(){let r=R()*sum(Object.values(PERSONA_W));for(const k in PERSONA_W){r-=PERSONA_W[k];if(r<=0)return k;}return 'ふつう';}
function personaOf(p){return PERSONAS.find(x=>x.id===(p.persona||'ふつう'))||PERSONAS[0];}
/* cat: bat=打撃 run=走塁 pit=投球 def=守備 sp=特殊 */
const CARD_DEFS=[
 /* ---- 攻撃 ---- */
 {id:'power',name:'強振',cat:'bat',w:14,desc:'大きいのを狙う。長打↑ 三振↑'},
 {id:'meet',name:'ミート打ち',cat:'bat',w:14,desc:'確実に当てにいく。安打↑ 長打↓'},
 {id:'oppo',name:'流し打ち',cat:'bat',w:8,desc:'逆方向へ軽打。安打↑ 併殺↓'},
 {id:'pull',name:'引っ張り',cat:'bat',w:8,desc:'強く引っ張る。長打↑ 併殺↑'},
 {id:'ground',name:'転がせ',cat:'bat',w:6,desc:'ゴロを打つ。三塁走者を還しやすい'},
 {id:'wait',name:'待球',cat:'bat',w:10,desc:'ボール球を振らない。四球↑ 球数↑'},
 {id:'first',name:'積極打法',cat:'bat',w:7,desc:'初球から積極的に打つ。甘い球を逃さない'},
 {id:'bunt',name:'送りバント',cat:'run',w:8,desc:'走者を進める',need:m=>(m.bases[0]||m.bases[1])&&m.outs<2},
 {id:'safety',name:'セーフティバント',cat:'run',w:4,desc:'意表を突いて出塁を狙う',need:m=>m.outs<2},
 {id:'steal',name:'盗塁',cat:'run',w:8,desc:'初球で走る',need:m=>(m.bases[0]&&!m.bases[1])||(m.bases[1]&&!m.bases[2])},
 {id:'hitrun',name:'エンドラン',cat:'run',w:6,desc:'走者スタート＋打者は必ず打つ',need:m=>m.bases[0]&&!m.bases[1]&&m.outs<2},
 {id:'squeeze',name:'スクイズ',cat:'run',w:3,desc:'三塁走者を本塁へ',need:m=>m.bases[2]&&m.outs<2},
 {id:'aggrorun',name:'積極走塁',cat:'run',w:6,desc:'走者が次の塁を果敢に狙う',need:m=>m.bases.some(Boolean)},
 {id:'demon',name:'魔物',cat:'sp',w:0.9,desc:'球場に魔物が棲みつく…この回、相手守備が乱れる',need:m=>true},
 /* ---- 守備（投球） ---- */
 {id:'strikefirst',name:'ストライク先行',cat:'pit',w:12,desc:'ゾーンで勝負。四球↓'},
 {id:'low',name:'低めに集めろ',cat:'pit',w:12,desc:'ゴロを打たせる。本塁打↓'},
 {id:'outside',name:'外角攻め',cat:'pit',w:8,desc:'外角中心。強い打球を打たれにくい'},
 {id:'inside',name:'内角攻め',cat:'pit',w:8,desc:'内角を突く。三振↑ 死球に注意'},
 {id:'dirty',name:'クサイところを突け',cat:'pit',w:10,desc:'ボール球で誘う。被安打↓ 四球↑'},
 {id:'contact',name:'打たせて取れ',cat:'pit',w:10,desc:'球数を抑える。三振↓ 四球↓'},
 {id:'strikeout',name:'三振を狙え',cat:'pit',w:9,desc:'決め球で三振を取りにいく。四球↑'},
 {id:'change',name:'緩急をつけろ',cat:'pit',w:8,desc:'タイミングを外す。打ち損じ↑'},
 {id:'straight',name:'真っ向勝負',cat:'pit',w:7,desc:'ストレート中心で押す。三振↑ 本塁打↑'},
 {id:'careful',name:'慎重に',cat:'pit',w:7,desc:'甘い球を避ける。本塁打↓ 四球↑'},
 {id:'fullpower',name:'全力投球',cat:'pit',w:6,desc:'球速↑ 三振↑ スタミナ消費↑'},
 {id:'relay',name:'伝令',cat:'sp',w:4,desc:'マウンドへ伝令。投手が落ち着き、守備が締まる',need:m=>m.def().mound<3},
];
const CARD_BY_ID={};for(const c of CARD_DEFS)CARD_BY_ID[c.id]=c;
const CARD_CAT_NAME={bat:'打撃',run:'走塁',pit:'投球',def:'守備',sp:'特殊'};
function cardSideOf(c){return c.cat==='pit'||c.cat==='def'||(c.cat==='sp'&&c.id==='relay')?'def':'off';}
function lvMul(lv){return 0.6+0.2*lv;}
function trustMul(t){return 0.6+clamp(t,0,100)/100*0.7;}
/* カードのレベル抽選（監督レベルが高いほど高レベルが出やすい） */
function cardLevelRoll(coachLv){const base=[42,30,17,8,3];const w=base.map((v,i)=>v*(1+i*0.12*Math.max(0,(coachLv||1)-1)));let r=R()*sum(w);for(let i=0;i<5;i++){r-=w[i];if(r<=0)return i+1;}return 1;}
function drawCard(side,coachLv){const pool=CARD_DEFS.filter(c=>cardSideOf(c)===side);let r=R()*sum(pool.map(c=>c.w));let def=pool[0];for(const c of pool){r-=c.w;if(r<=0){def=c;break;}}return {id:def.id,lv:cardLevelRoll(coachLv),uid:Math.random().toString(36).slice(2,8)};}
function cardApplicable(card,m){const def=CARD_BY_ID[card.id];if(!def)return false;if(def.need&&!def.need(m))return false;return true;}
/* 効果倍率と無視判定 */
function cardEffect(card,p,m){const def=CARD_BY_ID[card.id];const pe=personaOf(p);let mul=lvMul(card.lv)*trustMul(p.trust==null?50:p.trust);let notes=[];
 if(pe.aff.includes(def.id)){mul*=1.25;notes.push('性格◎');}
 if(pe.id==='天才肌')mul*=1.1;
 const bi=m.bat().isUser?0:1;const diff=m.score[m.bat().isUser?m.bi():1-m.bi()]-m.score[m.bat().isUser?1-m.bi():m.bi()];
 if(pe.id==='お調子者'){if(diff>0){mul*=1.2;notes.push('ノリノリ');}else if(diff<0)mul*=0.9;}
 if(m.bigStage()){if(pe.id==='熱血'){mul*=1.15;notes.push('大舞台で燃える');}if(pe.id==='内気')mul*=0.9;}
 const ignore=(p.trust==null?0:Math.max(0,(30-p.trust)/100));
 return {mul,notes,ignore};}
/* カード→エンジン用修正値 */
function cardMods(card,e,m){const id=card.id;const M={};const d=m.def();
 switch(id){
  case 'power':Object.assign(M,{swing:'power',swingProb:0.3+0.12*card.lv,pow:9*e,meet:-3*e,noiseMul:0.92});break;
  case 'meet':Object.assign(M,{swing:'meet',swingProb:0.5+0.1*card.lv,meet:8*e,pow:-2*e,noiseMul:1/(1+0.12*e)});break;
  case 'oppo':Object.assign(M,{aBias:12*e,meet:4*e,pow:-2*e,dpMul:0.6});break;
  case 'pull':Object.assign(M,{aBias:-12*e,pow:6*e,dpMul:1.25});break;
  case 'ground':Object.assign(M,{laBias:-9*e,meet:2*e,pow:-4*e});break;
  case 'wait':Object.assign(M,{margin:-0.12*e,swingMul:0.78,eye:6*e,meet:-2*e});break;
  case 'first':Object.assign(M,{firstMul:1.6,meet:3*e,swingMul:1.15});break;
  case 'bunt':Object.assign(M,{bunt:true,buntSkill:10*e});break;
  case 'safety':Object.assign(M,{bunt:true,safety:true,buntSkill:6*e});break;
  case 'steal':Object.assign(M,{cmd:'steal',stealBonus:12*e});break;
  case 'hitrun':Object.assign(M,{cmd:'hitrun',meet:4*e});break;
  case 'squeeze':Object.assign(M,{cmd:'squeeze',buntSkill:8*e});break;
  case 'aggrorun':Object.assign(M,{aggro:true,runBonus:0.06*e});break;
  case 'demon':Object.assign(M,{demon:card.lv});break;
  case 'strikefirst':Object.assign(M,{chase:-0.12*e,zoneTight:0.08*e,ctrl:3*e,hit:-2*e});break;
  case 'low':Object.assign(M,{ty:0.22*e,gb:7*e,hr:7*e});break;
  case 'outside':Object.assign(M,{tx:'away',txAmt:0.22,hit:8*e,hr:4*e,ctrl:1*e});break;
  case 'inside':Object.assign(M,{tx:'in',txAmt:0.22,k:7*e,hit:3*e,hr:-3*e,hbpMul:1.6});break;
  case 'dirty':Object.assign(M,{chase:0.16*e,hit:8*e,ctrl:-2*e,k:5*e});break;
  case 'contact':Object.assign(M,{power:'ease',chase:-0.1*e,zoneTight:0.1*e,k:-4*e,ctrl:3*e,hit:-1*e,npSave:true});break;
  case 'strikeout':Object.assign(M,{power:'max',pitchPref:'break2',k:8*e,ctrl:-5*e,hr:-3*e});break;
  case 'change':Object.assign(M,{pitchPref:'alt',stBias:30*e,hit:3*e});break;
  case 'straight':Object.assign(M,{pitchPref:'fast',power:'max',k:8*e,hr:-6*e,ctrl:2*e,velo:1*e});break;
  case 'careful':Object.assign(M,{chase:0.07*e,ctrl:-1*e,hr:9*e,hit:2*e});break;
  case 'fullpower':Object.assign(M,{velo:3*e,k:6*e,npExtra:true,ctrl:-2*e});break;
  case 'relay':Object.assign(M,{relay:true,def:4*e});break;
 }
 M.e=e;M.card=card;return M;}
function cardLabel(card){const def=CARD_BY_ID[card.id];return def?def.name:card.id;}
function cardStars(lv){return '★'.repeat(lv)+'☆'.repeat(5-lv);}
