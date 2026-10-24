/* ================= 物理モデル：投球と打球の飛行（重力＋空気抵抗＋マグヌス力） =================
 単位はm・秒。フィールド座標：X=一塁側+、Y=センター方向+、Z=高さ。本塁の後端が原点。
 投球は投手のリリース点から本塁へ（Yが減る方向）飛ぶ。回転軸と回転数は球種ごとに設定し、
 「どこに到達させるか」はエンジンが決めた到達点になるよう初速の向きを数値的に解く（打者から見た変化の仕方は物理で決まる）。 */
const PH={g:9.81,rho:1.205,m:0.145,r:0.0366};
PH.k=0.5*PH.rho*Math.PI*PH.r*PH.r/PH.m; /* ≈0.0175 /m */
function phCd(s){return 0.33;}
function phCl(S){return S<0.1?1.5*S:0.09+0.6*S;} /* 揚力係数（Sawicki/Nathan） */
function phAccel(v,w,eff){const s=Math.hypot(v[0],v[1],v[2])||1e-6;const cd=phCd(s);
 const ax=-PH.k*cd*s*v[0],ay=-PH.k*cd*s*v[1],az=-PH.k*cd*s*v[2]-PH.g;
 const wm=Math.hypot(w[0],w[1],w[2]);
 if(wm>1){const S=PH.r*wm/s;const cl=phCl(S)*0.85*(eff==null?1:eff);const f=PH.k*cl*s/wm;
  const cx=w[1]*v[2]-w[2]*v[1],cy=w[2]*v[0]-w[0]*v[2],cz=w[0]*v[1]-w[1]*v[0];return [ax+f*cx,ay+f*cy,az+f*cz];}
 return [ax,ay,az];}
function phStep(p,v,w,dt,eff){const a1=phAccel(v,w,eff);const vm=[v[0]+a1[0]*dt/2,v[1]+a1[1]*dt/2,v[2]+a1[2]*dt/2];const a2=phAccel(vm,w,eff);
 return [[p[0]+vm[0]*dt,p[1]+vm[1]*dt,p[2]+vm[2]*dt],[v[0]+a2[0]*dt,v[1]+a2[1]*dt,v[2]+a2[2]*dt]];}
/* 球種ごとの回転（右投げ基準。回転軸：X=一塁側+ Y=センター+ Z=上。左投げはZ成分の符号を反転） */
const PH_SPIN={
 'ストレート':{rpm:2250,axis:[-1,0,-0.22],eff:0.9},
 'ツーシーム':{rpm:2100,axis:[-0.8,0,-0.6],eff:0.8},
 'シュート':{rpm:2000,axis:[-0.68,0,-0.73],eff:0.8},
 'シンカー':{rpm:1850,axis:[-0.5,0,-0.86],eff:0.75},
 'カットボール':{rpm:2400,axis:[-0.85,-0.25,0.45],eff:0.8},
 '高速スライダー':{rpm:2450,axis:[-0.35,-0.5,0.78],eff:0.75},
 'スライダー':{rpm:2450,axis:[-0.1,-0.6,0.8],eff:0.75},
 '縦スライダー':{rpm:2500,axis:[0.5,-0.45,0.74],eff:0.8},
 'カーブ':{rpm:2650,axis:[0.75,-0.15,0.64],eff:0.85},
 'スローカーブ':{rpm:2700,axis:[0.8,-0.1,0.6],eff:0.85},
 'フォーク':{rpm:1100,axis:[-1,0,0],eff:0.35},
 'スプリット':{rpm:1400,axis:[-0.95,0,-0.32],eff:0.45},
 'チェンジアップ':{rpm:1750,axis:[-0.7,0,-0.72],eff:0.65},
 'パーム':{rpm:900,axis:[-1,0,0],eff:0.3},
 'ナックル':{rpm:60,axis:[-1,0,0],eff:0.5,wobble:true},
};
/* リリース点（右投げ基準・左投げはXを反転）：フォームで高さと横位置が変わる */
const PH_REL={over:{x:-0.5,z:1.88},three:{x:-0.62,z:1.72},side:{x:-0.78,z:1.28},under:{x:-0.7,z:0.55}};
function phSeeded(seed){let s=(seed*9301+49297)%233280;return ()=>{s=(s*9301+49297)%233280;return s/233280;};}
/* 投球の軌道を解く：P.name/P.v/P.hs/P.form と到達点(P.x,P.y) から {pts:[{t,x,y,z}],T,rel,v0} */
function phPitchPath(P,opt){opt=opt||{};const sp=PH_SPIN[P.name]||{rpm:1800,axis:[-1,0,0]};const hs=P.hs||1;const form=P.form||'over';const rel=PH_REL[form]||PH_REL.over;
 const relY=opt.relY!=null?opt.relY:16.55;const start=[rel.x*hs,relY,rel.z];const tx=(P.x||0)*0.25,ty=0.2,tz=0.8-(P.y||0)*0.3;
 const an=Math.hypot(sp.axis[0],sp.axis[1],sp.axis[2])||1;const wm=sp.rpm*2*Math.PI/60;const w=[sp.axis[0]/an*wm,sp.axis[1]/an*wm,sp.axis[2]/an*wm*hs];
 const v0=Math.max(15,(P.v||120)/3.6);const dt=1/240;const seed=(P.n||1)*17+Math.round((P.x||0)*100)+7;const eff=sp.eff==null?1:sp.eff;
 const sim=(th,ph,keep)=>{const rnd=phSeeded(seed);let p=start.slice(),v=[v0*Math.cos(th)*Math.sin(ph),-v0*Math.cos(th)*Math.cos(ph),v0*Math.sin(th)];let t=0;const pts=keep?[{t:0,x:p[0],y:p[1],z:p[2]}]:null;let ww=w;
  for(let i=0;i<600;i++){if(sp.wobble){ww=[w[0]+(rnd()-0.5)*400,w[1],w[2]+(rnd()-0.5)*400];}const r=phStep(p,v,ww,dt,eff);const pn=r[0];
   if(pn[1]<=ty){const f=(p[1]-ty)/(p[1]-pn[1]);const q=[p[0]+(pn[0]-p[0])*f,ty,p[2]+(pn[2]-p[2])*f];t+=dt*f;if(pts)pts.push({t,x:q[0],y:q[1],z:q[2]});return {x:q[0],z:q[2],t,pts};}
   p=pn;v=r[1];t+=dt;if(pts&&i%2===1)pts.push({t,x:p[0],y:p[1],z:p[2]});}
  return {x:p[0],z:p[2],t,pts};};
 const dy=start[1]-ty;let th=Math.atan2(tz-start[2],dy)+0.012,ph=Math.atan2(tx-start[0],dy);
 for(let it=0;it<5;it++){const r0=sim(th,ph,false);const ex=r0.x-tx,ez=r0.z-tz;if(Math.abs(ex)<0.004&&Math.abs(ez)<0.004)break;
  const d=0.0015;const rt=sim(th+d,ph,false),rp=sim(th,ph+d,false);
  const a11=(rt.x-r0.x)/d,a12=(rp.x-r0.x)/d,a21=(rt.z-r0.z)/d,a22=(rp.z-r0.z)/d;const det=a11*a22-a12*a21;if(Math.abs(det)<1e-9)break;
  const dth=(-ex*a22+ez*a12)/det,dph=(-a11*ez+a21*ex)/det;th+=Math.max(-0.1,Math.min(0.1,dth));ph+=Math.max(-0.1,Math.min(0.1,dph));}
 const fin=sim(th,ph,true);return {pts:fin.pts,T:fin.t,rel:start,v0,th,ph,err:[fin.x-tx,fin.z-tz]};}
