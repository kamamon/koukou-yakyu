/* ================= 大会 ================= */
const TOURNEY_DEFS={
 district:{name:'春季地区大会',imp:1.0,mercy:true},
 pref:{name:'夏の甲子園 ○○大会',imp:1.3,mercy:true},
 koshien:{name:'全国高校野球選手権（甲子園）',imp:2.0,mercy:false},
 autumnDistrict:{name:'秋季地区予選',imp:1.0,mercy:true},
 autumnPref:{name:'秋季○○県大会',imp:1.1,mercy:true},
 regional:{name:'秋季△△地区大会',imp:1.3,mercy:true},
 jingu:{name:'明治神宮大会',imp:1.6,mercy:false},
 invite1:{name:'春季交流招待大会',imp:0.9,mercy:true},
 invite2:{name:'強豪校招待大会',imp:1.4,mercy:true},
 invite3:{name:'全国選抜招待大会',imp:1.8,mercy:false},
 senbatsu:{name:'選抜高校野球大会（春の甲子園）',imp:1.9,mercy:false},
 practice:{name:'練習試合',imp:0.6,mercy:true},
};
function userTeamRef(){return {name:G.school.name,strength:teamStrength(),isUser:true,pref:G.school.pref};}
function champOf(pr){const pw=G.schools.powers[pr.name];if(R()<0.7){const s=pick(pw);return {name:s.name,strength:Math.round(clamp(s.strength+gauss(0,3),40,s.elite?96:89)),pref:pr.name,elite:!!s.elite};}return {name:genSchoolNameU(pr.name),strength:Math.round(clamp(52+pr.pw*5+gauss(0,6),40,86)),pref:pr.name};}
function driftSchools(){const mean=46+G.school.pw*5;for(const s of G.schools.pref)s.strength=Math.round(clamp(s.strength*0.82+mean*0.18+gauss(0,5),25,88));for(const k in G.schools.powers){const pw=PREF_DATA.find(p=>p.name===k).pw;G.schools.powers[k].forEach((s,i)=>{s.strength=Math.round(clamp(s.strength*0.85+(62+pw*4.5-i*4)*0.15+gauss(0,4),45,88));});}applyEliteSchools();refreshStars(false);}
function buildTeams(kind){const u=userTeamRef();const cp=s=>({name:s.name,strength:Math.round(clamp(s.strength+gauss(0,3),20,s.elite?96:89)),pref:s.pref,elite:!!s.elite});const built=buildTeamsRaw(kind,u,cp);for(const t of built){if(!t.isUser&&!t.elite&&t.strength>89)t.strength=89;}return built;}
function buildTeamsRaw(kind,u,cp){
 switch(kind){
  case 'district':case 'autumnDistrict':return [u].concat(G.schools.local.map(cp));
  case 'pref':return [u].concat(G.schools.pref.map(cp));
  case 'autumnPref':{const top=G.schools.pref.slice().sort((a,b)=>b.strength-a.strength).slice(0,15);return [u].concat(top.map(cp));}
  case 'koshien':{const arr=[u];for(const pr of PREF_DATA){if(pr.name===G.school.pref)continue;arr.push(champOf(pr));}arr.push(champOf(PREF_DATA.find(p=>p.name==='東京')));return arr;}
  case 'regional':{const arr=[u];const prs=PREF_DATA.filter(p=>p.region===G.school.region&&p.name!==G.school.pref);for(const pr of prs){const pw=G.schools.powers[pr.name].slice().sort((a,b)=>b.strength-a.strength);arr.push(cp(pw[0]));arr.push(cp(pw[1]));if(arr.length>=16)break;}while(arr.length<16){const pr=pick(PREF_DATA.filter(p=>p.region===G.school.region));arr.push({name:genSchoolNameU(pr.name),strength:Math.round(clamp(50+pr.pw*5+gauss(0,6),40,86)),pref:pr.name});}return arr.slice(0,16);}
  case 'jingu':{const arr=[u];for(const rg of REGIONS){if(rg===G.school.region)continue;const pr=pick(PREF_DATA.filter(p=>p.region===rg));const pw=G.schools.powers[pr.name].slice().sort((a,b)=>b.strength-a.strength)[0];arr.push({name:pw.name,strength:Math.round(clamp(pw.strength+ri(2,8),50,pw.elite?97:89)),pref:pr.name,elite:!!pw.elite});}return arr;}
  case 'invite1':{const arr=[u];for(let i=0;i<7;i++){const pr=pick(PREF_DATA);arr.push({name:genSchoolNameU(pr.name),strength:ri(42,66),pref:pr.name});}return arr;}
  case 'invite2':{const arr=[u];for(let i=0;i<7;i++){const pr=pick(PREF_DATA);const pw=pick(G.schools.powers[pr.name]);arr.push({name:pw.name,strength:Math.round(clamp(pw.strength+gauss(2,4),60,pw.elite?95:89)),pref:pr.name,elite:!!pw.elite});}return arr;}
  case 'senbatsu':{const arr=[u];const quota=Object.assign({},SENBATSU_SLOTS);quota[G.school.region]=Math.max(0,quota[G.school.region]-1);
   for(const rg of REGIONS){const prs=PREF_DATA.filter(p=>p.region===rg);for(let i=0;i<(quota[rg]||0);i++){const pr=pick(prs);const pw=G.schools.powers[pr.name].slice().sort((a,b)=>b.strength-a.strength);const sch=pw[Math.min(i<2?0:1,pw.length-1)];const name=arr.some(x=>x.name===sch.name)?genSchoolNameU(pr.name):sch.name;arr.push({name,strength:Math.round(clamp(sch.strength+gauss(3,4),62,sch.elite&&name===sch.name?97:89)),pref:pr.name,elite:!!(sch.elite&&name===sch.name)});}}
   while(arr.length<32){const pr=pick(PREF_DATA);arr.push({name:genSchoolNameU(pr.name),strength:Math.round(clamp(58+pr.pw*5+gauss(0,5),50,86)),pref:pr.name});}return arr.slice(0,32);}
  case 'invite3':{const arr=[u];for(let i=0;i<15;i++){const pr=pick(PREF_DATA);const pw=G.schools.powers[pr.name].slice().sort((a,b)=>b.strength-a.strength)[0];arr.push({name:pw.name,strength:Math.round(clamp(pw.strength+gauss(5,4),65,pw.elite?97:89)),pref:pr.name,elite:!!pw.elite});}return arr;}
 }return [u];}
