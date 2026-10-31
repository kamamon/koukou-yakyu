/* ================= 3D描画（three.js）：スタジアム・選手・ボール・カメラ =================
 座標系：フィールド座標 (X=一塁側+, Y=センター方向+, Z=高さ) → three.js (x=X, y=Z, z=-Y)。本塁の後端が原点。
 2Dキャンバス（#arcv）はHUD専用になり、ゾーン・カーソル・吹き出しだけを投影して描く。 */
const R3={on:false,broken:false,renderer:null,scene:null,cam:null,cv:null,W:1,H:1,night:null,lastPhase:null,camPos:null,camLook:null,camFov:40,
 fielders:{},batter:null,runners:[],umps:[],ball:null,glow:null,trailM:[],trailP:[],mitt:null,board:null,boardCv:null,boardTex:null,crowd:null,lamps:[],relPos:null,relAt:0,hit:null,fx:[],t0:0,fill:0.6,sky:null,skyTex:null,fog:null,stands:[],walls:[],sunT:null};
const R3C={ZX:0.25,ZH0:0.8,ZH:0.3,PLATE_Z:-0.2,RUBBER:18.44,REL_H:1.45,FOV_BAT:50,FOV_PIT:20};
const R3K={HIPS:0.48,DY:0.48/0.92};
const R3_UMP={base:'#2b3340',trim:'#2b3340',cap:'#1b1f26',capBrim:'#1b1f26',pants:'#4a515c',style:'plain',text:'',mark:''};
function r3on(){return R3.on&&!!R3.renderer;}
function r3Supported(){try{if(typeof THREE==='undefined')return false;if(R3.broken)return false;const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'));}catch(e){return false;}}
function r3V(X,Y,Z){return new THREE.Vector3(X,Z||0,-Y);}
function r3ZoneW(x,y){return new THREE.Vector3(x*R3C.ZX,R3C.ZH0-y*R3C.ZH,R3C.PLATE_Z);}
/* ---- 開始／終了 ---- */
function r3Start(stage){if(!r3Supported())return false;
 try{if(!R3.renderer){const cv=document.createElement('canvas');cv.id='arcv3';R3.cv=cv;
   const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;R3.renderer=r;
   cv.addEventListener('webglcontextlost',e=>{e.preventDefault();r3Fail();});
   r3BuildWorld();}
 }catch(e){console.warn('3D init failed',e);R3.broken=true;return false;}
 stage.insertBefore(R3.cv,stage.firstChild);stage.classList.add('three');R3.on=true;R3.lastPhase=null;R3.camPos=null;R3.relPos=null;R3.hit=null;R3.trailP.length=0;
 R3.fill=clamp(0.18+((AR.ctx&&AR.ctx.importance)||(AR.m&&AR.m.opt&&AR.m.opt.importance)||1)*0.32,0.15,0.98);r3LayoutCrowd();try{if(AR.m)r3DressCrowd(arTeamColors(AR.m.A),arTeamColors(AR.m.B));}catch(e){}
 r3Resize(AR.W,AR.H);r3SetNight(arNight(),true);r3UpdateBoard();return true;}
function r3Stop(){if(R3.cv&&R3.cv.parentNode)R3.cv.parentNode.removeChild(R3.cv);const st=$('#arstage');if(st)st.classList.remove('three');R3.on=false;}
function r3Fail(){r3Stop();R3.broken=true;try{toast('3D表示を停止しました（2D表示に切り替え）');}catch(e){}}
function r3Resize(W,H){if(!R3.renderer)return;W=Math.max(1,W);H=Math.max(1,H);const dpr=Math.min(1.5,window.devicePixelRatio||1);if(R3.W===W&&R3.H===H&&R3.dpr===dpr&&R3.cv.parentNode)return;R3.W=W;R3.H=H;R3.dpr=dpr;R3.renderer.setPixelRatio(dpr);R3.renderer.setSize(W,H,false);R3.cv.style.width=W+'px';R3.cv.style.height=H+'px';R3.cam.aspect=W/H;R3.cam.updateProjectionMatrix();try{if(R3.on&&AR.m)R3.renderer.render(R3.scene,R3.cam);}catch(e){}}
/* ---- 材質・形状のキャッシュ ---- */
const R3_MATS={},R3_GEOS={};
function r3Mat(c,opt){const k=String(c)+(opt?JSON.stringify(opt):'');if(!R3_MATS[k]){const o=Object.assign({color:new THREE.Color(c)},opt||{});R3_MATS[k]=new THREE.MeshLambertMaterial(o);}return R3_MATS[k];}
function r3Geo(k,mk){if(!R3_GEOS[k])R3_GEOS[k]=mk();return R3_GEOS[k];}
function r3Cyl(r1,r2,len){return r3Geo(`cyl${r1}_${r2}_${len}`,()=>{const g=new THREE.CylinderGeometry(r1,r2,len,10);g.translate(0,-len/2,0);return g;});}
function r3Box(w,h,d,oy){return r3Geo(`box${w}_${h}_${d}_${oy||0}`,()=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(0,oy||0,0);return g;});}
function r3Sph(r){return r3Geo(`sph${r}`,()=>new THREE.SphereGeometry(r,12,10));}
/* ---- 人型リグ ---- */
class R3Rig{
 constructor(){this.g=new THREE.Group();this.j={};this.col=null;this.pose=null;this.clip=null;this.helmet=false;this.build();}
 build(){const G=this.g,j=this.j;const grp=(p,x,y,z)=>{const o=new THREE.Group();o.position.set(x,y,z);p.add(o);return o;};const mesh=(p,geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;p.add(m);return m;};
  /* パワプロ風の2頭身：大きな丸い頭、短い手足、丸い手 */
  j.hips=grp(G,0,R3K.HIPS,0);this.pelvis=mesh(j.hips,r3Geo('pelvis',()=>{const g=new THREE.SphereGeometry(0.2,12,10);g.scale(1.25,0.6,1);return g;}),r3Mat('#f4f4f4'));this.pelvis.position.y=0.02;
  j.torso=grp(j.hips,0,0.0,0);this.torsoM=mesh(j.torso,r3Geo('torso',()=>{const g=new THREE.SphereGeometry(0.3,16,12);g.scale(1.05,0.9,0.8);g.translate(0,0.26,0);return g;}),r3Mat('#ffffff'));
  this.trimM=mesh(j.torso,r3Geo('trim',()=>{const g=new THREE.TorusGeometry(0.21,0.035,8,20);g.rotateX(Math.PI/2);g.translate(0,0.46,0);return g;}),r3Mat('#333'));
  this.beltM=mesh(j.torso,r3Geo('belt',()=>{const g=new THREE.CylinderGeometry(0.29,0.3,0.06,16);g.translate(0,0.04,0);return g;}),r3Mat('#222'));
  j.head=grp(j.torso,0,0.5,0);this.headM=mesh(j.head,r3Geo('head',()=>new THREE.SphereGeometry(0.36,20,16)),r3Mat('#f0c6a0'));this.headM.position.y=0.34;
  for(const sg of [-1,1]){const e=mesh(j.head,r3Geo('eye',()=>{const g=new THREE.SphereGeometry(0.045,8,8);g.scale(0.8,1.35,0.5);return g;}),r3Mat('#1b1b1b'));e.position.set(sg*0.13,0.27,0.335);e.castShadow=false;}
  {const mo=mesh(j.head,r3Geo('mouth',()=>{const g=new THREE.TorusGeometry(0.04,0.012,6,10,Math.PI);g.rotateZ(Math.PI);return g;}),r3Mat('#8b4a3a'));mo.position.set(0,0.16,0.345);mo.castShadow=false;}
  this.capM=mesh(j.head,r3Geo('cap',()=>new THREE.SphereGeometry(0.375,20,12,0,Math.PI*2,0,Math.PI*0.5)),r3Mat('#333'));this.capM.position.y=0.36;
  this.brimM=mesh(j.head,r3Geo('brim',()=>{const g=new THREE.CylinderGeometry(0.33,0.33,0.03,20,1,false,-Math.PI*0.42,Math.PI*0.84);g.scale(1,1,1.25);return g;}),r3Mat('#333'));this.brimM.position.set(0,0.39,0.1);
  this.helmetM=mesh(j.head,r3Geo('helm',()=>new THREE.SphereGeometry(0.39,20,12,0,Math.PI*2,0,Math.PI*0.56)),r3Mat('#333'));this.helmetM.position.y=0.36;this.helmetM.visible=false;
  this.flapM=mesh(j.head,r3Geo('flap',()=>{const g=new THREE.SphereGeometry(0.13,10,8);g.scale(0.5,1,1);return g;}),r3Mat('#333'));this.flapM.position.set(0.36,0.3,0.05);this.flapM.visible=false;
  for(const s of ['r','l']){const sg=s==='r'?-1:1;
   j[s+'Sh']=grp(j.torso,sg*0.3,0.4,0);this[s+'UpM']=mesh(j[s+'Sh'],r3Geo('uparm',()=>{const g=new THREE.CapsuleGeometry(0.07,0.2,4,10);g.translate(0,-0.12,0);return g;}),r3Mat('#ffffff'));
   j[s+'El']=grp(j[s+'Sh'],0,-0.24,0);this[s+'LoM']=mesh(j[s+'El'],r3Geo('loarm',()=>{const g=new THREE.CapsuleGeometry(0.06,0.17,4,10);g.translate(0,-0.1,0);return g;}),r3Mat('#f0c6a0'));
   j[s+'Hand']=grp(j[s+'El'],0,-0.22,0);this[s+'HandM']=mesh(j[s+'Hand'],r3Geo('hand',()=>new THREE.SphereGeometry(0.095,12,10)),r3Mat('#f0c6a0'));
   j[s+'Hip']=grp(j.hips,sg*0.12,-0.02,0);this[s+'ThM']=mesh(j[s+'Hip'],r3Geo('thigh',()=>{const g=new THREE.CapsuleGeometry(0.095,0.18,4,10);g.translate(0,-0.12,0);return g;}),r3Mat('#f4f4f4'));
   j[s+'Knee']=grp(j[s+'Hip'],0,-0.24,0);this[s+'ShM']=mesh(j[s+'Knee'],r3Geo('shin',()=>{const g=new THREE.CapsuleGeometry(0.08,0.16,4,10);g.translate(0,-0.1,0);return g;}),r3Mat('#f4f4f4'));
   this[s+'FootM']=mesh(j[s+'Knee'],r3Geo('shoe',()=>{const g=new THREE.SphereGeometry(0.11,12,10);g.scale(1,0.6,1.5);return g;}),r3Mat('#222'));this[s+'FootM'].position.set(0,-0.22,0.06);}
  this.glove=mesh(j.lHand,r3Geo('glove',()=>{const g=new THREE.SphereGeometry(0.15,12,10);g.scale(1,1.1,0.6);return g;}),r3Mat('#8b5e34'));this.glove.visible=false;
  this.bat=new THREE.Group();G.add(this.bat);mesh(this.bat,r3Geo('bat',()=>{const g=new THREE.CylinderGeometry(0.04,0.018,0.82,10);g.translate(0,0.31,0);return g;}),r3Mat('#d2a670'));const knob=mesh(this.bat,r3Geo('knob',()=>new THREE.CylinderGeometry(0.035,0.035,0.02,8)),r3Mat('#222'));knob.position.y=-0.1;this.bat.visible=false;
  this.numCv=document.createElement('canvas');this.numCv.width=this.numCv.height=96;this.numTex=new THREE.CanvasTexture(this.numCv);this.numTex.colorSpace=THREE.SRGBColorSpace;this.numM=new THREE.Mesh(r3Geo('numpl',()=>new THREE.PlaneGeometry(0.3,0.3)),new THREE.MeshBasicMaterial({map:this.numTex,transparent:true,depthWrite:false,toneMapped:false}));this.numM.position.set(0,0.3,-0.235);this.numM.rotation.y=Math.PI;this.numM.castShadow=false;j.torso.add(this.numM);this.numVal=null;this.numCol=null;}
 setNumber(n,col){if(n==null){this.numM.visible=false;return;}this.numM.visible=true;if(this.numVal===n&&this.numCol===col)return;this.numVal=n;this.numCol=col;const g=this.numCv.getContext('2d');g.clearRect(0,0,96,96);g.font='700 68px Oswald,Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle='rgba(255,255,255,.85)';g.strokeText(String(n),48,52);g.fillStyle=col||'#222';g.fillText(String(n),48,52);this.numTex.needsUpdate=true;}
 setColors(c,helmet){this.col=c;const jer=r3Mat(c.base),trim=r3Mat(c.trim),cap=r3Mat(c.cap),pants=r3Mat(c.pants||'#f4f4f4');
  this.torsoM.material=jer;this.trimM.material=trim;this.capM.material=cap;this.brimM.material=cap;this.helmetM.material=cap;this.flapM.material=cap;this.rUpM.material=jer;this.lUpM.material=jer;this.pelvis.material=pants;this.rThM.material=pants;this.lThM.material=pants;this.rShM.material=pants;this.lShM.material=pants;
  this.setHelmet(helmet);}
 setHelmet(on){this.helmet=!!on;this.helmetM.visible=!!on;this.flapM.visible=!!on;this.capM.visible=!on;this.brimM.visible=!on;}
 apply(p){const j=this.j;for(const k in j)j[k].rotation.set(0,0,0);j.hips.position.y=R3K.HIPS+(p.dy||0)*R3K.DY;j.hips.position.z=(p.dz||0)*R3K.DY;
  for(const k in p){const jo=j[k];if(jo){const r=p[k];jo.rotation.set(r[0]||0,r[1]||0,r[2]||0);}}
  if(this.bat.visible){/* バットは右手の位置に、リグ座標の向き batDir で置く */this.g.updateMatrixWorld(true);const hp=new THREE.Vector3();j.rHand.getWorldPosition(hp);this.g.worldToLocal(hp);this.bat.position.copy(hp);const d=p.batDir||[0,1,0];const v=new THREE.Vector3(d[0],d[1],d[2]).normalize();this.bat.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v);}
  this.pose=p;}
 face(dx,dz){this.g.rotation.y=Math.atan2(dx,dz);}
 at(x,y,z){this.g.position.set(x,y,z);}
 handPos(side){const v=new THREE.Vector3();this.j[(side||'r')+'Hand'].getWorldPosition(v);return v;}
}
/* ---- ポーズとクリップ ---- */
const RP={
 stand:{rSh:[0.05,0,-0.1],lSh:[0.05,0,0.1],rEl:[-0.25,0,0],lEl:[-0.25,0,0]},
 set:{rSh:[-0.9,0,-0.25],lSh:[-0.95,0,0.3],rEl:[-1.5,0,0],lEl:[-1.4,0,0],head:[0.05,0,0]},
 ready:{dy:-0.17,torso:[0.45,0,0],rHip:[-0.7,0,-0.12],lHip:[-0.7,0,0.12],rKnee:[1.05,0,0],lKnee:[1.05,0,0],rSh:[-0.55,0,-0.35],lSh:[-0.55,0,0.35],rEl:[-0.95,0,0],lEl:[-0.95,0,0],head:[-0.3,0,0]},
 crouch:{dy:-0.6,torso:[0.32,0,0],rHip:[-1.55,0,-0.45],lHip:[-1.55,0,0.45],rKnee:[2.3,0,0],lKnee:[2.3,0,0],lSh:[-1.45,0,0.25],lEl:[-0.35,0,0],rSh:[0.35,0,-0.5],rEl:[-1.3,0,0],head:[-0.25,0,0]},
 umpire:{dy:-0.3,torso:[0.55,0,0],rHip:[-0.9,0,-0.25],lHip:[-0.9,0,0.25],rKnee:[1.3,0,0],lKnee:[1.3,0,0],rSh:[-0.4,0,-0.5],lSh:[-0.4,0,0.5],rEl:[-1.1,0,0],lEl:[-1.1,0,0],head:[-0.35,0,0]},
 catchHigh:{torso:[-0.1,0,0],lSh:[-2.7,0,0.25],lEl:[-0.3,0,0],rSh:[-2.3,0,-0.3],rEl:[-0.45,0,0],head:[-0.55,0,0]},
 catchLow:{dy:-0.3,torso:[0.7,0,0],rHip:[-0.95,0,-0.1],lHip:[-0.95,0,0.1],rKnee:[1.45,0,0],lKnee:[1.45,0,0],lSh:[-0.75,0,0.35],lEl:[-0.1,0,0],rSh:[-0.2,0,-0.4],rEl:[-0.6,0,0],head:[-0.1,0,0]},
 lookUp:{head:[-0.75,0,0],torso:[-0.15,0,0],lSh:[-0.45,0,0.3],lEl:[-0.3,0,0],rSh:[0.1,0,-0.2]},
 throwWind:{torso:[-0.1,-0.55,0],rSh:[2.2,0,-0.95],rEl:[-1.7,0,0],lSh:[-1.3,0,0.3],lEl:[-0.45,0,0],rHip:[0.25,0,0],lHip:[-0.55,0,0],lKnee:[0.6,0,0]},
 throwRel:{torso:[0.5,0.45,0],rSh:[-2.2,0,-0.35],rEl:[-0.3,0,0],lSh:[0.45,0,0.5],lEl:[-1.4,0,0],lHip:[-0.75,0,0],lKnee:[0.6,0,0],rHip:[0.4,0,0]},
 throwEnd:{torso:[0.75,0.7,0],rSh:[-0.6,0,0.6],rEl:[-0.4,0,0],lSh:[0.6,0,0.4],lEl:[-1.2,0,0],lHip:[-0.5,0,0],lKnee:[0.4,0,0],rHip:[-0.9,0,0],rKnee:[0.8,0,0]},
 slide:{dy:-0.7,hips:[-1.3,0,0],rHip:[-0.25,0,-0.25],lHip:[-1.25,0,0.25],lKnee:[1.6,0,0],rKnee:[0.15,0,0],rSh:[-2.5,0,-0.45],lSh:[-2.3,0,0.45],torso:[-0.25,0,0],head:[0.55,0,0]},
 celebrate:{rSh:[-2.9,0,-0.35],lSh:[-2.9,0,0.35],rEl:[-0.35,0,0],lEl:[-0.35,0,0],head:[-0.3,0,0]},
 kDown:{dy:-0.05,head:[0.55,0.5,0],torso:[0.3,0.25,0],rSh:[0.25,0,-0.35],rEl:[-0.4,0,0],lSh:[0.2,0,0.3],lEl:[-0.3,0,0],batDir:[0.15,-0.95,0.25]},
 outCall:{torso:[0.15,-0.35,0],rSh:[-2.0,0,-1.1],rEl:[-1.5,0,0],lSh:[-0.3,0,0.3],lEl:[-0.8,0,0],head:[-0.1,-0.3,0]},
 safeCall:{torso:[0.3,0,0],rSh:[-1.55,0,-1.45],lSh:[-1.55,0,1.45],rEl:[-0.1,0,0],lEl:[-0.1,0,0],head:[-0.1,0,0]},
 /* 打者（右打ち基準。左打ちはミラー）。リグ座標：+z=本塁（体の正面）、+x=投手方向（体の左）。左手はリアル体型ではIKでグリップへ */
 stance:{dy:-0.1,torso:[0.2,-0.15,0],head:[0.05,1.1,0],rHip:[-0.3,0,-0.2],lHip:[-0.3,0,0.25],rKnee:[0.5,0,0],lKnee:[0.5,0,0],rSh:[0.3,0,-0.9],rEl:[-2.15,0,0],lSh:[-1.1,0,-0.8],lEl:[-1.3,0,0],batDir:[-0.55,0.8,-0.3]},
 load:{dy:-0.12,torso:[0.22,-0.4,0],head:[0.05,1.3,0],rHip:[-0.25,0,-0.2],lHip:[-0.55,0,0.1],lKnee:[0.9,0,0],rKnee:[0.45,0,0],rSh:[0.55,0,-1.0],rEl:[-2.3,0,0],lSh:[-1.0,0,-0.85],lEl:[-1.3,0,0],batDir:[-0.45,0.85,-0.35]},
 stride:{dy:-0.14,torso:[0.22,-0.3,0],head:[0.05,1.2,0],rHip:[-0.2,0,-0.2],lHip:[-0.45,0,0.45],lKnee:[0.35,0,0],rKnee:[0.5,0,0],rSh:[0.55,0,-1.05],rEl:[-2.3,0,0],lSh:[-1.0,0,-0.8],lEl:[-1.3,0,0],batDir:[-0.4,0.88,-0.3]},
 launch:{dy:-0.16,torso:[0.25,0.15,0],head:[0.05,0.85,0],rHip:[0.05,0,-0.3],rKnee:[0.8,0,0],lHip:[-0.4,0,0.4],lKnee:[0.25,0,0],rSh:[-0.3,0,-1.2],rEl:[-1.9,0,0],lSh:[-1.2,0,-0.4],lEl:[-1.0,0,0],batDir:[-0.75,0.55,-0.35]},
 contact:{dy:-0.14,torso:[0.2,0.75,0],head:[0.05,0.3,0],rHip:[0.25,0,-0.3],lHip:[-0.45,0,0.3],lKnee:[0.25,0,0],rKnee:[0.95,0,0],rSh:[-1.3,0,-0.25],rEl:[-0.5,0,0],lSh:[-1.4,0,0.15],lEl:[-0.35,0,0],batDir:[0.35,0.05,1]},
 ext:{dy:-0.14,torso:[0.2,1.05,0],head:[0.05,0.1,0],rHip:[0.3,0,-0.35],lHip:[-0.4,0,0.3],lKnee:[0.2,0,0],rKnee:[1.05,0,0],rSh:[-1.5,0,0.2],rEl:[-0.3,0,0],lSh:[-1.45,0,0.5],lEl:[-0.4,0,0],batDir:[0.8,0.25,0.55]},
 follow:{dy:-0.14,torso:[0.2,1.5,0],head:[0.05,-0.2,0],rHip:[0.3,0,-0.35],lHip:[-0.4,0,0.3],lKnee:[0.25,0,0],rKnee:[1.1,0,0],rSh:[-1.7,0,0.9],rEl:[-1.4,0,0],lSh:[-1.3,0,0.9],lEl:[-1.3,0,0],batDir:[0.55,0.45,-0.7]},
 bunt:{dy:-0.15,torso:[0.3,-0.8,0],head:[0.05,0.4,0],rHip:[-0.5,0,-0.3],lHip:[-0.5,0,0.3],rKnee:[0.8,0,0],lKnee:[0.8,0,0],rSh:[-1.25,0,-0.25],rEl:[-0.45,0,0],lSh:[-1.35,0,0.35],lEl:[-0.25,0,0],batDir:[0.1,0.05,1]},
 /* 投手（本塁方向=+z を向く。右投げ基準。hips=骨盤の向き、torso=上体のひねり、dz=前方への移動）
    ワインドアップ：セット→軸足に体重→足上げ（バランスポイント）→踏み出し・手が離れる→着地（腕を担ぐ）→体幹回転・加速→リリース→フォロー */
 pset:{rSh:[-0.9,0,-0.25],lSh:[-0.95,0,0.3],rEl:[-1.55,0,0],lEl:[-1.45,0,0],head:[0.05,0,0]},
 pset2:{hips:[0,-1.45,0],head:[0.05,1.45,0],rSh:[-0.55,0,-0.25],lSh:[-0.6,0,0.3],rEl:[-1.9,0,0],lEl:[-1.85,0,0],rKnee:[0.15,0,0],lKnee:[0.15,0,0],lHip:[0,0,0.25],rHip:[0,0,-0.1]},
 prock:{torso:[-0.1,0,0],head:[0.08,0,0],rSh:[-1.25,0,-0.3],lSh:[-1.3,0,0.35],rEl:[-1.85,0,0],lEl:[-1.8,0,0],lHip:[0.35,0,0.25],lKnee:[0.25,0,0],rKnee:[0.1,0,0]},
 pwind:{dy:0.02,torso:[-0.18,0,0],rSh:[-2.75,0,-0.35],lSh:[-2.75,0,0.35],rEl:[-0.55,0,0],lEl:[-0.55,0,0],rHip:[0.1,0,-0.05],lHip:[0.1,0,0.05],head:[-0.15,0,0]},
 pbal:{dy:-0.04,hips:[0,-1.15,0],torso:[0.0,-0.15,0.05],head:[0.1,1.3,0],lHip:[-1.75,0,0.2],lKnee:[1.75,0,0],rHip:[0.05,0,-0.02],rKnee:[0.22,0,0],rSh:[-0.85,0,-0.3],lSh:[-0.9,0,0.35],rEl:[-1.85,0,0],lEl:[-1.8,0,0]},
 plift:{dy:-0.04,hips:[0,-1.15,0],torso:[0.0,-0.15,0.05],head:[0.1,1.3,0],lHip:[-1.75,0,0.2],lKnee:[1.75,0,0],rHip:[0.05,0,-0.02],rKnee:[0.22,0,0],rSh:[-0.85,0,-0.3],lSh:[-0.9,0,0.35],rEl:[-1.85,0,0],lEl:[-1.8,0,0]},
 plift2:{dy:-0.03,hips:[0,-1.35,0],head:[0.05,1.4,0],lHip:[-1.3,0,0.2],lKnee:[1.4,0,0],rKnee:[0.25,0,0],rSh:[-0.6,0,-0.25],lSh:[-0.65,0,0.3],rEl:[-1.9,0,0],lEl:[-1.85,0,0]},
 pstride:{dy:-0.14,dz:0.22,hips:[0,-1.0,0],torso:[0.05,-0.15,-0.08],head:[0.1,1.15,0],lHip:[-0.6,0,0.95],lKnee:[0.55,0,0],rHip:[0.35,0,-0.7],rKnee:[0.55,0,0],rSh:[0.4,0,-0.7],rEl:[-0.35,0,0],lSh:[-0.45,0,1.2],lEl:[-0.3,0,0]},
 pcock:{dy:-0.24,dz:0.6,hips:[0,-0.55,0],torso:[0.12,-0.5,-0.15],head:[0.0,1.05,0],lHip:[-0.85,0,0.55],lKnee:[0.62,0,0],rHip:[0.7,0,-0.45],rKnee:[0.5,0,0],rSh:[-1.5,-0.35,-1.5],rEl:[-1.6,0,0],lSh:[-0.5,0,1.15],lEl:[-0.4,0,0]},
 pacc:{dy:-0.28,dz:0.85,hips:[0,-0.05,0],torso:[0.45,-0.2,-0.22],head:[-0.15,0.25,0],lHip:[-0.95,0,0.12],lKnee:[0.65,0,0],rHip:[1.0,0,-0.15],rKnee:[0.55,0,0],rSh:[-1.3,0.3,-2.2],rEl:[-1.2,0,0],lSh:[-0.9,0,0.4],lEl:[-2.1,0,0]},
 prel:{dy:-0.32,dz:0.97,hips:[0,0.1,0],torso:[0.6,-0.05,-0.35],head:[-0.45,-0.05,0],lHip:[-0.85,0,0.1],lKnee:[0.6,0,0],rHip:[1.05,0,-0.15],rKnee:[0.45,0,0],rSh:[-2.0,0,-0.5],rEl:[-0.2,0,0],lSh:[0.4,0,0.45],lEl:[-1.9,0,0]},
 pext:{dy:-0.3,dz:1.1,hips:[0,0.35,0],torso:[1.0,0.6,-0.15],head:[-0.6,-0.6,0],lHip:[-0.8,0,0.15],lKnee:[0.6,0,0],rHip:[-0.9,0,-0.35],rKnee:[0.9,0,0],rSh:[-0.75,0,0.8],rEl:[-0.75,0,0],lSh:[0.75,0,0.5],lEl:[-1.25,0,0]},
 pend:{dy:-0.3,dz:1.1,hips:[0,0.35,0],torso:[1.0,0.6,-0.15],head:[-0.6,-0.6,0],lHip:[-0.8,0,0.15],lKnee:[0.6,0,0],rHip:[-0.9,0,-0.35],rKnee:[0.9,0,0],rSh:[-0.75,0,0.8],rEl:[-0.75,0,0],lSh:[0.75,0,0.5],lEl:[-1.25,0,0]},
 pland:{dy:-0.15,dz:1.15,torso:[0.45,0.2,0],head:[-0.25,-0.1,0],lHip:[-0.55,0,0.15],lKnee:[0.55,0,0],rHip:[-0.5,0,-0.2],rKnee:[0.6,0,0],rSh:[-0.35,0,-0.3],rEl:[-0.7,0,0],lSh:[-0.5,0,0.4],lEl:[-1.0,0,0]},
};
/* ポーズの補間：関節の回転はクォータニオンで球面補間（大きな回転でも最短経路で滑らか）、batDir は方向を正規化して補間 */
const R3_QA=new THREE.Quaternion(),R3_QB=new THREE.Quaternion(),R3_EU=new THREE.Euler();
function r3MixPose(a,b,u){const o={};const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of keys){const x=a[k],y=b[k];if(k==='dy'||k==='dz'){o[k]=(x||0)+((y||0)-(x||0))*u;continue;}if(k==='ik'){o[k]=u<0.5?x:y;continue;}const X=x||[0,0,0],Y=y||[0,0,0];
  if(k==='batDir'){const v=[X[0]+(Y[0]-X[0])*u,X[1]+(Y[1]-X[1])*u,X[2]+(Y[2]-X[2])*u];const l=Math.hypot(v[0],v[1],v[2])||1;o[k]=[v[0]/l,v[1]/l,v[2]/l];continue;}
  const big=Math.abs(Y[0]-X[0])+Math.abs(Y[1]-X[1])+Math.abs(Y[2]-X[2]);if(big<0.9){o[k]=[X[0]+(Y[0]-X[0])*u,X[1]+(Y[1]-X[1])*u,X[2]+(Y[2]-X[2])*u];continue;}
  R3_QA.setFromEuler(R3_EU.set(X[0],X[1],X[2]));R3_QB.setFromEuler(R3_EU.set(Y[0],Y[1],Y[2]));R3_QA.slerp(R3_QB,u);R3_EU.setFromQuaternion(R3_QA);o[k]=[R3_EU.x,R3_EU.y,R3_EU.z];}return o;}
