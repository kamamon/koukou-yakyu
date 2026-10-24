/* ================= 選手・球場モデルビューワー（評価用） =================
 ゲームと同じ 3D モジュール（08f/08g/08h）をそのまま使い、自由なカメラで眺める。 */
const AR={W:1,H:1,m:null,ctx:null,mode:'action',phase:'pre',side:'bat'};
const G={settings:{action:{model3d:'real'}}};
function actionSettings(){return G.settings.action;}
function arNight(){return VW.night;}
function toast(){}
const $=s=>document.querySelector(s);
function sum(a){return a.reduce((s,v)=>s+v,0);}
function arAbbr(name){const s=String(name||'').replace(/高等学校|高等学院|高校|学園|学院|工業|商業|附属|付属/g,'');return (s||name||'').slice(0,4);}
function fontCss(id){const f=UNI_FONTS.find(x=>x.id===id)||UNI_FONTS[0];return f.css;}
const VW={night:false,form:'over',hand:'右',bhand:'右',anim:'idle',t0:0,target:new THREE.Vector3(0,1,-18.4),dist:5,yaw:0.6,pitch:0.28,fps:0,uni:0,gear:true};
const UNIS=[
 {name:'青葉（紺・前立て）',c:{base:'#f3f2ee',trim:'#0b2a4a',cap:'#0b2a4a',capBrim:'#0b2a4a',pants:'#f3f2ee',style:'placket',text:'青葉',textFont:'graduate',textColor:'#0b2a4a',textOutline:'#ffffff',numFont:'oswald',numColor:'#0b2a4a',numOutline:'#ffffff',mark:'青'}},
 {name:'赤・袖ライン',c:{base:'#f6f1e8',trim:'#b3202a',cap:'#b3202a',capBrim:'#1b1b1b',pants:'#f6f1e8',style:'sleeve',text:'KOSHIEN',textFont:'oswald',textColor:'#b3202a',textOutline:'#ffffff',numFont:'oswald',numColor:'#b3202a',numOutline:'#ffffff',mark:'K'}},
 {name:'縦じま',c:{base:'#f4f4f4',trim:'#1e3a5f',cap:'#1e3a5f',capBrim:'#1e3a5f',pants:'#f4f4f4',style:'pin',text:'横浜',textFont:'dela',textColor:'#1e3a5f',textOutline:'#ffffff',numFont:'oswald',numColor:'#1e3a5f',numOutline:'#ffffff',mark:'横'}},
 {name:'緑・ラグラン',c:{base:'#eef3ee',trim:'#14532d',cap:'#14532d',capBrim:'#14532d',pants:'#d9d9d9',style:'raglan',text:'大阪',textFont:'noto',textColor:'#14532d',textOutline:'#ffffff',numFont:'oswald',numColor:'#14532d',numOutline:'#ffffff',mark:'大'}},
 {name:'黒・胸バンド',c:{base:'#2b2f36',trim:'#e0b347',cap:'#1b1b1b',capBrim:'#1b1b1b',pants:'#d9d9d9',style:'band',text:'東都',textFont:'zen',textColor:'#1b1b1b',textOutline:'#e0b347',numFont:'oswald',numColor:'#e0b347',numOutline:'#1b1b1b',mark:'東'}},
];
const UNI_B={base:'#f4f4f4',trim:'#9b1c1c',cap:'#9b1c1c',capBrim:'#9b1c1c',pants:'#f4f4f4',style:'sleeve',text:'相模',textFont:'reggae',textColor:'#9b1c1c',textOutline:'#ffffff',numFont:'oswald',numColor:'#9b1c1c',numOutline:'#ffffff',mark:'相'};
const DEF={投:[0,18.4],捕:[0,-2.2],一:[19,21.9],二:[10.9,40.6],三:[-19,21.9],遊:[-10.9,40.6],左:[-38.6,75.7],中:[0,95],右:[38.6,75.7]};
function vwInit(){const stage=$('#stage');const cv=document.createElement('canvas');cv.id='arcv3';stage.appendChild(cv);R3.cv=cv;
 const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;R3.renderer=r;
 r3BuildWorld();R3.on=true;r3SetNight(false,true);R3.fill=0.97;r3LayoutCrowd();r3DressCrowd(UNIS[0].c,UNI_B);
 /* デモ用のスコアボード */const mk=(names,ps)=>({name:names,lineup:ps.map((n,i)=>({pos:['中','遊','右','一','三','左','捕','二','投'][i],p:{name:n}})),stats:{a:{h:7}}});
 const A=mk('青葉高校',['佐々木 翔','山田 蓮','田中 陽斗','高橋 大和','中村 悠真','小林 湊','加藤 颯','吉田 結翔','松本 蒼']),B=mk('相模学院',['斎藤 樹','井上 陸','木村 朝陽','林 大翔','清水 碧','森 遥斗','池田 新','橋本 律','阿部 凪']);
 AR.m={A,B,inn:7,top:false,score:[3,2],line:[[0,1,0,2,0,0,0],[1,0,0,0,1,0]],outs:1,pa:{balls:2,strikes:1,b:B.lineup[3].p,p:A.lineup[8].p},bat:()=>B,def:()=>A,opt:{}};B.batIdx=3;A.batIdx=0;try{r3UpdateBoard();}catch(e){console.warn(e);}
 vwResize();window.addEventListener('resize',vwResize);vwPointer();vwPreset('pitcher');vwLoop(performance.now());}