/* 固定トーナメント（勝ち上がりの木構造） */
function buildTree(teams){const N=teams.length;let P=1;while(P<N)P*=2;const byes=P-N;const slots=new Array(P).fill(null);const pairs=shuffle(Array.from({length:P/2},(_,i)=>i));const byePairs=new Set(pairs.slice(0,byes));const ts=shuffle(teams);let ti=0;
 for(let i=0;i<P/2;i++){if(byePairs.has(i)){const side=R()<0.5?0:1;slots[i*2+side]=ts[ti++];}else{slots[i*2]=ts[ti++];slots[i*2+1]=ts[ti++];}}
 const nR=Math.log2(P);const rounds=[];const r1=[];for(let i=0;i<P/2;i++){const m={a:slots[i*2],b:slots[i*2+1],w:null,s:null,user:false};m.user=!!((m.a&&m.a.isUser)||(m.b&&m.b.isUser));if(!m.a||!m.b){m.w=m.a?'a':'b';m.bye=true;}r1.push(m);}rounds.push(r1);return {P,nR,slots,rounds};}
function nextRound(t){const prev=t.rounds[t.cur];const ms=[];for(let i=0;i<prev.length;i+=2){const a=winnerOf(prev[i]),b=winnerOf(prev[i+1]);ms.push({a,b,w:null,s:null,user:!!((a&&a.isUser)||(b&&b.isUser))});}t.rounds.push(ms);t.cur++;}
function roundName(t,idx){const P=t.P||Math.pow(2,t.rounds.length);const n=t.rounds[idx]?t.rounds[idx].length:P/Math.pow(2,idx+1);if(n===1)return '決勝';if(n===2)return '準決勝';if(n===4)return '準々決勝';return (idx+1)+'回戦';}
function resolveCpu(m){const pa=1/(1+Math.pow(10,(m.b.strength-m.a.strength)/25));const aw=R()<pa;const wr=ri(2,9);const lr=ri(0,Math.min(wr-1,6));m.w=aw?'a':'b';m.s=aw?[wr,lr]:[lr,wr];}
function winnerOf(m){return m.w==='a'?m.a:m.b;}
function userMatch(t){return t&&t.um?t.rounds[t.um.r][t.um.i]:null;}
function startTourney(kind){const def=TOURNEY_DEFS[kind];let name=def.name.replace('○○',G.school.pref).replace('△△',G.school.region);const teams=buildTeams(kind);const tree=buildTree(teams);
 const t={kind,name,imp:def.imp,mercy:def.mercy,year:G.calYear,teams,P:tree.P,nR:tree.nR,slots:tree.slots,rounds:tree.rounds,cur:0,done:false,champion:null,userAlive:true,userOut:null,um:null,userLabel:null,userGames:[]};
 G.tourney=t;enqueue({type:'tourney'});tourneyAdvance();return t;}
