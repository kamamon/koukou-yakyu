// 打撃成績のバランス：強打者は弱い相手を打ち込み、年間100安打に届く。両モデル（一球単位＝カード/操作、playPA＝おまかせ）で確認
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`\nfunction saveGame(){}\nmodule.exports={newGame,G:()=>G,createMatch,applyMatchResult,tourneyUserResult,userMatch,startPractice,advanceWeek,genPlayer,autoLineup,autoNumbers,active,committeeStart,committeeOptions,committeeChoose,committeeRequest,startTourney,playerWish,eventById,blankStats};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});const G=L.G();G.money=100000;
function setTeam(q){for(const p of G.players){const np=L.genPlayer({grade:p.grade,q,pos:p.pos});Object.assign(p,{bat:np.bat,pit:np.pit});p.fatigue=0;}L.autoLineup();L.autoNumbers();}
function play(oppStrength,games,pitch){const agg={pa:0,ab:0,h:0,hr:0,so:0};let runs=0;for(let g=0;g<games;g++){for(const p of G.players)p.fatigue=0;const M=L.createMatch({name:'相手',strength:oppStrength,pref:'東京'},'practice','練習試合');M.autoUntil='end';let k=0;while(!M.done&&k++<4000){if(pitch)M.stepPitchPA();else M.step();}const res=L.applyMatchResult(M,{importance:0.6,kind:'practice',label:'練習試合'});runs+=res.score[0];for(const b of res.box.bat){agg.pa+=b.pa;agg.ab+=b.ab;agg.h+=b.h;agg.hr+=b.hr;agg.so+=b.so;}}
 return {avg:agg.h/agg.ab,hrg:agg.hr/games,k:agg.so/agg.pa,rg:runs/games};}
const within=(v,lo,hi,label)=>{if(!(v>=lo&&v<=hi))throw new Error(`${label}: ${v.toFixed(3)} not in [${lo},${hi}]`);};
for(const pitch of [true,false]){const tag=pitch?'pitch':'playPA';
 setTeam(95);const s35=play(35,40,pitch),s90=play(90,40,pitch),s55=play(55,40,pitch);
 setTeam(60);const w55=play(55,40,pitch),w35=play(35,40,pitch);
 console.log(`${tag}: q95 vs35 AVG=${s35.avg.toFixed(3)} HR/G=${s35.hrg.toFixed(2)} R/G=${s35.rg.toFixed(1)} | vs55 AVG=${s55.avg.toFixed(3)} | vs90 AVG=${s90.avg.toFixed(3)} K=${(s90.k*100).toFixed(0)}% | q60 vs35 AVG=${w35.avg.toFixed(3)} vs55 AVG=${w55.avg.toFixed(3)} HR/G=${w55.hrg.toFixed(2)}`);
 within(s35.avg,0.50,0.72,tag+' q95 vs35 AVG');within(s35.hrg,2.0,8.0,tag+' q95 vs35 HR/G');
 within(s55.avg,0.40,0.62,tag+' q95 vs55 AVG');
 within(s90.avg,0.20,0.40,tag+' q95 vs90 AVG');within(s90.k,0.08,0.30,tag+' q95 vs90 K%');
 within(w55.avg,0.20,0.36,tag+' q60 vs55 AVG');within(w55.hrg,0,0.6,tag+' q60 vs55 HR/G');
 within(w35.avg,0.28,0.46,tag+' q60 vs35 AVG');
 if(!(s35.avg>s55.avg&&s55.avg>s90.avg))throw new Error(tag+': AVG should fall as opponent gets stronger');}
/* 1年間：毎週いちばん弱い相手と練習試合（カードモードのモデル）→ 主力は年間100安打に届く */
setTeam(85);for(const p of G.players){p.season=L.blankStats();p.career=L.blankStats();}let games=0;
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
const top=L.active().filter(p=>p.season.ab>0).sort((a,b)=>b.season.h-a.season.h)[0];
console.log(`season: games=${games} top=${top.name} PA${top.season.pa} H${top.season.h} HR${top.season.hr} AVG=${(top.season.h/top.season.ab).toFixed(3)}`);
if(games<45)throw new Error('too few games '+games);
if(top.season.h<95)throw new Error('top hitter should reach ~100 hits: '+top.season.h);
console.log('hits test ok');