function vwResize(){const st=$('#stage');const W=st.clientWidth,H=st.clientHeight;R3.W=W;R3.H=H;const dpr=Math.min(2,window.devicePixelRatio||1);R3.renderer.setPixelRatio(dpr);R3.renderer.setSize(W,H,false);R3.cv.style.width=W+'px';R3.cv.style.height=H+'px';R3.cam.aspect=W/H;R3.cam.updateProjectionMatrix();}
function vwPointer(){const cv=R3.cv;let last=null,pinch=null;
 cv.addEventListener('pointerdown',e=>{last={x:e.clientX,y:e.clientY,id:e.pointerId};cv.setPointerCapture(e.pointerId);});
 cv.addEventListener('pointermove',e=>{if(!last||e.pointerId!==last.id)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;last.x=e.clientX;last.y=e.clientY;VW.yaw-=dx*0.006;VW.pitch=clamp(VW.pitch+dy*0.005,-0.2,1.4);});
 cv.addEventListener('pointerup',()=>{last=null;});cv.addEventListener('pointercancel',()=>{last=null;});
 cv.addEventListener('wheel',e=>{e.preventDefault();VW.dist=clamp(VW.dist*(1+e.deltaY*0.0015),0.8,160);},{passive:false});
 cv.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);last=null;}},{passive:true});
 cv.addEventListener('touchmove',e=>{if(e.touches.length===2&&pinch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);VW.dist=clamp(VW.dist*pinch/d,0.8,160);pinch=d;e.preventDefault();}},{passive:false});
 cv.addEventListener('touchend',()=>{pinch=null;});}
