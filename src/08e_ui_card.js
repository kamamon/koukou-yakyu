/* ================= 采配カードモード（栄冠ナイン風） ================= */
const CD={hand:{off:[],def:[]},last:null,swapUsed:{},cpuSeed:0};
function cardSettings(){const S=actionSettings();if(!S.cardAnim)S.cardAnim='full';return S;}
function startCardUI(){CD.hand={off:[],def:[]};CD.last=null;CD.swapUsed={};AR.mode='card';startActionUI();}
function cdFillHand(){for(const side of ['off','def']){const h=CD.hand[side];while(h.length<3)h.push(drawCard(side,G.coach.level||1));}}
function cdSide(){return AR.m.userBatting()?'off':'def';}
/* 次の打席：カード選択待ちへ */
function cdNextPA(){const m=AR.m;if(m.done){arFinish();return;}AR.side=m.userBatting()?'bat':'pit';cdFillHand();
 const t=m.bat(),d=m.def();const b=t.lineup[t.batIdx].p,p=d.pitcher;AR.preHand=b.bats==='両'?(p.throws==='右'?'左':'右'):b.bats;
 if(!d.isUser)m.aiPitchingChange(d);
 AR.cur=null;AR.ev=null;AR.field=null;AR.dots=[];AR.swing=null;AR.swung=false;AR.swingT=null;AR.panel=null;AR.pending=null;AR.cpuSwingAt=null;
 arSetPhase('pre');arRenderAll();arLowerThird();}
/* CPU側のカード */
function cdCpuCard(side){const m=AR.m;const team=side==='off'?m.bat():m.def();if(R()<0.3)return null;const pool=CARD_DEFS.filter(c=>cardSideOf(c)===side&&c.id!=='demon'&&c.id!=='relay').map(c=>({id:c.id,lv:1,w:c.w}));const ok=pool.filter(c=>cardApplicable(c,m));if(!ok.length)return null;let r=R()*sum(ok.map(c=>c.w));let pickc=ok[0];for(const c of ok){r-=c.w;if(r<=0){pickc=c;break;}}const lv=clamp(Math.round((team.strength-40)/14)+ri(0,1),1,4);return {id:pickc.id,lv,cpu:true};}
/* カードを使って打席を進める */
ACT.cdPlay=d=>{const m=AR.m;if(AR.phase!=='pre'||AR.mode!=='card')return;const side=cdSide();const hand=CD.hand[side];let card=null;
 if(d.uid){card=hand.find(c=>c.uid===d.uid);if(!card)return;if(!cardApplicable(card,m)){toast('今の状況では使えません');return;}}
 const cpu=cdCpuCard(side==='off'?'def':'off');
 const off=side==='off'?card:cpu,def=side==='off'?cpu:card;
 const r=m.cardPA(off,def);if(!r)return;
 if(card){CD.hand[side]=hand.filter(c=>c.uid!==card.uid);}
 r.userCard=card;r.cpuCard=cpu;r.side=side;CD.last=r;AR.panel=null;arSound('ui');
 cdShowPA(r);};
ACT.cdPass=()=>{ACT.cdPlay({});};
ACT.cdSwap=()=>{const m=AR.m;const key=`${m.inn}-${m.top}`;if(CD.swapUsed[key]){toast('手札の交換はイニングに1回です');return;}CD.swapUsed[key]=true;const side=cdSide();CD.hand[side]=[];cdFillHand();arSound('ui');arRenderCtl();};
function cdInfoText(r){const parts=[];const inf=r.side==='off'?r.offInfo:r.defInfo;
 if(inf){const def=CARD_BY_ID[inf.card.id];parts.push(`${def.name}${cardStars(inf.card.lv)}`);if(inf.ignored)parts.push('…指示が伝わらなかった');else{if(inf.notes.length)parts.push(inf.notes.join('・'));if(inf.dTrust)parts.push(`信頼度${inf.dTrust>0?'+':''}${inf.dTrust.toFixed(1)}`);}}
 else parts.push('おまかせ');
 const cp=r.cpuCard;if(cp)parts.push(`相手ベンチ「${cardLabel(cp)}」`);
 return parts.join('　');}
/* 打席結果の演出：最終球をリプレイ→結果 */
function cdShowPA(r){const m=AR.m;const S=cardSettings();const ev=r.ev;const seq=r.seq;AR.dots=[];AR.foot=cdInfoText(r);AR.footPrefix=cdInfoText(r);arHideLower();
 if(!seq.length||S.cardAnim==='none'){/* 敬遠など／演出なし */for(const x of seq)AR.dots.push({x:x.P.x,y:x.P.y,n:x.P.n,col:'#f5f0d8'});if(S.cardAnim==='none'&&ev.kind==='inplay'){ev.skipScene=true;}AR.cur=seq.length?seq[seq.length-1].P:null;AR.swung=!!(seq.length&&seq[seq.length-1].sw);AR.swingT=AR.swung?performance.now()-400:null;AR.ev=ev;arShowResult(ev);return;}
 const last=seq[seq.length-1];
 for(const x of seq.slice(0,-1)){const k=x.ev.kind;AR.dots.push({x:x.P.x,y:x.P.y,n:x.P.n,col:k==='ball'?'#3fa36b':k==='foul'?'#e0a100':k==='miss'?'#e04a3a':'#f5f0d8'});}
 AR.cur=last.P;AR.swing=last.sw;AR.swung=false;AR.swingT=null;AR.caughtSnd=false;AR.cpuSwingAt=last.sw?(last.P.T-70+last.sw.dt):null;AR.ev=last.ev;
 if(S.cardAnim==='quick'){AR.speed=0.7;}else AR.speed=1;
 arSetPhase('wind');AR.windT0=performance.now()-(S.cardAnim==='quick'?350:0);arRenderAll();}