const RCLIP={
 swing:[[0,'stance'],[0.18,'load'],[0.4,'stride'],[0.53,'launch'],[0.62,'contact'],[0.74,'ext'],[1,'follow']],
 windup:[[0,'pset'],[0.42,'pbal'],[0.75,'pstride'],[1,'prel']],
 pfollow:[[0,'prel'],[1,'pext']],
 throw:[[0,'throwWind'],[0.55,'throwRel'],[1,'throwEnd']],
 catchHigh:[[0,'ready'],[1,'catchHigh']],catchLow:[[0,'ready'],[1,'catchLow']],
};
/* 投球フォーム別の差分（腕の高さ・上体の傾き）：オーバー／スリークォーター／サイド／アンダー */
const RPFORM={
 over:{},
 three:{pcock:{rSh:[-1.3,-0.35,-1.4]},pacc:{rSh:[-1.1,0.3,-1.9],torso:[0.45,-0.2,-0.15]},prel:{rSh:[-1.85,0,-1.0],torso:[0.62,-0.05,-0.2]},pext:{rSh:[-0.7,0,0.7]}},
 side:{pstride:{rSh:[0.3,0,-0.9],torso:[0.1,-0.15,-0.15]},pcock:{rSh:[-0.9,-0.4,-1.3],rEl:[-1.2,0,0],torso:[0.2,-0.5,-0.3]},pacc:{rSh:[-0.4,0.4,-1.7],rEl:[-0.9,0,0],torso:[0.5,-0.2,-0.4]},prel:{rSh:[0,0.7,-1.65],rEl:[-0.15,0,0],torso:[0.6,-0.05,-0.35],dy:-0.36},pext:{rSh:[-0.5,0.4,0.5],rEl:[-0.5,0,0],torso:[1.0,0.6,-0.3]}},
 under:{pstride:{rSh:[0.6,0,-0.5],torso:[0.3,-0.15,-0.05]},pcock:{rSh:[-0.3,-0.3,-1.0],rEl:[-0.8,0,0],torso:[0.55,-0.5,-0.15],dy:-0.3},pacc:{rSh:[0.2,0.4,-1.3],rEl:[-0.5,0,0],torso:[0.9,-0.2,-0.1],dy:-0.36},prel:{rSh:[0,0.6,-1.0],rEl:[-0.1,0,0],torso:[1.1,-0.05,-0.1],dy:-0.42,head:[-0.75,-0.05,0]},pext:{rSh:[-1.6,0.2,0.3],rEl:[-0.4,0,0],torso:[0.8,0.6,0],dy:-0.34}},
};
for(const f in RPFORM){const o=RPFORM[f];for(const k of ['pstride','pcock','pacc','prel','pext'])RP[k+'_'+f]=Object.assign({},RP[k],o[k]||{});
 RCLIP['windup_'+f]=[[0,'pset'],[0.14,'prock'],[0.4,'pbal'],[0.58,'pstride_'+f],[0.76,'pcock_'+f],[0.9,'pacc_'+f],[1,'prel_'+f]];
 RCLIP['stretch_'+f]=[[0,'pset2'],[0.36,'plift2'],[0.58,'pstride_'+f],[0.76,'pcock_'+f],[0.9,'pacc_'+f],[1,'prel_'+f]];
 RCLIP['pfollow_'+f]=[[0,'prel_'+f],[0.3,'pext_'+f],[0.75,'pland'],[1,'pland']];}
