/* v28: venue, equipment, physique, motion, optional physics and original audio integration. */
(function installV28(){
 const C=V28Catalog,P=V28Physics,cl=P.clamp;
 const state={venue:null,group:null,caps:null,body:new WeakMap(),audio:new Map(),soundN:0,field:null,fieldT:0,lastStep:0};
 const previousSettings=actionSettings;
 actionSettings=function(){const s=previousSettings();if(s.v28Body==null)s.v28Body=true;if(s.v28Motion==null)s.v28Motion=true;if(s.v28Physics==null)s.v28Physics=false;if(s.v28Audio==null)s.v28Audio=true;if(s.v28Venue!=='auto'&&!C.venues.some(v=>v.id===s.v28Venue))s.v28Venue='auto';return s;};
 function venue(){
  const s=actionSettings();const manual=C.venues.find(v=>v.id===s.v28Venue);if(manual)return manual;
  const m=AR.m,ctx=AR.ctx||{},k=ctx.kind||'practice';
  const type=k==='practice'?'school':['district','autumnDistrict','invite1'].includes(k)?'local':['koshien','senbatsu'].includes(k)?'national':['jingu','invite2','invite3'].includes(k)?'city':'local';
  const list=C.venues.filter(v=>v.type===type);return list[C.hash((m&&m.A&&m.A.name||'')+'|'+(m&&m.B&&m.B.name||'')+'|'+k)%list.length];
 }
 function mesh(S,g,m,x,y,z){const a=new THREE.Mesh(g,m);a.position.set(x,y,z);a.receiveShadow=true;S.add(a);return a;}
 function box(S,w,h,d,c,x,y,z){return mesh(S,new THREE.BoxGeometry(w,h,d),r3Mat(c),x,y,z);}
 function board(S,v){r3BuildBoard(S);if(v.tier<2){const group=new THREE.Group(),kids=S.children.slice(-6);for(const item of kids)group.add(item);group.scale.setScalar(v.tier===0?.4:.65);group.position.z=-132.5*(1-group.scale.z);S.add(group);}}
 function customStadium(S,v){
  R3S.seats=[];R3S.dim=[];R3S.flags=[];R3.stands=[];R3.lamps=[];
  const [seat,concrete,accent]=v.palette,of=a=>FENCE(Math.min(45,Math.abs(a)));
  R3.fence=r3Ribbon(S,of,-49,49,2,0,3.2,accent);r3Ribbon(S,a=>of(a)-.015,-49,49,2,3.07,3.24,'#e6c665');
  for(const sign of [-1,1]){r3WallSeg(S,[sign*13.5,-7],[sign*75.5,65.6],2.4,accent);const x=sign*FENCE(45)*Math.SQRT1_2,z=-FENCE(45)*Math.SQRT1_2;mesh(S,new THREE.CylinderGeometry(.14,.19,18,8),r3Mat('#f5d04a'),x,9,z);}
  r3Ribbon(S,()=>18,117.4,242.6,4,0,2.6,accent);
  // Wire backstop, separate geometry from the spectator stands.
  const netPos=[];for(let a=118;a<=242;a+=2){const r=18.18,rad=a*Math.PI/180,x=r*Math.sin(rad),z=-r*Math.cos(rad);netPos.push(x,2.6,z,x,11,z);}
  for(let y=2.6;y<=11;y+=.34)for(let a=118;a<242;a+=2){const r=18.18,u=a*Math.PI/180,b=(a+2)*Math.PI/180;netPos.push(r*Math.sin(u),y,-r*Math.cos(u),r*Math.sin(b),y,-r*Math.cos(b));}
  const ng=new THREE.BufferGeometry();ng.setAttribute('position',new THREE.Float32BufferAttribute(netPos,3));S.add(new THREE.LineSegments(ng,new THREE.LineBasicMaterial({color:0x35453e,transparent:true,opacity:.33})));
  const step=(a,b,rows,zone,d0=0.4,h0=2.6)=>{if(rows<1)return;const o={h0,rise:v.tier<2?.34:.4,depth:.83,d0,tread:seat,riser:concrete,zone,seatStep:v.tier===0?2:undefined};R3.stands.push(r3Steps(S,a,b,rows,o));};
  step(118,242,v.rows,'in');step(-116,-50,Math.max(2,Math.round(v.rows*.62)),'alps');step(50,116,Math.max(2,Math.round(v.rows*.62)),'alps');step(-48,48,v.ofRows,'of',.4,3.6);
  if(v.tier>=2&&v.layout!==1)step(118,242,Math.round(v.rows*.48),'in',v.rows*.83+3,2.6+v.rows*.4+1.1);
  if(v.roof){const h=2.6+v.rows*.4+(v.tier>=2&&v.layout!==1?v.rows*.48*.4+1.1:0)+3.2,d=v.rows*.83+(v.tier>=2&&v.layout!==1?v.rows*.48*.83+3:0);
   const roof=r3Surf(S,118,242,2,a=>[Math.max(1,d*.32),h],a=>[d+3,h+1.4],accent);roof.material=new THREE.MeshStandardMaterial({color:0xb5bdbe,roughness:.53,metalness:.35,side:THREE.DoubleSide});
   for(let a=120;a<=240;a+=12){const r=r3Rin(a)+d+2,t=a*Math.PI/180;mesh(S,new THREE.CylinderGeometry(.15,.25,h,8),r3Mat(concrete),r*Math.sin(t),h/2,-r*Math.cos(t));}}
  board(S,v);
  for(const sign of [-1,1]){
   const bench=new THREE.Group();bench.position.set(sign*34,0,-12);bench.rotation.y=sign*-2.28;S.add(bench);
   box(bench,10,2.4,.22,accent,0,1.2,-2.1);box(bench,10.5,.23,3.2,concrete,0,2.45,-.8);box(bench,9.6,.16,.5,seat,0,.45,-1.65);for(const x of [-4.9,0,4.9])box(bench,.16,2.4,.16,concrete,x,1.2,.58);
   for(let i=0;i<3;i++){box(bench,.37,.45,.34,i===0?'#354f73':'#c9b78f',-4.4+i*.5,.23,-.7);}
  }
  const angles=v.lights===4?[-65,65,-135,135]:[-30,30,-78,78,-128,128];for(const a of angles.slice(0,v.lights)){const r=r3Rin(a)+v.rows*.83+7,u=a*Math.PI/180,x=r*Math.sin(u),z=-r*Math.cos(u),h=26+v.tier*5;
   mesh(S,new THREE.CylinderGeometry(.26,.65,h,8),r3Mat('#777f86'),x,h/2,z);const lamp=mesh(S,new THREE.BoxGeometry(7.5,3,.55),new THREE.MeshLambertMaterial({color:0x8a8f99,emissive:0x000000}),x,h+1,z);lamp.lookAt(0,0,-40);R3.lamps.push(lamp);}
  // Indoor variants have a distant high canopy, no roof collision in the field rules.
  if(v.type==='indoor'){const mat=new THREE.MeshStandardMaterial({color:v.layout===0?0xe3e8e7:v.layout===1?0xc9d6dc:0xacc4ce,roughness:.6,side:THREE.DoubleSide,transparent:true,opacity:.73});const dome=mesh(S,new THREE.SphereGeometry(150,40,20,0,Math.PI*2,0,Math.PI*.5),mat,0,9,-56);dome.scale.set(1,.5,1);for(let i=-3;i<=3;i++)box(S,.42,.42,190,'#75878b',i*32,67,-48);}
  else if(v.tier===0){for(const sign of [-1,1]){box(S,24,7,11,'#bdbbad',sign*54,3.5,13);box(S,24.6,.5,11.7,accent,sign*54,7.3,13);for(let j=0;j<8;j++)for(let row=0;row<2;row++)box(S,1.55,1.25,.08,'#526c80',sign*54-10.5+j*3,1.6+row*3,7.45);}}
  r3BuildCrowd(S);
 }
 function caps(){
  if(!R3.crowd||!R3.crowdSeed||!R3.crowd.count)return;
  const g=new THREE.SphereGeometry(.17,6,4,0,Math.PI*2,0,Math.PI*.45);g.scale(1,.65,1);g.translate(0,.81,0);
  const m=new THREE.InstancedMesh(g,new THREE.MeshLambertMaterial({color:0xe1e4de}),R3.crowd.count);m.frustumCulled=false;
  const col=new THREE.Color();for(let i=0;i<m.count;i++){const q=R3.crowdSeed[i];col.set(i%4===0?0x253848:i%4===1?0xeeeadd:i%4===2?0x8d3031:0x4e5d59);m.setColorAt(i,col);}
  R3.crowd.add(m);state.caps=m;syncCaps();
 }
 function syncCaps(){const m=state.caps,im=R3.crowd;if(!m||!im||m.count!==im.count)return;m.instanceMatrix.array.set(im.instanceMatrix.array);m.instanceMatrix.needsUpdate=true;}
 const oldLayout=r3LayoutCrowd,oldFill=r3CrowdFill;
 r3LayoutCrowd=function(){oldLayout();syncCaps();};
 r3CrowdFill=function(f){oldFill(f);syncCaps();};
 const originalStadium=r3BuildStadium;
 r3BuildStadium=function(S){
  const v=venue(),g=new THREE.Group();g.name=v.name;S.add(g);state.venue=v;state.group=g;R3.venue=v;
  R3S.flags=[];if(v.id==='national_01')originalStadium(g);else customStadium(g,v);caps();
 };
 function clearStadium(){if(!state.group)return;
  const sharedG=new Set(Object.values(R3_GEOS)),sharedM=new Set(Object.values(R3_MATS)),gs=new Set(),ms=new Set();state.group.traverse(o=>{if(o.geometry&&!sharedG.has(o.geometry))gs.add(o.geometry);for(const m of [].concat(o.material||[]))if(m&&!sharedM.has(m))ms.add(m);});
  state.group.removeFromParent();for(const g of gs)g.dispose();for(const m of ms)m.dispose();if(R3.boardTex)R3.boardTex.dispose();state.group=null;state.caps=null;
 }
 const oldStart3=r3Start;
 r3Start=function(stage){const v=venue();if(R3.scene&&state.group&&state.venue.id!==v.id){try{clearStadium();r3BuildStadium(R3.scene);}catch(e){console.warn('venue rebuild',e);return false;}}return oldStart3(stage);};
 let gearCache=null;
 function detailGear(r){
  if(!(r instanceof R3RigReal)||r._v28Gear)return;
  if(!gearCache){
   const batProfile=[[-.10,.021],[-.085,.018],[.02,.016],[.19,.017],[.28,.022],[.42,.029],[.62,.034],[.70,.033],[.738,.025],[.742,.0]].map(([y,x])=>new THREE.Vector2(x,y));
   const bat=new THREE.LatheGeometry(batProfile,32);const gripPath=[];
   for(let i=0;i<=128;i++){const t=i/128,a=t*Math.PI*18;gripPath.push(new THREE.Vector3(.0202*Math.cos(a),-.09+t*.23,.0202*Math.sin(a)));}
   const grip=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gripPath),128,.0013,4,false);
   const lacePath=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;lacePath.push(new THREE.Vector3(.088*Math.cos(a),.118*Math.sin(a),.025));}
   const lace=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lacePath,true),64,.0024,4,true);
   const laces=new THREE.MeshStandardMaterial({color:0x52341f,roughness:.91});
   const gripMat=new THREE.MeshStandardMaterial({color:0x55575b,roughness:.85});
   gearCache={bat,grip,lace,laces,gripMat,metals:[0x9b9fa3,0x343a44,0xc1a45a,0x82929d].map(color=>new THREE.MeshStandardMaterial({color,metalness:.62,roughness:.32})),leathers:[0x8b5e34,0x5a3828,0xb1814b,0x29292b].map(color=>new THREE.MeshStandardMaterial({color,roughness:.83}))};
  }
  const g=gearCache;const bat=r.bat.children.find(x=>x.isMesh);if(bat){bat.geometry=g.bat;bat.material=g.metals[0];const strip=new THREE.Mesh(g.grip,g.gripMat);r.bat.add(strip);r._v28Bat=bat;}
  const glove=r.glove.children.find(x=>x.isMesh);if(glove){const lace=new THREE.Mesh(g.lace,g.laces);r.glove.add(lace);r._v28Glove=glove;}
  r._v28Gear=true;
 }
 const oldNewRig=r3NewRig;
 r3NewRig=function(){const r=oldNewRig();try{detailGear(r);}catch(e){console.warn('gear details',e);}return r;};
 const oldDress=r3Dress;
 r3Dress=function(r,p,gear){
  oldDress(r,p,gear);if(!(r instanceof R3RigReal))return;
  const key=p?String(p.id||p.name||'')+'|'+p.height+'|'+p.weight:'default',enabled=actionSettings().v28Body;
  if(r._v28Key!==key||r._v28BodyEnabled!==enabled){r._v28Key=key;r._v28BodyEnabled=enabled;r._v28Body=enabled?C.physique(p):{x:1,y:1,z:1};const seed=C.hash(key);
   if(r._v28Bat&&gearCache)r._v28Bat.material=gearCache.metals[seed%gearCache.metals.length];if(r._v28Glove&&gearCache)r._v28Glove.material=gearCache.leathers[(seed>>>3)%gearCache.leathers.length];}
  const b=r._v28Body;r.g.scale.set((r.g.scale.x<0?-1:1)*b.x,b.y,b.z);
 };
 const oldApply=R3RigReal.prototype.apply;
 R3RigReal.prototype.apply=function(p){const b=this._v28Body;if(b)this.g.scale.set((this.g.scale.x<0?-1:1)*b.x,b.y,b.z);return oldApply.call(this,p);};
 // Stable per-player motion variations; event timing and foot channels are unchanged.
 const oldPitchClip=plPitClip;
 plPitClip=function(p){const b=oldPitchClip(p);return actionSettings().v28Motion?C.choose(b,(p&&p.id||p&&p.name||'p')+'|'+b):b;};
 const oldFrame=moFrame;
 moFrame=function(ctx,t){
  if(actionSettings().v28Motion)for(const [key,e] of Object.entries(ctx.ents||{})){
   const r=ctx.rig(key),seed=r&&r._v28Key||key;
   for(const seg of e.segs||[]){
    if(seg.k==='clip'&&!seg._v28Motion&&C.variants[seg.clip]){seg.clip=C.choose(seg.clip,seed+'|'+seg.clip);seg._v28Motion=true;}
    if(seg.k==='pose'&&!seg._v28Idle&&['r_lead','f_ready','f_stand','c_crouch'].includes(seg.pose)){
     const name={r_lead:'v28_lead',f_ready:'v28_ready',f_stand:'v28_idle',c_crouch:'v28_catcher'}[seg.pose],base=C.choose(name,seed+'|'+name),ed=seg.edit,phase=C.hash(seed)%500;
     seg.edit=function(Q,time,ent,st){if(ed)ed(Q,time,ent,st);const clip=moClip(base);if(clip){const q=moClipAt(clip,((time+phase)%clip.dur+clip.dur)%clip.dur,{});if(q.head)Q.head=q.head;if(q.torso&&Q.torso)Q.torso=Q.torso.map((x,i)=>x*.78+q.torso[i]*.22);}return Q;};seg._v28Idle=true;
    }
   }
  }
  return oldFrame(ctx,t);
 };
 const oldCer=r3CeremonyScene;
 r3CeremonyScene=function(now){oldCer(now);if(!actionSettings().v28Motion||!AR.cer||AR.cer.type!=='soil')return;for(const r of Object.values(R3.fielders)){if(!r.g.visible||!(r instanceof R3RigReal))continue;const seed=C.hash(r._v28Key||'soil');const pose=Object.assign({},r.pose||RP.crouch),t=(now-AR.cer.t0+seed%1100)/650;pose.head=[-.48+.08*Math.sin(t),.13*Math.sin(t*.6),0];r.apply(pose);}};
 function live(m){return actionSettings().v28Physics&&AR.m===m&&AR.mode!=='card'&&AR.el&&!AR.el.hidden&&['pre','gauge','wind','flight'].includes(AR.phase);}
 function fielders(m){
  const d=m.def(),D=plDefPos(d,m);
  return Object.entries(D).filter(([key])=>['投','捕','一','二','三','遊','左','中','右'].includes(key)).map(([key,pos])=>{const p=r3PlayerOf(d,key),b=p&&p.bat||{},f=Number(b.field||b.def||b.catch||55),h=Number(p&&p.height)||175;
   return {key,pos,v:P.speed(b.speed),arm:P.arm(b.arm),field:f,reach:cl(h/100+.42,1.85,2.5)};});
 }
 function calcField(m,c,be,path){
  const air=c.type!=='ground'&&c.type!=='bunt',f=P.intercept(path,fielders(m),air),r=P.speed(be.speed),first=[19.4,19.4];
  c.dist=Math.max(1,Math.round(Math.hypot(path.land.p[0],path.land.p[1])));if(!air)c.dist=Math.max(1,Math.round(Math.hypot(path.stop[0],path.stop[1])));
  if(path.hr){c.res='HR';c.fpos=fielderOf(c);return;}
  if(f.catch){c.fpos=f.catch.key;c.v28Field=f.catch;c.v28Catch=f.catch;c.res=c.type==='line'?'LO':c.type==='pop'?'PO':'FO';return;}
  if(!f.pick){c.res='1B';c.fpos=fielderOf(c);return;}
  c.fpos=f.pick.key;c.v28Field=f.pick;
  const t1=P.run(27.43,r)+.08,throw1=P.throwArrival(f.pick,first);
  if(!air&&throw1<t1-.045)c.res='GO';
  else if(P.throwArrival(f.pick,[0,38.8])>P.run(54.5,r)+.45&&air&&c.dist>64)c.res='2B';
  else c.res='1B';
  if(air&&c.dist>88&&P.throwArrival(f.pick,[-19.4,19.4])>P.run(82,r)+.45)c.res='3B';
  if(!air&&c.res==='GO'&&R()<cl(.036-(f.pick.field-50)*.0005,.008,.065))c.res='E';
 }
 const oldBatted=Match.prototype.battedBall;
 Match.prototype.battedBall=function(c,be,pe){
  const on=live(this);if(on&&!c.bunt){c.ngPhysics=true;c.ngStart=c.ngStart||{x0:0,y0:.4,z0:.95};c.ngWind=c.ngWind||[0,0,0];}
  const ret=oldBatted.call(this,c,be,pe);if(!on||c.bunt)return ret;
  try{const q=c.ngStart,start=[q.x0,q.y0,q.z0],path=P.trace(c,start,c.ngWind);c.v28Path=path;calcField(this,c,be,path);c.v28Physical=true;}catch(e){console.warn('physical play fallback',e);delete c.v28Path;delete c.v28Physical;}
  return c;
 };
 const oldBallPath=plBallPath;
 plBallPath=function(c,c0){
  if(!c.v28Physical||!c.v28Path)return oldBallPath(c,c0);
  try{
   // Use the same flight data as the result, offset by the visual contact origin (small IK differences).
   const path=c.v28Path,first=path.pts[0],delta=[c0[0]-first.x,c0[1]-first.y,0],S=FW_SPEED,pts=path.pts.map(q=>({t:q.t*1000*S,x:q.x+delta[0],y:q.y+delta[1],z:q.z}));
   pts[0]={t:0,x:c0[0],y:c0[1],z:c0[2]};
   const caught=['FO','LO','PO'].includes(c.res),land=path.land.p,stop=path.stop;
   const o={pts,air:c.type!=='ground'&&c.type!=='bunt',caught,isHR:c.res==='HR',Tland:path.land.t*1000*S,land:[land[0]+delta[0],land[1]+delta[1]],Tstop:path.T*1000*S,stop:[stop[0]+delta[0],stop[1]+delta[1]],Tc:null,Pc:null,hrCross:path.hr&&path.wall?path.wall.t*1000*S:null};
   if(caught&&c.v28Catch){o.Tc=Math.max(plS(260),c.v28Catch.t*1000*S);const f=c.v28Catch.p;o.Pc=[f[0]+delta[0],f[1]+delta[1],cl(f[2],.72,2.6)];}
   if(o.isHR){o.Tland=o.Tstop;o.land=o.stop;}
   if(!c.anim)c.anim={roll:.7,bob:.4,ang:0};
   return o;
  }catch(e){return oldBallPath(c,c0);}
 };
 const oldDef=Match.prototype.defDecision;
 Match.prototype.defDecision=function(c){const d=oldDef.call(this,c);if(!d||!c.v28Physical||!c.v28Field)return d;
  for(const o of d.options){const b=FW_BASE[o.t],runner=o.t===1?this.pa.b:this.bases[o.t===4?2:o.t-2],v=P.speed(runner&&runner.bat&&runner.bat.speed),t=P.run(o.t===1?27.43:24,v);if(b){const margin=t-P.throwArrival(c.v28Field,b);o.ok=P.probability(margin);o.sub='到達差 '+(margin>=0?'+':'')+margin.toFixed(2)+'秒';}}
  d.rec=d.options.slice().sort((a,b)=>b.ok-a.ok)[0].t;return d;
 };
 const oldRun=Match.prototype.runDecision;
 Match.prototype.runDecision=function(c){const d=oldRun.call(this,c);if(!d||!c.v28Physical||!c.v28Field)return d;
  const dest=d.kind==='third'?3:4,b=FW_BASE[dest],from=d.from+1,dist=(dest-from)*27.43-2;
  if(!b)return d;const v=P.speed(this.runnerSpeed(d.runner)),margin=P.throwArrival(c.v28Field,b)-P.run(dist,v);d.ok=P.probability(margin);d.auto=cl(d.ok-.14,.03,.94);return d;
 };
 // Original procedural audio: ten event families, twenty deterministic variants each.
 const soundDefs={hit:[.16,1800,.7],mitt:[.11,290,.52],swing:[.17,1150,.29],foul:[.14,2350,.48],dirt:[.16,460,.28],step:[.10,150,.17],slide:[.36,720,.24],base:[.12,210,.3],wall:[.21,180,.34],whistle:[.32,1600,.19]};
 function sample(a,kind,id){const key=kind+'|'+id;if(state.audio.has(key))return state.audio.get(key);const def=soundDefs[kind];if(!def)return null;
  let seed=C.hash(key),lp=0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const dur=def[0]*(.87+rnd()*.26),freq=def[1]*(.88+rnd()*.24),n=Math.floor(a.sampleRate*dur),buf=a.createBuffer(1,n,a.sampleRate),data=buf.getChannelData(0);
  for(let i=0;i<n;i++){const t=i/a.sampleRate,env=Math.exp(-t/(dur*.23)),noise=rnd()*2-1;lp=lp*.77+noise*.23;const transient=kind==='swing'||kind==='slide'?Math.sin(Math.PI*i/n):env;
   const tone=kind==='hit'||kind==='foul'?Math.sin(2*Math.PI*freq*t)*Math.exp(-t/.033)*.24+Math.sin(2*Math.PI*freq*1.83*t)*Math.exp(-t/.018)*.12:Math.sin(2*Math.PI*freq*t)*env*.21;
   data[i]=cl((kind==='whistle'?tone*2:(noise*.24+lp*.76)*transient+tone)*def[2],-1,1);}
  if(state.audio.size>=36)state.audio.delete(state.audio.keys().next().value);state.audio.set(key,buf);return buf;
 }
 function sound(kind,pan=0,vol=1){
  if(!actionSettings().v28Audio||!actionSettings().sound||!soundDefs[kind])return false;
  try{const a=imAudio();if(!a||a.state==='suspended')return false;const b=sample(a,kind,(state.soundN++)%20),src=a.createBufferSource(),gain=a.createGain();src.buffer=b;gain.gain.value=cl(vol,0,1);src.connect(gain);
   if(a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=cl(pan,-1,1);gain.connect(p);p.connect(a.destination);}else gain.connect(a.destination);src.start();return true;
  }catch(e){return false;}
 }
 const oldSound=arSound;
 arSound=function(kind){const pan=R3.ball&&R3.ball.visible?R3.ball.position.x/42:0;if(!sound(kind,pan))return oldSound(kind);};
 const oldDraw=arDraw;
 arDraw=function(now){oldDraw(now);const sc=AR.field;if(!sc||AR.phase!=='field'||sc.paused){state.field=null;return;}
  const t=fwTime(sc,now);if(state.field!==sc){state.field=sc;state.fieldT=0;state.lastStep=now;}
  if(sc.c&&sc.c.v28Path){for(const e of sc.c.v28Path.events){const et=e.t*1000*FW_SPEED;if(et>state.fieldT&&et<=t){if(e.kind==='land')sound('dirt',0,.66);if(e.kind==='wall')sound('wall',0,.85);}}}
  if(now-state.lastStep>200&&sc.runners&&sc.runners.some(r=>r.path&&r.path.length&&t>=r.path[0].t&&t<r.path[r.path.length-1].t)){state.lastStep=now;sound('step',0,.32);}
  state.fieldT=t;
 };
 const oldMenu=ACT.arMenu;
 ACT.arMenu=function(){oldMenu();if(AR.mode==='card'||typeof AR.panel!=='string')return;const s=actionSettings();
  const select=(k,label,options)=>'<label class="f">'+label+'<select data-chg="arSet" data-k="'+k+'">'+options.map(([v,t])=>'<option value="'+v+'"'+(String(s[k]===true?'1':s[k]===false?'0':s[k])===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>';
  const toggle=(k,l)=>select(k,l,[['1','有効'],['0','無効']]);
  const extra='<div class="grid2 small" style="margin-top:8px">'+toggle('v28Body','選手の身長・体重反映')+toggle('v28Motion','選手別モーション')+toggle('v28Physics','守備・走塁物理判定（試験）')+toggle('v28Audio','新しい効果音')+select('v28Venue','球場（次回3D開始時）',[['auto','大会別に自動選択'],...C.venues.map(v=>[v.id,v.name])])+'</div><p class="tiny muted">球場・500モーションは手続き生成。守備物理は試験設定。<a href="motion-nextgen.html" target="_blank" rel="noopener" style="color:#70a8ff">モーション検証</a></p>';
  AR.panel=AR.panel.replace('<div class="wrap" style="margin-top:6px">',extra+'<div class="wrap" style="margin-top:6px">');arRenderCtl();
 };
 const oldSet=CHG.arSet;
 CHG.arSet=function(d,el){if(!['v28Body','v28Motion','v28Physics','v28Audio','v28Venue'].includes(d.k))return oldSet(d,el);const s=actionSettings();if(d.k==='v28Venue'){if(el.value==='auto'||C.venues.some(v=>v.id===el.value))s.v28Venue=el.value;}else{s[d.k]=el.value==='1';if(d.k==='v28Physics'&&s.v28Physics)s.ngPhysics=true;}saveGame();};
 window.V28Runtime={venue,fielders,soundDefs,sample,detailGear,calcField};
})();
