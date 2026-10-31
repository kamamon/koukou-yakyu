// 打撃バランス：強打者は格下相手を打ち込み、S級のスラッガーは年間100本塁打も狙える。両モデル（一球単位＝カード/操作、playPA＝おまかせ）で確認
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`\nfunction saveGame(){}\nmodule.exports={newGame,G:()=>G,createMatch,applyMatchResult,tourneyUserResult,userMatch,startPractice,advanceWeek,genPlayer,autoLineup,autoNumbers,active,committeeStart,committeeOptions,committeeChoose,committeeRequest,startTourney,playerWish,eventById,blankStats,isPitcher};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
let G;
function fresh(seed){Math.random=mulberry32(seed);L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});G=L.G();G.money=100000;}
function setTeam(q){for(const p of G.players){const np=L.genPlayer({grade:p.grade,q,pos:p.pos});Object.assign(p,{bat:np.bat,pit:np.pit});p.fatigue=0;p.abilities=[];p.unique=[];}L.autoLineup();L.autoNumbers();}
function playGames(oppStrength,games,pitch,track){const agg={pa:0,ab:0,h:0,hr:0,so:0};const st={g:0,pa:0,ab:0,h:0,hr:0};let runs=0;
 for(let g=0;g<games;g++){for(const p of G.players){p.fatigue=0;p.injury=0;}const M=L.createMatch({name:'相手',strength:oppStrength,pref:'東京'},'practice','練習試合');M.autoUntil='end';let k=0;while(!M.done&&k++<4000){if(pitch)M.stepPitchPA();else M.step();}
  const res=L.applyMatchResult(M,{importance:0.6,kind:'practice',label:'練習試合'});runs+=res.score[0];for(const b of res.box.bat){agg.pa+=b.pa;agg.ab+=b.ab;agg.h+=b.h;agg.hr+=b.hr;agg.so+=b.so;if(track&&b.name===track){st.g++;st.pa+=b.pa;st.ab+=b.ab;st.h+=b.h;st.hr+=b.hr;}}}
 return {avg:agg.h/agg.ab,hrg:agg.hr/games,k:agg.so/agg.pa,rg:runs/games,star:st};}
const within=(v,lo,hi,label)=>{if(!(v>=lo&&v<=hi))throw new Error(`${label}: ${v.toFixed(3)} not in [${lo},${hi}]`);};
for(const pitch of [true,false]){const tag=pitch?'pitch':'playPA';
 /* チーム全体の打率（能力×相手の強さ） */
 fresh(11);setTeam(95);const s35=playGames(35,30,pitch),s55=playGames(55,30,pitch),s90=playGames(90,30,pitch);
 fresh(12);setTeam(60);const w35=playGames(35,30,pitch),w55=playGames(55,30,pitch);
 console.log(`${tag} grid: q95 vs35 AVG=${s35.avg.toFixed(3)} HR/G=${s35.hrg.toFixed(1)} | vs55 AVG=${s55.avg.toFixed(3)} | vs90 AVG=${s90.avg.toFixed(3)} K=${(s90.k*100).toFixed(0)}% | q60 vs35 AVG=${w35.avg.toFixed(3)} vs55 AVG=${w55.avg.toFixed(3)} HR/G=${w55.hrg.toFixed(2)}`);
 within(s35.avg,0.55,0.85,tag+' q95 vs35 AVG');within(s55.avg,0.45,0.78,tag+' q95 vs55 AVG');within(s90.avg,0.24,0.52,tag+' q95 vs90 AVG');within(s90.k,0.05,0.30,tag+' q95 vs90 K%');
 within(w35.avg,0.28,0.48,tag+' q60 vs35 AVG');within(w55.avg,0.20,0.37,tag+' q60 vs55 AVG');within(w55.hrg,0,1.3,tag+' q60 vs55 HR/G');
 if(!(s35.avg>s55.avg&&s55.avg>s90.avg))throw new Error(tag+': AVG should fall as opponent gets stronger');
 /* 平均的なチームに1人だけS級スラッガー：相手が弱いほど本塁打が増え、1試合1本以上 */
 const star=(pw)=>{fresh(20+pw);setTeam(60);const p=G.players.find(x=>!L.isPitcher(x)&&x.grade===3)||G.players.find(x=>!L.isPitcher(x));for(const k of ['meetR','meetL','powR','powL','eye','clutch'])p.bat[k]=pw;p.bat.speed=Math.max(p.bat.speed,70);L.autoLineup();L.autoNumbers();return p.name;};
 const n95=star(95);const a35=playGames(35,40,pitch,n95).star,a55=playGames(55,40,pitch,n95).star,a90=playGames(90,40,pitch,n95).star;
 const n75=star(75);const b55=playGames(55,40,pitch,n75).star;
 const hrg=s=>s.hr/Math.max(1,s.g);
 console.log(`${tag} star95: vs35 HR/G=${hrg(a35).toFixed(2)} AVG=${(a35.h/a35.ab).toFixed(3)} | vs55 HR/G=${hrg(a55).toFixed(2)} | vs90 HR/G=${hrg(a90).toFixed(2)} || star75 vs55 HR/G=${hrg(b55).toFixed(2)}`);
 if(a35.g<30||a55.g<30||a90.g<30||b55.g<30)throw new Error(tag+': star not in lineup');
 within(hrg(a35),1.0,2.8,tag+' star95 vs35 HR/G');within(hrg(a55),0.5,2.0,tag+' star95 vs55 HR/G');within(hrg(a90),0.05,0.7,tag+' star95 vs90 HR/G');
 within(a35.h/a35.ab,0.55,0.9,tag+' star95 vs35 AVG');within(hrg(b55),0,0.4,tag+' star75 vs55 HR/G');
 if(!(hrg(a35)>hrg(a55)&&hrg(a55)>hrg(a90)))throw new Error(tag+': HR should fall as opponent gets stronger');}
/* 1年間：毎週いちばん弱い相手と練習試合（カードモードのモデル）→ 主力は年間100安打、スラッガーは本塁打を量産 */
fresh(99);setTeam(85);for(const p of G.players){p.season=L.blankStats();p.career=L.blankStats();}let games=0;
function runMatch(opp,kind,label){const M=L.createMatch(opp,kind,label);M.autoUntil='end';let k=0;while(!M.done&&k++<4000)M.stepPitchPA();const res=L.applyMatchResult(M,{importance:1,kind,label});games++;return res;}
function handleQueue(){let guard=0;while(G.queue.length&&guard++<200){const ev=G.queue[0];switch(ev.type){
 case 'tourney':{const t=G.tourney;let g2=0;while(!t.done&&L.userMatch(t)&&g2++<20){const um=L.userMatch(t);const opp=um.a.isUser?um.b:um.a;L.tourneyUserResult(runMatch(opp,t.kind,t.name));}G.queue.shift();break;}
 case 'practice':{runMatch(ev.opp,'practice','練習試合');G.queue.shift();break;}
 case 'budget':{L.committeeStart();for(let i=0;i<3;i++){const o=L.committeeOptions();L.committeeChoose(o.sort((a,b)=>b.delta-a.delta)[0].id);}L.committeeRequest(15);G.queue.shift();break;}
 case 'invite':{L.startTourney('invite2');G.queue.shift();break;}
 case 'career':{for(const p of G.players.filter(p=>p.grade===3))p.path=L.playerWish(p);G.queue.shift();break;}
 case 'event':{const e=L.eventById(ev.id);const p=ev.pid?G.players.find(x=>x.id===ev.pid):null;e.choices[0].eff(p);G.queue.shift();break;}
 default:G.queue.shift();}}}
for(let w=0;w<48;w++){handleQueue();if(G.month===3&&G.week===3)break;
 if(!G.queue.length){const list=G.practiceList.map((o,i)=>({o,i})).sort((a,b)=>a.o.strength-b.o.strength);if(L.startPractice(list[0].i)==='ok')handleQueue();}
 for(const p of G.players)p.fatigue=Math.max(0,p.fatigue-30);
 if(!L.advanceWeek()){handleQueue();L.advanceWeek();}}
const act=L.active().filter(p=>p.season.ab>0);const topH=act.slice().sort((a,b)=>b.season.h-a.season.h)[0];const topHR=act.slice().sort((a,b)=>b.season.hr-a.season.hr)[0];
console.log(`season: games=${games} hits top=${topH.name} H${topH.season.h} | HR top=${topHR.name} pow${Math.round((topHR.bat.powR+topHR.bat.powL)/2)} HR${topHR.season.hr} in ${topHR.season.g}G`);
if(games<45)throw new Error('too few games '+games);
if(topH.season.h<95)throw new Error('top hitter should reach ~100 hits: '+topH.season.h);
if(topHR.season.hr<35)throw new Error('top slugger should hit plenty of HR: '+topHR.season.hr);
console.log('hits test ok');