function r3PitForm(p){return p&&RPFORM[p.pitForm]?p.pitForm:'over';}
function r3ClipPose(name,u){const c=RCLIP[name];u=clamp(u,0,1);for(let i=1;i<c.length;i++){if(u<=c[i][0]){const a=c[i-1],b=c[i];const k=(u-a[0])/(b[0]-a[0]);const e=k*k*(3-2*k);return r3MixPose(RP[a[1]],RP[b[1]],e);}}return RP[c[c.length-1][1]];}
function r3RunPose(ph,k){k=k==null?1:k;const s=Math.sin(ph),c=Math.cos(ph);return {dy:-0.02+0.03*Math.abs(c),torso:[0.22*k,0,0],head:[-0.15,0,0],rHip:[-0.85*s*k,0,-0.05],lHip:[0.85*s*k,0,0.05],rKnee:[(0.35+0.8*Math.max(0,-s))*k,0,0],lKnee:[(0.35+0.8*Math.max(0,s))*k,0,0],rSh:[0.9*s*k,0,-0.15],lSh:[-0.9*s*k,0,0.15],rEl:[-1.3*k,0,0],lEl:[-1.3*k,0,0]};}
/* ---- ワールド構築 ---- */
function r3Rin(a){const A=Math.abs(a);if(A<=49)return FENCE(Math.min(45,A))+4;if(A>=117.4)return 22;
 /* サイドの壁（ポール付近→バックネット脇）との交点 */const W1=[13.5,-7],W2=[75.5,65.6];const dx=Math.sin(A*Math.PI/180),dy=Math.cos(A*Math.PI/180);const ex=W2[0]-W1[0],ey=W2[1]-W1[1];const den=dx*ey-dy*ex;if(Math.abs(den)<1e-6)return 60;const r=(W1[0]*ey-W1[1]*ex)/den;return Math.max(20,r)+4;}
