/* ================= モーション基盤（v25） =================
 体の動きを「時刻 t の純粋な関数」として計算する（描画のフレーム間隔に左右されない。スロー・巻き戻し・コマ送りでも同じ姿勢になる）。
 構成：
  ・クリップ（MODEF）：関節ごとのキー（オイラー角・ラジアン）を単調3次補間（PCHIP）でつなぐ。キーで止まらず、行き過ぎない。
    キーごとに部位別の到達時刻のずれ（gt:{armR:+30}）を書けるので、「腰→胸→肩→腕」の時間差を作れる。
    脚は足首の目標（fr/fl：位置、frq/flq：向き）で書き、2関節IKで解く。足が地面に固定される区間は目標が動かない区間。
  ・歩行・走行（move）：経路の移動距離と速さから着地点と着地時刻を先に決める（接地中の足はワールドに固定＝滑らない）。
  ・エンティティ（ent）：区間（pose／move／clip）の並び。区間の切り替えは位置・向き・関節・足の目標を補間してつなぐ。
  ・ボール（MoBall）：保持→リリース→飛行→捕球→保持→持ち替え…を1本の時刻表で持ち、イベントは時刻順に一度だけ発火する。
 座標：フィールド座標（x=一塁側, y=センター方向, z=高さ）。向き yaw は three.js の rotation.y（本塁向き＝0、センター向き＝π）。
 リグのローカル座標：+Z=体の正面、+X=体の左、+Y=上。左投げ・左打ちはリグ全体を鏡像（scale.x=-1）にする。 */
const MOT={
 /* ===== 調整用の定数（ここを変えると全員の動きが変わる） ===== */
 IK_SLACK:0.996,     /* 脚・腕を伸ばし切らない（最大長に対する割合） */
 PELVIS_DROP:0.25,   /* 接地した足へ届かせるために腰を下げる上限（m） */
 XFADE:150,          /* 区間の切り替えの標準のつなぎ時間（ms） */
 GROUND_EPS:0.012,   /* 足が地面に着いているとみなす高さ（m） */
 TOE_W:0.6,          /* 母指球の位置（つま先までの距離に対する割合） */
 LOOK_YAW:1.25,LOOK_PITCH:0.7, /* 頭を向けられる範囲（rad） */
};
/* 関節→部位（時間差の指定に使う） */
const MO_GRP={hips:'hips',dx:'hips',dy:'hips',dz:'hips',torso:'torso',chest:'torso',head:'head',rSh:'armR',rEl:'armR',rHand:'armR',hr:'armR',hrq:'armR',hrw:'armR',lSh:'armL',lEl:'armL',lHand:'armL',hl:'armL',hlq:'armL',hlw:'armL',rHip:'legR',rKnee:'legR',rFoot:'legR',fr:'legR',frq:'legR',kr:'legR',lHip:'legL',lKnee:'legL',lFoot:'legL',fl:'legL',flq:'legL',kl:'legL',batDir:'bat',look:'head'};
const MO_VEC={batDir:1}; /* 正規化して補間する方向ベクトル */
/* ---------- 単調3次補間（Fritsch–Carlson） ---------- */
function moSlopes(t,v,ends){const n=t.length;const m=new Float64Array(n);if(n<2)return m;const d=new Float64Array(n-1);for(let i=0;i<n-1;i++){const h=t[i+1]-t[i];d[i]=h>0?(v[i+1]-v[i])/h:0;}
 for(let i=1;i<n-1;i++){if(d[i-1]*d[i]<=0)m[i]=0;else{const h0=t[i]-t[i-1],h1=t[i+1]-t[i];const w1=2*h1+h0,w2=h1+2*h0;m[i]=(w1+w2)/(w1/d[i-1]+w2/d[i]);}}
 if(ends){m[0]=d[0];m[n-1]=d[n-2];}return m;}
function moSeg(t,x){let lo=0,hi=t.length-1;if(x<=t[0])return -1;if(x>=t[hi])return hi;while(hi-lo>1){const mid=(lo+hi)>>1;if(t[mid]<=x)lo=mid;else hi=mid;}return lo;}
function moHerm(t,v,m,i,x){const h=t[i+1]-t[i];if(h<=0)return v[i+1];const s=(x-t[i])/h,s2=s*s,s3=s2*s;return (2*s3-3*s2+1)*v[i]+(s3-2*s2+s)*h*m[i]+(-2*s3+3*s2)*v[i+1]+(s3-s2)*h*m[i+1];}
function moSmooth(u){u=u<0?0:u>1?1:u;return u*u*(3-2*u);}
function moSmoother(u){u=u<0?0:u>1?1:u;return u*u*u*(u*(u*6-15)+10);}
function moAng(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}
function moLerpAng(a,b,u){return a+moAng(b-a)*u;}
/* ---------- 姿勢ライブラリ（名前付きの静止姿勢）とクリップ定義。中身は 08l で登録 ---------- */
const MOPOSE={};const MODEF={};const MOCLIP={};
function moPose(name){return MOPOSE[name]||(typeof RP!=='undefined'?RP[name]:null)||{};}
/* 腕を「上腕の向き a・前腕の向き f（胸の座標：+Z=胸の正面, +X=左, +Y=上）」で書けるようにする → 肩のオイラー角とひじの曲げ。
 肩の回転は「上腕が a を向き、ひじの曲がる面に前腕 f が乗る」ように決める（腕がまっすぐのときは hint で向きを決める） */
const MO_U=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(-1,0,0)).transpose();
function moArmEuler(a,f,hint,ref){const A=new THREE.Vector3(a[0],a[1],a[2]).normalize(),F=new THREE.Vector3(f[0],f[1],f[2]).normalize();const c=clamp(A.dot(F),-1,1);const e=-Math.acos(c);
 let W2=F.clone().addScaledVector(A,-c);if(W2.lengthSq()<0.004){W2=new THREE.Vector3().fromArray(hint||[0,0.3,1]);W2.addScaledVector(A,-W2.dot(A));}W2.normalize();const W3=new THREE.Vector3().crossVectors(A,W2);
 const R=new THREE.Matrix4().makeBasis(A,W2,W3).multiply(MO_U);const eu=new THREE.Euler().setFromRotationMatrix(R,'XYZ');return {sh:moEulerNear([eu.x,eu.y,eu.z],ref),el:e};}