function tourneyAdvance(){const t=G.tourney;if(!t||t.done)return 'done';const r=t.rounds[t.cur];
 r.forEach((m,i)=>{if(m.w)return;if(m.user&&t.userAlive){t.um={r:t.cur,i};return;}resolveCpu(m);});
 const um=userMatch(t);if(um&&!um.w)return 'userMatch';
 if(r.length===1){t.champion=winnerOf(r[0]);t.done=true;onTourneyEnd(t);return 'done';}
 nextRound(t);t.um=null;return tourneyAdvance();}
function tourneyUserResult(res){const t=G.tourney;const m=userMatch(t);if(!m)return;const opp=m.a.isUser?m.b:m.a;m.w=res.won?(m.a.isUser?'a':'b'):(m.a.isUser?'b':'a');m.s=m.a.isUser?[res.score[0],res.score[1]]:[res.score[1],res.score[0]];t.userGames.push({round:roundName(t,t.cur),opp:opp.name,won:res.won,score:res.score.slice(),mvp:res.mvpName||''});
 if(!res.won){t.userAlive=false;t.userOut=t.cur;}t.um=null;tourneyAdvance();}
function userLabel(t){if(t.champion&&t.champion.isUser)return '優勝';if(t.userOut==null)return '不出場';const n=t.rounds[t.userOut].length;if(n===1)return '準優勝';if(n===2)return 'ベスト4';if(n===4)return 'ベスト8';return (t.userOut+1)+'回戦敗退';}
const REP_TABLE={district:[3,1,0,0],pref:[10,5,3,1],koshien:[25,15,10,7],autumnDistrict:[2,1,0,0],autumnPref:[5,3,1,0],regional:[8,5,3,1],jingu:[12,8,4,2],invite1:[1,0,0,0],invite2:[4,2,1,0],invite3:[10,6,3,1],senbatsu:[22,13,9,6]};
/* 選抜の地区別出場枠（概ね実際の配分） */
const SENBATSU_SLOTS={北海道:1,東北:3,関東:6,北信越:2,東海:3,近畿:6,中国:3,四国:2,九州:4};
/* 1月下旬：選抜出場校の選考 */
function senbatsuSelection(){const r=G.results;const reg=r.regional||null;const pref=r.autumnPref||null;const region=G.school.region;let slots=SENBATSU_SLOTS[region]||2;
 let sel=null,reason='';const notes=[];
 /* 神宮枠：地区の代表が神宮大会で優勝すると地区の枠が1つ増える */
 let jinguBonus=false;if(r.jingu==='優勝'){jinguBonus=true;}else if(reg&&reg!=='優勝'&&R()<1/9){jinguBonus=true;}
 if(jinguBonus)slots++;
 if(reg){const rank=reg==='優勝'?1:reg==='準優勝'?2:reg==='ベスト4'?3:reg==='ベスト8'?5:9;
  if(rank===1){sel='一般選考';reason=`秋季${region}地区大会優勝`;}
  else if(rank===2&&slots>=2){sel='一般選考';reason=`秋季${region}地区大会準優勝`;}
  else if(rank===3){if(slots>=4||(slots===3&&R()<0.62)||(slots===2&&R()<0.18)){sel=jinguBonus&&slots<=3?'神宮枠':'一般選考';reason=`秋季${region}地区大会ベスト4${jinguBonus?'（神宮枠で地区の枠が増加）':''}`;}}
  else if(rank===5){if(slots>=6&&R()<0.4){sel='一般選考';reason=`秋季${region}地区大会ベスト8（内容を評価）`;}}}
 /* 21世紀枠：県大会ベスト8以上で、公立・学業・規模・甲子園から遠ざかっている等を評価 */
 let c21=0;
 if(!sel&&pref&&['優勝','準優勝','ベスト4','ベスト8'].includes(pref)){c21=0.02;const h=G.history;
  if(G.school.type==='公立')c21+=0.04;else c21-=0.02;
  if(G.school.hensachi>=60)c21+=0.04;if(G.school.hensachi>=68)c21+=0.03;if(G.school.size==='小')c21+=0.03;
  if(!h.some(x=>x.results&&(x.results.koshien||x.results.senbatsu))&&!G.results.koshien)c21+=0.04;
  if(pref==='優勝')c21+=0.05;else if(pref==='準優勝')c21+=0.03;else if(pref==='ベスト4')c21+=0.01;
  if(reg)c21+=0.03;if(G.rep<70)c21+=0.01;
  if(Object.values(G.fac).filter(f=>f&&!f.broken).length<=3)c21+=0.02;
  c21=clamp(c21,0,0.25);if(R()<c21){sel='21世紀枠';reason=`秋季県大会${pref}。${G.school.type==='公立'?'公立校として':''}${G.school.hensachi>=60?'文武両道の':''}取り組みが評価され、21世紀枠に選出`;}}
 if(sel){G.flags.senbatsu={type:sel,reason};
  addNews('大会',`${G.school.name}、選抜高校野球に出場決定！${sel==='21世紀枠'?'（21世紀枠）':sel==='神宮枠'?'（神宮枠）':''}`,`選抜高校野球大会の出場校が発表され、${G.school.name}の出場が決まった。選考理由は「${reason}」。春の甲子園は3月下旬に開幕する。`,{imp:3});
  enqueue({type:'msg',title:'選抜高校野球 出場決定！',body:`${G.school.name}は選抜高校野球大会（春の甲子園）への出場が決まりました。\n選考区分：${sel}\n理由：${reason}\n\n大会は3月第1週に開幕します。オーダーと調整を進めましょう。`});}
 else if(reg||c21>0){const why=reg?`秋季${region}地区大会${reg}だったが、地区の出場枠（${slots}校）に届かなかった`:'21世紀枠の候補に挙がったが選出には至らなかった';addNews('大会',`${G.school.name}、選抜は落選`,`選抜高校野球大会の出場校が発表されたが、${G.school.name}の名前はなかった。${why}。春は招待大会で夏への準備を進める。`,{imp:1});notice(`選抜高校野球の出場校が発表された。${G.school.name}は落選…（${why}）`);}
 return sel;}
