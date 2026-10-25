/* ================= 操作モード（プロスピ風）：試合アリーナ ================= */
const AR={m:null,ctx:null,el:null,cv:null,g:null,W:0,H:0,dpr:1,phase:'idle',side:'bat',swingType:'meet',panel:null,pitchSel:0,power:'normal',target:null,gauge:null,cursor:{x:0,y:-0.1},cur:null,ev:null,t0:0,swing:null,swung:false,anim:null,dots:[],foot:'',speed:1,field:null,banner:null,raf:0,lastDraw:0,cpuSwingAt:null,windT0:0,resultAt:0,msgT:0,pending:null,ptrDown:false,audio:null};
function r3on(){return typeof R3!=='undefined'&&R3.on&&!!R3.renderer;}
function actionSettings(){const S=G.settings.action=G.settings.action||{};if(S.speed==null)S.speed=1;if(S.gauge==null)S.gauge=true;if(!S.meter)S.meter=S.gauge===false?'none':'meter';if(!S.run)S.run='manual';if(S.assist==null)S.assist=false;if(S.sound==null)S.sound=true;if(S.bat==null)S.bat=true;if(S.pit==null)S.pit=true;if(S.autoThrow==null)S.autoThrow=false;if(S.camera==null)S.camera='catcher';if(S.defThrow==null)S.defThrow=true;if(S.replay==null)S.replay=true;if(S.lower==null)S.lower=true;if(S.view3d==null)S.view3d=true;if(!S.cam3d)S.cam3d='std';if(!S.model3d)S.model3d='real';if(S.intro==null)S.intro=true;if(!S.batEase)S.batEase='easy';if(!S.ctl2){S.ctl2=true;S.meter='simple';S.gauge=true;S.defThrow=false;S.batEase='easy';}return S;}
/* 打撃アシスト：ヒットゾーン（カーソル）とタイミング許容の倍率 */
function arEase(){const S=actionSettings();return S.batEase==='hard'?{r:0.85,tw:0.85}:S.batEase==='normal'?{r:1,tw:1}:{r:2.0,tw:1.8};}
/* ---- 効果音（WebAudio） ---- */
function arSound(kind){const S=actionSettings();if(!S.sound)return;try{if(!AR.audio){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;AR.audio=new C();}const a=AR.audio;if(a.state==='suspended')a.resume();const t=a.currentTime;
 const tone=(f,d,type,vol,when)=>{const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.value=f;g.gain.setValueAtTime(vol||0.15,t+(when||0));g.gain.exponentialRampToValueAtTime(0.001,t+(when||0)+d);o.connect(g);g.connect(a.destination);o.start(t+(when||0));o.stop(t+(when||0)+d+0.02);};
 const noise=(d,vol,hp)=>{const n=a.createBufferSource();const buf=a.createBuffer(1,a.sampleRate*d,a.sampleRate);const ch=buf.getChannelData(0);for(let i=0;i<ch.length;i++)ch[i]=(Math.random()*2-1)*(1-i/ch.length);n.buffer=buf;const g=a.createGain();g.gain.value=vol;const f=a.createBiquadFilter();f.type=hp?'highpass':'lowpass';f.frequency.value=hp||1800;n.connect(f);f.connect(g);g.connect(a.destination);n.start(t);};
 switch(kind){case 'hit':noise(0.09,0.5,2500);tone(220,0.08,'square',0.08);break;case 'hr':noise(0.1,0.6,2500);tone(523,0.25,'triangle',0.15,0.05);tone(784,0.35,'triangle',0.15,0.2);tone(1047,0.5,'triangle',0.15,0.35);break;case 'mitt':noise(0.05,0.35);tone(140,0.07,'sine',0.2);break;case 'swing':noise(0.12,0.2,900);break;case 'out':tone(196,0.18,'sawtooth',0.08);break;case 'foul':noise(0.06,0.3,3000);break;case 'ui':tone(880,0.05,'sine',0.05);break;case 'walk':tone(330,0.12,'sine',0.1);tone(392,0.12,'sine',0.1,0.12);break;case 'k':tone(392,0.1,'square',0.08);tone(262,0.2,'square',0.08,0.1);break;case 'run':tone(660,0.08,'sine',0.1);tone(880,0.12,'sine',0.1,0.08);break;}
}catch(e){}}
/* ---- 開始／終了 ---- */
function startActionUI(){const S=actionSettings();AR.speed=S.speed;AR.m=UI.match.m;AR.ctx=UI.match.ctx;AR.dots=[];AR.panel=null;AR.foot='';AR.phase='idle';AR.pending=null;AR.banner=null;AR.field=null;if(UI.match.mode!=='card')AR.mode='action';
 let el=$('#arena');if(!el){el=document.createElement('div');el.id='arena';el.className='arena';document.body.appendChild(el);}
 el.hidden=false;el.innerHTML=`<div class="ar-top" id="artop"></div><div class="ar-stage" id="arstage"><canvas id="arcv"></canvas><div class="ar-ov" id="arov"></div><div class="ar-vel" id="arvel" hidden></div><div class="ar-pci" id="arpci" hidden></div><div class="ar-lt" id="arlt" hidden></div><div class="ar-rep" id="arrep" hidden><span>REPLAY</span></div><div class="ar-gauge" id="argauge" hidden><div class="gbar"><em class="pw"></em><b class="acc"></b><i id="argmark"></i></div><span id="arglbl">パワー</span></div></div><div class="ar-info" id="arinfo"></div><div class="ar-ctl" id="arctl"></div><div class="ar-foot" id="arfoot"></div><div class="ar-sheet" id="arsheet" hidden></div>`;
 AR.el=el;AR.cv=$('#arcv');AR.g=AR.cv.getContext('2d');
 const st=$('#arstage');st.onpointerdown=arPointerDown;st.onpointermove=arPointerMove;st.onpointerup=arPointerUp;st.onpointercancel=e=>{AR.ptrDown=false;AR.hold=false;};
 window.addEventListener('resize',arResize);document.addEventListener('keydown',arKey);
 try{if(window.ResizeObserver){AR.ro=new ResizeObserver(()=>arResize());AR.ro.observe(st);}}catch(e){}
 arResize();if(S.view3d&&typeof r3Start==='function')r3Start(st);arResize();arStartIntro();arLoop();}
function endActionUI(){cancelAnimationFrame(AR.raf);AR.raf=0;if(typeof r3Stop==='function'&&r3on())r3Stop();window.removeEventListener('resize',arResize);document.removeEventListener('keydown',arKey);try{if(AR.ro){AR.ro.disconnect();AR.ro=null;}}catch(e){}clearTimeout(AR.ltT);clearTimeout(AR.velT);clearTimeout(AR.pciT);if(AR.el){AR.el.hidden=true;AR.el.innerHTML='';}AR.phase='idle';AR.replay=null;}
/* ---- 試合前カットイン：相手チームの注目投手・注目野手を紹介 ---- */
function arIntroItems(opp){const items=[];const pit=opp.pitcher;if(pit)items.push({p:pit,kind:'pit'});
 const bats=opp.lineup.map(x=>x.p).filter(p=>p&&(!pit||p.id!==pit.id));
 if(bats.length){const w=p=>(p.nstar?(p.nstar.rank==='S'?2e3:1e3):0)+batRating(p);const best=bats.slice().sort((a,b)=>w(b)-w(a))[0];items.push({p:best,kind:'bat'});}
 return items;}
function arStartIntro(){const m=AR.m;const S=actionSettings();const opp=m.A.isUser?m.B:m.A;const items=(S.intro===false||!opp||opp.isUser||m.inn>1||m.pa)?[]:arIntroItems(opp);
 if(!items.length){arPlayBall();return;}
 AR.intro={items,idx:0,t0:performance.now(),dur:4600,team:opp,el:-1};arSetPhase('intro');arOverlayHtml('');arRenderAll();}
function arPlayBall(){const m=AR.m;AR.intro=null;AR.banner={title:'PLAY BALL',lines:[`${m.A.name}（先攻）先発 ${m.A.pitcher.name}`,`${m.B.name}（後攻）先発 ${m.B.pitcher.name}`,'',AR.ctx.label||''],until:0,wait:true};arSetPhase('half');AR.bannerEl=null;arOverlayHtml('');arRenderAll();}
function arIntroNext(){const it=AR.intro;if(!it){arPlayBall();return;}it.idx++;if(it.idx>=it.items.length){arPlayBall();return;}it.t0=performance.now();it.el=-1;it.shown=false;it.comp=0;}
ACT.arIntroSkip=()=>{arPlayBall();};
function arIntroItem(){const it=AR.intro;return it?it.items[it.idx]:null;}
function arIntroHtml(it){const item=it.items[it.idx];const p=item.p;const t=it.team;const c=arTeamColors(t);const isP=item.kind==='pit';
 const hand=`${p.throws}投${p.bats}打`;const order=t.lineup.findIndex(x=>x.p===p);
 const stats=isP?`<span>最速 <b>${Math.round(p.pit.velo)}</b>km/h</span><span>球種 <b>${p.pit.pitches.length}</b></span><span>${p.pit.pitches.slice(1).map(x=>esc(x.name)).join('・')||'直球のみ'}</span>`
  :`${order>=0?`<span><b>${order+1}</b>番 ${esc(p.pos)}</span>`:''}<span>${p.height}cm / ${p.weight}kg</span><span>長所 ${esc(arStrength(p))}</span>`;
 const title=p.title?`<span class="ttl">${esc(p.title)}</span>`:(p.nstar?`<span class="ttl">全国注目</span>`:'');
 const av=r3on()?'':`<div class="ci-av">${avatarSVG(String(p.id),{cap:c.cap||c.base,brim:c.capBrim||c.cap||c.base,base:c.base,trim:c.trim,emblem:c.mark||'',size:200})}</div>`;
 /* 帯の色：チームカラーのうち暗い方を帯（さらに暗く）、明るい方を差し色に。文字色は帯の明るさで決める */const lum=h=>{try{const x=h.replace('#','');return parseInt(x.slice(0,2),16)*0.299+parseInt(x.slice(2,4),16)*0.587+parseInt(x.slice(4,6),16)*0.114;}catch(e){return 128;}};const dark=lum(c.trim)<=lum(c.base)?c.trim:c.base,light=dark===c.trim?c.base:c.trim;const band=arDarken(dark,lum(dark)>110?0.45:0.7),stripe=light;
 return `<div class="ar-cutin ${item.kind}" style="--tb:${band};--tc:${stripe};--tx:${arTextOn(band)}">${av}<div class="ci-band"></div><div class="ci-tag ${item.kind}">${isP?'相手の注目投手':'相手の注目野手'}</div><div class="ci-foot">${it.idx+1}/${it.items.length} ・ タップでスキップ</div>
  <div class="ci-body"><div class="ci-main"><div class="ci-school">${esc(t.name)}${t.pref?'（'+esc(t.pref)+'）':''}</div><div class="ci-name"><b>${esc(p.name)}</b><small>${p.grade}年 ・ ${esc(isP?'投手':p.pos+'手')} ・ ${hand}${p.number!=null?' ・ 背番号'+p.number:''}</small></div><div class="ci-rank">${rkR(p)}${title}</div><div class="ci-stats">${stats}</div></div><div class="ci-radar">${radarSvg(radarAxes(p,{exact:true,pit:isP}),150,isP?'#5ab0ff':'#ffb347',{num:true})}</div></div></div>`;}
function arDarken(hex,k){try{const c=hex.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);const f=v=>Math.round(v*k).toString(16).padStart(2,'0');return '#'+f(r)+f(g)+f(b);}catch(e){return '#1b2a4a';}}
function arStrength(p){const b=p.bat;const cand=[['ミート',(b.meetR+b.meetL)/2],['パワー',(b.powR+b.powL)/2],['走力',b.speed],['守備',b.field],['肩',(b.arm+b.thr)/2],['選球眼',b.eye],['勝負強さ',b.clutch]];cand.sort((x,y)=>y[1]-x[1]);return cand.slice(0,2).map(x=>x[0]).join('・');}
function arDrawIntro(now){const it=AR.intro;if(!it){return;}if(it.el!==it.idx){it.el=it.idx;it.t0=now;it.shown=true;arOverlayHtml(arIntroHtml(it));}}
/* ---- 中継風の演出パーツ ---- */
function arAbbr(name){const s=String(name||'').replace(/高等学校|高等学院|高校|学園|学院|工業|商業|附属|付属/g,'');return (s||name||'').slice(0,4);}
function arTextOn(bg){try{const c=bg.replace('#','');const r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16);return (r*299+g*587+b*114)/1000>150?'#111':'#fff';}catch(e){return '#fff';}}
/* ローワーサード：打席開始時に打者／投手のカードを出す */
function arLowerThird(){const m=AR.m;const S=actionSettings();const el=$('#arlt');if(!el||!S.lower||m.done)return;const t=m.bat(),d=m.def();const pa=m.pa;const b=pa?pa.b:t.lineup[t.batIdx].p;const p=pa?pa.p:d.pitcher;const bs=bst(t,b),ps=pst(d,p);const cb=arTeamColors(t),cd=arTeamColors(d);
 const sb=b.season||{},avg=sb.ab?(sb.h/sb.ab).toFixed(3).replace(/^0/,''):'-';
 el.hidden=false;el.innerHTML=`<div class="ltc" style="--tc:${cb.trim};--tb:${cb.base}"><span class="num" style="background:${cb.base};color:${arTextOn(cb.base)};border-color:${cb.trim}">${b.number!=null?b.number:(POS_NUM[b.pos]||'-')}</span><div class="nm"><b>${esc(b.name)}</b><small>${t.batIdx+1}番 ${esc(pa?pa.bHand:b.bats)}打 ・ 今日 ${bs.ab}-${bs.h}${bs.hr?' 本'+bs.hr:''}${bs.rbi?' 点'+bs.rbi:''}${avg!=='-'?' ・ 打率'+avg:''}</small></div><div class="rt"><span>ミ${rk((b.bat.meetR+b.bat.meetL)/2)}</span><span>パ${rk((b.bat.powR+b.bat.powL)/2)}</span><span>走${rk(b.bat.speed)}</span></div></div><div class="ltc pit" style="--tc:${cd.trim};--tb:${cd.base}"><span class="num" style="background:${cd.base};color:${arTextOn(cd.base)};border-color:${cd.trim}">${p.number!=null?p.number:(POS_NUM[p.pos]||1)}</span><div class="nm"><b>${esc(p.name)}</b><small>${p.throws}投 ・ ${ps.np}球 ・ 最速 ${ps.maxV||Math.round(p.pit.velo)}km/h${ps.so?' ・ 奪三振'+ps.so:''}${ps.r?' ・ 失点'+ps.r:''}</small></div><div class="rt"><span>球${rk(Math.min(99,(p.pit.velo-110)*2.2))}</span><span>制${rk(p.pit.pitches[0]?p.pit.pitches[0].ctrl:50)}</span><span>変${rk(pitchQ(p))}</span></div></div>`;
 el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(AR.ltT);AR.ltT=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},400);},2800);}
