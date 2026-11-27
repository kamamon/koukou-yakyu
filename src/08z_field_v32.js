/* v32: shared continuous ball flight and arrival-based fielding. */
const V32Core=(function core(step,fence){
 const R=.0366,dt=1/240,cl=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u),dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),rad=Math.PI/180;
 const surface=p=>Math.hypot(p[0],p[1]-18.4)<=29||Math.hypot(p[0],p[1]+1)<=18||Math.hypot(p[0],p[1])>=fence(cl(Math.atan2(p[0],p[1])/rad,-45,45))-4.5?"dirt":"grass";
 const materials={dirt:{e:.48,mu:.20,roll:1.65},grass:{e:.31,mu:.29,roll:2.65}};
 function trace(c,start=[0,.2,.85],wind=[0,0,0]){
  const a=cl(Number(c.a)||0,-45,45)*rad,la=cl(Number.isFinite(c.la)?c.la:c.type==="ground"?-5:30,-50,85)*rad,s=cl(Number(c.ev)||80,5,185)/3.6;
  let p=[Number(start[0])||0,Number(start[1])||0,Math.max(R,Number(start[2])||.85)],v=[Math.sin(a)*Math.cos(la)*s,Math.cos(a)*Math.cos(la)*s,Math.sin(la)*s];
  const rpm=la>8*rad?cl(900+la/rad*60,500,3200):600,wm=rpm*2*Math.PI/60;
  let w=la>8*rad?[Math.cos(a)*wm,-Math.sin(a)*wm,0]:[-Math.cos(a)*wm*.4,Math.sin(a)*wm*.4,0],t=0,land=null,wall=null,hr=false,rolling=false,dead=false,apex=p[2],bounces=0;
  const pts=[],events=[],add=()=>{const q={t,x:p[0],y:p[1],z:Math.max(R,p[2]),vx:v[0],vy:v[1],vz:v[2]};if(pts.length&&t-pts.at(-1).t<1e-8)pts[pts.length-1]=q;else pts.push(q);};
  const boundary=q=>Math.hypot(q[0],q[1])+R-fence(cl(Math.atan2(q[0],q[1])/rad,-45,45));
  add();
  for(let i=0;i<8400&&!dead;i++){
   let rem=dt;
   for(let sub=0;sub<5&&rem>1e-7&&!dead;sub++){
    const mat=materials[surface(p)];let pn,vn;
    if(rolling){const speed=Math.hypot(v[0],v[1]),dec=mat.roll+.009*speed*speed;if(speed<.045){v=[0,0,0];dead=true;add();break;}const h=Math.min(rem,speed/dec),end=Math.max(0,speed-dec*h),dx=v[0]/speed,dy=v[1]/speed,d=(speed+end)*h/2;pn=[p[0]+dx*d,p[1]+dy*d,R];vn=[dx*end,dy*end,0];}
    else [pn,vn]=step(p,v,w,rem,bounces?.45:1,wind);
    let uG=2,uW=2;
    if(!rolling&&pn[2]<R&&vn[2]<0)uG=cl((p[2]-R)/Math.max(1e-10,p[2]-pn[2]),0,1);
    if(!hr&&boundary(p)<0&&boundary(pn)>=0&&pn[1]>0&&Math.abs(Math.atan2(pn[0],pn[1])/rad)<=50){let lo=0,hi=1;for(let n=0;n<14;n++){const u=(lo+hi)/2;if(boundary(mix(p,pn,u))>=0)hi=u;else lo=u;}uW=hi;}
    const u=Math.min(uG,uW,1);p=mix(p,pn,u);v=mix(v,vn,u);const advance=Math.max(1e-7,rem*u);t+=advance;rem-=advance;apex=Math.max(apex,p[2]);
    if(uW<=uG&&uW<=1){const hit=p.slice(),a=Math.atan2(p[0],p[1]);if(p[2]-R>3.2&&!land){hr=true;wall={t,p:hit,cleared:true};events.push({t,kind:"hr"});}else{const n=[Math.sin(a),Math.cos(a)],vn=v[0]*n[0]+v[1]*n[1];if(vn>0)v=[(v[0]-1.46*vn*n[0])*.86,(v[1]-1.46*vn*n[1])*.86,v[2]*.72];p[0]-=n[0]*.003;p[1]-=n[1]*.003;if(!wall)wall={t,p:hit,cleared:false};events.push({t,kind:"wall",speed:Math.hypot(...v)});w=w.map(x=>x*.65);}add();}
    else if(uG<=1){p[2]=R;const m=materials[surface(p)],down=Math.max(0,-v[2]),before=Math.hypot(...v);if(!land){land={t,p:p.slice()};events.push({t,kind:"land",surface:surface(p)});}if(hr){v=[0,0,0];dead=true;add();break;}
     const slip=[v[0]-R*w[1],v[1]+R*w[0]],ss=Math.hypot(...slip),j=ss?Math.min(m.mu*(1+m.e)*down,ss/3.5):0,J=ss?slip.map(x=>-j*x/ss):[0,0];
     v=[(v[0]+J[0])*.97,(v[1]+J[1])*.97,down*m.e];w=[cl((w[0]+2.5*J[1]/R)*.88,-370,370),cl((w[1]-2.5*J[0]/R)*.88,-370,370),w[2]*.6];
     bounces++;events.push({t,kind:"bounce",surface:surface(p),before,after:Math.hypot(...v),vz:v[2]});if(v[2]<.48){rolling=true;v[2]=0;events.push({t,kind:"roll",speed:Math.hypot(v[0],v[1])});}add();}
    else if(rolling&&Math.hypot(v[0],v[1])<.045){v=[0,0,0];dead=true;add();}
    if(p[1]<-15||Math.hypot(p[0],p[1])>190){dead=true;add();}
   }
   if(i%4===3||dead)add();
  }
  add();const last=pts.at(-1);return {pts,events,land:land||{t:last.t,p:[last.x,last.y,last.z]},wall,hr,apex,stop:[last.x,last.y,last.z],T:last.t,dead,bounces};
 }
 function travel(d,v,acc=5.2,dec=4.5,end=0){d=Math.max(0,d);v=Math.max(.5,v);end=cl(end,0,v);const peak=Math.min(v,Math.sqrt((2*d+end*end/dec)/(1/acc+1/dec))),d1=peak*peak/(2*acc),d2=Math.max(0,(peak*peak-end*end)/(2*dec));return peak/acc+Math.max(0,d-d1-d2)/Math.max(.5,peak)+Math.max(0,peak-end)/dec;}
 function fieldPlan(path,fielders,air=true){
  if(path.hr)return {catch:null,pick:null};
  const pts=path.pts;let caught=null,picked=null;
  const choose=(best,q)=>!best||q.rank<best.rank?q:best;
  for(const f of fielders){if(!f||!f.pos||!Number.isFinite(f.v))continue;const pitcher=f.key==="投",catcher=f.key==="捕",react=f.react??(cl(.25-(f.field-50)*.0017,.15,.36)+(pitcher?.27:catcher?.15:0)),v=f.v;let bestCatch=null,bestPick=null;
   for(let i=1;i<pts.length;i++){const q=pts[i],before=q.t<path.land.t-1e-5;if(q.t<react||q.y<-.8)continue;const flying=before&&air&&q.z>=.38&&q.z<=(f.reach||2.15);if(before&&!flying||!before&&q.z>Math.min(1.6,f.reach||2.15))continue;const radial=Math.hypot(q.x,q.y);if(catcher&&radial>15||pitcher&&radial>36||pitcher&&flying&&radial>22)continue;
    const clip=flying?(q.z>=1.45&&q.vz<0?"f_fly":"f_line"):q.z>.8?"f_line":"f_gb",prep=clip==="f_fly"?.42:clip==="f_line"?.16:.45,prev=pts[i-1],dx=q.x-prev.x,dy=q.y-prev.y,L=Math.hypot(dx,dy)||1,off=clip==="f_fly"?.36:clip==="f_line"?.34:.48,spot=[q.x+dx/L*off,q.y+dy/L*off],d=dist(spot,f.pos),need=react+travel(d,v)+prep+.035;
    if(need>q.t)continue;
    const hit={key:f.key,t:q.t,p:[q.x,q.y,q.z],spot,react,prep,clip,rank:q.t+(pitcher&&flying?.23:catcher&&flying?.10:0)+d*.003,margin:q.t-need,arm:f.arm||29,field:f.field||50,travel:d};
    if(flying)bestCatch=choose(bestCatch,hit);else{bestPick=hit;break;}
   }
   if(!bestPick){const q=pts.at(-1),r=Math.hypot(q.x,q.y);if(q.z<1.6&&!(catcher&&r>15)&&!(pitcher&&r>36)){const prev=pts[Math.max(0,pts.length-5)],dx=q.x-prev.x,dy=q.y-prev.y,L=Math.hypot(dx,dy)||1,spot=[q.x+.48*dx/L,q.y+.48*dy/L],d=dist(spot,f.pos),need=react+travel(d,v)+.485;bestPick={key:f.key,t:Math.max(path.T,need),p:[q.x,q.y,q.z],spot,react,prep:.45,clip:"f_gb",rank:Math.max(path.T,need)+d*.003,margin:0,arm:f.arm||29,field:f.field||50,travel:d};}}
   if(bestCatch)caught=choose(caught,bestCatch);if(bestPick)picked=choose(picked,bestPick);
  }return {catch:caught,pick:picked};
 }
 function classify(c,path,fs,be,old){
  if(path.hr)return {res:"HR",fielder:null};
  const f=fieldPlan(path,fs,true),speed=cl(6.6+((Number(be?.speed)||55)-50)/22,5.6,8.6);
  if(f.catch)return {res:c.type==="pop"?"PO":c.la<22?"LO":"FO",fielder:f.catch};
  const pick=f.pick;if(!pick)return {res:"1B",fielder:null};
  const d=dist(pick.p,[0,0]),B=[[0,0],[19.4,19.4],[0,38.8],[-19.4,19.4]],runner=n=>.30+travel(n*27.43,speed,5.2,4.5,speed);
  function throwAt(n){const d=dist(pick.p,B[n]);if(n===1&&pick.key==="一"&&d<3)return pick.t+travel(d,fs.find(x=>x.key==="一")?.v||6.7,5.2,4.5,1);const receiver=n===1?(pick.key==="一"?"投":"一"):n===2?(pick.key==="遊"?"二":"遊"):"三",r=fs.find(x=>x.key===receiver),ready=r?(r.react??.25)+travel(dist(r.pos,B[n]),r.v)+.20:0;return Math.max(pick.t+.64+d/pick.arm,ready);}
  if(c.bunt){const safe=throwAt(1)>=runner(1)-.04;return {res:safe?"1B":old==="SAC"||old==="FC"?old:"GO",fielder:pick};}
  if(!["左","中","右"].includes(pick.key)&&throwAt(1)<runner(1)-.04)return {res:old==="E"?"E":"GO",fielder:pick};
  let res="1B";if(d>48&&throwAt(2)>runner(2)+.25)res="2B";if(d>78&&throwAt(3)>runner(3)+.45)res="3B";return {res,fielder:pick};
 }
 return {trace,fieldPlan,classify,travel,surface,materials,R};
})(phStep,FENCE);
const V32Field=(function install(){
 const K=V32Core,plans=new WeakMap(),enabled=m=>AR.m===m&&AR.el&&!AR.el.hidden&&(!m.autoUntil||AR.mode==="card")&&["pre","wind","flight","gauge"].includes(AR.phase);
 V28Physics.trace=K.trace;V28Physics.intercept=(path,fs,air)=>K.fieldPlan(path,fs,air);
 function prepare(m,ev){const c=ev.bb;if(!c||!ev.P||!Number.isFinite(c.ev)||plans.has(c)||!enabled(m))return;
  const d=m.def(),tb=m.bat(),pa=m.pa,DP=plDefPos(d,m),hs=pa.p.throws==="左"?-1:1,clip=plPitClip(pa.p),pe=plPitEnd(clip),pOff=AR.mode==="card"?1450:plPitchClipAt(),pitchEnd=Math.max(0,(1650-pOff)/1000),pos={};
  for(const [k,p] of Object.entries(DP)){if(k==="投"){const q=moL2F(pe.dx||0,pe.dz||0,0,hs);pos[k]=[q[0],R3C.RUBBER-.15+q[1]];}else if(k==="捕")pos[k]=[0,-.85];else{const q=moL2F(0,["左","中","右"].includes(k)?.9:.55,moYawTo(p[0],p[1],0,0),1);pos[k]=[p[0]+q[0],p[1]+q[1]];}}
  const fs=Object.entries(pos).map(([key,pos])=>{const p=r3PlayerOf(d,key),b=p&&p.bat||{},field=Number(b.field)||55;return {key,pos,v:plSpeed(p),arm:plArm(p),field,reach:Math.min(2.45,Math.max(1.8,(Number(p&&p.height)||175)/100+.42)),react:Math.max(.15,Math.min(.36,.25-(field-50)*.0017))+(key==="投"?Math.max(.27,pitchEnd+.10):key==="捕"?.15:0)};});
  const h=ev.sw&&ev.sw.v29Collision,cp=h&&h.hit?h.point:[(ev.P.x||0)*.25,.2,Math.max(.18,.8-(ev.P.y||0)*.3)],wind=c.ngWind||[0,0,0],old=actionSettings().v29Live?"GO":c.res;
  if(c.bunt&&c.type==="bunt")c.ev=Math.max(25,Math.min(46,22+(c.dist||14)*.85));
  let path=K.trace(c,cp,wind),r=K.classify(c,path,fs,pa.be,old),fumble=null;
  if(r.res==="E"&&r.fielder){const first=r.fielder,ath=K.trace({ev:22,la:12,a:Math.max(-44,Math.min(44,(c.a||0)+(c.a<0?-26:26))),type:"ground"},first.p,wind),one=fs.find(f=>f.key===first.key);const second=K.fieldPlan(ath,[{...one,pos:first.spot,react:.45}],false).pick;if(second){fumble=first;const shift=first.t;path={...ath,pts:path.pts.filter(q=>q.t<shift-1e-7).concat(ath.pts.map(q=>({...q,t:q.t+shift}))),events:path.events.filter(e=>e.t<shift).concat([{t:shift,kind:"error"}],ath.events.map(e=>({...e,t:e.t+shift}))),land:path.land,T:ath.T+shift,wall:path.wall||ath.wall,hr:false};r.fielder={...second,t:second.t+shift,react:second.react+shift};}else r.res="1B";}
  if(!r.fielder&&!path.hr)return;
  const info={path,field:r.fielder,fumble,DP,positions:pos,fielders:fs,def:d,bat:tb,pitcher:pa.p,hand:pa.bHand,pOff,initialBases:m.bases.slice(),contact:cp};
  c.res=r.res;c.type=c.res==="LO"?"line":(c.res==="GO"||c.res==="E")&&!c.bunt?"ground":c.type;c.fpos=r.fielder?r.fielder.key:fielderOf(c);c.dist=Math.max(1,Math.round(Math.hypot(...(path.hr?path.land.p.slice(0,2):r.fielder.p.slice(0,2)))));c.ngStart={x0:cp[0],y0:cp[1],z0:cp[2]};c.v28Field=r.fielder;c.v28Catch=["FO","LO","PO"].includes(c.res)?r.fielder:null;c.v28Physical=true;plans.set(c,info);
 }
 const oldApply=Match.prototype.applyInplay;Match.prototype.applyInplay=function(ev,choice){if(choice==null&&ev&&ev.bb&&!plans.has(ev.bb))try{prepare(this,ev);}catch(e){console.warn("v32 field planning fallback",e);}return oldApply.call(this,ev,choice);};
 function sceneBall(c,plan){const p=plan.path,S=FW_SPEED,f=plan.field,hr=c.res==="HR",caught=["FO","LO","PO"].includes(c.res);return {pts:p.pts.map(q=>({t:q.t*1000*S,x:q.x,y:q.y,z:q.z})),air:c.type!=="ground"&&c.type!=="bunt",caught,isHR:hr,Tland:p.land.t*1000*S,land:p.land.p.slice(0,2),Tstop:p.T*1000*S,stop:p.stop.slice(0,2),Tc:caught&&f?f.t*1000*S:null,Pc:caught&&f?f.p.slice():null,hrCross:hr&&p.wall?p.wall.t*1000*S:null,v32:plan};}
 const oldBall=plBallPath;plBallPath=function(c,c0){const plan=plans.get(c);if(!plan)return oldBall(c,c0);if(!c.anim)c.anim={roll:.7,bob:.5,ang:0};return sceneBall(c,plan);};
 const oldMake=r3MakeHit,oldHit=r3HitPos;r3MakeHit=function(ev,P,cp){const plan=ev&&ev.bb&&plans.get(ev.bb);return plan?{v32Path:plan.path}:oldMake(ev,P,cp);};r3HitPos=function(h,ms){if(!h.v32Path)return oldHit(h,ms);const q=phSample(h.v32Path.pts,Math.max(0,ms/1000));return r3V(q.x,q.y,q.z);};
 return {get:c=>plans.get(c),enabled,prepare,sceneBall,core:K};
})();
