/* 守備側の送球判断（ユーザー守備）のエンジン＋シーン検証 */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js','08c_ui_action.js','08d_ui_field.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=`const performance={now:()=>0};const document={documentElement:{dataset:{}},body:{}};const window={};const $=()=>null;const ACT={},CHG={},INP={};const UI={};function b(){return ''}function toast(){}function saveGame(){}function openModal(){}function closeModal(){}function rk(v){return ''}function logHtml(){return ''}function rkx(){}
`+src+`
module.exports={newGame,G:()=>G,Match,cpuRoster,userRoster,AR,fwBuildScene,fwBuildRunnerScene,fwAt,fwCamTarget};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const AR=L.AR;AR.W=390;AR.H=520;
let dec=0,errs=0;const out={};const chk=(sc,label)=>{const bad=[];const c=(p,n)=>{for(let i=1;i<p.length;i++){if(!(p[i].t>=p[i-1].t))bad.push(n+' order');if(!isFinite(p[i].x)||!isFinite(p[i].y))bad.push(n+' NaN');}};c(sc.ball,'ball');for(const k in sc.fielders)c(sc.fielders[k].path,'f'+k);for(const r of sc.runners)c(r.path,'r');if(!isFinite(sc.T)||sc.T<=0)bad.push('T');for(let t=0;t<=sc.T;t+=200){const cm=L.fwCamTarget(sc,t);if(!isFinite(cm.x)||!isFinite(cm.y)||!isFinite(cm.s))bad.push('cam');}if(bad.length){errs++;if(errs<6)console.log('BAD',label,bad.slice(0,3));}};
let runsBefore=0,runsAfter=0,scoreMis=0;
for(let i=0;i<60;i++){
 const A=L.cpuRoster('A',58,'神奈川');const B=L.userRoster();B.isUser=true;
 const M=new L.Match(A,B,{mercy:true,importance:1});AR.m=M;M.askRun=false;M.askDef=true;let g=0;
 while(!M.done&&g++<2000){M.paStart();let gg=0;while(M.pa&&!M.pa.done&&gg++<40){if(M.pa.cmd==='ibb'){M.paIbb();break;}const P=M.throwPitch(null);const sw=M.cpuSwingInput(P);const ev=M.resolvePitch(P,sw);
  if(ev.decision){dec++;const d=ev.decision;if(d.kind!=='throw'){errs++;console.log('unexpected decision',d.kind);}
   if(!(d.options.length>=2&&d.options.every(o=>o.ok>=0&&o.ok<=1)))errs++;
   const s1=L.fwBuildScene(ev.bb,null,{dec:d});s1.ev=ev;chk(s1,'stage1');
   const opt=d.options[Math.floor(Math.random()*d.options.length)];const before=M.score.slice(),outsB=M.outs,basesB=M.bases.filter(Boolean).length;
   const ev2=M.finishInplay({throwTo:opt.t});const key=opt.t+':'+(ev2.text||'');out[key]=(out[key]||0)+1;
   if(!ev2.play)errs++;else{const s2=L.fwBuildScene(ev2.bb,ev2.play,{resume:s1.pauseAt,dec:d});s2.ev=ev2;chk(s2,'stage2 '+key);if(opt.t&&ev2.play.throwTo!==opt.t&&ev2.play.outs===0){errs++;console.log('throwTo missing',key);}}
   /* 整合性：走者数＋得点＋アウトの合計は保存される（打者1人追加） */const after=M.score.slice();const dR=(after[0]+after[1])-(before[0]+before[1]);const dO=M.outs-outsB;const dB=(M.inn===ev2.inn?M.bases.filter(Boolean).length:0);
   if(M.outs<3&&dO>=0){const tot=dR+dO+M.bases.filter(Boolean).length;if(tot!==basesB+1){scoreMis++;if(scoreMis<5)console.log('conservation',key,{dR,dO,bases:M.bases.filter(Boolean).length,basesB});}}
  }}}
}
console.log({dec,errs,scoreMis,out});