function arHideLower(){const el=$('#arlt');if(!el)return;clearTimeout(AR.ltT);el.classList.remove('show');el.hidden=true;}
/* 球速タグ（投球到達時） */
function arVelTag(P,ev){const el=$('#arvel');if(!el||!P)return;const c=ev&&ev.c;const evv=ev&&ev.kind==='inplay'&&ev.bb?ev.bb.ev:null;
 el.hidden=false;el.innerHTML=`<b>${P.v}</b><small>km/h</small><span>${esc(P.name)}${P.slip?'（抜け）':''}</span>${evv?`<em>打球 ${evv}km/h ・ ${ev.bb.la}°</em>`:''}`;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(AR.velT);AR.velT=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},300);},evv?2200:1500);}
/* タイミング／ミート判定のバッジ（PCI風） */
function arPciBadge(ev){const el=$('#arpci');if(!el)return;const sw=ev.sw;if(!sw||sw.type==='bunt'||!ev.c){return;}const c=ev.c;const tw=c.tw||55;const dt=sw.dt;const a=Math.abs(dt);
 const tm=a<=tw*0.5?'PERFECT':a<=tw?'GOOD':a<=2.2*tw?(dt<0?'EARLY':'LATE'):(dt<0?'VERY EARLY':'VERY LATE');const tmj=a<=tw*0.5?'ジャスト！':a<=tw?'良い':a<=2.2*tw?(dt<0?'やや早い':'やや遅い'):(dt<0?'早すぎ':'遅すぎ');
 const ct=c.d>1.3?'空振り':c.d>1?'かすった':c.d<0.35?'芯！':c.d<0.7?'まずまず':'当たり損ね';const cls=c.d>1?'miss':a<=tw*0.5&&c.d<0.35?'perfect':a<=tw&&c.d<0.7?'good':'ok';
 el.hidden=false;el.className='ar-pci show '+cls;el.innerHTML=`<b>${tm}</b><span>${tmj} ・ ${ct}</span>`;clearTimeout(AR.pciT);AR.pciT=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},300);},1400);}
/* ハーフイニング／試合終了のボード（ラインスコア付き） */
function arBannerHtml(){const m=AR.m;const bn=AR.banner;if(!bn)return '';const n=Math.max(m.inn,Math.min(9,m.opt.innings||9));const ca=arTeamColors(m.A),cb=arTeamColors(m.B);const hits=t=>sum(Object.values(t.stats).map(s=>s.h));
 const row=(t,i,c)=>`<tr><td class="tn"><i style="background:${c.trim}"></i>${esc(arAbbr(t.name))}</td>${Array.from({length:n},(_,k)=>`<td>${m.line[i][k]==null?'':m.line[i][k]}</td>`).join('')}<td class="tot">${m.score[i]}</td><td class="h">${hits(t)}</td></tr>`;
 const ls=`<table class="ls"><tr><th></th>${Array.from({length:n},(_,k)=>`<th>${k+1}</th>`).join('')}<th>R</th><th>H</th></tr>${row(m.A,0,ca)}${row(m.B,1,cb)}</table>`;
 const lines=bn.lines&&bn.lines.length?`<div class="lines">${bn.lines.slice(-14).map(l=>`<div class="${/本塁打|生還|ヒット|安打|二塁打|三塁打/.test(l)?'hl':''}">${esc(l.length>36?l.slice(0,36)+'…':l)}</div>`).join('')}</div>`:'';
 const sub=m.done?'タップで結果へ':bn.wait?'タップで続ける':'攻守交代';
 return `<div class="ar-board"><div class="bt">${esc(bn.title)}</div>${ls}${lines}<div class="bs">${sub}</div></div>`;}
function arResize(){const st=$('#arstage');if(!st||!AR.cv)return;const r=st.getBoundingClientRect();AR.dpr=Math.min(2,window.devicePixelRatio||1);AR.W=Math.max(200,Math.round(r.width));AR.H=Math.max(200,Math.round(r.height));AR.cv.width=Math.round(AR.W*AR.dpr);AR.cv.height=Math.round(AR.H*AR.dpr);AR.cv.style.width=AR.W+'px';AR.cv.style.height=AR.H+'px';if(r3on())r3Resize(AR.W,AR.H);}
function arUserOps(){const m=AR.m;const S=actionSettings();return (m.userBatting()&&S.bat)||(m.userFielding()&&S.pit);}
/* ---- 打席の開始 ---- */
function arNextPA(){const m=AR.m;if(m.done){arFinish();return;}
 if(AR.mode==='card'){cdNextPA();return;}
 if(!arUserOps()){arSimHalf();return;}
 const S=actionSettings();m.askRun=S.run==='manual';m.askDef=S.pit&&S.defThrow;m.paStart();AR.side=m.userBatting()?'bat':'pit';AR.dots=[];AR.cur=null;AR.ev=null;AR.swing=null;AR.swung=false;AR.target=null;AR.gauge=null;AR.panel=null;AR.pending=null;
 AR.autoT=0;if(AR.side==='bat'){AR.swingType=AR.swingType==='bunt'?'meet':AR.swingType;AR.cursor={x:0,y:-0.05};if(S.autoThrow)AR.autoT=performance.now()+1500;}
 else{const ps=m.pa.p.pit.pitches;AR.pitchSel=0;AR.power='normal';AR.sign=m.cpuPitchInput();AR.sign.idx=Math.max(0,ps.indexOf(AR.sign.pitch));AR.target=arDefaultTarget();}
 AR.hold=false;AR.holdStart=false;
 if(m.pa.cmd==='ibb'&&AR.side==='bat'){const ev=m.paIbb();AR.ev=ev;arShowResult(ev);return;}
 arSetPhase('pre');arRenderAll();arLowerThird();}
function arSetPhase(ph){AR.phase=ph;AR.phaseT=performance.now();}
/* 投球モーションの長さ（ms）。打席側はフォームを見せるため長め */
function arWindDur(){return AR.side==='bat'?950:600;}
/* 自分が操作しない半回はPA単位で一気に進める */
function arSimHalf(){const m=AR.m;const inn=m.inn,top=m.top;const from=m.log.length;let g=0;while(!m.done&&g++<200){m.step();if(m.inn!==inn||m.top!==top)break;}
 const lines=m.log.slice(from).filter(l=>l.kind!=='inn').map(l=>l.text);
 AR.banner={title:`${inn}回${top?'表':'裏'}（自動進行）`,lines,until:0,wait:true};arSetPhase('half');arRenderAll();}
function arFinish(){endActionUI();finishMatch();}
/* ---- 入力 ---- */
function arS2Z(sx,sy){if(r3on())return r3ScreenToZone(sx,sy);const z=arZone();return {x:(sx-z.cx)/(z.w/2)*(AR.side==='pit'?-1:1),y:(sy-z.cy)/(z.h/2)};}
function arStagePos(e){const r=AR.cv.getBoundingClientRect();return {sx:e.clientX-r.left,sy:e.clientY-r.top};}
function arPointerDown(e){if(e.target.closest('.ar-gauge')){arRelease();return;}const {sx,sy}=arStagePos(e);AR.ptrDown=true;AR.ptrLast={sx,sy};AR.ptrStart={sx,sy};AR.ptrMoved=0;AR.ptrT=performance.now();try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(x){}
 const ph=AR.phase;const act=AR.mode!=='card';
 /* 打撃：押すと投球が始まり、押したままカーソルを動かし、離すとスイング */
 if(act&&AR.side==='bat'&&ph==='pre'&&!AR.panel){AR.hold=true;AR.holdStart=true;arThrowCpu();return;}
 if(act&&AR.side==='bat'&&(ph==='wind'||ph==='flight')&&!AR.swung){if(AR.holdStart){AR.hold=true;return;}/* 投球ボタンで始めた場合：タップでスイング */if(ph==='flight')arSwing();return;}
 /* 投球：タップで開始／リリース、ドラッグで狙い */
 if(act&&AR.side==='pit'&&ph==='gauge'){arRelease();return;}
 if(act&&AR.side==='pit'&&ph==='pre'){return;}
 arTap(sx,sy,e);}
function arPointerMove(e){if(!AR.ptrDown)return;const {sx,sy}=arStagePos(e);const last=AR.ptrLast||{sx,sy};const dx=sx-last.sx,dy=sy-last.sy;AR.ptrLast={sx,sy};AR.ptrMoved=(AR.ptrMoved||0)+Math.abs(dx)+Math.abs(dy);
 if(AR.side==='bat'&&(AR.phase==='pre'||AR.phase==='wind'||AR.phase==='flight')){if(AR.mode==='card')return;/* 相対移動（指で画面を隠さずに済む） */const z=arZone();const k=Math.max(1/80,1.8/Math.max(40,z.w));AR.cursor={x:clamp(AR.cursor.x+dx*k,-1.9,1.9),y:clamp(AR.cursor.y+dy*k,-1.9,1.9)};}
 else if(AR.side==='pit'&&AR.phase==='pre'&&AR.mode!=='card'){/* ドラッグで相対的に狙いを動かす */const t=AR.target||arDefaultTarget();const k=1/45;AR.target={x:clamp(t.x+dx*k,-1.9,1.9),y:clamp(t.y+dy*k,-1.9,1.9)};}}
function arPointerUp(e){const was=AR.ptrDown;AR.ptrDown=false;if(!was)return;const now=performance.now();const moved=(AR.ptrMoved||0)>12;const act=AR.mode!=='card';
 if(AR.hold){AR.hold=false;const P=AR.cur;
  if(act&&AR.side==='bat'&&AR.phase==='flight'&&!AR.swung&&P){const u=(now-AR.t0)/(P.T*AR.speed);if(u>=0.22)arSwing();else AR.foot='早く離したので見逃し';}
  else if(act&&AR.side==='bat'&&AR.phase==='wind'){AR.foot='早く離したので見逃し';arRenderFoot();}
  return;}
 if(act&&AR.side==='pit'&&AR.phase==='pre'&&!AR.panel&&!moved&&now-(AR.ptrT||0)<700){const {sx,sy}=arStagePos(e);const q=arS2Z(sx,sy);
  if(Math.abs(q.x)<=1.7&&Math.abs(q.y)<=1.7)AR.target={x:clamp(q.x,-1.9,1.9),y:clamp(q.y,-1.9,1.9)};else if(!AR.target)AR.target=arDefaultTarget();
  if(actionSettings().meter!=='none')arStartGauge();else arThrowUser(null);}}
function arDefaultTarget(){const s=AR.sign;return s?{x:s.tx,y:s.ty}:{x:0,y:0.2};}
function arTap(sx,sy,e){const m=AR.m;const ph=AR.phase;const q=arS2Z(sx,sy);const zx=q.x,zy=q.y;
 if(ph==='intro'){arIntroNext();return;}
 if(ph==='half'){arAfterBanner();return;}
 if(ph==='after'||ph==='field'||ph==='replay'){arSkip();return;}
 if(AR.mode==='card'){if((ph==='wind'||ph==='flight')&&AR.cur){AR.windT0-=5000;AR.t0=Math.min(AR.t0,performance.now()-AR.cur.T*AR.speed*1.2);}return;}
 if(ph==='decide'||ph==='sim'||ph==='idle')return;
 if(AR.side==='bat'){if(ph==='flight'&&!AR.swung)arSwing();}
 else{if(ph==='gauge')arRelease();}}
function arKey(e){if(!AR.el||AR.el.hidden)return;const k=e.key;
 if(k===' '||k==='Enter'){e.preventDefault();if(AR.phase==='flight'&&AR.side==='bat'&&!AR.swung)arSwing();else if(AR.phase==='gauge')arRelease();else if(AR.phase==='pre'&&AR.side==='bat'&&!AR.panel)arThrowCpu();else if(AR.phase==='pre'&&AR.side==='pit'&&AR.target){if(actionSettings().meter!=="none")arStartGauge();else arThrowUser(null);}else if(AR.phase==='after'||AR.phase==='field'||AR.phase==='replay')arSkip();else if(AR.phase==='half')arAfterBanner();else if(AR.phase==='intro')arIntroNext();return;}
 const dx=k==='ArrowLeft'?-0.15:k==='ArrowRight'?0.15:0,dy=k==='ArrowUp'?-0.15:k==='ArrowDown'?0.15:0;
 if(dx||dy){e.preventDefault();if(AR.side==='bat')AR.cursor={x:clamp(AR.cursor.x+dx,-1.9,1.9),y:clamp(AR.cursor.y+dy,-1.9,1.9)};else if(AR.phase==='pre'){const t=AR.target||{x:0,y:0};AR.target={x:clamp(t.x+dx,-1.9,1.9),y:clamp(t.y+dy,-1.9,1.9)};}}
 if(AR.side==='pit'&&AR.phase==='pre'&&/^[1-9]$/.test(k)){const i=parseInt(k)-1;if(AR.m.pa.p.pit.pitches[i]){AR.pitchSel=i;arRenderCtl();}}}
/* ---- 打撃：CPU投手の投球 ---- */
function arThrowCpu(){const m=AR.m;if(AR.phase!=='pre'||AR.side!=='bat')return;AR.panel=null;arHideLower();const P=m.throwPitch(null);AR.cur=P;AR.swing=null;AR.swung=false;AR.swingT=null;AR.ev=null;AR.cpuSwingAt=null;AR.caughtSnd=false;arSetPhase('wind');AR.windT0=performance.now();arRenderAll();}
function arSwing(){const m=AR.m;if(AR.phase!=='flight'||AR.swung)return;const P=AR.cur;const now=performance.now();const dtReal=now-AR.t0-(P.T*AR.speed-70*AR.speed);const dt=dtReal/AR.speed;
 AR.swung=true;AR.swingT=now;const type=AR.swingType;AR.swing={type,cx:AR.cursor.x,cy:AR.cursor.y,dt,ease:arEase()};
 AR.ev=m.resolvePitch(P,AR.swing);arSwingSound(AR.ev);}
function arSwingSound(ev){const k=ev?ev.kind:'miss';if(k==='inplay'){setTimeout(()=>arSound(ev.bb&&ev.bb.bunt?'mitt':'hit'),75*AR.speed);}else if(k==='foul'){arSound('swing');setTimeout(()=>arSound('foul'),75*AR.speed);}else arSound('swing');}
/* ---- 投球：ユーザー ---- */
/* 2段階メーター（パワー停止→精度停止）。simple=従来の往復ゲージ */
function arStartGauge(){const m=AR.m;const S=actionSettings();const tired=m.tired(m.def(),m.pa.p);const simple=S.meter==='simple';
 AR.gauge={mode:simple?'simple':'meter',t0:performance.now(),t1:0,stage:simple?'acc':'pw',speed:(simple?1.1:1.0)+tired*1.6,pw:null,accY:0.2};
 arSetPhase('gauge');const g=$('#argauge');if(g){g.hidden=false;g.classList.toggle('simple',simple);const lb=$('#arglbl');if(lb)lb.textContent=simple?'リリース':'パワー';const pw=g.querySelector('.pw');if(pw)pw.style.height='0%';const acc=g.querySelector('.acc');if(acc)acc.style.top=((1-0.2/1.15)*100)+'%';}arRenderCtl();}