const PRESETS={
 pitcher:{t:[0,1.0,-17.6],d:4.2,yaw:0.5,pitch:0.15,anim:'pitch',label:'投手'},
 pitcherFace:{t:[-0.1,1.5,-17.8],d:1.5,yaw:0.45,pitch:0.02,anim:'face',label:'投手（顔）'},
 batter:{t:[-0.5,1.0,0.1],d:3.6,yaw:-2.2,pitch:0.12,anim:'swing',label:'打者'},
 catcher:{t:[0,0.7,1.6],d:3.4,yaw:2.5,pitch:0.2,anim:'idle',label:'捕手・審判'},
 fielder:{t:[19,0.9,-21.9],d:4,yaw:0.4,pitch:0.15,anim:'idle',label:'野手'},
 batCam:{t:[0,0.9,-7],d:9,yaw:0,pitch:0.07,anim:'pitch',label:'打席視点'},
 cfCam:{t:[0,1.2,-10],d:20,yaw:Math.PI,pitch:0.16,anim:'pitch',label:'センターカメラ'},
 wide:{t:[0,3,-50],d:150,yaw:0.0,pitch:0.42,anim:'idle',label:'球場全景'},
 roof:{t:[0,12,-5],d:60,yaw:Math.PI,pitch:0.1,anim:'idle',label:'銀傘・内野席'},
 alps:{t:[45,10,-40],d:60,yaw:-0.6,pitch:0.2,anim:'idle',label:'アルプス'},
 board:{t:[0,14,-120],d:60,yaw:0,pitch:0.05,anim:'idle',label:'スコアボード'},
};
function vwPreset(k){const p=PRESETS[k];if(!p)return;VW.target.set(p.t[0],p.t[1],p.t[2]);VW.dist=p.d;VW.yaw=p.yaw;VW.pitch=p.pitch;VW.anim=p.anim;VW.t0=performance.now();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('on',b.dataset.preset===k));document.querySelectorAll('[data-anim]').forEach(b=>b.classList.toggle('on',b.dataset.anim===VW.anim));}
function vwCam(){const t=VW.target;const cp=Math.cos(VW.pitch),sp=Math.sin(VW.pitch);const pos=new THREE.Vector3(t.x+Math.sin(VW.yaw)*cp*VW.dist,t.y+sp*VW.dist,t.z+Math.cos(VW.yaw)*cp*VW.dist);if(pos.y<0.3)pos.y=0.3;R3.cam.position.copy(pos);R3.cam.lookAt(t);R3.cam.fov=VW.dist>40?50:42;R3.cam.updateProjectionMatrix();R3.cam.updateMatrixWorld();R3.camLook=t.clone();}
function vwScene(now){const uni=UNIS[VW.uni].c;const hs=VW.hand==='左'?-1:1;const sg=VW.bhand==='左'?-1:1;const u=((now-VW.t0)/1000);
 for(const k in R3.fielders){const r=R3.fielders[k];r.setColors(uni,false);r.setNumber(POS_NUM[k],uni.trim);r.setGear(k==='捕'&&VW.gear?'catcher':null);r.glove.visible=k!=='捕';const p=DEF[k];r.g.visible=true;r.g.scale.x=1;r.bat.visible=false;
  if(k==='投'){r.at(0,0,-R3C.RUBBER+0.15);r.g.scale.x=hs;r.face(0,1);r.apply(vwPitchPose(u));continue;}
  if(k==='捕'){r.at(0,0,1.6);r.face(0,-1);const cp=Object.assign({},RP.crouch);cp.dy=RP.crouch.dy+Math.sin(now/900)*0.02;r.apply(cp);r.glove.visible=false;continue;}
  r.at(p[0],0,-p[1]);r.face(-p[0],p[1]);const rp=Object.assign({},RP.ready);rp.dy=RP.ready.dy+Math.sin(now/700+k.charCodeAt(0))*0.02;r.apply(rp);}
 const b=R3.batter;b.g.visible=true;b.setColors(UNI_B,true);b.setNumber(7,UNI_B.trim);b.bat.visible=true;b.g.scale.x=sg<0?-1:1;b.at(-sg*0.86,0,0.1);b.face(sg,0);b.apply(vwBatPose(u,now));
 for(const r of R3.runners)r.g.visible=false;
 const U=[[0.3,-2.4],[25.5,16.5],[-25.5,16.5]];U.forEach((q,i)=>{const r=R3.umps[i];r.g.visible=true;r.at(q[0],0,-q[1]);if(i===0){r.face(0,-1);r.apply(RP.umpire);}else{r.face(-q[0],q[1]-18.4);r.apply(RP.ready);}});
 /* ミットとボール */const mittT=r3ZoneW(0,0.2);mittT.z=0.3;R3.mitt.visible=true;R3.mitt.position.copy(mittT);
 const pit=R3.fielders['投'];const ph=vwPitchPhase(u);if(VW.anim==='pitch'&&ph.u<1){pit.g.updateMatrixWorld(true);R3.ball.position.copy(pit.handPos('r'));R3.ball.visible=true;}
 else if(VW.anim==='pitch'&&ph.u>=1&&ph.fu<1.6){const P={name:'ストレート',v:140,x:0,y:0.2,hs,form:VW.form,T:1000,n:1};const q=phSample(phOf(P).pts,Math.min(1,(ph.fu-1)/0.6)*phOf(P).T);R3.ball.position.copy(r3V(q.x,q.y,q.z));R3.ball.visible=true;}
 else R3.ball.visible=false;}
