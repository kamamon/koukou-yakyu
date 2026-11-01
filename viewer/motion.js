/* ================= モーション確認（デバッグ用） =================
 ゲームと同じ 3D モジュール（08f/08g/08h/08i）とモーション基盤（08k/08l）で、動作を選んで繰り返し再生する。
 ・速度 1／0.5／0.25、一時停止、コマ送り（1/60秒）、時刻のスライダー
 ・カメラ：正面／側面／背面／真上（ドラッグで回転、ホイール・ピンチで拡大）
 ・表示：動作名と段階、骨格、接地点（緑＝接地）、手・グラブ・バットの基準点、ボールの状態とイベント */
const AR={W:1,H:1,m:null,ctx:null,mode:'action',phase:'pre',side:'bat'};
const G={settings:{action:{model3d:'real'}}};
function actionSettings(){return G.settings.action;}
function arNight(){return false;}
function toast(){}
const $=s=>document.querySelector(s);
function sum(a){return a.reduce((s,v)=>s+v,0);}
function arAbbr(name){return String(name||'').slice(0,4);}
function fontCss(id){const f=UNI_FONTS.find(x=>x.id===id)||UNI_FONTS[0];return f.css;}
const UNI_A={base:'#f3f2ee',trim:'#0b2a4a',cap:'#0b2a4a',capBrim:'#0b2a4a',pants:'#f3f2ee',style:'placket',text:'青葉',textFont:'graduate',textColor:'#0b2a4a',textOutline:'#ffffff',numFont:'oswald',numColor:'#0b2a4a',numOutline:'#ffffff',mark:'青'};
const UNI_B={base:'#f4f4f4',trim:'#9b1c1c',cap:'#9b1c1c',capBrim:'#9b1c1c',pants:'#f4f4f4',style:'sleeve',text:'相模',textFont:'reggae',textColor:'#9b1c1c',textOutline:'#ffffff',numFont:'oswald',numColor:'#9b1c1c',numOutline:'#ffffff',mark:'相'};
const MV={t:0,speed:1,play:true,last:0,scn:'pitch',hand:'右',form:'over',cam:'side',yaw:0,pitch:0.12,dist:4.2,skel:true,marks:true,evlog:[],rigs:{},sc:null,subj:'P'};
/* ---- 場面（シナリオ） ---- */
const MV_SCN={
 pitch:{label:'投球',build:()=>mvPitch(false)},
 swing:{label:'スイング',build:()=>mvPitch(true)},
 gb:{label:'ゴロ捕球→送球',build:()=>mvGrounder()},
 run:{label:'走り（加速→停止）',build:()=>mvRun('line')},
 turn:{label:'方向転換（ベースを回る）',build:()=>mvRun('turn')},
 side:{label:'横移動・後退',build:()=>mvRun('side')},
 fly:{label:'フライ捕球→送球',build:()=>mvFly()},
 slide:{label:'スライディング',build:()=>mvSlide()},
};
function mvRig(key,kind){if(MV.rigs[key])return MV.rigs[key];const r=r3NewRig();R3.scene.add(r.g);MV.rigs[key]=r;r.setColors(kind==='bat'||kind==='runner'?UNI_B:kind==='ump'?R3_UMP:UNI_A,kind==='bat'||kind==='runner');r.setNumber(kind==='ump'?null:(key==='P'?1:key==='C'?2:6),UNI_A.trim);
 if(kind==='catcher')r.setGear('catcher');else if(kind==='ump')r.setGear('umpire');else r.setGear(null);r.glove.visible=kind==='field'||kind==='catcher';r.bat.visible=kind==='bat';return r;}
