/* v29 runtime integration. Direct controls and CCD are opt-in until device balance is validated. */
(function installV29(){
 const C=V29Collision,L=V29Live,D=V29Deform,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
 const S={live:null,keys:new Set(),touch:null,pad:{index:null,buttons:[]},last:0,acc:0,metrics:{n:0,frames:0,last:0,max:0,sum:0},lastInfo:null};
 const oldSettings=actionSettings;
 actionSettings=function(){const s=oldSettings();if(s.v29Rig==null)s.v29Rig=true;if(s.v29Mocap==null)s.v29Mocap=true;if(s.v29CCD==null)s.v29CCD=false;if(s.v29Live==null)s.v29Live=false;return s;};
 // GL model: retain the 16 game control joints and append actual weighted MakeHuman deform joints.
 const oldBuild=R3RigGL.prototype.buildBody;
 R3RigGL.prototype.buildBody=function(){oldBuild.call(this);if(GL.deform29&&actionSettings().v29Rig)try{D.attach(this,GL.deform29);}catch(e){console.warn('v29 deform rig:',e);}};
 const oldApply=R3RigGL.prototype.apply;
 R3RigGL.prototype.apply=function(p){oldApply.call(this,p);if(this._v29Rig)D.articulate(this,p);};
 function rigs(){return [].concat(Object.values(R3.fielders||{}),R3.batter||[],R3.runners||[],R3.umps||[],Object.values(PL.rigs||{}));}
 function lod(){if(!R3.cam)return;const q=actionSettings().ngQuality;const limit=q==='high'?18:q==='low'?5:10;for(const r of rigs())if(r&&r._v29Rig&&r.g.visible){const high=R3.cam.position.distanceTo(r.g.position)<limit;D.setLOD(r,high);}}
 const oldFrame=r3Frame;
 r3Frame=function(now){lod();const a=performance.now();oldFrame(now);const ms=performance.now()-a;const m=S.metrics;m.n++;m.sum+=ms;m.max=Math.max(m.max,ms);if(m.last&&now-m.last<500){m.frames++;m.frameSum=(m.frameSum||0)+now-m.last;}m.last=now;};
 const oldPitch=plPitClip;
 plPitClip=function(p){if(actionSettings().v29Mocap&&actionSettings().mocap!==false&&actionSettings().model3d!=='chibi'&&r3PitForm(p)==='over'){const a=['p_set_mc','p_set_mc2','p_set_mc3'];return a[V28Catalog.hash(String(p&&p.id||p&&p.name||''))%a.length];}return oldPitch(p);};
 const userLive=(m,P)=>m===AR.m&&AR.cur===P&&AR.mode!=='card'&&AR.el&&!AR.el.hidden&&!m.autoUntil&&['pre','gauge','wind','flight'].includes(AR.phase);
 // Same animated bat, cursor aim and event timing are used for the sweep and the displayed swing.
 function ballAt(P,t){const u=t/(P.T*AR.speed);if(u<0||u>1.085)return null;const a=r3PitchPos(P,cl(u,0,1),PL.rel||null);if(u>1){const b=r3PitchPos(P,.98,PL.rel||null);a.addScaledVector(a.clone().sub(b),(u-1)/.02);}return a.toArray();}
 function contact(P,sw,hand){
  if(!r3on()||!R3.batter||!(R3.batter instanceof R3RigReal)||!plUseMotion())return null;
  const rig=R3.batter,bs=hand==='左'?-1:1,root=[-bs*.86,-.12],yaw=bs*Math.PI/2,speed=AR.speed||1,at=AR.swingT||performance.now(),off=at-AR.t0;
  const key=rig._v28Key||String(AR.m.pa.b.id||''),use=actionSettings().v28Motion,clip=use?V28Catalog.choose('b_swing',key+'|b_swing'):'b_swing',pre=use?V28Catalog.choose('b_pre',key+'|b_pre'):'b_pre';
  const aim=[cl(sw.cx,-1.9,1.9)*R3C.ZX,.20,R3C.ZH0-cl(sw.cy,-1.9,1.9)*R3C.ZH];sw.v29Aim=aim;sw.v29Clip=clip;
  const wind=arWindDur(),rel=AR.windT0+wind,preT=wind<1000?AR.windT0:rel-1000;
  const ent={mir:bs,ts:1/speed,segs:[{k:'clip',clip:pre,t0:preT,t1:at,x:root[0],y:root[1],yaw,off:wind<1000?1000-wind:0,fade:0},{k:'clip',clip,t0:at,t1:at+1000*speed,x:root[0],y:root[1],yaw,fade:35,rate:1/speed,bat:{tc:at+75*speed,target:()=>aim}}]};
  const visible=rig.bat.visible,pose=rig.pose,position=rig.g.position.clone(),rotation=rig.g.rotation.clone(),scale=rig.g.scale.clone(),samples=[];
  try{rig.bat.visible=true;const profile=C.profile,radii=profile.map(x=>x[1]*Math.max(Math.abs(scale.x),scale.y,scale.z));const tmp=new THREE.Vector3();
   for(let dt=0;dt<=190*speed;dt+=2*speed){const t=at+dt,p=ballAt(P,off+dt);if(!p)continue;const st=moEval(ent,t);if(!st)continue;moApply(rig,st,ent,t);rig.g.updateMatrixWorld(true);const bat=profile.map(([y])=>tmp.set(0,y,0).applyMatrix4(rig.bat.matrixWorld).toArray());samples.push({t:dt/speed,p,bat});}
   const h=C.first(samples,radii);if(!h)return {hit:false,samples:samples.length};
   const path=phOf(P);if(path&&path.T>0){const k=(P.T/1000)/path.T;h.ballV=h.ballV.map(v=>v*k);}
   const impact=C.impact(h,AR.m.pa.be&&AR.m.pa.be.pow||55,sw.type==='power');if(!impact)return {hit:false,samples:samples.length,separating:true};
   return {hit:true,time:h.time,point:[h.point[0],-h.point[2],h.point[1]],normal:h.normal,batY:h.batY,gap:h.gap,impact,samples:samples.length};
  }finally{rig.bat.visible=visible;rig.g.position.copy(position);rig.g.rotation.copy(rotation);rig.g.scale.copy(scale);if(pose)rig.apply(pose);rig.g.updateMatrixWorld(true);}
 }
 const oldContact=Match.prototype.contact;
 Match.prototype.contact=function(be,pe,P,sw,hand){
  if(actionSettings().v29CCD&&userLive(this,P)&&AR.side==='bat'&&sw&&sw.type!=='bunt'){
   try{const hit=contact(P,sw,hand);if(hit){sw.v29Collision=hit;S.lastInfo=hit;
    const r={kind:'miss',d:1.5,tf:0,tw:55,rx:.2,ry:.2,v29Collision:hit};
    if(!hit.hit)return r;const x=hit.impact;Object.assign(r,{kind:x.kind,d:1-x.q,tf:1,q:x.q,ev:x.ev,la:x.la,a:x.a,powX:0,tip:x.ev<45});return r;}}
   catch(e){console.warn('v29 CCD fallback',e);}
  }
  return oldContact.call(this,be,pe,P,sw,hand);
 };
 const oldContactPoint=plContactPoint;
 plContactPoint=function(){const hit=AR.swing&&AR.swing.v29Collision;if(hit&&hit.hit)return hit.point.slice();return oldContactPoint();};
 const oldState=arPitchState;
 arPitchState=function(now){const q=oldState(now),h=AR.swing&&AR.swing.v29Collision;if(!q||!h||!h.hit)return q;const tc=AR.swingT+h.time*AR.speed;return Object.assign(q,{tc,hit:now>=tc,ts:(now-tc)/1000,uc:cl((tc-AR.t0)/(AR.cur.T*AR.speed),0,1)});};
 // Defer regular in-play result mutations until the direct-control simulation settles.
 const oldApplyPlay=Match.prototype.applyInplay;
 Match.prototype.applyInplay=function(ev,choice){
  if(!ev.v29Committed&&choice==null&&actionSettings().v29Live&&userLive(this,ev.P)&&ev.bb&&!ev.bb.bunt&&ev.bb.res!=='HR'&&Number.isFinite(ev.bb.ev)){
   const c=ev.bb,cp=ev.sw&&ev.sw.v29Collision&&ev.sw.v29Collision.hit?ev.sw.v29Collision.point:[(ev.P.x||0)*.25,.2,.8-(ev.P.y||0)*.3];
   try{const plan=typeof V32Field!=='undefined'?V32Field.get(c):null;const path=plan?plan.path:V28Physics.trace(c,cp,c.ngWind||[0,0,0]);if(path.hr){c.res='HR';c.dist=Math.round(Math.hypot(path.land.p[0],path.land.p[1]));return oldApplyPlay.call(this,ev,choice);}
    ev.v29Live=true;ev.v29Path=path;ev.decision={kind:'v29live'};this.pending=ev;return ev;
   }catch(e){console.warn('direct play fallback',e);}
  }
  return oldApplyPlay.call(this,ev,choice);
 };
 const oldFinish=Match.prototype.finishInplay;
 Match.prototype.finishInplay=function(choice){if(this.pending&&this.pending.v29Live){this.pending.v29Committed=true;this.pending.v29Live=false;}return oldFinish.call(this,choice);};
 function startLive(ev){
  const m=AR.m,c=ev.bb,d=m.def(),t=m.bat(),plan=typeof V32Field!=='undefined'?V32Field.get(c):null,f=(plan?plan.fielders:window.V28Runtime.fielders(m)).map(x=>({...x,speed:x.v,player:r3PlayerOf(d,x.key)}));
  const runners=[{id:String(m.pa.b.id),player:m.pa.b,from:0,speed:V28Physics.speed(m.pa.be.speed)}];m.bases.forEach((p,i)=>{if(p)runners.push({id:String(p.id),player:p,from:i+1,speed:V28Physics.speed(m.runnerSpeed(p))});});
  const live=L.create({path:ev.v29Path,fielders:f,runners,side:t.isUser?'bat':'pit',outs:m.outs,air:c.type!=='ground'&&c.type!=='bunt'});
  S.live={s:live,ev,m,t,d,outs:m.outs,before:m.bases.slice(),eventN:0,started:performance.now()};S.acc=0;S.last=performance.now();S.keys.clear();S.touch=null;S.pad={index:null,buttons:[]};AR.field=null;AR.pending=ev;AR.ev=ev;AR.panel=null;arHideLower();arOverlay('','');arSetPhase('v29live');arRenderTop();arRenderCtl();AR.foot='直接操作：打球と走者の位置から結果を判定';arRenderFoot();
 }
 const oldShow=arShowResult;
 arShowResult=function(ev){if(ev&&ev.v29Live&&!ev.v29Committed){try{startLive(ev);return;}catch(e){console.warn('live start fallback',e);ev.v29Live=false;ev.v29Committed=true;const m=AR.m;oldApplyPlay.call(m,ev,{send:false});m.paEnd(ev,ev.bb.res);}}return oldShow(ev);};
 function commitLive(){
  const h=S.live;if(!h)return;S.live=null;S.keys.clear();S.touch=null;const s=h.s,m=h.m,ev=h.ev,c=ev.bb,res=L.result(s),b=m.pa.b,bs=bst(h.t,b),ps=pst(h.d,m.pa.p);const before=h.outs;let kind=res.res;
  if(res.catch)kind=c.type==='line'?'LO':c.type==='pop'?'PO':'FO';
  const n=Math.min(3-before,res.outs.length);bs.pa++;bs.ab++;
  if(['1B','2B','3B'].includes(kind)){bs.h++;ps.h++;if(kind==='2B')bs.d++;if(kind==='3B')bs.tr++;}
  if(res.catch&&res.scored.length&&before+n<3)bs.ab=Math.max(0,bs.ab-1);
  m.scoredNow=[];m.outNow={};for(const q of res.scored){m.scoreRun(q.player,b,!res.third||!res.third.force);}
  for(const o of res.outs)m.outNow[o.id]=o.base;
  m.bases=res.bases.map(q=>q?q.player:null);if(n)m.outsUp(n);
  c.res=kind;c.fpos=s.events.find(e=>e.kind==='catch')?.key||c.fpos;c.dist=Math.max(1,Math.round(Math.hypot(s.path.land.p[0],s.path.land.p[1])));
  const label={GO:'ゴロアウト',FO:'フライアウト',LO:'ライナーアウト',PO:'小フライアウト',FC:'野選', '1B':'ヒット！','2B':'二塁打！','3B':'三塁打！'}[kind]||kind;
  ev.text=label+(res.scored.length?' '+res.scored.length+'得点':'')+(res.timeout?'（時間制限処理）':'');
  const record=q=>({pid:q.player.id,name:q.player.name,from:q.from,to:q.scored?4:q.out?q.outBase:q.last,outAt:q.out?q.outBase:null,speed:m.runnerSpeed(q.player)});
  const br=res.batter,rr=record(br);ev.play={res:kind,type:c.type,dist:c.dist,a:c.a,fpos:c.fpos,err:false,caught:res.catch,batter:{pid:rr.pid,name:rr.name,to:rr.to,outAt:rr.outAt,speed:rr.speed},runners:s.runners.filter(q=>q.from!==0).map(record),scored:m.scoredNow.slice(),outs:n,bunt:false,hand:m.pa.bHand};
  m.addLog(b.name+' '+ev.text,kind==='GO'||res.catch?'out':'hit');m.scoredNow=null;m.outNow=null;m.pending=null;ev.decision=null;ev.v29Committed=true;ev.v29Live=false;ev.applied=true;m.paEnd(ev,kind);
  AR.pending=null;AR.ev=ev;AR.field=null;AR.resultAt=performance.now();try{imCallResult(ev,IM.prevScore);IM.prevScore=m.score.slice();}catch(e){}
  arSetPhase('after');arOverlay(ev.text,'直接操作結果',res.catch||kind==='GO'?'out':'hit');arRenderAll();
 }
 function command(cmd){const h=S.live;if(!h)return;if(cmd==='finish'){if(L.finish(h.s))commitLive();else{AR.foot='走者が塁上に戻り、守備がボールを保持してから終了できます';arRenderFoot();}return;}L.command(h.s,cmd);arRenderCtl();}
 ACT.v29Command=d=>command(/^[1-4]$/.test(d.k)?+d.k:d.k);
 const oldCtl=arRenderCtl;
 arRenderCtl=function(){if(AR.phase!=='v29live'||!S.live)return oldCtl();const el=$('#arctl');if(!el)return;const s=S.live.s,f=L.activeF(s),r=L.activeRunner(s);el.classList.remove('card');
  const bt=(label,k,primary=false)=>'<button class="btn '+(primary?'primary ':'')+'sm" data-act="v29Command" data-k="'+k+'">'+label+'</button>';
  el.innerHTML='<div class="small" style="font-weight:700;margin:2px 0">'+(s.side==='pit'?'守備操作 '+(f?f.key:''):'走塁操作 '+(r?esc(r.player.name):''))+'　スティック／ドラッグ／WASD</div><div class="wrap">'+bt('選手切替','switch')+(s.side==='pit'?bt('ダイブ・捕球','dive')+bt('一塁','1',true)+bt('二塁','2')+bt('三塁','3')+bt('本塁','4'):bt('進塁','advance',true)+bt('帰塁','back')+bt('スライディング','slide'))+bt('プレー終了','finish')+'</div>';
 };
 const oldDown=arPointerDown,oldMove=arPointerMove,oldUp=arPointerUp;
 arPointerDown=function(e){if(AR.phase!=='v29live')return oldDown(e);S.touch={id:e.pointerId,x:e.clientX,y:e.clientY,axis:[0,0]};try{e.currentTarget.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();};
 arPointerMove=function(e){if(AR.phase!=='v29live')return oldMove(e);const q=S.touch;if(!q||q.id!==e.pointerId)return;const x=(e.clientX-q.x)/48,y=-(e.clientY-q.y)/48,n=Math.max(1,Math.hypot(x,y));q.axis=[x/n,y/n];e.preventDefault();};
 arPointerUp=function(e){if(AR.phase!=='v29live')return oldUp(e);S.touch=null;};
 document.addEventListener('pointercancel',()=>{S.touch=null;});
 const oldKey=arKey;
 arKey=function(e){if(AR.phase!=='v29live')return oldKey(e);const key=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(key)){S.keys.add(key);e.preventDefault();return;}if(e.repeat)return;const side=S.live.s.side;const map={tab:'switch',q:side==='pit'?'dive':'slide',e:side==='bat'?'advance':'dive',r:'back',' ':'finish','1':1,'2':2,'3':3,'4':4};if(key in map){e.preventDefault();command(map[key]);}};
 document.addEventListener('keyup',e=>S.keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{S.keys.clear();S.touch=null;S.pad={index:null,buttons:[]};});
 function input(){
  const k=S.keys,x=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0),y=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0);let a=S.touch?S.touch.axis:[x,y];
  try{const p=Array.from(navigator.getGamepads?navigator.getGamepads():[]).find(q=>q&&q.connected&&q.mapping==='standard');if(p){const buttons=p.buttons.map(b=>b.pressed||b.value>.65);if(S.pad.index!==p.index){S.pad={index:p.index,buttons};}else{const old=S.pad.buttons,edge=i=>buttons[i]&&!old[i];S.pad.buttons=buttons;const side=S.live.s.side;
    if(edge(4))command('switch');if(edge(5))command(side==='pit'?'dive':'slide');
    if(side==='pit'){if(edge(0))command(4);if(edge(1))command(1);if(edge(2))command(3);if(edge(3))command(2);}else{if(edge(0))command('advance');if(edge(1))command('back');if(edge(2))command('slide');if(edge(3))command('switch');}
   }const st=NGCore.stick(p.axes[0],p.axes[1]);if(Math.hypot(...st)>.03)a=[st[0],-st[1]];}else S.pad={index:null,buttons:[]};}catch(e){}
  const n=Math.max(1,Math.hypot(...a));return [a[0]/n,a[1]/n];
 }
 function drawActors(h,now){
  const s=h.s,cd=arTeamColors(h.d),cb=arTeamColors(h.t),selected=s.side==='pit'?L.activeF(s):L.activeRunner(s);
  const actorPose=(rig,a,p,bat)=>{if(!rig)return;rig.g.visible=!a.out&&!a.scored;rig.setColors(bat?cb:cd,bat);rig.setGear(!bat&&a.key==='捕'?'catcher':null);rig.bat.visible=false;rig.glove.visible=!bat;rig.setNumber(p&&p.number!=null?p.number:POS_NUM[a.key]||null,(bat?cb:cd).trim);r3Dress(rig,p);rig.at(a.x,moGround(a.x,a.y),-a.y);rig.g.rotation.y=a.facing||0;
   const move=Math.hypot(a.vx,a.vy),pose=a.diveUntil>s.t?(bat?MOPOSE.r_slide:MOPOSE.r_dive):move>.2?r3RunPose(s.t*(5+move),Math.min(1,move/5.8)):bat?MOPOSE.r_lead:MOPOSE.f_ready;rig.apply(pose||RP.stand);};
  for(const a of s.fielders)actorPose(R3.fielders[a.key],a,a.player,false);
  const br=s.runners.find(a=>a.from===0);actorPose(R3.batter,br,br.player,true);
  for(let i=0;i<R3.runners.length;i++){const a=s.runners.filter(q=>q.from!==0)[i],r=R3.runners[i];if(a)actorPose(r,a,a.player,true);else r.g.visible=false;}
  for(const r of R3.umps)r.g.visible=false;R3.mitt.visible=false;R3.ball.visible=true;R3.ball.position.set(s.ball.p[0],Math.max(.0366,s.ball.p[2]),-s.ball.p[1]);R3.ball.scale.setScalar(.0366/.075);R3.glow.visible=false;for(const o of R3.trailM)o.visible=false;
  const a=selected||{x:0,y:20},bx=s.ball.p[0],by=s.ball.p[1],spread=Math.hypot(a.x-bx,a.y-by),height=cl(23+spread*.31,23,68),cx=a.x*.78+bx*.22,cy=a.y*.78+by*.22;
  const pos=new THREE.Vector3(cx,height,-cy+height*.8),look=new THREE.Vector3(cx,0,-cy-4);r3SetCam(pos,look,48,false,.12);R3.cam.updateMatrixWorld();lod();R3.renderer.render(R3.scene,R3.cam);
 }
 function drawHUD(h){
  const g=AR.g,W=AR.W,H=AR.H,s=h.s;if(!g)return;g.setTransform(AR.dpr||1,0,0,AR.dpr||1,0,0);g.clearRect(0,0,W,H);
  const selected=s.side==='pit'?L.activeF(s):L.activeRunner(s);
  const mini=r3on(),mw=mini?Math.min(120,W*.31):W-16,mh=mini?Math.min(115,H*.28):H-55,x0=mini?W-mw-8:8,y0=mini?8:36;
  const X=x=>x0+mw*.5+x*mw/245,Y=y=>y0+mh*.92-y*mh/145;
  g.fillStyle=mini?'rgba(13,30,24,.82)':'#28543a';g.fillRect(x0,y0,mw,mh);g.strokeStyle='#deded3';g.lineWidth=1;g.beginPath();g.moveTo(X(0),Y(0));g.lineTo(X(105),Y(105));g.moveTo(X(0),Y(0));g.lineTo(X(-105),Y(105));g.stroke();
  g.strokeStyle='#e6d8b2';g.beginPath();for(const [i,b] of L.B.entries()){if(i===0)g.moveTo(X(b[0]),Y(b[1]));else g.lineTo(X(b[0]),Y(b[1]));}g.stroke();g.fillStyle='#fff';for(const b of L.B.slice(1))g.fillRect(X(b[0])-2,Y(b[1])-2,4,4);
  const point=(a,col,rad)=>{if(!a||a.out||a.scored)return;g.fillStyle=col;g.beginPath();g.arc(X(a.x),Y(a.y),rad,0,Math.PI*2);g.fill();if(a===selected){g.strokeStyle='#ffdc6a';g.lineWidth=2;g.beginPath();g.arc(X(a.x),Y(a.y),rad+3,0,Math.PI*2);g.stroke();}};
  for(const a of s.fielders)point(a,'#9cc5ff',mini?2.4:5);for(const a of s.runners)point(a,'#ff8d73',mini?3:6);g.fillStyle='#fff';g.beginPath();g.arc(X(s.ball.p[0]),Y(s.ball.p[1]),mini?2.2:4,0,Math.PI*2);g.fill();
  if(mini&&selected){const w=r3WorldToScreen(selected.x,selected.y,.05);g.strokeStyle='#ffdf70';g.lineWidth=2;g.beginPath();g.ellipse(w[0],w[1],10,5,0,0,Math.PI*2);g.stroke();}
  g.fillStyle='rgba(12,23,30,.82)';g.fillRect(8,8,Math.min(W-16,mini?190:W-16),30);g.fillStyle='#fff';g.font='bold 12px sans-serif';g.textBaseline='top';g.fillText((s.ball.mode==='held'?'捕球 '+s.ball.holder:s.ball.mode==='throw'?'送球中':s.ball.mode==='loose'?'ボールを追え':'打球飛行中')+' '+s.t.toFixed(1)+'秒　'+s.outs+'アウト',14,17);
  if(S.touch){const r=AR.cv.getBoundingClientRect(),x=S.touch.x-r.left,y=S.touch.y-r.top;g.strokeStyle='rgba(255,255,255,.65)';g.lineWidth=2;g.beginPath();g.arc(x,y,40,0,Math.PI*2);g.stroke();g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.arc(x+S.touch.axis[0]*34,y-S.touch.axis[1]*34,14,0,Math.PI*2);g.fill();}
 }
 const oldDraw=arDraw;
 arDraw=function(now){
  if(AR.phase!=='v29live'||!S.live)return oldDraw(now);
  const h=S.live,s=h.s;try{const a=input();if(!S.live)return;S.acc+=cl((now-S.last)/1000,0,.12);S.last=now;
   while(S.acc>=L.DT&&!s.done){L.step(s,a);S.acc-=L.DT;}
   if(s.done){commitLive();return;}
   for(let i=h.eventN;i<s.events.length;i++){const e=s.events[i];if(e.kind==='catch')arSound('mitt');if(e.kind==='out')arSound('out');if(e.kind==='touch')arSound('run');}if(h.eventN!==s.events.length){h.eventN=s.events.length;arRenderCtl();}
   if(r3on())try{drawActors(h,now);}catch(e){console.warn('live 3D fallback',e);r3Fail();}drawHUD(h);
  }catch(e){console.warn('live simulation fallback',e);s.done=true;commitLive();}
 };
 const oldEnd=endActionUI;
 endActionUI=function(){S.live=null;S.keys.clear();S.touch=null;return oldEnd();};
 const oldMenu=ACT.arMenu;
 ACT.arMenu=function(){if(AR.phase==='v29live'){command('finish');return;}oldMenu();if(AR.mode==='card'||typeof AR.panel!=='string')return;const s=actionSettings();const sel=(k,t)=>'<label class="f">'+t+'<select data-chg="arSet" data-k="'+k+'"><option value="1"'+(s[k]?' selected':'')+'>有効</option><option value="0"'+(!s[k]?' selected':'')+'>無効</option></select></label>';
  const extra='<div class="grid2 small" style="margin-top:8px">'+sel('v29Rig','83ボーン・高密度選手（次回リグ生成）')+sel('v29Mocap','独立実測投球')+sel('v29CCD','3Dバット衝突（試験）')+sel('v29Live','守備・走塁直接操作（試験）')+'</div><p class="tiny muted">直接操作：ドラッグ／WASD／スティック。QまたはRBでダイブ、TabまたはLBで選手切替。守備は1～4で送球、走塁はE進塁・R帰塁。既存モードも選べます。</p>';
  AR.panel=AR.panel.replace('<div class="wrap" style="margin-top:6px">',extra+'<div class="wrap" style="margin-top:6px">');arRenderCtl();
 };
 const oldSet=CHG.arSet;
 CHG.arSet=function(d,el){if(!['v29Rig','v29Mocap','v29CCD','v29Live'].includes(d.k))return oldSet(d,el);actionSettings()[d.k]=el.value==='1';if(d.k==='v29Rig'&&r3on()){R3.rigModel=null;r3RebuildRigs();}saveGame();};
 window.V29Runtime={contact,startLive,commitLive,command,state:S,lod,report:()=>({rigs:rigs().filter(r=>r&&r._v29Rig).map(r=>r._v29Rig.info),timing:{frames:S.metrics.frames,meanRenderMs:S.metrics.n?S.metrics.sum/S.metrics.n:0,maxRenderMs:S.metrics.max,fps:S.metrics.frameSum?1000*S.metrics.frames/S.metrics.frameSum:0},collision:S.lastInfo})};
})();
