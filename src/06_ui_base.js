/* ================= セーブ ================= */
const SAVE_KEY='hsb_save_v1';
function serialize(){return JSON.stringify(G);}
function saveGame(){try{localStorage.setItem(SAVE_KEY,serialize());}catch(e){}}
function loadGame(){try{const s=localStorage.getItem(SAVE_KEY);if(!s)return false;const g=JSON.parse(s);if(!g||!g.players)return false;G=g;migrate();return true;}catch(e){return false;}}
function hasSave(){try{return !!localStorage.getItem(SAVE_KEY);}catch(e){return false;}}
function migrate(){G.settings=G.settings||{mode:'card'};if(!G.stars){try{applyEliteSchools();refreshStars(true);}catch(e){console.warn(e);}}if(G.settings.mode==='action'&&!G.settings.keepAction){G.settings.mode='card';}G.tourneyLog=G.tourneyLog||[];G.uniform=G.uniform||defaultUniform();G.emblem=G.emblem||defaultEmblem();G.u18Log=G.u18Log||[];G.notices=G.notices||[];G.coachMarket=G.coachMarket||[];G.scoutMarket=G.scoutMarket||[];G.mode=G.mode||'normal';G.gameOver=!!G.gameOver;
 if(G.fac&&G.fac.analysis){G.fac.video=G.fac.analysis;delete G.fac.analysis;}
 for(const k in G.fac){if(!FAC[k]){delete G.fac[k];continue;}const f=G.fac[k];if(f.model>=FAC[k].models.length)f.model=FAC[k].models.length-1;}
 if(G.coach&&!G.coach.style){G.coach.style=pick(COACH_STYLES).id;G.coach.bio=G.coach.bio||(G.coach.type==='教師'?'学校の先生':'外部招へい');G.coach.career=G.coach.career||'';}
 if(G.scout&&!SCOUT_SPECS.some(x=>x.id===G.scout.spec))G.scout.spec=pick(SCOUT_SPECS).id;
 (G.coachMarket||[]).forEach(c=>{if(!c.style)c.style=pick(COACH_STYLES).id;if(!c.career)c.career='';});
 (G.scoutMarket||[]).forEach(c=>{if(!SCOUT_SPECS.some(x=>x.id===c.spec))c.spec=pick(SCOUT_SPECS).id;if(!c.career)c.career='';});
 G.players.forEach(p=>{if(TRAIN[p.training]&&TRAIN[p.training].facReq)p.training='bat';if(p.maxVelo==null)p.maxVelo=0;if(!p.persona)p.persona=pickPersona();if(!p.pitForm)p.pitForm=pickPitForm();if(p.trust==null)p.trust=clamp(Math.round(gauss(38,12)+(p.grade-1)*12),5,90);if(p.noise&&p.noise.pot==null)p.noise.pot=gauss(0,1);p.abilities=(p.abilities||[]).filter(a=>ABIL[a]);p.unique=(p.unique||[]).filter(a=>ABIL[a]);});
 G.records=G.records||{};G.candidatesAll=G.candidatesAll||G.candidates||[];
 for(const c of G.candidatesAll){if(!c.player){c.player=genPlayer({grade:1,q:c.q,pos:c.pos,scouted:true,rank:c.rank,title:c.title,hometown:c.pref,uniqProb:0});if(c.unique)c.player.unique=[c.unique];c.player.name=c.name;c.pid=c.player.id;c.potential=c.player.potential;c.growth=c.player.growth;}}
 G.graduates.forEach(g=>{if(!g.career)g.career=blankStats();});}
