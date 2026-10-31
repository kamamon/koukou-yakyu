/* ================= 新聞（一面） =================
 スポーツ紙の一面のように：題字、縦組みの大見出し、写真、段組みの本文、本紙予想、コラム、広告。
 記事をタップすると横書きで全文を読める。大会の開幕前は「展望」、優勝や出場決定は「号外」になる。 */
const NP_TITLE='白球新報';
const NP_WEATHER={1:['晴れ',7],2:['晴れ',8],3:['くもり',14],4:['晴れ',19],5:['晴れ',24],6:['雨',26],7:['晴れ',33],8:['晴れ',34],9:['くもり',29],10:['晴れ',22],11:['くもり',16],12:['晴れ',10]};
/* 紙面の日付：週と「その週の何日目（試合日）」から、それらしい日付と曜日を出す */
function npDay(is){const dim=new Date(is.cy,is.mo,0).getDate();const day=Math.min(dim,(is.wk-1)*7+1+(is.d||0)*2+(is.extra?1:0));const wd='日月火水木金土'[new Date(is.cy,is.mo-1,day).getDay()];return {day,wd};}
function npNo(is){const {day}=npDay(is);return ((is.cy-1952)*12+(is.mo-1))*31+day+3000;}
function npWeather(cy,mo,wk){const base=NP_WEATHER[mo]||['晴れ',20];const h=(cy*31+mo*7+wk*13)%10;const w=h<6?base[0]:h<8?'くもり':(mo>=6&&mo<=9?'雨':'晴れ');return {w,t:base[1]+(h%5)-2,ic:w==='晴れ'?'☀':w==='雨'?'☂':'☁'};}
/* 縦組み用の文字整形：数字は縦中横、4桁以上は漢数字、英字は全角、打率は「割分厘」 */
function npTate(t){t=String(t||'');
 t=t.replace(/(^|[^0-9])\.(\d)(\d)(\d)/g,(m,a,x,y,z)=>a+((x!=='0'?x+'割':'')+(y!=='0'?y+'分':'')+(z!=='0'?z+'厘':'')||'0割'));
 t=t.replace(/km\/h/g,'キロ').replace(/(\d)\s*[-－]\s*(\d)/g,'$1―$2').replace(/\d{4,}/g,m=>m.split('').map(c=>'〇一二三四五六七八九'[+c]).join(''));
 t=t.replace(/[A-Za-z]/g,c=>String.fromCharCode(c.charCodeAt(0)+0xFEE0)).replace(/!!/g,'‼').replace(/!/g,'！').replace(/\?/g,'？').replace(/%/g,'％').replace(/\(/g,'（').replace(/\)/g,'）').replace(/\//g,'／');
 return esc(t).replace(/(&#?\w+;)|(\d{1,3})/g,(m,ent,d)=>ent?ent:`<span class="tcy">${d}</span>`);}
function newsIssues(){const map=new Map();
 for(const n of G.news){const cy=n.cy||G.calYear,mo=n.mo||G.month,wk=n.wk||1,d=n.d||0;const key=`${cy}-${mo}-${wk}-${d}${n.extra?'x':''}`;if(!map.has(key))map.set(key,{key,cy,mo,wk,d,extra:!!n.extra,items:[]});map.get(key).items.push(n);}
 const ord=x=>((((x.cy*12+x.mo)*5+x.wk)*40+x.d)*2+(x.extra?1:0));const issues=[...map.values()].sort((a,b)=>ord(b)-ord(a));
 for(const is of issues)is.items.sort((a,b)=>(b.imp||1)-(a.imp||1));return issues;}
function articleBody(n,max){const t=n.body||'';if(!max||t.length<=max)return esc(t);return esc(t.slice(0,max))+'…';}
function npIdx(n){return G.news.indexOf(n);}
/* 写真：試合中に撮った3Dのスナップショットがあればそれ、なければ似顔絵を球場の背景に置いて紙面風に */
function npPhotoData(id){const ph=(G.photos||[]).find(x=>x.id===id);return ph?ph.data:null;}
function npPhoto(n,cls){const data=n.photo?npPhotoData(n.photo):null;
 if(data)return `<figure class="np-photo ${cls||''}"><img src="${data}" alt="${esc(n.title)}の写真"><figcaption>${esc(n.cap||npCaption(n))}</figcaption></figure>`;
 const av=n.pid||n.avatar?avatarFor(Object.assign({},n,{size:160})):'';
 return `<figure class="np-photo ill ${cls||''}"><div class="np-scene"><div class="sky"></div><div class="stand"></div><div class="field"></div>${av?`<div class="np-av">${av}</div>`:'<div class="np-ball"></div>'}<div class="dots"></div></div><figcaption>${esc(npCaption(n))}</figcaption></figure>`;}
function npCaption(n){if(n.cap)return n.cap;if(n.pid){const nm=playerNameById(n.pid);return nm?`${nm}${n.kind==='game'?(n.won?'＝殊勲の活躍':'＝最後まで奮闘'):''}`:'';}if(n.avatar&&n.avatar.pref)return `${n.avatar.pref}の注目選手`;return n.kind==='game'?'試合のひとこま':'';}
/* 縦組みの大見出し：空白で行を分け、いちばん長い行が枠に収まる大きさにする */
function npHeadline(text,maxH,cls){const lines=String(text||'').split(/[\s　]+/).filter(Boolean);const L=Math.max(1,...lines.map(l=>l.length));const fs=Math.min(cls==='gg'?14:11.5,maxH/L);
 return `<h2 class="np-hl ${cls||''}" style="font-size:${fs.toFixed(2)}cqw;min-height:${(L*fs*1.02+2.8).toFixed(2)}cqw">${lines.map(l=>`<span>${npTate(l)}</span>`).join('')}</h2>`;}
/* 段組みの本文：文字数に合わせて段の高さを決め、最後の段がスカスカにならないようにする */
function npBody(text,bandH,maxBands){const len=String(text||'').length+4;const lines=15;const per=Math.floor(bandH/3.45)*lines;const bands=clamp(Math.ceil(len/per),1,maxBands||2);
 const chars=Math.ceil(len/(bands*lines));const h=clamp((chars+1)*3.45,22,bandH);
 return `<div class="np-body" style="height:${(bands*h+(bands-1)*3).toFixed(1)}cqw;column-count:${bands}">${npTate(text)}</div>`;}
function npLineScore(ln){if(!ln)return '';const n=Math.max(...ln.line.map(r=>r.length),1);const cells=(r,i)=>Array.from({length:n},(_,k)=>`<td>${r[k]==null?(k<n?'Ｘ':''):r[k]}</td>`).join('');
 const row=(i)=>`<tr class="${i===ln.ui?'us':''}"><th>${esc(schoolShort(ln.names[i]))}</th>${cells(ln.line[i],i)}<td class="r">${ln.R[i]}</td><td class="h">${ln.H?ln.H[i]:''}</td></tr>`;
 return `<table class="np-ls"><tr><th></th>${Array.from({length:n},(_,k)=>`<td class="lh">${k+1}</td>`).join('')}<td class="lh r">計</td><td class="lh h">安</td></tr>${row(0)}${row(1)}</table>`;}
function npMast(is,latest){const wx=npWeather(is.cy,is.mo,is.wk);const cats=[...new Set(is.items.map(n=>n.cat))].slice(0,5);
 return `<header class="np-mast${is.extra?' gg':''}"><div class="np-logo">${is.extra?'<span class="np-gogai">号外</span>':''}<span class="np-title">${NP_TITLE}</span><span class="np-ed">${esc(G.school.pref)}版</span></div>
 <div class="np-date"><b>${is.cy}年（令和${is.cy-2018}年）${is.mo}月${npDay(is).day}日（${npDay(is).wd}）</b><span>第${npNo(is).toLocaleString()}号${is.extra?'（号外）':''}</span><span>${wx.ic} ${wx.w} ${wx.t}℃　定価${is.extra?'無料':'150円'}</span></div></header>
 ${is.extra?'':`<div class="np-index"><b>今週の紙面</b>${cats.map(c=>`<span>▶${esc(c)}</span>`).join('')}</div>`}`;}
function npLead(n){const i=npIdx(n);
 if(n.kind==='preview'&&n.preview){const pv=n.preview;const u=pv.user||{};const stars=(k)=>'★'.repeat(k)+'<i>'+'★'.repeat(5-k)+'</i>';
  const fav=`<div class="np-fav"><div class="np-boxh">本紙予想　優勝候補</div><table>${pv.fav.map(f=>`<tr class="${f.user?'us':''}"><td class="mk">${f.mark}</td><td class="nm">${esc(f.name)}${f.pref&&f.pref!==G.school.pref?`<small>（${esc(f.pref)}）</small>`:''}</td><td class="nt">${esc(f.note)}</td></tr>`).join('')}</table></div>`;
  const st=`<div class="np-stars"><div class="np-boxh">注目選手</div><div class="g">${pv.stars.map(s=>`<div class="np-star${s.user?' us':''}"><div class="np-sav">${s.pid?avatarFor({pid:s.pid,size:72}):avatarFor({avatar:{seed:s.seed||s.name,pref:s.pref},title:s.name,size:72})}</div><b>${esc(s.name)}</b><small>${esc(schoolShort(s.school))}・${s.grade}年・${esc(posName(s.pos))}</small><span class="st">${esc(s.stat)}</span><span class="rk rk-${s.rank}">${s.rank}</span></div>`).join('')}</div></div>`;
  const our=`<div class="np-our"><div class="np-boxh">戦力分析　${esc(G.school.name)}${u.eval?`　<b>${u.eval}評価</b>`:''}</div><div class="pw"><span>投手力 ${stars(u.pw?u.pw.pit:1)}</span><span>攻撃力 ${stars(u.pw?u.pw.bat:1)}</span><span>守備力 ${stars(u.pw?u.pw.def:1)}</span><span>機動力 ${stars(u.pw?u.pw.run:1)}</span></div><div class="op">${u.opp?`初戦の相手：<b>${esc(u.opp.name)}</b>${u.opp.pref&&u.opp.pref!==G.school.pref?'（'+esc(u.opp.pref)+'）':''}`:'初戦は不戦勝'}</div></div>`;
  return `<section class="np-lead pv" data-act="newsOpen" data-i="${i}"><div class="np-top"><div class="np-hls">${npHeadline(n.title,64)}${n.sub?`<div class="np-sub">${npTate(n.sub)}</div>`:''}</div><div class="np-pvl">${fav}${our}</div></div>${st}${npBody(n.body,48,2)}</section>`;}
 if(n.extra){return `<section class="np-lead gg" data-act="newsOpen" data-i="${i}"><div class="np-top"><div class="np-hls">${npHeadline(n.head||n.title,78,'gg')}${n.sub?`<div class="np-sub gg">${npTate(n.sub)}</div>`:''}</div>${npPhoto(n,'big')}</div>${npBody(n.body,40,1)}</section>`;}
 const q=n.quotes&&n.quotes.length?`<div class="np-quote">${n.quotes.map(x=>`<p><b>${esc(x.who)}</b>「${esc(x.text)}」</p>`).join('')}</div>`:'';
 return `<section class="np-lead" data-act="newsOpen" data-i="${i}"><div class="np-top"><div class="np-hls">${npHeadline(n.head||n.title,62)}${n.sub?`<div class="np-sub">${npTate(n.sub)}</div>`:''}</div>${npPhoto(n)}</div>${n.line?npLineScore(n.line):''}${npBody(n.body,48,2)}${q}</section>`;}
/* 二番手以降の記事：本文の長さに合わせて段の高さを決める（短い記事で左側が空かないように） */
function npSec(n,count){const W=count>1?38:84;const lines=Math.max(4,Math.floor(W/(3.05*1.65)));const len=String(n.body||'').length+2;const h=clamp(Math.ceil(len/lines)*3.05+2,18,46);const hl=String(n.head||n.title||'').length;
 return `<article class="np-sec" data-act="newsOpen" data-i="${npIdx(n)}"><h3 style="max-height:${Math.max(h,Math.min(46,hl*4.4/2+2)).toFixed(1)}cqw">${npTate(n.head||n.title)}</h3><div class="np-sbody" style="height:${h.toFixed(1)}cqw">${npTate(n.body)}</div></article>`;}
/* 最新号だけに載せる「いま」の情報（日程・部内成績・大会の結果） */
function npModules(is,latest){if(!latest)return '';const mods=[];
 const ev=nextEvents().slice(0,4);if(ev.length)mods.push(`<div class="np-mod"><div class="np-boxh">今後の日程</div>${ev.map(e=>`<div class="r"><span>${esc(e.name)}</span><span>${e.weeks===0?'今週':e.weeks+'週後'}</span></div>`).join('')}</div>`);
 const a=active();const bats=a.filter(p=>p.season.ab>=8).sort((x,y)=>y.season.h/y.season.ab-x.season.h/x.season.ab).slice(0,3);const hr=a.filter(p=>p.season.hr>0).sort((x,y)=>y.season.hr-x.season.hr).slice(0,3);const ks=a.filter(p=>p.season.pk>0).sort((x,y)=>y.season.pk-x.season.pk).slice(0,2);
 if(bats.length||hr.length)mods.push(`<div class="np-mod"><div class="np-boxh">部内成績</div>${bats.map(p=>`<div class="r"><span>打率 ${esc(p.name)}</span><span>${(p.season.h/p.season.ab).toFixed(3).replace(/^0/,'')}</span></div>`).join('')}${hr.map(p=>`<div class="r"><span>本塁打 ${esc(p.name)}</span><span>${p.season.hr}</span></div>`).join('')}${ks.map(p=>`<div class="r"><span>奪三振 ${esc(p.name)}</span><span>${p.season.pk}</span></div>`).join('')}</div>`);
 const t=G.tourney;if(t&&t.rounds&&t.rounds.length){const rIdx=t.done?t.rounds.length-1:Math.max(0,t.cur-(t.rounds[t.cur]&&t.rounds[t.cur].some(m=>m.w&&!m.bye)?0:1));const r=t.rounds[rIdx]||[];const res=r.filter(m=>m.w&&!m.bye).slice(0,6);
  if(res.length)mods.push(`<div class="np-mod wide"><div class="np-boxh">${esc(t.name)}　${esc(roundName(t,rIdx))}の結果</div>${res.map(m=>{const w=m.w==='a'?m.a:m.b,l=m.w==='a'?m.b:m.a;const s=m.s?(m.w==='a'?m.s:[m.s[1],m.s[0]]):['',''];return `<div class="r${m.user?' us':''}"><span><b>${esc(schoolShort(w.name))}</b> ${s[0]}－${s[1]} ${esc(schoolShort(l.name))}</span></div>`;}).join('')}</div>`);}
 return mods.length?`<div class="np-mods">${mods.join('')}</div>`:'';}
/* コラム：文字数に合わせて段の高さを決め、左側が空かないようにする（約15行） */
function npColumn(is){const t=columnText(is.cy,is.mo,is.wk);const h=clamp(Math.ceil((t.length+2)/14)*3.05+1.5,20,40);return `<div class="np-col"><div class="np-colh">球音</div><div class="np-colb" style="--colh:${h.toFixed(1)}cqw">${npTate(t)}</div></div>`;}
function npAds(is){const h=(is.cy*7+is.mo*5+is.wk*3)%NP_ADS.length;const ads=[NP_ADS[h],NP_ADS[(h+3)%NP_ADS.length]];
 return `<div class="np-ads">${ads.map(ad=>`<div class="np-ad" style="--ac:${ad.c}"><b>${esc(ad.h)}</b><span>${esc(ad.t)}</span></div>`).join('')}</div>`;}
function npPage(is,latest){const items=is.items;const lead=items[0];const rest=items.slice(1);
 const secs=rest.filter(n=>(n.imp||1)>=1&&(n.body||'').length>20).slice(0,2);const briefs=rest.filter(n=>!secs.includes(n)).slice(0,8);
 return `<div class="np${is.extra?' gg':''}">${npMast(is,latest)}${npLead(lead)}${secs.length?`<div class="np-secs" style="grid-template-columns:repeat(${secs.length},1fr)">${secs.map(x=>npSec(x,secs.length)).join('')}</div>`:''}${npModules(is,latest)}
 ${briefs.length?`<div class="np-briefs"><div class="np-boxh">短信</div>${briefs.map(n=>`<div class="np-brief" data-act="newsOpen" data-i="${npIdx(n)}"><span class="c">${esc(n.cat)}</span>${esc(n.title)}</div>`).join('')}</div>`:''}
 ${is.extra?'':npColumn(is)+npAds(is)}<div class="np-foot">発行所　${NP_TITLE}社（${esc(G.school.pref)}）　第三種郵便物認可　記事中の写真・似顔絵はイメージです</div></div>`;}
function viewNewsPaper(){const issues=newsIssues();if(!issues.length)return '<div class="muted small">記事はまだありません</div>';
 UI.newsIssue=clamp(UI.newsIssue||0,0,issues.length-1);const is=issues[UI.newsIssue];const cat=UI.newsCat||'all';
 const cats=['all',...new Set(G.news.map(n=>n.cat))];const chips=cats.map(c=>`<button class="btn sm ${cat===c?'on':''}" data-act="newsCat" data-c="${esc(c)}">${c==='all'?'紙面':esc(c)}</button>`).join('');
 if(cat!=='all'){const list=G.news.filter(n=>n.cat===cat).slice(0,80);return `<div class="subtabs">${chips}</div><div class="paper">${list.map(n=>`<div class="news" data-act="newsOpen" data-i="${npIdx(n)}"><span class="cat">${esc(n.cat)}</span><span class="tiny muted">${esc(n.t)}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p></div>`).join('')}</div>`;}
 const back=issues.slice(0,80).map((x,k)=>`<option value="${k}"${k===UI.newsIssue?' selected':''}>${x.mo}/${npDay(x).day}${x.extra?' 号外':''}　${esc((x.items[0].head||x.items[0].title).slice(0,18))}</option>`).join('');
 const nav=`<div class="pnav">${b('◀ 前の号','newsIssue',{d:1},'sm')}<select class="np-back" data-chg="newsBack" aria-label="バックナンバー">${back}</select>${b('次の号 ▶','newsIssue',{d:-1},'sm')}</div>`;
 return `<div class="subtabs">${chips}</div>${nav}${npPage(is,UI.newsIssue===0)}${nav}`;}
CHG.newsBack=(d,el)=>{UI.newsIssue=parseInt(el.value)||0;render();window.scrollTo(0,0);};
function playerNameById(id){const p=G.players.find(x=>x.id==id)||G.graduates.find(x=>x.id==id);return p?p.name+(p.grade?'（'+G.school.name+'）':'（'+G.school.name+'OB）'):'';}
ACT.newsIssue=d=>{const issues=newsIssues();UI.newsIssue=clamp((UI.newsIssue||0)+parseInt(d.d),0,issues.length-1);render();window.scrollTo(0,0);};
/* 記事を横書きで読む */
ACT.newsOpen=d=>{const n=G.news[parseInt(d.i)];if(!n)return;const pv=n.preview;
 const pvHtml=pv?`<h4 class="np-rh">本紙予想</h4><table class="t np-rfav">${pv.fav.map(f=>`<tr><td>${f.mark}</td><td class="l"><b>${esc(f.name)}</b>${f.pref?'（'+esc(f.pref)+'）':''}</td><td class="l small">${esc(f.note)}</td></tr>`).join('')}</table><h4 class="np-rh">注目選手</h4>${pv.stars.map(s=>`<div class="small">・<b>${esc(s.name)}</b>（${esc(s.school)}・${s.grade}年・${esc(posName(s.pos))}）${esc(s.stat)}${s.title?'　'+esc(s.title):''}</div>`).join('')}`:'';
 openModal(`<div class="np-read"><div class="np-rmast"><span>${NP_TITLE}</span><span>${esc(n.t)}${n.extra?'　号外':''}</span></div><span class="cat">${esc(n.cat)}</span><h2>${esc(n.head||n.title)}</h2>${n.sub?`<div class="np-rsub">${esc(n.sub)}</div>`:''}
 ${n.kind==='preview'?'':npPhoto(n,'read')}${n.line?npLineScore(n.line):''}<p class="np-rbody">${esc(n.body)}</p>${n.quotes?n.quotes.map(q=>`<p class="np-rq"><b>${esc(q.who)}</b>「${esc(q.text)}」</p>`).join(''):''}${pvHtml}</div>`);};
/* ================= 記録・ランキング ================= */
function viewRecords(){const rec=G.records||{};const rows=Object.keys(REC_DEF).map(k=>{const r=rec[k];const d=REC_DEF[k];const jp=JP_RECORDS[k];return `<tr><td class="l">${d.label}</td><td>${r?r.v+(d.unit||''):'-'}</td><td class="l">${r?esc(r.name)+'（'+r.year+'年）':'<span class="muted">未達成（'+d.min+(d.unit||'')+'以上で記録）</span>'}</td><td class="l muted">${jp?esc(jp.label):''}</td></tr>`;}).join('');
 return `<section class="card"><h3>校記録</h3><div class="tw"><table class="t"><tr><th class="l">項目</th><th>記録</th><th class="l">選手</th><th class="l">参考（全国）</th></tr>${rows}</table></div><div class="hint">校記録を更新すると新聞に載ります。参考記録に並ぶ・上回ると大きな記事になり評判が大きく上がります。</div></section><div class="hd" style="font-size:17px">歴代通算ランキング</div>${rankingHtml()}`;}