function onTourneyEnd(t){const lbl=userLabel(t);t.userLabel=lbl;G.results[t.kind]=lbl;const champ=t.champion;
 const idx=lbl==='優勝'?0:lbl==='準優勝'?1:lbl==='ベスト4'?2:lbl==='ベスト8'?3:-1;let dr=idx>=0?(REP_TABLE[t.kind]||[0,0,0,0])[idx]:0;
 if(t.kind==='pref'&&idx<0&&lbl.startsWith('1'))dr=-1;if(t.kind==='koshien')dr=Math.max(dr,4);
 G.rep=clamp(G.rep+dr,0,100);
 const mvp=bestOfTourney(t);
 switch(t.kind){
  case 'district':break;
  case 'pref':if(lbl==='優勝'){G.flags.koshien=true;addNews('大会',`${G.school.name}、甲子園出場決定！`,`${t.name}で${G.school.name}が優勝し、夏の甲子園への切符をつかんだ。${mvp?mvp.name+'（'+mvp.grade+'年）が大会を通じて中心となった。':''}`,{imp:3,pid:mvp?mvp.id:null});}else{retireThirdYears('夏の大会終了');}break;
  case 'koshien':retireThirdYears('甲子園終了');if(lbl==='優勝'){G.flags.koshienWin=true;if(G.history.length&&G.history[G.history.length-1].results&&G.history[G.history.length-1].results.senbatsu==='優勝'){addNews('特集',`${G.school.name}、史上まれな春夏連覇！`,`春の選抜に続いて夏の選手権も制し、${G.school.name}が春夏連覇を達成した。${G.school.pref}の高校野球史に残る快挙。`,{imp:3,pid:mvp?mvp.id:null});}addNews('大会',`${G.school.name}、全国制覇！`,`甲子園の決勝を制し、${G.school.name}が深紅の大優勝旗を手にした。${G.school.pref}勢の快挙に学校周辺は祝賀ムードに包まれている。`,{imp:3,pid:mvp?mvp.id:null});}else addNews('大会',`${G.school.name}、甲子園は${lbl}`,`全国の舞台で${G.school.name}は${lbl}。${champ.name}（${champ.pref}）が頂点に立った。`,{imp:2,pid:mvp?mvp.id:null});break;
  case 'autumnDistrict':if(['優勝','準優勝'].includes(lbl))G.flags.autumnPref=true;break;
  case 'autumnPref':if(['優勝','準優勝'].includes(lbl)){G.flags.regional=true;addNews('大会',`${G.school.name}、秋季地区大会へ`,`${t.name}で${lbl}となり、${G.school.region}地区大会への出場を決めた。`);}break;
  case 'regional':if(lbl==='優勝')G.flags.jingu=true;if(['優勝','準優勝','ベスト4'].includes(lbl)){G.flags.senbatsuCand=true;addNews('大会',`${G.school.name}、春の選抜出場に前進`,`${t.name}で${lbl}。来春の選抜高校野球大会（春の甲子園）への出場が${lbl==='優勝'?'確実':lbl==='準優勝'?'濃厚':'有力'}となった。出場校は1月下旬に発表される。`);}break;
  case 'senbatsu':if(lbl==='優勝'){G.flags.senbatsuWin=true;addNews('大会',`${G.school.name}、選抜高校野球で優勝！`,`春の甲子園の決勝を制し、${G.school.name}が紫紺の大優勝旗を手にした。夏の春夏連覇にも期待がかかる。`,{imp:3,pid:mvp?mvp.id:null});}else addNews('大会',`${G.school.name}、選抜は${lbl}`,`春の甲子園で${G.school.name}は${lbl}。${champ.name}（${champ.pref}）が紫紺の優勝旗を手にした。`,{imp:2,pid:mvp?mvp.id:null});break;
  case 'jingu':if(lbl==='優勝')addNews('大会',`${G.school.name}が神宮大会制覇`,`秋の日本一を決める明治神宮大会で${G.school.name}が優勝した。`);break;
 }
 if(!['pref','koshien','senbatsu'].includes(t.kind)||(t.kind==='pref'&&lbl!=='優勝'))addNews('大会',`${t.name}：${champ.name}が優勝`,`${t.name}は${champ.name}（${champ.pref}）の優勝で幕を閉じた。${G.school.name}は${lbl}${mvp&&idx>=0&&idx<=1?'。'+mvp.name+'が大会を通じて活躍した':''}。`,{imp:idx===0?3:idx===1?2:1,pid:mvp&&idx<=1?mvp.id:null,avatar:idx>1||!mvp?{seed:champ.name,pref:champ.pref}:null});
 if(mvp&&idx===0&&t.imp>=1.3)mvp.star=(mvp.star||0)+1;
 G.flags.lastTourney={kind:t.kind,label:lbl};}
