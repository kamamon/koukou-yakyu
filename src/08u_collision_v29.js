/* Continuous moving sphere / piecewise bat capsule collision, with conservative advancement. */
const V29Collision=(function collisionFactory(){
 const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),sub=(a,b)=>a.map((x,i)=>x-b[i]),add=(a,b)=>a.map((x,i)=>x+b[i]),mul=(a,s)=>a.map(x=>x*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),len=a=>Math.hypot(...a),mix=(a,b,u)=>a.map((x,i)=>x+(b[i]-x)*u);
 // Surface model of the v28 lathed bat, in bat-local metres.
 const profile=[[-.10,.021],[-.085,.018],[.02,.016],[.19,.017],[.28,.022],[.42,.029],[.62,.034],[.70,.033],[.738,.025],[.742,0]];
 function sample(A,B,u){return {p:mix(A.p,B.p,u),bat:A.bat.map((x,i)=>mix(x,B.bat[i],u))};}
 function gap(S,radii,ballR){
  let best=null;
  for(let k=0;k<S.bat.length-1;k++){
   const a=S.bat[k],b=S.bat[k+1],d=sub(b,a),dd=dot(d,d),u=dd>1e-12?cl(dot(sub(S.p,a),d)/dd,0,1):0;
   // A tapered capsule is enclosed by a constant-radius capsule per short profile interval.
   const c=mix(a,b,u),v=sub(S.p,c),dist=len(v),radius=Math.max(radii[k],radii[k+1]),g=dist-radius-ballR;
   if(!best||g<best.g)best={g,k,u,point:c,n:dist>1e-8?mul(v,1/dist):[0,1,0],radius};
  }
  return best;
 }
 function sweep(A,B,radii,ballR=.0366,tol=.00015){
  if(!A||!B||A.bat.length<2||B.bat.length!==A.bat.length)return null;
  const v=len(sub(B.p,A.p))+Math.max(...A.bat.map((p,i)=>len(sub(B.bat[i],p))));
  let u=0,lo=0,hit=null;
  for(let i=0;i<96;i++){
   const g=gap(sample(A,B,u),radii,ballR);
   if(g.g<=tol){hit={...g,u};break;}
   if(u>=1||v<1e-12)return null;
   lo=u;u=Math.min(1,u+Math.max(1e-7,(g.g-tol)*.9/v));
  }
  if(!hit){const q=gap(sample(A,B,1),radii,ballR);if(q.g<=tol)hit={...q,u:1};else return null;}
  let hi=hit.u;for(let i=0;i<20;i++){const m=(lo+hi)/2,g=gap(sample(A,B,m),radii,ballR);if(g.g<=tol){hi=m;hit={...g,u:m};}else lo=m;}
  const time=A.t+(B.t-A.t)*hit.u,dt=Math.max(1e-8,(B.t-A.t)/1000),k=hit.k;
  const ballV=mul(sub(B.p,A.p),1/dt);
  // Use the axial fraction (separate from time fraction) for velocity at the contact point.
  const S=sample(A,B,hit.u),g=gap(S,radii,ballR),ax=g.u;
  const vb=mul(sub(mix(B.bat[k],B.bat[k+1],ax),mix(A.bat[k],A.bat[k+1],ax)),1/dt);
  return {time,point:S.p,normal:g.n,axisIndex:k,axial:ax,ballV,batV:vb,gap:g.g,batY:profile[k]&&profile[k+1]?profile[k][0]+(profile[k+1][0]-profile[k][0])*ax:0};
 }
 function first(samples,radii,ballR=.0366){for(let i=1;i<samples.length;i++){const q=sweep(samples[i-1],samples[i],radii,ballR);if(q)return q;}return null;}
 function impact(hit,skill=55,power=false){
  const n=hit.normal,rel=sub(hit.ballV,hit.batV),closing=dot(rel,n),speed=len(rel);if(closing>-.05)return null;
  const q=cl(1-Math.abs(hit.batY-.54)/.44,0,1),restitution=cl(.46+q*.15+(skill-50)*.001,.38,.72);
  const kick=-(1+restitution)*closing,friction=.09;
  let out=add(hit.ballV,add(mul(n,kick),mul(sub(rel,mul(n,closing)),-friction)));
  const max=(power?173:163)/3.6;const mag=len(out);if(mag>max)out=mul(out,max/mag);
  const horiz=Math.hypot(out[0],out[2]),a=Math.atan2(out[0],-out[2])*180/Math.PI,la=Math.atan2(out[1],horiz)*180/Math.PI;
  return {q,ev:cl(Math.round(len(out)*3.6),5,173),la:Math.round(la),a:Math.round(a),kind:Math.abs(a)>45||out[2]>=0?"foul":"inplay",velocity:out,closing,speed};
 }
 return {profile,gap,sweep,first,impact};
})();