/* XYZ オイラー角の2通りの表し方のうち、前のキーに近い方（±2π も含めて）を選ぶ＝補間で腕が裏返らない */
function moEulerNear(e,ref){if(!ref)return e;const un=(v,r)=>{while(v-r>Math.PI)v-=2*Math.PI;while(v-r<-Math.PI)v+=2*Math.PI;return v;};const c1=[un(e[0],ref[0]),un(e[1],ref[1]),un(e[2],ref[2])];const c2=[un(e[0]+Math.PI,ref[0]),un(Math.PI-e[1],ref[1]),un(e[2]+Math.PI,ref[2])];const d=c=>Math.abs(c[0]-ref[0])+Math.abs(c[1]-ref[1])+Math.abs(c[2]-ref[2]);return d(c1)<=d(c2)?c1:c2;}
/* キーの腕（ra/la：[ax,ay,az,fx,fy,fz]）を肩・ひじの角度へ */
function moKeyArms(pose,refs){for(const s of ['r','l']){const v=pose[s+'a'];if(!v)continue;const r=moArmEuler(v.slice(0,3),v.slice(3,6),v[6]?v.slice(6,9):null,refs[s]);pose[s+'Sh']=r.sh;pose[s+'El']=[r.el,0,0];refs[s]=r.sh;delete pose[s+'a'];}return pose;}
/* クリップのコンパイル：キーを関節ごとのチャンネルへ。キーに書かれていない関節はそのキーを持たない（他の関節の動きを止めない） */
function moClip(name){if(MOCLIP[name])return MOCLIP[name];const def=MODEF[name];if(!def)return null;const ch={};const refs={};
 for(const k of def.keys){const pose=moKeyArms(Object.assign({},k.base?moPose(k.base):{},k.p||{}),refs);for(const nm in pose){const val=pose[nm];if(val==null)continue;const g=MO_GRP[nm]||'other';const tt=k.t+((k.gt&&k.gt[g])||0);const arr=Array.isArray(val)?val.slice():[val];const c=ch[nm]||(ch[nm]={t:[],v:[],dim:arr.length});
   let i=c.t.length;while(i>0&&c.t[i-1]>tt)i--;if(i>0&&Math.abs(c.t[i-1]-tt)<1e-6){c.v[i-1]=arr;}else{c.t.splice(i,0,tt);c.v.splice(i,0,arr);}}}
 for(const nm in ch){const c=ch[nm];c.T=Float64Array.from(c.t);c.comp=[];c.slope=[];for(let d=0;d<c.dim;d++){const vv=Float64Array.from(c.v.map(a=>a[d]||0));c.comp.push(vv);c.slope.push(moSlopes(c.T,vv,false));}}
 const clip={name,def,ch,dur:def.dur||Math.max(...Object.values(ch).map(c=>c.T[c.T.length-1])),ev:def.ev||[],loop:!!def.loop};
 /* 足の接地区間（足首目標が地面にあり動かない区間）を求める */
 clip.plant={};for(const s of ['r','l']){const c=ch['f'+s];const iv=[];if(c){let cur=null;const step=10;for(let tt=0;tt<=clip.dur+1e-6;tt+=step){const p=moChanAt(c,tt);const p2=moChanAt(c,tt+step);const mv=Math.hypot(p2[0]-p[0],p2[1]-p[1],p2[2]-p[2]);const on=p[1]<=MOT.GROUND_EPS&&mv<0.0012;if(on&&!cur){cur=[tt,tt];iv.push(cur);}else if(on)cur[1]=tt;else cur=null;}}clip.plant[s]=iv;}
 MOCLIP[name]=clip;return clip;}
function moChanAt(c,x){const out=new Array(c.dim);const i=moSeg(c.T,x);for(let d=0;d<c.dim;d++){const v=c.comp[d];out[d]=i<0?v[0]:i>=c.T.length-1?v[v.length-1]:moHerm(c.T,v,c.slope[d],i,x);}return out;}
/* クリップの時刻 tm（ms）の姿勢 */
function moClipAt(clip,tm,out){out=out||{};if(clip.loop&&clip.dur>0){tm=((tm%clip.dur)+clip.dur)%clip.dur;}for(const nm in clip.ch){const c=clip.ch[nm];const a=moChanAt(c,tm);if(c.dim===1)out[nm]=a[0];else if(MO_VEC[nm]){const l=Math.hypot(a[0],a[1],a[2])||1;out[nm]=[a[0]/l,a[1]/l,a[2]/l];}else out[nm]=a;}return out;}
function moClipEvent(clip,k){const e=clip.ev.find(x=>x.k===k);return e?e.t:null;}
/* ---------- 地面の高さ（マウンドだけ盛り上がる）。08f のマウンド形状（上面半径1.0m・高さ0.26m・裾半径3.0m）に合わせる ---------- */
function moGround(x,y){const r=Math.hypot(x,y-R3C.RUBBER);if(r<=1.0)return 0.26;if(r>=3.0)return 0;return 0.26*(3.0-r)/2.0;}
/* ---------- 座標変換 ---------- */
function moYawTo(fx,fy,tx,ty){return Math.atan2(tx-fx,-(ty-fy));}
/* リグのローカル（体の正面=+Z）→フィールド：yaw と鏡像 mir(-1/1) */
function moL2F(lx,lz,yaw,mir){lx*=mir;const c=Math.cos(yaw),s=Math.sin(yaw);const wx=lx*c+lz*s,wz=-lx*s+lz*c;return [wx,-wz];}
function moF2L(fx,fy,yaw,mir){const wx=fx,wz=-fy;const c=Math.cos(yaw),s=Math.sin(yaw);const lx=wx*c-wz*s,lz=wx*s+wz*c;return [lx*mir,lz];}
/* ---------- リグの準備：脚・腕の骨、足首の高さ、つま先、グラブのポケット、バットの芯 ---------- */
const _mv=[0,1,2,3,4,5,6,7].map(()=>new THREE.Vector3()),_mq=[0,1,2,3,4,5].map(()=>new THREE.Quaternion()),_mm=[0,1,2].map(()=>new THREE.Matrix4());
const MO_X=new THREE.Vector3(1,0,0),MO_Y=new THREE.Vector3(0,1,0);
function moRig(rig){if(rig._mo)return rig._mo;const j=rig.j;const mo=rig._mo={legs:{},arms:{}};const gl=!!j.rFoot;
 /* 立った状態（全関節0）で足首の高さを測る */const keep=rig.pose;rig.apply({});rig.g.updateMatrixWorld(true);
 for(const s of ['r','l']){const hip=j[s+'Hip'],knee=j[s+'Knee'];let foot=j[s+'Foot']||null;let endOff;
  if(foot)endOff=foot.position.clone();else if(rig instanceof R3RigReal)endOff=new THREE.Vector3(0,-RR.SH,0);else endOff=new THREE.Vector3(0,-0.2,0.0);
  const M=moLocalM(rig,knee,_mm[0]);const ank=endOff.clone().applyMatrix4(M);
  let toe;if(gl&&GL.data&&GL.data.json.extras.points[s+'Toe']){const P=GL.data.json.extras.jointPos;const tp=GL.data.json.extras.points[s+'Toe'];toe=new THREE.Vector3(tp[0]-P[s+'Foot'][0],tp[1]-P[s+'Foot'][1],tp[2]-P[s+'Foot'][2]);}else toe=new THREE.Vector3(0,-ank.y*0.6,0.15);
  mo.legs[s]={hip,knee,foot,endOff,ankleH:Math.max(0.0,ank.y),toe,L1:knee.position.length(),L2:endOff.length(),sign:1};}
 for(const s of ['r','l']){const sh=j[s+'Sh'],el=j[s+'El'],hand=j[s+'Hand'];mo.arms[s]={sh,el,hand,endOff:hand.position.clone(),L1:el.position.length(),L2:hand.position.length(),sign:-1};}
 /* グラブのポケット（捕球したボールの位置）とバットの芯 */
 const gp=new THREE.Object3D();gp.position.set(0.0,0.02,0.055);(rig.glove||j.lHand).add(gp);mo.pocket=gp;
 if(rig.bat){const sw=new THREE.Object3D();sw.position.set(0,0.52,0);const kids=rig.bat.children;rig.bat.add(sw);mo.sweet=sw;const kn=new THREE.Object3D();kn.position.set(0,-0.08,0);rig.bat.add(kn);mo.knob=kn;}
 mo.palm={r:rig.palm?rig.palm.r:j.rHand,l:rig.palm?rig.palm.l:j.lHand};mo.dyK=rig instanceof R3RigReal?1:R3K.DY;
 if(keep)rig.apply(keep);return mo;}
/* リグのグループ（g）を基準にしたノードの行列（gの位置・回転・鏡像を除く） */
function moLocalM(rig,node,out){out=out||new THREE.Matrix4();out.identity();const chain=[];let n=node;while(n&&n!==rig.g){chain.push(n);n=n.parent;}for(let i=chain.length-1;i>=0;i--){const c=chain[i];c.updateMatrix();out.multiply(c.matrix);}return out;}
/* ---------- 2関節IK（休止姿勢で骨が一直線でなくてもよい一般形） ----------
 A=上の骨（股関節／肩）、B=中間（膝／肘）、v=Bから末端までのベクトル（B座標）。ヒンジ軸はBのX軸。sign=+1:膝（正で屈曲）, -1:肘（負で屈曲）
 target・pole はリグのローカル座標。届かない目標は最大長で止める（手足を伸ばさない）。戻り値：届いた割合 */