function bestOfTourney(t){let best=null,bv=-1;for(const g of t.userGames){if(!g.mvp)continue;const p=G.players.find(x=>x.name===g.mvp);if(!p)continue;const v=1;if(v>bv){bv=v;best=p;}}return best;}
function tourneyRoundsHtml(t){if(!t.rounds.length||!Array.isArray(t.rounds[0]))return oldRoundsHtml(t);return bracketSVG(t)+`<details style="margin-top:6px"><summary class="small muted" style="cursor:pointer">試合結果の一覧</summary>${t.rounds.map((r,i)=>`<div class="rnd"><div class="rname">${roundName(t,i)}</div>${r.filter(m=>!m.bye).map(m=>`<div class="mt ${m.user?'ours':''}"><span class="${m.w==='a'?'win':''}">${esc(m.a?m.a.name:'')}</span><span class="sc">${m.w?m.s[0]+' - '+m.s[1]:'vs'}</span><span class="${m.w==='b'?'win':''}">${esc(m.b?m.b.name:'')}</span></div>`).join('')}</div>`).join('')}</details>`;}
function oldRoundsHtml(t){let h='';t.rounds.forEach((r,i)=>{h+=`<div class="rnd"><div class="rname">${i+1}回戦</div>`;for(const m of (r.matches||[])){h+=`<div class="mt ${m.user?'ours':''}"><span class="${m.w==='a'?'win':''}">${esc(m.a.name)}</span><span class="sc">${m.w?m.s[0]+' - '+m.s[1]:'vs'}</span><span class="${m.w==='b'?'win':''}">${esc(m.b.name)}</span></div>`;}h+='</div>';});return h;}
/* トーナメント表（SVG） */
function bracketSVG(t){const P=t.P||Math.pow(2,t.rounds.length);const nR=t.rounds.length>=Math.log2(P)?Math.log2(P):Math.log2(P);const rowH=22,colW=138,left=6,top=14;const W=left+colW*(nR+1)+30,H=top+P*rowH+10;
 const cols=[];cols.push(t.slots?t.slots.map(x=>x):t.rounds[0].flatMap(m=>[m.a,m.b]));
 for(let r=0;r<nR;r++){const rd=t.rounds[r];const ws=[];for(let i=0;i<P/Math.pow(2,r+1);i++){const m=rd&&rd[i];ws.push(m&&m.w?winnerOf(m):null);}cols.push(ws);}
 const yOf=(c,j)=>top+(j+0.5)*Math.pow(2,c)*rowH;
 let svg='';
 for(let c=0;c<=nR;c++){const n=P/Math.pow(2,c);for(let j=0;j<n;j++){const x=left+c*colW;const y=yOf(c,j);const team=cols[c][j];const isSlot=c===0;const rd=c>0?t.rounds[c-1]:null;const m=rd?rd[j]:null;
   let label='';let cls='tm';if(team){label=team.name;if(team.isUser)cls+=' ours';}else if(isSlot)label='（シード）';else label='';
   if(c<nR){const nx=x+colW;const my=yOf(c+1,Math.floor(j/2));const ex=x+colW-14;svg+=`<path d="M${x+colW-26},${y} H${ex} V${my} H${nx-2}" class="bl" fill="none"/>`;
    const mm=t.rounds[c]&&t.rounds[c][Math.floor(j/2)];if(mm&&mm.s&&j%2===0){const sc=mm.w==='a'?mm.s[0]:mm.s[1];}
    if(mm&&mm.s){const mine=(j%2===0)?mm.s[0]:mm.s[1];svg+=`<text x="${ex-3}" y="${y-3}" class="bs" text-anchor="end">${mine}</text>`;}
    if(mm&&mm.user)svg+=`<circle cx="${ex}" cy="${my}" r="2.5" class="bu"/>`;}
   if(label)svg+=`<text x="${x+2}" y="${y+4}" class="${cls}${team&&c>0?' w':''}">${esc(label.length>9?label.slice(0,9)+'…':label)}</text>`;}}
 if(t.done&&t.champion)svg+=`<text x="${left+nR*colW+2}" y="${yOf(nR,0)-14}" class="bc">優勝</text>`;
 const heads=[];for(let c=1;c<=nR;c++){heads.push(`<text x="${left+c*colW+2}" y="9" class="bh">${roundName(t,c-1)}</text>`);}
 return `<div class="bracket"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="トーナメント表"><style>.tm{font-size:11px;fill:var(--ink)}.tm.ours{fill:var(--accent);font-weight:700}.tm.w{font-weight:700}.bl{stroke:var(--muted);stroke-width:1}.bs{font-size:9px;fill:var(--muted);font-family:var(--font-num)}.bu{fill:var(--accent2)}.bh{font-size:10px;fill:var(--muted);font-weight:700}.bc{font-size:11px;fill:var(--gold);font-weight:700}</style>${heads.join('')}${svg}</svg></div>`;}