/* ---- 画面 ---- */
function cdTrustBar(p){const t=Math.round(p.trust||0);return `<span class="trust" title="信頼度"><i style="width:${t}%" class="${t<30?'bad':t<55?'warn':''}"></i></span><span class="tiny">${t}</span>`;}
function cdRenderInfo(){const m=AR.m;const el=$('#arinfo');if(!el)return;const t=m.bat(),d=m.def();let b,p;if(m.pa&&AR.phase!=='pre'){b=m.pa.b;p=m.pa.p;}else{b=t.lineup[t.batIdx].p;p=d.pitcher;}
 const bs=bst(t,b),ps=pst(d,p);const st=arStam(d,p);const pb=personaOf(b),pp=personaOf(p);
 const bl=`<div class="ar-line"><span class="tag">${t.isUser?'打者':'相手'}</span><b>${t.batIdx+1}番 ${esc(b.name)}</b><span class="muted">${b.bats}</span><span>ミ${rk((b.bat.meetR+b.bat.meetL)/2)}パ${rk((b.bat.powR+b.bat.powL)/2)}走${rk(b.bat.speed)}</span>${t.isUser?`<span class="muted tiny">${esc(pb.name)}</span>${cdTrustBar(b)}`:`<span class="muted">今日${bs.ab}-${bs.h}</span>`}</div>`;
 const pl=`<div class="ar-line"><span class="tag">${d.isUser?'投手':'相手'}</span><b>${esc(p.name)}</b><span class="muted">${Math.round(p.pit.velo)}km</span><span>制${rk(p.pit.pitches[0]?p.pit.pitches[0].ctrl:50)}変${rk(pitchQ(p))}</span><span class="muted">${ps.np}球</span><span class="stam"><i style="width:${Math.round(st*100)}%" class="${st<0.3?'bad':st<0.55?'warn':''}"></i></span>${d.isUser?`<span class="muted tiny">${esc(pp.name)}</span>${cdTrustBar(p)}`:''}</div>`;
 el.innerHTML=t.isUser?`${bl}${pl}`:`${pl}${bl}`;}
