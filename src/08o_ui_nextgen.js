/* Next-gen extension: original procedural assets, live controls, opt-in realistic physics. */
const NGCore=(function ngCoreFactory(){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function random(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
 function stick(x,y,dead=.19){x=Number.isFinite(x)?x:0;y=Number.isFinite(y)?y:0;const len=Math.hypot(x,y);if(len<=dead)return [0,0];const k=Math.min(1,(len-dead)/(1-dead))/len;return [x*k,y*k];}
 function wall(pts,r,h=3.2){for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],ra=Math.hypot(a.x,a.y),rb=Math.hypot(b.x,b.y);if(ra<r&&rb>=r){const u=(r-ra)/(rb-ra);const z=a.z+(b.z-a.z)*u;return {z,cleared:z-.0366>h};}}return null;}
 function groundTail(pts,roll,scale=1){
  const last=pts[pts.length-1],prev=pts[pts.length-2];if(!last||!prev)return [];
  const dt=Math.max(.001,(last.t-prev.t)/(1000*scale)),vx=(last.x-prev.x)/dt,vy=(last.y-prev.y)/dt;
  const hs=Math.hypot(vx,vy);let ux=0,uy=1;if(hs>.001){ux=vx/hs;uy=vy/hs;}
  const r=.0366,v=clamp(hs*.5,4,17),dist=clamp(roll,1,16),decel=v*v/(2*dist),duration=v/decel;
  let z=r,vz=clamp(-(last.z-prev.z)/dt*.32,0,4.4),t=0;const out=[];
  const n=Math.ceil(duration/.008);
  for(let i=1;i<=n;i++){const nt=duration*i/n,d=nt-t;t=nt;vz-=9.81*d;z+=vz*d;if(z<r){z=r;vz=vz<-.45?-vz*.32:0;}
   if(i%6===0||i===n){const s=v*t-.5*decel*t*t;out.push({t:last.t+t*1000*scale,x:last.x+ux*s,y:last.y+uy*s,z:i===n?r:Math.max(r,z)});}}
  return out;
 }
 return {clamp,hash,random,stick,wall,groundTail};
})();
(function ngInstall(){
 const C=NGCore, state={pad:null,buttons:[],last:0,quality:1.5,avg:16.7,check:0,env:new WeakMap()};
 const oldSettings=actionSettings;
 actionSettings=function(){const s=oldSettings();if(!['auto','low','high'].includes(s.ngQuality))s.ngQuality='auto';if(s.ngPad==null)s.ngPad=true;if(s.ngRealBall==null)s.ngRealBall=true;if(s.ngRealTime==null)s.ngRealTime=false;if(s.ngPhysics==null)s.ngPhysics=false;if(s.ngScenery==null)s.ngScenery=true;return s;};
 const live=m=>AR.m===m&&AR.mode!=='card'&&AR.el&&!AR.el.hidden&&['pre','gauge','wind','flight'].includes(AR.phase);
 function environment(m){
  if(!m)return {wind:[0,0,0],cloud:0,seed:1};
  let e=state.env.get(m);if(e)return e;
  const name=t=>String(t&&((t.school&&t.school.name)||t.name||t.id)||'');
  const seed=C.hash(name(m.A)+'|'+name(m.B)+'|'+(AR.ctx&&AR.ctx.kind||'practice')+'|'+(G.date&&JSON.stringify(G.date)||''));
  const rand=C.random(seed),a=rand()*Math.PI*2,v=.8+rand()*3.4;
  e={seed,wind:[Math.sin(a)*v,Math.cos(a)*v,0],cloud:Math.floor(rand()*3)};state.env.set(m,e);return e;
 }
 const oldThrow=Match.prototype.throwPitch;
 Match.prototype.throwPitch=function(inp){const p=oldThrow.call(this,inp);if(live(this)&&actionSettings().ngRealTime){const path=phOf(p);if(path&&Number.isFinite(path.T))p.T=Math.round(C.clamp(path.T*1000,300,850));}return p;};
 const oldContact=Match.prototype.contact;
 Match.prototype.contact=function(be,pe,P,sw,hand){const c=oldContact.call(this,be,pe,P,sw,hand);if(c.kind==='inplay'&&live(this)&&actionSettings().ngPhysics){c.ngPhysics=true;c.ngWind=environment(this).wind.slice();c.ngStart={x0:(P.x||0)*.25,y0:.4,z0:.8-(P.y||0)*.3};}return c;};
 // Match.battedBall calls this helper when physical-flight mode is active.
 window.ngCarry=function(c,fence){
  if(!c.ngPhysics||!Number.isFinite(c.ev)||!Number.isFinite(c.la))return null;
  try{const start=c.ngStart||{};const path=phHitPath(c.ev,c.la,c.a,null,Object.assign({},start,{wind:c.ngWind}));const wall=C.wall(path.pts,fence);
   return {dist:wall&&!wall.cleared?Math.min(path.d,fence-.5):path.d,hr:!!(wall&&wall.cleared),wall:!!(wall&&!wall.cleared)};
  }catch(e){return null;}
 };
 window.ngGroundTail=(pts,roll,s)=>C.groundTail(pts,roll,s);
 window.ngDpr=function(){const s=actionSettings(),d=window.devicePixelRatio||1;return Math.min(d,s.ngQuality==='low'?1:s.ngQuality==='high'?2:state.quality);};
 function quality(now){
  const s=actionSettings(),dt=state.last?now-state.last:16.7;state.last=now;
  if(dt>0&&dt<250)state.avg=state.avg*.96+dt*.04;
  if(s.ngQuality==='auto'&&now-state.check>2400&&['pre','half','idle'].includes(AR.phase)&&!AR.panel){
   state.check=now;const next=state.avg>34?Math.max(.8,state.quality-.2):state.avg<19?Math.min(1.5,state.quality+.1):state.quality;
   if(Math.abs(next-state.quality)>.04){state.quality=next;r3Resize(AR.W,AR.H);}
  }
 }
 function resetPad(){state.pad=null;state.buttons=[];state.padT=0;}
 function pressPrimary(){
  if(AR.phase==='pre'&&AR.side==='bat'){AR.holdStart=false;arThrowCpu();}
  else if(AR.phase==='pre'&&AR.side==='pit'){ACT.arThrowBtn();}
  else if(AR.phase==='flight'&&AR.side==='bat')arSwing();
  else if(AR.phase==='gauge')arRelease();
  else if(['after','field','replay','half','intro','cer'].includes(AR.phase))arKey({key:' ',preventDefault(){}});
 }
 window.ngPollGamepad=function(now){
  try{
   if(!actionSettings().ngPad||AR.mode==='card'||!AR.el||AR.el.hidden||document.hidden){resetPad();return;}
   if(!navigator.getGamepads)return;
   const pads=navigator.getGamepads(),p=Array.from(pads).find(x=>x&&x.connected&&x.mapping==='standard');
   if(!p){resetPad();return;}
   const current=p.buttons.map(b=>b.pressed||b.value>.65);
   if(state.pad!==p.index){state.pad=p.index;state.buttons=current;state.padT=now;return;}
   const dt=C.clamp((now-state.padT)/1000,0,.05);state.padT=now;
   const edge=i=>current[i]&&!state.buttons[i];state.buttons=current;
   if(AR.panel)return;
   if(AR.phase==='decide'&&AR.pending&&AR.pending.decision){const d=AR.pending.decision;if(d.kind==='throw'){
    const target=edge(1)?1:edge(3)?2:edge(2)?3:edge(0)?4:null;
    if(target!=null&&d.options.some(o=>Number(o.t)===target))ACT.arDecide({t:String(target)});
   }else if(edge(0)||edge(1))ACT.arDecide({v:edge(0)?'1':'0'});return;}
   const [x,y]=C.stick(p.axes[0],p.axes[1]);const rate=2.4;
   if(AR.side==='bat'&&['pre','wind','flight'].includes(AR.phase)&&AR.cursor&&!AR.swung){AR.cursor={x:C.clamp(AR.cursor.x+x*dt*rate,-1.9,1.9),y:C.clamp(AR.cursor.y+y*dt*rate,-1.9,1.9)};}
   else if(AR.side==='pit'&&AR.phase==='pre'){const t=AR.target||arDefaultTarget();AR.target={x:C.clamp(t.x+x*dt*rate,-1.9,1.9),y:C.clamp(t.y+y*dt*rate,-1.9,1.9)};}
   if(AR.side==='bat'&&['pre','wind','flight'].includes(AR.phase)&&!AR.swung){
    const k=edge(2)?'power':edge(1)?'bunt':edge(3)?'meet':null;
    if(k){ACT.arSwingType({k});if(AR.phase==='flight')arSwing();return;}
   }
   if(AR.side==='pit'&&AR.phase==='pre'&&(edge(4)||edge(5))){const list=AR.m.pa.p.pit.pitches;if(list.length){AR.pitchSel=(AR.pitchSel+list.length+(edge(5)?1:-1))%list.length;arRenderCtl();}return;}
   if(edge(0))pressPrimary();
  }catch(e){resetPad();}
 };
 function material(col,rough=.9){return new THREE.MeshStandardMaterial({color:col,roughness:rough});}
 function tile(){
  const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),rand=C.random(498);const image=g.createImageData(128,128);
  for(let i=0;i<128*128;i++){const n=Math.floor(95+rand()*65),j=i*4;image.data[j]=image.data[j+1]=image.data[j+2]=n;image.data[j+3]=255;}g.putImageData(image,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(72,72);return t;
 }
 function mesh(geo,mat,x,y,z,group){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;}
 function scenery(S){
  const group=new THREE.Group();group.name='NG scenery';S.add(group);const rand=C.random(8301);
  const hills=[material(0x546d61),material(0x465f4c),material(0x5a7560)];
  for(let i=0;i<15;i++){const a=(i/15)*Math.PI*2,r=245+rand()*35;const geo=new THREE.SphereGeometry(1,24,10,0,Math.PI*2,0,Math.PI*.62);const m=mesh(geo,hills[i%3],Math.sin(a)*r,-2,-Math.cos(a)*r,group);m.scale.set(50+rand()*38,23+rand()*32,48+rand()*35);}
  const count=156,stem=new THREE.InstancedMesh(new THREE.CylinderGeometry(.18,.32,1,6),material(0x59473a),count),leaf=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),material(0x587e4a),count),obj=new THREE.Object3D(),color=new THREE.Color();
  for(let i=0;i<count;i++){const a=rand()*Math.PI*2,r=166+rand()*45,h=3+rand()*5,x=Math.sin(a)*r,z=-Math.cos(a)*r;obj.position.set(x,h*.36,z);obj.scale.set(1,h*.72,1);obj.rotation.set(0,0,0);obj.updateMatrix();stem.setMatrixAt(i,obj.matrix);obj.position.y=h*.77;obj.scale.set(h*.37,h*.52,h*.34);obj.rotation.y=rand()*6.28;obj.updateMatrix();leaf.setMatrixAt(i,obj.matrix);color.setHSL(.23+rand()*.07,.24+rand()*.21,.23+rand()*.14);leaf.setColorAt(i,color);}
  stem.instanceMatrix.needsUpdate=leaf.instanceMatrix.needsUpdate=true;if(leaf.instanceColor)leaf.instanceColor.needsUpdate=true;group.add(stem,leaf);
  const walls=material(0xb4b4a4),roof=material(0x4e5860),glass=material(0x55717e,.3);
  for(const sign of [-1,1]){const x=sign*176,z=-79;mesh(new THREE.BoxGeometry(26,10,13),walls,x,5,z,group);mesh(new THREE.BoxGeometry(27,.5,14),roof,x,10.25,z,group);
   const windows=new THREE.InstancedMesh(new THREE.BoxGeometry(1.6,1.3,.08),glass,30);let k=0;
   for(let row=0;row<3;row++)for(let i=0;i<10;i++){obj.position.set(x-11.25+i*2.5,2+row*3,z+6.55);obj.scale.set(1,1,1);obj.rotation.set(0,0,0);obj.updateMatrix();windows.setMatrixAt(k++,obj.matrix);}group.add(windows);
  }
  return group;
 }
 window.ngBuildWorld=function(S){
  const R=R3;R.ngScenery=scenery(S);
  const bump=tile(),ground=R.ground.material,home=R.home.material;
  R.ground.material=new THREE.MeshStandardMaterial({map:ground.map,bumpMap:bump,bumpScale:.028,roughness:.96});
  const homeBump=bump.clone();homeBump.repeat.set(8,8);homeBump.needsUpdate=true;
  R.home.material=new THREE.MeshStandardMaterial({map:home.map,bumpMap:homeBump,bumpScale:.017,roughness:.95,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});ground.dispose();home.dispose();
  R.ball.geometry=new THREE.SphereGeometry(.075,24,16);R.ball.material.dispose();R.ball.material=new THREE.MeshStandardMaterial({color:0xf5eee1,roughness:.64,emissive:0x191919});
  const seams=new THREE.Group(),lineMat=material(0x9a342c,.88),r=.0754,pts=[];
  for(let i=0;i<96;i++){const t=i/96*Math.PI*2,p=.62*Math.sin(t*2);pts.push(new THREE.Vector3(r*Math.cos(p)*Math.cos(t),r*Math.sin(p),r*Math.cos(p)*Math.sin(t)));}
  const curve=new THREE.CatmullRomCurve3(pts,true);seams.add(new THREE.Mesh(new THREE.TubeGeometry(curve,96,.00065,4,true),lineMat));
  const stitches=new THREE.InstancedMesh(new THREE.CapsuleGeometry(.00095,.006,2,4),lineMat,36),dummy=new THREE.Object3D();
  for(let i=0;i<36;i++){const u=i/36,p=curve.getPoint(u),t=curve.getTangent(u).normalize(),normal=p.clone().normalize(),side=new THREE.Vector3().crossVectors(normal,t).normalize().addScaledVector(t,.45).normalize();dummy.position.copy(p).multiplyScalar(1.007);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),side);dummy.updateMatrix();stitches.setMatrixAt(i,dummy.matrix);}seams.add(stitches);R.ball.add(seams);R.ngSeams=seams;
  const geo=new THREE.BufferGeometry(),arr=new Float32Array(36*3);geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const dust=new THREE.Points(geo,new THREE.PointsMaterial({color:0x927c66,size:.10,transparent:true,opacity:0,depthWrite:false}));dust.frustumCulled=false;dust.visible=false;S.add(dust);R.ngDust=dust;R.ngDustEvent=null;
 };
 window.ngNight=function(night){
  if(!R3.ngScenery)return;const e=environment(AR.m);R3.ngScenery.visible=actionSettings().ngScenery;
  if(night||!actionSettings().ngScenery||e.cloud===0)return;
  const g=R3.skyCv.getContext('2d'),rand=C.random(e.seed),n=e.cloud===2?20:9;
  for(let i=0;i<n;i++){const x=rand()*1024,y=35+rand()*82,w=35+rand()*75,h=5+rand()*11;const gr=g.createRadialGradient(x,y,0,x,y,w);gr.addColorStop(0,'rgba(250,252,250,.55)');gr.addColorStop(1,'rgba(250,252,250,0)');g.save();g.translate(x,y);g.scale(1,h/w);g.translate(-x,-y);g.fillStyle=gr;g.fillRect(x-w,y-w,w*2,w*2);g.restore();}
  R3.skyTex.needsUpdate=true;
 };
 window.ngFrame=function(now){
  const R=R3;if(!R.ngSeams)return;const s=actionSettings();quality(now);
  if(R.ngScenery)R.ngScenery.visible=s.ngScenery;
  const b=R.ball;const d=R.cam.position.distanceTo(b.position);b.scale.setScalar(s.ngRealBall ? .0366/.075 : 1);
  if(b.visible){let rpm=1800,axis=[1,0,0],t=0;const P=AR.cur;
   if(P&&AR.phase==='flight'){const sp=PH_SPIN[P.name];if(sp){rpm=sp.rpm;axis=[sp.axis[0],sp.axis[2]*(P.hs||1),-sp.axis[1]];}t=Math.max(0,(now-AR.t0)/(1000*(AR.speed||1)));}
   else if(AR.field){rpm=1900;t=Math.max(0,(AR.phase==='replay'&&AR.replay?AR.replay.from+(now-AR.replay.t0)*AR.replay.rate:fwTime(AR.field,now))/1000);}
   R.ngSeams.quaternion.setFromAxisAngle(new THREE.Vector3(...axis).normalize(),t*rpm*Math.PI/30);
   if(s.ngRealBall){R.glow.visible=d>24&&AR.phase==='flight';R.glow.material.opacity=.22;if(!s.assist)R.trailM.forEach(m=>m.visible=false);}else R.glow.material.opacity=.9;
  }
  const dust=R.ngDust;if(!dust)return;
  if(AR.phase==='field'&&AR.field&&b.visible&&b.position.y<.14&&Math.hypot(b.position.x,b.position.z+18.4)<29&&R.ngDustEvent!==AR.field){R.ngDustEvent=AR.field;R.ngDustStart=now;R.ngDustCenter=b.position.clone();}
  const t=(now-(R.ngDustStart||-1e9))/1000;dust.visible=s.ngScenery&&AR.phase==='field'&&t>=0&&t<.85;
  if(dust.visible){const arr=dust.geometry.attributes.position.array,c=R.ngDustCenter;for(let i=0;i<36;i++){const a=i*2.39996,rad=(.05+i*.007)*t*2.3;arr[i*3]=c.x+Math.sin(a)*rad;arr[i*3+1]=.04+Math.max(0,.5*t-t*t*.45)*(1+i%4*.18);arr[i*3+2]=c.z+Math.cos(a)*rad;}dust.geometry.attributes.position.needsUpdate=true;dust.material.opacity=.32*(1-t/.85);}
 };
 window.ngHud=function(now){
  if(!AR.cur||!['flight','after'].includes(AR.phase)||AR.panel||AR.mode==='card')return;
  const P=AR.cur,sp=PH_SPIN[P.name];if(!sp)return;const g=AR.g;g.save();g.font='600 11px sans-serif';g.textAlign='left';g.textBaseline='top';g.fillStyle='rgba(15,24,32,.74)';g.fillRect(8,8,144,35);g.fillStyle='#f4f5f1';g.fillText(P.name+'  '+P.v+' km/h',15,13);g.fillStyle='#c5d7d3';g.fillText('回転モデル '+sp.rpm+' rpm',15,28);g.restore();
 };
 const oldMenu=ACT.arMenu;
 ACT.arMenu=function(){oldMenu();if(AR.mode==='card'||typeof AR.panel!=='string')return;const s=actionSettings();
  const select=(k,label,options)=>'<label class="f">'+label+'<select data-chg="arSet" data-k="'+k+'">'+options.map(([v,t])=>'<option value="'+v+'"'+(String(s[k]===true?'1':s[k]===false?'0':s[k])===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>';
  const toggle=(k,l,y,n)=>select(k,l,[['1',y],['0',n]]);
  const extra='<div class="grid2 small" style="margin-top:8px">'+select('ngQuality','3D描画品質',[['auto','自動（FPS調整）'],['high','高画質'],['low','軽量']])+toggle('ngPad','ゲームパッド','有効','無効')+toggle('ngRealBall','ボール表示','実寸・縫い目','視認性優先')+toggle('ngRealTime','投球速度','実時間（上級）','従来（操作補助）')+toggle('ngPhysics','打球の飛距離','空力・風・フェンス','従来バランス')+toggle('ngScenery','背景・土煙','表示','非表示')+'</div><p class="tiny muted">パッド：左スティックで狙い／Aで開始・打撃・リリース、X強振、Bバント、Yミート、LB/RB球種。送球選択 A本塁・B一塁・Y二塁・X三塁。物理モードはライブ操作の打球のみ。</p>';
  AR.panel=AR.panel.replace('</div><div class="wrap" style="margin-top:6px">','</div>'+extra+'<div class="wrap" style="margin-top:6px">');arRenderCtl();
 };
 const oldSet=CHG.arSet;
 CHG.arSet=function(d,el){if(!['ngQuality','ngPad','ngRealBall','ngRealTime','ngPhysics','ngScenery'].includes(d.k))return oldSet(d,el);const s=actionSettings();if(d.k==='ngQuality'){if(!['auto','low','high'].includes(el.value))return;s.ngQuality=el.value;state.quality=1.5;if(r3on())r3Resize(AR.W,AR.H);}else s[d.k]=el.value==='1';if(d.k==='ngScenery'&&r3on())r3SetNight(arNight(),true);saveGame();};
 const oldStart=startActionUI;
 startActionUI=function(){resetPad();state.last=0;state.avg=16.7;state.check=0;state.quality=1.5;return oldStart();};
})();