/* メーター位置 0..1.15（1.0=MAXライン、それ以上はオーバー）。simpleは0..1の往復 */
function arGaugePos(){const g=AR.gauge;if(!g)return 0;const now=performance.now();const t=(now-g.t0)/1000*g.speed;
 if(g.mode==='simple'){const ph=(t*1.4)%2;return ph<1?ph:2-ph;}
 if(g.stage==='pw')return Math.min(1.15,t*1.2);
 const t2=(now-g.t1)/1000*g.speed;return Math.max(-0.12,g.pw-t2*1.3);}
function arGaugeTop(pos){const g=AR.gauge;const max=g&&g.mode==='simple'?1:1.15;return (1-clamp(pos,0,max)/max)*100;}
function arRelease(){if(AR.phase!=='gauge')return;const g=AR.gauge;if(!g)return;const now=performance.now();
 if(g.mode==='simple'){const pos=arGaugePos();const rel=Math.abs(pos-0.5)*2;arHideGauge();AR.relQ=rel;AR.meterRes={rel};arThrowUser(rel);return;}
 if(g.stage==='pw'){g.pw=arGaugePos();g.t1=now;g.stage='acc';const el=$('#argauge');if(el){const pw=el.querySelector('.pw');if(pw)pw.style.height=(g.pw/1.15*100)+'%';el.classList.toggle('over',g.pw>1);}const lb=$('#arglbl');if(lb)lb.textContent='精度！';arSound('ui');arRenderCtl();return;}
 arFinishMeter(arGaugePos());}
function arFinishMeter(pos){const g=AR.gauge;if(!g)return;const pw=g.pw==null?1.15:g.pw;const rel=clamp(Math.abs(pos-g.accY)/0.45,0,1);const over=Math.max(0,pw-1);
 const veloAdj=Math.round((pw-0.72)*7*10)/10;const ctrlAdj=Math.round(-over*90+(pw<0.5?5:0));
 AR.relQ=rel;AR.meterRes={pw,pos,rel,over,acc:rel<0.12?'PERFECT':rel<0.3?'GOOD':rel<0.6?'OK':'MISS'};arHideGauge();arThrowUser(rel,{veloAdj,ctrlAdj});}
function arHideGauge(){const el=$('#argauge');if(el){el.hidden=true;el.classList.remove('over');}}
function arThrowUser(rel,extra){const m=AR.m;const p=m.pa.p;const ps=p.pit.pitches.length?p.pit.pitches:[{name:'ストレート',velo:p.pit.velo,move:40,sharp:40,ctrl:40}];const pitch=ps[Math.min(AR.pitchSel,ps.length-1)];const t=AR.target||{x:0,y:0};
 const inp=Object.assign({pitch,tx:t.x,ty:t.y,power:AR.power,rel},extra||{});const P=m.throwPitch(inp);AR.cur=P;AR.gauge=null;arHideLower();
 const sw=m.cpuSwingInput(P);AR.swing=sw;AR.swung=false;AR.swingT=null;AR.caughtSnd=false;AR.cpuSwingAt=sw?(P.T-70+sw.dt):null;
 AR.ev=m.resolvePitch(P,sw);AR.panel=null;arSetPhase('wind');AR.windT0=performance.now();arRenderAll();}
/* ---- 結果表示 ---- */
function arKindText(ev){if(ev.text)return ev.text;const k=ev.kind;return k==='strike'?'ストライク':k==='ball'?'ボール':k==='miss'?'空振り！':k==='foul'?'ファウル':k==='kLook'?'見逃し三振！':k==='kSwing'?'空振り三振！':k==='bb'?'四球':k==='hbp'?'死球':k==='ibb'?'敬遠':'';}
function arTimingText(ev){const sw=ev.sw;if(!sw||sw.type==='bunt')return '';const c=ev.c;if(!c)return '';const tw=c.tw||55;const dt=sw.dt;const a=Math.abs(dt);const t=a<=tw?'ジャスト！':a<=2.2*tw?(dt<0?'やや早い':'やや遅い'):(dt<0?'早い':'遅い');const d=c.d>1.3?'（空振り）':c.d>1?'（かすった）':c.d<0.35?'（芯！）':c.d<0.7?'（まずまず）':'（当たり損ね）';return t+d;}
function arShowResult(ev){const m=AR.m;AR.ev=ev;AR.resultAt=performance.now();
 const P=ev.P;if(P){const col=ev.kind==='ball'||ev.kind==='bb'||ev.kind==='hbp'?'#3fa36b':ev.kind==='foul'?'#e0a100':ev.kind==='miss'||ev.kind==='kSwing'?'#e04a3a':ev.kind==='inplay'?'#3b82f6':'#f5f0d8';AR.dots.push({x:P.x,y:P.y,n:P.n,col});}
 const txt=arKindText(ev);let sub='';
 if(P)sub=`${P.name} ${P.v}km/h ${P.label}${P.slip?'（すっぽ抜け）':''}`;
 const tm=arTimingText(ev);if(tm)sub+='　'+tm;
 if(ev.runText)sub+='　'+ev.runText;
 if(AR.meterRes&&AR.side==='pit'&&P){const mr=AR.meterRes;if(mr.acc)sub+=`　メーター:${mr.acc}${mr.over>0?'（オーバー）':''}`;AR.meterRes=null;}
 AR.foot=(AR.mode==='card'&&AR.footPrefix?AR.footPrefix+'　｜　':'')+sub;
 arHideLower();if(P&&!ev.skipScene)arVelTag(P,ev);if(P&&ev.sw&&ev.c&&!ev.skipScene&&(AR.side==='bat'||AR.mode==='card'))arPciBadge(ev);
 if(ev.kind==='inplay'){const c=ev.bb;AR.cam=null;const sc=fwBuildScene(c,ev.decision?null:ev.play,{dec:ev.decision});sc.c=c;sc.ev=ev;AR.field=sc;if(ev.skipScene){sc.t0=performance.now()-sc.T/(sc.rate||1)-300;sc.skipped=true;}else if(AR.swung&&AR.swingT){const el=performance.now()-(AR.swingT+75*AR.speed);if(el>0&&el<700)sc.t0-=el/(sc.rate||1);}arSetPhase('field');arOverlay(c.res==='HR'?'大きい！':c.dist>=90&&(c.type==='fly'||c.type==='line')?'大きい！':'','');setTimeout(()=>{if(AR.phase==='field')arOverlay('','');},700);}
 else{const k=ev.kind;if(k==='bb'||k==='hbp'||k==='ibb')arSound('walk');if(k==='kSwing'||k==='kLook'||k==='kBunt')setTimeout(()=>arSound('k'),120);
  arOverlay(txt,ev.runText||'',k==='kSwing'||k==='kLook'||k==='kBunt'?'k':k==='bb'||k==='hbp'?'bb':'');arSetPhase('after');}
 if(ev.kind!=='inplay')arRenderTop();arRenderFoot();}
function arOverlay(text,sub,cls){const o=$('#arov');if(!o)return;if(!text&&!sub){o.innerHTML='';return;}o.innerHTML=`<div class="ovt ${cls||''}">${esc(text)}</div>${sub?`<div class="ovs">${esc(sub)}</div>`:''}`;}
function arOverlayHtml(html){const o=$('#arov');if(o)o.innerHTML=html;}
function arSkip(){if(AR.phase==='replay'){arEndReplay();return;}if(AR.phase==='field'){const sc=AR.field;if(sc.pauseAt!=null&&!sc.paused){sc.t0=performance.now()-sc.pauseAt/(sc.rate||1);return;}sc.t0=performance.now()-sc.T/(sc.rate||1);sc.cut=true;sc.skipped=true;arFieldDone();}else if(AR.phase==='after')arAfterResult();}
function arFieldDone(){const ev=AR.ev;const sc=AR.field;if(sc&&sc.kind!=='inplay'){arOverlay(ev.runText||ev.text||'','');arRenderTop();arSetPhase('after');AR.resultAt=performance.now();arRenderAll();return;}
 const c=ev.bb;const S=actionSettings();
 if(c.res==='HR'&&S.replay&&sc&&!sc.replayed&&!sc.skipped){sc.replayed=true;arStartReplay();return;}
 const txt=ev.text||'';
 if(c.res==='HR'){const b=AR.m.pa?AR.m.pa.b:null;const nm=b?b.name:'';const stt=b?(AR.m.A.stats[b.id]||AR.m.B.stats[b.id]):null;const hrN=stt?stt.hr:0;arOverlayHtml(`<div class="hrb"><div class="hrt">HOME RUN!</div><div class="hrn">${esc(nm)}　${esc(txt||'本塁打')}${hrN>1?`（今日${hrN}本目）`:''}</div><div class="hrs"><span><small>飛距離</small><b>${c.dist}</b>m</span><span><small>打球速度</small><b>${c.ev}</b>km/h</span><span><small>角度</small><b>${c.la}</b>°</span></div></div>`);}
 else arOverlay(txt,ev.runText||'',ev.play&&ev.play.outs>=2?'dp':['1B','2B','3B'].includes(c.res)?'hit':'');
 arRenderTop();
 if(c.res==='HR')arSound('hr');else if(['GO','FO','LO','PO','DP','FC','SAC'].includes(c.res))arSound('out');else arSound('run');
 arSetPhase('after');AR.resultAt=performance.now();arRenderAll();}
/* 本塁打のスローリプレイ */
function arStartReplay(){const sc=AR.field;const hr=sc.callouts.find(x=>x.kind==='hr');const until=Math.min(sc.T,(hr?hr.t:sc.T*0.7)+700);AR.replay={t0:performance.now(),rate:0.5,from:120,until};AR.cam=null;sc.cut=true;arOverlay('','');const r=$('#arrep');if(r)r.hidden=false;arSetPhase('replay');arRenderCtl();}
function arEndReplay(){const sc=AR.field;AR.replay=null;const r=$('#arrep');if(r)r.hidden=true;if(sc){AR.cam=null;sc.cut=true;sc.t0=performance.now()-sc.T/(sc.rate||1);}arFieldDone();}
function arAfterResult(){const m=AR.m;const ev=AR.ev;arOverlay('','');
 if(m.done){arBanner();return;}
 if(ev&&ev.halfEnd){arBanner();return;}
 if(ev&&ev.paDone){arNextPA();return;}
 AR.cur=null;AR.swing=null;AR.swung=false;AR.target=null;arSetPhase('pre');
 if(AR.side==='pit'){const ps=m.pa.p.pit.pitches;AR.sign=m.cpuPitchInput();AR.sign.idx=Math.max(0,ps.indexOf(AR.sign.pitch));AR.target=arDefaultTarget();}
 AR.hold=false;AR.holdStart=false;
 arRenderAll();}
function arBanner(){const m=AR.m;const s=m.situation();AR.banner={title:m.done?'試合終了':`${s.inn}回${s.top?'表':'裏'} ${s.batTeam}の攻撃`,lines:[],until:performance.now()+2200,wait:false};arHideLower();arSetPhase('half');arRenderAll();}
function arAfterBanner(){AR.banner=null;AR.bannerEl=null;arOverlay('','');if(AR.m.done){arFinish();return;}arNextPA();}
ACT.arDecide=d=>{const m=AR.m;if(AR.phase!=='decide')return;const old=AR.field;const choice=d.t!=null?{throwTo:parseInt(d.t)}:{send:d.v==='1'};const ev=m.finishInplay(choice);AR.ev=ev;AR.pending=null;if(ev.runText)AR.foot=ev.runText;else if(choice.throwTo)AR.foot=`${['','一塁','二塁','三塁','本塁'][choice.throwTo]}へ送球 → ${ev.text||''}`;arSound(d.v==='1'||choice.throwTo?'run':'ui');
 const sc=fwBuildScene(ev.bb,ev.play,{resume:old?old.pauseAt:null,dec:old?old.decision:null});sc.c=ev.bb;sc.ev=ev;sc.t0=performance.now()-(old?old.pauseAt:0)/(sc.rate||1);sc.pauseAt=null;AR.field=sc;arSetPhase('field');arRenderAll();};
/* ---- メインループ ---- */
function arLoop(){AR.raf=requestAnimationFrame(arLoop);const now=performance.now();
 /* 重いフレーム（シェーダー初期化など）の間はカットインのタイマーを進めない（1人あたり最大3秒まで補正） */{const dt=now-(AR.loopT||now);AR.loopT=now;if(dt>400&&AR.intro){const it=AR.intro;it.comp=(it.comp||0);const add=Math.min(dt,3000-it.comp);if(add>0){it.t0+=add;it.comp+=add;}}}
 if(AR.phase==='intro'){const it=AR.intro;if(!it)arPlayBall();else if(it.shown&&!AR.introHold&&!window.__introHold&&now-it.t0>it.dur)arIntroNext();}
 if(AR.phase==='wind'){const w=arWindDur();if(now-AR.windT0>=w){arSetPhase('flight');AR.t0=now;arSound('ui');}}
 if(AR.phase==='flight'){const P=AR.cur;const T=P.T*AR.speed;const u=(now-AR.t0)/T;
  if((AR.side==='pit'||AR.mode==='card')&&AR.cpuSwingAt!=null&&!AR.swung&&now-AR.t0>=AR.cpuSwingAt*AR.speed){AR.swung=true;AR.swingT=now;arSwingSound(AR.ev);}
  if(u>=1&&!AR.caughtSnd){AR.caughtSnd=true;const ev=AR.ev;const hit=ev&&AR.swung&&(ev.kind==='inplay'||ev.kind==='foul');if(!hit)arSound('mitt');}
  if(u>=1+0.18){if(!AR.ev){AR.ev=AR.m.resolvePitch(P,null);}arShowResult(AR.ev);}}
 if(AR.phase==='after'){const ev=AR.ev;const hr=ev&&ev.bb&&ev.bb.res==='HR'&&!ev.skipScene;const d=(hr?2800:ev&&(ev.paDone||ev.halfEnd||ev.runText)?1500:950)+(AR.mode==='card'?500:0);if(ev&&ev.runPlay&&!ev.runShown&&now-AR.resultAt>450){ev.runShown=true;AR.cam=null;const sc=fwBuildRunnerScene(ev.runPlay);sc.ev=ev;AR.field=sc;arOverlay('','');arSetPhase('field');}else if(now-AR.resultAt>d){arAfterResult();if(AR.phase==='pre'&&AR.side==='bat'&&actionSettings().autoThrow)AR.autoT=now+700;}}
 if(AR.phase==='pre'&&AR.autoT&&now>AR.autoT){AR.autoT=0;if(AR.side==='bat'&&!AR.panel)arThrowCpu();}
 if(AR.phase==='field'){const sc=AR.field;const t=fwTime(sc,now);if(sc.pauseAt!=null&&!sc.paused&&t>=sc.pauseAt){sc.paused=true;arSetPhase('decide');AR.pending=AR.ev;arRenderAll();}else if(!sc.paused&&t>sc.T+250)arFieldDone();}
 if(AR.phase==='replay'){const rp=AR.replay;if(!rp||rp.from+(now-rp.t0)*rp.rate>=rp.until)arEndReplay();}
 if(AR.phase==='half'){const bn=AR.banner;if(bn&&!bn.wait&&now>bn.until)arAfterBanner();}
 if(AR.phase==='gauge'){const g=AR.gauge;const pos=arGaugePos();const mk=$('#argmark');if(mk)mk.style.top=arGaugeTop(pos)+'%';if(g&&g.mode==='meter'){if(g.stage==='pw'&&pos>=1.15&&now-g.t0>1150/g.speed+180)arRelease();else if(g.stage==='acc'&&pos<=-0.12)arFinishMeter(pos);}}
 arDraw(now);}
