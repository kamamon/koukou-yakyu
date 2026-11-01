/* ================= 試合の場面とモーションをつなぐ（v25） =================
 投球の場面：投手・打者・捕手・野手・走者・審判の動きを、投球の時刻（AR.windT0・AR.t0・AR.swingT）に合わせて組み立てる。
 時刻はすべて performance.now() の ms。投球の動作はリリースの時刻（windT0+arWindDur()）にそろえる。
 ボール：手に持っている間は手の位置、リリースはその時刻の手の位置から、捕手が捕ったらミットの中。 */
const PL={key:null,ctx:null,rigs:{},relKey:null,rel:null};
/* 追加のリグ（審判4人目・塁コーチなど）を必要なときだけ作る */
function plRig(key,setup){let r=PL.rigs[key];if(!r||r._model!==actionSettings().model3d||(GL.ready&&!(r instanceof R3RigGL)&&actionSettings().model3d!=='chibi')){if(r&&r.g.parent)r.g.parent.remove(r.g);r=r3NewRig();r._model=actionSettings().model3d;R3.scene.add(r.g);PL.rigs[key]=r;if(setup)setup(r);}return r;}
function plUseMotion(){return actionSettings().model3d!=='chibi'&&typeof moFrame==='function';}
/* 守備位置（状況で動かす）：走者一塁で併殺態勢、一塁手は走者を抑える */
function plDefPos(d,m){const P=fwDefPos(d);if(!m)return P;const B=m.bases;const dp=B[0]&&m.outs<2&&!d.infieldIn;if(dp){P['二']=[9.2,36.2];P['遊']=[-9.2,36.2];}
 if(B[0]&&!B[1])P['一']=[20.6,19.2];return P;}
/* 投球の場面の計画（キーが変わったときだけ作り直す） */
function plPitchPlan(now){const m=AR.m,d=m.def(),tb=m.bat(),pa=m.pa;const ph=AR.phase;const P=AR.cur;
 if((ph==='pre'||ph==='gauge')&&PL.retUntil&&now<PL.retUntil&&PL.ctx)return PL.ctx;
 const key=[AR.windT0||0,AR.swingT||0,P?P.n:0,ph==='pre'||ph==='gauge'||ph==='idle'?'pre':'go',m.bases.map(b=>b?b.id:0).join(','),pa?pa.b.id:0,AR.ev?AR.ev.kind:'',m.outs].join('|');
 if(PL.key===key&&PL.ctx)return PL.ctx;PL.key=key;
 const ents={};const hs=pa&&pa.p.throws==='左'?-1:1;const hand=pa?pa.bHand:'右';const bs=hand==='左'?-1:1;
 const go=!(ph==='pre'||ph==='gauge'||ph==='idle')&&AR.windT0;const W=arWindDur();const tRel=go?AR.windT0+W:now+1e9;
 const T0=go?AR.windT0:now-100;const FAR=now+1e8;
 /* 投手：セット→（投球）→フォロー→守備姿勢→投手板へ戻る */
 const pRoot=[0,R3C.RUBBER-0.15];const pSeg=[];
 if(!go){pSeg.push({k:'pose',pose:'p_setpos',t0:T0-5000,t1:FAR,x:pRoot[0],y:pRoot[1],yaw:0,edit:(Q,t)=>plIdleSet(Q,t)});}
 else{/* 着地まで（クリップ0〜860ms）を W-140ms に、着地〜リリースは実時間で */const A=Math.max(200,W-140);
  pSeg.push({k:'pose',pose:'p_setpos',t0:T0-5000,t1:T0,x:pRoot[0],y:pRoot[1],yaw:0,edit:(Q,t)=>plIdleSet(Q,t)});
  pSeg.push({k:'clip',clip:'p_set_'+r3PitForm(pa?pa.p:d.pitcher),t0:T0,t1:tRel+700,x:pRoot[0],y:pRoot[1],yaw:0,fade:60,warp:[[0,0],[A,860],[A+140,1000]]});
  const e=MODEF.p_set.end;const o=moL2F(e.dx,e.dz,0,hs);const fx=pRoot[0]+o[0],fy=pRoot[1]+o[1];
  const back=[{t:tRel+900,x:fx,y:fy},{t:tRel+1700,x:pRoot[0],y:pRoot[1]+0.05}];
  pSeg.push({k:'pose',pose:'f_ready',t0:tRel+700,t1:tRel+900,x:fx,y:fy,yaw:0,fade:200});
  pSeg.push({k:'move',t0:tRel+900,t1:tRel+1700,path:back,face:{mode:'yaw',yaw:0},style:'walk',fade:200});
  pSeg.push({k:'pose',pose:'p_setpos',t0:tRel+1700,t1:FAR,x:pRoot[0],y:pRoot[1],yaw:0,fade:350,edit:(Q,t)=>plIdleSet(Q,t)});}
 ents.P={ts:1,mir:hs,segs:pSeg,look:[{t0:-1e12,t1:1e12,target:()=>[0,0,1.0],w:0.6}]};
 /* 捕手：しゃがんでミットを構える。投球はミットで受ける */
 ents.C={ts:1,mir:1,segs:[{k:'pose',pose:'c_crouch',t0:T0-5000,t1:FAR,x:0,y:-0.85,yaw:Math.PI,edit:(Q,t)=>moBreath(Q,t,0.4)}],ik:[{t0:-1e12,t1:1e12,side:'l',fade:1,target:t=>plMittTarget(t)}],look:[{t0:-1e12,t1:1e12,target:()=>R3.ballF||[0,18,1.7],w:0.75}]};
 /* 返球：捕手が立ち上がって投手へ投げ、投手はグラブで受ける（ボールは手からグラブへ） */
 PL.ret=null;const evA=AR.ev;
 if(go&&ph==='after'&&AR.resultAt&&evA&&evA.kind!=='inplay'&&!evA.runPlay&&!evA.halfEnd&&P&&!(AR.side==='bat'&&actionSettings().cam3d!=='wide')){const tS=AR.resultAt+60,tT=AR.resultAt+260,tR=tT+260;const pc=[0,R3C.RUBBER-0.15-0.38,1.35];const fl=Math.hypot(pc[1]+0.85,pc[2]-1.6)/21*1000;const tA=tR+fl;
  ents.C.segs[0].t1=tS;ents.C.segs.push({k:'pose',pose:'f_stand',t0:tS,t1:tT,x:0,y:-0.85,yaw:Math.PI,fade:220});ents.C.segs.push({k:'clip',clip:'f_qthrow',t0:tT,t1:FAR,x:0,y:-0.85,yaw:Math.PI,fade:120});ents.C.ik=[{t0:-1e12,t1:tS-40,side:'l',fade:120,target:t=>plMittTarget(t)}];
  const B=moBallNew();B.cur=now;const tc=AR.t0+P.T*AR.speed*1.04;moBallAdd(B,{k:'hold',t0:tc,t1:tT+40,ent:'C',at:'glove'});moBallAdd(B,{k:'xfer',t0:tT+40,t1:tT+150,ent:'C',from:'glove',to:'r'});moBallAdd(B,{k:'hold',t0:tT+150,t1:tR,ent:'C',at:'r'});
  moBallAdd(B,{k:'fly',t0:tR,t1:tA,from:{ent:'C',at:'r',fallback:[0,-0.6,1.7]},to:pc,g:9.8});moBallAdd(B,{k:'hold',t0:tA,t1:1e13,ent:'P',at:'glove'});PL.ret={B,tA,pc};PL.retUntil=tA+250;
  ents.P.ik=[{t0:tA-300,t1:tA+260,side:'l',fade:200,target:t=>{if(t>=tA)return pc;const k=moSmooth((t-(tA-130))/130);if(k<=0)return pc;const b=moBallPos(B,t,{rig:q=>plPitchRig(q),ts:1});return b?[pc[0]+(b[0]-pc[0])*k,pc[1]+(b[1]-pc[1])*k,pc[2]+(b[2]-pc[2])*k]:pc;}}];}
 /* 球審：ストライクのコール（見逃し三振は大きく） */
 const kLook=evA&&evA.kind==='kLook',strike=evA&&(evA.kind==='strike'||kLook);

 const bRoot=[-bs*0.86,-0.12],bYaw=bs*Math.PI/2;const bSeg=[];const bunt=pa&&(pa.buntMode||(pa.bm&&pa.bm.bunt)||pa.cmd==='squeeze')||(AR.side==='bat'&&AR.mode!=='card'&&AR.swingType==='bunt');
 if(!go){bSeg.push({k:'pose',pose:'b_stance',t0:T0-5000,t1:FAR,x:bRoot[0],y:bRoot[1],yaw:bYaw,edit:(Q,t)=>plWaggle(Q,t)});}
 else{bSeg.push({k:'pose',pose:'b_stance',t0:T0-5000,t1:tRel-1000+Math.max(0,1000-W),x:bRoot[0],y:bRoot[1],yaw:bYaw,edit:(Q,t)=>plWaggle(Q,t)});
  const pre={k:'clip',clip:bunt?'b_bunt':'b_pre',t0:tRel-1000,t1:FAR,x:bRoot[0],y:bRoot[1],yaw:bYaw,fade:220};if(W<1000){pre.t0=AR.windT0;pre.off=1000-W;}bSeg.push(pre);
  if(AR.swung&&AR.swingT&&!(AR.swing&&AR.swing.type==='bunt')){pre.t1=AR.swingT;bSeg.push({k:'clip',clip:'b_swing',t0:AR.swingT,t1:FAR,x:bRoot[0],y:bRoot[1],yaw:bYaw,fade:35,rate:1/AR.speed,bat:{tc:AR.swingT+75*AR.speed,target:()=>{const ev=AR.ev;return ev&&(ev.kind==='inplay'||ev.kind==='foul')?plContactPoint():null;}}});}
  else if(ph==='after'&&AR.resultAt&&!bunt){pre.t1=AR.resultAt;bSeg.push({k:'clip',clip:'b_take',t0:AR.resultAt,t1:FAR,x:bRoot[0],y:bRoot[1],yaw:bYaw,fade:150});}
  const evK=AR.ev&&(AR.ev.kind==='kSwing'||AR.ev.kind==='kLook'||AR.ev.kind==='kBunt');if(ph==='after'&&AR.resultAt&&evK){const tk=AR.resultAt+380;bSeg[bSeg.length-1].t1=tk;bSeg.push({k:'pose',pose:'kDown',t0:tk,t1:FAR,x:bRoot[0],y:bRoot[1],yaw:bYaw,fade:450,edit:(Q,t)=>moBreath(Q,t,0.6)});}}
 ents.B={ts:1/AR.speed,mir:bs,segs:bSeg,look:[{t0:-1e12,t1:1e12,target:()=>R3.ballF||[0,R3C.RUBBER-1,1.7],w:0.9}]};
 /* 野手：投球間は手をひざに、投手が動き出したら構え、投球が届くころに小さく前へ（準備の一歩） */
 const DP=plDefPos(d,m);const arrive=go&&P?AR.t0&&ph!=='wind'?AR.t0+P.T*AR.speed:tRel+(P?P.T*AR.speed:500):now+1e9;
 for(const k of ['一','二','三','遊','左','中','右']){const p=DP[k];const yaw=moYawTo(p[0],p[1],0,0);const sg=[];const of=k==='左'||k==='中'||k==='右';
  if(!go){sg.push({k:'pose',pose:'f_relax',t0:T0-5000,t1:FAR,x:p[0],y:p[1],yaw,edit:(Q,t)=>moBreath(Q,t,0.8)});}
  else{const tr=T0+W*0.35;sg.push({k:'pose',pose:'f_relax',t0:T0-5000,t1:tr,x:p[0],y:p[1],yaw,edit:(Q,t)=>moBreath(Q,t,0.8)});
   sg.push({k:'pose',pose:'f_ready',t0:tr,t1:arrive-260,x:p[0],y:p[1],yaw,fade:320});
   const fw=moL2F(0,of?0.9:0.55,yaw,1);const q=[p[0]+fw[0],p[1]+fw[1]];
   sg.push({k:'move',t0:arrive-260,t1:arrive+40,path:[{t:arrive-260,x:p[0],y:p[1]},{t:arrive+40,x:q[0],y:q[1]}],face:{mode:'yaw',yaw},style:'shuffle',fade:120});
   sg.push({k:'pose',pose:'f_ready',t0:arrive+40,t1:FAR,x:q[0],y:q[1],yaw,fade:120});
   if(ph==='after'&&AR.resultAt&&!(AR.ev&&AR.ev.kind==='inplay')){const tb2=AR.resultAt+500;sg[sg.length-1].t1=tb2;sg.push({k:'pose',pose:'f_relax',t0:tb2,t1:FAR,x:q[0],y:q[1],yaw,fade:600,edit:(Q,t)=>moBreath(Q,t,0.8)});}}
  ents[k]={ts:1,mir:1,segs:sg,look:[{t0:-1e12,t1:1e12,target:()=>R3.ballF||[0,0,1],w:0.5}]};}
 /* 走者：リード（投球で第2リード）→ 投球が終われば帰塁 */
 const runners=[];m.bases.forEach((r,i)=>{if(r)runners.push({r,i});});
 runners.forEach(({r,i},n)=>{const A=FW_BASE[i+1],N=FW_BASE[i+2];const L=Math.hypot(N[0]-A[0],N[1]-A[1]);const ux=(N[0]-A[0])/L,uy=(N[1]-A[1])/L;const lead=i===0?3.6:i===1?4.6:3.0;const off=i===2?-0.9:i===1?-0.6:0;/* 横（外野側＝負）へのずれ */
  const px=A[0]+ux*lead-uy*off,py=A[1]+uy*lead+ux*off;const yaw=i===2?moYawTo(px,py,px-uy*5-ux*0.5,py+ux*5-uy*0.5):moYawTo(px,py,0,18.4);const sg=[];
  sg.push({k:'pose',pose:'r_lead',t0:T0-5000,t1:go?tRel-80:FAR,x:px,y:py,yaw,edit:(Q,t)=>moBreath(Q,t,0.6)});
  if(go){const s2=[px+ux*1.6,py+uy*1.6];sg.push({k:'move',t0:tRel-80,t1:tRel+500,path:[{t:tRel-80,x:px,y:py},{t:tRel+500,x:s2[0],y:s2[1]}],face:{mode:'yaw',yaw},style:'shuffle',fade:100});
   sg.push({k:'pose',pose:'r_lead',t0:tRel+500,t1:FAR,x:s2[0],y:s2[1],yaw,fade:120});
   if(ph==='after'&&AR.resultAt&&!(AR.ev&&(AR.ev.kind==='inplay'||AR.ev.runPlay))){const tb2=AR.resultAt+250;const back=[A[0]+ux*1.2-uy*off*0.5,A[1]+uy*1.2+ux*off*0.5];sg[sg.length-1].t1=tb2;sg.push({k:'move',t0:tb2,t1:tb2+900,path:[{t:tb2,x:s2[0],y:s2[1]},{t:tb2+900,x:back[0],y:back[1]}],face:{mode:'yaw',yaw},style:'walk',fade:150});sg.push({k:'pose',pose:'f_stand',t0:tb2+900,t1:FAR,x:back[0],y:back[1],yaw,fade:200});}}
  ents['R'+n]={ts:1,mir:1,segs:sg,look:[{t0:-1e12,t1:1e12,target:()=>R3.ballF||[0,18.4,1.5],w:0.6}],run:r};});
 /* 審判：球審は捕手の後ろ、塁審は3人（走者がいれば二塁塁審は内野の中） */
 const U=[[0.35,-1.95,Math.PI,'u_set'],[23.6,17.0,null,'u_base'],[m.bases.some(Boolean)?-2.5:-4.5,m.bases.some(Boolean)?29.5:43.5,null,'u_base'],[-23.6,17.0,null,'u_base']];
 U.forEach((u,i)=>{const yaw=u[2]!=null?u[2]:moYawTo(u[0],u[1],0,i===2?0:20);ents['U'+i]={ts:1,mir:1,segs:[{k:'pose',pose:go?u[3]:(i===0?'u_set':'f_stand'),t0:T0-5000,t1:FAR,x:u[0],y:u[1],yaw,edit:(Q,t)=>moBreath(Q,t,0.5)}],look:[{t0:-1e12,t1:1e12,target:()=>R3.ballF||[0,18.4,1.5],w:0.5}]};});
 if(go&&ph==='after'&&AR.resultAt&&strike){const u=ents.U0;u.segs[0].t1=AR.resultAt;u.segs.push({k:'clip',clip:'u_strike',t0:AR.resultAt,t1:FAR,x:U[0][0],y:U[0][1],yaw:U[0][2],rate:kLook?0.8:1.1,fade:100});}
 const ctx={ents,ts:1,rig:k=>plPitchRig(k),hs,bs,tRel,go,W};PL.ctx=ctx;PL.relKey=null;return ctx;}