/* 環境マップ（空と芝の簡易環境）：選手の材質の映り込み・環境光に使う */
function r3BuildEnv(){if(R3.env||!R3.renderer)return;try{const pm=new THREE.PMREMGenerator(R3.renderer);const es=new THREE.Scene();
 const cv=document.createElement('canvas');cv.width=8;cv.height=128;const g=cv.getContext('2d');const gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,'#6fa6e0');gr.addColorStop(0.48,'#dde9f3');gr.addColorStop(0.52,'#b9c2b0');gr.addColorStop(1,'#6e7a66');g.fillStyle=gr;g.fillRect(0,0,8,128);
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;const sky=new THREE.Mesh(new THREE.SphereGeometry(50,16,12),new THREE.MeshBasicMaterial({map:t,side:THREE.BackSide}));es.add(sky);
 const sun=new THREE.Mesh(new THREE.SphereGeometry(4,8,6),new THREE.MeshBasicMaterial({color:0xfff2d0}));sun.position.set(-20,28,-10);es.add(sun);
 R3.env=pm.fromScene(es,0.05).texture;pm.dispose();}catch(e){console.warn('env map failed',e);R3.env=null;}}
function r3BuildWorld(){const S=R3.scene=new THREE.Scene();R3.cam=new THREE.PerspectiveCamera(40,1,0.15,1200);r3BuildEnv();
 /* 空 */const sk=document.createElement('canvas');sk.width=1024;sk.height=256;R3.skyCv=sk;R3.skyTex=new THREE.CanvasTexture(sk);R3.skyTex.colorSpace=THREE.SRGBColorSpace;R3.sky=new THREE.Mesh(new THREE.SphereGeometry(900,24,16),new THREE.MeshBasicMaterial({map:R3.skyTex,side:THREE.BackSide,fog:false,toneMapped:false}));S.add(R3.sky);
 R3.fog=new THREE.Fog(0xc9dcea,180,900);S.fog=R3.fog;
 /* 光 */R3.hemi=new THREE.HemisphereLight(0xcfe3ff,0x4a6b3a,0.75);S.add(R3.hemi);
 R3.sun=new THREE.DirectionalLight(0xfff1dc,1.2);R3.sun.position.set(-70,120,-30);R3.sun.castShadow=true;R3.sun.shadow.mapSize.set(1536,1536);const sc=R3.sun.shadow.camera;sc.near=10;sc.far=400;sc.left=-110;sc.right=110;sc.top=130;sc.bottom=-60;R3.sun.shadow.bias=-0.0006;R3.sun.shadow.normalBias=0.02;S.add(R3.sun);S.add(R3.sun.target);R3.sun.target.position.set(0,0,-50);
 /* 地面 */const gt=r3GroundTex(false);R3.groundTex=gt;const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,260),new THREE.MeshLambertMaterial({map:gt}));ground.rotation.x=-Math.PI/2;ground.position.set(0,0,-90);ground.receiveShadow=true;S.add(ground);R3.ground=ground;
 const far=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),r3Mat('#4b6b3b'));far.rotation.x=-Math.PI/2;far.position.set(0,-0.05,-90);S.add(far);
 /* 本塁周辺の高解像度デカール（打席の白線が近くでもにじまない） */R3.homeTex=r3HomeTex(false);const home=new THREE.Mesh(new THREE.PlaneGeometry(R3_HOME.W,R3_HOME.W),new THREE.MeshLambertMaterial({map:R3.homeTex,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));home.rotation.x=-Math.PI/2;home.position.set(0,0.004,-R3_HOME.CY);home.receiveShadow=true;S.add(home);R3.home=home;
 /* マウンド・プレート・ベース */const mound=new THREE.Mesh(new THREE.CylinderGeometry(1.0,3.0,0.26,28),r3Mat('#5c4d43'));mound.position.set(0,0.13,-R3C.RUBBER);mound.receiveShadow=true;S.add(mound);R3.mound=mound;
 const rubber=new THREE.Mesh(r3Box(0.61,0.03,0.15,0),r3Mat('#f4f1e6'));rubber.position.set(0,0.27,-R3C.RUBBER);S.add(rubber);
 const plateShape=new THREE.Shape();plateShape.moveTo(-0.216,0);plateShape.lineTo(0.216,0);plateShape.lineTo(0.216,-0.216);plateShape.lineTo(0,-0.43);plateShape.lineTo(-0.216,-0.216);plateShape.closePath();const plate=new THREE.Mesh(new THREE.ShapeGeometry(plateShape),r3Mat('#f4f1e6'));plate.rotation.x=-Math.PI/2;plate.position.set(0,0.012,0.0);S.add(plate);
 for(const B of [[19.4,19.4],[0,38.8],[-19.4,19.4]]){const b=new THREE.Mesh(r3Box(0.38,0.1,0.38,0.05),r3Mat('#f4f1e6'));b.position.set(B[0],0,-B[1]);b.rotation.y=Math.PI/4;b.castShadow=true;S.add(b);}
 /* 球場（スタンド・銀傘・バックスクリーン・スコアボード・照明塔・観客） */r3BuildStadium(S);
 /* 選手 */r3BuildRigs(S);
 /* 捕手のミット（独立して動く） */R3.mitt=new THREE.Mesh(r3Geo('mitt',()=>{const g=new THREE.SphereGeometry(0.11,14,12);g.scale(1,1.1,0.55);return g;}),new THREE.MeshLambertMaterial({color:new THREE.Color('#9a6a3c'),emissive:0x221408,transparent:true,opacity:0.88}));R3.mitt.castShadow=true;S.add(R3.mitt);
 /* ボール */R3.ball=new THREE.Mesh(r3Sph(0.075),new THREE.MeshLambertMaterial({color:0xffffff,emissive:0x6a6a6a}));R3.ball.castShadow=true;S.add(R3.ball);
 const gc=document.createElement('canvas');gc.width=gc.height=64;const gg=gc.getContext('2d');const grd=gg.createRadialGradient(32,32,2,32,32,30);grd.addColorStop(0,'rgba(255,255,255,1)');grd.addColorStop(0.35,'rgba(255,255,255,.55)');grd.addColorStop(1,'rgba(255,255,255,0)');gg.fillStyle=grd;gg.fillRect(0,0,64,64);
 R3.glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(gc),transparent:true,depthWrite:false,opacity:0.9}));S.add(R3.glow);
 R3.trailM=[];R3.trailP=[];for(let i=0;i<7;i++){const t=new THREE.Mesh(r3Sph(0.05),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.45-i*0.06,depthWrite:false}));t.visible=false;S.add(t);R3.trailM.push(t);}
 R3.shadowBlob=null;}
/* 選手リグの生成（設定「選手モデル」で作り直せる） */
function r3BuildRigs(S){const all=[].concat(Object.values(R3.fielders||{}),R3.batter?[R3.batter]:[],R3.runners||[],R3.umps||[]);for(const r of all){if(r&&r.g&&r.g.parent)r.g.parent.remove(r.g);}
 R3.fielders={};for(const k of ['投','捕','一','二','三','遊','左','中','右']){const r=r3NewRig();S.add(r.g);R3.fielders[k]=r;}
 R3.batter=r3NewRig();S.add(R3.batter.g);R3.batter.bat.visible=true;
 R3.runners=[];for(let i=0;i<4;i++){const r=r3NewRig();S.add(r.g);r.g.visible=false;R3.runners.push(r);}
 R3.umps=[];for(let i=0;i<3;i++){const r=r3NewRig();r.setColors(R3_UMP,false);r.setGear(i===0?'umpire':null);S.add(r.g);R3.umps.push(r);}R3.rigModel=actionSettings().model3d;}
function r3RebuildRigs(){if(!R3.scene)return;if(R3.rigModel===actionSettings().model3d)return;r3BuildRigs(R3.scene);}
/* リボン（極座標の壁）：r(a)、角度範囲、高さ */
function r3Ribbon(S,rf,a0,a1,step,h0,h1,col){const pos=[],idx=[];let n=0;for(let a=a0;a<=a1+1e-6;a+=step){const r=rf(a);const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);pos.push(x,h0,-y,x,h1,-y);if(n>0){const b=(n-1)*2;idx.push(b,b+1,b+2,b+1,b+3,b+2);}n++;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,r3Mat(col,{side:THREE.DoubleSide}));m.receiveShadow=true;S.add(m);return m;}
function r3WallSeg(S,P1,P2,h,col){const pos=[P1[0],0,-P1[1],P1[0],h,-P1[1],P2[0],0,-P2[1],P2[0],h,-P2[1]];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex([0,1,2,1,3,2]);g.computeVertexNormals();const m=new THREE.Mesh(g,r3Mat(col,{side:THREE.DoubleSide}));S.add(m);return m;}
function r3LayoutCrowd(){const im=R3.crowd,hm=R3.crowdH;if(!im)return;const tmp=new THREE.Object3D();R3.crowdSeed.forEach((c,i)=>{const on=c.p<R3.fill;tmp.position.set(c.x,c.y,c.z);tmp.rotation.set(0,c.rot,0);tmp.scale.setScalar(on?c.sc:0.0001);tmp.updateMatrix();im.setMatrixAt(i,tmp.matrix);hm.setMatrixAt(i,tmp.matrix);});im.instanceMatrix.needsUpdate=true;hm.instanceMatrix.needsUpdate=true;}
function r3BuildBoard(S){const cv=document.createElement('canvas');cv.width=1280;cv.height=480;R3.boardCv=cv;R3.boardTex=new THREE.CanvasTexture(cv);R3.boardTex.colorSpace=THREE.SRGBColorSpace;
 const y=FENCE(0)+12.5;const m=new THREE.Mesh(new THREE.PlaneGeometry(32,12),new THREE.MeshBasicMaterial({map:R3.boardTex,toneMapped:false}));m.position.set(0,16.4,-y);S.add(m);R3.board=m;
 const frame=new THREE.Mesh(r3Box(34,14,1.2,0),r3Mat('#1b2229'));frame.position.set(0,16.4,-y-0.7);S.add(frame);
 const base=new THREE.Mesh(r3Box(30,1.0,2.4,0),r3Mat('#3a4149'));base.position.set(0,9.8,-y-0.6);S.add(base);
 for(const x of [-12,0,12]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.7,10,8),r3Mat('#4a5560'));p.position.set(x,5,-y-1.2);S.add(p);}}