/* ---- 座標 ---- */
function arZone(){if(r3on())return r3ZoneRect();const W=AR.W,H=AR.H;if(AR.side==='bat'){const w=Math.min(W*0.42,H*0.36);return {cx:W/2,cy:H*0.6,w,h:w*1.12};}const w=Math.min(W*0.3,H*0.25);return {cx:W/2,cy:H*0.47,w,h:w*1.15};}
function arZ2S(x,y){if(r3on())return r3ZoneToScreen(x,y);const z=arZone();const mx=AR.side==='pit'?-1:1;return [z.cx+mx*x*z.w/2,z.cy+y*z.h/2];}
/* 球の軌道上の位置（u:0→1）。ゾーン座標で返す */
/* 2D用：ボールのゾーン座標。物理軌道（重力＋空気抵抗＋マグヌス力）の「直線からのズレ」を到達点に足す */
function arBallAt(P,u){const ph=typeof phOf==='function'?phOf(P):null;if(ph){const d=phDev(P,u);return {x:P.x+d.dx/0.25,y:P.y-d.dz/0.3};}
 const pre={x:P.x-P.bx,y:P.y-P.by};const s=P.late;const g=u<=s?0:Math.pow((u-s)/(1-s),1.6);return {x:pre.x+(P.x-pre.x)*g,y:pre.y+(P.y-pre.y)*g};}
function arNight(){try{return document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);}catch(e){return false;}}
const AR_PAL={day:{sky1:'#9fcbea',sky2:'#e3f0fa',stand1:'#2c3540',stand2:'#3a4552',fence:'#1f4d2b',fenceLine:'#f3c340',grass1:'#2f7d3c',grass2:'#378a44',dirt:'#b98852',dirt2:'#a67744',chalk:'#f3ecd8',net:'rgba(255,255,255,.12)'},night:{sky1:'#0d1725',sky2:'#1e2f44',stand1:'#161c25',stand2:'#222a35',fence:'#173a21',fenceLine:'#e0b347',grass1:'#246a32',grass2:'#2a7538',dirt:'#9c7146',dirt2:'#86603a',chalk:'#e8e1cf',net:'rgba(255,255,255,.1)'}};
function arPal(){return arNight()?AR_PAL.night:AR_PAL.day;}
/* ---- 描画 ---- */
function arDraw(now){const g=AR.g;if(!g)return;AR.drawN=(AR.drawN||0)+1;const W=AR.W,H=AR.H;g.setTransform(AR.dpr,0,0,AR.dpr,0,0);g.clearRect(0,0,W,H);
 if(r3on()){r3Frame(now);if(r3on()){arDrawHud3d(now);return;}}
 if(AR.phase==='replay'&&AR.replay&&AR.field){const rp=AR.replay;fwDrawScene(now,Math.min(rp.until,rp.from+(now-rp.t0)*rp.rate));g.fillStyle='rgba(0,0,0,.85)';g.fillRect(0,0,W,H*0.07);g.fillRect(0,H*0.93,W,H*0.07);return;}
 if(AR.phase==='field'||AR.phase==='decide'||(AR.phase==='after'&&AR.field&&AR.ev&&(AR.ev.kind==='inplay'||AR.ev.runShown||AR.ev.kind==='pickoff'||AR.ev.kind==='pickoffErr'||AR.ev.kind==='pickoffSafe'))){fwDrawScene(now);return;}
 if(AR.phase==='intro'){arDrawBackdrop();arDrawIntro(now);return;}
 if(AR.phase==='half'){arDrawBackdrop();if(AR.bannerEl!==AR.banner){AR.bannerEl=AR.banner;arOverlayHtml(arBannerHtml());}return;}
 if(AR.phase==='sim'){arDrawBackdrop();arDrawBannerCv();return;}
 if(AR.side==='bat')arDrawCatcherView(now);else arDrawPitcherView(now);}
/* チームのユニフォーム（色・デザイン・胸文字）。同じチームには同じオブジェクトを返す（3Dの材質キャッシュ用） */
const AR_UNI=new WeakMap();
function arTeamColors(t){if(t.isUser){const u=G.uniform;const key=JSON.stringify(u)+'|'+JSON.stringify(G.emblem||{});const c=AR_UNI.get(t);if(c&&c._key===key)return c;const o=Object.assign({},u,{pants:u.pants||'#f4f4f4',text:u.text||arAbbr(t.name),mark:G.emblem&&G.emblem.text?[...G.emblem.text][0]:[...(u.text||arAbbr(t.name))][0],_key:key});AR_UNI.set(t,o);return o;}
 const cached=AR_UNI.get(t);if(cached)return cached;let h=0;for(const ch of t.name)h=(h*31+ch.charCodeAt(0))>>>0;const pal=[['#cfd6de','#0b2a4a','#0b2a4a'],['#e8d9c2','#9b1c1c','#9b1c1c'],['#cfe0d2','#14532d','#14532d'],['#c9daf0','#102c6b','#102c6b'],['#e4d9f2','#6b21a8','#1b1b1b'],['#f1d4d4','#c81e1e','#1b1b1b'],['#cfe6ec','#0891b2','#0b2a4a'],['#f6e2c6','#f97316','#1b1b1b'],['#2b2f36','#e0b347','#1b1b1b'],['#1e3a5f','#f4f4f4','#1e3a5f']];const c=pal[h%pal.length];
 const styles=['plain','pin','sleeve','placket','band','raglan','plain','sleeve'];const fonts=['graduate','dela','reggae','zen','rock','oswald','shippori','noto'];const abbr=arAbbr(t.name);
 const o={base:c[0],trim:c[1],cap:c[2],capBrim:c[2],pants:c[0]==='#2b2f36'||c[0]==='#1e3a5f'?'#d9d9d9':'#f4f4f4',style:styles[(h>>>3)%styles.length],text:abbr,textFont:fonts[(h>>>7)%fonts.length],textColor:c[1],textOutline:c[0],numFont:'oswald',numColor:c[1],numOutline:c[0],mark:[...abbr][0]||''};AR_UNI.set(t,o);return o;}
/* 捕手視点の簡易パース：ワールド(xw[m], 本塁からの距離D[m]) → 画面 [x,y,px/m] */
function arPersp(xw,D){const W=AR.W,H=AR.H;const z=arZone();const feetY=z.cy-z.h*0.6;const fenceY=H*0.31;const plateY=z.cy+z.h*0.78;
 let y;if(D<=18.4)y=plateY-(plateY-feetY)*(D/18.4);else y=feetY-(feetY-fenceY)*Math.pow(Math.min(1,(D-18.4)/99.6),0.62);
 const sc=(W*0.92)/(42+D*1.15);return [W/2+xw*sc,y,sc];}
const AR_CROWD=(()=>{const out=[];let s=777;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};const cols=['#e8e4da','#d9534f','#3b6fb6','#f0c75e','#8aa5c8','#c9b7a0','#f4f4f4','#6aa84f','#333'];for(let i=0;i<420;i++)out.push({u:rnd(),v:rnd(),col:cols[Math.floor(rnd()*cols.length)],r:1.2+rnd()*1.3});return out;})();
/* 捕手視点の背景（スタンド・観客・スコアボード・フェンス・芝・ライン） */
function arDrawBackdrop(){const g=AR.g,W=AR.W,H=AR.H;const P=arPal();const night=arNight();const m=AR.m;
 const sky=g.createLinearGradient(0,0,0,H*0.22);sky.addColorStop(0,P.sky1);sky.addColorStop(1,P.sky2);g.fillStyle=sky;g.fillRect(0,0,W,H*0.22);
 if(night){g.fillStyle='rgba(255,255,255,.9)';for(let i=0;i<2;i++){const x=W*(0.18+i*0.64);g.fillRect(x-1,H*0.02,2,H*0.2);g.fillStyle='#fff5c2';g.beginPath();g.ellipse(x,H*0.03,W*0.07,H*0.012,0,0,Math.PI*2);g.fill();g.fillStyle='rgba(255,255,255,.9)';}}
 else{g.fillStyle='rgba(255,255,255,.75)';for(const c of [[0.15,0.08,0.09],[0.62,0.12,0.11],[0.85,0.05,0.07]]){g.beginPath();g.ellipse(W*c[0],H*c[1],W*c[2],H*0.02,0,0,Math.PI*2);g.fill();}}
 /* スタンドと観客 */g.fillStyle=P.stand1;g.fillRect(0,H*0.14,W,H*0.13);g.fillStyle=P.stand2;for(let i=0;i<5;i++)g.fillRect(0,H*(0.15+i*0.025),W,H*0.011);
 g.save();g.globalAlpha=night?0.55:0.8;for(const c of AR_CROWD){const x=c.u*W,y=H*0.145+c.v*H*0.12;if(Math.abs(x-W/2)<W*0.21&&y<H*0.262)continue;g.fillStyle=c.col;g.beginPath();g.arc(x,y,c.r,0,Math.PI*2);g.fill();}g.restore();
 /* バックスクリーンのスコアボード */if(m){const bw=W*0.4,bh=H*0.125,bx=W/2-bw/2,by=H*0.1;g.fillStyle='#0f151b';g.fillRect(bx,by,bw,bh);g.strokeStyle='#4a5560';g.lineWidth=1;g.strokeRect(bx+0.5,by+0.5,bw-1,bh-1);
  const fn=getComputedStyle(document.body).getPropertyValue('--font-num')||'monospace';g.textBaseline='middle';g.textAlign='center';
  g.fillStyle='#e8e4da';g.font=`700 ${Math.round(bh*0.2)}px sans-serif`;g.fillText(arAbbr(m.A.name).slice(0,3),bx+bw*0.18,by+bh*0.28);g.fillText(arAbbr(m.B.name).slice(0,3),bx+bw*0.82,by+bh*0.28);
  g.fillStyle='#ffd166';g.font=`700 ${Math.round(bh*0.5)}px ${fn}`;g.fillText(String(m.score[0]),bx+bw*0.2,by+bh*0.7);g.fillText(String(m.score[1]),bx+bw*0.8,by+bh*0.7);
  g.fillStyle='#9fb3c8';g.font=`${Math.round(bh*0.19)}px sans-serif`;g.fillText(`${m.inn}回${m.top?'表':'裏'}`,bx+bw*0.5,by+bh*0.28);
  const lamp=(x,y,on,col)=>{g.fillStyle=on?col:'#2a333d';g.beginPath();g.arc(x,y,Math.max(1.5,bh*0.055),0,Math.PI*2);g.fill();};const pa=m.pa;const live=pa&&!(AR.mode==='card'&&AR.phase==='pre');const bb=live?pa.balls:0,ss=live?pa.strikes:0;
  const r0=bx+bw*0.37;const dy=bh*0.16;lamp(r0,by+bh*0.56,bb>0,'#3fd36b');lamp(r0+dy,by+bh*0.56,bb>1,'#3fd36b');lamp(r0+dy*2,by+bh*0.56,bb>2,'#3fd36b');lamp(r0,by+bh*0.72,ss>0,'#ffd166');lamp(r0+dy,by+bh*0.72,ss>1,'#ffd166');lamp(r0,by+bh*0.88,m.outs>0,'#ff5a4a');lamp(r0+dy,by+bh*0.88,m.outs>1,'#ff5a4a');
  g.fillStyle='#9fb3c8';g.font=`${Math.round(bh*0.17)}px sans-serif`;g.textAlign='right';g.fillText('B',r0-dy*0.6,by+bh*0.56);g.fillText('S',r0-dy*0.6,by+bh*0.72);g.fillText('O',r0-dy*0.6,by+bh*0.88);g.textAlign='center';}
 g.fillStyle=P.fence;g.fillRect(0,H*0.27,W,H*0.04);g.fillStyle=P.fenceLine;g.fillRect(0,H*0.27,W,2);
 g.fillStyle=P.grass1;g.fillRect(0,H*0.31,W,H*0.7);
 g.fillStyle=P.grass2;let y=H*0.31,hh=H*0.018;while(y<H){g.fillRect(0,y,W,hh);y+=hh*2;hh*=1.25;}
 /* 内野の土（扇形）と芝のダイヤモンド */const z=arZone();const plate=[W/2,z.cy+z.h*0.78];
 g.fillStyle=P.dirt;g.beginPath();g.moveTo(plate[0]-W*0.9,plate[1]+H*0.3);for(let a=-70;a<=70;a+=5){const rad=a*Math.PI/180;const xw=29*Math.sin(rad),yw=18.4+29*Math.cos(rad);const D=Math.hypot(xw,yw);const q=arPersp(xw,D);g.lineTo(q[0],q[1]);}g.lineTo(plate[0]+W*0.9,plate[1]+H*0.3);g.closePath();g.fill();
 g.fillStyle=P.grass1;g.beginPath();{const pts=[[0,3.6],[16,19.4],[0,35.2],[-16,19.4]].map(p=>arPersp(p[0],Math.hypot(p[0],p[1])));g.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))g.lineTo(p[0],p[1]);}g.closePath();g.fill();
 /* ファウルライン */g.strokeStyle=P.chalk;g.globalAlpha=0.85;for(const sgn of [-1,1]){const far=arPersp(sgn*70.7,100);const mid=arPersp(sgn*14,19.8);g.lineWidth=3;g.beginPath();g.moveTo(plate[0]+sgn*z.w*0.2,plate[1]);g.lineTo(mid[0],mid[1]);g.stroke();g.lineWidth=1.5;g.beginPath();g.moveTo(mid[0],mid[1]);g.lineTo(far[0],far[1]);g.stroke();}g.globalAlpha=1;
 /* 塁 */g.fillStyle='#ffffff';for(const B of [[19.4,19.4],[0,38.8],[-19.4,19.4]]){const q=arPersp(B[0],Math.hypot(B[0],B[1]));const s=Math.max(3,q[2]*0.5);g.beginPath();g.moveTo(q[0],q[1]-s*0.5);g.lineTo(q[0]+s,q[1]);g.lineTo(q[0],q[1]+s*0.5);g.lineTo(q[0]-s,q[1]);g.closePath();g.fill();}
 g.fillStyle=P.dirt;g.beginPath();g.ellipse(W/2,H*1.02,W*0.7,H*0.2,0,0,Math.PI*2);g.fill();}