function mvClear(){for(const k in MV.rigs){const r=MV.rigs[k];if(r.g.parent)r.g.parent.remove(r.g);}MV.rigs={};}
/* 投球：投手・捕手・打者・球審。swing=true でスイングして打球 */
function mvPitch(swing){const L=MV.hand==='左'?-1:1;const ents={},kinds={};
 const relT=1000;const flight=445;const catchT=relT+flight;
 ents.P={ts:1,mir:L,segs:[{k:'clip',clip:'p_set_'+MV.form,t0:0,t1:2400,x:0,y:R3C.RUBBER-0.15,yaw:0}],look:[{t0:0,t1:1600,target:()=>[0,0,1.0],w:0.8}]};kinds.P='field';
 ents.C={ts:1,mir:1,segs:[{k:'pose',pose:'c_crouch',t0:0,t1:2400,x:0,y:-0.95,yaw:Math.PI,edit:(P,t)=>moBreath(P,t,0.5)}],ik:[],look:[{t0:0,t1:2400,target:t=>{const b=MV.ballP;return b||[0,18,1.6];},w:0.7}]};kinds.C='catcher';
 const bh=1;ents.B={ts:1,mir:bh,segs:[{k:'clip',clip:'b_pre',t0:0,t1:swing?1310:2400,x:-0.86*bh,y:-0.12,yaw:Math.PI/2*bh}],look:[{t0:0,t1:2400,target:()=>MV.ballP||[0,18.4,1.6],w:0.9}]};kinds.B='bat';
 ents.U={ts:1,mir:1,segs:[{k:'pose',pose:'u_set',t0:0,t1:2400,x:0.3,y:-2.15,yaw:Math.PI}]};kinds.U='ump';
 const B=moBallNew();B.cur=-1;moBallAdd(B,{k:'hold',t0:-1,t1:relT,ent:'P',at:'r'});
 /* 捕手のミット＝捕球点 */const catchP=[0.05,-0.62,0.78];
 if(!swing){const pts=mvPitchPts(relT,catchT,catchP);moBallAdd(B,{k:'fly',t0:relT,t1:catchT,from:{ent:'P',at:'r'},pts});moBallEv(B,{t:relT,k:'release',ent:'P'});
  moBallAdd(B,{k:'hold',t0:catchT,t1:9e9,ent:'C',at:'glove'});moBallEv(B,{t:catchT,k:'catch',ent:'C'});
  ents.C.ik.push({t0:catchT-260,t1:catchT+600,side:'l',fade:180,target:t=>t<catchT?moBallPos(B,t,MV.ctx):catchP});
  ents.B.segs.push({k:'clip',clip:'b_take',t0:1310,t1:2400,x:-0.86*bh,y:-0.12,yaw:Math.PI/2*bh,fade:200});}
 else{const tc=relT+flight-12;const cp=[0.05,0.55,0.9];const pts=mvPitchPts(relT,tc,cp);moBallAdd(B,{k:'fly',t0:relT,t1:tc,from:{ent:'P',at:'r'},pts});moBallEv(B,{t:relT,k:'release',ent:'P'});
  ents.B.segs.push({k:'clip',clip:'b_swing',t0:tc-75,t1:2400,x:-0.86*bh,y:-0.12,yaw:Math.PI/2*bh,fade:40,bat:{tc,target:()=>cp}});moBallEv(B,{t:tc,k:'contact',ent:'B'});
  const hit=[];for(let i=0;i<=30;i++){const u=i/30;const T=1.6;const tt=u*T;hit.push({t:tc+tt*1000,x:cp[0]-6*tt,y:cp[1]+38*tt,z:cp[2]+9*tt-4.9*tt*tt});}moBallAdd(B,{k:'path',t0:tc,t1:tc+1600,pts:hit});moBallAdd(B,{k:'gone',t0:tc+1600,t1:9e9});}
 return {ents,kinds,ball:B,T:2400,subj:swing?'B':'P',focus:swing?[-0.4,0,0.95]:[0,R3C.RUBBER-0.6,0.95],ts:1};}
