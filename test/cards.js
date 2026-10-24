/* カード効果の検証：同じ対戦でカードあり／なしの結果分布を比較 */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`;function saveGame(){};module.exports={newGame,G:()=>G,Match,cpuRoster,CARD_DEFS,drawCard};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const N=parseInt(process.argv[2]||'3000');
function trial(offId,defId,lv,setup){const cnt={};let pa=0,np=0,sb=0,cs=0,runs=0;
 for(let i=0;i<N;i++){const A=L.cpuRoster('A',58,'神奈川'),B=L.cpuRoster('B',58,'神奈川');const M=new L.Match(A,B,{mercy:true,importance:1});M.autoUntil='end';
  for(const p of M.A.lineup.concat(M.B.lineup).map(s=>s.p)){p.trust=60;}
  if(setup)setup(M);
  const off=offId?{id:offId,lv}:null,def=defId?{id:defId,lv}:null;
  const r=M.cardPA(off,def);const res=r.ev.res||r.ev.kind;cnt[res]=(cnt[res]||0)+1;pa++;np+=r.seq.length;for(const x of r.seq){if(x.ev.runner==='sb')sb++;if(x.ev.runner==='cs')cs++;}runs+=M.score[0];}
 const pct=k=>((cnt[k]||0)/pa*100).toFixed(1);
 return {K:pct('K'),BB:pct('BB'),H:(((cnt['1B']||0)+(cnt['2B']||0)+(cnt['3B']||0)+(cnt['HR']||0))/pa*100).toFixed(1),HR:pct('HR'),'2B':pct('2B'),GO:pct('GO'),FO:pct('FO'),E:pct('E'),SAC:pct('SAC'),np:(np/pa).toFixed(2),sb,cs,runs};}
const base=trial(null,null,3);console.log('base      ',base);
for(const id of ['power','meet','wait','first','ground','oppo','pull']){console.log(id.padEnd(10),trial(id,null,3));}
console.log('--- 守備');
for(const id of ['strikefirst','low','dirty','contact','strikeout','change','straight','careful','fullpower','inside','outside']){console.log(id.padEnd(10),trial(null,id,3));}
console.log('--- 走者一塁');
const r1=M=>{M.bases[0]=M.A.lineup[8].p;};
console.log('base r1   ',trial(null,null,3,r1));console.log('bunt      ',trial('bunt',null,3,r1));console.log('steal     ',trial('steal',null,3,r1));console.log('hitrun    ',trial('hitrun',null,3,r1));console.log('aggrorun  ',trial('aggrorun',null,3,M=>{M.bases[1]=M.A.lineup[8].p;}));
console.log('demon     ',trial('demon',null,3));console.log('demon lv5 ',trial('demon',null,5));
console.log('lv1 power ',trial('power',null,1));console.log('lv5 power ',trial('power',null,5));