/* 背景の野手（投手以外）を遠近をつけて描く */
function arDrawBgFielders(g,def,cd){const m=AR.m;const DP=fwDefPos(def);const list=[];for(const k in DP){if(k==='投'||k==='捕'||k==='一'||k==='三')continue;const p=DP[k];const D=Math.hypot(p[0],p[1]);list.push({k,x:p[0],D});}list.sort((a,b)=>b.D-a.D);const z=arZone();
 for(const f of list){const q=arPersp(f.x,f.D);const h=z.h*0.78*Math.pow(18.4/f.D,1.35);g.save();g.globalAlpha=0.95;arFigure(g,q[0],q[1],h,cd,{arm:-0.3,flip:f.x>0});g.restore();}}
function arDrawBannerCv(){const g=AR.g,W=AR.W,H=AR.H;const bn=AR.banner;if(!bn)return;g.fillStyle='rgba(10,20,15,.6)';g.fillRect(0,0,W,H);g.fillStyle='#fff';g.font=`700 ${Math.round(Math.min(26,W/14))}px ${getComputedStyle(document.body).getPropertyValue('--font-display')||'serif'}`;g.textAlign='center';g.textBaseline='middle';g.fillText(bn.title,W/2,bn.lines.length?H*0.12:H*0.45);
 if(bn.lines.length){const few=bn.lines.length<=5;g.font=`${few?14:12}px ${getComputedStyle(document.body).getPropertyValue('--font-body')||'sans-serif'}`;g.textAlign=few?'center':'left';const max=Math.floor((H*0.72)/17);const ls=bn.lines.slice(-max);const y0=few?H*0.3:H*0.2;ls.forEach((l,i)=>{g.fillStyle=/本塁打|生還|ヒット|安打|二塁打|三塁打/.test(l)?'#ffd166':'#f0f0f0';g.fillText(l.length>34?l.slice(0,34)+'…':l,few?W/2:16,y0+i*(few?24:17));});g.textAlign='center';g.fillStyle='#cfe3d6';g.fillText('タップで続ける',W/2,H*0.95);}
 else{g.font='13px sans-serif';g.fillStyle='#cfe3d6';g.fillText(AR.m.done?'タップで結果へ':'攻守交代',W/2,H*0.45+30);}}
/* 人物（簡易）：x,yは足元、hは身長 */
function arFigure(g,x,y,h,col,opt){opt=opt||{};const s=h/100;g.save();g.translate(x,y);if(opt.flip)g.scale(-1,1);g.globalAlpha=opt.alpha==null?1:opt.alpha;
 g.lineCap='round';g.lineJoin='round';
 /* 脚 */g.strokeStyle=col.pants;g.lineWidth=11*s;g.beginPath();g.moveTo(-7*s,-42*s);g.lineTo(-11*s+(opt.legLift?8*s:0),-(opt.legLift?26*s:3*s));g.moveTo(7*s,-42*s);g.lineTo(11*s,-3*s);g.stroke();
 g.strokeStyle='#222';g.lineWidth=4*s;g.beginPath();g.moveTo(-14*s,-2*s);g.lineTo(-7*s,-2*s);g.moveTo(8*s,-2*s);g.lineTo(15*s,-2*s);g.stroke();
 /* 胴 */g.fillStyle=col.base;g.beginPath();g.moveTo(-17*s,-80*s);g.lineTo(17*s,-80*s);g.lineTo(13*s,-40*s);g.lineTo(-13*s,-40*s);g.closePath();g.fill();g.strokeStyle=col.trim;g.lineWidth=2.2*s;g.stroke();
 g.fillStyle=col.trim;g.fillRect(-4*s,-80*s,8*s,5*s);
 /* 腕 */g.strokeStyle=col.base;g.lineWidth=8*s;const a=opt.arm||0;g.beginPath();g.moveTo(-14*s,-74*s);g.lineTo(-22*s+Math.cos(a)*14*s,-58*s+Math.sin(a)*14*s);g.moveTo(14*s,-74*s);g.lineTo(24*s+Math.cos(a+1)*12*s,-60*s+Math.sin(a+1)*10*s);g.stroke();
 g.fillStyle='#e7b48a';g.beginPath();g.arc(-22*s+Math.cos(a)*14*s,-58*s+Math.sin(a)*14*s,4*s,0,Math.PI*2);g.fill();
 /* 頭 */g.fillStyle='#e7b48a';g.beginPath();g.arc(0,-91*s,9.5*s,0,Math.PI*2);g.fill();g.fillStyle=col.cap;g.beginPath();g.arc(0,-93*s,10*s,Math.PI,0);g.fill();g.fillRect(-10*s,-94*s,24*s,3*s);
 g.restore();}
/* 打者（構え→スイング）。u:スイング進行 0..1（nullで構え） */
function arBatter(g,x,y,h,col,hand,u){const s=h/100;const flip=hand==='左';g.save();g.translate(x,y);if(flip)g.scale(-1,1);g.lineCap='round';g.lineJoin='round';
 const sw=u==null?0:u;
 /* 脚 */g.strokeStyle=col.pants;g.lineWidth=12*s;g.beginPath();g.moveTo(-9*s,-44*s);g.lineTo(-16*s,-3*s);g.moveTo(9*s,-44*s);g.lineTo(14*s+sw*6*s,-3*s);g.stroke();
 g.strokeStyle='#222';g.lineWidth=4*s;g.beginPath();g.moveTo(-22*s,-2*s);g.lineTo(-12*s,-2*s);g.moveTo(10*s,-2*s);g.lineTo(20*s,-2*s);g.stroke();
 /* 胴（やや斜め） */g.fillStyle=col.base;g.beginPath();g.moveTo(-16*s,-84*s);g.lineTo(16*s,-82*s);g.lineTo(14*s,-42*s);g.lineTo(-14*s,-42*s);g.closePath();g.fill();g.strokeStyle=col.trim;g.lineWidth=2.4*s;g.stroke();
 /* 腕とバット：構えでは後ろ上、スイングで前へ（su=0.5で水平） */const ang=(-0.55+sw*4.24);const hx=6*s-sw*8*s,hy=-78*s+sw*10*s;
 g.strokeStyle=col.base;g.lineWidth=8*s;g.beginPath();g.moveTo(-12*s,-76*s);g.lineTo(hx,hy);g.moveTo(12*s,-76*s);g.lineTo(hx+3*s,hy+2*s);g.stroke();
 g.fillStyle='#e7b48a';g.beginPath();g.arc(hx,hy,4.5*s,0,Math.PI*2);g.fill();
 if(sw>0&&sw<1){g.save();g.translate(hx,hy);g.fillStyle='rgba(255,255,255,.22)';g.beginPath();g.moveTo(0,0);g.arc(0,0,46*s,ang-Math.PI/2-Math.min(0.9,sw*2.2),ang-Math.PI/2);g.closePath();g.fill();g.restore();}
 g.save();g.translate(hx,hy);g.rotate(ang);g.strokeStyle='#8b5e34';g.lineWidth=5.5*s;g.beginPath();g.moveTo(0,0);g.lineTo(0,-46*s);g.stroke();g.strokeStyle='#a9774a';g.lineWidth=8*s;g.beginPath();g.moveTo(0,-22*s);g.lineTo(0,-46*s);g.stroke();g.restore();
 /* 頭（ヘルメット） */g.fillStyle='#e7b48a';g.beginPath();g.arc(2*s,-93*s,9.5*s,0,Math.PI*2);g.fill();g.fillStyle=col.cap;g.beginPath();g.arc(2*s,-94*s,10.5*s,Math.PI*0.95,Math.PI*2.05);g.fill();g.beginPath();g.moveTo(2*s,-94*s);g.lineTo(16*s,-92*s);g.lineTo(13*s,-86*s);g.closePath();g.fill();
 g.restore();}
/* 捕手（しゃがみ、背中側または正面） */
function arCatcher(g,x,y,w,col,front,alpha,num){g.save();g.globalAlpha=alpha==null?1:alpha;const h=w*0.95;
 g.fillStyle=col.pants;g.beginPath();g.ellipse(x,y,w*0.5,h*0.2,0,0,Math.PI*2);g.fill();
 g.fillStyle=col.base;g.beginPath();g.moveTo(x-w*0.44,y-h*0.05);g.quadraticCurveTo(x-w*0.46,y-h*0.5,x-w*0.22,y-h*0.58);g.lineTo(x+w*0.22,y-h*0.58);g.quadraticCurveTo(x+w*0.46,y-h*0.5,x+w*0.44,y-h*0.05);g.closePath();g.fill();g.strokeStyle=col.trim;g.lineWidth=2;g.stroke();
 if(!front){g.fillStyle=col.trim;g.font=`700 ${Math.round(h*0.2)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(String(num==null?2:num),x,y-h*0.3);}
 if(front){g.fillStyle='#2b2f36';g.beginPath();g.ellipse(x,y-h*0.22,w*0.26,h*0.26,0,0,Math.PI*2);g.fill();}
 g.fillStyle=col.cap;g.beginPath();g.arc(x,y-h*0.62,w*0.17,0,Math.PI*2);g.fill();
 if(front){g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=1.5;for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(x-w*0.1,y-h*0.62+i*w*0.06);g.lineTo(x+w*0.1,y-h*0.62+i*w*0.06);g.stroke();}}
 g.restore();}
function arMitt(g,x,y,r){g.fillStyle='#8b5e34';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.strokeStyle='#5a3a1a';g.lineWidth=1.5;g.stroke();g.strokeStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(x,y,r*0.55,0,Math.PI*2);g.stroke();}
function arDrawBall(g,x,y,r,ang){g.fillStyle='#fbfaf5';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=1;g.stroke();if(r>4.5){g.strokeStyle='#c23b2a';g.lineWidth=Math.max(1,r*0.14);g.beginPath();g.arc(x-r*0.55,y,r*0.9,-0.9+ang,0.9+ang);g.stroke();g.beginPath();g.arc(x+r*0.55,y,r*0.9,Math.PI-0.9+ang,Math.PI+0.9+ang);g.stroke();}}
function arDrawZone(g,z,alpha){g.save();g.globalAlpha=alpha==null?1:alpha;g.fillStyle='rgba(255,255,255,.07)';g.fillRect(z.cx-z.w/2,z.cy-z.h/2,z.w,z.h);g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;g.strokeRect(z.cx-z.w/2,z.cy-z.h/2,z.w,z.h);g.strokeStyle='rgba(255,255,255,.28)';g.lineWidth=1;for(let i=1;i<3;i++){g.beginPath();g.moveTo(z.cx-z.w/2+z.w*i/3,z.cy-z.h/2);g.lineTo(z.cx-z.w/2+z.w*i/3,z.cy+z.h/2);g.stroke();g.beginPath();g.moveTo(z.cx-z.w/2,z.cy-z.h/2+z.h*i/3);g.lineTo(z.cx+z.w/2,z.cy-z.h/2+z.h*i/3);g.stroke();}g.restore();}
function arDrawDots(g,r){for(const d of AR.dots){const [x,y]=arZ2S(d.x,d.y);g.fillStyle=d.col;g.globalAlpha=0.9;g.beginPath();g.arc(x,y,r||7,0,Math.PI*2);g.fill();g.globalAlpha=1;g.fillStyle='#111';g.font=`700 ${Math.round((r||7)*1.25)}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(d.n,x,y+0.5);}}
function arBatterBox(g,z,P,side){g.strokeStyle=P.chalk;g.lineWidth=2;g.globalAlpha=0.8;const bw=z.w*0.62,bh=z.h*0.42;const x=side<0?z.cx-z.w*0.5-bw-z.w*0.12:z.cx+z.w*0.5+z.w*0.12;g.strokeRect(x,z.cy+z.h*0.62,bw,bh);g.globalAlpha=1;}
/* 投球中の球の状態：飛翔中／打球として飛び出す／ミットに収まる */
function arPitchState(now){const P=AR.cur;if(!P)return null;const T=P.T*AR.speed;const u=(now-AR.t0)/T;const ev=AR.ev;const tc=AR.swingT!=null?AR.swingT+75*AR.speed:null;
 const hit=!!(ev&&AR.swung&&tc!=null&&(ev.kind==='inplay'||ev.kind==='foul')&&now>=tc);
 if(hit){const uc=clamp((tc-AR.t0)/T,0,1);return {u,hit:true,ts:(now-tc)/1000,uc,foul:ev.kind==='foul',tip:!!(ev.c&&ev.c.tip),bb:ev.bb,c:ev.c};}
 return {u,hit:false,caught:u>=1,tc};}