/* 投球の軌道（直線＋重力の小さな落ち） */function mvPitchPts(t0,t1,p1){const pts=[];const p0=[-0.45*(MV.hand==='左'?-1:1),R3C.RUBBER-1.95,1.85];for(let i=0;i<=20;i++){const u=i/20;pts.push({t:t0+(t1-t0)*u,x:p0[0]+(p1[0]-p0[0])*u,y:p0[1]+(p1[1]-p0[1])*u,z:p0[2]+(p1[2]-p0[2])*u+0.25*4*u*(1-u)});}return pts;}
/* ゴロ：遊撃手が正面で捕って一塁へ */
function mvGrounder(){const ents={},kinds={};const B=moBallNew();B.cur=-1;
 const a=-14*Math.PI/180;const dir=[Math.sin(a),Math.cos(a)];const v0=30,dec=6;/* 打球：初速30m/s、減速6m/s² */
 const posAt=s=>[dir[0]*s,dir[1]*s];const sAt=tt=>Math.min(v0*tt-0.5*dec*tt*tt,v0*v0/(2*dec));
 const start=[-10.9,38.5];/* 捕球点：遊撃手の少し前 */let tc=0,cp=null;for(let tt=0.2;tt<2.2;tt+=0.01){const p=posAt(sAt(tt));const d=Math.hypot(p[0]-start[0],p[1]-start[1]);if(d/5.5<=tt-0.35){tc=tt*1000;cp=p;break;}}
 if(!cp){tc=1500;cp=posAt(sAt(1.5));}
 const T0=300;/* 打球は t=300 に出る */const roll=[];for(let tt=0;tt<=tc/1000+0.001;tt+=0.04){const p=posAt(sAt(tt));roll.push({t:T0+tt*1000,x:p[0],y:p[1],z:0.04+0.18*Math.abs(Math.sin(tt*7))*Math.max(0,1-tt*1.2)});}
 const yawBall=moYawTo(cp[0],cp[1],0,0);/* 体はボールの来る方向（本塁側）を向く */
 const fieldAt=[cp[0]-dir[0]*0.55,cp[1]-dir[1]*0.55];/* ボールはグラブ（体の0.5m前）で捕る */
 const clipStart=T0+tc-450;/* 捕球の0.45秒前に捕球の動作へ。そこまでは減速しながら寄っていく */
 const path=moProfile([start,fieldAt],6.2,5.0,4.0,T0+80,{v1:1.6});const k0=path[path.length-1].t;for(const q of path)q.t=T0+80+(q.t-(T0+80))*((clipStart-(T0+80))/(k0-(T0+80)));
 const target=[19.4,19.4];const thrStart=clipStart+700;const thrPos=[fieldAt[0],fieldAt[1]+0.05];const yawThr=moYawTo(thrPos[0],thrPos[1],target[0],target[1]);const rel=thrStart+420;
 ents.S={ts:1,mir:1,segs:[{k:'pose',pose:'f_ready',t0:-500,t1:T0+80,x:start[0],y:start[1],yaw:moYawTo(start[0],start[1],0,0)},
  {k:'move',t0:T0+80,t1:clipStart,path,face:{mode:'pt',x:0,y:0},style:'run'},
  {k:'clip',clip:'f_gb',t0:clipStart,t1:thrStart,x:fieldAt[0],y:fieldAt[1],yaw:yawBall,fade:180},
  {k:'clip',clip:'f_throw',t0:thrStart,t1:thrStart+1400,x:thrPos[0],y:thrPos[1],yaw:yawThr,fade:160}],
  ik:[{t0:T0+tc-160,t1:T0+tc,side:'l',fade:140,target:t=>moBallPos(B,Math.min(t,T0+tc),MV.ctx)}],look:[{t0:-500,t1:rel+200,target:t=>t<rel?(MV.ballP||[0,0,0]):[19.4,19.4,1.3],w:0.75}]};kinds.S='field';
 ents.F={ts:1,mir:1,segs:[{k:'pose',pose:'f_ready',t0:-500,t1:9e9,x:19.9,y:20.3,yaw:moYawTo(19.9,20.3,thrPos[0],thrPos[1])}],ik:[],look:[{t0:-500,t1:9e9,target:()=>MV.ballP||[0,0,1],w:0.8}]};kinds.F='field';
 const flyT=Math.hypot(target[0]-thrPos[0],target[1]-thrPos[1])/31*1000;const catchP=[19.4-0.6,19.4+0.75,1.35];
 moBallAdd(B,{k:'hold',t0:-1,t1:T0,ent:'X',at:'r'});moBallAdd(B,{k:'path',t0:T0,t1:T0+tc,pts:roll});moBallAdd(B,{k:'hold',t0:T0+tc,t1:clipStart+520,ent:'S',at:'glove'});moBallEv(B,{t:T0+tc,k:'catch',ent:'S'});
 moBallAdd(B,{k:'xfer',t0:clipStart+520,t1:clipStart+620,ent:'S',from:'glove',to:'r'});moBallEv(B,{t:clipStart+520,k:'xfer',ent:'S'});
 moBallAdd(B,{k:'hold',t0:clipStart+620,t1:rel,ent:'S',at:'r'});moBallAdd(B,{k:'fly',t0:rel,t1:rel+flyT,from:{ent:'S',at:'r'},to:catchP,g:4});moBallEv(B,{t:rel,k:'release',ent:'S'});
 moBallAdd(B,{k:'hold',t0:rel+flyT,t1:9e9,ent:'F',at:'glove'});moBallEv(B,{t:rel+flyT,k:'catch',ent:'F'});
 ents.F.ik.push({t0:rel+flyT-250,t1:rel+flyT+500,side:'l',fade:200,target:t=>t<rel+flyT?moBallPos(B,t,MV.ctx):catchP});
 return {ents,kinds,ball:B,T:rel+flyT+1300,t0:0,subj:'S',focus:[fieldAt[0],fieldAt[1],0.8],ts:1};}
