// オーダーの扱い：監督の決めたオーダーを勝手に変えない／適性のない位置に就かせない／投手を強制9番にしない／DH制
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js','05c_story.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`\nfunction saveGame(){}\nmodule.exports={newGame,G:()=>G,autoLineup,ensureLineup,effectiveLineup,repairLineup,setDH,userRoster,createMatch,applyMatchResult,posFit,active,healthy,isPitcher,batRating,pitRating,genPlayer,cpuRoster,lineupValid,lineupHasDH,autoNumbers,hireCoach,refreshMarkets,advanceWeek,Match,prepTeam};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
const assert=(c,msg)=>{if(!c)throw new Error(msg);};
let unfamiliar=0,checks=0,pitcherSlots={};
for(let seed=1;seed<=40;seed++){Math.random=mulberry32(seed);L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});const G=L.G();
 L.autoLineup();assert(L.lineupValid(),'auto lineup invalid seed '+seed);
 const a=L.active();
 /* 1) 適性のある選手がいるのに不慣れな位置に就かせていないか */
 for(const s of G.lineup){if(s.pos==='投'||s.pos==='指')continue;const p=a.find(x=>x.id===s.pid);checks++;
  if(L.posFit(p,s.pos)<0.85){const fitting=L.healthy().filter(x=>!G.lineup.some(y=>y.pid===x.id)&&x.id!==G.sp&&L.posFit(x,s.pos)>=0.85);if(fitting.length)unfamiliar++;}}
 const pi=G.lineup.findIndex(s=>s.pos==='投');pitcherSlots[pi+1]=(pitcherSlots[pi+1]||0)+1;}
console.log('unfamiliar placements with a fitting bench player available:',unfamiliar,'/',checks,' pitcher batting slots:',JSON.stringify(pitcherSlots));
assert(unfamiliar===0,'auto lineup placed players out of position although fitting players were available');
/* 2) 打撃のいい投手は9番に固定されない */
Math.random=mulberry32(77);L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});let G=L.G();
{const ace=L.active().filter(L.isPitcher).sort((x,y)=>L.pitRating(y)-L.pitRating(x))[0];for(const k of ['meetR','meetL','powR','powL','eye','clutch'])ace.bat[k]=95;ace.pit.velo=150;for(const k of ['stamina','hitR','hitL','kR','kL','hrR','hrL'])ace.pit[k]=95;L.autoLineup();
 const i=G.lineup.findIndex(s=>s.pid===ace.id);console.log('two-way ace bats',i+1);assert(i>=0&&i<=4,'two-way ace should bat in the top 5, got '+(i+1));}
/* 3) ケガ人が出てもオーダー（計画）は変わらず、その試合だけ代役。回復すれば元に戻る */
L.autoLineup();const plan=JSON.stringify(G.lineup);const victim=L.active().find(p=>p.id===G.lineup[3].pid);victim.injury=3;
L.ensureLineup();assert(JSON.stringify(G.lineup)===plan,'plan changed after an injury');
let ef=L.effectiveLineup();assert(ef.slots[3].p.id!==victim.id&&ef.slots[3].orig===victim,'stand-in not applied');
const standIn=ef.slots[3].p;assert(L.posFit(standIn,ef.slots[3].pos)>=0.85||!L.healthy().some(x=>L.posFit(x,ef.slots[3].pos)>=0.85&&!ef.slots.some(s=>s.p===x)),'stand-in should fit the position when possible');
const ur=L.userRoster();assert(!ur.lineup.some(s=>s.p.id===victim.id),'injured player in match roster');
victim.injury=0;ef=L.effectiveLineup();assert(ef.slots[3].p.id===victim.id,'recovered player should return');
/* 4) 監督の交代・新年度でもオーダーは変わらない */
L.refreshMarkets();if(G.coachMarket.length){G.money=1e6;L.hireCoach(0);}assert(JSON.stringify(G.lineup)===plan,'plan changed after hiring a coach');
/* 5) 選手がいなくなったら、その穴だけを埋める */
const gone=G.lineup[6].pid;G.players=G.players.filter(p=>p.id!==gone);L.repairLineup(true);
const after=G.lineup;const before=JSON.parse(plan);let same=0;for(let i=0;i<9;i++)if(i!==6&&after[i].pid===before[i].pid&&after[i].pos===before[i].pos)same++;
assert(same===8&&after[6].pid!==gone&&after[6].pos===before[6].pos,'repair should only fill the hole');
/* 6) DH制：投手は打席に立たず、試合が最後まで進む */
G.dh=true;const r=L.setDH(true);G.lineup=r.L;G.sp=r.sp;assert(L.lineupValid()&&L.lineupHasDH(),'DH lineup invalid');
const ur2=L.userRoster();assert(!ur2.lineup.some(s=>s.p.id===ur2.pitcher.id),'pitcher should not bat with DH');assert(ur2.lineup.some(s=>s.pos==='指'),'DH slot missing');
let dhGames=0,pitBat=0;for(let g=0;g<20;g++){const M=L.createMatch({name:'相手'+g,strength:60,pref:'東京'},'practice','練習試合');M.autoUntil='end';let k=0;while(!M.done&&k++<4000)M.step();assert(M.done,'DH match did not finish');const u=M.A.isUser?M.A:M.B;if(u.dh)dhGames++;const sp=u.startPitcher;if(u.stats[sp.id]&&u.stats[sp.id].pa>0)pitBat++;}
assert(dhGames===20&&pitBat===0,'with DH the starting pitcher must not bat: '+pitBat);
G.dh=false;const r2=L.setDH(false);G.lineup=r2.L;G.sp=r2.sp;assert(L.lineupValid()&&!L.lineupHasDH(),'non-DH lineup invalid');
/* 7) CPU：DH制は一部の学校が採用、打順は能力順（投手が9番とは限らない） */
let cpuDH=0;for(let i=0;i<60;i++){const t=L.cpuRoster('学校'+i,70,'東京');if(t.lineup.some(s=>s.pos==='指'))cpuDH++;assert(t.lineup.length===9,'cpu lineup size');}
console.log('cpu DH teams',cpuDH,'/ 60');assert(cpuDH>=25&&cpuDH<=55,'cpu DH share out of range');
/* 8) 代打で捕手に外野手を入れても、次の守備では適性のある選手が守る */
Math.random=mulberry32(5);L.autoLineup();const M=L.createMatch({name:'相手',strength:55,pref:'東京'},'practice','練習試合');const u=M.A.isUser?M.A:M.B;
const ci=u.lineup.findIndex(s=>s.pos==='捕');const ph=u.bench.find(p=>!L.isPitcher(p)&&L.posFit(p,'捕')<0.85&&p.pos!=='捕');const bc=u.bench.find(p=>p.pos==='捕'||p.sub.includes('捕'));
if(ph&&bc){M.pinchHit(u,ci,ph);assert(u.realign,'realign flag');M.realignDefense(u);const c=u.lineup.find(s=>s.pos==='捕');assert(L.posFit(c.p,'捕')>=0.85,'catcher slot should be filled by a fitting player after realign');console.log('realign ok:',M.log.filter(l=>l.kind==='sub').map(l=>l.text).join(' / '));}
else console.log('realign scenario skipped (no suitable bench)');
console.log('lineup test ok');