function moIK2(rig,A,B,v,target,pole,sign,maxD){const Mp=moLocalM(rig,A.parent,_mm[1]);const S=_mv[0].copy(A.position).applyMatrix4(Mp);const Rp=_mq[0].setFromRotationMatrix(Mp);const Rpi=_mq[1].copy(Rp).invert();
 const d=_mv[1].copy(target).sub(S).applyQuaternion(Rpi);const u=B.position;const L1=u.length(),L2=v.length();const dist=d.length();const Dmax=Math.min(maxD||1e9,(L1+L2)*MOT.IK_SLACK),Dmin=Math.abs(L1-L2)+0.02;const D=clamp(dist,Dmin,Dmax);
 const a=u.y*v.y+u.z*v.z,b=u.z*v.y-u.y*v.z;const K=(D*D-L1*L1-L2*L2)/2-u.x*v.x;const R=Math.hypot(a,b)||1e-6;const psi=Math.atan2(b,a);const al=Math.acos(clamp(K/R,-1,1));let phi=moAng(psi+sign*al);
 const qB=_mq[2].setFromAxisAngle(MO_X,phi);const e=_mv[2].copy(v).applyQuaternion(qB).add(u);
 const dn=_mv[3].copy(d);if(dn.lengthSq()<1e-10)dn.set(0,-1,0);dn.normalize();const q1=_mq[3].setFromUnitVectors(e.normalize(),dn);
 const m=_mv[4].copy(u).applyQuaternion(q1);const pl=_mv[5].copy(pole).applyQuaternion(Rpi);m.addScaledVector(dn,-m.dot(dn));pl.addScaledVector(dn,-pl.dot(dn));
 if(m.lengthSq()>1e-9&&pl.lengthSq()>1e-9){m.normalize();pl.normalize();const cr=_mv[6].copy(m).cross(pl);const ang=Math.atan2(cr.dot(dn),m.dot(pl));q1.premultiply(_mq[4].setFromAxisAngle(dn,ang));}
 A.quaternion.copy(q1);B.quaternion.copy(qB);return dist>1e-6?D/dist:1;}
/* 末端の骨（足・手）をリグのローカルで向き Q にする */
function moSetEndRot(rig,B,C,Q){const M=moLocalM(rig,B,_mm[2]);const qb=_mq[5].setFromRotationMatrix(M);C.quaternion.copy(qb.invert().multiply(Q));}
/* ワールド→リグのローカル */
function moW2L(rig,v){rig.g.updateMatrix();_mm[0].copy(rig.g.matrix).invert();return v.applyMatrix4(_mm[0]);}
/* ---------- 姿勢の補間（関節はクォータニオンで球面補間） ---------- */
const MO_EU=new THREE.Euler(),MO_QA=new THREE.Quaternion(),MO_QB=new THREE.Quaternion();
function moMix(a,b,u,out){out=out||{};if(u<=0)return Object.assign(out,a);if(u>=1)return Object.assign(out,b);const keys=new Set([...Object.keys(a),...Object.keys(b)]);
 for(const k of keys){const x=a[k],y=b[k];if(x==null&&y==null)continue;
  if(typeof x==='number'||typeof y==='number'){out[k]=(x||0)+((y||0)-(x||0))*u;continue;}
  if(typeof x==='string'||typeof y==='string'||typeof x==='boolean'||typeof y==='boolean'||(x&&!Array.isArray(x))||(y&&!Array.isArray(y))){out[k]=u<0.5?x:y;continue;}
  const X=x||[0,0,0],Y=y||[0,0,0];
  if(MO_VEC[k]||X.length!==3||k==='fr'||k==='fl'||k==='hl'||k==='hr'||k==='kr'||k==='kl'||k==='look'||k==='frq'||k==='flq'){const o=X.map((v,i)=>v+((Y[i]||0)-v)*u);if(MO_VEC[k]){const l=Math.hypot(o[0],o[1],o[2])||1;out[k]=o.map(v=>v/l);}else out[k]=o;continue;}
  MO_QA.setFromEuler(MO_EU.set(X[0],X[1],X[2]));MO_QB.setFromEuler(MO_EU.set(Y[0],Y[1],Y[2]));MO_QA.slerp(MO_QB,u);MO_EU.setFromQuaternion(MO_QA);out[k]=[MO_EU.x,MO_EU.y,MO_EU.z];}
 return out;}
/* ---------- 経路（[{t,x,y}]）の補間 ---------- */
function moPathAt(P,t){if(!P||!P.length)return [0,0];if(t<=P[0].t)return [P[0].x,P[0].y];for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i];if(t<=b.t){const u=b.t===a.t?1:(t-a.t)/(b.t-a.t);return [a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u];}}const l=P[P.length-1];return [l.x,l.y];}
/* 折れ線に沿って、加速→巡航→（曲がり角で減速）→減速して止まる経路を作る。速さは実時間の m/s、ts=実時間の秒/場面の秒
 opt：{v0:出だしの速さ, v1:終点の速さ, lat:曲がるときの横方向の加速度の上限} */
function moProfile(pts,vmax,acc,dec,t0,opt){opt=opt||{};const ts=opt.ts||1;const lat=opt.lat||7.5;const P=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]);const n=Math.max(1,Math.ceil(L/0.2));for(let k=0;k<n;k++)P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}P.push(pts[pts.length-1].slice());
 const N=P.length;const ds=new Float64Array(N),vl=new Float64Array(N).fill(vmax);for(let i=1;i<N;i++)ds[i]=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
 for(let i=2;i<N-2;i++){const a=P[i-2],b=P[i],c=P[i+2];const ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ac=Math.hypot(c[0]-a[0],c[1]-a[1]);const cr=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));if(cr>1e-6){const R=ab*bc*ac/(2*cr);vl[i]=Math.min(vmax,Math.sqrt(lat*R));}}
 const v=new Float64Array(N);v[0]=opt.v0||0;for(let i=1;i<N;i++)v[i]=Math.min(vl[i],Math.sqrt(v[i-1]*v[i-1]+2*acc*ds[i]));v[N-1]=Math.min(v[N-1],opt.v1||0);for(let i=N-2;i>=0;i--)v[i]=Math.min(v[i],Math.sqrt(v[i+1]*v[i+1]+2*dec*ds[i+1]));
 const out=[{t:t0,x:P[0][0],y:P[0][1]}];let t=t0;for(let i=1;i<N;i++){const vm=Math.max(0.25,(v[i]+v[i-1])/2);t+=ds[i]/vm*1000/ts;out.push({t,x:P[i][0],y:P[i][1]});}out.speed=v;return out;}