/* 走り：加速→巡航→減速→停止／ベースを回る／横移動と後退 */
function mvRun(kind){const ents={},kinds={};let segs,focus,face=null;
 if(kind==='line'){const path=moProfile([[0,0],[0,30]],8.2,4.2,5.5,200);segs=[{k:'pose',pose:'f_stand',t0:-500,t1:200,x:0,y:0,yaw:Math.PI},{k:'move',t0:200,t1:path[path.length-1].t,path,style:'run'},{k:'pose',pose:'f_stand',t0:path[path.length-1].t,t1:9e9,x:0,y:30,yaw:Math.PI}];focus=[0,15,0.9];}
 else if(kind==='turn'){/* 一塁の手前でふくらみ、内側の角を踏んで二塁へ */const pts=[[0,0],[11,10.6],[15.8,14.2],[18.5,16.9],[19.4,19.4],[18.9,21.4],[17.2,23.6],[9,31.5]];
  const path=moProfile(pts,7.8,4.0,5.0,200,{lat:7});segs=[{k:'pose',pose:'f_stand',t0:-500,t1:200,x:0,y:0,yaw:moYawTo(0,0,19.4,19.4)},{k:'move',t0:200,t1:path[path.length-1].t,path,style:'run'},{k:'pose',pose:'f_stand',t0:path[path.length-1].t,t1:9e9,x:9,y:31.5,yaw:moYawTo(19.4,19.4,0,38.8)}];focus=[14,22,0.9];}
 else{const c=[-10.9,38];const p=[];let t=300;const add=(x,y,dt)=>{t+=dt;p.push({t,x,y});};p.push({t,x:c[0],y:c[1]});add(c[0]-3.2,c[1],900);add(c[0]-3.2,c[1],400);add(c[0]+2.5,c[1],1100);add(c[0]+2.5,c[1],400);add(c[0]+2.5,c[1]+4,1400);
  segs=[{k:'pose',pose:'f_ready',t0:-500,t1:300,x:c[0],y:c[1],yaw:moYawTo(c[0],c[1],0,0)},{k:'move',t0:300,t1:t,path:p,face:{mode:'pt',x:0,y:0},style:'shuffle'},{k:'pose',pose:'f_ready',t0:t,t1:9e9,x:c[0]+2.5,y:c[1]+4,yaw:moYawTo(c[0]+2.5,c[1]+4,0,0)}];focus=[c[0],c[1]+1,0.8];}
 ents.R={ts:1,mir:1,segs};kinds.R=kind==='side'?'field':'runner';const T=segs[segs.length-1].t0+900;return {ents,kinds,ball:null,T,subj:'R',focus,ts:1,follow:true};}