function cdCardTile(card,m,p){const def=CARD_BY_ID[card.id];const ok=cardApplicable(card,m);const aff=p&&personaOf(p).aff.includes(card.id);return `<button class="ccard cat-${def.cat} ${ok?'':'off'}" data-act="cdPlay" data-uid="${card.uid}" ${ok?'':'disabled'}><span class="cn">${esc(def.name)}</span><span class="cs">${cardStars(card.lv)}</span><span class="cd">${esc(def.desc)}</span>${aff?'<span class="caff">性格◎</span>':''}</button>`;}
function cdRenderCtl(){const m=AR.m;const el=$('#arctl');if(!el)return;el.classList.add('card');const ph=AR.phase;
 const sh=$('#arsheet');if(sh){if(AR.panel){sh.hidden=false;sh.style.top=($('#artop')?$('#artop').offsetHeight:44)+'px';sh.innerHTML=AR.panel;}else{sh.hidden=true;sh.innerHTML='';}}
 if(ph==='half'){el.innerHTML=`<div class="dec">${b('続ける','arBannerNext',{},'primary big')}</div>`;return;}
 if(ph!=='pre'){const r=CD.last;let seqHtml='';if(r&&r.seq&&r.seq.length){seqHtml=`<div class="cseq">${r.seq.map((x,i)=>{const k=x.ev.kind;const lab=k==='ball'?'ボール':k==='strike'?'見逃し':k==='miss'?'空振り':k==='foul'?'ファウル':k==='kLook'?'見逃し三振':k==='kSwing'?'空振り三振':k==='kBunt'?'バント失敗':k==='bb'?'四球':k==='hbp'?'死球':k==='inplay'?(x.ev.text||'打った'):'';return `<span class="${k==='inplay'||k==='bb'||k==='hbp'?'hl':''}">${i+1}球目 ${esc(x.P.name)} ${x.P.v}km ${esc(x.P.label.replace('（ボール）',''))}→${esc(lab)}${x.ev.runText?'／'+esc(x.ev.runText):''}</span>`;}).join('')}</div>`;}
  el.innerHTML=`<div class="row"><b class="small">${ph==='field'||ph==='decide'?'プレー中…':ph==='flight'||ph==='wind'?'最終球をリプレイ中…':(r&&r.ev&&(r.ev.text||arKindText(r.ev)))||'結果'}</b><span class="tiny muted">タップでスキップ</span></div>${r?`<div class="tiny" style="margin:2px 0 4px">${esc(cdInfoText(r))}</div>`:''}${seqHtml}`;return;}
 const side=cdSide();const hand=CD.hand[side];const t=m.bat(),d=m.def();const bt=t.lineup[t.batIdx].p,pt=d.pitcher;const who=side==='off'?bt:pt;
 const tiles=hand.map(c=>cdCardTile(c,m,who)).join('')+`<button class="ccard cat-none" data-act="cdPass"><span class="cn">おまかせ</span><span class="cs">　</span><span class="cd">指示なしで選手に任せる</span></button>`;
 let extra='';
 if(side==='off'){const B=m.bases;extra=`${t.bench.some(x=>!isPitcher(x))?b('代打','arPinchList',{},'sm'):''}${B.some(Boolean)&&t.bench.length?b('代走','arPinchRunList',{},'sm'):''}`;}
 else{const B=m.bases;extra=`${b(d.infieldIn?'前進守備 ✓':'前進守備','arShift',{k:'in'},'sm '+(d.infieldIn?'primary':''))}${b(d.ofDeep?'外野深め ✓':'外野深め','arShift',{k:'deep'},'sm '+(d.ofDeep?'primary':''))}${b(d.ofIn?'外野前進 ✓':'外野前進','arShift',{k:'ofin'},'sm '+(d.ofIn?'primary':''))}${b(d.buntAlert?'バント警戒 ✓':'バント警戒','cdAlert',{k:'bunt'},'sm '+(d.buntAlert?'primary':''))}${b(d.stealAlert?'盗塁警戒 ✓':'盗塁警戒','cdAlert',{k:'steal'},'sm '+(d.stealAlert?'primary':''))}${(B[1]&&!B[0])||(B[2]&&!B[0])?b('敬遠','cdIbb',{},'sm'):''}${d.bench.some(x=>isPitcher(x)||x.sub.includes('投'))?b('投手交代','arChangeList',{},'sm'):''}`;}
 el.innerHTML=`<div class="chand">${tiles}</div><div class="ar-row scroll"><span class="lbl">${side==='off'?'攻撃':'守備'}</span>${extra}${b('手札交換','cdSwap',{},'sm ghost')}</div>`;}
ACT.cdAlert=d=>{const m=AR.m;const t=m.def();if(d.k==='bunt')t.buntAlert=!t.buntAlert;else t.stealAlert=!t.stealAlert;arSound('ui');arRenderCtl();};
ACT.cdIbb=()=>{const m=AR.m;if(AR.phase!=='pre')return;m.paStart();const ev=m.paIbb();CD.last={ev,seq:[],side:'def',userCard:null,cpuCard:null};AR.foot='敬遠';AR.ev=ev;arShowResult(ev);};
function cdMenu(){const S=cardSettings();AR.panel=`<div class="ar-panel"><b class="small">メニュー</b><div class="wrap" style="margin:6px 0">${b('この回おまかせ','arAutoInn',{},'sm')}${b('最後までおまかせ','arAutoEnd',{},'sm danger')}</div><div class="grid2 small"><label class="f">演出<select data-chg="arSet" data-k="cardAnim"><option value="full"${S.cardAnim==='full'?' selected':''}>フル（最終球＋プレー）</option><option value="quick"${S.cardAnim==='quick'?' selected':''}>短縮</option><option value="none"${S.cardAnim==='none'?' selected':''}>結果だけ</option></select></label><label class="f">効果音<select data-chg="arSet" data-k="sound"><option value="1"${S.sound?' selected':''}>あり</option><option value="0"${!S.sound?' selected':''}>なし</option></select></label><label class="f">本塁打リプレイ<select data-chg="arSet" data-k="replay"><option value="1"${S.replay?' selected':''}>見る</option><option value="0"${!S.replay?' selected':''}>省略</option></select></label><label class="f">選手カード表示<select data-chg="arSet" data-k="lower"><option value="1"${S.lower?' selected':''}>打席ごとに出す</option><option value="0"${!S.lower?' selected':''}>出さない</option></select></label><label class="f">画面表示<select data-chg="arSet" data-k="view3d"><option value="1"${S.view3d?' selected':''}>3D</option><option value="0"${!S.view3d?' selected':''}>2D（軽量）</option></select></label></div><div class="hint">カードの★が多いほど効果大。選手の<b>信頼度</b>が高いほど指示がよく伝わり、低い（30未満）と指示を無視することも。性格と相性のいいカードは「性格◎」で効果アップ。手札はイニングに1回交換できます。</div><div class="wrap" style="margin-top:6px">${b('試合経過を見る','arLog',{},'sm')}${b('閉じる','arPanelClose',{},'sm primary')}</div></div>`;arRenderCtl();}
