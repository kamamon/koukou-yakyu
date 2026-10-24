/* フィールドプレイのシーン構築をnodeで検証 */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js','08c_ui_action.js','08d_ui_field.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=`const performance={now:()=>0};const document={documentElement:{dataset:{}},body:{}};const window={};const $=()=>null;const ACT={},CHG={},INP={};const UI={};function b(){return ''}function toast(){}function saveGame(){}function openModal(){}function closeModal(){}function rk(v){return ''}function logHtml(){return ''}function rkx(){}
`+src+`
module.exports={newGame,G:()=>G,Match,cpuRoster,userRoster,AR,fwBuildScene,fwBuildRunnerScene,fwAt,fwCamTarget};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const AR=L.AR;AR.W=390;AR.H=520;
let scenes=0,errs=0,dec=0,runs=0;const kinds={};
function check(sc,label){scenes++;const bad=[];const chk=(p,n)=>{for(let i=1;i<p.length;i++){if(!(p[i].t>=p[i-1].t))bad.push(n+' time order '+i);if(!isFinite(p[i].x)||!isFinite(p[i].y))bad.push(n+' NaN');}};
 chk(sc.ball,'ball');for(const k in sc.fielders)chk(sc.fielders[k].path,'f'+k);for(const r of sc.runners)chk(r.path,'r'+r.name);
 if(!isFinite(sc.T)||sc.T<=0)bad.push('T');for(const c of sc.callouts)if(!isFinite(c.t))bad.push('callout');
 for(let t=0;t<=sc.T;t+=200){const c=L.fwCamTarget(sc,t);if(!isFinite(c.x)||!isFinite(c.y)||!isFinite(c.s))bad.push('cam '+t);}
 if(bad.length){errs++;if(errs<6)console.log('BAD',label,bad.slice(0,4),JSON.stringify(sc.ev&&sc.ev.play));}}
for(let i=0;i<40;i++){
 const A=L.cpuRoster('A',58,'神奈川');const B=L.userRoster();B.isUser=true;
 const M=new L.Match(A,B,{mercy:true,importance:1});AR.m=M;M.askRun=true;let g=0;
 while(!M.done&&g++<2000){M.paStart();let gg=0;while(M.pa&&!M.pa.done&&gg++<40){if(M.pa.cmd==='ibb'){M.paIbb();break;}const P=M.throwPitch(null);const sw=M.cpuSwingInput(P);const ev=M.resolvePitch(P,sw);
  if(ev.kind==='inplay'){const c=ev.bb;if(ev.decision){dec++;const dk=ev.decision.kind;const s1=L.fwBuildScene(c,null,{dec:ev.decision});s1.ev=ev;check(s1,'stage1 '+dk);const ev2=M.finishInplay({send:Math.random()<0.6});const s2=L.fwBuildScene(c,ev2.play,{resume:s1.pauseAt,dec:s1.decision});s2.ev=ev2;check(s2,'stage2 '+dk);kinds['dec:'+ev2.play.res+(ev2.play.runners.some(r=>r.outAt)?'+out':'')]=(kinds['dec:'+ev2.play.res+(ev2.play.runners.some(r=>r.outAt)?'+out':'')]||0)+1;}
   else{const s=L.fwBuildScene(c,ev.play,{});s.ev=ev;check(s,ev.play.res);kinds[ev.play.res]=(kinds[ev.play.res]||0)+1;}}
  if(ev.runPlay){runs++;const s=L.fwBuildRunnerScene(ev.runPlay);check(s,'run '+ev.runPlay.kind);}
  }
  if(M.pa&&!M.pa.done&&M.outs<3){/* 牽制テスト */if(M.bases[0]&&Math.random()<0.1){const r=M.pickoff();if(r.runPlay){runs++;const s=L.fwBuildRunnerScene(r.runPlay);check(s,'pickoff');}}}
 }
}
console.log({scenes,errs,dec,runs,kinds});