/* ゲーム用に作られる標準の選手（R3.fielders など）は使わないので隠す */
function mvHideStock(){for(const k in (R3.fielders||{}))R3.fielders[k].g.visible=false;if(R3.batter)R3.batter.g.visible=false;for(const r of (R3.runners||[]))r.g.visible=false;for(const u of (R3.umps||[]))u.g.visible=false;if(R3.mitt)R3.mitt.visible=false;}
/* フライ：中堅手が落下点へ入り、捕って二塁へ送球 */
function mvFly(){const ents={},kinds={};const B=moBallNew();B.cur=-1;const start=[0,92];const Pc=[6,80,2.0];const Tc=2600;
 const pts=[];for(let i=0;i<=40;i++){const u=i/40;const tt=u*3.0;pts.push({t:Tc-3000+tt*1000,x:Pc[0]*u,y:Pc[1]*u,z:1+30*4*u*(1-u)*0.9+1.0*u});}
 const yawB=moYawTo(Pc[0],Pc[1],0,0);const back=moL2F(-0.12,-0.36,yawB,1);const spot=[Pc[0]+back[0],Pc[1]+back[1]];const tArr=Tc-420-300;
 const path=moProfile([start,spot],6.5,5,4.5,300,{v1:0});const k0=path[path.length-1].t;for(const q of path)q.t=300+(q.t-300)*((tArr-300)/(k0-300));
 const tT=Tc+330;const to=[0,38.8];const yawT=moYawTo(spot[0],spot[1],to[0],to[1]);const rel=tT+420;const fl=Math.hypot(to[0]-spot[0],to[1]-spot[1])/32*1000;
 ents.CF={ts:1,mir:1,segs:[{k:'pose',pose:'f_ready',t0:-500,t1:300,x:start[0],y:start[1],yaw:moYawTo(start[0],start[1],0,0)},{k:'move',t0:300,t1:tArr,path,face:{mode:'pt',x:0,y:0},style:'run'},{k:'pose',pose:'f_stand',t0:tArr,t1:Tc-420,x:spot[0],y:spot[1],yaw:yawB,fade:200},{k:'clip',clip:'f_fly',t0:Tc-420,t1:tT,x:spot[0],y:spot[1],yaw:yawB,fade:150},{k:'clip',clip:'f_othrow',t0:tT,t1:tT+1400,x:spot[0],y:spot[1],yaw:yawT,fade:160}],
  ik:[{t0:Tc-170,t1:Tc,side:'l',fade:140,target:t=>moPts(pts,Math.min(t,Tc))}],look:[{t0:-500,t1:rel+300,target:t=>t<Tc?moPts(pts,t):to.concat([1.2]),w:0.85}]};kinds.CF='field';
 moBallAdd(B,{k:'path',t0:Tc-3000,t1:Tc,pts});moBallAdd(B,{k:'hold',t0:Tc,t1:Tc+250,ent:'CF',at:'glove'});moBallEv(B,{t:Tc,k:'catch',ent:'CF'});moBallAdd(B,{k:'xfer',t0:Tc+250,t1:Tc+360,ent:'CF',from:'glove',to:'r'});moBallAdd(B,{k:'hold',t0:Tc+360,t1:rel,ent:'CF',at:'r'});
 moBallAdd(B,{k:'fly',t0:rel,t1:rel+fl,from:{ent:'CF',at:'r'},to:[to[0],to[1],1.2],g:9.8});moBallEv(B,{t:rel,k:'release',ent:'CF'});moBallAdd(B,{k:'gone',t0:rel+fl,t1:9e9});
 return {ents,kinds,ball:B,T:rel+fl+400,t0:-200,subj:'CF',focus:[spot[0],spot[1],1],ts:1};}
/* スライディング：一塁から二塁へ、足から滑り込む */
function mvSlide(){const ents={},kinds={};const lead=[19.4-3.5,19.4+3.5];const base=[0,38.8];const route=[lead,[2.0,36.8]];const tS=300+2400;const path=moProfile(route,7.6,5.2,1,300,{v0:0,v1:7});const k0=path[path.length-1].t;for(const q of path)q.t=300+(q.t-300)*((tS-300)/(k0-300));
 const sp=[2.0,36.8];const yaw=moYawTo(sp[0],sp[1],base[0],base[1]);const gp=[{t:tS,x:sp[0],y:sp[1]},{t:tS+240,x:sp[0]+(base[0]-sp[0])*0.82,y:sp[1]+(base[1]-sp[1])*0.82},{t:tS+480,x:base[0],y:base[1]}];
 ents.R={ts:1,mir:1,segs:[{k:'pose',pose:'r_lead',t0:-500,t1:300,x:lead[0],y:lead[1],yaw:moYawTo(lead[0],lead[1],0,18.4)},{k:'move',t0:300,t1:tS,path,style:'run'},{k:'glide',t0:tS,t1:tS+1000,path:gp,yaw,pose:'r_slide',fade:90},{k:'pose',pose:'f_stand',t0:tS+1100,t1:9e9,x:base[0],y:base[1],yaw:moYawTo(base[0],base[1],0,18.4),fade:400}]};kinds.R='runner';
 return {ents,kinds,ball:null,T:tS+2000,t0:0,subj:'R',focus:[1,37,0.5],ts:1,follow:true};}