/* ================= DOM ================= */
const UI={tab:'home',sub:{},modal:false,lock:false,match:null,lineupCtx:null,moreTab:'news',playersFilter:'all',newsCat:'all',scoutFilter:'open',toastT:null};
const $=s=>document.querySelector(s);
const ACT={},CHG={},INP={};
function b(label,act,params,cls){let a='';for(const k in (params||{}))a+=` data-${k}="${esc(params[k])}"`;return `<button class="btn ${cls||''}" data-act="${act}"${a}>${label}</button>`;}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.hidden=false;clearTimeout(UI.toastT);UI.toastT=setTimeout(()=>{t.hidden=true;},2600);}
function openModal(html,lock){UI.modal=true;UI.lock=!!lock;const ov=$('#overlay');ov.hidden=false;$('#modal').innerHTML=(lock?'':`<button class="btn sm ghost x" data-act="closeModal" aria-label="閉じる">✕</button>`)+html;$('#modal').scrollTop=0;}
function closeModal(){UI.modal=false;UI.lock=false;$('#overlay').hidden=true;$('#modal').innerHTML='';}
ACT.closeModal=()=>{if(UI.lock)return;closeModal();render();};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f){e.preventDefault();f(el.dataset,el);}});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(!el)return;const f=CHG[el.dataset.chg];if(f)f(el.dataset,el);});
document.addEventListener('input',e=>{const el=e.target.closest('[data-inp]');if(!el)return;const f=INP[el.dataset.inp];if(f)f(el.dataset,el);});
document.addEventListener('click',e=>{if(e.target.id==='overlay'&&!UI.lock){closeModal();render();}});
function rk(v){const l=typeof v==='string'?v[0]:letter(v);return `<span class="rk rk-${l}">${typeof v==='string'?esc(v):l}</span>`;}
/* 総合ランク（厳しい基準） */function rkR(p){const l=ratingRank(p);return `<span class="rk rk-${l}">${l}</span>`;}
/* ---- レーダーチャート（能力の見える化） ----
 axes:[{l:ラベル,v:0-100,s:補足}] / opts.exact で霧（未判明ノイズ）なしの実値 */
const RK_COL={S:'#d4a017',A:'#d2452f',B:'#e07a2a',C:'#2f8a4f',D:'#3673b8',E:'#7c6fc4',F:'#8a97a8',G:'#8a97a8'};
function radarAxes(p,opts){opts=opts||{};const ex=!!opts.exact;const f=ex?0:fogLevel();const val=(g,k)=>ex?p[g][k]:shown(p,g,k);
 if((isPitcher(p)&&!opts.bat)||opts.pit){const t=p.pit;const velo=ex?t.velo:shownVelo(p);const nz=(p.noise&&p.noise.velo||0)*f*10;const ctrl=clamp(avg(t.pitches.map(x=>x.ctrl))+nz,1,100);const br=t.pitches.slice(1);const brk=br.length?clamp(avg(br.map(x=>x.move*0.5+x.sharp*0.5))+Math.min(12,br.length*4)+nz,1,100):12;
  return [{l:'球速',v:clamp((velo-100)*2.1,5,100),s:Math.round(velo)+'km/h'},{l:'制球',v:ctrl},{l:'変化球',v:brk,s:br.length+'種'},{l:'スタミナ',v:val('pit','stamina')},{l:'対右',v:(val('pit','hitR')+val('pit','kR')+val('pit','hrR'))/3},{l:'対左',v:(val('pit','hitL')+val('pit','kL')+val('pit','hrL'))/3}];}
 return [{l:'ミート',v:(val('bat','meetR')+val('bat','meetL'))/2},{l:'パワー',v:(val('bat','powR')+val('bat','powL'))/2},{l:'走力',v:val('bat','speed')},{l:'守備',v:val('bat','field')},{l:'肩',v:(val('bat','arm')+val('bat','thr'))/2},{l:'選球眼',v:val('bat','eye')},{l:'勝負強さ',v:val('bat','clutch')}];}
