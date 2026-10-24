const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={newGame,G:()=>G,Match,cpuRoster,prepTeam,rating,pitRating,batRating};
`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const sA=parseInt(process.argv[2]||'55'),sB=parseInt(process.argv[3]||'55'),N=parseInt(process.argv[4]||'300');
let runs=[0,0],inn=0,pa=0,k=0,bb=0,h=0,hr=0,ab=0,winsA=0,mercy=0,extra=0,err=0;
let sample=null;
for(let i=0;i<N;i++){
 const A=L.cpuRoster('A',sA,'神奈川'),B=L.cpuRoster('B',sB,'神奈川');
 const M=new L.Match(A,B,{mercy:true,importance:1});M.autoUntil='end';let g=0;while(!M.done&&g++<3000)M.step();
 if(!M.done){console.log('NOT DONE');break;}
 runs[0]+=M.score[0];runs[1]+=M.score[1];inn+=M.inn;if(M.winner===0)winsA++;if(M.endReason==='コールド')mercy++;if(M.inn>9)extra++;
 for(const t of [M.A,M.B])for(const s of Object.values(t.stats)){pa+=s.pa;k+=s.so;bb+=s.bb;h+=s.h;hr+=s.hr;ab+=s.ab;}
 err+=M.log.filter(l=>l.kind==='err').length;
 if(i===0)sample=M;
}
console.log(`A(${sA}) vs B(${sB}) N=${N}: R/G A=${(runs[0]/N).toFixed(2)} B=${(runs[1]/N).toFixed(2)} winA=${(winsA/N*100).toFixed(0)}% inn/G=${(inn/N).toFixed(2)} mercy=${mercy} extra=${extra} K%=${(k/pa*100).toFixed(1)} BB%=${(bb/pa*100).toFixed(1)} AVG=${(h/ab).toFixed(3)} HR/G=${(hr/N).toFixed(2)} err/G=${(err/N).toFixed(2)}`);
if(process.argv[5]==='log'){for(const l of sample.log)console.log(l.text);}