/* 投球間の投手：グラブを胸、ときどき走者・打者を見る */
function plIdleSet(Q,t){moBreath(Q,t,0.7);return Q;}
/* 構えの揺れ：バットを小さく回し、ひざでリズム */
function plWaggle(Q,t){const w=Math.sin(t/420),w2=Math.sin(t/650);Q.batDir=[-0.55+w*0.08,0.8,-0.3+w*0.12];Q.dy=(Q.dy||0)+w2*0.012;return Q;}
/* 捕手のミットの目標（フィールド座標）：構えは配球の位置、投球が来たらボールの来る位置へ */
function plMittTarget(t){const ph=AR.phase;const P=AR.cur;const z=(x,y)=>{const v=r3ZoneW(x,y);return [v.x,-v.z-0.45,v.y];};
 let tgt=AR.side==='pit'&&ph==='pre'&&AR.target?z(AR.target.x,AR.target.y):AR.sign&&AR.side==='pit'?z(AR.sign.tx,AR.sign.ty):z(0,0.25);
 if(P&&(ph==='flight'||ph==='after'||ph==='wind')&&AR.t0&&ph!=='wind'){const T=P.T*AR.speed;const u=(t-AR.t0)/T;const c=plCatchPoint();if(c){const k=moSmooth((u-0.45)/0.5);tgt=[tgt[0]+(c[0]-tgt[0])*k,tgt[1]+(c[1]-tgt[1])*k,tgt[2]+(c[2]-tgt[2])*k];}}
 return tgt;}