function r3UpdateBoard(){if(!R3.boardCv||!AR.m)return;const m=AR.m;const g=R3.boardCv.getContext('2d');const W=R3.boardCv.width,H=R3.boardCv.height;g.fillStyle='#0b0f13';g.fillRect(0,0,W,H);
 g.strokeStyle='#2a333c';g.lineWidth=4;g.strokeRect(2,2,W-4,H-4);
 const fn=getComputedStyle(document.body).getPropertyValue('--font-num')||'monospace';g.textBaseline='middle';
 const n=Math.max(9,m.inn);const abbr=t=>arAbbr(t.name).slice(0,4);const hits=t=>{try{return sum(Object.values(t.stats).map(x=>x.h));}catch(e){return 0;}};
 /* 左右：打順（縦書き風に9人）／中央：イニング別得点 */
 const names=(t,x)=>{g.fillStyle='#e6e2d8';g.font='26px sans-serif';g.textAlign='left';for(let i=0;i<9;i++){const sl=t.lineup[i];if(!sl)continue;const nm=(sl.p.name||'').replace(/\s/g,'');const pos=sl.pos||'';g.fillStyle='#9fb3c8';g.fillText(pos,x,96+i*34);g.fillStyle='#e6e2d8';g.fillText(nm.slice(0,5),x+34,96+i*34);}};
 names(m.A,30);names(m.B,W-236);
 const cx0=270,cw=(W-540)/(n+2);g.textAlign='center';
 g.fillStyle='#ffd166';g.font='700 34px sans-serif';g.fillText(abbr(m.A),cx0-40,150);g.fillText(abbr(m.B),cx0-40,214);
 g.fillStyle='#9fb3c8';g.font='28px sans-serif';for(let k=0;k<n;k++)g.fillText(String(k+1),cx0+cw*(k+0.5),98);g.fillText('R',cx0+cw*(n+0.5),98);g.fillText('H',cx0+cw*(n+1.5),98);
 g.strokeStyle='#26303a';g.lineWidth=2;for(let k=0;k<=n+2;k++){const x=cx0+cw*k;g.beginPath();g.moveTo(x,78);g.lineTo(x,240);g.stroke();}
 g.font=`700 44px ${fn}`;for(const i of [0,1]){const y=i?214:150;for(let k=0;k<n;k++){const v=m.line[i][k];g.fillStyle=v==null?'#4a5560':'#ffe9a8';g.fillText(v==null?'':String(v),cx0+cw*(k+0.5),y);}
  g.fillStyle='#ffd166';g.fillText(String(m.score[i]),cx0+cw*(n+0.5),y);g.fillStyle='#e6e2d8';g.fillText(String(hits(i?m.B:m.A)),cx0+cw*(n+1.5),y);}
 /* 下段：回・B/S/O・打者と投手 */
 const pa=m.pa;const live=pa&&!(AR.mode==='card'&&AR.phase==='pre');const bb=live?pa.balls:0,ss=live?pa.strikes:0;
 const lamp=(x,y,on,col)=>{g.fillStyle=on?col:'#263039';g.beginPath();g.arc(x,y,14,0,Math.PI*2);g.fill();};
 g.textAlign='center';g.fillStyle='#e6e2d8';g.font='700 40px sans-serif';g.fillText(`${m.inn}回${m.top?'表':'裏'}`,W*0.5,296);
 g.textAlign='right';g.font='32px sans-serif';g.fillStyle='#9fb3c8';g.fillText('B',W*0.5-140,350);g.fillText('S',W*0.5-140,350+44);g.fillText('O',W*0.5-140,350+88);
 for(let i=0;i<3;i++)lamp(W*0.5-100+i*44,350,bb>i,'#3fd36b');for(let i=0;i<2;i++)lamp(W*0.5-100+i*44,394,ss>i,'#ffd166');for(let i=0;i<2;i++)lamp(W*0.5-100+i*44,438,m.outs>i,'#ff5a4a');
 const t=m.bat(),d=m.def();const b=pa?pa.b:t.lineup[t.batIdx].p;const p=pa?pa.p:d.pitcher;g.textAlign='left';g.fillStyle='#e6e2d8';g.font='30px sans-serif';g.fillText(`打者 ${t.batIdx+1}番 ${b.name}`,W*0.5+60,350);g.fillText(`投手 ${p.name}`,W*0.5+60,394);
 const now=new Date();g.fillStyle='#9fb3c8';g.font=`32px ${fn}`;g.fillText(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,W*0.5+60,438);
 R3.boardTex.needsUpdate=true;}
/* 地面テクスチャ（真上から見たグラウンド） */
function r3GroundTex(night){const N=2048;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');const s=N/260;const T=(X,Y)=>[(X+130)*s,(220-Y)*s];
 const grass1=night?'#245a30':'#3f8d4b',grass2=night?'#2a6a3c':'#4a9c57',dirt=night?'#3d342d':'#564840',dirt2=night?'#4a3f36':'#665549',chalk=night?'#e4e0d2':'#f6f2e4';
 g.fillStyle=grass1;g.fillRect(0,0,N,N);
 const h0=T(0,0);
 /* 芝目：放射状のウェッジ＋同心円のバンド（刈り込みのチェック模様） */
 g.save();g.translate(h0[0],h0[1]);for(let a=-70;a<70;a+=7){g.fillStyle=((a/7)|0)%2?grass2:grass1;g.beginPath();g.moveTo(0,0);g.arc(0,0,210*s,(a-90)*Math.PI/180,(a+7-90)*Math.PI/180);g.closePath();g.fill();}
 g.globalAlpha=0.35;for(let r=12;r<200;r+=16){g.fillStyle=((r/16)|0)%2?'rgba(255,255,255,.10)':'rgba(0,0,0,.08)';g.beginPath();g.arc(0,0,(r+16)*s,0,Math.PI*2);g.arc(0,0,r*s,0,Math.PI*2,true);g.fill();}g.globalAlpha=1;g.restore();
 /* 芝の質感（細かな斑） */{let sd=9;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff;};for(let i=0;i<26000;i++){const x=rnd()*N,y=rnd()*N;g.fillStyle=rnd()<0.5?'rgba(0,0,0,.06)':'rgba(255,255,200,.05)';g.fillRect(x,y,1+rnd()*2,1+rnd()*2);}}
 /* ウォーニングトラック */g.strokeStyle=dirt2;g.lineWidth=4.5*s;g.beginPath();for(let a=-60;a<=60;a+=2){const r=FENCE(Math.min(45,Math.abs(a)))-2.2+(Math.abs(a)>45?(Math.abs(a)-45)*1.4:0);const p=T(r*Math.sin(a*Math.PI/180),r*Math.cos(a*Math.PI/180));if(a===-60)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);}g.stroke();
 /* 内野の黒土（全面） */g.fillStyle=dirt;const mc=T(0,18.4);g.beginPath();g.arc(mc[0],mc[1],29*s,0,Math.PI*2);g.fill();g.beginPath();g.arc(h0[0],h0[1]+1*s,18*s,0,Math.PI*2);g.fill();
 /* ファウルゾーンの土（ベンチ前） */g.fillStyle=dirt;for(const sg of [-1,1]){g.beginPath();const p1=T(sg*4,-3),p2=T(sg*40,33),p3=T(sg*44,29),p4=T(sg*7,-7);g.moveTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.lineTo(p3[0],p3[1]);g.lineTo(p4[0],p4[1]);g.closePath();g.fill();}
 /* 土の質感（粒・トンボの筋） */{let sd=3;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff;};g.save();g.beginPath();g.arc(mc[0],mc[1],29*s,0,Math.PI*2);g.arc(h0[0],h0[1]+1*s,18*s,0,Math.PI*2);g.clip();
  for(let i=0;i<14000;i++){const x=rnd()*N,y=rnd()*N;g.fillStyle=rnd()<0.5?'rgba(0,0,0,.08)':'rgba(255,235,210,.07)';g.fillRect(x,y,1+rnd()*2,1+rnd()*2);}
  g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;for(let r=2;r<30;r+=0.6){g.beginPath();g.arc(mc[0],mc[1],r*s,0,Math.PI*2);g.stroke();}g.restore();}
 /* マウンド */g.fillStyle=dirt2;g.beginPath();g.arc(mc[0],mc[1],3*s,0,Math.PI*2);g.fill();
 /* ファウルライン */g.strokeStyle=chalk;g.lineWidth=Math.max(2,0.3*s);for(const sg of [-1,1]){const e=T(sg*120,120);g.beginPath();g.moveTo(h0[0],h0[1]);g.lineTo(e[0],e[1]);g.stroke();}
 /* バッターボックス・キャッチャーボックス */g.lineWidth=Math.max(1.5,0.12*s);for(const sg of [-1,1]){const a=T(sg*0.37,0.9),b=T(sg*1.59,-0.9);g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
 {const a=T(-0.6,-0.9),b=T(0.6,-3.4);g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
 /* ネクストバッターズサークル・コーチャーズボックス */g.lineWidth=Math.max(1.5,0.12*s);for(const sg of [-1,1]){const p=T(sg*9,-6);g.beginPath();g.arc(p[0],p[1],1.5*s,0,Math.PI*2);g.stroke();const a=T(sg*23.5,16.5),b=T(sg*25.5,22.5);g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
 /* 塁 */g.fillStyle=chalk;for(const B of [[19.4,19.4],[0,38.8],[-19.4,19.4]]){const p=T(B[0],B[1]);g.fillRect(p[0]-0.2*s,p[1]-0.2*s,0.4*s,0.4*s);}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=R3.renderer?R3.renderer.capabilities.getMaxAnisotropy():4;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;return tex;}
const R3_HOME={W:14,CY:2.5};
function r3HomeTex(night){const N=1024;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');const s=N/R3_HOME.W;const T=(X,Y)=>[(X+R3_HOME.W/2)*s,(R3_HOME.CY+R3_HOME.W/2-Y)*s];
 const dirt=night?'#3d342d':'#564840',chalk=night?'#d8d2c2':'#e9e3d3';g.fillStyle=dirt;g.fillRect(0,0,N,N);
 /* 土の質感（粒・掃き目） */let sd=7;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff;};for(let i=0;i<9000;i++){const x=rnd()*N,y=rnd()*N;const k=rnd();g.fillStyle=k<0.5?'rgba(0,0,0,.07)':'rgba(255,240,220,.06)';g.fillRect(x,y,1+rnd()*2.5,1+rnd()*2.5);}
 g.strokeStyle='rgba(255,255,255,.035)';g.lineWidth=1;for(let r=1;r<9;r+=0.45){const p=T(0,0);g.beginPath();g.arc(p[0],p[1],r*s,0,Math.PI*2);g.stroke();}
 /* 白線：打席（1.22×1.83m）・捕手ボックス・ファウルライン */g.strokeStyle=chalk;g.lineWidth=0.1*s;g.lineCap='butt';
 for(const sg of [-1,1]){const a=T(sg*0.37,0.915),b=T(sg*1.59,-0.915);g.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));}
 {const a=T(-0.6,-0.915),b=T(0.6,-3.4);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(a[0],b[1]);g.lineTo(b[0],b[1]);g.lineTo(b[0],a[1]);g.stroke();}
 for(const sg of [-1,1]){const a=T(sg*0.23,-0.05),b=T(sg*8,7.72);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=R3.renderer?R3.renderer.capabilities.getMaxAnisotropy():4;tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;return tex;}
function r3SetNight(night,force){if(R3.night===night&&!force)return;R3.night=night;
 const g=R3.skyCv.getContext('2d');const gr=g.createLinearGradient(0,0,0,256);if(night){gr.addColorStop(0,'#050b14');gr.addColorStop(0.55,'#0f1d31');gr.addColorStop(1,'#223a56');}else{/* 雲やモヤのない澄んだ青空（地平線近くも白くしない） */gr.addColorStop(0,'#2b78cc');gr.addColorStop(0.55,'#5ea4e4');gr.addColorStop(1,'#8fc3ec');}g.fillStyle=gr;g.fillRect(0,0,1024,256);
 if(night){for(let i=0;i<120;i++){g.fillStyle='rgba(255,255,255,'+(0.3+Math.random()*0.6)+')';g.fillRect(Math.random()*1024,Math.random()*120,1.2,1.2);}}
 R3.skyTex.needsUpdate=true;
 R3.fog.color.set(night?0x0e1620:0xc9dcea);R3.hemi.intensity=night?0.22:0.78;R3.hemi.color.set(night?0x8fa8cf:0xcfe3ff);R3.hemi.groundColor.set(night?0x1a2a1a:0x4a6b3a);
 R3.sun.intensity=night?0.95:1.25;R3.sun.color.set(night?0xdbe6ff:0xfff1dc);R3.sun.position.set(night?40:-70,night?120:120,night?-70:-30);
 for(const l of R3.lamps){l.material.emissive.set(night?0xfff3c4:0x000000);l.material.emissiveIntensity=night?1.2:0;l.material.color.set(night?0xfff3c4:0x8a8f99);}
 for(const d of (R3S.dim||[]))d.m.material.color.set(night?d.night:d.day);
 if(R3.groundTex){const t=r3GroundTex(night);R3.ground.material.map=t;R3.ground.material.needsUpdate=true;R3.groundTex.dispose();R3.groundTex=t;}
 if(R3.home){const t=r3HomeTex(night);R3.home.material.map=t;R3.home.material.needsUpdate=true;if(R3.homeTex)R3.homeTex.dispose();R3.homeTex=t;}
 R3.mound.material=r3Mat(night?'#463a31':'#5c4d43');R3.renderer.setClearColor(night?0x0a1220:0x9fcbea);}