/* 打球の軌道：打球速度ev(km/h)・打球角度la・方向a(度、+が一塁側) で飛ばし、エンジンの飛距離distに合うよう初速を補正する */
function phHitPath(ev,la,a,dist,opt){opt=opt||{};const ar=a*Math.PI/180,lr=la*Math.PI/180;const dir=[Math.sin(ar),Math.cos(ar)];
 const rpm=la>8?Math.max(500,Math.min(3200,900+la*60)):600;const wm=rpm*2*Math.PI/60;const w=la>8?[Math.cos(ar)*wm,-Math.sin(ar)*wm,0]:[-Math.cos(ar)*wm*0.4,Math.sin(ar)*wm*0.4,0];
 const start=[opt.x0||0,opt.y0||0.4,opt.z0||1.0];const dt=1/90;
 const fly=(mult,keep)=>{const s=Math.max(5,ev/3.6*mult);let p=start.slice(),v=[dir[0]*s*Math.cos(lr),dir[1]*s*Math.cos(lr),s*Math.sin(lr)];let t=0;const pts=keep?[{t:0,x:p[0],y:p[1],z:p[2]}]:null;let apex=p[2];
  for(let i=0;i<900;i++){const r=phStep(p,v,w,dt);const pn=r[0];if(pn[2]>apex)apex=pn[2];
   if(pn[2]<=0.02&&i>2){const f=(p[2]-0.02)/(p[2]-pn[2]);const q=[p[0]+(pn[0]-p[0])*f,p[1]+(pn[1]-p[1])*f,0.02];t+=dt*f;if(pts)pts.push({t,x:q[0],y:q[1],z:q[2]});return {d:Math.hypot(q[0],q[1]),t,pts,apex};}
   p=pn;v=r[1];t+=dt;if(pts)pts.push({t,x:p[0],y:p[1],z:p[2]});}
  return {d:Math.hypot(p[0],p[1]),t,pts,apex};};
 if(dist==null){const res=fly(1,true);res.mult=1;return res;}
 let lo=0.4,hi=2.2;for(let i=0;i<14;i++){const mid=(lo+hi)/2;const r=fly(mid,false);if(r.d<dist)lo=mid;else hi=mid;}
 const res=fly((lo+hi)/2,true);res.mult=(lo+hi)/2;return res;}
/* 軌道のキャッシュ（投球オブジェクトごと） */
const PH_CACHE=new WeakMap();
function phOf(P){if(!P||typeof P!=='object')return null;if(PH_CACHE.has(P))return PH_CACHE.get(P);let r=null;try{r=phPitchPath(P);if(!r||!r.pts||r.pts.length<2||!isFinite(r.T))r=null;}catch(e){r=null;}PH_CACHE.set(P,r);return r;}
/* 時刻t(秒)の位置を線形補間 {x,y,z} */
function phSample(pts,t){if(!pts||!pts.length)return null;if(t<=pts[0].t)return pts[0];const n=pts.length;if(t>=pts[n-1].t)return pts[n-1];let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(pts[m].t<=t)lo=m;else hi=m;}const a=pts[lo],b=pts[hi];const u=b.t===a.t?0:(t-a.t)/(b.t-a.t);return {t,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};}
/* 投球の、リリース点→到達点を結ぶ直線からのズレ（m）。u=0..1（飛行の進み） */
function phDev(P,u){const ph=phOf(P);if(!ph)return {dx:0,dz:0};const pts=ph.pts;const a=pts[0],b=pts[pts.length-1];const q=phSample(pts,Math.max(0,Math.min(1,u))*ph.T);const k=b.y===a.y?u:(a.y-q.y)/(a.y-b.y);return {dx:q.x-(a.x+(b.x-a.x)*k),dz:q.z-(a.z+(b.z-a.z)*k)};}
