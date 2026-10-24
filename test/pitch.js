/* 一球単位エンジンの統計をPA単位エンジンと比較するキャリブレーション */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={newGame,G:()=>G,Match,cpuRoster,prepTeam,rating,pitRating,batRating,PITCH_PROF};
`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const sA=parseInt(process.argv[2]||'55'),sB=parseInt(process.argv[3]||'55'),N=parseInt(process.argv[4]||'300');
function run(pitchLevel){
 let runs=[0,0],inn=0,pa=0,k=0,bb=0,h=0,hr=0,ab=0,winsA=0,np=0,d2=0,d3=0,sb=0,cs=0,err=0,hbp=0;
 const kinds={};const types={};let swings=0,whiffs=0,fouls=0,strikesLook=0,ballsN=0,inplay=0,zone=0,pitches=0;
 let sample=null;
 for(let i=0;i<N;i++){
  const A=L.cpuRoster('A',sA,'神奈川'),B=L.cpuRoster('B',sB,'神奈川');
  const M=new L.Match(A,B,{mercy:true,importance:1});M.autoUntil='end';let g=0;
  if(pitchLevel){while(!M.done&&g++<4000){M.paStart();let gg=0;while(M.pa&&!M.pa.done&&gg++<40){if(M.pa.cmd==='ibb'){M.paIbb();break;}const P=M.throwPitch(null);const sw=M.cpuSwingInput(P);pitches++;if(P.strike)zone++;const ev=M.resolvePitch(P,sw);kinds[ev.kind]=(kinds[ev.kind]||0)+1;if(sw){swings++;if(ev.kind==='miss'||ev.kind==='kSwing')whiffs++;if(ev.kind==='foul')fouls++;}if(ev.kind==='strike'||ev.kind==='kLook')strikesLook++;if(ev.kind==='ball'||ev.kind==='bb')ballsN++;if(ev.kind==='inplay'){inplay++;const t=ev.bb.type;types[t]=(types[t]||0)+1;}if(ev.runner==='sb')sb++;if(ev.runner==='cs')cs++;if(ev.decision)M.finishInplay(null);}}}
  else{while(!M.done&&g++<3000)M.step();}
  if(!M.done){console.log('NOT DONE',M.inn,M.outs);break;}
  runs[0]+=M.score[0];runs[1]+=M.score[1];inn+=M.inn;if(M.winner===0)winsA++;
  for(const t of [M.A,M.B]){for(const s of Object.values(t.stats)){pa+=s.pa;k+=s.so;bb+=s.bb;h+=s.h;hr+=s.hr;ab+=s.ab;d2+=s.d;d3+=s.tr;}for(const s of Object.values(t.pstats)){np+=s.np;}}
  err+=M.log.filter(l=>l.kind==='err').length;
  if(i===0)sample=M;
 }
 const r={mode:pitchLevel?'pitch':'PA','R/G A':(runs[0]/N).toFixed(2),'R/G B':(runs[1]/N).toFixed(2),winA:(winsA/N*100).toFixed(0)+'%',inn:(inn/N).toFixed(2),'K%':(k/pa*100).toFixed(1),'BB%':(bb/pa*100).toFixed(1),AVG:(h/ab).toFixed(3),'HR/G':(hr/N).toFixed(2),'2B/G':(d2/N).toFixed(2),'3B/G':(d3/N).toFixed(2),'NP/PA':(np/pa).toFixed(2),'E/G':(err/N).toFixed(2),'SB/G':(sb/N).toFixed(2),'CS/G':(cs/N).toFixed(2)};
 if(pitchLevel){Object.assign(r,{'zone%':(zone/pitches*100).toFixed(1),'swing%':(swings/pitches*100).toFixed(1),'whiff%':(whiffs/swings*100).toFixed(1),'foul/sw':(fouls/swings*100).toFixed(1),'inplay/PA':(inplay/pa).toFixed(2),types:Object.entries(types).map(([k,v])=>k+':'+(v/inplay*100).toFixed(0)+'%').join(' ')});}
 console.log(JSON.stringify(r));
 return sample;}
const s=run(true);
if(process.argv[5]!=='only')run(false);
if(process.argv[5]==='log'||process.argv[6]==='log'){for(const l of s.log)console.log(l.text);}