/* ---- 投影ヘルパー（HUD用） ---- */
function r3Project(v){const p=v.clone().project(R3.cam);return [(p.x+1)/2*R3.W,(1-p.y)/2*R3.H,p.z];}
function r3WorldToScreen(X,Y,Z){return r3Project(r3V(X,Y,Z||0)).slice(0,2);}
function r3ZoneToScreen(x,y){return r3Project(r3ZoneW(x,y)).slice(0,2);}
function r3ZoneRect(){const c=r3ZoneToScreen(0,0),r=r3ZoneToScreen(1,0),t=r3ZoneToScreen(0,-1);return {cx:c[0],cy:c[1],w:Math.max(10,Math.abs(r[0]-c[0])*2),h:Math.max(10,Math.abs(c[1]-t[1])*2)};}
function r3ScreenToZone(sx,sy){const nd=new THREE.Vector3(sx/R3.W*2-1,1-sy/R3.H*2,0.5).unproject(R3.cam);const o=R3.cam.position;const d=nd.sub(o);if(Math.abs(d.z)<1e-6)return {x:0,y:0};const t=(R3C.PLATE_Z-o.z)/d.z;if(t<0)return {x:0,y:0};const px=o.x+d.x*t,py=o.y+d.y*t;return {x:px/R3C.ZX,y:(R3C.ZH0-py)/R3C.ZH};}
/* HUD：ゾーンを投影した四角形で描く */
function r3DrawZone(g,alpha){const P=(x,y)=>r3ZoneToScreen(x,y);g.save();g.globalAlpha=alpha==null?1:alpha;
 const poly=(pts)=>{g.beginPath();pts.forEach((p,i)=>{if(i===0)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);});g.closePath();};
 poly([P(-1,-1),P(1,-1),P(1,1),P(-1,1)]);g.fillStyle='rgba(10,20,30,.22)';g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=5;g.stroke();g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=2.5;g.stroke();
 g.strokeStyle='rgba(255,255,255,.38)';g.lineWidth=1.2;for(const v of [-1/3,1/3]){const a=P(v,-1),b=P(v,1);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();const c=P(-1,v),d=P(1,v);g.beginPath();g.moveTo(c[0],c[1]);g.lineTo(d[0],d[1]);g.stroke();}
 g.restore();}
/* ---- カメラ ---- */
function r3SetCam(pos,look,fov,cut,k){const c=R3.cam;const nowR=Date.now();const dt=Math.min(100,nowR-(R3.lastCamT||nowR));R3.lastCamT=nowR;if(cut||!R3.camPos){R3.camPos=pos.clone();R3.camLook=look.clone();R3.camFov=fov;}else{k=k||0.1;/* フレームレートに依存しない追従（60fps基準の係数kを時間で補正） */const kk=1-Math.pow(1-k,dt/16.7);R3.camPos.lerp(pos,kk);R3.camLook.lerp(look,kk);R3.camFov+=(fov-R3.camFov)*kk;}
 c.position.copy(R3.camPos);c.lookAt(R3.camLook);if(Math.abs(c.fov-R3.camFov)>0.01){c.fov=R3.camFov;c.updateProjectionMatrix();}c.updateMatrixWorld();}
function r3BatCam(cut){const S=actionSettings();const m=AR.m;const pa=m.pa;const hand=pa&&(AR.mode!=='card'||AR.phase!=='pre')?pa.bHand:(AR.preHand||'右');const sg=hand==='左'?-1:1;
 const wide=S.cam3d==='wide';const pos=wide?new THREE.Vector3(sg*1.4,3.8,6.4):new THREE.Vector3(0,1.5,1.8);const look=wide?new THREE.Vector3(0,0.1,-6):new THREE.Vector3(0,-0.87,-7.5);r3SetCam(pos,look,wide?44:R3C.FOV_BAT,cut);}
function r3PitCam(cut){const S=actionSettings();const m=AR.m;const pa=m.pa;const hs=pa?(pa.p.throws==='左'?-1:1):1;const zoom=S.cam3d==='zoom';
 /* センターカメラ：投手の全身とゾーンが収まる高さ・距離 */const pos=new THREE.Vector3(hs*0.9,zoom?2.6:4.3,zoom?-23.6:-29.5);const look=new THREE.Vector3(-hs*0.1,zoom?0.8:0.55,zoom?0.3:-9);r3SetCam(pos,look,zoom?13:23,cut);}
/* リアクションカメラ：三振後に打者の顔へ寄る */
function r3ReactCam(rig,cut){rig.g.updateMatrixWorld(true);const hp=new THREE.Vector3();rig.j.head.getWorldPosition(hp);hp.y+=(rig.dim&&rig.dim.headCy||0.13);const sg=rig.g.scale.x<0?-1:1;const pos=new THREE.Vector3(hp.x+sg*1.25,hp.y+0.12,hp.z+0.75);r3SetCam(pos,hp,30,cut,0.12);}
function r3OrbitCam(now){const a=now/30000;const cx=0,cz=-35;const pos=new THREE.Vector3(cx+Math.sin(a)*62,17+Math.sin(a*0.7)*3,cz+Math.cos(a)*62);const look=new THREE.Vector3(0,3,-40);r3SetCam(pos,look,44,false,0.04);}
function r3FieldCam(sc,t,cut,now){const pts=[];const b=fwAt(sc.ball,t);const rp=sc.kind==='inplay';
 if(rp){const hrRun=sc.res==='HR'&&t>(sc.Tpick||0);if(hrRun){for(const r of sc.runners){const p=fwAt(r.path,t);if(p.moving)pts.push([p.x,p.y,0]);}pts.push([0,0,0]);}
  else{if(b)pts.push([b.x,b.y,b.z]);const started=t<(sc.Tpick||0)+400;if(started&&sc.primary&&sc.fielders[sc.primary]){const f=fwAt(sc.fielders[sc.primary].path,t);pts.push([f.x,f.y,0]);}
   const th=(sc.throws||[]).find(x=>t>=x.Ta-900&&t<=x.Ta+700);if(th){const B=FW_BASE[th.base];pts.push([B[0],B[1],0]);for(const r of sc.runners){const p=fwAt(r.path,t);if(p.moving)pts.push([p.x,p.y,0]);}}
   if(t<350)pts.push([0,0,0]);}}
 else{for(const r of sc.runners){const p=fwAt(r.path,t);pts.push([p.x,p.y,0]);}if(b)pts.push([b.x,b.y,b.z]);pts.push([0,0,0]);}
 if(!pts.length)pts.push([0,20,0]);
 let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9,maxz=0;for(const p of pts){minx=Math.min(minx,p[0]);maxx=Math.max(maxx,p[0]);miny=Math.min(miny,p[1]);maxy=Math.max(maxy,p[1]);maxz=Math.max(maxz,p[2]);}
 const cx=(minx+maxx)/2,cy=(miny+maxy)/2;
 /* TVの「ハイホーム」：本塁後方上空に固定したカメラで被写体を追い、画角（ズーム）で収める */
 const camX=cx*0.18,camY=-30,camH=26;const pos=r3V(camX,camY,camH);const look=r3V(cx,cy,1+maxz*0.5);
 const d=Math.hypot(cx-camX,cy-camY,camH-1);const spread=Math.max(maxx-minx,(maxy-miny)*0.75,maxz*0.8,10)+8;
 const fov=clamp(2*Math.atan((spread*0.5)/d)*180/Math.PI*1.35*(R3.H/Math.max(1,R3.W))*0.9+4,9,52);
 r3SetCam(pos,look,fov,cut,0.08);}
function r3ReplayCam(sc,t,cut){const b=fwAt(sc.ball,t)||{x:0,y:0,z:1};const b2=fwAt(sc.ball,Math.max(0,t-200))||b;let dx=b.x-b2.x,dy=b.y-b2.y;const dl=Math.hypot(dx,dy);if(dl<0.5){const a=((sc.c&&sc.c.a)||0)*Math.PI/180;dx=Math.sin(a);dy=Math.cos(a);}else{dx/=dl;dy/=dl;}
 const back=6+Math.min(10,t/220);const pos=r3V(b.x-dx*back,b.y-dy*back,Math.max(2.2,b.z*0.85+2.5));const look=r3V(b.x+dx*3,b.y+dy*3,Math.max(0.8,b.z*0.95));r3SetCam(pos,look,40,cut,0.2);}
/* ---- 投球の軌道（u:0→1） ---- */
function r3PitchPos(P,u,rel){const ph=phOf(P);
 if(ph){/* 物理軌道（フィールド座標）を時間で引き、リリース直後だけ実際の手の位置から滑らかにつなぐ */const q=phSample(ph.pts,clamp(u,0,1)*ph.T);const v=r3V(q.x,q.y,q.z);
  if(rel){const p0=ph.pts[0];const k=Math.max(0,1-u/0.12);v.x+=(rel.x-p0.x)*k;v.y+=(rel.y-p0.z)*k;v.z+=(rel.z+p0.y)*k;}return v;}
 const pre={x:P.x-P.bx,y:P.y-P.by};const s=P.late;const gg=u<=s?0:Math.pow((u-s)/(1-s),1.6);const zx=pre.x+(P.x-pre.x)*gg,zy=pre.y+(P.y-pre.y)*gg;
 const end=r3ZoneW(zx,zy);const st=rel||new THREE.Vector3(-P.hs*0.45,R3C.REL_H,-(R3C.RUBBER-1.9));const hump=0.22*4*u*(1-u);
 return new THREE.Vector3(st.x+(end.x-st.x)*u,st.y+(end.y-st.y)*u+hump,st.z+(end.z-st.z)*u);}
/* 打球（物理：重力＋空気抵抗＋バックスピン）：接触点から ev/la/a で飛ぶ。インプレーはフィールド演出側（fwBuildScene）が同じ物理で描く */
function r3HitPos(h,dt){const t=dt/1000;if(h.pts){const q=phSample(h.pts,t);if(t<=h.T)return r3V(q.x,q.y,q.z);const k=Math.max(0,1-(t-h.T)*0.8);const last=h.pts[h.pts.length-1];const vx=h.vx*0.45*k,vy=h.vy*0.45*k;const tt=t-h.T;return r3V(last.x+vx*tt,last.y+vy*tt,0.05+Math.abs(Math.sin(tt*9))*0.35*Math.max(0,0.5-tt)*2);}
 const g=9.8;let x=h.p0.x+h.v.x*t,y=h.p0.y+h.v.y*t-0.5*g*t*t,z=h.p0.z+h.v.z*t;if(y<0.05){const tg=h.tg;const xg=h.p0.x+h.v.x*tg,zg=h.p0.z+h.v.z*tg;const k=Math.max(0,1-(t-tg)*0.8);x=xg+h.v.x*(t-tg)*0.45*k;z=zg+h.v.z*(t-tg)*0.45*k;y=0.05+Math.abs(Math.sin((t-tg)*9))*0.35*Math.max(0,0.5-(t-tg))*2;}return new THREE.Vector3(x,y,z);}
function r3MakeHit(ev,P){const c=ev.c||{};let a=c.a||0,la=c.la==null?15:c.la,evk=(c.ev||100);const foul=ev.kind==='foul';
 if(foul){if(c.tip){a=170+gauss(0,15)*(a>=0?1:-1);la=clamp(20+Math.abs(gauss(0,25)),5,70);evk*=0.5;}else{const side=a>=0?1:-1;a=side*Math.max(Math.abs(a),58+Math.random()*25);la=clamp(la+10,-5,75);evk*=0.8;}}
 const p0=r3ZoneW(P.x,P.y);
 try{const r=phHitPath(evk,la,a,null,{x0:p0.x,y0:-p0.z,z0:p0.y});const n=r.pts.length;const l=r.pts[n-1],l2=r.pts[Math.max(0,n-3)];const dtl=Math.max(1e-3,l.t-l2.t);return {pts:r.pts,T:r.t,vx:(l.x-l2.x)/dtl,vy:(l.y-l2.y)/dtl,t0:0};}catch(e){}
 const v=(evk/3.6)*0.92;const ar=a*Math.PI/180,lr=la*Math.PI/180;const vel=new THREE.Vector3(Math.sin(ar)*Math.cos(lr)*v,Math.sin(lr)*v,-Math.cos(ar)*Math.cos(lr)*v);
 const g=9.8;const disc=vel.y*vel.y+2*g*(p0.y-0.05);const tg=(vel.y+Math.sqrt(Math.max(0,disc)))/g;return {p0,v:vel,tg,t0:0};}
