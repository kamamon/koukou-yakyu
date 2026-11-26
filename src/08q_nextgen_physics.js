/* Fixed-step baseball flight, continuous radial wall intersection, bounce, rolling resistance and arrival times. */
const V28Physics=(function simulationFactory(step,spin,fence){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),radius=.0366,dt=1/120;
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const run=(d,v,acc=5.1)=>{d=Math.max(0,d);v=Math.max(1,v);const d0=v*v/(2*acc);return d<=d0?Math.sqrt(2*d/acc):v/acc+(d-d0)/v;};
 const speed=s=>clamp(6.6+((Number(s)||55)-50)/22,5.6,8.6);
 const arm=s=>clamp(27+((Number(s)||55)-50)/8,24,36);
 function trace(c,start,wind){
  const a=clamp(Number(c.a)||0,-45,45)*Math.PI/180,la=clamp(Number(c.la)||0,-35,80)*Math.PI/180,s=clamp(Number(c.ev)||80,15,180)/3.6;
  let p=[Number(start[0])||0,Number(start[1])||0,Math.max(radius,Number(start[2])||.9)],v=[Math.sin(a)*Math.cos(la)*s,Math.cos(a)*Math.cos(la)*s,Math.sin(la)*s];
  const wm=(c.la>8?clamp(900+c.la*60,500,3200):600)*2*Math.PI/60,w=c.la>8?[Math.cos(a)*wm,-Math.sin(a)*wm,0]:[-Math.cos(a)*wm*.4,Math.sin(a)*wm*.4,0];
  const pts=[],events=[];let t=0,land=null,wall=null,hr=false,ground=false,dead=false,apex=p[2];
  const add=()=>{const q={t,x:p[0],y:p[1],z:p[2]};if(!pts.length||t>pts[pts.length-1].t+1e-8)pts.push(q);else pts[pts.length-1]=q;};
  const boundary=q=>Math.hypot(q[0],q[1])-fence(clamp(Math.atan2(q[0],q[1])*180/Math.PI,-45,45));
  add();
  for(let i=0;i<2400;i++){
   const old=p,oldv=v,wasGround=ground;
   if(ground){const h=Math.hypot(v[0],v[1]);if(h<.12){dead=true;break;}const dec=Math.hypot(p[0],p[1]-18.4)<29?4.5:3.1;const k=Math.max(0,1-dec*dt/h);v=[v[0]*k,v[1]*k,0];p=[p[0]+(oldv[0]+v[0])*dt/2,p[1]+(oldv[1]+v[1])*dt/2,radius];}
   else{const r=step(p,v,w,dt,undefined,wind);p=r[0];v=r[1];}
   t+=dt;apex=Math.max(apex,p[2]);
   if(!hr&&boundary(old)<0&&boundary(p)>=0&&p[1]>0&&Math.abs(Math.atan2(p[0],p[1])*180/Math.PI)<=49){
    let l=0,h=1;for(let j=0;j<14;j++){const u=(l+h)/2,at=old.map((x,k)=>x+(p[k]-x)*u);if(boundary(at)>=0)h=u;else l=u;}
    const u=h,hit=old.map((x,k)=>x+(p[k]-x)*u),wt=t-dt+dt*u;const z=hit[2];
    if(z-radius>3.2&&!land){hr=true;wall={t:wt,p:hit.slice(),cleared:true};events.push({t:wt,kind:'hr'});}
    else{const n=Math.hypot(hit[0],hit[1])||1,normal=[hit[0]/n,hit[1]/n,0],vn=v[0]*normal[0]+v[1]*normal[1];v=[(v[0]-1.42*vn*normal[0])*.72,(v[1]-1.42*vn*normal[1])*.72,v[2]*.65];p=[hit[0]-.014*normal[0],hit[1]-.014*normal[1],Math.max(radius,z)];if(!wall)wall={t:wt,p:hit.slice(),cleared:false};events.push({t:wt,kind:'wall'});}
   }
   if(!wasGround&&p[2]<=radius&&v[2]<0){
    const f=clamp((old[2]-radius)/Math.max(1e-9,old[2]-p[2]),0,1);p=[old[0]+(p[0]-old[0])*f,old[1]+(p[1]-old[1])*f,radius];
    if(!land){land={t:t-dt+dt*f,p:p.slice()};events.push({t:land.t,kind:'land'});}
    if(hr){add();dead=true;break;}
    v=[v[0]*.77,v[1]*.77,-v[2]*.32];if(v[2]<.75){ground=true;v[2]=0;}
   }
   if(i%2===1||p[2]===radius||hr)add();
   if(p[1]<-8||Math.hypot(p[0],p[1])>185){dead=true;break;}
  }
  add();const last=pts[pts.length-1];return {pts,land:land||{t:last.t,p:[last.x,last.y,last.z]},wall,hr,apex,events,stop:[last.x,last.y,last.z],T:last.t,dead};
 }
 function intercept(path,fielders,air){
  let best=null,pick=null;const limit=path.land.t;
  for(const f of fielders){if(!f||!Array.isArray(f.pos))continue;const react=clamp(.29-(f.field-50)*.0018,.14,.39)+(f.key==='投'?.26:0);const prep=.14;
   for(const q of path.pts){
    if(q.t<react)continue;
    const before=q.t<limit-1e-4;if(before&&(!air||q.z<.72||q.z>clamp(f.reach||2.2,1.7,2.6)))continue;if(!before&&q.z>1.35)continue;
    const d=dist(f.pos,[q.x,q.y]),need=react+run(Math.max(0,d-.42),f.v)+prep;
    if(need>q.t)continue;
    const hit={key:f.key,t:q.t,p:[q.x,q.y,q.z],margin:q.t-need,arm:f.arm,field:f.field};
    if(before){if(!best||hit.t<best.t)best=hit;}else if(!pick||hit.t<pick.t)pick=hit;
    if(!before)break;
   }
   if(!pick||pick.t>path.T){const t=Math.max(path.T,react+run(dist(f.pos,path.stop),f.v)+prep);if(!pick||t<pick.t)pick={key:f.key,t,p:path.stop.slice(),margin:0,arm:f.arm,field:f.field};}
  }
  return {catch:best,pick};
 }
 function throwArrival(f,b){return f.t+.38+dist(f.p,b)/Math.max(10,f.arm)+.12;}
 const probability=(margin)=>clamp(.5+margin*.85,.04,.98);
 return {trace,intercept,run,speed,arm,throwArrival,probability,clamp};
})(phStep,PH_SPIN,FENCE);