function arContactFx(g,x,y,ts,foul){if(ts>0.25)return;const k=ts/0.25;g.save();g.globalAlpha=1-k;g.strokeStyle=foul?'#ffd166':'#fff';g.lineWidth=3;g.beginPath();g.arc(x,y,6+k*44,0,Math.PI*2);g.stroke();g.lineWidth=2;for(let i=0;i<7;i++){const a=i/7*Math.PI*2+0.3;const r1=8+k*30,r2=r1+10+k*18;g.beginPath();g.moveTo(x+Math.cos(a)*r1,y+Math.sin(a)*r1);g.lineTo(x+Math.cos(a)*r2,y+Math.sin(a)*r2);g.stroke();}g.restore();}
function arSwoosh(g,x,y,len,dir,alpha){g.save();g.globalAlpha=alpha;g.strokeStyle='rgba(255,255,255,.9)';g.lineWidth=2;for(let i=0;i<3;i++){g.beginPath();g.moveTo(x-dir*len*0.2,y-10+i*10);g.quadraticCurveTo(x+dir*len*0.3,y-14+i*10,x+dir*len,y-6+i*10);g.stroke();}g.restore();}
/* ===== 打撃（捕手視点） ===== */
function arDrawCatcherView(now){const g=AR.g,W=AR.W,H=AR.H;const m=AR.m;const z=arZone();const PL=arPal();arDrawBackdrop();
 const def=m.def(),bat=m.bat();const cd=arTeamColors(def),cb=arTeamColors(bat);const P=AR.cur;const pa=m.pa;const ph=AR.phase;const S=actionSettings();
 arDrawBgFielders(g,def,cd);
 /* マウンドと投手 */const feetY=z.cy-z.h*0.6;g.fillStyle=PL.dirt;g.beginPath();g.ellipse(W/2,feetY+z.h*0.02,z.w*0.5,z.h*0.075,0,0,Math.PI*2);g.fill();g.fillStyle=PL.chalk;g.fillRect(W/2-z.w*0.06,feetY-1,z.w*0.12,2);
 let arm=0,lift=false;if(ph==='wind'){const u=(now-AR.windT0)/arWindDur();if(u<0.45){lift=true;arm=-0.6-u;}else if(u<0.8){lift=false;arm=-1.6+(u-0.45)*2;}else{arm=-0.9+(u-0.8)*11;}}else if(ph==='flight'){const u=(now-AR.t0)/400;arm=u<1?1.3+u*0.7:2.0;}
 const hs=P?P.hs:(pa&&pa.p.throws==='左'?-1:1);const px=W/2+(P?-P.hs*6:0),py=feetY;const ph_=z.h*0.78;arFigure(g,px,py,ph_,cd,{arm,legLift:lift,flip:hs<0});
 const relX=px-hs*ph_*0.24,relY=py-ph_*0.72;
 /* ホームベース周りの土・バッターボックス */arBatterBox(g,z,PL,-1);arBatterBox(g,z,PL,1);
 g.fillStyle=PL.chalk;g.beginPath();g.moveTo(z.cx-z.w*0.2,z.cy+z.h*0.74);g.lineTo(z.cx+z.w*0.2,z.cy+z.h*0.74);g.lineTo(z.cx+z.w*0.2,z.cy+z.h*0.8);g.lineTo(z.cx,z.cy+z.h*0.86);g.lineTo(z.cx-z.w*0.2,z.cy+z.h*0.8);g.closePath();g.fill();
 /* ゾーン・配球 */arDrawZone(g,z,0.95);arDrawDots(g,8);
 /* 打者（手前） */const hand=pa&&(AR.mode!=='card'||ph!=='pre')?pa.bHand:(AR.preHand||'右');const bh=z.h*1.6;const bx=hand==='左'?z.cx+z.w*0.5+z.h*0.34:z.cx-z.w*0.5-z.h*0.34;let su=null;if(AR.swung&&AR.swingT){su=clamp((now-AR.swingT)/150,0,1);}arBatter(g,bx,z.cy+z.h*1.0,bh,cb,hand,su);
 /* 球審（捕手の後ろ・手前側） */{const ux=z.cx+(hand==='左'?1:-1)*z.w*0.22,uy=z.cy+z.h*1.42,uw=z.w*1.05,uh=z.h*0.62;g.save();g.globalAlpha=0.92;g.fillStyle='#262c34';g.beginPath();g.moveTo(ux-uw*0.5,uy+uh*0.4);g.quadraticCurveTo(ux-uw*0.52,uy-uh*0.55,ux-uw*0.2,uy-uh*0.66);g.lineTo(ux+uw*0.2,uy-uh*0.66);g.quadraticCurveTo(ux+uw*0.52,uy-uh*0.55,ux+uw*0.5,uy+uh*0.4);g.closePath();g.fill();g.fillStyle='#1b1f26';g.beginPath();g.arc(ux,uy-uh*0.78,uw*0.17,0,Math.PI*2);g.fill();g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.beginPath();g.arc(ux,uy-uh*0.78,uw*0.19,Math.PI*1.1,Math.PI*1.9);g.stroke();g.restore();}
 /* 捕手（手前・背中）とミット */const cs=def.lineup.find(x=>x.pos==='捕');arCatcher(g,z.cx,z.cy+z.h*1.22,z.w*0.8,cd,false,0.95,cs&&cs.p.number!=null?cs.p.number:2);
 const ballPos=u=>{const uu=Math.min(u,1);const bb=arBallAt(P,uu);const [ex,ey]=arZ2S(bb.x,bb.y);const e=Math.pow(uu,1.4);return [relX+(ex-relX)*e,relY+(ey-relY)*e,3.5+15*Math.pow(uu,1.4)];};
 const st=P&&(ph==='flight'||ph==='after')?arPitchState(now):null;
 let mitt=[z.cx-z.w*0.38,z.cy+z.h*0.62];let ballInMitt=false;
 if(st&&!st.hit&&st.u>0.85){const [fx,fy]=arZ2S(P.x,P.y);const k=clamp((st.u-0.85)/0.15,0,1);mitt=[mitt[0]+(fx-mitt[0])*k,mitt[1]+(fy-mitt[1])*k];ballInMitt=st.u>=1;}
 else if(ph==='after'&&AR.ev&&AR.ev.P&&!(AR.swung&&(AR.ev.kind==='inplay'||AR.ev.kind==='foul'))){const [fx,fy]=arZ2S(AR.ev.P.x,AR.ev.P.y);mitt=[fx,fy];ballInMitt=true;}
 arMitt(g,mitt[0],mitt[1],z.w*0.13);
 if(ballInMitt){arDrawBall(g,mitt[0],mitt[1]-2,z.w*0.06,0);if(st&&st.u<1.15){const k=(st.u-1)/0.15;g.strokeStyle='rgba(255,255,255,'+(0.8-k*0.8)+')';g.lineWidth=2;g.beginPath();g.arc(mitt[0],mitt[1],z.w*0.14+k*18,0,Math.PI*2);g.stroke();}}
 /* 到達点アシスト・球 */if(st&&ph==='flight'){const u=st.u;
  if(S.assist&&u>0.3&&!st.hit){const [ax,ay]=arZ2S(P.x,P.y);g.strokeStyle='rgba(255,230,120,.75)';g.lineWidth=1.5;g.beginPath();g.arc(ax,ay,9,0,Math.PI*2);g.stroke();}
  if(st.hit){const [cx0,cy0,r0]=ballPos(st.uc);const a=(st.c&&st.c.a)||0;const la=(st.c&&st.c.la)||15;let vx,vy,gr;if(st.foul){vx=(a>0?1:-1)*(st.tip?120:720);vy=st.tip?260:(la>40?-500:380);gr=st.tip?-30:20;}else{vx=Math.sin(a*Math.PI/180)*520;vy=-(260+Math.max(0,la)*9);gr=-50;}
   const x=cx0+vx*st.ts,y=cy0+vy*st.ts+(st.foul?0:200*st.ts*st.ts);const r=clamp(r0+gr*st.ts,2,24);if(st.ts<0.6)arDrawBall(g,x,y,r,now/40);arContactFx(g,cx0,cy0,st.ts,st.foul);}
  else if(u<1){const [x,y,r]=ballPos(u);if(u>0.3){const [px,py,pr]=ballPos(Math.max(0,u-0.05));g.globalAlpha=0.25;arDrawBall(g,px,py,pr*0.85,0);g.globalAlpha=1;}arDrawBall(g,x,y,r,now/110);}}
 else if(P&&ph==='wind'){const u=(now-AR.windT0)/arWindDur();if(u>0.7)arDrawBall(g,relX,relY,4,0);}
 /* ミートカーソル */if(pa&&AR.mode!=='card'&&(ph==='pre'||ph==='wind'||ph==='flight')){const be=pa.be||m.battingEff(pa.b,pa.p,pa.p.pit.pitches[0]||{name:'ストレート',velo:120,move:40,sharp:40,ctrl:40});let r=clamp(0.30+(be.meet-50)/330,0.12,0.5)*arEase().r;const t=AR.swingType;if(t==='power')r*=0.72;const rx=t==='bunt'?0.6:r*1.25,ry=t==='bunt'?0.42:r*0.85;const [cx,cy]=arZ2S(AR.cursor.x,AR.cursor.y);const sx=rx*z.w/2,sy=ry*z.h/2;
  g.save();g.strokeStyle=t==='power'?'#ff5a4a':t==='bunt'?'#ffd166':'#5ab0ff';g.fillStyle=t==='power'?'rgba(255,90,74,.2)':t==='bunt'?'rgba(255,209,102,.2)':'rgba(90,176,255,.2)';g.lineWidth=2;g.beginPath();g.ellipse(cx,cy,sx,sy,0,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.ellipse(cx,cy,sx*0.4,sy*0.4,0,0,Math.PI*2);g.stroke();g.restore();}
 /* スイングの風切り */if(AR.swung&&AR.swingT&&now>=AR.swingT&&now-AR.swingT<260&&AR.ev&&(AR.ev.kind==='miss'||AR.ev.kind==='kSwing')){const k=(now-AR.swingT)/260;arSwoosh(g,z.cx,z.cy+z.h*0.05,z.w*0.7,hand==='左'?-1:1,1-k);}
 if(ph==='pre'&&!AR.panel&&AR.mode==='card'){g.font='12px sans-serif';g.textAlign='center';g.fillStyle='rgba(255,255,255,.9)';g.fillText('下のカードで指示を出す（おまかせも可）',W/2,H-8);}
 else if(ph==='pre'&&!AR.panel){g.font='12px sans-serif';g.textAlign='center';g.fillStyle='rgba(255,255,255,.9)';g.fillText('画面を押すと投球開始。押したまま動かして狙い、離すとスイング',W/2,H-8);}}
/* ===== 投球（投手視点） ===== */
function arDrawPitcherView(now){const g=AR.g,W=AR.W,H=AR.H;const m=AR.m;const z=arZone();const PL=arPal();const def=m.def(),bat=m.bat();const cd=arTeamColors(def),cb=arTeamColors(bat);const P=AR.cur;const pa=m.pa;const ph=AR.phase;
 /* バックネット・スタンド */const sky=g.createLinearGradient(0,0,0,H*0.12);sky.addColorStop(0,PL.sky1);sky.addColorStop(1,PL.sky2);g.fillStyle=sky;g.fillRect(0,0,W,H*0.12);
 g.fillStyle=PL.stand1;g.fillRect(0,H*0.1,W,H*0.16);g.fillStyle=PL.stand2;for(let i=0;i<5;i++)g.fillRect(0,H*(0.112+i*0.028),W,H*0.011);
 g.save();g.globalAlpha=arNight()?0.5:0.75;for(const c of AR_CROWD){g.fillStyle=c.col;g.beginPath();g.arc(c.u*W,H*0.105+c.v*H*0.15,c.r*1.15,0,Math.PI*2);g.fill();}g.restore();
 g.strokeStyle=PL.net;g.lineWidth=1;for(let x=0;x<W;x+=14){g.beginPath();g.moveTo(x,H*0.1);g.lineTo(x,H*0.26);g.stroke();}for(let y=H*0.1;y<H*0.26;y+=14){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}
 g.fillStyle='#4a5560';g.fillRect(0,H*0.26,W,H*0.02);
 /* 芝と土 */g.fillStyle=PL.grass1;g.fillRect(0,H*0.28,W,H*0.72);g.fillStyle=PL.grass2;for(let i=0;i<5;i++)g.fillRect(0,H*(0.3+i*0.08),W,H*0.03);
 g.fillStyle=PL.dirt;g.beginPath();g.ellipse(W/2,z.cy+z.h*0.78,z.w*2.1,z.h*0.55,0,0,Math.PI*2);g.fill();
 g.fillStyle=PL.dirt;g.beginPath();g.ellipse(W/2,H*1.08,W*0.42,H*0.2,0,0,Math.PI*2);g.fill();g.fillStyle=PL.chalk;g.fillRect(W/2-18,H*0.955,36,4);
 /* バッターボックスと本塁 */arBatterBox(g,z,PL,-1);arBatterBox(g,z,PL,1);
 g.fillStyle=PL.chalk;g.beginPath();g.moveTo(z.cx-z.w*0.2,z.cy+z.h*0.66);g.lineTo(z.cx+z.w*0.2,z.cy+z.h*0.66);g.lineTo(z.cx+z.w*0.2,z.cy+z.h*0.72);g.lineTo(z.cx,z.cy+z.h*0.78);g.lineTo(z.cx-z.w*0.2,z.cy+z.h*0.72);g.closePath();g.fill();
 /* 審判（奥） */g.save();g.globalAlpha=0.9;g.fillStyle='#3a4046';g.beginPath();g.ellipse(z.cx,z.cy+z.h*0.92,z.w*0.42,z.h*0.34,0,0,Math.PI*2);g.fill();g.fillStyle='#2b3035';g.beginPath();g.arc(z.cx,z.cy+z.h*0.56,z.w*0.13,0,Math.PI*2);g.fill();g.restore();
 /* 打者 */const hand=pa&&(AR.mode!=='card'||ph!=='pre')?pa.bHand:(AR.preHand||'右');const bx=hand==='左'?z.cx-z.w*0.5-z.h*0.3:z.cx+z.w*0.5+z.h*0.3;let su=null;if(AR.swung&&AR.swingT)su=clamp((now-AR.swingT)/150,0,1);arBatter(g,bx,z.cy+z.h*1.02,z.h*1.42,cb,hand==='左'?'右':'左',su);
 /* 捕手（正面） */arCatcher(g,z.cx,z.cy+z.h*1.05,z.w*0.8,cd,true,1);
 const tgt=AR.target||{x:0,y:0.35};let [mx,my]=arZ2S(tgt.x,tgt.y);
 const stp=P&&(ph==='flight'||ph==='after')?arPitchState(now):null;let ballInMitt=false;
 if(stp&&!stp.hit&&stp.u>0.8){const [fx,fy]=arZ2S(P.x,P.y);const k=clamp((stp.u-0.8)/0.2,0,1);mx=mx+(fx-mx)*k;my=my+(fy-my)*k;ballInMitt=stp.u>=1;}
 else if(ph==='after'&&AR.ev&&AR.ev.P&&!(AR.swung&&(AR.ev.kind==='inplay'||AR.ev.kind==='foul'))){const [fx,fy]=arZ2S(AR.ev.P.x,AR.ev.P.y);mx=fx;my=fy;ballInMitt=true;}
 arDrawZone(g,z,0.9);arDrawDots(g,6);
 arMitt(g,mx,my,z.w*0.1);if(ballInMitt){arDrawBall(g,mx,my-1,z.w*0.045,0);if(stp&&stp.u<1.15){const k=(stp.u-1)/0.15;g.strokeStyle='rgba(255,255,255,'+(0.8-k*0.8)+')';g.lineWidth=2;g.beginPath();g.arc(mx,my,z.w*0.11+k*14,0,Math.PI*2);g.stroke();}}
 /* 狙い */if(AR.target&&(ph==='pre'||ph==='gauge'||ph==='wind')){g.strokeStyle='#ffd166';g.lineWidth=2;g.beginPath();g.arc(mx,my,10,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(mx-14,my);g.lineTo(mx+14,my);g.moveTo(mx,my-14);g.lineTo(mx,my+14);g.stroke();}
 /* 投手の腕と球（手前） */const hs=P?P.hs:(pa&&pa.p.throws==='左'?-1:1);const hx=W/2+hs*W*0.16,hy=H*0.9;
 g.strokeStyle=cd.base;g.lineWidth=22;g.lineCap='round';g.beginPath();g.moveTo(W/2+hs*W*0.34,H*1.02);g.lineTo(hx,hy+4);g.stroke();g.strokeStyle=cd.trim;g.lineWidth=2;g.beginPath();g.moveTo(W/2+hs*W*0.34,H*1.02);g.lineTo(hx,hy+4);g.stroke();g.fillStyle='#e7b48a';g.beginPath();g.arc(hx,hy,11,0,Math.PI*2);g.fill();
 const ballPos=u=>{const uu=Math.min(u,1);const bb=arBallAt(P,uu);const [ex,ey]=arZ2S(bb.x,bb.y);const e=1-Math.pow(1-uu,1.7);return [hx+(ex-hx)*e,hy+(ey-hy)*e,13-9.5*Math.pow(uu,0.7)];};
 if(stp&&ph==='flight'){const u=stp.u;
  if(stp.hit){const [cx0,cy0,r0]=ballPos(stp.uc);const a=(stp.c&&stp.c.a)||0;const la=(stp.c&&stp.c.la)||15;let vx,vy,gr;if(stp.foul){vx=(a>0?-1:1)*(stp.tip?60:420);vy=stp.tip?-120:(la>40?-420:-200);gr=-8;}else{vx=-Math.sin(a*Math.PI/180)*700;vy=(la<8?520:la<25?260:-120)+40;gr=la<25?28:10;}
   const x=cx0+vx*stp.ts,y=cy0+vy*stp.ts+(stp.foul?0:(la>=25?500*stp.ts*stp.ts:0));const r=clamp(r0+gr*stp.ts,2,26);if(stp.ts<0.6)arDrawBall(g,x,y,r,now/40);arContactFx(g,cx0,cy0,stp.ts,stp.foul);}
  else if(u<1){const [x,y,r]=ballPos(u);arDrawBall(g,x,y,r,now/100);}}
 else if(ph==='wind'){const u=(now-AR.windT0)/arWindDur();arDrawBall(g,hx-hs*u*18,hy-u*26,13,0);}
 else if(ph==='gauge'||ph==='pre')arDrawBall(g,hx,hy-4,13,0);
 if(AR.swung&&AR.swingT&&now>=AR.swingT&&now-AR.swingT<260&&AR.ev&&(AR.ev.kind==='miss'||AR.ev.kind==='kSwing')){const k=(now-AR.swingT)/260;arSwoosh(g,z.cx,z.cy+z.h*0.1,z.w*0.6,hand==='左'?1:-1,1-k);}
 if(ph==='pre'){g.font='12px sans-serif';g.textAlign='center';g.fillStyle='rgba(255,255,255,.9)';g.fillText(AR.mode==='card'?'下のカードで投球の指示を出す':'ドラッグで狙いを動かす → タップで開始 → もう一度タップでリリース',W/2,H-8);}}
/* ---- HTML部分の描画 ---- */
function arRenderAll(){arRenderTop();arRenderInfo();arRenderCtl();arRenderFoot();}
function arRenderTop(){const m=AR.m;const s=m.situation();const pa=m.pa;const live=pa&&!(AR.mode==='card'&&AR.phase==='pre');const bb=live?pa.balls:0,ss=live?pa.strikes:0;
 const lamps=(n,on,cls)=>Array.from({length:n},(_,i)=>`<i class="${i<on?'on '+cls:''}"></i>`).join('');
 const dmn=m.def().demon&&m.def().demon.inn===m.inn&&m.def().demon.top===m.top;const ca=arTeamColors(m.A),cb=arTeamColors(m.B);
 const team=(t,c,sc,bat)=>`<div class="sbt ${bat?'bat':''}" title="${esc(t.name)}"><i style="background:${c.trim};border-color:${c.base}"></i><span class="tn">${esc(arAbbr(t.name))}</span><b>${sc}</b></div>`;
 $('#artop').innerHTML=`<div class="sb">${team(m.A,ca,m.score[0],m.top)}${team(m.B,cb,m.score[1],!m.top)}</div><div class="ar-inn"><span class="arw">${s.top?'▲':'▼'}</span>${s.inn}${dmn?'<span title="魔物">👹</span>':''}</div><div class="ar-cnt"><span>B${lamps(3,bb,'b')}</span><span>S${lamps(2,ss,'s')}</span><span>O${lamps(2,m.outs,'o')}</span></div><div class="diamond sm"><i class="b2 ${m.bases[1]?'on':''}"></i><i class="b3 ${m.bases[2]?'on':''}"></i><i class="b1 ${m.bases[0]?'on':''}"></i></div><button class="btn sm ghost ar-x" data-act="arMenu">≡</button>`;if(r3on())r3UpdateBoard();}
function arStam(d,p){const cap=AR.m.pitchCap(p);const pc=d.pc[p.id]||0;return clamp(1-pc/(cap*1.6),0,1);}
function arRenderInfo(){const m=AR.m;if(AR.mode==='card'){cdRenderInfo();return;}const pa=m.pa;if(!pa){$('#arinfo').innerHTML='';return;}const t=m.bat(),d=m.def();const b=pa.b,p=pa.p;const bs=bst(t,b),ps=pst(d,p);const st=arStam(d,p);
 const bl=`<div class="ar-line"><span class="tag">${AR.side==='bat'?'打者':'相手'}</span><b>${t.batIdx+1}番 ${esc(b.name)}</b><span class="muted">${b.bats}打</span><span>ミ${rk((b.bat.meetR+b.bat.meetL)/2)} パ${rk((b.bat.powR+b.bat.powL)/2)} 走${rk(b.bat.speed)} 眼${rk(b.bat.eye)}</span><span class="muted">今日 ${bs.ab}-${bs.h}${bs.hr?' 本'+bs.hr:''}${bs.bb?' 四'+bs.bb:''}</span></div>`;
 const pl=`<div class="ar-line"><span class="tag">${AR.side==='pit'?'投手':'相手'}</span><b>${esc(p.name)}</b><span class="muted">${p.throws}投</span><span>${Math.round(p.pit.velo)}km 制${rk(p.pit.pitches[0]?p.pit.pitches[0].ctrl:50)} 変${rk(pitchQ(p))}</span><span class="muted">${ps.np}球</span><span class="stam" title="スタミナ"><i style="width:${Math.round(st*100)}%" class="${st<0.3?'bad':st<0.55?'warn':''}"></i></span></div>`;
 $('#arinfo').innerHTML=AR.side==='bat'?`${bl}${pl}`:`${pl}${bl}`;}
function arRenderFoot(){const f=$('#arfoot');if(!f)return;f.innerHTML=`<span>${esc(AR.foot||'')}</span>`;}
function arRenderCtl(){const m=AR.m;const el=$('#arctl');if(!el)return;if(AR.mode==='card'){cdRenderCtl();return;}el.classList.remove('card');const pa=m.pa;const ph=AR.phase;
 const sh=$('#arsheet');if(sh){if(AR.panel){sh.hidden=false;sh.style.top=($('#artop')?$('#artop').offsetHeight:44)+'px';sh.innerHTML=AR.panel;}else{sh.hidden=true;sh.innerHTML='';}}
 if(ph==='decide'&&AR.pending){const dc=AR.pending.decision;
  if(dc.kind==='throw'){el.innerHTML=`<div class="ar-dec"><div class="q">${esc(dc.label)}</div><div class="dec thr">${dc.options.map(o=>`<button class="btn tb ${o.t===dc.rec?'primary':''}" data-act="arDecide" data-t="${o.t}"><b>${esc(o.label)}</b><small>${esc(o.sub)}</small><em>${Math.round(o.ok*100)}%</em></button>`).join('')}</div></div>`;return;}
  el.innerHTML=`<div class="ar-dec"><div class="q">${esc(dc.label)}<span class="tiny muted">　成功率 約${Math.round(dc.ok*100)}%</span></div><div class="dec">${b('突入！','arDecide',{v:1},'primary')}${b('自重する','arDecide',{v:0},'')}</div></div>`;return;}
 if(ph==='half'){el.innerHTML=`<div class="dec">${b('続ける','arBannerNext',{},'primary big')}</div>`;return;}
 if(ph==='intro'){el.innerHTML=`<div class="row"><b class="small">試合前紹介</b><span class="tiny muted">相手の注目選手（タップで次へ）</span>${b('スキップ','arIntroSkip',{},'sm')}</div>`;return;}
 if(ph==='replay'){el.innerHTML=`<div class="row"><b class="small">スローリプレイ</b><span class="tiny muted">タップでスキップ</span></div>`;return;}
 if(!pa||pa.done){el.innerHTML='';return;}
 const t=m.bat(),d=m.def();
 if(AR.side==='bat'){
  const B=m.bases;const canSteal=(B[0]&&!B[1])||(B[1]&&!B[2]);const canHR=B[0]&&!B[1]&&m.outs<2;const canSq=B[2]&&m.outs<2;const canBunt=(B[0]||B[1])&&m.outs<2;
  const seg=['meet','power','bunt'].map(k=>`<button class="btn sm ${AR.swingType===k?'primary':''}" data-act="arSwingType" data-k="${k}">${k==='meet'?'ミート':k==='power'?'強振':'バント'}</button>`).join('');
  const cmds=`${canSteal?b(pa.cmd==='steal'?'盗塁 ✓':'盗塁','arCmd',{c:'steal'},'sm '+(pa.cmd==='steal'?'primary':'')):''}${canHR?b(pa.cmd==='hitrun'?'エンドラン ✓':'エンドラン','arCmd',{c:'hitrun'},'sm '+(pa.cmd==='hitrun'?'primary':'')):''}${canSq?b(pa.cmd==='squeeze'?'スクイズ ✓':'スクイズ','arCmd',{c:'squeeze'},'sm '+(pa.cmd==='squeeze'?'primary':'')):''}${t.bench.some(x=>!isPitcher(x))&&pa.n===0?b('代打','arPinchList',{},'sm'):''}${B.some(Boolean)&&t.bench.length?b('代走','arPinchRunList',{},'sm'):''}`;
  const go=ph==='pre'?b('投球 ▶','arThrow',{},'primary go'):`<span class="tiny muted">${ph==='wind'?'投手が振りかぶる…':ph==='flight'?(AR.swung?'':(AR.hold?'離すとスイング！':'タイミングを合わせてタップ！')):''}</span>`;
  el.innerHTML=`<div class="ar-row"><span class="lbl">打ち方</span>${seg}<span class="sp"></span>${go}</div><div class="ar-row scroll"><span class="lbl">作戦</span>${cmds||'<span class="tiny muted">走者なし</span>'}</div><div class="tiny muted">${AR.swingType==='power'?'強振：カーソルが小さい代わりに飛距離が出る':AR.swingType==='bunt'?'バント：転がす（送り／セーフティ）':'ミート：カーソルが大きく確実に当てる'}　／　画面を押して投球→離してスイング（押し続けると見逃し）</div>`;}
 else{
  const ps=p_pitches(pa.p);const sign=AR.sign;
  const pbtn=ps.map((x,i)=>`<button class="btn sm pt ${AR.pitchSel===i?'primary':''}" data-act="arPitchSel" data-i="${i}">${sign&&sign.idx===i?'◎':''}${esc(x.name)}<small>${Math.round(x.velo)}km 変${letter(x.move)} 制${letter(x.ctrl)}</small></button>`).join('');
  const S=actionSettings();const meter=S.meter==='meter';
  const pw=meter?`<span class="tiny muted">パワー・精度はメーターで決める</span>`:['normal','max','ease'].map(k=>`<button class="btn sm ${AR.power===k?'primary':''}" data-act="arPower" data-k="${k}">${k==='max'?'全力':k==='ease'?'抜く':'通常'}</button>`).join('');
  const B=m.bases;const canPick=(B[0]&&!B[1])||(B[1]&&!B[2]);
  const dcmd=`${b(d.infieldIn?'前進守備 ✓':'前進守備','arShift',{k:'in'},'sm '+(d.infieldIn?'primary':''))}${b(d.ofDeep?'外野深め ✓':'外野深め','arShift',{k:'deep'},'sm '+(d.ofDeep?'primary':''))}${b(d.ofIn?'外野前進 ✓':'外野前進','arShift',{k:'ofin'},'sm '+(d.ofIn?'primary':''))}${B[1]&&!B[0]||B[2]&&!B[0]?b('敬遠','arIbb',{},'sm'):''}${canPick?b('ピッチアウト','arPitchout',{},'sm')+b('牽制','arPickoff',{},'sm'):''}${d.bench.some(x=>isPitcher(x)||x.sub.includes('投'))?b('投手交代','arChangeList',{},'sm'):''}${d.mound<3?b('タイム('+(3-d.mound)+')','arTimeout',{},'sm'):''}`;
  const sel=ps[Math.min(AR.pitchSel,ps.length-1)];
  const gh=ph==='gauge'?(AR.gauge&&AR.gauge.stage==='pw'?'<span class="tiny" style="color:var(--gold)">① パワー：上がりきる前にタップ（赤はオーバー）</span>':AR.gauge&&AR.gauge.mode==='simple'?'<span class="tiny" style="color:var(--accent2)">緑の中央でもう一度タップ！</span>':'<span class="tiny" style="color:var(--accent2)">② 精度：緑の線でタップ！</span>'):'';
  el.innerHTML=`<div class="ar-row pts scroll">${pbtn}</div><div class="ar-row"><span class="lbl">力</span>${pw}<span class="sp"></span>${ph==='pre'?`${b('サイン通り','arAutoPitch',{},'sm')}${b('投球 ▶','arThrowBtn',{},'primary go')}`:gh}</div><div class="ar-row scroll"><span class="lbl">守備</span>${dcmd}</div><div class="tiny muted">${sign?`捕手のサイン：${esc(sign.pitch.name)}・${zoneLabel(sign.tx,sign.ty,pa.bHand)}`:''}${!meter&&AR.power==='max'?'　全力：+2km/h 制球↓':!meter&&AR.power==='ease'?'　抜く：-4km/h 制球↑':''}</div>`;}}
function p_pitches(p){return p.pit.pitches.length?p.pit.pitches:[{name:'ストレート',velo:p.pit.velo,move:40,sharp:40,ctrl:40}];}
/* ---- ボタン操作 ---- */
ACT.arSwingType=d=>{AR.swingType=d.k;arSound('ui');arRenderCtl();};
ACT.arCmd=d=>{const pa=AR.m.pa;if(!pa)return;pa.cmd=pa.cmd===d.c?null:d.c;if(pa.cmd==='squeeze')AR.swingType='bunt';arSound('ui');arRenderCtl();};
ACT.arThrow=()=>{AR.holdStart=false;arThrowCpu();};
ACT.arPitchSel=d=>{AR.pitchSel=parseInt(d.i);arSound('ui');arRenderCtl();};
ACT.arPower=d=>{AR.power=d.k;arRenderCtl();};
ACT.arThrowBtn=()=>{if(AR.phase!=='pre')return;if(!AR.target)AR.target=arDefaultTarget();if(actionSettings().meter!=="none")arStartGauge();else arThrowUser(null);};
ACT.arAutoPitch=()=>{if(AR.phase!=='pre')return;const s=AR.sign||AR.m.cpuPitchInput();AR.target={x:s.tx,y:s.ty};AR.pitchSel=s.idx!=null?s.idx:Math.max(0,p_pitches(AR.m.pa.p).indexOf(s.pitch));AR.power=s.power;arThrowUser(null);};
ACT.arShift=d=>{const m=AR.m;const t=m.def();if(d.k==='in'){t.infieldIn=!t.infieldIn;m.addLog(t.infieldIn?'前進守備を敷く':'守備位置を戻す','note');}else if(d.k==='deep'){t.ofDeep=!t.ofDeep;if(t.ofDeep)t.ofIn=false;}else{t.ofIn=!t.ofIn;if(t.ofIn)t.ofDeep=false;}arSound('ui');arRenderCtl();};
ACT.arIbb=()=>{const m=AR.m;if(AR.phase!=='pre')return;const ev=m.paIbb();arShowResult(ev);};
ACT.arPitchout=()=>{if(AR.phase!=='pre')return;AR.target={x:0,y:0};arThrowUser(null,{pitchout:true});};
ACT.arPickoff=()=>{const m=AR.m;if(AR.phase!=='pre')return;const r=m.pickoff();AR.foot=r.text;if(r.kind==='none'){arRenderAll();return;}arSound('mitt');AR.ev=r;r.runShown=true;AR.cam=null;const sc=fwBuildRunnerScene(r.runPlay);sc.ev=r;AR.field=sc;AR.panel=null;arSetPhase('field');arRenderAll();};
ACT.arTimeout=()=>{const m=AR.m;if(!m.timeout(m.def())){toast('タイムはもう取れません');return;}AR.foot='タイム：マウンドに集まり落ち着いた（制球・疲労が一時回復）';arRenderAll();};
ACT.arBannerNext=()=>{arAfterBanner();};
ACT.arPanelClose=()=>{AR.panel=null;arRenderCtl();};
ACT.arPinchList=()=>{const m=AR.m;const t=m.bat();AR.panel=`<div class="ar-panel"><b class="small">代打を選択</b><div class="wrap">${t.bench.filter(p=>!isPitcher(p)).map(p=>b(esc(p.name)+' '+p.pos+' '+letter(batRating(p)),'arPinch',{id:p.id},'sm')).join('')}${b('やめる','arPanelClose',{},'sm ghost')}</div></div>`;arRenderCtl();};
ACT.arPinch=d=>{const m=AR.m;const t=m.bat();const np=t.bench.find(p=>p.id==d.id);if(!np)return;m.pinchHit(t,t.batIdx,np);m.paRefresh();AR.panel=null;AR.foot=`代打 ${np.name}`;arRenderAll();};
ACT.arPinchRunList=()=>{const m=AR.m;const t=m.bat();const bases=[0,1,2].filter(i=>m.bases[i]);AR.panel=`<div class="ar-panel"><b class="small">代走：塁と選手を選択</b>${bases.map(i=>`<div class="wrap" style="margin:4px 0"><span class="small">${['一','二','三'][i]}塁 ${esc(m.bases[i].name)} →</span>${t.bench.filter(p=>!isPitcher(p)).map(p=>b(esc(p.name)+' 走'+letter(p.bat.speed),'arPinchRun',{id:p.id,base:i},'sm')).join('')}</div>`).join('')}${b('やめる','arPanelClose',{},'sm ghost')}</div>`;arRenderCtl();};
ACT.arPinchRun=d=>{const m=AR.m;const t=m.bat();const np=t.bench.find(p=>p.id==d.id);if(!np)return;m.pinchRun(t,parseInt(d.base),np);AR.panel=null;AR.foot=`代走 ${np.name}`;arRenderAll();};
ACT.arChangeList=()=>{const m=AR.m;const t=m.def();const rel=t.bench.filter(p=>isPitcher(p)||p.sub.includes('投'));AR.panel=`<div class="ar-panel"><b class="small">リリーフを選択</b><div class="wrap">${rel.map(p=>b(esc(p.name)+' '+letter(pitRating(p))+' '+Math.round(p.pit.velo)+'km 疲'+Math.round(p.fatigue),'arChange',{id:p.id},'sm')).join('')}${b('やめる','arPanelClose',{},'sm ghost')}</div></div>`;arRenderCtl();};
ACT.arChange=d=>{const m=AR.m;const t=m.def();const np=t.bench.find(p=>p.id==d.id);if(!np)return;m.changePitcher(t,np);m.paRefresh();AR.panel=null;AR.pitchSel=0;AR.target=null;AR.sign=m.cpuPitchInput();AR.sign.idx=Math.max(0,p_pitches(np).indexOf(AR.sign.pitch));AR.foot=`投手交代 ${np.name}`;arRenderAll();};
ACT.arMenu=()=>{if(AR.mode==='card'){cdMenu();return;}const S=actionSettings();AR.panel=`<div class="ar-panel"><b class="small">メニュー</b><div class="wrap" style="margin:6px 0">${b('この打席おまかせ','arAutoPA',{},'sm')}${b('この回おまかせ','arAutoInn',{},'sm')}${b('最後までおまかせ','arAutoEnd',{},'sm danger')}</div><div class="grid2 small"><label class="f">球の速さ<select data-chg="arSet" data-k="speed"><option value="1.3"${S.speed==1.3?' selected':''}>ゆっくり</option><option value="1"${S.speed==1?' selected':''}>普通</option><option value="0.8"${S.speed==0.8?' selected':''}>速い</option></select></label><label class="f">投球の操作<select data-chg="arSet" data-k="meter"><option value="simple"${S.meter==='simple'?' selected':''}>2回押し（開始→リリース）</option><option value="meter"${S.meter==='meter'?' selected':''}>3回押し（開始→パワー→精度）</option><option value="none"${S.meter==='none'?' selected':''}>1回押し（制球は能力任せ）</option></select></label><label class="f">打撃の難易度<select data-chg="arSet" data-k="batEase"><option value="easy"${S.batEase==='easy'?' selected':''}>やさしい（ヒットゾーン大）</option><option value="normal"${S.batEase==='normal'?' selected':''}>ふつう</option><option value="hard"${S.batEase==='hard'?' selected':''}>むずかしい</option></select></label><label class="f">走塁の判断<select data-chg="arSet" data-k="run"><option value="manual"${S.run==='manual'?' selected':''}>自分で決める</option><option value="auto"${S.run==='auto'?' selected':''}>自動</option></select></label><label class="f">守備の送球先<select data-chg="arSet" data-k="defThrow"><option value="1"${S.defThrow?' selected':''}>自分で選ぶ</option><option value="0"${!S.defThrow?' selected':''}>自動</option></select></label><label class="f">本塁打リプレイ<select data-chg="arSet" data-k="replay"><option value="1"${S.replay?' selected':''}>見る</option><option value="0"${!S.replay?' selected':''}>省略</option></select></label><label class="f">選手カード表示<select data-chg="arSet" data-k="lower"><option value="1"${S.lower?' selected':''}>打席ごとに出す</option><option value="0"${!S.lower?' selected':''}>出さない</option></select></label><label class="f">画面表示<select data-chg="arSet" data-k="view3d"><option value="1"${S.view3d?' selected':''}>3D</option><option value="0"${!S.view3d?' selected':''}>2D（軽量）</option></select></label><label class="f">選手モデル<select data-chg="arSet" data-k="model3d"><option value="real"${S.model3d==='real'?' selected':''}>リアル体型</option><option value="chibi"${S.model3d==='chibi'?' selected':''}>パワプロ風（2頭身）</option></select></label><label class="f">試合前カットイン<select data-chg="arSet" data-k="intro"><option value="1"${S.intro!==false?' selected':''}>あり</option><option value="0"${S.intro===false?' selected':''}>なし</option></select></label><label class="f">3Dカメラ<select data-chg="arSet" data-k="cam3d"><option value="std"${S.cam3d==='std'?' selected':''}>標準</option><option value="zoom"${S.cam3d==='zoom'?' selected':''}>投球ズーム</option><option value="wide"${S.cam3d==='wide'?' selected':''}>打席を引きで</option></select></label><label class="f">到達点アシスト<select data-chg="arSet" data-k="assist"><option value="0"${!S.assist?' selected':''}>なし</option><option value="1"${S.assist?' selected':''}>表示する</option></select></label><label class="f">効果音<select data-chg="arSet" data-k="sound"><option value="1"${S.sound?' selected':''}>あり</option><option value="0"${!S.sound?' selected':''}>なし</option></select></label><label class="f">打撃時の投球<select data-chg="arSet" data-k="autoThrow"><option value="0"${!S.autoThrow?' selected':''}>ボタンで開始</option><option value="1"${S.autoThrow?' selected':''}>自動で投げてくる</option></select></label></div><div class="wrap" style="margin-top:6px">${b('試合経過を見る','arLog',{},'sm')}${b('閉じる','arPanelClose',{},'sm primary')}</div></div>`;arRenderCtl();};
CHG.arSet=(d,el)=>{const S=actionSettings();const v=el.value;if(d.k==='speed'){S.speed=parseFloat(v);AR.speed=S.speed;}else if(d.k==='run'||d.k==='cardAnim'||d.k==='meter'||d.k==='cam3d'||d.k==='batEase'||d.k==='model3d')S[d.k]=v;else S[d.k]=v==='1';if(d.k==='meter')S.gauge=v!=='none';if(d.k==='defThrow'&&AR.m)AR.m.askDef=S.pit&&S.defThrow;if(d.k==='view3d')arApplyView();if(d.k==='model3d'&&typeof r3RebuildRigs==='function')try{r3RebuildRigs();}catch(e){console.warn(e);}saveGame();};
function arApplyView(){const S=actionSettings();const st=$('#arstage');if(!st)return;if(S.view3d&&!r3on()&&typeof r3Start==='function'){if(!r3Start(st))toast('この端末では3D表示を使えません');}else if(!S.view3d&&r3on())r3Stop();arResize();}
/* 3D時のHUD（2Dキャンバスにゾーン・カーソル・吹き出しだけを描く） */
function arDrawHud3d(now){const g=AR.g,W=AR.W,H=AR.H;const ph=AR.phase;const m=AR.m;
 if(ph==='replay'&&AR.replay&&AR.field){const rp=AR.replay;const t=Math.min(rp.until,rp.from+(now-rp.t0)*rp.rate);fwDrawScene(now,t);g.fillStyle='rgba(0,0,0,.85)';g.fillRect(0,0,W,H*0.07);g.fillRect(0,H*0.93,W,H*0.07);return;}
 if(ph==='field'||ph==='decide'||(ph==='after'&&AR.field&&AR.ev&&(AR.ev.kind==='inplay'||AR.ev.runShown||/^pickoff/.test(AR.ev.kind)))){fwDrawScene(now);return;}
 if(ph==='intro'){arDrawIntro(now);return;}
 if(ph==='half'){if(AR.bannerEl!==AR.banner){AR.bannerEl=AR.banner;arOverlayHtml(arBannerHtml());}return;}
 if(ph==='sim'||ph==='idle')return;
 const pa=m.pa;const P=AR.cur;const S=actionSettings();const z=arZone();const bat=AR.side==='bat';
 if(R3.lastPhaseReact)return;/* リアクションカメラ中はゾーン等を描かない */
 r3DrawZone(g,bat?0.85:0.95);arDrawDots(g,bat?8:Math.max(4,Math.round(z.w*0.1)));
 const st=P&&(ph==='flight'||ph==='after')?arPitchState(now):null;
 if(st&&ph==='flight'&&!st.hit&&S.assist&&bat&&st.u>0.3){const [ax,ay]=arZ2S(P.x,P.y);g.strokeStyle='rgba(255,230,120,.75)';g.lineWidth=1.5;g.beginPath();g.arc(ax,ay,9,0,Math.PI*2);g.stroke();}
 if(st&&st.hit){const [cx0,cy0]=arZ2S(P.x,P.y);arContactFx(g,cx0,cy0,st.ts,st.foul);}
 if(pa&&AR.mode!=='card'&&bat&&(ph==='pre'||ph==='wind'||ph==='flight')){const be=pa.be||m.battingEff(pa.b,pa.p,pa.p.pit.pitches[0]||{name:'ストレート',velo:120,move:40,sharp:40,ctrl:40});let r=clamp(0.30+(be.meet-50)/330,0.12,0.5)*arEase().r;const t=AR.swingType;if(t==='power')r*=0.72;const rx=t==='bunt'?0.6:r*1.25,ry=t==='bunt'?0.42:r*0.85;const [cx,cy]=arZ2S(AR.cursor.x,AR.cursor.y);const sx=rx*z.w/2,sy=ry*z.h/2;
  g.save();g.strokeStyle=t==='power'?'#ff5a4a':t==='bunt'?'#ffd166':'#5ab0ff';g.fillStyle=t==='power'?'rgba(255,90,74,.2)':t==='bunt'?'rgba(255,209,102,.2)':'rgba(90,176,255,.2)';g.lineWidth=2;g.beginPath();g.ellipse(cx,cy,sx,sy,0,0,Math.PI*2);g.fill();g.stroke();g.beginPath();g.ellipse(cx,cy,sx*0.4,sy*0.4,0,0,Math.PI*2);g.stroke();g.restore();}
 if(!bat&&AR.target&&(ph==='pre'||ph==='gauge'||ph==='wind')){const [mx,my]=arZ2S(AR.target.x,AR.target.y);g.strokeStyle='#ffd166';g.lineWidth=2;g.beginPath();g.arc(mx,my,Math.max(7,z.w*0.16),0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(mx-14,my);g.lineTo(mx+14,my);g.moveTo(mx,my-14);g.lineTo(mx,my+14);g.stroke();}
 if(AR.swung&&AR.swingT&&now>=AR.swingT&&now-AR.swingT<260&&AR.ev&&(AR.ev.kind==='miss'||AR.ev.kind==='kSwing')){const k=(now-AR.swingT)/260;const hand=pa?pa.bHand:'右';arSwoosh(g,z.cx,z.cy+z.h*0.05,z.w*0.9,(hand==='左')===bat?-1:1,1-k);}
 if(ph==='pre'&&!AR.panel){g.font='12px sans-serif';g.textAlign='center';g.fillStyle='rgba(255,255,255,.9)';g.shadowColor='#000';g.shadowBlur=4;const txt=AR.mode==='card'?(bat?'下のカードで指示を出す（おまかせも可）':'下のカードで投球の指示を出す'):bat?'画面を押すと投球開始。押したまま動かして狙い、離すとスイング':'ドラッグで狙いを動かす → タップで開始 → もう一度タップでリリース';g.fillText(txt,W/2,H-8);g.shadowBlur=0;}}
ACT.arLog=()=>{const m=AR.m;AR.panel=`<div class="ar-panel"><b class="small">試合経過</b>${logHtml(m.log,60)}<div style="margin-top:6px">${b('閉じる','arPanelClose',{},'sm primary')}</div></div>`;arRenderCtl();const lg=$('#mlog');if(lg)lg.scrollTop=lg.scrollHeight;};
function arAbortPA(){const m=AR.m;if(m.pa&&!m.pa.done){if(m.pending){m.finishInplay(null);}else m.cpuFinishPA();}AR.pending=null;}
ACT.arAutoPA=()=>{const m=AR.m;const inn=m.inn,top=m.top;arAbortPA();AR.panel=null;const last=m.log[m.log.length-1];AR.foot=last?last.text:'';arOverlay('','');if(m.done||m.inn!==inn||m.top!==top){arBanner();return;}arNextPA();};
ACT.arAutoInn=()=>{const m=AR.m;arAbortPA();AR.panel=null;const inn=m.inn,top=m.top;const from=m.log.length;let g=0;while(!m.done&&g++<200&&m.inn===inn&&m.top===top)m.step();const lines=m.log.slice(from).filter(l=>l.kind!=='inn').map(l=>l.text);AR.banner={title:`${inn}回${top?'表':'裏'}（おまかせ）`,lines,until:0,wait:true};arSetPhase('half');arRenderAll();};
ACT.arAutoEnd=()=>{const m=AR.m;arAbortPA();AR.panel=null;let g=0;while(!m.done&&g++<3000)m.step();arFinish();};
Match.prototype.paRefresh=function(){const pa=this.pa;if(!pa)return;const t=this.bat(),d=this.def();const slot=t.lineup[t.batIdx];pa.b=slot.p;pa.p=d.pitcher;pa.bHand=pa.b.bats==='両'?(pa.p.throws==='右'?'左':'右'):pa.b.bats;};