/* ---------- 歩行・走行：実際の速さ（m/s）ごとの歩き方（線形補間）。ここを変えると走り方が変わる ---------- */
const MO_GAIT={
 v:    [0,   1.0, 2.0, 3.0, 4.5, 6.0, 7.5, 9.0],
 cad:  [1.7, 1.85,2.1, 2.65,2.9, 3.2, 3.7, 4.2],  /* 1秒あたりの歩数 */
 duty: [0.64,0.62,0.58,0.40,0.34,0.30,0.26,0.23], /* 片足の1周期のうち接地している割合（走りは両足が浮く時間がある） */
 lift: [0.05,0.07,0.09,0.16,0.24,0.32,0.40,0.46], /* 振り出す足の高さ（m） */
 kick: [0.0, 0.0, 0.02,0.10,0.16,0.22,0.27,0.30], /* かかとを後ろに巻き上げる量（m） */
 width:[0.26,0.24,0.21,0.17,0.15,0.13,0.12,0.12], /* 左右の足の間隔（m） */
 heel: [0.55,0.55,0.5, 0.25,0.12,0.05,0.0, 0.0 ], /* 接地中にかかとが上がり始める割合（小さいほど早く母指球で立つ） */
 toff: [0.35,0.4, 0.5, 0.65,0.75,0.85,0.95,1.05], /* 蹴り出しの足首の角度（rad） */
 land: [-0.18,-0.2,-0.15,-0.05,0.02,0.08,0.14,0.2],/* 着地の足首の角度（負＝かかとから、正＝つま先から） */
 dy:   [0,  -0.01,-0.02,-0.04,-0.05,-0.06,-0.07,-0.075], /* 腰の高さ */
 bob:  [0.012,0.016,0.02,0.032,0.036,0.04,0.042,0.044],   /* 上下動 */
 lean: [0.03,0.05,0.08,0.13,0.17,0.21,0.25,0.29], /* 前傾（rad） */
 arm:  [0.18,0.28,0.4, 0.62,0.75,0.86,0.96,1.05], /* 腕振りの大きさ */
 elb:  [-0.25,-0.35,-0.6,-1.2,-1.35,-1.45,-1.55,-1.62], /* ひじの曲げ */
 pelv: [0.06,0.08,0.1, 0.13,0.15,0.17,0.19,0.21], /* 骨盤のひねり */
};
function moGP(key,v){const V=MO_GAIT.v,A=MO_GAIT[key];if(v<=V[0])return A[0];for(let i=1;i<V.length;i++){if(v<=V[i]){const u=(v-V[i-1])/(V[i]-V[i-1]);return A[i-1]+(A[i]-A[i-1])*u;}}return A[A.length-1];}
const MO_VMIN=0.35; /* これより遅いと足を止める（m/s） */
/* 移動区間の足運びを作る。prev=直前の足（ワールドの母指球の位置と向き）、end=止まったときの足（次の区間の最初の足） */
function moGaitBuild(seg,prev,end,ts,mir){mir=mir<0?-1:1;const P=seg.path;const t0=seg.t0,t1=seg.t1;const dt=8;const n=Math.max(2,Math.ceil((t1-t0)/dt)+1);
 const T=new Float64Array(n),X=new Float64Array(n),Y=new Float64Array(n),V=new Float64Array(n),A=new Float64Array(n),F=new Float64Array(n),W=new Float64Array(n);
 for(let k=0;k<n;k++){const t=Math.min(t1,t0+k*dt);T[k]=t;const p=moPathAt(P,t);X[k]=p[0];Y[k]=p[1];}
 /* 速さ（実時間の m/s）：前後の差分を少しならして角の急変を避ける */
 const win=3;for(let k=0;k<n;k++){const a=Math.max(0,k-win),b=Math.min(n-1,k+win);const dd=Math.hypot(X[b]-X[a],Y[b]-Y[a]);const tt=(T[b]-T[a])/1000*ts;V[k]=tt>0?dd/tt:0;}
 for(let k=0;k<n;k++){const a=Math.max(0,k-win),b=Math.min(n-1,k+win);const tt=(T[b]-T[a])/1000*ts;A[k]=tt>0?(V[b]-V[a])/tt:0;}
 /* 体の向き：移動方向（vel）／ある点の方向（pt）／固定（yaw）。急に回らないよう時定数でならす */
 const fm=seg.face||{mode:'vel'};let yaw=prev&&prev.yaw!=null?prev.yaw:(fm.yaw!=null?fm.yaw:0);
 for(let k=0;k<n;k++){let tgt=yaw;if(fm.mode==='pt')tgt=moYawTo(X[k],Y[k],fm.x,fm.y);else if(fm.mode==='yaw')tgt=fm.yaw;else{const a=Math.max(0,k-win),b=Math.min(n-1,k+win);const dx=X[b]-X[a],dy=Y[b]-Y[a];if(V[k]>0.6)tgt=Math.atan2(dx,-dy);}
  const tau=(fm.tau||110)/1000;const kk=1-Math.exp(-(dt/1000*ts)/tau);yaw=yaw+moAng(tgt-yaw)*(k===0&&!prev?1:kk);F[k]=yaw;}
 for(let k=0;k<n;k++){const a=Math.max(0,k-2),b=Math.min(n-1,k+2);const tt=(T[b]-T[a])/1000/ts;W[k]=tt>0?moAng(F[b]-F[a])/tt:0;}
 const at=(arr,t)=>{if(t<=t0)return arr[0];if(t>=t1)return arr[n-1];const f=(t-t0)/dt;const i=Math.floor(f);const u=f-i;return i+1<n?arr[i]+(arr[i+1]-arr[i])*u:arr[n-1];};
 const yawAt=t=>{if(t<=t0)return F[0];if(t>=t1)return F[n-1];const f=(t-t0)/dt;const i=Math.floor(f);const u=f-i;return i+1<n?moLerpAng(F[i],F[i+1],u):F[n-1];};
 /* 足：最初は直前の位置に接地 */
 const feet={r:[],l:[]};const side={r:-mir,l:mir};/* 鏡像のリグは右脚が体の左側にある */
 const stance0=(s,x,y,yw)=>{const o=moL2F(side[s]*0.13,0.05,yw,1);return {x:x+o[0],y:y+o[1],yaw:yw};};
 for(const s of ['r','l']){const f0=prev&&prev.feet&&prev.feet[s]?prev.feet[s]:stance0(s,X[0],Y[0],F[0]);feet[s].push({ts:-1e9,te:Infinity,x:f0.x,y:f0.y,yaw:f0.yaw,pitch:0,v:0});}
 const scene=1000/ts; /* 実時間の秒 → 場面のms */
 let ph=0.6;let next=null;let lastStep=-1e9;const strikes=[];
 /* 最初の一歩：進む方向の側の足から（横移動・斜めに出るとき自然） */
 {let k=0;while(k<n-1&&V[k]<MO_VMIN)k++;const dx=X[Math.min(n-1,k+6)]-X[k],dy=Y[Math.min(n-1,k+6)]-Y[k];const lc=moF2L(dx,dy,F[k],1);next=Math.abs(lc[0])>Math.abs(lc[1])*0.5?(lc[0]>0?'l':'r'):(seg.first||'l');}
 /* 次の区間の最初の足（end）があれば、最後の2歩をそこへ着地させる（つなぎ目で足が滑らない） */
 const vEnd=Math.max(V[n-1],V[Math.max(0,n-6)]);const perEnd=1/moGP('cad',Math.max(1.2,vEnd))*scene;const reserve=end?Math.max(0.9*perEnd,0.18*scene):0;
 const stepFoot=(s,ts0,tg,v,o)=>{const list=feet[s];const pf=list[list.length-1];const per=1/moGP('cad',Math.max(0.8,v))*scene;const stance=moGP('duty',v)*2*per;const swing=Math.max(0.42*per,2*per-stance,o&&o.minSwing||0);
  pf.te=Math.max(Math.min(ts0-swing*0.98,ts0-40),pf.ts+60,t0);list.push(Object.assign({ts:ts0,te:Infinity,x:tg.x,y:tg.y,yaw:tg.yaw,pitch:moGP('land',v),v,heel:moGP('heel',v),toff:moGP('toff',v),lift:moGP('lift',v),kick:moGP('kick',v)},o||{}));strikes.push({t:ts0,s});lastStep=ts0;};
 for(let k=1;k<n;k++){const v=V[k];if(v<MO_VMIN)continue;if(end&&T[k]>t1-reserve)break;const cad=moGP('cad',v)*(seg.cadMul||1);ph+=cad*(T[k]-T[k-1])/scene;
  if(ph>=1){ph-=1;const ts0=T[k];const per=1/cad*scene;const stance=moGP('duty',v)*2*per;const mid=Math.min(t1,ts0+stance*0.5);const p=moPathAt(P,mid);const yw=yawAt(mid);
   const wdt=moGP('width',v)*(seg.wide||1);const o=moL2F(side[next]*wdt/2,0,yw,1);const toe=(next==='r'?-1:1)*0.06;
   stepFoot(next,ts0,{x:p[0]+o[0],y:p[1]+o[1],yaw:yw+toe},v);next=next==='r'?'l':'r';}}
 let tStop=t1;{let k=n-1;while(k>0&&V[k]<MO_VMIN)k--;tStop=T[Math.min(n-1,k+1)];}
 if(end&&end.feet&&end.feet.r&&end.feet.l){/* 最後の2歩：交互に。2歩目は区間の終わりの直前 */const first=next,second=next==='r'?'l':'r';const tB=t1-12;const tA=Math.max(lastStep+0.3*perEnd,tB-Math.max(0.5*perEnd,0.12*scene));
  const vv=Math.max(1.0,vEnd);const d1=Math.hypot(end.feet[first].x-feet[first][feet[first].length-1].x,end.feet[first].y-feet[first][feet[first].length-1].y);
  if(d1>0.04||lastStep>-1e8)stepFoot(first,Math.min(tA,tB-60),end.feet[first],vv,{lift:Math.min(0.16,0.05+d1*0.08),kick:0});stepFoot(second,tB,end.feet[second],vv,{lift:0.07,kick:0,pitch:0});}
 else{/* 止まる：その場で足をそろえる（最大2歩） */const fin={feet:{r:stance0('r',X[n-1],Y[n-1],F[n-1]),l:stance0('l',X[n-1],Y[n-1],F[n-1])}};
  let tA=Math.max(tStop,lastStep+0.22*scene);const order=['r','l'].sort((a,b)=>feet[a][feet[a].length-1].ts-feet[b][feet[b].length-1].ts);
  for(const s of order){const list=feet[s];const pf=list[list.length-1];const tg=fin.feet[s];const dd=Math.hypot(tg.x-pf.x,tg.y-pf.y);if(dd<0.05&&Math.abs(moAng(tg.yaw-pf.yaw))<0.2)continue;
   const sw=Math.min(0.3,0.16+dd*0.12)*scene;pf.te=Math.max(tA-sw,pf.ts+60);list.push({ts:tA,te:Infinity,x:tg.x,y:tg.y,yaw:tg.yaw,pitch:-0.05,v:0.8,heel:0.6,toff:0.35,lift:0.06+Math.min(0.08,dd*0.1),kick:0});strikes.push({t:tA,s});tA+=0.16*scene;}}
 strikes.sort((a,b)=>a.t-b.t);
 return {T,X,Y,V,A,F,W,at,yawAt,feet,strikes,t0,t1,ts};}