/* 投球を捕る位置：ゾーン通過点からそのまま進んだ先（捕手のミットの面） */
function plCatchPoint(){const P=AR.cur;if(!P)return null;if(PL.cpKey===P&&PL.cp)return PL.cp;const a=r3PitchPos(P,1,PL.rel),b=r3PitchPos(P,0.97,PL.rel);const v=a.clone().sub(b);const k=v.z>1e-4?(0.42)/v.z:0;const c=a.clone().addScaledVector(v,k);PL.cpKey=P;PL.cp=[c.x,-c.z,Math.max(0.25,c.y)];return PL.cp;}
/* エンティティ→リグ：投手・捕手・野手は R3.fielders、打者は R3.batter、走者は R3.runners、審判は R3.umps＋追加 */
function plPitchRig(k){if(k==='P')return R3.fielders['投'];if(k==='C')return R3.fielders['捕'];if(R3.fielders[k])return R3.fielders[k];if(k==='B')return R3.batter;if(k[0]==='R')return R3.runners[+k.slice(1)];if(k==='U0')return R3.umps[0];if(k==='U1')return R3.umps[1];if(k==='U3')return R3.umps[2];if(k==='U2')return plRig('ump2',r=>{r.setColors(R3_UMP,false);r.setGear(null);r.bat.visible=false;r.glove.visible=false;});return null;}
/* 追加のリグを隠す（場面ごとに必要なものだけ表示し直す） */
function plHideExtras(){for(const k in PL.rigs)PL.rigs[k].g.visible=false;}
/* 投球の場面の1コマ（r3PitchScene から呼ぶ） */
function plPitchFrame(now){const m=AR.m;const d=m.def(),tb=m.bat();const cd=arTeamColors(d),cb=arTeamColors(tb);const pa=m.pa;const ph=AR.phase;const S=actionSettings();const P=AR.cur;
 const ctx=plPitchPlan(now);
 /* 見た目（ユニフォーム・背番号・装備） */const numOf=(team,k)=>{if(k==='投'&&team.pitcher)return team.pitcher.number!=null?team.pitcher.number:1;const sl=team.lineup.find(x=>x.pos===k);return sl?(sl.p.number!=null?sl.p.number:POS_NUM[k]):POS_NUM[k];};
 const ev0=AR.ev;const kOut=ph==='after'&&ev0&&(ev0.kind==='kSwing'||ev0.kind==='kLook'||ev0.kind==='kBunt');
 for(const k in R3.fielders){const r=R3.fielders[k];r.g.visible=true;r.setColors(cd,false);r.setNumber(numOf(d,k),cd.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=true;r.bat.visible=false;r3Dress(r,k==='投'?(pa?pa.p:d.pitcher):r3PlayerOf(d,k));
  r.setExpression(k==='投'?(kOut?((r3Seed(pa?pa.p:d.pitcher)%2)?'smile':'grit'):(ph==='wind'||ph==='flight'||ph==='gauge')?'focus':null):(k==='捕'&&(ph==='wind'||ph==='flight'))?'focus':null);}
 const cat=R3.fielders['捕'];cat.g.visible=!(AR.side==='bat'&&S.cam3d!=='wide');cat.glove.scale.setScalar(1.18);
 {const b=R3.batter;b.g.visible=true;b.setColors(cb,true);b.setNumber(pa?(pa.b.number!=null?pa.b.number:null):null,cb.trim);if(pa)r3Dress(b,pa.b);b.setGear(null);b.bat.visible=true;b.glove.visible=false;
  b.setExpression(kOut?'sad':(ph==='after'&&ev0&&ev0.kind==='inplay'&&ev0.bb&&['1B','2B','3B','HR'].includes(ev0.bb.res))?'shout':(ph==='wind'||ph==='flight')?'focus':null);}
 let n=0;for(const k in ctx.ents){if(k[0]!=='R')continue;const r=R3.runners[+k.slice(1)];const pl=ctx.ents[k].run;r.g.visible=true;r.setColors(cb,true);r.setGear(null);r.setNumber(pl.number!=null?pl.number:null,cb.trim);r3Dress(r,pl);r.setExpression(null);r.bat.visible=false;r.glove.visible=false;n++;}
 for(let i=n;i<R3.runners.length;i++)R3.runners[i].g.visible=false;
 for(let i=0;i<3;i++){const u=R3.umps[i];u.g.visible=i>0||AR.side!=='bat'||S.cam3d==='wide';u.bat.visible=false;u.glove.visible=false;}const u2=plPitchRig('U2');u2.g.visible=true;
 if(PL.ret)moBallResolve(PL.ret.B,{ents:ctx.ents,rig:k=>plPitchRig(k)});
 /* 動き */const res=moFrame({ents:ctx.ents,rig:k=>plPitchRig(k),ts:1},now);
 /* ボール */const ball=R3.ball;const pit=R3.fielders['投'];R3.mitt.visible=!cat.g.visible;
 const mittT=plMittTarget(now);if(!cat.g.visible)R3.mitt.position.set(mittT[0],mittT[2],-mittT[1]);
 if(ph==='wind'||(AR.windT0&&now<ctx.tRel)&&ctx.go){ball.position.copy(r3V(...moAttach(pit,'r')));ball.visible=true;R3.hit=null;}
 else if((ph==='flight'||ph==='after')&&P&&AR.t0){const rel=plRelease(ctx);const T=P.T*AR.speed;const u=(now-AR.t0)/T;const ev=AR.ev;const tc=AR.swingT!=null?AR.swingT+75*AR.speed:null;const hit=!!(ev&&AR.swung&&tc!=null&&(ev.kind==='inplay'||ev.kind==='foul')&&now>=tc);
  if(hit){if(!R3.hit||R3.hit.ev!==ev){R3.hit=r3MakeHit(ev,P,plContactPoint());R3.hit.ev=ev;R3.hit.tc=tc;}ball.position.copy(r3HitPos(R3.hit,now-R3.hit.tc));ball.visible=true;}
  else if(PL.ret&&now>=PL.ret.B.segs[0].t0+30){const bp=moBallPos(PL.ret.B,now,{ents:ctx.ents,rig:k=>plPitchRig(k),ts:1});if(bp){ball.position.set(bp[0],bp[2],-bp[1]);ball.visible=true;}}
  else{const cp=plCatchPoint();const Tc=T*1.04;if(u<1)ball.position.copy(r3PitchPos(P,u,rel));else if(u<1.04&&cp){const a=r3PitchPos(P,1,rel);const k=(u-1)/0.04;ball.position.set(a.x+(cp[0]-a.x)*k,a.y+(cp[2]-a.y)*k,a.z+(-cp[1]-a.z)*k);}else{if(cat.g.visible)ball.position.copy(r3V(...moAttach(cat,'glove')));else{ball.position.copy(R3.mitt.position);ball.position.z-=0.08;}}ball.visible=!(ev&&ev.kind==='hbp'&&u>=1);}}
 else if(PL.ret&&PL.retUntil&&now<PL.retUntil){const bp=moBallPos(PL.ret.B,now,{ents:ctx.ents,rig:k=>plPitchRig(k),ts:1});if(bp){ball.position.set(bp[0],bp[2],-bp[1]);ball.visible=true;}}
 else{/* 投球間：ボールは投手のグラブの中（手で握っている） */ball.position.copy(r3V(...moAttach(pit,'r')));ball.visible=ph==='pre'||ph==='gauge';R3.hit=null;}
 R3.ballF=ball.visible?[ball.position.x,-ball.position.z,ball.position.y]:null;}
/* リリースの位置：リリースの時刻の投手の手（その時刻で姿勢を計算して読む。フレームの間隔に左右されない） */
function plRelease(ctx){const key=PL.key+'|'+ctx.tRel;if(PL.relKey===key)return PL.rel;const ent=ctx.ents.P;const rig=R3.fielders['投'];const st=moEval(ent,ctx.tRel);moApply(rig,st,ent,ctx.tRel);const p=moAttach(rig,'r');PL.rel=r3V(p[0],p[1],p[2]);PL.relKey=key;PL.cpKey=null;return PL.rel;}

/* ================= インプレーの場面：守備・走塁・審判の計画（v25） =================
 打球の結果（エンジンの play）は変えずに、そこへ至る動きを野球のきまりどおりに組み立てる。
 ・打球を処理する野手：ゴロは打球の線に入り、正面で捕る位置へ減速しながら寄る。フライは落下点へ先回りする
 ・送球：捕球→持ち替え→ステップ→リリース（手の位置）→受け手のグラブ。受け手は塁へ先に入る（一塁は伸びて捕る、封殺は塁を踏む、タッチは走者の来る側へ）
 ・ベースカバー：左方向のゴロは二塁手、右方向は遊撃手が二塁。一塁手が捕れば投手が一塁へ。三塁手が捕れば遊撃手が三塁
 ・カバーリング：一塁への送球は右翼手と（走者なしなら）捕手、二塁は中堅手、三塁は左翼手、本塁は投手が後ろへ回る
 ・中継：外野の安打は遊撃手（左〜中）か二塁手（右）が送球の線上へ出る
 ・走者：加速して走り、次へ進むときは手前でふくらんで内側の角を踏む。一塁は駆け抜け、際どい塁ではスライディング。アウトはベンチへ戻る
 時刻はすべて場面の ms（実時間 × FW_SPEED）。 */
const PLX={RT:170,VIF:30,VOF:32,VC:27};
function plS(ms){return ms*FW_SPEED;}
function plRunT(d,v,a){const da=v*v/(2*a);return d<=da?Math.sqrt(2*d/a):v/a+(d-da)/v;}
function plSpeed(p){const s=p&&p.bat?p.bat.speed:55;return clamp(6.6+(s-50)/22,5.6,8.6);}
function plArm(p){const s=p&&p.bat?p.bat.arm:55;return clamp(27+(s-50)/8,24,36);}
/* 打球の経路（フィールド座標・場面ms）：空中は物理軌道、ゴロは減速しながら転がる。始点は接触点 */
function plBallPath(c,c0){const S=FW_SPEED;const a=c.a||0;const dist=Math.max(4,c.dist||10);const type=c.type;const air=type==='fly'||type==='line'||type==='pop';const caught=c.res==='FO'||c.res==='LO'||c.res==='PO';const isHR=c.res==='HR';
 const o={pts:[],air,caught,isHR,Tland:0,land:null,Tc:null,Pc:null,hrCross:null};const an=c.anim=c.anim||{roll:rf(0.5,1),bob:rf(0,1),ang:gauss(0,1)};
 if(air){const fd=FENCE(a);let la=c.la==null?(type==='fly'?32:type==='line'?14:62):c.la;if(isHR)la=Math.max(la,24);let path=null;
  try{path=phHitPath(c.ev||(type==='pop'?90:110),la,a,isHR?Math.max(dist,fd+6):dist,{x0:c0[0],y0:c0[1],z0:c0[2]});}catch(e){path=null;}
  if(path&&path.pts&&path.pts.length>3){const pts=path.pts;const step=Math.max(1,Math.floor(pts.length/60));for(let i=0;i<pts.length;i+=step){const q=pts[i];o.pts.push({t:q.t*1000*S,x:q.x,y:q.y,z:Math.max(0,q.z)});}const ql=pts[pts.length-1];if(o.pts[o.pts.length-1].t<ql.t*1000*S)o.pts.push({t:ql.t*1000*S,x:ql.x,y:ql.y,z:0});}
  else{const Th=(type==='fly'?1.5+dist/75:type==='line'?0.65+dist/110:2.0+dist/90)*1000*S;const hmax=type==='fly'?10+dist/5:type==='line'?2.5+dist/30:16+dist/5;const L=fwPolar(dist,a);for(let i=0;i<=24;i++){const u=i/24;o.pts.push({t:Th*u,x:c0[0]+(L[0]-c0[0])*u,y:c0[1]+(L[1]-c0[1])*u,z:c0[2]*(1-u)+hmax*4*u*(1-u)});}}
  const last=o.pts[o.pts.length-1];o.Tland=last.t;o.land=[last.x,last.y];
  if(caught){let Tc=o.Tland*0.95;if(type!=='line'){for(let i=o.pts.length-1;i>0;i--){if(o.pts[i].z>=1.9){Tc=o.pts[i].t;break;}}}else Tc=Math.min(o.Tland*0.9,Tc);o.Tc=Math.max(plS(260),Tc);const p=moPts(o.pts,o.Tc);o.Pc=[p[0],p[1],clamp(p[2],0.9,2.4)];}
  else if(isHR){let cut=-1;for(let i=1;i<o.pts.length;i++){const q=o.pts[i];if(Math.hypot(q.x,q.y)>=fd&&q.z<=1.5&&q.t>o.Tland*0.5){cut=i;break;}}if(cut>0)o.pts.splice(cut+1);for(let i=1;i<o.pts.length;i++){if(Math.hypot(o.pts[i].x,o.pts[i].y)>=fd){o.hrCross=o.pts[i].t;break;}}const e=o.pts[o.pts.length-1];o.land=[e.x,e.y];o.Tland=e.t;}
  else{/* 落ちてから弾んで転がる */const L=o.land;const dir=[L[0]/Math.hypot(L[0],L[1]),L[1]/Math.hypot(L[0],L[1])];const rl=4+an.roll*9;const t0=o.Tland;const n=6;for(let i=1;i<=n;i++){const u=i/n;const s=rl*(1-(1-u)*(1-u));o.pts.push({t:t0+(420+an.roll*320)*S*u,x:L[0]+dir[0]*s,y:L[1]+dir[1]*s,z:Math.max(0.04,1.1*Math.abs(Math.sin(u*Math.PI*1.4))*(1-u))});}const e=o.pts[o.pts.length-1];o.Tstop=e.t;o.stop=[e.x,e.y];}}
 else{/* ゴロ：強い打球は減速しながら外野まで転がる（内野手が途中で捕る）。弱い打球・バントはエンジンの距離で止まる */const weak=c.bunt||(c.ev||100)<75;const v0=weak?clamp(dist*0.8,5,14):clamp((c.ev||100)/3.6*0.82,12,40);const dec=weak?v0*v0/(2*dist):Math.max(3.2,v0*v0/(2*Math.max(dist*2.4,dist+45)));const Tstop=(v0/dec);const dir=[Math.sin(a*Math.PI/180),Math.cos(a*Math.PI/180)];
  o.pts.push({t:0,x:c0[0],y:c0[1],z:c0[2]});const n=24;for(let i=1;i<=n;i++){const tt=Tstop*i/n;const s=v0*tt-0.5*dec*tt*tt;o.pts.push({t:tt*1000*S,x:dir[0]*s,y:dir[1]*s,z:i<3?0.35*(1-i/3)+0.06:0.05+0.12*Math.abs(Math.sin(tt*8))*Math.max(0,1-tt)});}
  o.Tland=o.pts[o.pts.length-1].t;o.land=[o.pts[o.pts.length-1].x,o.pts[o.pts.length-1].y];o.Tstop=o.Tland;o.stop=o.land;}
 return o;}
/* 打球の経路の上で、野手が先回りできる最初の点（準備の時間 prep を残す） */
function plIntercept(ball,from,v,t0,prep,minT){const S=FW_SPEED;for(const q of ball.pts){if(q.t<(minT||0))continue;if(q.z>1.6&&ball.air)continue;const d=Math.hypot(q.x-from[0],q.y-from[1]);const need=t0+plRunT(Math.max(0,d-0.4),v,5.2)*1000*S;if(need<=q.t-prep)return {t:q.t,p:[q.x,q.y,q.z]};}const l=ball.pts[ball.pts.length-1];return {t:l.t,p:[l.x,l.y,l.z],late:true};}
/* 経路を作る：from→to を（加速して）走り、t1 ちょうどに着く。時間が余れば遅く、足りなければ速く */
function plRunPath(pts,t0,t1,v,o){o=o||{};const path=moProfile(pts,v,o.acc||5.2,o.dec||4.5,0,{v0:o.v0||0,v1:o.v1==null?0:o.v1,ts:1,lat:o.lat||7.5});const T=path[path.length-1].t||1;const k=(t1-t0)/T;for(const q of path)q.t=t0+q.t*k;return path;}
/* エンティティの組み立て */
function plEnt(o){return Object.assign({ts:1/FW_SPEED,mir:1,segs:[],ik:[],look:[]},o||{});}
function plAdd(e,seg){const S=e.segs;if(S.length){const l=S[S.length-1];if(seg.t0<l.t0)seg.t0=l.t0+1;l.t1=seg.t0;}if(seg.t1==null)seg.t1=seg.t0+1e7;S.push(seg);return seg;}
/* その時刻の体の位置（リグなしで計算：2D表示とカメラ用） */
function plEntPos(e,t){const st=moEval(e,t);if(!st)return [0,0];let x=st.x,y=st.y;const P=st.P||{};if(P.dz||P.dx){const o=moL2F(P.dx||0,P.dz||0,st.yaw,e.mir||1);x+=o[0];y+=o[1];}return [x,y,st];}
/* 区間の最後の根元の位置（クリップの end を足す） */
function plSegEnd(seg){if(seg.k==='move'||seg.k==='glide'){const l=seg.path[seg.path.length-1];return [l.x,l.y];}const d=seg.clip&&MODEF[seg.clip];if(d&&d.end){const o=moL2F(d.end.dx||0,d.end.dz||0,seg.yaw||0,seg.mir||1);return [seg.x+o[0],seg.y+o[1]];}return [seg.x,seg.y];}
/* ===== 本体 ===== */
function plBuild(c,play,opt){opt=opt||{};const m=AR.m;const d=m.def(),tb=m.bat();const S=FW_SPEED;const ts=1/S;
 const sc={t0:performance.now(),T:0,ball:[],fielders:{},runners:[],callouts:[],fx:[],pauseAt:null,kind:'inplay',res:c.res,primary:c.fpos,pois:[],ended:false,throws:[],mo:null};
 const DP0=plDefPos(d,m);const ents={};const E=k=>ents[k];const B=moBallNew();
 const pl=k=>r3PlayerOf(d,k);const hs=m.pa&&m.pa.p&&m.pa.p.throws==='左'?-1:1;const bs=(play&&play.hand?play.hand:(m.pa?m.pa.bHand:'右'))==='左'?-1:1;
 const c0=opt.contact||[bs*0.2,0.45,0.95];const ball=plBallPath(c,c0);
 const type=c.type;const a=c.a||0;const caught=ball.caught;const isHR=ball.isHR;const isHit=['1B','2B','3B'].includes(c.res);const infieldK=['投','捕','一','二','三','遊'];
 /* --- 初期配置（投球の場面の続き） --- */
 const pRoot=[0,R3C.RUBBER-0.15];const pOff=opt.pitchClip!=null?opt.pitchClip:1450;
 for(const k of ['投','捕','一','二','三','遊','左','中','右']){const e=ents[k]=plEnt({key:k,mir:k==='投'?hs:1});const p0=DP0[k];
  if(k==='投'){plAdd(e,{k:'clip',clip:'p_set_'+r3PitForm(m.pa&&m.pa.p?m.pa.p:d.pitcher),t0:-600,x:pRoot[0],y:pRoot[1],yaw:0,off:pOff-600*ts,rate:ts});continue;}
  if(k==='捕'){plAdd(e,{k:'pose',pose:'c_crouch',t0:-600,x:0,y:-0.85,yaw:Math.PI});continue;}
  const yaw=moYawTo(p0[0],p0[1],0,0);const of=k==='左'||k==='中'||k==='右';const fw=moL2F(0,of?0.9:0.55,yaw,1);e.home=[p0[0]+fw[0],p0[1]+fw[1]];plAdd(e,{k:'pose',pose:'f_ready',t0:-600,x:e.home[0],y:e.home[1],yaw});}
 ents['投'].home=(()=>{const o=moL2F(MODEF.p_set.end.dx,MODEF.p_set.end.dz,0,hs);return [pRoot[0]+o[0],pRoot[1]+o[1]];})();ents['捕'].home=[0,-0.85];
 const tPitchEnd=Math.max(0,(1650-pOff)*S);/* 投手のフォローが終わる時刻 */
 const posAt=(k,t)=>{const e=E(k);const segs=e.segs;let s=segs[0];for(const g of segs)if(g.t0<=t)s=g;if(s.k==='move'||s.k==='glide')return moPathAt(s.path,t);if(t>=s.t1-1)return plSegEnd(s);return [s.x,s.y];};
 const freeAt=(k)=>{const e=E(k);const l=e.segs[e.segs.length-1];return Math.max(l.t0+1,k==='投'?tPitchEnd:0);};
 const R=plS(PLX.RT);
 /* 走る（そこへ着く時刻 arrive を指定可）。最後は指定の区間（構え・クリップ）につなぐ */
 const runTo=(k,to,t0,arrive,face,next,o)=>{o=o||{};const e=E(k);t0=Math.max(t0,freeAt(k));const from=posAt(k,t0);const dist=Math.hypot(to[0]-from[0],to[1]-from[1]);const v=plSpeed(pl(k))*(o.vMul||1);
  let dur=(plRunT(dist,v,5.2)*1000+(o.extra||0))*S;if(arrive!=null)dur=Math.max(plS(220),arrive-t0);if(dist<0.25){if(next){next.t0=t0+Math.max(0,arrive!=null?arrive-t0:0);plAdd(e,next);}return t0+(arrive!=null?arrive-t0:0);}
  const path=plRunPath([from,to],t0,t0+dur,v,{v1:o.v1||0});plAdd(e,{k:'move',t0,t1:t0+dur,path,face:face||{mode:'vel'},style:o.style||'run'});if(next){next.t0=t0+dur;plAdd(e,next);}return t0+dur;};
 const ready=(k,t,at,yaw,pose)=>plAdd(E(k),{k:'pose',pose:pose||'f_ready',t0:t,x:at[0],y:at[1],yaw,fade:220});
 /* --- 打球の処理 --- */
 let fielder=c.fpos||fielderOf(c);const ofByAng=a<-15?'左':a<=15?'中':'右';let Tc=null,Pc=null,holdAt=null;/* holdAt：ボールを持つ人と時刻 */
 const look=(k,fn)=>E(k).look.push({t0:-1e9,t1:1e9,target:fn,w:0.75});
 const ballAt=t=>{const p=moPts(ball.pts,t);return p;};
 if(caught){const v=plSpeed(pl(fielder));const from=posAt(fielder,0);const yawB=moYawTo(ball.Pc[0],ball.Pc[1],c0[0],c0[1]);
  const clip=type==='line'?'f_line':'f_fly';const cT=type==='line'?160:420;Tc=ball.Tc;Pc=ball.Pc;
  /* 体の位置：グラブ（頭の上、少し前）にボールが入るよう、捕球点の少し手前 */const back=moL2F(-0.12,-0.36,yawB,1);const spot=[Pc[0]+back[0],Pc[1]+back[1]];
  const need=R+plRunT(Math.hypot(spot[0]-from[0],spot[1]-from[1]),v,5.2)*1000*S;const cs=Tc-plS(cT);const arr=Math.min(cs,Math.max(R+plS(250),need));
  runTo(fielder,spot,R,arr,{mode:'pt',x:c0[0],y:c0[1]},{k:'clip',clip,t0:0,x:spot[0],y:spot[1],yaw:yawB,rate:ts,off:Math.max(0,cT-(Tc-arr)/S),fade:180},{v1:need>cs?2.5:0});
  E(fielder).ik.push({t0:Tc-plS(170),t1:Tc,side:'l',fade:plS(140),target:t=>{const p=ballAt(Math.min(t,Tc));return p;}});holdAt={k:fielder,t:Tc};}
 else if(isHR){const fd=FENCE(a);const fence=fwPolar(fd-2.2,a);const k=['左','中','右'].includes(fielder)?fielder:ofByAng;fielder=k;runTo(k,fence,R,Math.min(ball.Tland*0.85,ball.Tland),{mode:'vel'},{k:'pose',pose:'f_stand',t0:0,x:fence[0],y:fence[1],yaw:moYawTo(fence[0],fence[1],0,0),fade:300},{v1:1.5});
  E(k).look.push({t0:-1e9,t1:1e9,target:t=>ballAt(t),w:0.9});const cross=ball.hrCross!=null?ball.hrCross:ball.Tland*0.9;sc.callouts.push({t:cross+100,x:ball.land[0],y:ball.land[1],z:4,text:'ホームラン！！',kind:'hr',dur:1800});sc.fx.push({t:cross,x:ball.land[0],y:ball.land[1],kind:'fireworks'});sc.hrCross=ball.hrCross;}
 else{/* ゴロ・落ちる打球：取りに行く */const air=ball.air;let k=fielder;const ofHit=isHit&&(air||!infieldK.includes(k))||(isHit&&!air&&infieldK.includes(k)&&(c.dist||0)>=40);
  if(isHit&&!air&&infieldK.includes(k)&&(c.dist||0)>=40){/* 内野を抜ける：内野手は飛びつくが届かない */const from=posAt(k,R);const near=fwPolar(Math.min((c.dist||40)*0.62,34),a);const dv=[near[0]-from[0],near[1]-from[1]];const L=Math.hypot(dv[0],dv[1])||1;const tgt=[from[0]+dv[0]/L*Math.min(L,3.2),from[1]+dv[1]/L*Math.min(L,3.2)];
   runTo(k,tgt,R,null,{mode:'pt',x:0,y:0},{k:'pose',pose:'f_ready',t0:0,x:tgt[0],y:tgt[1],yaw:moYawTo(tgt[0],tgt[1],0,0),fade:250},{v1:2});k=ofByAng;}
  else if(ofHit&&!['左','中','右'].includes(k))k=ofByAng;fielder=k;
  const v=plSpeed(pl(k));const from=posAt(k,R);const ofK=['左','中','右'].includes(k);const prep=plS(ofK?320:470);
  let it=plIntercept(ball,from,v,R,prep,air?ball.Tland:0);
  /* アウト（ゴロ・失策・野選・犠打）なのに届かない：打球の線上で野手に最も近い点で捕る。間に合わなければ打球を遅くして合わせる */
  const isOutG=!air&&!isHit&&infieldK.includes(k);
  if(isOutG){const L=ball.stop||ball.land;const Ld=Math.hypot(L[0]-c0[0],L[1]-c0[1])||1;const ux=(L[0]-c0[0])/Ld,uy=(L[1]-c0[1])/Ld;let sQ=(from[0]-c0[0])*ux+(from[1]-c0[1])*uy;sQ=clamp(sQ-0.6,3,Ld);const Q=[c0[0]+ux*sQ,c0[1]+uy*sQ];
   const tNeed=R+plRunT(Math.max(0,Math.hypot(Q[0]-from[0],Q[1]-from[1])-0.3),v,5.2)*1000*S+prep;let tQ=null;for(let i=1;i<ball.pts.length;i++){const a0=ball.pts[i-1],b0=ball.pts[i];const s0=(a0.x-c0[0])*ux+(a0.y-c0[1])*uy,s1=(b0.x-c0[0])*ux+(b0.y-c0[1])*uy;if(s0<=sQ&&s1>=sQ){tQ=a0.t+(b0.t-a0.t)*((sQ-s0)/Math.max(1e-6,s1-s0));break;}}
   if(it.late||Math.hypot(it.p[0]-c0[0],it.p[1]-c0[1])>sQ+1.5){if(tQ==null)tQ=ball.Tstop||ball.Tland;if(tQ<tNeed){const kk=tNeed/tQ;for(const q of ball.pts)q.t*=kk;ball.Tland*=kk;if(ball.Tstop)ball.Tstop*=kk;tQ=tNeed;}it={t:tQ,p:[Q[0],Q[1],0.05]};}}
  if(it.late&&ball.stop){it={t:Math.max(ball.Tstop,R+plRunT(Math.hypot(ball.stop[0]-from[0],ball.stop[1]-from[1]),v,5.2)*1000*S+prep),p:[ball.stop[0],ball.stop[1],0.05]};}
  Tc=it.t;Pc=[it.p[0],it.p[1],0.12];const inc=moPts(ball.pts,Math.max(0,Tc-plS(150)));const yawB=moYawTo(Pc[0],Pc[1],inc[0],inc[1]);const back=moL2F(-0.04,-0.5,yawB,1);const spot=[Pc[0]+back[0],Pc[1]+back[1]];
  const cs=Tc-plS(450);/* 捕球の動作は捕る0.45秒前から（右・左と足を合わせる） */
  runTo(k,spot,R,cs,{mode:'pt',x:inc[0],y:inc[1],tau:150},{k:'clip',clip:'f_gb',t0:0,x:spot[0],y:spot[1],yaw:yawB,rate:ts,fade:180},{v1:1.4,vMul:1});
  if(c.res==='E'){/* はじく：ボールが前に転がり、拾い直す */const an2=c.anim||{bob:0.5,ang:0};const off=fwPolar(2.5+an2.bob*2.5,(yawB*180/Math.PI)+(an2.ang>0?40:-40));Pc=[Pc[0],Pc[1],0.12];const p2=[Pc[0]+off[0]*0.6,Pc[1]+off[1]*0.6];
   sc.callouts.push({t:Tc+80,x:Pc[0],y:Pc[1],z:2,text:'エラー！',kind:'err'});const t2=Tc+plS(700);B.err={t:Tc,to:[p2[0],p2[1],0.05],t2};
   const sp2=moL2F(0,-0.5,yawB,1);E(k).segs[E(k).segs.length-1].t1=Tc+plS(250);plAdd(E(k),{k:'clip',clip:'f_gb',t0:t2-plS(450),x:p2[0]+sp2[0],y:p2[1]+sp2[1],yaw:yawB,rate:ts*1.2,fade:200});Tc=t2;Pc=[p2[0],p2[1],0.12];}
  E(k).ik.push({t0:Tc-plS(180),t1:Tc,side:'l',fade:plS(140),target:t=>{const p=B.err&&t>B.err.t?B.err.to:ballAt(Math.min(t,Tc));return [p[0],p[1],Math.max(0.1,p[2])];}});holdAt={k,t:Tc};}
 sc.primary=fielder;sc.Tpick=Tc!=null?Tc:ball.Tland;sc.pick=Pc?[Pc[0],Pc[1]]:ball.land;
 /* --- 走者（エンジンの結果どおりの行き先・アウトの塁） --- */
 const pend=!play;const runners=play?play.runners:[];const BRrec=play?play.batter:null;const dec=opt.dec;let RL=runners,BR=BRrec;
 if(pend){const Bs=m.bases;const mk=(r,from,to)=>({pid:r.id,name:r.name,from,to,outAt:null,speed:m.runnerSpeed(r)});RL=[];
  if(Bs[2])RL.push(mk(Bs[2],3,dec&&dec.kind==='tag'?3:(dec&&dec.kind==='throw'&&!d.infieldIn&&!(Bs[0]&&Bs[1])?3:4)));if(Bs[1])RL.push(mk(Bs[1],2,c.res==='FO'?2:3));if(Bs[0])RL.push(mk(Bs[0],1,c.res==='FO'?1:c.res==='2B'?3:2));
  BR={pid:m.pa.b.id,name:m.pa.b.name,to:c.res==='FO'?1:c.res==='2B'?2:1,outAt:c.res==='FO'?0:null,speed:m.pa.be?m.pa.be.speed:55};sc.pauseAt=(Tc!=null?Tc:ball.Tland)+plS(150);sc.decision=dec;}
 /* --- 送球の計画 --- */
 const outs=[];for(const r of RL)if(r.outAt&&r.outAt>0)outs.push({base:r.outAt,who:r});if(BR&&BR.outAt&&BR.outAt>0)outs.push({base:BR.outAt,who:BR,batter:true});outs.sort((x,y)=>y.base-x.base);
 let throws=[];if(!isHR&&holdAt){if(outs.length){for(const o of outs)throws.push({base:o.base,out:o});}else if(!pend){let lead=0;for(const r of RL)if(r.to<4&&r.to>lead)lead=r.to;if(BR&&BR.to<4&&BR.to>lead)lead=BR.to;
   if(play&&play.throwTo){const tb2=play.throwTo;throws.push({base:tb2,safe:RL.find(r=>r.to===tb2)||(BR&&BR.to===tb2?BR:null)});}else if(caught){const tag=RL.find(r=>r.to===4&&r.from===3);if(tag)throws.push({base:4,safe:tag});}else throws.push({base:Math.min(4,Math.max(2,lead+1)),safe:null,soft:true});}}
 const leftSide=['三','遊','左'].includes(fielder)||a<-6;const cover2=leftSide?'二':'遊';
 const coverOf=(base,thrower)=>{let cv=base===1?'一':base===2?cover2:base===3?'三':'捕';if(cv===thrower){cv=base===1?(thrower==='一'?'投':'二'):base===2?(cv==='二'?'遊':'二'):base===3?'遊':'投';}if(base===1&&thrower==='一'&&Pc&&Math.hypot(Pc[0]-19.4,Pc[1]-19.4)<4)cv=null;/* 一塁手が塁の近くで捕った：自分で踏む */return cv;};
 const throwPlan=[];let holder=holdAt?holdAt.k:null;let tFree=holdAt?holdAt.t:0;let fromP=Pc?Pc.slice(0,2):null;
 /* 捕球後の持ち替え：ボールはグラブ→投げ手。送球の動作の中でリリース */
 const firstClip=holder?(E(holder).segs[E(holder).segs.length-1].clip):null;
 if(holdAt){moBallAdd(B,{k:'hold',t0:holdAt.t,t1:holdAt.t+1,ent:holder,at:'glove'});}
 for(const th of throws){if(!holder)break;const Bp=FW_BASE[th.base];const cv=coverOf(th.base,holder);const tp=posAt(holder,tFree);const dist=Math.hypot(Bp[0]-tp[0],Bp[1]-tp[1]);
  const quick=dist<14;const ofK=['左','中','右'].includes(holder);const vT=(ofK?PLX.VOF:holder==='捕'?PLX.VC:PLX.VIF)*(plArm(pl(holder))/30);
  /* 送球の動作：捕球の動作の終わり（持ち替え済み）から。体を送球方向へ向ける */let tStart;const segs=E(holder).segs;const last=segs[segs.length-1];
  if(throwPlan.length===0){tStart=last.clip==='f_gb'?holdAt.t+plS(250):last.clip==='f_fly'?holdAt.t+plS(330):last.clip==='f_line'?holdAt.t+plS(200):holdAt.t+plS(150);}else tStart=tFree+plS(120);
  const clip=th.soft?'f_qthrow':quick?'f_qthrow':(ofK?'f_othrow':'f_throw');const relT=clip==='f_qthrow'?260:420;const yawT=moYawTo(tp[0],tp[1],Bp[0],Bp[1]);
  const at=plSegEnd(last)||tp;plAdd(E(holder),{k:'clip',clip,t0:tStart,x:at[0],y:at[1],yaw:yawT,rate:ts,fade:plS(140)});const tRel=tStart+plS(relT);
  const fl=dist/(th.soft?vT*0.6:vT)*1000*S;const Ta=tRel+fl;
  /* 受け手：塁に先に入って捕る */let rclip=th.base===1&&cv==='一'?'f_1b':(th.out&&th.base>1&&!th.out.batter&&!plForced(th.out.who,RL,BR)&&th.base!==1)||th.base===4?'f_tag':'f_cover';if(th.soft)rclip='f_cover';const rcT=rclip==='f_1b'?300:rclip==='f_tag'?240:260;
  let catchP=[Bp[0],Bp[1],1.2];if(cv){const yawR=moYawTo(Bp[0],Bp[1],tp[0],tp[1]);const rb=moL2F(0.05,0.1,yawR,1);const root=[Bp[0]+rb[0],Bp[1]+rb[1]];const arr=Math.min(Ta-plS(rcT),Math.max(freeAt(cv)+plS(300),Ta-plS(rcT)));
   runTo(cv,root,R,arr,{mode:'pt',x:tp[0],y:tp[1]},{k:'clip',clip:rclip,t0:0,x:root[0],y:root[1],yaw:yawR,rate:ts,off:Math.max(0,rcT-(Ta-arr)/S),fade:160},{v1:1.2});
   const lc=rclip==='f_1b'?[0.12,1.15,1.15]:[0.12,1.2,0.55];const o=moL2F(lc[0],lc[2],yawR,1);catchP=[root[0]+o[0],root[1]+o[1],lc[1]];
   E(cv).ik.push({t0:Ta-plS(200),t1:Ta,side:'l',fade:plS(150),target:t=>t>=Ta?catchP:moBallPos(B,t,{rig:()=>null,ts})||catchP});}
  /* ボール：持ち替え→投げ手→リリース→受け手 */const xs=Math.max(tFree+1,tStart-plS(80));
  if(throwPlan.length===0){B.segs[B.segs.length-1].t1=xs;moBallAdd(B,{k:'xfer',t0:xs,t1:xs+plS(140),ent:holder,from:'glove',to:'r'});moBallEv(B,{t:xs,k:'xfer',ent:holder});moBallAdd(B,{k:'hold',t0:xs+plS(140),t1:tRel,ent:holder,at:'r'});}
  else{moBallAdd(B,{k:'xfer',t0:tFree,t1:tFree+plS(110),ent:holder,from:'glove',to:'r'});moBallAdd(B,{k:'hold',t0:tFree+plS(110),t1:tRel,ent:holder,at:'r'});}
  moBallAdd(B,{k:'fly',t0:tRel,t1:Ta,from:{ent:holder,at:'r',fallback:[tp[0],tp[1],1.8]},to:catchP,g:th.soft?9.8:5});moBallEv(B,{t:tRel,k:'release',ent:holder});
  if(cv){moBallAdd(B,{k:'hold',t0:Ta,t1:Ta+1e7,ent:cv,at:'glove'});moBallEv(B,{t:Ta,k:'catch',ent:cv});}else moBallAdd(B,{k:'path',t0:Ta,t1:Ta+1e7,pts:[{t:Ta,x:catchP[0],y:catchP[1],z:catchP[2]},{t:Ta+plS(600),x:catchP[0]+1,y:catchP[1]+1,z:0.05}]});
  throwPlan.push({base:th.base,Ta,tRel,out:th.out,safe:th.safe,from:tp,cv,soft:!!th.soft});
  if(cv){holder=cv;tFree=Ta;fromP=[Bp[0],Bp[1]];}else{holder=null;}}
 if(holdAt&&!throwPlan.length){/* 送球なし：持ち替えて内野へ返す（ボールは手の中） */const segs=E(holdAt.k).segs;const last=segs[segs.length-1];const xs=holdAt.t+plS(last.clip==='f_gb'?150:250);B.segs[B.segs.length-1].t1=xs;moBallAdd(B,{k:'xfer',t0:xs,t1:xs+plS(140),ent:holdAt.k,from:'glove',to:'r'});moBallAdd(B,{k:'hold',t0:xs+plS(140),t1:1e9,ent:holdAt.k,at:'r'});}
 sc.throws=throwPlan;
 /* 打球の前半（バットから捕球まで） */
 const T0b=0;const endB=holdAt?holdAt.t:(isHR?ball.Tland:ball.Tland);const pre=ball.pts.filter(q=>q.t<=endB);if(!pre.length||pre[pre.length-1].t<endB){const p=moPts(ball.pts,endB);pre.push({t:endB,x:p[0],y:p[1],z:p[2]});}
 if(B.err){const e=B.err;const p0=moPts(ball.pts,e.t);B.segs.unshift({k:'path',t0:0,t1:e.t2,pts:pre.filter(q=>q.t<=e.t).concat([{t:e.t,x:p0[0],y:p0[1],z:p0[2]},{t:e.t2,x:e.to[0],y:e.to[1],z:0.05}])});const h=B.segs.find(g=>g.k==='hold');if(h){h.t0=e.t2;}}
 else B.segs.unshift({k:'path',t0:0,t1:endB,pts:pre});if(isHR)moBallAdd(B,{k:'gone',t0:ball.Tland+1,t1:1e9});
 B.segs.sort((x,y)=>x.t0-y.t0);moBallEv(B,{t:0,k:'contact',ent:'B'});if(holdAt)moBallEv(B,{t:holdAt.t,k:'catch',ent:holdAt.k});
 if(caught)sc.callouts.push({t:Tc,x:Pc[0],y:Pc[1],z:2,text:'キャッチ！',kind:'catch'});
 /* --- 走者 --- */
 plRunners(sc,ents,RL,BR,{ball,Tc,caught,throwPlan,opt,pend,dec,c,bs,isHR,air:ball.air,tb,ts});
 /* --- ほかの野手：ベースカバー・カバーリング・中継・投手と捕手 --- */
 plSupport(sc,ents,{fielder,ball,Tc,Pc,throwPlan,c,leftSide,cover2,R,runTo,ready,posAt,freeAt,caught,isHR,m,ts});
 /* --- 審判 --- */
 plUmps(sc,ents,{throwPlan,ball,c,m,Tc,Pc,caught,isHR});
 /* --- 見る先：ボール --- */for(const k in ents){if(!ents[k].look.length)ents[k].look.push({t0:-1e9,t1:1e9,target:t=>sc.mo&&sc.mo.ballF?sc.mo.ballF:moPts(ball.pts,Math.min(t,ball.Tland)),w:0.6});}
 sc.mo={ents,ball:B,ts,contact:c0,pitchClip:pOff};
 /* --- 2D 表示・カメラ用の値（体の位置・ボール） --- */
 plLegacy(sc,ents,B,ball);
 /* --- 終了時刻 --- */let T=Math.max((Tc||ball.Tland)+plS(900),...throwPlan.map(x=>x.Ta+plS(700)));for(const r of sc.runners){const pp=r.path2||r.path;const tl=r.arriveT!=null?r.arriveT:(r.holdEnd!=null?r.holdEnd:pp[pp.length-1].t);T=Math.max(T,tl+plS(450));}for(const cl of sc.callouts)T=Math.max(T,cl.t+(cl.dur||900));if(isHR)T=Math.max(T,ball.Tland+2400);
 sc.T=pend?sc.pauseAt+10:T;sc.Tfull=T;sc.rate=clamp(T/4200,1,2.4);sc.colBat=arTeamColors(tb);sc.colDef=arTeamColors(d);sc.defTeam=d;sc.batTeam=tb;return sc;}
function plForced(who,RL,BR){if(!who)return false;if(who===BR)return true;/* 前の塁がすべて埋まっていれば封殺 */const occ=new Set(RL.map(r=>r.from));let b=who.from;for(let x=1;x<b;x++)if(!occ.has(x))return false;return true;}
/* 走者のリードの位置（投球の場面の第2リードの位置と同じ） */
function plLeadPos(i){const A=FW_BASE[i],N=FW_BASE[i+1];const L=Math.hypot(N[0]-A[0],N[1]-A[1]);const ux=(N[0]-A[0])/L,uy=(N[1]-A[1])/L;const lead=(i===1?3.6:i===2?4.6:3.0)+1.6;const off=i===3?-0.9:i===2?-0.6:0;return [A[0]+ux*lead-uy*off,A[1]+uy*lead+ux*off];}
/* 塁から塁への走路：途中の塁は手前でふくらみ、内側の角を踏む。runThru=一塁を駆け抜ける */
function plRoute(from,start,to,runThru){const C=[0,19.4];const pts=[start];for(let b=from+1;b<=to;b++){const P=FW_BASE[b];if(b<to){const prev=FW_BASE[b-1],next=FW_BASE[b+1];const din=[P[0]-prev[0],P[1]-prev[1]];const Lin=Math.hypot(din[0],din[1]);const u=[din[0]/Lin,din[1]/Lin];const out=[P[0]-C[0],P[1]-C[1]];const Lo=Math.hypot(out[0],out[1]);const o=[out[0]/Lo,out[1]/Lo];
   pts.push([P[0]-u[0]*5.0+o[0]*1.5,P[1]-u[1]*5.0+o[1]*1.5]);pts.push([P[0]-u[0]*1.6+o[0]*0.9,P[1]-u[1]*1.6+o[1]*0.9]);pts.push([P[0]-o[0]*0.25,P[1]-o[1]*0.25]);const dn=[next[0]-P[0],next[1]-P[1]];const Ln=Math.hypot(dn[0],dn[1]);pts.push([P[0]+dn[0]/Ln*2.2,P[1]+dn[1]/Ln*2.2]);}
  else{if(runThru&&b===1){pts.push([P[0],P[1]]);pts.push([P[0]+3.6,P[1]+3.4]);}else pts.push([P[0],P[1]]);}}
 return pts;}
function plRunners(sc,ents,RL,BR,X){const S=FW_SPEED;const ts=X.ts;const tb=X.tb;const cb=arTeamColors(tb);const vOf=sp=>clamp(6.6+((sp||55)-50)/22,5.6,8.6);const thr=X.throwPlan;const opt=X.opt;const prev=opt.prev&&opt.prev.mo?opt.prev.mo.ents:null;
 const bench=AR.m&&AR.m.top?[17,3]:[-17,3];/* 攻撃側のベンチ（表＝一塁側） */
 const mk=(rec,isB)=>{if(!rec)return;const from=isB?0:rec.from;const key=isB?'BR':'R'+from;const dest=rec.outAt&&rec.outAt>0?rec.outAt:rec.to;const out=rec.outAt!=null&&rec.outAt>=0?rec.outAt:null;
  const e=ents[key]=plEnt({key,mir:1,run:rec,isB});const v=vOf(rec.speed);
  const start=isB?[-X.bs*0.86,-0.12]:plLeadPos(from);
  if(isB){plAdd(e,{k:'clip',clip:'b_swing',t0:-600,x:start[0],y:start[1],yaw:X.bs*Math.PI/2,mir:X.bs,off:75-600*ts,rate:ts});e.mir=X.bs;e.dropBat=plS(240);}
  else plAdd(e,{k:'pose',pose:'r_lead',t0:-600,x:start[0],y:start[1],yaw:moYawTo(start[0],start[1],0,18.4)});
  const r={pid:rec.pid,name:rec.name,col:cb,path:null,outAt:null,safeAt:null,scored:dest===4&&out==null,isBatter:!!isB,helmet:true,key};
  /* 判断で止めたあとの再開：止める前の動きはそのまま使い、その位置から続きを走る */
  const pe=prev&&prev[key];const resume=opt.resume;
  if(pe&&resume!=null&&resume>0&&!(isB&&out===0)){const segs=[];for(const g of pe.segs){if(g.t0>=resume)break;segs.push(Object.assign({},g));}
   if(segs.length){const lg=segs[segs.length-1];lg.t1=resume;const posR=plEntPos(pe,resume),posB=plEntPos(pe,resume-plS(60));const v0=Math.min(9,Math.hypot(posR[0]-posB[0],posR[1]-posB[1])/(plS(60)/1000)*FW_SPEED);
    e.segs=segs;if(isB)e.dropBat=pe.dropBat;let nb=from+1;while(nb<4&&Math.hypot(posR[0]-FW_BASE[nb][0],posR[1]-FW_BASE[nb][1])<1.2)nb++;
    if(dest<nb){/* 戻る（帰塁） */const B0=FW_BASE[dest];const path=plRunPath([[posR[0],posR[1]],[B0[0],B0[1]]],resume,resume+plS(1500),5.5,{v0:Math.min(v0,3),v1:0});plAdd(e,{k:'move',t0:resume,t1:path[path.length-1].t,path,style:'run',fade:120});plAdd(e,{k:'pose',pose:'f_stand',t0:path[path.length-1].t,x:B0[0],y:B0[1],yaw:moYawTo(B0[0],B0[1],0,18.4),fade:300});r.path=path;r.holdEnd=path[path.length-1].t;sc.runners.push(r);return;}
    const route=plRoute(nb-1,[posR[0],posR[1]],dest,false);const th=thr.find(x=>x.base===dest);const nat=(()=>{const p=moProfile(route,v,5.2,5,0,{v0,v1:1.5,ts:1});return p[p.length-1].t*S;})();
    let tB=resume+nat;if(out!=null&&out>0&&th)tB=th.Ta+plS(140);else if(th&&!th.soft)tB=Math.max(resume+plS(300),Math.min(resume+nat,th.Ta-plS(160)));
    const path=plRunPath(route,resume,tB,v,{v0,v1:0});plAdd(e,{k:'move',t0:resume,t1:tB,path,style:'run',fade:100});const endP=[path[path.length-1].x,path[path.length-1].y];
    if(out!=null){r.outAt={t:tB,base:out};const tg=tB+plS(900);plAdd(e,{k:'pose',pose:'f_stand',t0:tB,x:endP[0],y:endP[1],yaw:moYawTo(endP[0],endP[1],bench[0],bench[1]),fade:300});plAdd(e,{k:'move',t0:tg,t1:tg+plS(3500),path:[{t:tg,x:endP[0],y:endP[1]},{t:tg+plS(3500),x:bench[0],y:bench[1]}],style:'walk',fade:300});}
    else{r.safeAt={t:tB,base:dest};if(dest===4){plAdd(e,{k:'move',t0:tB+plS(200),t1:tB+plS(2800),path:[{t:tB+plS(200),x:endP[0],y:endP[1]},{t:tB+plS(2800),x:bench[0]*0.7,y:bench[1]-2}],style:'jog',fade:300});sc.callouts.push({t:tB,x:0,y:0,z:2.5,text:'得点！',kind:'score'});}else{const Bp=FW_BASE[dest];plAdd(e,{k:'pose',pose:'f_stand',t0:tB,x:Bp[0],y:Bp[1],yaw:moYawTo(Bp[0],Bp[1],0,18.4),fade:300});}}
    r.path=path;r.arriveT=tB;sc.runners.push(r);return;}}
  /* 捕球されてアウト（打者）：一塁へ走りかけて止まる */
  if(isB&&out===0){const t0=plS(300);const stopT=X.Tc!=null?X.Tc:X.ball.Tland;const far=Math.min(0.7,(stopT-t0)/S/1000*v/27.4);const P1=[start[0]+(19.4-start[0])*far,start[1]+(19.4-start[1])*far];
   if(far>0.05){const path=plRunPath([start,P1],t0,Math.max(t0+plS(400),stopT),v,{v1:2});plAdd(e,{k:'move',t0,t1:path[path.length-1].t,path,style:'run'});plAdd(e,{k:'move',t0:path[path.length-1].t,t1:path[path.length-1].t+plS(2500),path:[{t:path[path.length-1].t,x:P1[0],y:P1[1]},{t:path[path.length-1].t+plS(2500),x:bench[0],y:bench[1]}],style:'walk',fade:300});}
   r.outAt={t:stopT,base:0};sc.runners.push(r);return;}
  /* 出発：打者はスイングを終えてから（約0.3秒）、走者は打球の種類で（フライは帰塁・タッチアップ、ライナーは止まる） */
  let t0=isB?plS(300):plS(90);let tagUp=false;
  if(!isB&&X.caught){if(dest===4&&from===3&&out==null){tagUp=true;t0=X.Tc;}else if(dest===from&&out==null){/* 帰塁：少し戻って塁に立つ */const B0=FW_BASE[from];const path=plRunPath([start,[B0[0],B0[1]]],plS(200),plS(200)+plS(1100),3.5,{v1:0});plAdd(e,{k:'move',t0:path[0].t,t1:path[path.length-1].t,path,face:{mode:'pt',x:0,y:18.4},style:'jog'});plAdd(e,{k:'pose',pose:'f_stand',t0:path[path.length-1].t,x:B0[0],y:B0[1],yaw:moYawTo(B0[0],B0[1],0,18.4),fade:250});r.path=path;sc.runners.push(r);return;}}
  else if(!isB&&X.air&&!X.caught&&!X.isHR){t0=Math.min(X.ball.Tland*0.45,plS(350));}
  if(X.isHR){t0=isB?plS(500):plS(250);}
  if(dest===from&&!isB){/* 進まない：打球を見て、捕られたら塁へ戻る */const B0=FW_BASE[from];const tb=Math.max(plS(500),(X.Tc||plS(800))+plS(150));const path=plRunPath([start,[B0[0],B0[1]]],tb,tb+plS(1300),3.6,{v1:0});plAdd(e,{k:'pose',pose:'r_lead',t0:plS(100),x:start[0],y:start[1],yaw:moYawTo(start[0],start[1],0,18.4),fade:300});plAdd(e,{k:'move',t0:tb,t1:path[path.length-1].t,path,face:{mode:'pt',x:X.ball.land[0],y:X.ball.land[1]},style:'jog'});plAdd(e,{k:'pose',pose:'f_stand',t0:path[path.length-1].t,x:B0[0],y:B0[1],yaw:moYawTo(B0[0],B0[1],0,18.4),fade:300});r.path=path;sc.runners.push(r);return;}
  const runThru=isB&&dest===1&&!X.air&&out==null||isB&&dest===1&&out!=null;
  const route=plRoute(from,tagUp?FW_BASE[3].slice():start,dest,runThru);
  /* 着く時刻：アウト＝送球が先、セーフ＝走者が先 */const th=thr.find(x=>x.base===dest);let arrive=null;const vv=X.isHR?7.0:v;
  const natural=(()=>{const p=moProfile(route,vv,X.isHR?3:5.2,X.isHR?2.5:5,0,{v0:isB||tagUp?0:2.2,v1:runThru||X.isHR?2:1.5,ts:1/S*1,lat:7});return p[p.length-1].t;})();
  /* ↑ moProfile の時刻は実時間 ms。場面 ms へ直す */const nat=natural*S;
  const bIdx=runThru?route.length-2:route.length-1;/* 塁を踏む点 */
  const routeLen=(()=>{let s=0,sb=0;for(let i=1;i<route.length;i++){const d=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);s+=d;if(i<=bIdx)sb+=d;}return {s,sb};})();
  const fBase=routeLen.sb/routeLen.s;/* 経路のうち塁までの割合（時間はおよそ距離に比例） */
  if(out!=null&&out>0){const Ta=th?th.Ta:t0+nat;arrive=Ta+plS(140);}
  else if(th&&!th.soft){arrive=Math.min(t0+nat*fBase,th.Ta-plS(160));if(arrive<t0+plS(400))arrive=t0+plS(400);}
  const tBase=arrive!=null?arrive:t0+nat*fBase;const tEnd=t0+(tBase-t0)/fBase;
  const close=th&&Math.abs(tBase-th.Ta)<plS(450);const slide=!runThru&&!X.isHR&&dest>1&&(out!=null||close||dest===4&&th);
  let path;if(slide){/* 最後の2.6mはスライディング */const sl=2.6;const last=route[route.length-1],pv=route[route.length-2];const dd=Math.hypot(last[0]-pv[0],last[1]-pv[1]);const k=Math.max(0,1-sl/Math.max(dd,sl+0.1));const sp=[pv[0]+(last[0]-pv[0])*k,pv[1]+(last[1]-pv[1])*k];const r2=route.slice(0,-1).concat([sp]);
   const tS=tBase-plS(380);path=plRunPath(r2,t0,tS,vv,{v0:isB||tagUp?0:2.2,v1:vv*0.85});plAdd(e,{k:'move',t0,t1:tS,path,style:'run'});const yawS=moYawTo(sp[0],sp[1],last[0],last[1]);
   const gp=[{t:tS,x:sp[0],y:sp[1]},{t:tS+plS(240),x:sp[0]+(last[0]-sp[0])*0.82,y:sp[1]+(last[1]-sp[1])*0.82},{t:tBase,x:last[0]-(last[0]-sp[0])*0.02,y:last[1]-(last[1]-sp[1])*0.02}];plAdd(e,{k:'glide',t0:tS,t1:tBase+plS(500),path:gp,yaw:yawS,pose:'r_slide',fade:plS(120)});
   path=path.concat(gp.slice(1));r.slide=true;if(typeof r3AddDirt==='function')r.dirtAt=tS;}
  else{path=plRunPath(route,t0,tEnd,vv,{v0:isB||tagUp?0:2.2,v1:runThru?2.5:0});plAdd(e,{k:'move',t0,t1:path[path.length-1].t,path,style:X.isHR?'jog':'run'});}
  const endP=[path[path.length-1].x,path[path.length-1].y];const tl=path[path.length-1].t;
  if(out!=null){r.outAt={t:tBase,base:out};/* アウト：コールのあとベンチへ */const tg=tBase+plS(900);plAdd(e,{k:'pose',pose:'f_stand',t0:slide?tBase+plS(500):tl,x:endP[0],y:endP[1],yaw:moYawTo(endP[0],endP[1],bench[0],bench[1]),fade:300});plAdd(e,{k:'move',t0:tg,t1:tg+plS(3500),path:[{t:tg,x:endP[0],y:endP[1]},{t:tg+plS(3500),x:bench[0],y:bench[1]}],style:'walk',fade:300});}
  else{if(arrive!=null||th)r.safeAt={t:tBase,base:dest};
   if(dest===4){/* 生還：本塁を踏んで減速、ベンチの方へ */const tg=tl+plS(200);plAdd(e,{k:'move',t0:tg,t1:tg+plS(2600),path:[{t:tg,x:endP[0],y:endP[1]},{t:tg+plS(2600),x:bench[0]*0.7,y:bench[1]-2}],style:'jog',fade:300});sc.callouts.push({t:tBase,x:0,y:0,z:2.5,text:X.isHR&&isB?'ホームイン':'得点！',kind:'score',dur:X.isHR?900:undefined});}
   else{const Bp=FW_BASE[dest];const yaw=moYawTo(Bp[0],Bp[1],0,18.4);if(runThru){/* 駆け抜けて戻る */const tg=tl+plS(350);plAdd(e,{k:'move',t0:tg,t1:tg+plS(1500),path:[{t:tg,x:endP[0],y:endP[1]},{t:tg+plS(1500),x:Bp[0]+0.4,y:Bp[1]+0.3}],face:{mode:'pt',x:0,y:18.4},style:'walk',fade:250});plAdd(e,{k:'pose',pose:'f_stand',t0:tg+plS(1500),x:Bp[0]+0.4,y:Bp[1]+0.3,yaw,fade:300});}
    else plAdd(e,{k:'pose',pose:'f_stand',t0:slide?tBase+plS(700):tl,x:Bp[0],y:Bp[1],yaw,fade:slide?plS(500):300});}}
  r.path=path;r.arriveT=tBase;r.trot=X.isHR;sc.runners.push(r);};
 for(const rec of RL)mk(rec,false);mk(BR,true);
 /* アウト／セーフの表示（送球の到着と走者の到着の遅い方） */
 for(const th of thr){const Bp=FW_BASE[th.base];const rr=sc.runners.find(r=>(r.outAt&&r.outAt.base===th.base)||(r.safeAt&&r.safeAt.base===th.base));if(th.out){sc.callouts.push({t:Math.max(th.Ta,rr&&rr.outAt?rr.outAt.t:th.Ta),x:Bp[0],y:Bp[1],z:2.2,text:'アウト！',kind:'out',base:th.base});}
  else if(rr&&!th.soft){sc.callouts.push({t:Math.max(th.Ta,rr.safeAt?rr.safeAt.t:th.Ta),x:Bp[0],y:Bp[1],z:2.2,text:'セーフ！',kind:'safe',base:th.base});}}
 if(X.caught&&BR&&BR.outAt===0){const p=sc.pick;sc.callouts.push({t:X.Tc+plS(350),x:p[0],y:p[1],z:2.5,text:'アウト！',kind:'out',base:0});}}
