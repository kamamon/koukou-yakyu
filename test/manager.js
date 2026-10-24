const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={newGame,G:()=>G,Match,cpuRoster,userRoster,isPitcher,applyMatchResult};
`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
let errs=0,games=0,pinchP=0,subs=0,decisions=0;
for(let i=0;i<150;i++){
 const u=L.userRoster();const c=L.cpuRoster('X',55,'神奈川');const M=Math.random()<0.5?new L.Match(u,c,{mercy:true,importance:1}):new L.Match(c,u,{mercy:true,importance:1});
 let g=0;
 try{
 while(!M.done&&g++<2500){
  const d=M.needsDecision();
  if(d){decisions++;
   if(d.side==='bat'){
    const r=Math.random();const t=M.bat();
    if(d.opts.includes('pinch')&&r<0.15){const np=t.bench.find(p=>!L.isPitcher(p))||t.bench[0];const slot=t.lineup[t.batIdx];if(slot.p.id===t.pitcher.id)pinchP++;M.pinchHit(t,t.batIdx,np);subs++;continue;}
    if(d.opts.includes('pinchrun')&&r<0.22){const base=[0,1,2].find(b=>M.bases[b]);const np=t.bench[0];if(np){M.pinchRun(t,base,np);subs++;}continue;}
    const cmds=['bunt','steal','hitrun'].filter(x=>d.opts.includes(x));
    M.step(r<0.5&&cmds.length?cmds[Math.floor(Math.random()*cmds.length)]:null);
   } else {
    const r=Math.random();const t=M.def();
    if(d.opts.includes('change')&&r<0.2){const rel=t.bench.find(p=>L.isPitcher(p));M.changePitcher(t,rel);subs++;continue;}
    if(d.opts.includes('timeout')&&r<0.3){M.timeout(t);continue;}
    if(d.opts.includes('infield')&&r<0.4){t.infieldIn=true;continue;}
    M.step(d.opts.includes('ibb')&&r<0.5?'ibb':null);
   }
  } else M.step();
 }
 if(!M.done){console.log('NOT DONE game',i,'inn',M.inn,'log tail',M.log.slice(-3).map(l=>l.text));errs++;}
 else{games++;const res=L.applyMatchResult(M,{importance:1,kind:'practice',label:'t'});}
 }catch(e){errs++;console.log('ERR',e.stack.split('\n').slice(0,3).join(' | '));if(errs>3)break;}
}
console.log({games,errs,pinchP,subs,decisions});