/* 母指球の目標（ワールド）：接地・かかと上げ・振り出し */
const MO_BALL={f:0.11,h:0.07}; /* 母指球から足首まで（前後・高さ）の標準値。リグごとの値は適用時に使う */
function moFootAt(list,t,g){let i=0;for(let k=list.length-1;k>=0;k--){if(list[k].ts<=t){i=k;break;}}const f=list[i];
 if(t<f.te||i===list.length-1){/* 接地：後半にかかとを上げ、母指球を支点に回る */let pitch=0;if(f.te<Infinity&&f.te>f.ts&&f.ts>-1e8){const us=(t-f.ts)/(f.te-f.ts);const h0=f.heel==null?0.5:f.heel;
   const land=f.pitch||0;const k0=Math.min(1,us/0.18);let p=land>0?land*(1-k0*0.6):land*(1-moSmooth(us/0.25));if(us>h0){const q=(us-h0)/Math.max(0.05,1-h0);p+=(f.toff||0.5)*Math.pow(q,1.4);}pitch=Math.max(land>0?0.02:-0.3,p);}
  return {x:f.x,y:f.y,z:0,yaw:f.yaw,pitch,plant:1};}
 /* 振り出し：地面に対してはほぼ等速で前へ（体と一緒に進む）、高さは前半で上がる（かかとをお尻へ） */const nf=list[i+1];const s=clamp((t-f.te)/Math.max(1,nf.ts-f.te),0,1);const e=0.55*s+0.45*moSmooth(s);
 const dx=nf.x-f.x,dy=nf.y-f.y;const L=Math.hypot(dx,dy)||1;const kick=(nf.kick||0)*Math.sin(Math.PI*Math.min(1,s*1.25))*(1-s);
 const x=f.x+dx*e-dx/L*kick,y=f.y+dy*e-dy/L*kick;const sk=(nf.lift||0.08)>0.12?Math.pow(s,0.72):s;const z=(nf.lift||0.08)*Math.pow(Math.sin(Math.PI*sk),0.85)+kick*0.6;
 const p0=f.toff||0.5,p1=nf.pitch||0;const pitch=s<0.5?p0*(1-moSmooth(s/0.5))+0.25*moSmooth(s/0.5)*p0:0.25*p0+(p1-0.25*p0)*moSmooth((s-0.5)/0.5);
 return {x,y,z,yaw:moLerpAng(f.yaw,nf.yaw,moSmooth(s*1.3)),pitch,plant:0};}
/* 歩行の上半身：速さ・加速・旋回・歩行の位相から */
function moLocoPose(g,t,style,out){const v=g.at(g.V,t),a=g.at(g.A,t),turn=g.at(g.W,t);out=out||{};
 /* 位相：右足の着地=0、左足の着地=π */let psi=0,amp=clamp((v-0.2)/1.2,0,1);const S=g.strikes;let i=-1;for(let k=S.length-1;k>=0;k--){if(S[k].t<=t){i=k;break;}}
 if(i<0){psi=S.length?(S[0].s==='r'?-Math.PI*0.5:Math.PI*0.5):0;}else{const b=S[i].s==='r'?0:Math.PI;const nx=S[i+1];if(nx&&nx.t>S[i].t){psi=b+Math.PI*clamp((t-S[i].t)/(nx.t-S[i].t),0,1);}else{psi=b;amp*=0;}}
 const c=Math.cos(psi);const sh=style==='shuffle'||style==='back';const vv=sh?Math.min(v,2):v;
 const lean=(sh?0.12:moGP('lean',vv))+clamp(a*0.035,-0.12,0.16);const roll=clamp(-turn*vv*0.05,-0.3,0.3);
 out.dy=moGP('dy',vv)+(sh?-0.1:0);out.hips=[lean*0.35,moGP('pelv',vv)*c*amp,roll*0.4];
 out.torso=[lean*0.75,-moGP('pelv',vv)*0.8*c*amp,roll*0.6];out.head=[-lean*0.8,0,-roll*0.5];
 const A=(sh?0.15:moGP('arm',vv))*amp,E=sh?-1.0:moGP('elb',vv);
 out.rSh=[A*c+0.05,0,-0.12];out.lSh=[-A*c+0.05,0,0.12];out.rEl=[E-0.25*Math.max(0,-c)*amp,0,0];out.lEl=[E-0.25*Math.max(0,c)*amp,0,0];out.rHand=[0.2,0,0];out.lHand=[0.2,0,0];
 if(sh){out.rSh=[-0.5,0,-0.3];out.lSh=[-0.6,0,0.35];out.rEl=[-1.0,0,0];out.lEl=[-0.9,0,0];}
 /* 上下動：接地の中間で低く（走り）／高く（歩き） */let bob=0;for(const s of ['r','l']){const L=g.feet[s];for(let k=L.length-1;k>=0;k--){const f=L[k];if(f.ts<=t){if(t<f.te&&f.te<Infinity&&f.ts>-1e8){const us=(t-f.ts)/(f.te-f.ts);bob=Math.sin(Math.PI*us);}break;}}}
 const B=moGP('bob',vv)*amp;out.dy+=vv>2.2?(-B*bob+B*0.4):(B*bob-B*0.5);
 out._v=v;out._psi=psi;return out;}
/* ---------- エンティティ（1人の選手・審判）：区間の並びを時刻で評価する ----------
 ent={segs:[区間…], ts:実時間の秒/場面の秒, mir:1|-1（左投げ・左打ちは-1）, ik:[{t0,t1,side,target(t)→[x,y,z],fade}], look:[{t0,t1,target(t)→[x,y,z]}]}
 区間：{k:'pose',t0,t1,pose,x,y,yaw} / {k:'move',t0,t1,path:[{t,x,y}],face,style} / {k:'clip',t0,t1,clip,x,y,yaw,rate,edit(P,tm)} */
