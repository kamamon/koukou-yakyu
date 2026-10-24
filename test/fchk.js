/* 物理打球の演出タイミングを数件表示 */
const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','03b_pitch.js','03c_phys.js','04_tourney.js','05_people.js','05b_events.js','08c_ui_action.js','08d_ui_field.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=`const performance={now:()=>0};const document={documentElement:{dataset:{}},body:{}};const window={};const $=()=>null;const ACT={},CHG={},INP={};const UI={};function b(){return ''}function toast(){}function saveGame(){}function openModal(){}function closeModal(){}function rk(v){return ''}function logHtml(){return ''}function rkx(){}
`+src+`
module.exports={newGame,G:()=>G,Match,cpuRoster,userRoster,AR,fwBuildScene,fwAt};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const AR=L.AR;AR.W=390;AR.H=520;const seen={};
for(let i=0;i<6;i++){const A=L.cpuRoster('A',58,'神奈川');const B=L.userRoster();B.isUser=true;const M=new L.Match(A,B,{mercy:true,importance:1});AR.m=M;let g=0;
 while(!M.done&&g++<2000){M.paStart();let gg=0;while(M.pa&&!M.pa.done&&gg++<40){if(M.pa.cmd==='ibb'){M.paIbb();break;}const P=M.throwPitch(null);const sw=M.cpuSwingInput(P);const ev=M.resolvePitch(P,sw);
  if(ev.kind==='inplay'&&!ev.decision){const c=ev.bb;const k=ev.play.res+':'+c.type;if(seen[k])continue;seen[k]=1;const s=L.fwBuildScene(c,ev.play,{});
   const apex=Math.max(...s.ball.map(b=>b.z||0));const last=s.ball[s.ball.length-1];
   console.log(k.padEnd(10),`ev${c.ev} la${c.la} a${c.a} dist${c.dist}`,`pts=${s.ball.length} apex=${apex.toFixed(1)} end=(${last.x.toFixed(0)},${last.y.toFixed(0)},${(last.z||0).toFixed(1)}) t=${(last.t/1000).toFixed(2)}s T=${(s.T/1000).toFixed(2)}s Tpick=${s.Tpick?(s.Tpick/1000).toFixed(2):'-'} hrCross=${s.hrCross?(s.hrCross/1000).toFixed(2):'-'}`);}}}}