/* 投球アニメ：1.3秒で振りかぶり→0.5秒フォロー→1.2秒待ち のループ */
function vwPitchPhase(u){const L=3.2;const t=((u%L)+L)%L;const wind=1.3;if(t<wind)return {u:t/wind,fu:0};return {u:1,fu:1+(t-wind)/0.5};}
function vwPitchPose(u){if(VW.anim==='face'){const p=Object.assign({},RP.stand);p.head=[0.0,0.25*Math.sin(u*1.3),0];return p;}if(VW.anim!=='pitch'){const w=Math.sin(u*5.7);const base=RP.pset;const p=Object.assign({},base);p.dy=w*0.012;p.head=[0.05+w*0.04,0,0];return p;}
 const ph=vwPitchPhase(u);if(ph.u<1)return r3ClipPose('windup_'+VW.form,ph.u);const fu=ph.fu-1;return fu<1?r3ClipPose('pfollow_'+VW.form,fu):RP.pland;}
function vwBatPose(u,now){if(VW.anim!=='swing'){const w=Math.sin(now/420),w2=Math.sin(now/650);const p=Object.assign({},RP.stance);p.batDir=[-0.55+w*0.08,0.8,-0.3+w*0.12];p.dy=RP.stance.dy+w2*0.015;p.head=[0.05+w2*0.03,1.0,0];return p;}
 const L=2.6;const t=((u%L)+L)%L;if(t<1.4){const w=Math.sin(now/420);const p=Object.assign({},RP.stance);p.batDir=[-0.55+w*0.08,0.8,-0.3+w*0.12];return p;}const k=(t-1.4)/0.9;return k<1?r3ClipPose('swing',k):RP.follow;}
let VW_last=0,VW_frames=0,VW_fpsT=0;
function vwRender(now){vwScene(now);vwCam();if(R3.camLook){R3.sun.target.position.set(R3.camLook.x,0,R3.camLook.z);R3.sun.position.set(R3.camLook.x+(R3.night?40:-70),120,R3.camLook.z+(R3.night?-70:-30));}R3.renderer.render(R3.scene,R3.cam);}
function vwLoop(now){requestAnimationFrame(vwLoop);if(VW.paused)return;try{vwRender(now);
 VW_frames++;if(now-VW_fpsT>1000){VW.fps=VW_frames;VW_frames=0;VW_fpsT=now;const el=$('#fps');if(el)el.textContent=VW.fps+' fps';}}catch(e){console.error(e);const el=$('#err');if(el)el.textContent=String(e);}}
function vwSet(k,v){if(k==='night'){VW.night=v;r3SetNight(v);}else if(k==='model'){G.settings.action.model3d=v;r3RebuildRigs();}else if(k==='uni'){VW.uni=+v;r3DressCrowd(UNIS[VW.uni].c,UNI_B);}else VW[k]=v;document.querySelectorAll(`[data-set="${k}"]`).forEach(b=>b.classList.toggle('on',String(b.dataset.v)===String(v)));}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.preset)vwPreset(b.dataset.preset);else if(b.dataset.anim){VW.anim=b.dataset.anim;VW.t0=performance.now();document.querySelectorAll('[data-anim]').forEach(x=>x.classList.toggle('on',x===b));}else if(b.dataset.set){let v=b.dataset.v;if(v==='1')v=true;else if(v==='0')v=false;vwSet(b.dataset.set,v);}});
window.addEventListener('load',()=>{try{vwInit();}catch(e){console.error(e);$('#err').textContent='3D初期化に失敗: '+e;}});