/* ---- 初期化 ---- */
function mvInit(){const stage=$('#stage');const cv=document.createElement('canvas');cv.id='arcv3';stage.appendChild(cv);R3.cv=cv;
 const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;R3.renderer=r;
 r3BuildWorld();R3.on=true;r3SetNight(false,true);R3.fill=0.6;r3LayoutCrowd();r3DressCrowd(UNI_A,UNI_B);
 for(const k in R3.fielders)R3.fielders[k].g.visible=false;R3.batter.g.visible=false;for(const r2 of R3.runners)r2.g.visible=false;for(const u of R3.umps)u.g.visible=false;R3.mitt.visible=false;
 /* 足滑りを見るための格子 */MV.grid=new THREE.GridHelper(8,16,0x333333,0x666666);MV.grid.material.transparent=true;MV.grid.material.opacity=0.45;MV.grid.position.y=0.005;R3.scene.add(MV.grid);
 MV.skel=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x00e5ff,depthTest:false,transparent:true}));MV.skel.renderOrder=10;R3.scene.add(MV.skel);
 const mk=(c,r0)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r0,10,8),new THREE.MeshBasicMaterial({color:c,depthTest:false}));m.renderOrder=11;R3.scene.add(m);return m;};
 MV.pts={pr:mk(0xff4d4d,0.022),pl:mk(0x4d8dff,0.022),pk:mk(0xffd166,0.026),sw:mk(0xff9f1c,0.03)};
 MV.feet=[0,1,2,3].map(()=>{const m=new THREE.Mesh(new THREE.RingGeometry(0.05,0.075,20),new THREE.MeshBasicMaterial({color:0x2ee66b,side:THREE.DoubleSide,depthTest:false}));m.rotation.x=-Math.PI/2;m.renderOrder=11;R3.scene.add(m);return m;});
 mvResize();window.addEventListener('resize',mvResize);mvPointer();mvLoad(MV.scn);requestAnimationFrame(mvLoop);}
function mvLoad(k){MV.scn=k;mvClear();const s=MV_SCN[k].build();MV.sc=s;MV.subj=s.subj;MV.ctx={ents:s.ents,rig:key=>s.ents[key]?mvRig(key,s.kinds[key]):null,ball:s.ball,ts:s.ts};MV.t=s.t0||0;MV.evlog=[];
 for(const key in s.ents)mvRig(key,s.kinds[key]);document.querySelectorAll('[data-scn]').forEach(b=>b.classList.toggle('on',b.dataset.scn===k));const sl=$('#tsl');if(sl){sl.max=s.T;sl.min=s.t0||0;}mvCamPreset(MV.cam);}
function mvResize(){const st=$('#stage');const W=st.clientWidth,H=st.clientHeight;R3.W=W;R3.H=H;const dpr=Math.min(2,window.devicePixelRatio||1);R3.renderer.setPixelRatio(dpr);R3.renderer.setSize(W,H,false);R3.cv.style.width=W+'px';R3.cv.style.height=H+'px';R3.cam.aspect=W/H;R3.cam.updateProjectionMatrix();}
function mvPointer(){const cv=R3.cv;let last=null,pinch=null;
 cv.addEventListener('pointerdown',e=>{last={x:e.clientX,y:e.clientY,id:e.pointerId};cv.setPointerCapture(e.pointerId);});
 cv.addEventListener('pointermove',e=>{if(!last||e.pointerId!==last.id)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last.x=e.clientX;last.y=e.clientY;MV.yaw-=dx*0.006;MV.pitch=clamp(MV.pitch+dy*0.005,-0.3,1.5);});
 cv.addEventListener('pointerup',()=>{last=null;});cv.addEventListener('pointercancel',()=>{last=null;});
 cv.addEventListener('wheel',e=>{e.preventDefault();MV.dist=clamp(MV.dist*(1+e.deltaY*0.0015),0.8,80);},{passive:false});
 cv.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);last=null;}},{passive:true});
 cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);MV.dist=clamp(MV.dist*pinch/d,0.8,80);pinch=d;e.preventDefault();}},{passive:false});
 cv.addEventListener('touchend',()=>{pinch=null;});}