/* ================= 練習試合 ================= */
function startPractice(idx){const o=G.practiceList[idx];if(!o)return 'none';if(G.practicedThisWeek)return 'done';if(G.money<o.cost.total)return 'money';spend(o.cost.total,'練習試合費用');G.practicedThisWeek=true;if(o.home)G.ground.dur=Math.max(0,G.ground.dur-6);enqueue({type:'practice',opp:o});return 'ok';}
function finishPractice(res,opp){if(res.won&&opp.strength>=72&&R()<0.4){G.rep=clamp(G.rep+1,0,100);notice(`強豪${opp.name}に勝利し評判が少し上がった。`);}addNews('練習試合',`練習試合 ${G.school.name} ${res.score[0]}-${res.score[1]} ${opp.name}`,`${G.school.name}は${opp.name}と練習試合を行い${res.won?'勝利':'敗戦'}。${res.mvpName?res.mvpName+'が活躍した。':''}`);}
function createMatch(opp,kind,label){const def=TOURNEY_DEFS[kind]||TOURNEY_DEFS.practice;const user=userRoster();const cpu=cpuRoster(opp.name,opp.strength,opp.pref);const opt={mercy:def.mercy,importance:def.imp,kind,label};return R()<0.5?new Match(user,cpu,opt):new Match(cpu,user,opt);}
