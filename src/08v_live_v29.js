/* Deterministic fixed-step live fielding/baserunning: actors, possession, consecutive base touches, force/tag/appeal and scoring time. */
const V29Live=(function liveFactory(){
 const B=[[0,0],[19.395,19.395],[0,38.79],[-19.395,19.395],[0,0]],DT=1/120,cl=(x,a,b)=>Math.max(a,Math.min(b,x)),d=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),norm=(x,y)=>{const n=Math.hypot(x,y);return n>1e-8?[x/n,y/n]:[0,0];};
 function sample(pts,t){if(t<=pts[0].t)return [pts[0].x,pts[0].y,pts[0].z];if(t>=pts.at(-1).t){const p=pts.at(-1);return [p.x,p.y,p.z];}let lo=0,hi=pts.length-1;while(hi-lo>1){const m=(hi+lo)>>1;if(pts[m].t<=t)lo=m;else hi=m;}const a=pts[lo],b=pts[hi],u=(t-a.t)/(b.t-a.t);return [a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,a.z+(b.z-a.z)*u];}
 function actor(o){return Object.assign({x:0,y:0,vx:0,vy:0,speed:7,arm:30,reach:2.1,facing:0,diveUntil:0,moving:false},o);}
 function create(opt){
  const f=opt.fielders.map(x=>actor({...x,x:x.pos[0],y:x.pos[1]})),r=opt.runners.map(x=>actor({...x,x:B[x.from][0],y:B[x.from][1],last:x.from,max:x.from,target:x.from,manual:false,out:false,outBase:null,outTime:null,scored:false,scoreTime:null,return:false,safeAt:0}));
  const s={t:0,dt:DT,side:opt.side,outs:opt.outs||0,path:opt.path,fielders:f,runners:r,ball:{mode:"path",p:sample(opt.path.pts,0),prev:sample(opt.path.pts,0),holder:null,throw:null},catch:false,catchTime:null,third:null,events:[],done:false,selectedF:null,selectedR:r.find(x=>x.from===0)?.id,settle:0,throwTarget:1,land:opt.path.land.t,initial:r.map(q=>q.from),forceEnded:false,timeout:false,air:!!opt.air,assist:!!opt.assist};
  const prediction=typeof V32Core!=='undefined'?V32Core.fieldPlan(opt.path,opt.fielders.map(q=>({...q,v:q.speed||q.v})),true):null;const pick=prediction&&(prediction.catch||prediction.pick);const choice=pick?f.find(q=>q.key===pick.key):f.slice().sort((a,b)=>interceptScore(s,a)-interceptScore(s,b))[0];s.selectedF=choice?.key;s.aiPrimary=choice?.key;s.pickPlan=pick||null;
  for(const q of r)q.target=forced(s,q,q.from+1)?q.from+1:q.from;
  return s;
 }
 function activeR(s){return s.runners.filter(q=>!q.out&&!q.scored);}
 function activeF(s){return s.fielders.find(f=>f.key===s.selectedF)||s.fielders[0];}
 function activeRunner(s){return s.runners.find(r=>r.id===s.selectedR&&!r.out&&!r.scored)||activeR(s)[0];}
 function force(s,r,b){if(s.catch||s.forceEnded||b!==r.from+1||r.last>=b)return false;for(let f=0;f<r.from;f++){const q=s.runners.find(q=>q.from===f);if(!q||q.out)return false;}return true;}
 const forced=force;
 function event(s,kind,meta){s.events.push({t:s.t,kind,...meta});}
 function out(s,r,base,forceOut){if(!r||r.out||r.scored||s.outs>=3)return;r.out=true;r.outBase=base;r.outTime=s.t;r.vx=r.vy=0;s.outs++;event(s,"out",{id:r.id,base,force:forceOut});if(s.outs>=3){s.third={t:s.t,force:forceOut||r.from===0&&r.last===0};s.done=true;}if(s.selectedR===r.id)s.selectedR=activeR(s)[0]?.id;}
 function touch(s,r){
  if(r.out||r.scored)return;
  // A runner must touch consecutive bases; returning is restricted to the preceding base.
  const cur=r.last,next=cur+1,prev=cur-1;
  if(r.return&&d([r.x,r.y],B[r.from])<=.66){r.last=r.from;r.return=false;r.target=r.from;r.safeAt=s.t;event(s,"retouch",{id:r.id,base:r.from});return;}
  if(next<=4&&d([r.x,r.y],B[next])<=.66){
   if(r.return)return;
   if(next<4&&activeR(s).some(q=>q!==r&&q.last===next&&d([q.x,q.y],B[next])<.75))return;
   r.last=next;r.max=Math.max(r.max,next);r.safeAt=s.t;event(s,"touch",{id:r.id,base:next});if(r.target<=next){r.target=next;r.manual=false;}
   if(next===4){r.scored=true;r.scoreTime=s.t;r.vx=r.vy=0;event(s,"score",{id:r.id});}
  }else if(prev>=r.from&&r.target<cur&&d([r.x,r.y],B[prev])<=.66){r.last=prev;r.safeAt=s.t;event(s,"return",{id:r.id,base:prev});}
 }
 function targetVec(a,x,y){const dist=d([a.x,a.y],[x,y]);return dist<.20?[0,0]:norm(x-a.x,y-a.y);}
 function advanceActor(a,input,dt,dive=false){
  let vx=0,vy=0;const [x,y]=input||[0,0],mag=cl(Math.hypot(x,y),0,1),top=a.speed*(dive?1.18:1);if(mag>.02){const n=norm(x,y);vx=n[0]*top*mag;vy=n[1]*top*mag;}
  const dvx=vx-a.vx,dvy=vy-a.vy,len=Math.hypot(dvx,dvy),step=(dive?13:9)*dt,k=len?Math.min(1,step/len):1;a.vx+=dvx*k;a.vy+=dvy*k;
  if(Math.hypot(a.vx,a.vy)<.025)a.vx=a.vy=0;
  a.x=cl(a.x+a.vx*dt,-126,126);a.y=cl(a.y+a.vy*dt,-17,145);const speed=Math.hypot(a.vx,a.vy);a.moving=speed>.13;if(a.moving)a.facing=Math.atan2(a.vx,-a.vy);
 }
 function interceptScore(s,f){let best=1e4;for(const p of s.path.pts){if(p.t<.12||p.z>f.reach)continue;const dt=d([f.x,f.y],[p.x,p.y])/f.speed+.15;if(dt<=p.t+.14)return p.t;best=Math.min(best,p.t+dt);}return best;}
 function aimField(s,f){
  const b=s.ball;if(b.mode==="path"){
   if(s.pickPlan&&s.pickPlan.key===f.key&&s.t<=s.pickPlan.t+.35)return s.pickPlan.spot||s.pickPlan.p;
   for(let t=s.t;t<Math.min(s.path.T,s.t+3);t+=.075){const p=sample(s.path.pts,t);if(p[2]>f.reach)continue;const need=d([f.x,f.y],p)/f.speed;if(need<=t-s.t+.13)return p;}
   return sample(s.path.pts,Math.min(s.path.T,s.t+.6));
  }
  if(b.mode==="loose")return b.p;
  if(b.mode==="throw"&&b.throw.receiver===f.key)return B[b.throw.base];
  return null;
 }
 function autoTarget(s,r){
  if(r.out||r.scored)return;
  if(r.return){r.target=r.from;return;}
  if(s.catch){r.target=Math.max(r.from,r.last);return;}
  if(forced(s,r,r.from+1))r.target=Math.max(r.target,r.from+1);
  if(r.from===0&&r.last===0)r.target=1;
  if(s.air&&s.ball.mode==="path"&&s.t<s.land-.12&&r.from>0&&!forced(s,r,r.from+1))r.target=r.from;
  const p=s.ball.p,deep=Math.hypot(p[0],p[1]);
  if(!s.catch&&(s.ball.mode==="path"&&s.t>=s.land||s.ball.mode==="loose")&&deep>63&&r.last>=1&&r.last<4){
   const next=r.last+1,blocked=activeR(s).some(q=>q!==r&&q.last===next&&q.target<=next);
   if(!blocked&&deep>(r.from===0&&r.last>=2?93:65))r.target=Math.max(r.target,next);
  }
 }
 function baseCover(s,f){
  const primary=s.side==="pit"?s.selectedF:s.aiPrimary, left=["三","遊","左"].includes(primary)||primary==="中"&&s.ball.p[0]<0,second=left?"二":"遊";
  if(f.key==="投")return primary==="一"?B[1]:[0,-7];
  if(f.key==="捕")return B[4];if(f.key==="一")return B[1];if(f.key==="三")return B[3];if(f.key===second)return B[2];
  if(["二","遊"].includes(f.key)&&["左","中","右"].includes(primary)){const p=s.pickPlan?.p||s.ball.p;return [p[0]*.55,p[1]*.55+10];}
  return null;
 }
 function chooseReceiver(s,b,holder){return s.fielders.filter(f=>f!==holder).sort((a,c)=>d([a.x,a.y],B[b])-d([c.x,c.y],B[b]))[0]||holder;}
 function throwBall(s,b){
  const ball=s.ball,holder=s.fielders.find(f=>f.key===ball.holder);if(ball.mode!=="held"||!holder||b<1||b>4)return false;
  const receiver=chooseReceiver(s,b,holder),from=[holder.x,holder.y,1.1],to=[B[b][0],B[b][1],1.0],distance=d(from,to);
  if(distance<.72){basePlay(s,holder,b);return true;}
  ball.mode="throw";ball.throw={base:b,receiver:receiver.key,start:s.t+.18,end:s.t+.18+Math.max(.13,distance/holder.arm),from,to};ball.holder=null;event(s,"throw",{base:b,from:holder.key,to:receiver.key});return true;
 }
 function basePlay(s,f,b){
  if(d([f.x,f.y],B[b])>1.05)return false;
  const forcedRunner=activeR(s).find(r=>forced(s,r,b));if(forcedRunner){out(s,forcedRunner,b,true);return true;}
  const appeal=activeR(s).find(r=>r.return&&r.from===b);if(appeal){out(s,appeal,b,false);return true;}
  const tagged=activeR(s).find(r=>d([r.x,r.y],[f.x,f.y])<.95&&d([r.x,r.y],B[r.last])>.73);if(tagged){out(s,tagged,b,false);return true;}return false;
 }
 function receive(s,f,caught){
  const ball=s.ball;ball.mode="held";ball.holder=f.key;ball.throw=null;ball.p=[f.x,f.y,1.05];s.selectedF=f.key;event(s,"catch",{key:f.key,air:caught});
  if(caught&&!s.catch){s.catch=true;s.catchTime=s.t;const br=s.runners.find(r=>r.from===0);out(s,br,0,false);for(const r of activeR(s)){if(r.from===0)continue;r.return=d([r.x,r.y],B[r.from])>.66||r.last!==r.from;r.last=r.from;r.max=r.from;r.target=r.from;}}
 }
 function cycle(s){
  if(s.side==="pit"){if(s.ball.mode==="held")return;const a=s.fielders,i=a.findIndex(f=>f.key===s.selectedF);s.selectedF=a[(i+1)%a.length].key;}
  else{const a=activeR(s);if(!a.length)return;const i=a.findIndex(r=>r.id===s.selectedR);s.selectedR=a[(i+1)%a.length].id;}
 }
 function command(s,cmd){if(s.done)return;if(cmd==="switch"){cycle(s);return;}
  if(s.side==="pit"){const f=activeF(s);if(cmd==="dive"&&f){f.diveUntil=s.t+.45;event(s,"dive",{key:f.key});}if(typeof cmd==="number")throwBall(s,cmd);}
  else{const r=activeRunner(s);if(!r)return;if(cmd==="advance"&&!r.return){r.target=cl(r.last+1,1,4);r.manual=true;}if(cmd==="back"){r.target=r.return?r.from:Math.max(r.from,r.last);r.manual=true;}if(cmd==="slide"){r.diveUntil=s.t+.35;event(s,"slide",{id:r.id});}}
 }
 function aiThrow(s,f){
  if(s.t-(f.heldAt||0)<.34)return;
  const forcedR=activeR(s).filter(r=>forced(s,r,r.from+1)).map(r=>({r,b:r.from+1}));const a=forcedR.map(q=>{const tr=.18+d([f.x,f.y],B[q.b])/f.arm,rr=d([q.r.x,q.r.y],B[q.b])/q.r.speed;return {...q,margin:rr-tr};}).sort((a,b)=>b.margin-a.margin);
  if(a.length&&a[0].margin>-.12){throwBall(s,a[0].b);f.heldAt=s.t+1;return;}
  const ret=activeR(s).find(r=>r.return);if(ret&&d([ret.x,ret.y],B[ret.from])/ret.speed>.18+d([f.x,f.y],B[ret.from])/f.arm){throwBall(s,ret.from);f.heldAt=s.t+1;return;}
  const danger=activeR(s).filter(r=>r.target>r.last&&r.target<=4&&d([r.x,r.y],B[r.target])/r.speed>.18+d([f.x,f.y],B[r.target])/f.arm+.15).sort((a,b)=>b.target-a.target)[0];if(danger){throwBall(s,danger.target);f.heldAt=s.t+1;}
 }
 function settled(s){return activeR(s).every(r=>!r.return&&!forced(s,r,r.from+1)&&r.target<=r.last&&d([r.x,r.y],B[r.last])<1.05);}
 function step(s,input=[0,0]){
  if(s.done)return s;s.t+=DT;const ball=s.ball;ball.prev=ball.p.slice();
  if(ball.mode==="path"){ball.p=sample(s.path.pts,s.t);if(s.t>=s.path.T)ball.mode="loose";}
  else if(ball.mode==="throw"){const th=ball.throw;if(s.t<th.start)ball.p=th.from.slice();else{const u=cl((s.t-th.start)/(th.end-th.start),0,1);ball.p=[th.from[0]+(th.to[0]-th.from[0])*u,th.from[1]+(th.to[1]-th.from[1])*u,th.from[2]+(th.to[2]-th.from[2])*u+1.1*4*u*(1-u)];}}
  // Fielders move to an interception point, or to their cover bases. A human selected fielder is never teleported.
  if(ball.mode==="loose"&&s.side!=="pit"){s.aiPrimary=s.fielders.slice().sort((a,b)=>d([a.x,a.y],ball.p)-d([b.x,b.y],ball.p))[0]?.key;s.pickPlan=null;}
  const chosen=s.side==="pit"?activeF(s):s.fielders.find(f=>f.key===s.aiPrimary)||s.fielders[0];
  for(const f of s.fielders){
   let target=null,axis=[0,0];const human=s.side==="pit"&&f===activeF(s),held=ball.mode==="held"&&ball.holder===f.key,th=ball.throw;
   if(human)axis=input;
   else if(!held){if(th&&th.receiver===f.key)target=B[th.base];else if((ball.mode==="path"||ball.mode==="loose")&&f===chosen)target=aimField(s,f);else target=baseCover(s,f);}
   if(target)axis=targetVec(f,target[0],target[1]);advanceActor(f,axis,DT,f.diveUntil>s.t);
   if(held){ball.p=[f.x,f.y,1.1];for(let b=1;b<=4;b++)basePlay(s,f,b);for(const r of activeR(s))if(d([f.x,f.y],[r.x,r.y])<.7&&d([r.x,r.y],B[r.last])>.75)out(s,r,r.target,false);}
  }
  if(s.done)return s;
  if(ball.mode==="throw"&&ball.throw&&s.t>=ball.throw.end){const th=ball.throw,f=s.fielders.find(f=>f.key===th.receiver);if(f&&d([f.x,f.y],th.to)<1.1){receive(s,f,false);f.heldAt=s.t;basePlay(s,f,th.base);}else{ball.mode="loose";ball.throw=null;ball.p=[th.to[0],th.to[1],.0366];event(s,"loose",{});}}
  if(ball.mode==="path"||ball.mode==="loose"){
   const eligible=s.fielders.filter(f=>{const human=s.side==="pit"&&f.key===s.selectedF,reach=f.diveUntil>s.t?1.45:.78,hi=f.diveUntil>s.t?f.reach+.22:f.reach;return s.t>=(f.react||.15)&&ball.p[2]<=hi&&d([f.x,f.y],ball.p)<reach&&(human||f===chosen);}).sort((a,b)=>d([a.x,a.y],ball.p)-d([b.x,b.y],ball.p));
   if(eligible.length){const f=eligible[0],air=ball.mode==="path"&&s.t<s.land-.004&&s.air&&ball.p[2]>.25;receive(s,f,air);f.heldAt=s.t;}
  }
  if(s.done)return s;
  const selected=activeRunner(s);
  for(const r of activeR(s).sort((a,b)=>b.from-a.from)){
   const human=s.side==="bat"&&r===selected;let axis=[0,0];
   if(!human)autoTarget(s,r);
   if(human&&Math.hypot(...input)>.04){axis=input;r.manual=false;}
   else if(!human||r.manual||r.return)axis=targetVec(r,...B[cl(r.target,0,4)]);
   // The leading runner's occupied base must not be crossed by a trailing runner.
   if(r.target>r.last&&r.target<4&&activeR(s).some(q=>q!==r&&q.from>r.from&&q.last===r.target&&q.target<=q.last))axis=[0,0];
   const old=[r.x,r.y];advanceActor(r,axis,DT,r.diveUntil>s.t);
   if(r.last<4&&activeR(s).some(q=>q!==r&&q.from>r.from&&q.last===r.last+1&&d([r.x,r.y],[q.x,q.y])<.7&&d(old,[q.x,q.y])>=.7)){r.x=old[0];r.y=old[1];r.vx=r.vy=0;}
   touch(s,r);
  }
  if(ball.mode==="held"&&s.side==="bat"){const f=s.fielders.find(x=>x.key===ball.holder);if(f)aiThrow(s,f);}
  if(ball.mode==="held"&&settled(s)){s.settle+=DT;if(s.settle>(s.side==="bat"?2.5:1.25))s.done=true;}else s.settle=0;
  if(s.t>=28){
   s.timeout=true;for(const r of activeR(s)){if(r.return){r.x=B[r.from][0];r.y=B[r.from][1];r.last=r.from;r.return=false;}else if(forced(s,r,r.from+1)){out(s,r,r.from+1,true);if(s.done)break;}else{r.x=B[r.last][0];r.y=B[r.last][1];}}
   s.done=true;event(s,"timeout",{});
  }
  return s;
 }
 function finish(s){if(s.done)return true;if(s.ball.mode==="held"&&settled(s)){s.done=true;return true;}return false;}
 function result(s){
  const r=s.runners.find(r=>r.from===0),outs=s.events.filter(e=>e.kind==="out"),scored=s.runners.filter(r=>r.scored&&(!s.third||!s.third.force&&r.scoreTime<s.third.t));
  const survivors=activeR(s).filter(r=>r.last>=1&&r.last<=3).sort((a,b)=>b.from-a.from),bases=[null,null,null],unique=new Set();
  for(const q of survivors){if(!unique.has(q.last)){bases[q.last-1]=q;unique.add(q.last);}}
  const firstSafe=r&&r.max>=1,fc=outs.some(e=>e.force&&e.id!==r?.id),res=s.catch?"FO":!firstSafe?"GO":fc?"FC":r.max>=3?"3B":r.max===2?"2B":"1B";
  return {res,bases,scored,outs,third:s.third,catch:s.catch,batter:r,timeout:s.timeout};
 }
 return {B,DT,create,step,command,finish,result,activeF,activeRunner,sample,force,throwBall};
})();