/* カメラ：被写体の向きを基準に 正面／側面／背面／真上 */
function mvCamPreset(k){MV.cam=k;const s=MV.sc;const ent=s.ents[s.subj];const st=ent?moEval(ent,MV.t):null;const fy=st?st.yaw:0;
 MV.yaw=k==='front'?fy:k==='back'?fy+Math.PI:k==='side'?fy+Math.PI/2:k==='side2'?fy-Math.PI/2:fy+Math.PI/2;MV.pitch=k==='top'?1.45:0.12;MV.dist=s.follow?6.5:(MV.scn==='gb'?7:4.4);document.querySelectorAll('[data-cam]').forEach(b=>b.classList.toggle('on',b.dataset.cam===k));}
function mvFocus(){const s=MV.sc;if(s.follow||MV.scn==='gb'){const r=MV.rigs[s.subj];if(r){const p=r.j.hips.getWorldPosition(new THREE.Vector3());return new THREE.Vector3(p.x,0.9,p.z);}}const f=s.focus;return new THREE.Vector3(f[0],f[2],-f[1]);}
function mvCam(){const t=mvFocus();const cp=Math.cos(MV.pitch),sp=Math.sin(MV.pitch);const pos=new THREE.Vector3(t.x+Math.sin(MV.yaw)*cp*MV.dist,t.y+sp*MV.dist,t.z+Math.cos(MV.yaw)*cp*MV.dist);if(pos.y<0.25)pos.y=0.25;R3.cam.position.copy(pos);R3.cam.lookAt(t);R3.cam.fov=40;R3.cam.updateProjectionMatrix();R3.cam.updateMatrixWorld();R3.camLook=t.clone();MV.grid.position.set(Math.round(t.x),0.005,Math.round(t.z));}
const MV_BONES=[['hips','torso'],['torso','chest'],['chest','head'],['chest','rSh'],['rSh','rEl'],['rEl','rHand'],['chest','lSh'],['lSh','lEl'],['lEl','lHand'],['hips','rHip'],['rHip','rKnee'],['rKnee','rFoot'],['hips','lHip'],['lHip','lKnee'],['lKnee','lFoot']];
function mvDraw(res){const s=MV.sc;const r=MV.rigs[s.subj];
 /* 骨格 */if(MV.skel.visible=MV.skelOn!==false&&!!r){const arr=[];const v=new THREE.Vector3();for(const [a,b] of MV_BONES){const A=r.j[a],B=r.j[b];if(!A||!B)continue;A.getWorldPosition(v);arr.push(v.x,v.y,v.z);B.getWorldPosition(v);arr.push(v.x,v.y,v.z);}MV.skel.geometry.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));MV.skel.geometry.computeBoundingSphere();}
 /* 基準点 */const on=MV.marks!==false&&!!r;for(const k in MV.pts)MV.pts[k].visible=false;if(on){const mo=moRig(r);const set=(m,o)=>{if(!o)return;o.getWorldPosition(m.position);m.visible=true;};set(MV.pts.pr,mo.palm.r);set(MV.pts.pl,mo.palm.l);if(r.glove&&r.glove.visible)set(MV.pts.pk,mo.pocket);if(r.bat&&r.bat.visible&&mo.sweet)set(MV.pts.sw,mo.sweet);}
 /* 接地点（緑＝接地中、灰＝空中） */let n=0;for(const k of [s.subj]){const st=res.st[k];if(!st||!st.feet)continue;for(const sd of ['r','l']){const f=st.feet[sd];const m=MV.feet[n++];if(!f){m.visible=false;continue;}m.visible=on;m.position.set(f.x,moGround(f.x,f.y)+0.012+(f.z||0),-f.y);m.material.color.set(f.plant?0x2ee66b:0x9aa5b5);}}for(;n<MV.feet.length;n++)MV.feet[n].visible=false;}