function radarSvg(axes,size,color,opts){opts=opts||{};const n=axes.length;size=size||150;const cx=size/2,cy=size/2;const R=size*0.31;const pad=size*0.14;const pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [+(cx+Math.cos(a)*r).toFixed(1),+(cy+Math.sin(a)*r).toFixed(1)];};
 const ring=k=>`<polygon points="${axes.map((_,i)=>pt(i,R*k).join(',')).join(' ')}" fill="${k===1?'rgba(128,140,160,.08)':'none'}" stroke="rgba(128,140,160,${k===1?'.55':'.3'})" stroke-width="1"/>`;
 const spokes=axes.map((_,i)=>{const [x,y]=pt(i,R);return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(128,140,160,.3)" stroke-width="1"/>`;}).join('');
 const vv=axes.map(a=>clamp(a.v,3,100));const poly=vv.map((v,i)=>pt(i,R*v/100).join(',')).join(' ');
 const fs=size*0.078;const labels=axes.map((a,i)=>{const [x,y]=pt(i,R+size*0.11);const l=letter(a.v);const fog=opts.fog&&!opts.exact;const t2=fog?'?':(opts.num?(a.s||String(Math.round(a.v))):l);return `<text x="${x}" y="${y-fs*0.42}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" fill="currentColor" opacity=".85">${esc(a.l)}</text><text x="${x}" y="${y+fs*0.62}" text-anchor="middle" dominant-baseline="middle" font-size="${fs*1.05}" font-weight="800" fill="${fog?'currentColor':RK_COL[l]}">${t2}${a.s&&opts.sub&&!opts.num?`<tspan font-size="${fs*0.72}" font-weight="500" fill="currentColor" opacity=".8"> ${esc(a.s)}</tspan>`:''}</text>`;}).join('');
 const dots=vv.map((v,i)=>{const [x,y]=pt(i,R*v/100);return `<circle cx="${x}" cy="${y}" r="${(size*0.016).toFixed(1)}" fill="${color}" stroke="#fff" stroke-width="1"/>`;}).join('');
 return `<svg class="radar" viewBox="${-pad} 0 ${size+pad*2} ${size}" width="${(opts.w||size)*(size+pad*2)/size}" height="${opts.w||size}" role="img" aria-label="能力レーダーチャート">${ring(0.25)}${ring(0.5)}${ring(0.75)}${ring(1)}${spokes}<polygon points="${poly}" fill="${color}" fill-opacity=".38" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>${dots}${labels}</svg>`;}
function radarHtml(p,opts){opts=opts||{};const col=opts.color||((isPitcher(p)&&!opts.bat)||opts.pit?'#3b82f6':'#e0533c');return radarSvg(radarAxes(p,opts),opts.size||160,col,Object.assign({fog:fogLevel()>0.5},opts));}
function pById(id){return G.players.find(p=>p.id==id);}
function fontCss(id){const f=UNI_FONTS.find(x=>x.id===id)||UNI_FONTS[0];return f.css;}
/* ================= ユニフォーム・校章 SVG ================= */
function emblemSVG(e,size){const s=size||60;const shape=e.shape||'circle';let body='',inner='';
 const sh={circle:'<circle cx="50" cy="50" r="44"/>',shield:'<path d="M50 6 L90 18 L88 56 Q84 84 50 96 Q16 84 12 56 L10 18 Z"/>',diamond:'<path d="M50 5 L95 50 L50 95 L5 50 Z"/>',hex:'<path d="M50 5 L89 27 L89 73 L50 95 L11 73 L11 27 Z"/>',star:'<path d="M50 5 L61 36 L95 38 L68 58 L78 92 L50 72 L22 92 L32 58 L5 38 L39 36 Z"/>',sakura:'<path d="M50 10 C62 10 70 20 66 32 C78 28 90 36 88 48 C100 56 96 72 84 76 C86 90 72 98 62 90 C56 100 44 100 38 90 C28 98 14 90 16 76 C4 72 0 56 12 48 C10 36 22 28 34 32 C30 20 38 10 50 10 Z"/>',pent:'<path d="M50 6 L94 38 L77 92 L23 92 L6 38 Z"/>'};
 body=sh[shape]||sh.circle;
 const txt=e.text||'';const fs=txt.length<=1?46:txt.length===2?30:txt.length===3?22:18;
 return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" role="img" aria-label="校章"><g fill="${esc(e.bg)}" stroke="${esc(e.border)}" stroke-width="4" stroke-linejoin="round">${body}</g>${e.ring?`<g fill="none" stroke="${esc(e.ringColor||e.border)}" stroke-width="2" transform="translate(50 50) scale(.8) translate(-50 -50)">${body}</g>`:''}<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="700" font-family="${esc(fontCss(e.textFont))}" fill="${esc(e.textColor)}">${esc(txt)}</text></svg>`;}
function jerseySVG(u,e,opt){opt=opt||{};const view=opt.view||'front';const w=opt.width||150;const id='j'+Math.random().toString(36).slice(2,8);
 const body='M60,30 L82,24 L100,46 L118,24 L140,30 L190,62 L178,96 L152,86 L152,205 L48,205 L48,86 L22,96 L10,62 Z';
 const bodyBack='M60,30 L140,30 L190,62 L178,96 L152,86 L152,205 L48,205 L48,86 L22,96 L10,62 Z';
 const bp=view==='front'?body:bodyBack;
 let deco='';const trim=esc(u.trim);
 if(u.style==='pin')deco=`<pattern id="${id}p" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${esc(u.base)}"/><rect width="1.6" height="10" fill="${trim}"/></pattern>`;
 const fill=u.style==='pin'?`url(#${id}p)`:esc(u.base);
 let over='';
 if(u.style==='sleeve')over=`<path d="M190,62 L178,96 L152,86 L160,56 Z" fill="${trim}" opacity=".9"/><path d="M10,62 L22,96 L48,86 L40,56 Z" fill="${trim}" opacity=".9"/>`;
 if(u.style==='raglan')over=`<path d="M60,30 L82,24 L100,46 L118,24 L140,30 L190,62 L178,96 L152,86 L152,120 L100,70 L48,120 L48,86 L22,96 L10,62 Z" fill="${trim}"/>`;
 if(u.style==='placket'&&view==='front')over=`<path d="M100,46 L100,205" stroke="${trim}" stroke-width="5"/><path d="M92,46 L92,205 M108,46 L108,205" stroke="${trim}" stroke-width="1.5"/><g fill="${esc(u.base)}" stroke="${trim}" stroke-width="1">${[80,110,140,170].map(y=>`<circle cx="100" cy="${y}" r="3"/>`).join('')}</g>`;
 if(u.style==='band'&&view==='front')over=`<rect x="48" y="82" width="104" height="30" fill="${trim}"/>`;
 const collar=view==='front'?`<path d="M82,24 L100,46 L118,24" fill="none" stroke="${trim}" stroke-width="5" stroke-linejoin="round"/>`:`<path d="M60,30 Q100,44 140,30" fill="none" stroke="${trim}" stroke-width="5"/>`;
 let text='';
 if(view==='front'&&u.text){const len=[...u.text].length;const fs=Math.min(30,Math.max(12,Math.round(120/Math.max(1,len)*1.05)));text=`<text x="100" y="${u.style==='band'?104:102}" text-anchor="middle" font-size="${fs}" font-family="${esc(fontCss(u.textFont))}" font-weight="700" fill="${esc(u.textColor)}" stroke="${esc(u.textOutline)}" stroke-width="1.2" paint-order="stroke" letter-spacing="1">${esc(u.text)}</text>`;}
 if(view==='back'){const n=opt.number==null?1:opt.number;text=`<text x="100" y="155" text-anchor="middle" font-size="78" font-family="${esc(fontCss(u.numFont))}" font-weight="700" fill="${esc(u.numColor)}" stroke="${esc(u.numOutline)}" stroke-width="2" paint-order="stroke">${esc(n)}</text>`;if(opt.name)text+=`<text x="100" y="72" text-anchor="middle" font-size="14" font-family="${esc(fontCss(u.numFont))}" fill="${esc(u.numColor)}" stroke="${esc(u.numOutline)}" stroke-width="1" paint-order="stroke">${esc(opt.name)}</text>`;}
 const num=view==='front'&&opt.number!=null?`<text x="136" y="126" text-anchor="middle" font-size="20" font-family="${esc(fontCss(u.numFont))}" font-weight="700" fill="${esc(u.numColor)}" stroke="${esc(u.numOutline)}" stroke-width="1" paint-order="stroke">${esc(opt.number)}</text>`:'';
 const emb=view==='front'&&opt.emblem!==false?`<g transform="translate(52 56) scale(.26)">${emblemSVG(e,100).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g>`:'';
 return `<svg viewBox="0 0 200 215" width="${w}" role="img" aria-label="ユニフォーム${view==='front'?'前面':'背面'}"><defs>${deco}</defs><path d="${bp}" fill="${fill}" stroke="#333" stroke-width="2" stroke-linejoin="round"/>${over}${collar}${emb}${text}${num}</svg>`;}
function capSVG(u,e,w){return `<svg viewBox="0 0 160 110" width="${w||110}" role="img" aria-label="帽子"><path d="M28,72 Q28,18 80,18 Q132,18 132,72 Z" fill="${esc(u.cap)}" stroke="#333" stroke-width="2"/><path d="M26,72 Q80,92 156,74 L156,82 Q80,104 24,84 Z" fill="${esc(u.capBrim)}" stroke="#333" stroke-width="2"/><path d="M80,18 L80,72" stroke="rgba(0,0,0,.25)" stroke-width="1"/><g transform="translate(62 36) scale(.36)">${emblemSVG(e,100).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g></svg>`;}
function uniformPreview(u,e,opt){opt=opt||{};return `<div class="uni-prev">${jerseySVG(u,e,{view:'front',width:opt.w||130,number:opt.number})}${jerseySVG(u,e,{view:'back',width:opt.w||130,number:opt.number==null?1:opt.number})}<div class="col center">${capSVG(u,e,100)}${emblemSVG(e,64)}</div></div>`;}
/* ================= 画面描画 ================= */
function render(){if(!G){showSetup();return;}$('#setup').hidden=true;$('#game').hidden=false;renderTop();renderNav();renderTab();if(!UI.modal)processQueue();}
/* バージョン表記（ビルド時に埋め込み） */
function appVer(){return typeof APP_VER!=='undefined'?APP_VER:'?';}
function appBuild(){const b=typeof APP_BUILD!=='undefined'?APP_BUILD:'';return b?`${b.slice(0,4)}-${b.slice(4,6)}-${b.slice(6,8)} ${b.slice(8,10)}:${b.slice(10,12)}`:'';}
/* ステータスバー／ブラウザUIの色（ホーム画面アプリでは上部のステータスバーがこの色で塗られる） */
function setThemeColor(c){try{let m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement('meta');m.name='theme-color';document.head.appendChild(m);}if(!c){const dark=document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);c=dark?'#3fa36b':'#1e6b43';}if(m.content!==c)m.content=c;}catch(e){}}
try{if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(!(typeof AR!=='undefined'&&AR.el&&!AR.el.hidden))setThemeColor();});}catch(e){}
function renderTop(){const el=$('#topbar');setThemeColor();const pend=G.queue.length?'<span class="badge gold">イベント</span>':'';el.innerHTML=`<div class="ttl">${emblemSVG(G.emblem,30)}<div class="school">${esc(G.school.name)}<span class="ver" title="ビルド ${appBuild()}">v${appVer()}</span></div>${pend}</div><div class="meta"><div>${dateStr()}（${G.year}年目）</div><div><b class="${G.money<0?'neg':''}">${yen(G.money)}</b> ・ 評判 <b>${G.rep}</b></div></div>`;}
const TABS=[['home','🏠','ホーム'],['players','👥','部員'],['mgmt','🏫','経営'],['match','⚾','試合'],['scout','🔍','スカウト'],['more','📰','その他']];
function renderNav(){$('#nav').innerHTML=TABS.map(t=>`<button class="${UI.tab===t[0]?'on':''}" data-act="tab" data-tab="${t[0]}"><span class="ic">${t[1]}</span>${t[2]}</button>`).join('');}
ACT.tab=d=>{UI.tab=d.tab;render();window.scrollTo(0,0);};
function renderTab(){const c=$('#content');let h='';switch(UI.tab){case 'home':h=viewHome();break;case 'players':h=viewPlayers();break;case 'mgmt':h=viewMgmt();break;case 'match':h=viewMatch();break;case 'scout':h=viewScout();break;case 'more':h=viewMore();break;}c.innerHTML=`<div class="fade">${h}</div>`;}
function nextEvents(){const ev=[['4-1','入学式・新年度'],['5-2','春季地区大会'],['6-1','中学生情報の公開'],['7-2','夏の甲子園予選'],['8-1','甲子園（出場時）'],['8-3','夏合宿'],['8-4','U-18代表選考'],['9-2','秋季地区予選'],['9-3','秋季県大会（進出時）'],['10-2','秋季地区大会（進出時）'],['11-2','神宮大会（進出時）'],['12-3','冬合宿'],['1-2','監督・スカウト候補の更新'],['1-4','選抜出場校の発表'],['2-3','予算委員会'],['2-4','スカウト締切'],['3-1','選抜高校野球／招待大会'],['3-3','卒業式・進路相談']];const order=[4,5,6,7,8,9,10,11,12,1,2,3];const cur=order.indexOf(G.month)*4+G.week;const list=ev.map(e=>{const [m,w]=e[0].split('-').map(Number);let idx=order.indexOf(m)*4+w;if(idx<=cur)idx+=48;return {name:e[1],weeks:idx-cur,key:e[0]};}).sort((a,b)=>a.weeks-b.weeks);return list.slice(0,3);}