function moSegAt(ent,t){const S=ent.segs;let i=0;for(let k=0;k<S.length;k++){if(S[k].t0<=t)i=k;else break;}return i;}
/* 区間のはじめ・おわりの足（ワールドの母指球の位置と向き）：つなぎ目で足が跳ばないように前後の区間へ渡す */
function moSegFeet(ent,i,atEnd){const seg=ent.segs[i];if(!seg)return null;const t=atEnd?seg.t1:seg.t0;const st=moSegEval(ent,i,t,true);if(!st.feet)return null;const o={yaw:st.yaw,feet:{}};for(const s of ['r','l']){const f=st.feet[s];if(f)o.feet[s]={x:f.x,y:f.y,yaw:f.yaw};}return o;}
function moSegEval(ent,i,t,noLink){const seg=ent.segs[i];const mir=ent.mir||1;const st={x:0,y:0,yaw:0,P:null,feet:null,mir};
 if(seg.k==='move'){if(!seg._g){const prev=i>0&&!noLink?moSegFeet(ent,i-1,true):null;const nx=ent.segs[i+1]&&!noLink&&ent.segs[i+1].k!=='move'?moSegFeet(ent,i+1,false):null;seg._g=moGaitBuild(seg,prev,nx,ent.ts||1,ent.mir||1);}
  const g=seg._g;const tt=clamp(t,seg.t0,seg.t1);const p=moPathAt(seg.path,tt);st.x=p[0];st.y=p[1];st.yaw=g.yawAt(tt);st.P=moLocoPose(g,t,seg.style,{});if(seg.edit)seg.edit(st.P,t,ent,st);
  st.feet={r:moFootAt(g.feet.r,t),l:moFootAt(g.feet.l,t)};st.v=g.at(g.V,tt);return st;}
 if(seg.k==='glide'){/* 体ごと経路に沿って動く（スライディングなど）：足は体に対して決まる */const tt=clamp(t,seg.t0,seg.t1);const p=moPathAt(seg.path,tt);st.x=p[0];st.y=p[1];st.yaw=seg.yaw!=null?seg.yaw:0;}
 else{st.x=seg.x;st.y=seg.y;st.yaw=seg.yaw||0;}
 if(seg.k==='clip'||(seg.k==='glide'&&seg.clip)){const clip=moClip(seg.clip);const tm=moWarp(seg,t);st.P=clip?moClipAt(clip,tm,{}):{};st.tm=tm;if(seg.edit)seg.edit(st.P,tm,ent,st);}
 else{const base=typeof seg.pose==='string'?moPose(seg.pose):(seg.pose||{});st.P=Object.assign({},base);if(seg.edit)seg.edit(st.P,t,ent,st);}
 /* 足の目標（リグのローカル、地面基準の母指球）→ワールド */
 if(st.P.fr||st.P.fl){st.feet={};for(const s of ['r','l']){const v=st.P['f'+s];if(!v)continue;const q=st.P['f'+s+'q']||[0,0];const o=moL2F(v[0],v[2],st.yaw,mir);st.feet[s]={x:st.x+o[0],y:st.y+o[1],z:v[1],yaw:st.yaw+mir*q[0],pitch:q[1]||0,plant:v[1]<=MOT.GROUND_EPS?1:0};}
  /* 区間のはじめに接地している足は、直前の区間の足の位置を引き継ぐ（最初に足を上げるまで。上げたら次の接地までに本来の位置へ寄せる） */
  if(seg.k==='clip'&&!noLink&&i>0){const clip=moClip(seg.clip);if(!seg._inh){seg._inh={};const pf=moSegFeet(ent,i-1,true);for(const s of ['r','l']){const iv=clip&&clip.plant[s];if(pf&&pf.feet[s]&&iv&&iv.length&&iv[0][0]<=1){const f0=moSegEval(ent,i,seg.t0,true).feet;if(f0&&f0[s]){seg._inh[s]={dx:pf.feet[s].x-f0[s].x,dy:pf.feet[s].y-f0[s].y,dyaw:moAng(pf.feet[s].yaw-f0[s].yaw),until:iv[0][1],next:iv[1]?iv[1][0]:null};}}}}
   for(const s in seg._inh){const h=seg._inh[s];const f=st.feet[s];if(!f)continue;let k=1;if(st.tm>h.until){k=h.next!=null?1-moSmooth((st.tm-h.until)/Math.max(1,h.next-h.until)):Math.max(0,1-(st.tm-h.until)/200);}if(k>0){f.x+=h.dx*k;f.y+=h.dy*k;f.yaw+=h.dyaw*k;}}}}
 return st;}
/* 区間の時刻→クリップの時刻：warp=[[場面ms,クリップms],…]（区間のはじめからの経過）で区間ごとに速さを変えられる。最後の点より後は rate で進む */
function moWarp(seg,t){const dt=t-seg.t0;const w=seg.warp;if(!w)return dt*(seg.rate||1)+(seg.off||0);if(dt<=w[0][0])return w[0][1]+(dt-w[0][0])*(seg.rate||1);for(let i=1;i<w.length;i++){if(dt<=w[i][0]){const u=(dt-w[i-1][0])/(w[i][0]-w[i-1][0]);return w[i-1][1]+(w[i][1]-w[i-1][1])*u;}}const l=w[w.length-1];return l[1]+(dt-l[0])*(seg.rate||1);}
function moEval(ent,t){const S=ent.segs;if(!S||!S.length)return null;const i=moSegAt(ent,t);const seg=S[i];let st=moSegEval(ent,i,t);
 const fade=seg.fade!=null?seg.fade:MOT.XFADE;if(i>0&&t-seg.t0<fade){const u=moSmooth((t-seg.t0)/fade);const pv=moSegEval(ent,i-1,t);st=moBlendSt(pv,st,u);}
 st.i=i;st.seg=seg;return st;}
function moBlendSt(a,b,u){const o={mir:b.mir,x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,yaw:moLerpAng(a.yaw,b.yaw,u),P:moMix(a.P||{},b.P||{},u,{}),feet:null,tm:b.tm,v:b.v};
 if(a.feet||b.feet){o.feet={};for(const s of ['r','l']){const fa=a.feet&&a.feet[s],fb=b.feet&&b.feet[s];if(fa&&fb){o.feet[s]={x:fa.x+(fb.x-fa.x)*u,y:fa.y+(fb.y-fa.y)*u,z:(fa.z||0)+((fb.z||0)-(fa.z||0))*u,yaw:moLerpAng(fa.yaw,fb.yaw,u),pitch:(fa.pitch||0)+((fb.pitch||0)-(fa.pitch||0))*u,plant:Math.max(fa.plant||0,fb.plant||0)};}else if(fb||fa)o.feet[s]=Object.assign({},fb||fa);}}
 return o;}
