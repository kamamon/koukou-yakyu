// 自動シミュレーションテスト（ロジックのみ）
const fs=require('fs');
const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={eventById,newGame,advanceWeek,G:()=>G,createMatch,applyMatchResult,tourneyUserResult,userMatch,setCamp,u18Resolve,committeeStart,committeeOptions,committeeChoose,committeeRequest,startTourney,graduate,playerWish,active,rating,teamStrength,yen,candNegotiate,candVisit,buyFacility,hireCoach,hireScout,refreshMarkets,startPractice,finishPractice,autoLineup,letter,isPitcher,Match,cpuRoster,userRoster};
`;
const m={exports:{}};
new Function('module','require',code)(m,require);
const L=m.exports;
const years=parseInt(process.argv[2]||'5');
const seedCfg={name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55};
L.newGame(seedCfg);
let G=L.G();
let matches=0,wins=0,runsFor=0,runsAgainst=0,innings=0,ks=0,bbs=0,hrs=0,pas=0,hits=0;
function playUserMatch(ctx){
 const t=G.tourney;const um=L.userMatch(t);const opp=um.a.isUser?um.b:um.a;
 const M=L.createMatch(opp,t.kind,t.name);M.autoUntil='end';let guard=0;
 while(!M.done&&guard++<2000)M.step();
 if(!M.done)throw new Error('match did not finish');
 const res=L.applyMatchResult(M,{importance:t.imp,kind:t.kind,label:t.name});
 matches++;if(res.won)wins++;runsFor+=res.score[0];runsAgainst+=res.score[1];innings+=M.inn;
 for(const b of res.box.bat){pas+=b.pa;ks+=b.so;bbs+=b.bb;hrs+=b.hr;hits+=b.h;}
 L.tourneyUserResult(res);
}
function handleQueue(){
 let guard=0;
 while(G.queue.length&&guard++<200){
  const ev=G.queue[0];
  switch(ev.type){
   case 'entrance':case 'yearEnd':case 'msg':G.queue.shift();break;
   case 'tourney':{const t=G.tourney;let g2=0;while(!t.done&&L.userMatch(t)&&g2++<20)playUserMatch();if(!t.done)throw new Error('tourney stuck '+t.kind);G.queue.shift();break;}
   case 'practice':{G.queue.shift();break;}
   case 'camp':{if(G.money>60)L.setCamp('local',1);G.queue.shift();break;}
   case 'u18':{L.u18Resolve(ev.ids);G.queue.shift();break;}
   case 'budget':{L.committeeStart();for(let i=0;i<3;i++){const o=L.committeeOptions();const best=o.sort((a,b)=>b.delta-a.delta)[0];L.committeeChoose(best.id);}L.committeeRequest(15);G.queue.shift();break;}
   case 'invite':{L.startTourney('invite2');G.queue.shift();break;}
   case 'career':{for(const p of G.players.filter(p=>p.grade===3))p.path=L.playerWish(p);G.queue.shift();break;}
   case 'draft':{G.queue.shift();break;}
   case 'event':{const e=L.eventById(ev.id);const p=ev.pid?G.players.find(x=>x.id===ev.pid):null;const c=e.choices[Math.floor(Math.random()*e.choices.length)];c.eff(p);G.queue.shift();break;}
   case 'graduation':{const th=G.players.filter(p=>p.grade===3);for(const p of th){L.graduate(p,p.path||L.playerWish(p));}G.players=G.players.filter(p=>p.grade!==3);G.queue.shift();break;}
   default:throw new Error('unknown event '+ev.type);
  }
 }
}
const totalWeeks=years*48;
for(let w=0;w<totalWeeks;w++){
 handleQueue();
 // simple AI management each week
 if(G.week===1){ // monthly decisions
  for(const k of ['bullpen','machine','weight','medical','indoor']){if(!G.fac[k]&&G.money>400){L.buyFacility(k,1);}}
  if(G.money>1200&&G.coach.level<5&&G.coachMarket.length){L.hireCoach(0);}
  if(G.money>800&&!G.scout&&G.scoutMarket.length){L.hireScout(0);}
  // scouting
  for(const c of G.candidates){if(c.signed||c.lost)continue;if(G.money>100&&['S','A','B','C'].includes(c.rank))L.candNegotiate(c,false);}
 }
 // training assignment
 for(const p of G.players){if(p.retired||p.injury)continue;if(p.fatigue>70)p.training='rest';else p.training=L.isPitcher(p)?(G.coach.level>=3&&Math.random()<0.4?'brk':'pitch'):(Math.random()<0.5?'bat':Math.random()<0.5?'field':'run');}
 // practice game sometimes
 if(G.week===2&&G.money>100&&!G.queue.length){const idx=0;const st=L.startPractice(idx);if(st==='ok'){const ev=G.queue[0];const opp=ev.opp;const M=L.createMatch(opp,'practice','練習試合');M.autoUntil='end';let g=0;while(!M.done&&g++<2000)M.step();const res=L.applyMatchResult(M,{importance:0.6,kind:'practice',label:'練習試合'});L.finishPractice(res,opp);G.queue.shift();matches++;if(res.won)wins++;}}
 const ok=L.advanceWeek();
 if(!ok){handleQueue();L.advanceWeek();}
 if(G.month===3&&G.week===4){
  const a=L.active();
  const byG=[1,2,3].map(g=>{const ps=a.filter(p=>p.grade===g);return ps.length?(ps.reduce((s,p)=>s+L.rating(p),0)/ps.length).toFixed(1):'-';});
  console.log(`Y${G.year} ${G.calYear}: rep=${G.rep} money=${L.yen(G.money)} budget=${L.yen(G.budget)} strength=${L.teamStrength()} grades=${byG.join('/')} coachLv=${G.coach.level} scout=${G.scout?G.scout.level:'-'} results=${JSON.stringify(G.results)} grads=${G.graduates.length} recruits=${G.recruits.length} players=${G.players.length}`);
 }
}
console.log(`matches=${matches} wins=${wins} R/G=${(runsFor/matches).toFixed(2)} RA/G=${(runsAgainst/matches).toFixed(2)} inn/G=${(innings/matches).toFixed(1)} K%=${(ks/pas*100).toFixed(1)} BB%=${(bbs/pas*100).toFixed(1)} HR/G=${(hrs/matches).toFixed(2)} AVG=${(hits/(pas-bbs)).toFixed(3)}`);
console.log('graduates sample:',G.graduates.slice(0,5).map(g=>g.name+':'+g.path+'/'+g.level+' '+g.timeline.map(t=>t.t).join('|')));
console.log('news count',G.news.length,'notices',G.notices.slice(0,3).map(n=>n.m));
const sz=JSON.stringify(G).length;console.log('save size KB',(sz/1024).toFixed(0));