/* ほかの野手の動き */
function plSupport(sc,ents,X){const S=FW_SPEED;const R=X.R;const thr=X.throwPlan;const busy=k=>ents[k].segs.length>1||(k==='投'&&false);const m=X.m;const anyOn=m.bases.some(Boolean)||sc.runners.some(r=>!r.isBatter);
 const at=(k,t)=>X.posAt(k,t);const go=(k,to,face,pose,o)=>{if(busy(k)&&!(o&&o.force))return;const yaw=face&&face.mode==='pt'?moYawTo(to[0],to[1],face.x,face.y):moYawTo(to[0],to[1],0,0);X.runTo(k,to,R+(o&&o.delay||0),null,face||{mode:'vel'},{k:'pose',pose:pose||'f_ready',t0:0,x:to[0],y:to[1],yaw,fade:250},{v1:0,vMul:o&&o.vMul||0.92});};
 const backup=(base,from,dist)=>{const Bp=FW_BASE[base];const d=[Bp[0]-from[0],Bp[1]-from[1]];const L=Math.hypot(d[0],d[1])||1;return [Bp[0]+d[0]/L*(dist||7),Bp[1]+d[1]/L*(dist||7)];};
 const f=X.fielder;const ofF=['左','中','右'].includes(f);const groundIF=!X.ball.air&&!ofF;const pick=X.Pc||X.ball.land;
 /* 送球のカバーリング（送球の線の延長） */
 for(const th of thr){const who=th.base===1?'右':th.base===2?'中':th.base===3?'左':'投';if(who!==th.cv&&!busy(who))go(who,backup(th.base,th.from,th.base===4?9:th.base===2?11:8),{mode:'pt',x:FW_BASE[th.base][0],y:FW_BASE[th.base][1]},'f_ready',{vMul:0.95});
  if(th.base===1&&!anyOn&&!busy('捕')&&groundIF)go('捕',[17.6,13.2],{mode:'pt',x:19.4,y:19.4},'f_ready',{delay:plS(120)});}
 if(groundIF){/* 内野ゴロ：一塁手は一塁へ、二塁は打球と反対側の二遊間が入る、三塁手は三塁へ。右方向なら投手は一塁へ */
  if(!busy('一')&&f!=='一')go('一',[19.0,19.9],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');
  if(!busy(X.cover2))go(X.cover2,[X.cover2==='二'?0.9:-0.9,38.4],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');
  if(!busy('三')&&f!=='三')go('三',[-18.6,19.9],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');
  if(!busy('投')&&(f==='一'||f==='二'||X.c.a>8))go('投',[15.5,15.2],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');}
 else if(ofF||X.ball.air){/* 外野へ：中継・ベースカバー・外野手のカバー */const lead=Math.max(0,...sc.runners.map(r=>r.outAt?r.outAt.base:(r.safeAt?r.safeAt.base:0)));const tgtB=thr.length?thr[0].base:(lead>=2?3:2);
  if(ofF&&!X.isHR){const relay=pick[0]<4?'遊':'二';const other=relay==='遊'?'二':'遊';const Bt=FW_BASE[Math.min(4,tgtB)];const rp=[pick[0]+(Bt[0]-pick[0])*0.55,pick[1]+(Bt[1]-pick[1])*0.55];
   if(!busy(relay))go(relay,rp,{mode:'pt',x:pick[0],y:pick[1]},'f_ready',{vMul:1});if(!busy(other))go(other,[0.8,38.6],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');
   if(!busy('一'))go('一',[19.2,19.8],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');if(!busy('三'))go('三',[-18.8,19.8],{mode:'pt',x:pick[0],y:pick[1]},'f_ready');
   if(!busy('投'))go('投',lead>=1?[-2.5,-11]:[0,30],{mode:'pt',x:pick[0],y:pick[1]},'f_ready',{delay:plS(300)});
   /* 外野手どうしのカバー：捕る外野手の後ろへ */const nb=f==='中'?(pick[0]<0?'左':'右'):'中';const d0=[pick[0],pick[1]];const L=Math.hypot(d0[0],d0[1])||1;const bk=[pick[0]+d0[0]/L*9,pick[1]+d0[1]/L*9];if(!busy(nb))go(nb,bk,{mode:'pt',x:pick[0],y:pick[1]},'f_ready',{vMul:1});}
  else if(X.caught&&!ofF){/* 内野フライ：ほかは塁へ */for(const [k,p] of [['一',[19.2,19.8]],['二',[0.9,38.5]],['三',[-18.8,19.8]],['遊',[-3,33]]])if(!busy(k)&&k!==f)go(k,p,{mode:'pt',x:pick[0],y:pick[1]},'f_ready');}}
 if(X.isHR){for(const k of ['一','二','三','遊']){if(!busy(k)){const p=at(k,0);plAdd(ents[k],{k:'pose',pose:'f_stand',t0:plS(1600),x:p[0],y:p[1],yaw:moYawTo(p[0],p[1],0,0),fade:600});}}}
 /* 投手：特に役割がなければ打球の方へ数歩 */
 if(!busy('投')){const p=at('投',X.freeAt('投'));const dx=pick[0]-p[0],dy=pick[1]-p[1];const L=Math.hypot(dx,dy)||1;const q=[p[0]+dx/L*1.2,p[1]+dy/L*1.2];X.runTo('投',q,X.freeAt('投'),null,{mode:'pt',x:pick[0],y:pick[1]},{k:'pose',pose:'f_ready',t0:0,x:q[0],y:q[1],yaw:moYawTo(q[0],q[1],pick[0],pick[1]),fade:300},{style:'jog',vMul:0.6});}
 /* 捕手：マスクを外して打球を見る（立ち上がる） */
 if(!busy('捕')){const tUp=plS(350);plAdd(ents['捕'],{k:'pose',pose:'f_ready',t0:tUp,x:0,y:-0.6,yaw:moYawTo(0,-0.6,pick[0],pick[1]),fade:plS(350)});}
 /* 何もしない野手：打球の方を向いて構え直す */
 for(const k of ['一','二','三','遊','左','中','右']){if(busy(k))continue;const p=at(k,0);const yaw=moYawTo(p[0],p[1],pick[0],pick[1]);plAdd(ents[k],{k:'pose',pose:'f_ready',t0:R+plS(200),x:p[0],y:p[1],yaw,fade:plS(400)});}}
/* 審判：判定する塁へ90度の角度で寄り、アウト・セーフをコール */
function plUmps(sc,ents,X){const m=X.m;const on=m.bases.some(Boolean);const U=[[0.35,-1.95,Math.PI],[23.6,17.0,null],[on?-2.5:-4.5,on?29.5:43.5,null],[-23.6,17.0,null]];
 U.forEach((u,i)=>{const e=ents['U'+i]=plEnt({key:'U'+i});const yaw=u[2]!=null?u[2]:moYawTo(u[0],u[1],0,i===2?0:20);plAdd(e,{k:'pose',pose:i===0?'u_set':'u_base',t0:-600,x:u[0],y:u[1],yaw});e.look.push({t0:-1e9,t1:1e9,target:t=>sc.mo&&sc.mo.ballF?sc.mo.ballF:moPts(X.ball.pts,Math.min(t,X.ball.Tland)),w:0.7});});
 const R=plS(250);const up=(i,t,p,yaw,pose)=>{const e=ents['U'+i];const from=(()=>{const g=e.segs[e.segs.length-1];return g.k==='move'?[g.path[g.path.length-1].x,g.path[g.path.length-1].y]:[g.x,g.y];})();const d=Math.hypot(p[0]-from[0],p[1]-from[1]);if(d<0.3){plAdd(e,{k:'pose',pose:pose||'f_stand',t0:t,x:p[0],y:p[1],yaw,fade:300});return;}const dur=plS(d/5.0*1000+300);const path=plRunPath([from,p],t,t+dur,5.5,{v1:0});plAdd(e,{k:'move',t0:t,t1:t+dur,path,style:'jog',fade:200});plAdd(e,{k:'pose',pose:pose||'u_base',t0:t+dur,x:p[0],y:p[1],yaw,fade:250});};
 /* 球審：マスクの後ろから一歩出て見る */up(0,plS(200),[on?-0.8:-1.2,-1.6],moYawTo(-1,-1.6,X.Pc?X.Pc[0]:0,X.Pc?X.Pc[1]:30),'f_stand');
 /* 判定：塁ごとに担当（一塁=U1、二塁=U2、三塁=U3、本塁=U0） */
 for(const cl of sc.callouts){if(cl.kind!=='out'&&cl.kind!=='safe')continue;const base=cl.base!=null?cl.base:(Math.abs(cl.x)<6&&cl.y<6?4:cl.x>8?1:cl.x<-8?3:2);if(base===0)continue;const i=base===1?1:base===2?2:base===3?3:0;const Bp=FW_BASE[base];
  const th=X.throwPlan.find(t=>t.base===base);const from=th?th.from:[0,18];const d=[Bp[0]-from[0],Bp[1]-from[1]];const L=Math.hypot(d[0],d[1])||1;let n=[-d[1]/L,d[0]/L];if(n[0]*(0-Bp[0])+n[1]*(19.4-Bp[1])<0&&base!==4)n=[-n[0],-n[1]];/* 送球の線に直角、内野側 */
  const spot=base===4?[-2.2,-1.4]:[Bp[0]+n[0]*5.2,Bp[1]+n[1]*5.2];const yaw=moYawTo(spot[0],spot[1],Bp[0],Bp[1]);up(i,Math.max(R,cl.t-plS(1400)),spot,yaw,'u_base');plAdd(ents['U'+i],{k:'clip',clip:cl.kind==='out'?'u_out':'u_safe',t0:cl.t-plS(60),x:spot[0],y:spot[1],yaw,rate:1/FW_SPEED,fade:120});}}
/* 2D表示・カメラ用：体の位置の時系列、ボールの位置の時系列 */
function plLegacy(sc,ents,B,ball){const T=Math.max(ball.Tland,...sc.throws.map(x=>x.Ta))+plS(3500);const step=60;
 for(const k of ['投','捕','一','二','三','遊','左','中','右']){const e=ents[k];const path=[],pose=[];let lastP=null;for(let t=0;t<=T;t+=step){const p=plEntPos(e,t);path.push({t,x:p[0],y:p[1]});const st=p[2];const g=st&&st.seg;let ps=g?(g.k==='move'?'run':g.clip==='f_gb'||g.clip==='f_tag'||g.clip==='f_cover'||g.clip==='f_1b'?'catchLow':g.clip==='f_fly'||g.clip==='f_line'?'catchHigh':/throw/.test(g.clip||'')?'throw':g.pose==='f_ready'?'ready':'stand'):'stand';if(ps!==lastP){pose.push({t,p:ps});lastP=ps;}}
  sc.fielders[k]={path,pose,face:k==='捕'?1:-1};}
 for(const r of sc.runners){const e=ents[r.key];if(!e)continue;const path=[];for(let t=0;t<=T;t+=step){const p=plEntPos(e,t);path.push({t,x:p[0],y:p[1]});}r.path2=r.path;r.path=path;}
 /* ボール：保持中は持っている人の位置（胸の高さ） */const ctx={rig:()=>null,ts:1/FW_SPEED};const pts=[];
 for(let t=0;t<=T;t+=30){const g=moBallSegAt(B,t);if(!g)continue;let p=null;if(g.k==='hold'||g.k==='xfer'){const q=plEntPos(ents[g.ent]||{segs:[]},t);p=[q[0],q[1],1.2];}else if(g.k==='fly'){const f0=g.from&&g.from.fallback?g.from.fallback:null;const gg=Object.assign({},g,{p0:g.p0||f0});p=moBallPos({segs:[gg],ev:[]},t,ctx);}else if(g.k==='gone'){break;}else p=moBallPos({segs:[g],ev:[]},t,ctx);if(p)pts.push({t,x:p[0],y:p[1],z:p[2]});}
 sc.ball=pts.length?pts:[{t:0,x:0,y:0,z:1}];}
/* 場面の作成：新しい計画（失敗したら従来の演出） */
function plBuildSafe(c,play,opt){try{if(typeof plBuild==='function'){opt=Object.assign({},opt||{});if(!opt.contact)opt.contact=plContactPoint();if(opt.pitchClip==null)opt.pitchClip=plPitchClipAt();return plBuild(c,play,opt);}}catch(e){console.warn('play plan failed',e);}return fwBuildScene(c,play,opt);}
/* 接触点（フィールド座標）：スイングの接触の時刻のボールの位置 */
function plContactPoint(){const P=AR.cur;if(!P||!AR.swingT||!AR.t0)return null;const tc=AR.swingT+75*AR.speed;const u=clamp((tc-AR.t0)/(P.T*AR.speed),0,1.05);try{const v=r3PitchPos(P,Math.min(1,u),PL.rel||null);return [v.x,-v.z,v.y];}catch(e){return null;}}
/* 接触の時刻の投手のクリップ時刻（フォローの続きから守備の場面を始める） */
function plPitchClipAt(){if(!AR.windT0||!AR.swingT)return 1450;const tRel=AR.windT0+arWindDur();const tc=AR.swingT+75*AR.speed;return clamp(1000+(tc-tRel),1000,1650);}
/* 守備の場面の1コマ（r3FieldScene から呼ぶ） */
function plFieldFrame(sc,t,now){const m=AR.m;const cd=sc.colDef||arTeamColors(m.def()),cb=sc.colBat||arTeamColors(m.bat());const dT=sc.defTeam||m.def(),bT=sc.batTeam||m.bat();const M=sc.mo;
 const numOf=(team,k)=>{if(k==='投'&&team.pitcher)return team.pitcher.number!=null?team.pitcher.number:1;const sl=team.lineup.find(x=>x.pos===k);return sl?(sl.p.number!=null?sl.p.number:POS_NUM[k]):POS_NUM[k];};const plOf=(team,pid)=>team.lineup.map(x=>x.p).concat(team.bench||[]).find(x=>x.id===pid);
 for(const k in R3.fielders){const r=R3.fielders[k];r.g.visible=true;r.setColors(cd,false);r.setNumber(numOf(dT,k),cd.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=true;r.bat.visible=false;r.glove.scale.setScalar(k==='捕'?1.18:k==='一'?1.1:1);r3Dress(r,r3PlayerOf(dT,k));r.setExpression(null);}
 const rk=Object.keys(M.ents).filter(k=>/^R\d/.test(k)).sort();const rigOf=k=>{if(R3.fielders[k])return R3.fielders[k];if(k==='BR'||k==='B')return R3.batter;if(k[0]==='R'){const i=rk.indexOf(k);return i>=0?R3.runners[i]:null;}if(k==='U0')return R3.umps[0];if(k==='U1')return R3.umps[1];if(k==='U3')return R3.umps[2];if(k==='U2')return plRig('ump2',r=>{r.setColors(R3_UMP,false);r.setGear(null);});return null;};
 const b=R3.batter;const be=M.ents.BR;const bb=M.ents.B;b.g.visible=!!(be||bb);if(be){b.setColors(cb,true);b.setGear(null);const pl=plOf(bT,be.run.pid);if(pl){r3Dress(b,pl);b.setNumber(pl.number!=null?pl.number:null,cb.trim);}b.bat.visible=t<(be.dropBat||0);b.glove.visible=false;}
 else if(bb){b.setColors(cb,true);b.setGear(null);const pl=m.pa&&m.pa.b;if(pl){r3Dress(b,pl);b.setNumber(pl.number!=null?pl.number:null,cb.trim);}b.bat.visible=true;b.glove.visible=false;}
 for(let i=0;i<R3.runners.length;i++){const r=R3.runners[i];const k=rk[i];r.g.visible=!!k;if(!k)continue;const e=M.ents[k];r.setColors(cb,true);r.setGear(null);r.bat.visible=false;r.glove.visible=false;const pl=plOf(bT,e.run.pid);if(pl){r3Dress(r,pl);r.setNumber(pl.number!=null?pl.number:null,cb.trim);}}
 for(const u of R3.umps){u.g.visible=true;u.bat.visible=false;u.glove.visible=false;}const u2=rigOf('U2');u2.g.visible=true;u2.bat.visible=false;u2.glove.visible=false;
 /* 走者の表情：スライディング中は歯を食いしばる、生還は叫ぶ */for(const r of sc.runners){const e=M.ents[r.key];const rig=e&&rigOf(r.key);if(!rig)continue;const sl=r.slide&&r.arriveT&&t>r.arriveT-plS(450)&&t<r.arriveT+plS(600);rig.setExpression(sl?'grit':(r.scored&&r.arriveT&&t>r.arriveT)?'shout':null);if(sl&&!r._dirt){r._dirt=true;r3AddDirt(r.pid,0.25);}}
 const res=moFrame({ents:M.ents,rig:rigOf,ball:M.ball,ts:M.ts},t);
 if(res.ball&&t<=sc.T+400){R3.ball.visible=true;R3.ball.position.set(res.ball[0],Math.max(0.04,res.ball[2]),-res.ball[1]);M.ballF=res.ball;R3.ballF=res.ball;}else R3.ball.visible=false;
 R3.mitt.visible=false;
 /* バット：走り出す瞬間に手から離れ、地面へ落ちて転がる（離した時刻の手元の位置・向きから） */
 if(be){const td=be.dropBat||0;if(!M.batDrop){const keep=b.bat.visible;const st=moEval(be,td);b.bat.visible=true;moApply(b,st,be,td);b.bat.updateMatrixWorld(true);const pw=new THREE.Vector3(),qw=new THREE.Quaternion();b.bat.getWorldPosition(pw);b.bat.getWorldQuaternion(qw);M.batDrop={p:pw,q:qw};b.bat.visible=keep;moApply(b,moEval(be,t),be,t);}
  if(t>=td)plGroundBat(M.batDrop,(t-td)/FW_SPEED);else plGroundBat(null);}else plGroundBat(null);
 /* 歓声 */for(const cl of sc.callouts){const dt=t-cl.t;if(dt<0||dt>1000)continue;if(cl.kind==='hr'||cl.kind==='score')R3.cheerUntil=Math.max(R3.cheerUntil||0,now+2200);}}
function plGroundBat(d,ms){if(!R3.scene)return;if(!R3.gbat){const g=new THREE.Group();const m1=new THREE.Mesh(new THREE.CylinderGeometry(0.034,0.014,0.84,14),r3MatP('#d6ab74',{roughness:0.4}));m1.position.y=0.32;m1.castShadow=true;g.add(m1);R3.scene.add(g);R3.gbat=g;}
 const g=R3.gbat;g.visible=!!d;if(!d)return;const u=clamp(ms/320,0,1);/* 落下：重力で加速しながら地面へ、向きは寝かせる */
 const lie=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0.8,0,0.6).normalize());const end=d.p.clone();end.y=0.035;end.x+=0.25;end.z+=0.1;
 g.position.copy(d.p).lerp(end,u*u);if(u>=1){const k=clamp((ms-320)/400,0,1);g.position.x=end.x+0.18*Math.sin(k*1.4);}g.quaternion.copy(d.q).slerp(lie,Math.min(1,u*1.2));}
/* ================= 走者のプレー（盗塁・けん制・暴投）の場面 =================
 盗塁：走者は投球と同時にスタート→滑り込み。捕手は捕ってすぐ立ち上がって送球、二塁は右打者なら二塁手・左打者なら遊撃手、三塁は三塁手が入り、捕ってタッチ。中堅手は二塁の後ろへ
 けん制：投手が塁へ素早く投げ、走者は頭から帰塁。悪送球なら球がそれて走者は次の塁へ
 暴投：球は捕手の後ろへ転がり、捕手が追って拾う。走者は次の塁へ。三塁走者が還るときは投手が本塁へ入る */
function plRunSceneSafe(rp){try{return plRunScene(rp);}catch(e){console.warn('run plan failed',e);}return fwBuildRunnerScene(rp);}
function plRunScene(rp){const m=AR.m;const d=m.def(),tb=m.bat();const S=FW_SPEED;const ts=1/S;const ents={};const B=moBallNew();
 const sc={t0:performance.now(),T:0,ball:[],fielders:{},runners:[],callouts:[],fx:[],pauseAt:null,kind:rp.kind,primary:'捕',ended:false,throws:[],colBat:arTeamColors(tb),colDef:arTeamColors(d),defTeam:d,batTeam:tb};
 const DP=plDefPos(d,m);const hs=m.pa&&m.pa.p&&m.pa.p.throws==='左'?-1:1;const bs=m.pa&&m.pa.bHand==='左'?-1:1;const pRoot=[0,R3C.RUBBER-0.15];
 for(const k of ['投','捕','一','二','三','遊','左','中','右']){const e=ents[k]=plEnt({key:k,mir:k==='投'?hs:1});const p0=DP[k];
  if(k==='投'){plAdd(e,{k:'pose',pose:rp.kind==='pickoff'?'p_setpos':'f_ready',t0:-600,x:rp.kind==='pickoff'?pRoot[0]:pRoot[0]-0.18*hs,y:rp.kind==='pickoff'?pRoot[1]:pRoot[1]-1.3,yaw:0});continue;}
  if(k==='捕'){plAdd(e,{k:'pose',pose:'c_crouch',t0:-600,x:0,y:-0.85,yaw:Math.PI});continue;}
  const yaw=moYawTo(p0[0],p0[1],0,0);plAdd(e,{k:'pose',pose:'f_ready',t0:-600,x:p0[0],y:p0[1],yaw});}
 ents.B=plEnt({key:'B',mir:bs});plAdd(ents.B,{k:'pose',pose:'b_stance',t0:-600,x:-bs*0.86,y:-0.12,yaw:bs*Math.PI/2,edit:(Q,t)=>plWaggle(Q,t)});
 const U=[[0.35,-1.95,Math.PI],[23.6,17.0,null],[-2.5,29.5,null],[-23.6,17.0,null]];U.forEach((u,i)=>{const e=ents['U'+i]=plEnt({key:'U'+i});plAdd(e,{k:'pose',pose:i===0?'u_set':'u_base',t0:-600,x:u[0],y:u[1],yaw:u[2]!=null?u[2]:moYawTo(u[0],u[1],0,i===2?0:20)});});
 const posOf=k=>{const e=ents[k];const g=e.segs[e.segs.length-1];return g.k==='move'?[g.path[g.path.length-1].x,g.path[g.path.length-1].y]:[g.x,g.y];};
 const v=clamp(6.6+((rp.speed||55)-50)/22,5.6,8.6);const rk='R'+rp.from;const re=ents[rk]=plEnt({key:rk,run:{pid:rp.pid,name:rp.name}});const lead=plLeadPos(rp.from);
 const r={pid:rp.pid,name:rp.name,col:sc.colBat,path:null,outAt:null,safeAt:null,helmet:true,key:rk};
 const tagAt=(cv,Bp,from,Ta)=>{const yaw=moYawTo(Bp[0],Bp[1],from[0],from[1]);const rb=moL2F(0.05,0.15,yaw,1);const root=[Bp[0]+rb[0],Bp[1]+rb[1]];const st=posOf(cv);const dd=Math.hypot(root[0]-st[0],root[1]-st[1]);const arr=Ta-plS(240);if(dd>0.3){const t0=Math.max(plS(80),arr-plS(dd/6.5*1000+250));const path=plRunPath([st,root],t0,arr,7,{v1:1});plAdd(ents[cv],{k:'move',t0,t1:arr,path,face:{mode:'pt',x:from[0],y:from[1]},style:'run'});}
  plAdd(ents[cv],{k:'clip',clip:'f_tag',t0:arr,x:root[0],y:root[1],yaw,rate:ts,fade:160});const o=moL2F(0.08,0.5,yaw,1);const cp=[root[0]+o[0],root[1]+o[1],1.1];ents[cv].ik.push({t0:Ta-plS(200),t1:Ta,side:'l',fade:plS(150),target:t=>t>=Ta?cp:(moBallPos(B,t,{rig:()=>null,ts})||cp)});return cp;};
 const call=(base,t,out)=>{const Bp=FW_BASE[base];sc.callouts.push({t,x:Bp[0],y:Bp[1],z:2.2,text:out?'アウト！':'セーフ！',kind:out?'out':'safe',base});const i=base===1?1:base===2?2:base===3?3:0;const sp=base===2?[Bp[0]-4.5,Bp[1]-3.5]:base===1?[Bp[0]+3.5,Bp[1]-4.5]:base===3?[Bp[0]-3.5,Bp[1]-4.5]:[-2.2,-1.4];const e=ents['U'+i];const st=posOf('U'+i);const yaw=moYawTo(sp[0],sp[1],Bp[0],Bp[1]);
  if(Math.hypot(sp[0]-st[0],sp[1]-st[1])>0.3){const t0=Math.max(plS(150),t-plS(1600));const path=plRunPath([st,sp],t0,t-plS(300),5,{v1:0});plAdd(e,{k:'move',t0,t1:t-plS(300),path,style:'jog'});}plAdd(e,{k:'clip',clip:out?'u_out':'u_safe',t0:t-plS(60),x:sp[0],y:sp[1],yaw,rate:ts,fade:120});};
 if(rp.kind==='steal'){/* 捕手：捕球→持ち替え→送球。二塁の送球は高く強く */const Bp=FW_BASE[rp.to];const cv=rp.to===2?(bs>0?'二':'遊'):rp.to===3?'三':'捕';const yawT=moYawTo(0,-0.85,Bp[0],Bp[1]);
  const tS=plS(40);plAdd(ents['捕'],{k:'clip',clip:'f_qthrow',t0:tS,x:0,y:-0.85,yaw:yawT,rate:ts*1.15,fade:plS(120)});const tR=tS+plS(260/1.15);const dist=Math.hypot(Bp[0],Bp[1]+0.85);const Ta=tR+dist/30*1000*S;
  const cp=tagAt(cv,Bp,[0,-0.85],Ta);moBallAdd(B,{k:'hold',t0:-1e3,t1:tS+plS(30),ent:'捕',at:'glove'});moBallAdd(B,{k:'xfer',t0:tS+plS(30),t1:tS+plS(120),ent:'捕',from:'glove',to:'r'});moBallAdd(B,{k:'hold',t0:tS+plS(120),t1:tR,ent:'捕',at:'r'});moBallAdd(B,{k:'fly',t0:tR,t1:Ta,from:{ent:'捕',at:'r',fallback:[0,-0.6,1.6]},to:cp,g:6});moBallAdd(B,{k:'hold',t0:Ta,t1:1e9,ent:cv,at:'glove'});moBallEv(B,{t:tR,k:'release',ent:'捕'});moBallEv(B,{t:Ta,k:'catch',ent:cv});
  /* 投手はかがんで送球をよける。中堅手・もう一人の内野手は二塁の後ろへ */plAdd(ents['投'],{k:'pose',pose:'f_relax',t0:plS(60),x:pRoot[0]-0.18*hs,y:pRoot[1]-1.3,yaw:0,fade:200});
  if(rp.to===2){const bk=cv==='二'?'遊':'二';const b1=[Bp[0]+(cv==='二'?-2.5:2.5),Bp[1]+3.5];const st=posOf(bk);const path=plRunPath([st,b1],plS(120),plS(120)+plS(1400),6.5,{v1:0});plAdd(ents[bk],{k:'move',t0:path[0].t,t1:path[path.length-1].t,path,face:{mode:'pt',x:0,y:0},style:'run'});plAdd(ents[bk],{k:'pose',pose:'f_ready',t0:path[path.length-1].t,x:b1[0],y:b1[1],yaw:moYawTo(b1[0],b1[1],0,0),fade:200});
   const c0=posOf('中');const c1=[Bp[0]*0.5,Bp[1]+14];const p2=plRunPath([c0,c1],plS(150),plS(150)+plS(2500),6.5,{v1:0});plAdd(ents['中'],{k:'move',t0:p2[0].t,t1:p2[p2.length-1].t,path:p2,face:{mode:'pt',x:0,y:0},style:'run'});plAdd(ents['中'],{k:'pose',pose:'f_ready',t0:p2[p2.length-1].t,x:c1[0],y:c1[1],yaw:moYawTo(c1[0],c1[1],0,0),fade:200});}
  /* 走者：投球と同時にスタート（場面の0より前）→最後はスライディング */const arrive=rp.ok?Ta-plS(110):Ta+plS(170);const route=plRoute(rp.from,lead,rp.to,false);const last=route[route.length-1],pv=route[route.length-2]||lead;const dd=Math.hypot(last[0]-pv[0],last[1]-pv[1]);const k=Math.max(0,1-2.6/Math.max(dd,2.7));const sp=[pv[0]+(last[0]-pv[0])*k,pv[1]+(last[1]-pv[1])*k];
  const tS2=arrive-plS(380);const t0=-plS(1300);const path=plRunPath(route.slice(0,-1).concat([sp]),t0,tS2,v,{v0:1.5,v1:v*0.85});plAdd(re,{k:'pose',pose:'r_lead',t0:-1e4,x:lead[0],y:lead[1],yaw:moYawTo(lead[0],lead[1],0,18.4)});plAdd(re,{k:'move',t0,t1:tS2,path,style:'run',fade:plS(120)});
  const gp=[{t:tS2,x:sp[0],y:sp[1]},{t:tS2+plS(240),x:sp[0]+(last[0]-sp[0])*0.82,y:sp[1]+(last[1]-sp[1])*0.82},{t:arrive,x:last[0],y:last[1]}];plAdd(re,{k:'glide',t0:tS2,t1:arrive+plS(500),path:gp,yaw:moYawTo(sp[0],sp[1],last[0],last[1]),pose:'r_slide',fade:plS(120)});
  if(rp.ok)plAdd(re,{k:'pose',pose:'f_stand',t0:arrive+plS(700),x:last[0],y:last[1],yaw:moYawTo(last[0],last[1],0,18.4),fade:plS(500)});else{const bench=m.top?[17,3]:[-17,3];const tg=arrive+plS(1000);plAdd(re,{k:'pose',pose:'f_stand',t0:arrive+plS(600),x:last[0],y:last[1],yaw:moYawTo(last[0],last[1],bench[0],bench[1]),fade:plS(400)});plAdd(re,{k:'move',t0:tg,t1:tg+plS(4000),path:[{t:tg,x:last[0],y:last[1]},{t:tg+plS(4000),x:bench[0],y:bench[1]}],style:'walk',fade:300});}
  r.path=path.concat(gp.slice(1));r.slide=true;r.arriveT=arrive;if(rp.ok)r.safeAt={t:arrive,base:rp.to};else r.outAt={t:arrive,base:rp.to};sc.runners.push(r);call(rp.to,Math.max(arrive,Ta)+plS(60),!rp.ok);sc.throws=[{base:rp.to,Ta,tRel:tR,from:[0,-0.85],cv,out:!rp.ok}];sc.T=Math.max(arrive,Ta)+plS(1500);}
 else if(rp.kind==='pickoff'){const Bp=FW_BASE[rp.from];const cv=rp.from===1?'一':rp.from===2?(bs>0?'遊':'二'):'三';const yawT=moYawTo(pRoot[0],pRoot[1],Bp[0],Bp[1]);
  if(rp.from===1){const p1=[Bp[0]+0.3,Bp[1]+0.6];ents['一'].segs=[];plAdd(ents['一'],{k:'pose',pose:'f_ready',t0:-600,x:p1[0],y:p1[1],yaw:moYawTo(p1[0],p1[1],pRoot[0],pRoot[1])});}
  const tS=plS(30);plAdd(ents['投'],{k:'clip',clip:'f_qthrow',t0:tS,x:pRoot[0],y:pRoot[1],yaw:yawT,rate:ts*1.2,fade:plS(100)});const tR=tS+plS(260/1.2);const dist=Math.hypot(Bp[0]-pRoot[0],Bp[1]-pRoot[1]);const Ta=tR+dist/27*1000*S;
  moBallAdd(B,{k:'hold',t0:-1e3,t1:tR,ent:'投',at:'r'});moBallAdd(B,{k:'fly',t0:tR,t1:Ta,from:{ent:'投',at:'r',fallback:[pRoot[0],pRoot[1],1.6]},to:[Bp[0],Bp[1],0.9],g:6});moBallEv(B,{t:tR,k:'release',ent:'投'});
  const back=rp.ok?Ta-plS(80):Ta+plS(160);plAdd(re,{k:'pose',pose:'r_lead',t0:-1e4,x:lead[0],y:lead[1],yaw:moYawTo(lead[0],lead[1],0,18.4)});
  if(rp.err){/* 悪送球：球がそれる→走者は次の塁へ */const past=[Bp[0]+(rp.from===1?10:-10),Bp[1]+(rp.from===3?-6:6)];moBallAdd(B,{k:'path',t0:Ta,t1:Ta+plS(1200),pts:[{t:Ta,x:Bp[0],y:Bp[1],z:0.9},{t:Ta+plS(1200),x:past[0],y:past[1],z:0.05}]});moBallAdd(B,{k:'gone',t0:Ta+plS(1300),t1:1e9});sc.callouts.push({t:Ta+80,x:Bp[0],y:Bp[1],z:2.2,text:'悪送球！',kind:'err'});
   const tg=plS(250);const dive=[{t:tg,x:lead[0],y:lead[1]},{t:tg+plS(380),x:Bp[0]+(lead[0]-Bp[0])*0.25,y:Bp[1]+(lead[1]-Bp[1])*0.25}];const yawD=moYawTo(lead[0],lead[1],Bp[0],Bp[1]);plAdd(re,{k:'glide',t0:tg,t1:tg+plS(800),path:dive,yaw:yawD,pose:'r_dive',fade:plS(80)});
   const t2=Ta+plS(300);const route=plRoute(rp.from,[dive[1].x,dive[1].y],rp.to,false);const path=plRunPath(route,t2,t2+plS(2800),v,{v0:0,v1:0});plAdd(re,{k:'move',t0:t2,t1:path[path.length-1].t,path,style:'run',fade:plS(250)});const E=FW_BASE[rp.to];plAdd(re,{k:'pose',pose:'f_stand',t0:path[path.length-1].t,x:E[0],y:E[1],yaw:moYawTo(E[0],E[1],0,18.4),fade:300});
   r.path=path;r.arriveT=path[path.length-1].t;r.safeAt={t:r.arriveT,base:rp.to};sc.runners.push(r);sc.T=r.arriveT+plS(900);}
  else{const cp=tagAt(cv,Bp,pRoot,Ta);moBallAdd(B,{k:'hold',t0:Ta,t1:1e9,ent:cv,at:'glove'});moBallEv(B,{t:Ta,k:'catch',ent:cv});
   /* 走者：頭から帰塁 */const tg=Math.max(plS(120),back-plS(420));const yawD=moYawTo(lead[0],lead[1],Bp[0],Bp[1]);const end=[Bp[0]+(lead[0]-Bp[0])*0.12,Bp[1]+(lead[1]-Bp[1])*0.12];const dive=[{t:tg,x:lead[0],y:lead[1]},{t:tg+plS(160),x:lead[0]+(end[0]-lead[0])*0.35,y:lead[1]+(end[1]-lead[1])*0.35},{t:back,x:end[0],y:end[1]}];
   plAdd(re,{k:'glide',t0:tg,t1:back+plS(500),path:dive,yaw:yawD,pose:'r_dive',fade:plS(90)});if(rp.ok)plAdd(re,{k:'pose',pose:'f_stand',t0:back+plS(600),x:Bp[0],y:Bp[1],yaw:moYawTo(Bp[0],Bp[1],0,18.4),fade:plS(500)});
   else{const bench=m.top?[17,3]:[-17,3];const tg2=back+plS(1000);plAdd(re,{k:'pose',pose:'f_stand',t0:back+plS(600),x:end[0],y:end[1],yaw:moYawTo(end[0],end[1],bench[0],bench[1]),fade:plS(400)});plAdd(re,{k:'move',t0:tg2,t1:tg2+plS(4000),path:[{t:tg2,x:end[0],y:end[1]},{t:tg2+plS(4000),x:bench[0],y:bench[1]}],style:'walk',fade:300});}
   r.path=dive;r.slide=true;r.arriveT=back;if(rp.ok)r.safeAt={t:back,base:rp.from};else r.outAt={t:back,base:rp.from};sc.runners.push(r);call(rp.from,Math.max(back,Ta)+plS(60),!rp.ok);sc.T=Math.max(back,Ta)+plS(1300);}
  sc.throws=[{base:rp.from,Ta,tRel:tR,from:pRoot,cv,out:!rp.ok}];sc.primary='投';}
 else if(rp.kind==='wp'){/* 暴投：球は後ろへ。捕手が追って拾い、走者は進む */const stop=[gauss(0,2.5),-12.5];const Tst=plS(800);moBallAdd(B,{k:'path',t0:-200,t1:Tst,pts:[{t:-200,x:0,y:0.3,z:0.5},{t:0,x:0,y:-0.6,z:0.2},{t:plS(250),x:stop[0]*0.4,y:-5,z:0.4},{t:Tst,x:stop[0],y:stop[1],z:0.05}]});
  const cp=[stop[0],stop[1]+0.6];const tC=plS(1450);const path=plRunPath([[0,-0.85],cp],plS(200),tC-plS(330),6.5,{v1:1.2});plAdd(ents['捕'],{k:'move',t0:path[0].t,t1:path[path.length-1].t,path,style:'run',fade:plS(150)});plAdd(ents['捕'],{k:'clip',clip:'f_gb',t0:tC-plS(450),x:cp[0],y:cp[1]+0.5,yaw:moYawTo(cp[0],cp[1]+0.5,stop[0],stop[1]),rate:ts*1.3,fade:150});
  moBallAdd(B,{k:'path',t0:Tst,t1:tC,pts:[{t:Tst,x:stop[0],y:stop[1],z:0.05},{t:tC,x:stop[0],y:stop[1],z:0.05}]});moBallAdd(B,{k:'hold',t0:tC,t1:1e9,ent:'捕',at:'glove'});ents['捕'].ik.push({t0:tC-plS(150),t1:tC,side:'l',fade:plS(120),target:()=>[stop[0],stop[1],0.08]});sc.callouts.push({t:plS(300),x:stop[0],y:-6,z:2,text:'暴投！',kind:'err'});
  let T=plS(1800);let n=0;for(const mv of rp.moves){const k='R'+mv.from;const e=ents[k]=plEnt({key:k,run:{pid:mv.pid,name:mv.name}});const L=plLeadPos(mv.from);plAdd(e,{k:'pose',pose:'r_lead',t0:-1e4,x:L[0],y:L[1],yaw:moYawTo(L[0],L[1],0,18.4)});const vv=clamp(6.6+((mv.speed||55)-50)/22,5.6,8.6);const route=plRoute(mv.from,L,mv.to,false);const p=plRunPath(route,plS(180),plS(180)+(moProfile(route,vv,5.2,5,0,{v0:0.5,v1:0,ts:1}).slice(-1)[0].t)*S,vv,{v0:0.5,v1:0});
   plAdd(e,{k:'move',t0:p[0].t,t1:p[p.length-1].t,path:p,style:'run'});const E=FW_BASE[mv.to];plAdd(e,{k:'pose',pose:'f_stand',t0:p[p.length-1].t,x:E[0],y:E[1],yaw:moYawTo(E[0],E[1],0,18.4),fade:300});const rr={pid:mv.pid,name:mv.name,col:sc.colBat,path:p,helmet:true,key:k,scored:mv.to===4,arriveT:p[p.length-1].t};sc.runners.push(rr);T=Math.max(T,rr.arriveT+plS(600));
   if(mv.to===4){sc.callouts.push({t:rr.arriveT,x:0,y:0,z:2.5,text:'得点！',kind:'score'});const pth=plRunPath([[pRoot[0],pRoot[1]-1.3],[0.6,1.6]],plS(300),plS(2000),6.8,{v1:0});ents['投'].segs[0].t1=plS(300);plAdd(ents['投'],{k:'move',t0:plS(300),t1:pth[pth.length-1].t,path:pth,style:'run'});plAdd(ents['投'],{k:'pose',pose:'f_ready',t0:pth[pth.length-1].t,x:0.6,y:1.6,yaw:Math.PI,fade:200});}n++;}
  sc.T=T;sc.primary='捕';}
 else sc.T=plS(800);
 for(const k in ents){if(!ents[k].look.length)ents[k].look.push({t0:-1e9,t1:1e9,target:()=>sc.mo&&sc.mo.ballF?sc.mo.ballF:[0,10,1.5],w:0.6});}
 sc.mo={ents,ball:B,ts};const fake={Tland:sc.T,pts:[{t:0,x:0,y:0,z:1}]};plLegacy(sc,ents,B,fake);sc.Tfull=sc.T;sc.rate=clamp(sc.T/3000,1,2);return sc;}