/* ---------- 姿勢をリグへ：骨格の姿勢→腰の高さ補正→脚IK（足を地面へ）→腕IK→視線 ---------- */
const MO_TV=new THREE.Vector3(),MO_TQ=new THREE.Quaternion(),MO_TE=new THREE.Euler();
function moApply(rig,st,ent,t,noBat){const mo=moRig(rig);const mir=st.mir<0?-1:1;
 /* 打撃の接触の補正：接触の時刻に芯がボールへ来るよう、上体の前傾とバットの傾き（高さ）→手元の位置（残り）で合わせる */
 const bt=!noBat&&st.seg&&st.seg.bat&&rig.bat&&rig.bat.visible?st.seg.bat:null;let bw=0;
 if(bt){const tc=bt.tc;bw=t<tc?moSmooth((t-(tc-70))/55):1-moSmooth((t-tc)/130);if(bw>0&&bt._d===undefined)moBatPrep(rig,ent,bt);if(!bt._d)bw=0;}
 rig.g.scale.x=mir;const gz=moGround(st.x,st.y);rig.g.position.set(st.x,gz,-st.y);rig.g.rotation.set(0,st.yaw,0);rig.g.updateMatrix();
 let P=st.P||{};if(bw>0&&bt._adj){P=Object.assign({},P);moBatAdj(P,bt._adj,bw);}rig.apply(P);
 const inv=_mm[0].copy(rig.g.matrix).invert();
 /* 足の目標（足首の位置と足の向き：リグのローカル） */const tg={};
 if(st.feet){for(const s of ['r','l']){const f=st.feet[s];if(!f)continue;const L=mo.legs[s];const fz=moGround(f.x,f.y)+(f.z||0);const ball=new THREE.Vector3(f.x,fz,-f.y).applyMatrix4(inv);
   const yl=moAng((f.yaw-st.yaw))*mir;const Q=new THREE.Quaternion().setFromEuler(MO_TE.set(f.pitch||0,yl,0,'YXZ'));const bo=new THREE.Vector3(L.toe.x*MOT.TOE_W,-L.ankleH,L.toe.z*MOT.TOE_W).applyQuaternion(Q);
   tg[s]={ank:ball.clone().sub(bo),Q,w:f.w==null?1:f.w,plant:!!f.plant||(f.z||0)<0.03};}}
 /* 接地の足に届くよう腰を下げる（空中の足は数えない） */let drop=0;for(const s in tg){if(!tg[s].plant)continue;const L=mo.legs[s];const H=_mv[7].setFromMatrixPosition(moLocalM(rig,L.hip,_mm[1]));const w=tg[s].ank.clone().sub(H);const Lm=(L.L1+L.L2)*MOT.IK_SLACK*0.995;const d2=w.lengthSq();if(d2>Lm*Lm){const disc=w.y*w.y-d2+Lm*Lm;if(disc>=0){const dd=-w.y-Math.sqrt(disc);drop=Math.max(drop,clamp(dd,0,MOT.PELVIS_DROP));}else drop=MOT.PELVIS_DROP;}}
 if(drop>1e-4){const P2=Object.assign({},P);P2.dy=(P.dy||0)-drop/(mo.dyK||1);rig.apply(P2);}
 /* 脚IK */for(const s of ['r','l']){const L=mo.legs[s];const g=tg[s];let ank,Q;
  if(g){ank=g.ank;Q=g.Q;}else{/* 目標なし：骨格の姿勢のまま。ただし地面にめり込まない */const M=moLocalM(rig,L.knee,_mm[1]);ank=L.endOff.clone().applyMatrix4(M);const wpos=ank.clone().applyMatrix4(rig.g.matrix);const gnd=moGround(wpos.x,-wpos.z)+L.ankleH*0.92;if(wpos.y>=gnd)continue;wpos.y=gnd;ank=wpos.applyMatrix4(inv);Q=null;}
  const pole=st.P&&st.P['k'+s]?new THREE.Vector3().fromArray(st.P['k'+s]):kneePole(rig,L,Q);
  moIK2(rig,L.hip,L.knee,L.endOff,ank,pole,1);if(L.foot&&Q)moSetEndRot(rig,L.knee,L.foot,Q);}
 if(bw>0&&bt._d){/* 上の手（右手）を Δ だけ動かし、バットを握り直す */const A=mo.arms.r;const Mw=moLocalM(rig,A.el,_mm[1]);const wr=A.endOff.clone().applyMatrix4(Mw);const Me=moLocalM(rig,A.sh,_mm[2]);const sh=new THREE.Vector3().setFromMatrixPosition(Me);const el=new THREE.Vector3().setFromMatrixPosition(moLocalM(rig,A.el,_mm[2]));
  const pole=el.clone().sub(sh.clone().add(wr).multiplyScalar(0.5));moIK2(rig,A.sh,A.el,A.endOff,wr.clone().addScaledVector(bt._d,bw),pole.lengthSq()>1e-6?pole.normalize():new THREE.Vector3(0,-1,0),-1);moBatPlace(rig,P);}
 /* 腕IK（グラブ・投げ手の目標）：クリップの hl/hr（ローカル）と ent.ik（ワールド） */
 for(const s of ['l','r']){let tgt=null,w=0,pole=null;const lv=P['h'+s],lw=P['h'+s+'w'];if(lv&&lw>0){tgt=new THREE.Vector3(lv[0],lv[1]+0,lv[2]);w=lw;}
  let pocketIK=false;if(ent&&ent.ik){for(const k of ent.ik){if(k.side!==s||t<k.t0-(k.fade||120)||t>k.t1+(k.fade||120))continue;const fd=k.fade||120;const kw=t<k.t0?1-(k.t0-t)/fd:t>k.t1?1-(t-k.t1)/fd:1;const p=k.target(t);if(!p)continue;const wv=new THREE.Vector3(p[0],p[2],-p[1]).applyMatrix4(inv);tgt=wv;w=moSmooth(kw)*(k.w==null?1:k.w);pole=k.pole||null;pocketIK=k.pocket!==false;}}
  if(tgt&&w>0)moArmTo(rig,mo,s,tgt,w,pole,P['h'+s+'q'],!!pocketIK);}
 /* 視線 */if(ent&&ent.look){for(const k of ent.look){if(t<k.t0||t>k.t1)continue;const p=k.target(t);if(p)moLookAt(rig,p,k.w==null?0.85:k.w);}}
 rig.g.updateMatrixWorld(true);}
/* バットを右手の拳に握らせ、左手をグリップへ（R3RigReal.apply と同じ置き方） */
function moBatPlace(rig,P){const j=rig.j;if(!rig.dim||!rig.ikArm)return;const Mh=moLocalM(rig,j.rHand,_mm[1]);const wrist=new THREE.Vector3().setFromMatrixPosition(Mh);const hd=new THREE.Vector3(0,-1,0).transformDirection(Mh);const fist=wrist.clone().addScaledVector(hd,rig.dim.fist);
 const d=P.batDir||[0,1,0];const v=new THREE.Vector3(d[0],d[1],d[2]).normalize();rig.bat.position.copy(fist).addScaledVector(v,-0.07);rig.bat.quaternion.setFromUnitVectors(MO_Y,v);
 if(P.ik!==false){const grip=rig.bat.position.clone();const pole=new THREE.Vector3(0.25,-1,-0.35);rig.ikArm('l',grip,pole);const Me=moLocalM(rig,j.lEl,_mm[1]);const fd=new THREE.Vector3(0,-1,0).transformDirection(Me);rig.ikArm('l',grip.clone().addScaledVector(fd,-0.07),pole);}}
/* 接触の補正の準備（スイングごとに1回）：補正なしの接触の姿勢で芯の位置を測り、高さの差から上体とバットの傾き、残りを手元のずれ（リグのローカル）にする */
function moBatPrep(rig,ent,bt){bt._d=null;const tgt=bt.target?bt.target():null;if(!tgt)return;const mo=moRig(rig);const tc=bt.tc;
 const sweet=()=>{const v=new THREE.Vector3();mo.sweet.getWorldPosition(v);return v;};const T=new THREE.Vector3(tgt[0],tgt[2],-tgt[1]);
 let st=moEval(ent,tc);moApply(rig,st,ent,tc,true);let S0=sweet();const dz=T.y-S0.y;
 bt._adj={bend:clamp(-dz*0.9,-0.25,0.55),tilt:clamp(-dz*1.1,-0.35,0.7)};
 st=moEval(ent,tc);const P=Object.assign({},st.P);moBatAdj(P,bt._adj,1);moApply(rig,Object.assign({},st,{P}),ent,tc,true);S0=sweet();
 rig.g.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(rig.g.matrixWorld).invert();const a=S0.clone().applyMatrix4(inv),b=T.clone().applyMatrix4(inv);const d=b.sub(a);if(d.length()>0.32)d.setLength(0.32);bt._d=d;}
/* 高さに合わせた上体の前傾とバットの傾き（低めは前へかがみ、バットの先を下げる） */
function moBatAdj(P,adj,w){const b=adj.bend*w,t=adj.tilt*w;P.torso=[(P.torso?P.torso[0]:0)+b*0.6,P.torso?P.torso[1]:0,(P.torso?P.torso[2]:0)+b*0.25];P.hips=[(P.hips?P.hips[0]:0)+b*0.3,P.hips?P.hips[1]:0,P.hips?P.hips[2]:0];P.dy=(P.dy||0)-Math.max(0,b)*0.08;
 if(P.batDir){const d=P.batDir;const h=Math.hypot(d[0],d[2])||1;const el=Math.atan2(d[1],h)-t;const nh=Math.cos(el),ny=Math.sin(el);P.batDir=[d[0]/h*nh,ny,d[2]/h*nh];}}