/* ---- 毎フレーム ---- */
function r3Frame(now){if(!r3on())return;const m=AR.m;if(!m)return;try{
 const night=arNight();if(night!==R3.night)r3SetNight(night);
 const ph=AR.phase;const cut=(R3.lastPhase!==ph&&(ph==='field'||ph==='replay'||R3.lastPhase==='field'||R3.lastPhase==='replay'||R3.lastPhase==='half'||R3.lastPhase==='decide'||R3.lastPhase==null))||R3.lastSide!==AR.side;R3.lastSide=AR.side;
 const fieldPh=ph==='field'||ph==='decide'||ph==='replay'||(ph==='after'&&AR.field&&AR.ev&&(AR.ev.kind==='inplay'||AR.ev.runShown||/^pickoff/.test(AR.ev.kind)));
 if(ph==='intro'&&AR.intro){r3IntroScene(now);}
 else if(ph==='half'||ph==='sim'||ph==='idle'){r3IdleScene(now);r3OrbitCam(now);}
 else if(fieldPh&&AR.field){const sc=AR.field;let t;if(ph==='replay'&&AR.replay){const rp=AR.replay;t=Math.min(rp.until,rp.from+(now-rp.t0)*rp.rate);}else t=Math.min(sc.T,fwTime(sc,now));
  r3FieldScene(sc,t,now);if(ph==='replay')r3ReplayCam(sc,t,cut);else r3FieldCam(sc,t,cut,now);}
 else{r3PitchScene(now);const ev=AR.ev;const react=ph==='after'&&ev&&(ev.kind==='kSwing'||ev.kind==='kLook'||ev.kind==='kBunt')&&AR.resultAt&&now-AR.resultAt>350;if(react)r3ReactCam(R3.batter,R3.lastReact!==ev);R3.lastReact=react?ev:null;if(!react){if(AR.side==='bat')r3BatCam(cut||!!R3.lastPhaseReact);else r3PitCam(cut||!!R3.lastPhaseReact);}R3.lastPhaseReact=react;}
 R3.lastPhase=ph;
 /* 影の中心を注視点付近へ */if(R3.camLook){R3.sun.target.position.set(R3.camLook.x,0,R3.camLook.z);R3.sun.position.set(R3.camLook.x+(R3.night?40:-70),120,R3.camLook.z+(R3.night?-70:-30));}
 /* ボールの光とトレイル */{const b=R3.ball;R3.glow.visible=b.visible;if(b.visible){R3.glow.position.copy(b.position);const d=R3.cam.position.distanceTo(b.position);R3.glow.scale.setScalar(Math.max(0.16,d*0.02));const last=R3.trailP[0];if(!last||last.distanceTo(b.position)>0.08){R3.trailP.unshift(b.position.clone());if(R3.trailP.length>7)R3.trailP.length=7;}}else R3.trailP.length=0;
  R3.trailM.forEach((m,i)=>{const p=R3.trailP[i+1];m.visible=!!p&&b.visible;if(p){m.position.copy(p);const d=R3.cam.position.distanceTo(p);m.scale.setScalar(Math.max(0.6,d*0.03));}});}
 /* 歓声（観客がはねる） */{const ch=R3.cheerUntil&&now<R3.cheerUntil;const dy=ch?Math.abs(Math.sin(now/110))*0.3:0;R3.crowd.position.y=dy;R3.crowdH.position.y=dy;}
 R3.renderer.render(R3.scene,R3.cam);
 }catch(e){console.warn('3D frame error',e);r3Fail();}}
