/* 強豪校で数年回し、選抜の選考・大会・春夏連覇の流れを検証 */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`;function saveGame(){};module.exports={eventById,newGame,advanceWeek,G:()=>G,createMatch,applyMatchResult,tourneyUserResult,userMatch,setCamp,u18Resolve,committeeStart,committeeOptions,committeeChoose,committeeRequest,startTourney,graduate,playerWish,active,isPitcher,startPractice,finishPractice};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'強豪学園',pref:'大阪',type:'私立',size:'大',hensachi:55,mode:'elite'});const G=L.G();
let sel={},tourn=0,wins=0,games=0;
function playUserMatch(){const t=G.tourney;const um=L.userMatch(t);const opp=um.a.isUser?um.b:um.a;const M=L.createMatch(opp,t.kind,t.name);M.autoUntil='end';let g=0;while(!M.done&&g++<2000)M.step();const res=L.applyMatchResult(M,{importance:t.imp,kind:t.kind,label:t.name});games++;if(res.won)wins++;L.tourneyUserResult(res);}
function handleQueue(){let guard=0;while(G.queue.length&&guard++<200){const ev=G.queue[0];switch(ev.type){
 case 'entrance':case 'yearEnd':case 'msg':case 'practice':case 'draft':case 'goal':G.queue.shift();break;
 case 'tourney':{const t=G.tourney;if(t.kind==='senbatsu')tourn++;let g2=0;while(!t.done&&L.userMatch(t)&&g2++<20)playUserMatch();if(!t.done)throw new Error('tourney stuck '+t.kind);G.queue.shift();break;}
 case 'camp':{G.queue.shift();break;}
 case 'u18':{L.u18Resolve(ev.ids);G.queue.shift();break;}
 case 'budget':{L.committeeStart();for(let i=0;i<3;i++){const o=L.committeeOptions();L.committeeChoose(o[0].id);}L.committeeRequest(15);G.queue.shift();break;}
 case 'invite':{L.startTourney('invite2');G.queue.shift();break;}
 case 'career':{for(const p of G.players.filter(p=>p.grade===3))p.path=L.playerWish(p);G.queue.shift();break;}
 case 'event':{const e=L.eventById(ev.id);const p=ev.pid?G.players.find(x=>x.id===ev.pid):null;const c=e.choices[0];c.eff(p);G.queue.shift();break;}
 case 'graduation':{const th=G.players.filter(p=>p.grade===3);for(const p of th){L.graduate(p,p.path||L.playerWish(p));}G.players=G.players.filter(p=>p.grade!==3);G.queue.shift();break;}
 default:throw new Error('unknown event '+ev.type);}}}
const years=parseInt(process.argv[2]||'6');
for(let w=0;w<48*years;w++){
 for(const p of G.players){if(p.retired||p.injury)continue;p.training=L.isPitcher(p)?'pitch':'bat';}
 const ok=L.advanceWeek();if(!ok){handleQueue();L.advanceWeek();}
 handleQueue();
 if(G.month===1&&G.week===4&&G.flags.senbatsu){sel[G.flags.senbatsu.type]=(sel[G.flags.senbatsu.type]||0)+1;}
 if(G.month===3&&G.week===4){console.log(`Y${G.year} ${G.calYear}: strength=${G.rep} results=${JSON.stringify(G.results)} senbatsu=${G.flags.senbatsu?G.flags.senbatsu.type:'-'}`);}
 if(G.gameOver)break;
}
console.log({sel,senbatsuTourneys:tourn,games,wins});
const sn=G.news.filter(n=>/選抜|春夏連覇|21世紀枠|神宮枠/.test(n.title)).map(n=>n.title);console.log('news:',sn.slice(0,12));