function mvHud(res){const s=MV.sc;const ent=s.ents[s.subj];const st=res.st[s.subj];let seg='',ph='';if(st&&st.seg){const g=st.seg;seg=g.k==='clip'?`${g.clip}（${Math.round(st.tm)}ms）`:g.k==='move'?`移動 ${(st.v||0).toFixed(1)}m/s`:`静止 ${typeof g.pose==='string'?g.pose:''}`;if(g.k==='clip'){const d=MODEF[g.clip];if(d&&d.phases){for(const p of d.phases)if(st.tm>=p[0])ph=p[1];}}}
 let bs='—';if(s.ball){const g=moBallSegAt(s.ball,MV.t);if(g)bs=g.k==='hold'?`保持（${g.ent}・${g.at==='glove'?'グラブ':g.at==='r'?'投げ手':g.at}）`:g.k==='fly'?'飛行':g.k==='xfer'?'持ち替え':g.k==='path'?'打球':g.k==='gone'?'なし':g.k;}
 for(const e of res.ev)MV.evlog.unshift(`${Math.round(e.t)}ms ${({release:'リリース',catch:'捕球',xfer:'持ち替え',contact:'接触',fs:'着地'})[e.k]||e.k}（${e.ent}）`);MV.evlog.length=Math.min(MV.evlog.length,5);
 $('#hud').innerHTML=`<b>${MV_SCN[MV.scn].label}</b>　t=${Math.round(MV.t)}ms　×${MV.speed}${MV.play?'':'　⏸'}<br>動作：${seg}${ph?'　段階：'+ph:''}<br>ボール：${bs}<br><span style="color:#ffd166">${MV.evlog.join('<br>')}</span>`;
 const sl=$('#tsl');if(sl&&document.activeElement!==sl)sl.value=MV.t;}
function mvFrame(){const s=MV.sc;const res=moFrame(MV.ctx,MV.t);MV.ballP=res.ball;if(res.ball){R3.ball.visible=true;R3.ball.position.set(res.ball[0],res.ball[2],-res.ball[1]);}else R3.ball.visible=false;
 mvDraw(res);mvCam();if(R3.camLook){R3.sun.target.position.set(R3.camLook.x,0,R3.camLook.z);R3.sun.position.set(R3.camLook.x-70,120,R3.camLook.z-30);}R3.renderer.render(R3.scene,R3.cam);mvHud(res);}
function mvLoop(now){requestAnimationFrame(mvLoop);if(typeof GL!=='undefined'&&GL.ready&&!MV.glDone){MV.glDone=true;const t=MV.t;mvLoad(MV.scn);MV.t=t;}mvHideStock();const dt=Math.min(100,now-(MV.last||now));MV.last=now;if(MV.play){MV.t+=dt*MV.speed;const s=MV.sc;if(MV.t>s.T){MV.t=s.t0||0;if(s.ball)s.ball.cur=MV.t-1;MV.evlog=[];}}try{mvFrame();}catch(e){console.error(e);$('#err').textContent=String(e&&e.stack||e);}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.scn)mvLoad(b.dataset.scn);else if(b.dataset.cam)mvCamPreset(b.dataset.cam);else if(b.dataset.spd){MV.speed=+b.dataset.spd;document.querySelectorAll('[data-spd]').forEach(x=>x.classList.toggle('on',x===b));}
 else if(b.dataset.act==='play'){MV.play=!MV.play;b.textContent=MV.play?'一時停止':'再生';}else if(b.dataset.act==='step'){MV.play=false;$('[data-act="play"]').textContent='再生';MV.t+=+b.dataset.v*1000/60;}
 else if(b.dataset.act==='hand'){MV.hand=MV.hand==='右'?'左':'右';b.textContent=MV.hand+'投げ';mvLoad(MV.scn);}else if(b.dataset.form){MV.form=b.dataset.form;document.querySelectorAll('[data-form]').forEach(x=>x.classList.toggle('on',x===b));mvLoad(MV.scn);}else if(b.dataset.act==='skel'){MV.skelOn=MV.skelOn===false;b.classList.toggle('on',MV.skelOn!==false);}else if(b.dataset.act==='marks'){MV.marks=MV.marks===false;b.classList.toggle('on',MV.marks!==false);}});
document.addEventListener('input',e=>{if(e.target.id==='tsl'){MV.play=false;const pb=$('[data-act="play"]');if(pb)pb.textContent='再生';MV.t=+e.target.value;}});
window.addEventListener('load',()=>{try{mvInit();}catch(e){console.error(e);$('#err').textContent='3D初期化に失敗: '+e;}});