/* 試合前カットイン：相手の注目投手（マウンド）／注目野手（打席）に寄るカメラ */
function r3IntroScene(now){const m=AR.m;const it=AR.intro;const item=it.items[it.idx];const p=item.p;const opp=it.team;const other=opp===m.A?m.B:m.A;const co=arTeamColors(opp),cu=arTeamColors(other);
 const u=clamp((now-it.t0)/it.dur,0,1);const key=it.idx+':'+it.t0;const cut=R3.introKey!==key;R3.introKey=key;const e=1-Math.pow(1-u,2.2);
 const numOf=(team,k)=>{const sl=team.lineup.find(x=>x.pos===k);return sl?(sl.p.number!=null?sl.p.number:POS_NUM[k]):POS_NUM[k];};
 R3.ball.visible=false;R3.mitt.visible=false;for(const r of R3.runners)r.g.visible=false;for(const r of R3.umps)r.g.visible=false;
 if(item.kind==='pit'){const DP=fwDefPos(opp);const hs=p.throws==='左'?-1:1;const z0=-R3C.RUBBER+0.15;
  for(const k in R3.fielders){const r=R3.fielders[k];r.g.visible=true;r.setColors(co,false);r.setNumber(k==='投'?(p.number!=null?p.number:1):numOf(opp,k),co.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=k!=='捕';r3Dress(r,k==='投'?p:r3PlayerOf(opp,k));r.setExpression(null);
   if(k==='投'){r.at(0,0,z0);r.g.scale.x=hs<0?-1:1;r.face(0,1);r.setExpression(u<0.45?null:'focus');const w=Math.sin(now/1100);
    /* 前半：マウンドで立って一息（胸を張る）→後半：セットポジションで構える */const k2=clamp((u-0.42)/0.22,0,1);const kk=k2*k2*(3-2*k2);const st=Object.assign({},RP.stand);st.head=[0.0+w*0.03,0,0];st.torso=[-0.04+w*0.015,0,0];st.rSh=[0.12,0,-0.16];st.lSh=[0.12,0,0.16];const sp={rSh:[-0.62,0,-0.25],lSh:[-0.66,0,0.3],rEl:[-1.25,0,0],lEl:[-1.2,0,0],head:[0.02+w*0.04,0,0],torso:[-0.02,0,0]};/* グラブを胸の前で合わせる（顔が隠れない高さ） */const pose=kk<=0?st:kk>=1?sp:r3MixPose(st,sp,kk);pose.dy=w*0.012;r.apply(pose);continue;}
   if(k==='捕'){r.at(0,0,1.6);r.g.scale.x=1;r.face(0,-1);r.apply(RP.crouch);r.glove.visible=false;continue;}
   const q=DP[k];r.g.scale.x=1;r.at(q[0],0,-q[1]);r.face(-q[0],q[1]);r.apply(RP.ready);}
  R3.batter.g.visible=false;
  /* 投げる腕側の斜め前から寄る（グラブで顔が隠れない）。頭が画面上1/4に来るよう胸より少し上を注視 */const pos=new THREE.Vector3(-hs*(2.4-0.7*e),1.78-0.18*e,z0+3.8-1.2*e);const look=new THREE.Vector3(-hs*0.06,1.32-0.02*e,z0);r3SetCam(pos,look,31-5*e,cut,0.25);}
 else{const DP=fwDefPos(other);const op=other.pitcher;
  for(const k in R3.fielders){const r=R3.fielders[k];r.g.visible=true;r.setColors(cu,false);r.setNumber(numOf(other,k),cu.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=k!=='捕';r3Dress(r,k==='投'?op:r3PlayerOf(other,k));r.setExpression(null);
   if(k==='投'){r.at(0,0,-R3C.RUBBER+0.15);r.g.scale.x=(op&&op.throws==='左')?-1:1;r.face(0,1);r.apply(RP.pset);continue;}
   if(k==='捕'){r.g.visible=false;continue;}
   const q=DP[k];r.g.scale.x=1;r.at(q[0],0,-q[1]);r.face(-q[0],q[1]);r.apply(RP.ready);}
  const b=R3.batter;b.g.visible=true;b.setColors(co,true);b.setNumber(p.number!=null?p.number:null,co.trim);r3Dress(b,p);b.setGear(null);b.setExpression(u<0.4?null:'focus');b.bat.visible=true;
  const hand=p.bats==='両'?'左':p.bats;const sg=hand==='左'?-1:1;b.g.scale.x=sg<0?-1:1;b.at(-sg*0.86,0,0.1);b.face(sg,0);
  const w=Math.sin(now/420),w2=Math.sin(now/650);const pose=Object.assign({},RP.stance);pose.batDir=[-0.55+w*0.08,0.8,-0.3+w*0.12];pose.dy=RP.stance.dy+w2*0.015;pose.head=[0.05+w2*0.03,1.0,0];b.apply(pose);
  const pos=new THREE.Vector3(sg*(2.5-0.75*e),1.55-0.12*e,-3.2+1.05*e);const look=new THREE.Vector3(-sg*0.5,1.18-0.03*e,0.1);r3SetCam(pos,look,31-6*e,cut,0.25);}
 R3.trailP.length=0;}
/* 全員を定位置へ（ベンチ中の俯瞰など） */
function r3IdleScene(now){const m=AR.m;const d=m.def(),t=m.bat();const cd=arTeamColors(d),cb=arTeamColors(t);const DP=fwDefPos(d);
 for(const k in R3.fielders){const r=R3.fielders[k];r.g.visible=true;r.setColors(cd,false);r.setGear(k==='捕'?'catcher':null);r.glove.visible=k!=='捕';r3Dress(r,r3PlayerOf(d,k));r.setExpression(null);const p=DP[k];r.at(p[0],0,-p[1]);r.face(-p[0],p[1]);r.apply(k==='捕'?RP.crouch:RP.stand);}
 R3.batter.g.visible=false;for(const r of R3.runners)r.g.visible=false;r3PlaceUmps(true);R3.ball.visible=false;R3.mitt.visible=false;}
function r3PlaceUmps(showPlate){const U=[[0.3,-2.4],[25.5,16.5],[-25.5,16.5]];U.forEach((u,i)=>{const r=R3.umps[i];r.g.visible=i>0||showPlate;r.at(u[0],0,-u[1]);if(i===0){r.face(0,-1);r.apply(RP.umpire);}else{r.face(-u[0],u[1]-18.4);r.apply(RP.ready);}});}
/* 選手ごとの個性・汚れ・表情 */
function r3Seed(p){if(!p)return 0;const s=String(p.id||p.name||'');let h=7;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;return h;}
function r3Dirt(p){if(!p)return 0;AR.dirt=AR.dirt||{};const k=p.id||p.name;if(AR.dirt[k]==null){AR.dirt[k]=0.08+(r3Seed(p)%100)/100*0.22;}return AR.dirt[k];}
function r3AddDirt(pid,amt){AR.dirt=AR.dirt||{};AR.dirt[pid]=Math.min(1,(AR.dirt[pid]==null?0.15:AR.dirt[pid])+amt);}
function r3Dress(r,p,gear){r.setPerson(r3Seed(p));r.setDirt(r3Dirt(p));}
function r3PlayerOf(team,k){const sl=team.lineup.find(x=>x.pos===k);return sl?sl.p:null;}
/* 投球／打撃のシーン */
function r3PitchScene(now){const m=AR.m;const d=m.def(),t=m.bat();const cd=arTeamColors(d),cb=arTeamColors(t);const pa=m.pa;const P=AR.cur;const ph=AR.phase;const S=actionSettings();
 const hand=pa&&(AR.mode!=='card'||ph!=='pre')?pa.bHand:(AR.preHand||'右');const sg=hand==='左'?-1:1;const hs=pa?(pa.p.throws==='左'?-1:1):(P?P.hs:1);
 const DP=fwDefPos(d);
 /* 野手 */const numOf=(team,k)=>{const sl=team.lineup.find(x=>x.pos===k);return sl?(sl.p.number!=null?sl.p.number:POS_NUM[k]):POS_NUM[k];};const pidNum=(team,pid)=>{const pl=team.lineup.map(x=>x.p).concat(team.bench||[]).find(x=>x.id===pid);return pl?(pl.number!=null?pl.number:null):null;};
 const ev0=AR.ev;const kOut=ph==='after'&&ev0&&(ev0.kind==='kSwing'||ev0.kind==='kLook'||ev0.kind==='kBunt');
 for(const k in R3.fielders){const r=R3.fielders[k];r.setColors(cd,false);r.setNumber(numOf(d,k),cd.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=k!=='捕';const p=DP[k];r3Dress(r,k==='投'?(pa?pa.p:d.pitcher):r3PlayerOf(d,k));
  r.setExpression(k==='投'?(kOut?((r3Seed(pa?pa.p:d.pitcher)%2)?'smile':'grit'):(ph==='wind'||ph==='flight'||ph==='gauge')?'focus':null):(k==='捕'&&(ph==='wind'||ph==='flight'))?'focus':null);
  if(k==='投'){r.at(0,0,-R3C.RUBBER+0.15);r.g.scale.x=hs<0?-1:1;r.face(0,1);r.g.visible=true;
   const windDur=arWindDur();let pose;const form=r3PitForm(pa?pa.p:d.pitcher);const stretch=m.bases.some(Boolean);
   if(ph==='wind'&&AR.windT0){const u=(now-AR.windT0)/windDur;pose=r3ClipPose((stretch?'stretch_':'windup_')+form,u);}
   else if((ph==='flight'||ph==='after')&&AR.windT0&&AR.cur){const u=(now-AR.windT0-windDur)/520;pose=u<1?r3ClipPose('pfollow_'+form,u):RP.ready;}
   else{const w=Math.sin(now/1100);const base=stretch?RP.pset2:RP.pset;pose=Object.assign({},base);pose.dy=w*0.012;pose.head=[(base.head?base.head[0]:0.05)+w*0.04,base.head?base.head[1]:0,0];pose.torso=[w*0.02,0,0];}r.apply(pose);continue;}
  if(k==='捕'){r.at(0,0,1.6);r.g.scale.x=1;r.face(0,-1);r.g.visible=!(AR.side==='bat'&&S.cam3d!=='wide');const cp=Object.assign({},RP.crouch);cp.dy=RP.crouch.dy+Math.sin(now/900)*0.02;r.apply(cp);r.glove.visible=false;continue;}
  r.g.scale.x=1;r.g.visible=true;r.at(p[0],0,-p[1]);r.face(-p[0],p[1]);const rp=Object.assign({},RP.ready);rp.dy=RP.ready.dy+Math.sin(now/700+k.charCodeAt(0))*0.02;r.apply(rp);}
 /* 打者 */{const b=R3.batter;b.g.visible=true;b.setColors(cb,true);b.setNumber(pa?(pa.b.number!=null?pa.b.number:null):null,cb.trim);if(pa)r3Dress(b,pa.b);b.setGear(null);
  b.setExpression(kOut?'sad':(ph==='after'&&ev0&&ev0.kind==='inplay'&&ev0.bb&&['1B','2B','3B','HR'].includes(ev0.bb.res))?'shout':(ph==='wind'||ph==='flight')?'focus':null);b.bat.visible=true;b.g.scale.x=sg<0?-1:1;b.at(-sg*0.86,0,0.1);b.face(sg,0);
  const bunt=pa&&(pa.buntMode||(pa.bm&&pa.bm.bunt)||pa.cmd==='squeeze')||(AR.side==='bat'&&AR.mode!=='card'&&AR.swingType==='bunt');
  let pose;const ev=AR.ev;const kO=ph==='after'&&ev&&(ev.kind==='kSwing'||ev.kind==='kLook'||ev.kind==='kBunt')&&now-AR.resultAt>500;
  if(kO)pose=RP.kDown;else if(AR.swung&&AR.swingT&&(ph==='flight'||ph==='after')){const isBunt=AR.swing&&AR.swing.type==='bunt';if(isBunt)pose=RP.bunt;else{const u=(now-AR.swingT+111*AR.speed)/(300*AR.speed);pose=r3ClipPose('swing',u);}}
  else if(bunt&&(ph==='flight'||ph==='wind'))pose=RP.bunt;else{/* 構え：バットを揺らす・膝でリズム */const w=Math.sin(now/420),w2=Math.sin(now/650);pose=Object.assign({},RP.stance);pose.batDir=[-0.55+w*0.08,0.8,-0.3+w*0.12];pose.dy=RP.stance.dy+w2*0.015;pose.head=[0.05+w2*0.03,1.0,0];}b.apply(pose);}
 /* 走者 */{const B=m.bases;let n=0;for(let i=0;i<3;i++){if(!B[i])continue;const r=R3.runners[n++];r.g.visible=true;r.setColors(cb,true);r.setGear(null);r.setNumber(B[i].number!=null?B[i].number:null,cb.trim);r3Dress(r,B[i]);r.setExpression(null);r.bat.visible=false;r.glove.visible=false;r.g.scale.x=1;const A=FW_BASE[i+1],Nx=FW_BASE[i+2];const lead=3.2;const L=Math.hypot(Nx[0]-A[0],Nx[1]-A[1]);const x=A[0]+(Nx[0]-A[0])/L*lead,y=A[1]+(Nx[1]-A[1])/L*lead;r.at(x,0,-y);r.face(-x,y-18.4);r.apply(RP.ready);}
  for(let i=n;i<4;i++)R3.runners[i].g.visible=false;}
 r3PlaceUmps(AR.side!=='bat');
 /* ミットの目標 */let mittT;if(AR.side==='pit'&&ph==='pre'&&AR.target)mittT=r3ZoneW(AR.target.x,AR.target.y);else if(AR.sign&&AR.side==='pit')mittT=r3ZoneW(AR.sign.tx,AR.sign.ty);else mittT=r3ZoneW(0,0.3);
 mittT.z=0.3;R3.mitt.visible=true;
 /* ボール */const ball=R3.ball;const pit=R3.fielders['投'];
 if(ph==='wind'&&AR.windT0){pit.g.updateMatrixWorld(true);ball.position.copy(pit.handPos('r'));ball.visible=true;const u=(now-AR.windT0)/arWindDur();if(u>=0.95)R3.relPos=ball.position.clone();R3.hit=null;R3.mitt.position.lerp(mittT,0.2);}
 else if((ph==='flight'||ph==='after')&&P&&AR.t0){const T=P.T*AR.speed;const u=(now-AR.t0)/T;const ev=AR.ev;const tc=AR.swingT!=null?AR.swingT+75*AR.speed:null;const hit=!!(ev&&AR.swung&&tc!=null&&(ev.kind==='inplay'||ev.kind==='foul')&&now>=tc);
  if(hit){if(!R3.hit||R3.hit.ev!==ev){R3.hit=r3MakeHit(ev,P);R3.hit.ev=ev;R3.hit.tc=tc;}ball.position.copy(r3HitPos(R3.hit,now-R3.hit.tc));ball.visible=true;R3.mitt.position.lerp(mittT,0.1);}
  else if(u<1){ball.position.copy(r3PitchPos(P,u,R3.relPos));ball.visible=true;const tgt=r3ZoneW(P.x,P.y);tgt.z=0.3;if(u>0.75)R3.mitt.position.lerp(tgt,0.25);else R3.mitt.position.lerp(mittT,0.1);}
  else{const tgt=r3ZoneW(P.x,P.y);tgt.z=0.3;R3.mitt.position.lerp(tgt,0.4);ball.position.copy(R3.mitt.position);ball.position.z-=0.08;ball.visible=!(ev&&(ev.kind==='hbp'));}}
 else{ball.visible=false;R3.hit=null;R3.mitt.position.lerp(mittT,0.1);}}
/* フィールドプレーのシーン */
function r3FieldScene(sc,t,now){const m=AR.m;const cd=sc.colDef||arTeamColors(m.def()),cb=sc.colBat||arTeamColors(m.bat());const b=fwAt(sc.ball,t);const dT=sc.defTeam||m.def(),bT=sc.batTeam||m.bat();
 const numOf=(team,k)=>{const sl=team.lineup.find(x=>x.pos===k);return sl?(sl.p.number!=null?sl.p.number:POS_NUM[k]):POS_NUM[k];};const pidNum=(team,pid)=>{const pl=team.lineup.map(x=>x.p).concat(team.bench||[]).find(x=>x.id===pid);return pl&&pl.number!=null?pl.number:null;};
 for(const k in R3.fielders){const r=R3.fielders[k];const f=sc.fielders[k];r.setColors(cd,false);r.setNumber(numOf(dT,k),cd.trim);r.setGear(k==='捕'?'catcher':null);r.glove.visible=k!=='捕';r.g.scale.x=1;r.bat.visible=false;if(!f){r.g.visible=false;continue;}r.g.visible=true;r3Dress(r,r3PlayerOf(dT,k));r.setExpression(null);
  const p=fwAt(f.path,t);const prev=fwAt(f.path,t-80);r.at(p.x,0,-p.y);
  let pose=fwPoseAt(f,t);const moving=p.moving&&(Math.abs(p.x-prev.x)>0.02||Math.abs(p.y-prev.y)>0.02);
  if(moving){r.face(p.x-prev.x,-(p.y-prev.y));}else if(b){r.face(b.x-p.x,-(b.y-p.y));}
  if(moving&&(pose==='stand'||pose==='run'||pose==='ready'))r.apply(r3RunPose(now/75+(k.charCodeAt(0)%7),1));
  else if(pose==='throw'){const e=f.pose.filter(q=>q.p==='throw'&&q.t<=t).pop();const u=e?(t-e.t)/520:1;r.apply(u<1?r3ClipPose('throw',u):RP.stand);}
  else if(pose==='catchHigh'||pose==='catchLow'){const e=f.pose.filter(q=>q.p===pose&&q.t<=t).pop();const u=e?(t-e.t)/220:1;r.apply(r3ClipPose(pose,u));}
  else if(pose==='lookUp')r.apply(RP.lookUp);else if(pose==='dive')r.apply(RP.catchLow);
  else r.apply(t<(sc.Tpick||0)?RP.ready:RP.stand);}
 /* 走者 */let n=0;for(const rr of sc.runners){const p=fwAt(rr.path,t);const prev=fwAt(rr.path,t-80);const outT=rr.outAt?rr.outAt.t:null;const isOut=outT!=null&&t>=outT;const last=rr.path[rr.path.length-1];const sliding=rr.slide&&t>last.t-320&&t<last.t+800;const done=!p.moving&&t>last.t+50;
  if(rr.scored&&done&&!rr.trot&&t>last.t+300)continue;if(isOut&&t>outT+1400)continue;if(n>=4)break;const r=R3.runners[n++];r.g.visible=true;r.setColors(cb,true);r.setNumber(pidNum(bT,rr.pid),cb.trim);r.setGear(null);{const pl=bT.lineup.map(x=>x.p).concat(bT.bench||[]).find(x=>x.id===rr.pid);if(pl)r3Dress(r,pl);}r.setExpression(rr.scored&&done?'shout':(sliding?'grit':null));r.bat.visible=false;r.glove.visible=false;r.g.scale.x=1;
  const moving=p.moving&&(Math.abs(p.x-prev.x)>0.02||Math.abs(p.y-prev.y)>0.02);if(moving)r.face(p.x-prev.x,-(p.y-prev.y));
  r.at(p.x,0,-p.y);if(sliding){r.apply(RP.slide);if(!rr._dirt){rr._dirt=true;r3AddDirt(rr.pid,0.25);}}else if(moving)r.apply(r3RunPose(now/(rr.trot?110:70),rr.trot?0.7:1));else if(rr.scored&&done)r.apply(RP.celebrate);else r.apply(RP.stand);}
 for(let i=n;i<4;i++)R3.runners[i].g.visible=false;
 R3.batter.g.visible=false;r3PlaceUmps(true);R3.mitt.visible=false;
 /* 審判のジェスチャーと観客の歓声 */for(const cl of sc.callouts){const dt=t-cl.t;if(dt<0||dt>1000)continue;if(cl.kind==='out'||cl.kind==='safe'){const ui=cl.y<6&&Math.abs(cl.x)<6?0:(cl.x>=0?1:2);const u=R3.umps[ui];u.face(cl.x-u.g.position.x,-cl.y-u.g.position.z);u.apply(cl.kind==='out'?RP.outCall:RP.safeCall);}
  if(cl.kind==='hr'||cl.kind==='score')R3.cheerUntil=Math.max(R3.cheerUntil||0,now+2200);}
 if(b&&t<=sc.T){R3.ball.visible=true;R3.ball.position.set(b.x,Math.max(0.06,b.z),-b.y);}else R3.ball.visible=false;}