/* 膝の向き：足の向きの前方、少し外側 */function kneePole(rig,L,Q){const v=new THREE.Vector3(0,0.15,1);if(Q)v.applyQuaternion(Q);v.y=0.2;return v.normalize();}
/* 手首を目標へ（グラブは手のひら側にポケットがあるので、手首はポケットの少し手前） */
function moArmTo(rig,mo,s,tgt,w,pole,hq,pocket){const A=mo.arms[s];let target=tgt.clone();
 if(w<1){const M=moLocalM(rig,A.el,_mm[1]);const cur=A.endOff.clone().applyMatrix4(M);target=cur.lerp(target,w);}
 const pl=pole?new THREE.Vector3().fromArray(pole):new THREE.Vector3(s==='l'?0.6:-0.6,-0.7,-0.3);moIK2(rig,A.sh,A.el,A.endOff,target,pl,-1);
 /* グラブ：手首ではなくポケットが目標に来るよう、ずれを足して解き直す（2回） */
 if(pocket&&s==='l'&&mo.pocket){const want=target.clone();for(let it=0;it<2;it++){const Mp=moLocalM(rig,mo.pocket,_mm[2]);const pk=new THREE.Vector3().setFromMatrixPosition(Mp);const err=want.clone().sub(pk);if(err.lengthSq()<1e-6)break;target.add(err);moIK2(rig,A.sh,A.el,A.endOff,target,pl,-1);}}}
/* 頭を目標（フィールド座標）へ向ける（胸に対して首を回せる範囲で）。計算はリグのローカル座標（鏡像を含めて正しく扱える） */
function moLookAt(rig,p,w){const H=rig.j.head;rig.g.updateMatrix();const inv=_mm[0].copy(rig.g.matrix).invert();const tl=new THREE.Vector3(p[0],p[2],-p[1]).applyMatrix4(inv);
 const Mh=moLocalM(rig,H,_mm[1]);const hp=new THREE.Vector3().setFromMatrixPosition(Mh);const d=tl.sub(hp);if(d.lengthSq()<1e-4)return;
 const Mp=moLocalM(rig,H.parent,_mm[2]);const pq=new THREE.Quaternion().setFromRotationMatrix(Mp).invert();d.applyQuaternion(pq);
 const yaw=clamp(Math.atan2(d.x,d.z),-MOT.LOOK_YAW,MOT.LOOK_YAW),pit=clamp(-Math.atan2(d.y,Math.hypot(d.x,d.z)),-MOT.LOOK_PITCH,MOT.LOOK_PITCH);const q=new THREE.Quaternion().setFromEuler(MO_TE.set(pit,yaw,0,'YXZ'));H.quaternion.slerp(q,w);}
/* ---------- ボールの時刻表（ボールの位置の唯一の管理元） ----------
 segs：{k:'hold',t0,t1,ent,at:'r'|'l'|'glove'}             手・グラブで保持
       {k:'xfer',t0,t1,ent,from:'glove',to:'r'}            持ち替え（グラブ→投げ手）
       {k:'fly',t0,t1,from:{ent,at}|{p:[x,y,z]},to:[x,y,z],g?:重力,pts?:[{t,x,y,z}]}  飛行（pts があれば軌道をそのまま使う。始点は実際の手の位置へなじませる）
       {k:'path',t0,t1,pts}  転がる・はねる打球など  {k:'gone',t0,t1}  見えない
 ev：[{t,k:'release'|'contact'|'catch'|'xfer'|'bounce'|'tag',ent}] 時刻順。moBallEvents で一度だけ取り出す */
function moBallNew(){return {segs:[],ev:[],cur:-Infinity};}
function moBallAdd(B,seg){B.segs.push(seg);B.segs.sort((a,b)=>a.t0-b.t0);return seg;}
function moBallEv(B,e){B.ev.push(e);B.ev.sort((a,b)=>a.t-b.t);return e;}
function moBallSegAt(B,t){let s=null;for(const g of B.segs){if(g.t0<=t)s=g;else break;}return s;}
/* 取り付け位置（ワールド）：rigOf(key) でリグを得る */
function moAttach(rig,at){const mo=moRig(rig);const v=new THREE.Vector3();if(at==='glove'||at==='mitt')mo.pocket.getWorldPosition(v);else if(at==='bat'&&mo.sweet)mo.sweet.getWorldPosition(v);else (mo.palm[at==='l'?'l':'r']).getWorldPosition(v);return [v.x,-v.z,v.y];}
/* 飛行の始点を「その時刻の手の位置」で確定する（ent をその時刻で評価してリグに当てて読む。フレームの間隔に左右されない） */
function moBallResolve(B,ctx){for(const g of B.segs){if(g.k==='fly'&&g.from&&g.from.ent&&!g.p0){const ent=ctx.ents[g.from.ent],rig=ctx.rig(g.from.ent);if(!ent||!rig){g.p0=g.from.fallback||[0,0,1.5];continue;}const st=moEval(ent,g.t0);moApply(rig,st,ent,g.t0);g.p0=moAttach(rig,g.from.at||'r');g.resolved=true;}}}
function moBallPos(B,t,ctx){const g=moBallSegAt(B,t);if(!g)return null;
 if(g.k==='gone')return null;
 if(g.k==='hold'){const rig=ctx.rig(g.ent);return rig?moAttach(rig,g.at||'glove'):null;}
 if(g.k==='xfer'){const rig=ctx.rig(g.ent);if(!rig)return null;const a=moAttach(rig,g.from||'glove'),b=moAttach(rig,g.to||'r');const u=moSmooth((t-g.t0)/Math.max(1,g.t1-g.t0));return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u];}
 if(g.k==='path'){return moPts(g.pts,t);}
 if(g.k==='fly'){const u=clamp((t-g.t0)/Math.max(1,g.t1-g.t0),0,1);if(g.pts){const p=moPts(g.pts,t);if(g.p0){/* 始点のずれを最初の区間でなくす */const q0=g.pts[0];const k=Math.max(0,1-u/0.18);p[0]+=(g.p0[0]-q0.x)*k;p[1]+=(g.p0[1]-q0.y)*k;p[2]+=(g.p0[2]-q0.z)*k;}return p;}
  const p0=g.p0||(g.from&&g.from.p)||[0,0,1.5],p1=g.to;const T=(g.t1-g.t0)/1000*(ctx.ts||1);const gr=g.g==null?9.8:g.g;const vz=T>0?((p1[2]-p0[2])+0.5*gr*T*T)/T:0;const tt=u*T;
  return [p0[0]+(p1[0]-p0[0])*u,p0[1]+(p1[1]-p0[1])*u,p0[2]+vz*tt-0.5*gr*tt*tt];}
 return null;}
function moPts(P,t){if(t<=P[0].t)return [P[0].x,P[0].y,P[0].z||0];for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i];if(t<=b.t){const u=b.t===a.t?1:(t-a.t)/(b.t-a.t);return [a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,(a.z||0)+((b.z||0)-(a.z||0))*u];}}const l=P[P.length-1];return [l.x,l.y,l.z||0];}
/* イベント：前回から今回までに起きたものを一度だけ返す（巻き戻したときは位置だけ合わせて発火しない） */
function moBallEvents(B,t){if(t<B.cur){B.cur=t;return [];}const out=B.ev.filter(e=>e.t>B.cur&&e.t<=t);B.cur=t;return out;}
/* 場面の1コマ：全員の姿勢→ボール→イベント。ctx={ents:{key:ent},rig:key=>rig,ball:B,ts} */
function moFrame(ctx,t){if(ctx.ball)moBallResolve(ctx.ball,ctx);const out={};for(const k in ctx.ents){const ent=ctx.ents[k];const rig=ctx.rig(k);if(!rig||!ent.segs||!ent.segs.length)continue;const st=moEval(ent,t);if(!st)continue;moApply(rig,st,ent,t);out[k]=st;}
 const bp=ctx.ball?moBallPos(ctx.ball,t,ctx):null;const ev=ctx.ball?moBallEvents(ctx.ball,t):[];return {st:out,ball:bp,ev};}
