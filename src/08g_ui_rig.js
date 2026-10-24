/* ================= リアル体型の選手モデル（スキンメッシュ：関節で滑らかに曲がる） =================
 R3Rig（パワプロ風2頭身）と同じインターフェース（j, apply, at, face, setColors, setHelmet, setNumber, handPos, bat, glove）に
 setGear（捕手装備・審判マスク）を追加。ユニフォームはチームごとに生成するテクスチャ（アトラス）で描く：
 ピンストライプ／前立て／袖ライン／ラグラン／胸バンド、胸文字、背番号、帽子マーク。
 骨格：hips → torso → chest → head / rSh→rEl→rHand / lSh→lEl→lHand、hips → rHip→rKnee / lHip→lKnee。 */
const RR={HIPS:0.93,TH:0.44,SH:0.42,UA:0.30,FA:0.27,HAND:0.17,TORSO:0.02,CHEST:0.22,NECK:0.30,SHX:0.19,SHY:0.25,HIPX:0.10,HIPY:-0.04};
const RR_SKIN=['#efc29b','#e8b78d','#e0ad84','#d6a079','#cb9570','#f1c7a4'];
const RR_BONES=['hips','torso','chest','head','rSh','rEl','rHand','lSh','lEl','lHand','rHip','rKnee','lHip','lKnee'];
const RR_MAT={uni:0,skin:1,belt:2,hands:3,sock:4};
/* アトラスの行割り（0=上）：胸〜裾 0〜0.40、袖 0.42〜0.50、ズボン 0.52〜1.0 */
const RR_UV={J0:0.0,J1:0.40,S0:0.42,S1:0.50,P0:0.52,P1:1.0};
let RR_GEO=null,RR_FACE=null,RR_BUMP=null;const RR_ATLAS={},RR_MARK={};
function r3MatP(c,opt){const k='P'+String(c)+(opt?JSON.stringify(opt):'');if(!R3_MATS[k]){const o=Object.assign({color:new THREE.Color(c),roughness:0.85,metalness:0},opt||{});if(R3.env){o.envMap=R3.env;o.envMapIntensity=o.envMapIntensity||0.35;}R3_MATS[k]=new THREE.MeshStandardMaterial(o);}return R3_MATS[k];}
/* 体の筒を積み上げて1つのジオメトリにする。
 ring={y,x,z,rx,rz,w:[[boneIdx,weight],...],m:materialSlot,row:アトラス行(0..1),useam:継ぎ目の角度,udir:向き} */
function rrBuildBody(){if(RR_GEO)return RR_GEO;const B=i=>RR_BONES.indexOf(i);const NB=RR_BONES.length;
 const pos=[],uv=[],col=[],skinI=[],skinW=[],byMat={};let nv=0;const seamPairs=[];
 /* 制御リングを Catmull-Rom で細かく補間してから筒を作る（輪郭と関節の曲がりが滑らかになる）。shape=超楕円の指数（2=楕円、大きいほど角が丸い四角） */
 const cr=(p0,p1,p2,p3,t)=>{const t2=t*t,t3=t2*t;return 0.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t2+(-p0+3*p1-3*p2+p3)*t3);};
 const dense=(rings)=>{const out=[];const n=rings.length;const W=rings.map(r=>{const w=new Array(NB).fill(0);for(const [bi,wv] of r.w)w[bi]+=wv;const sm=w.reduce((a,b)=>a+b,0)||1;return w.map(v=>v/sm);});
  for(let i=0;i<n-1;i++){const r0=rings[Math.max(0,i-1)],r1=rings[i],r2=rings[i+1],r3=rings[Math.min(n-1,i+2)];const steps=Math.max(1,Math.round(Math.abs(r2.y-r1.y)/0.018));
   for(let k=0;k<steps;k++){const t=k/steps;const q={};for(const key of ['y','x','z','rx','rz','row'])q[key]=cr(r0[key]||0,r1[key]||0,r2[key]||0,r3[key]||0,t);
    const w=[];for(let bI=0;bI<NB;bI++){const v=cr(W[Math.max(0,i-1)][bI],W[i][bI],W[i+1][bI],W[Math.min(n-1,i+2)][bI],t);if(v>0.001)w.push([bI,v]);}w.sort((a,b)=>b[1]-a[1]);q.w=w.slice(0,4);
    q.m=r1.m;q.useam=r1.useam||0;q.shape=r1.shape||rings[0].shape||2;q.ao=rings[0].ao;q.rx=Math.max(0.002,q.rx);q.rz=Math.max(0.002,q.rz);out.push(q);}}
  const l=rings[n-1];out.push(Object.assign({},l,{w:W[n-1].map((v,bI)=>[bI,v]).filter(x=>x[1]>0.001).sort((a,b)=>b[1]-a[1]).slice(0,4),useam:l.useam||0,shape:l.shape||rings[0].shape||2,ao:rings[0].ao}));return out;};
 const tube=(rings,segs)=>{rings=dense(rings);const base=nv;rings.forEach(r=>{const ws=r.w.slice(0,4);while(ws.length<4)ws.push([0,0]);const sum=ws.reduce((a,b)=>a+b[1],0)||1;const ex=2/(r.shape||2);
   for(let i=0;i<=segs;i++){const ii=i%segs;const a=(r.useam||0)+ii/segs*Math.PI*2;const c=Math.cos(a),sn=Math.sin(a);const cx=Math.sign(c)*Math.pow(Math.abs(c),ex),cz=Math.sign(sn)*Math.pow(Math.abs(sn),ex);
    const px=(r.x||0)+cx*r.rx,pz=(r.z||0)+cz*r.rz;pos.push(px,r.y,pz);const u=i===segs?1:ii/segs;uv.push(u,1-(r.row==null?0.5:r.row));for(const w of ws){skinI.push(w[0]);skinW.push(w[1]/sum);}
    /* 簡易アンビエントオクルージョン：脇の下・股・首の下・体の内側を少し暗く */let ao=1;const inner=Math.abs(px)<Math.abs(r.x||0)*0.999;
    if(r.ao==='leg'){const k=Math.max(0,(r.y-0.72)/0.2);ao-=k*(inner?0.42:0.14);}else if(r.ao==='arm'){const k=Math.max(0,(r.y-1.32)/0.14);ao-=k*(inner?0.45:0.1);if(r.y<1.36&&r.y>1.0&&inner)ao-=0.08;}
    else if(r.ao==='torso'){if(r.y>1.47)ao-=0.3*Math.min(1,(1.56-r.y)/0.09);else if(r.y>1.3&&Math.abs(px)>0.14)ao-=0.3*Math.min(1,(Math.abs(px)-0.14)/0.05);if(r.y<0.9)ao-=0.25*Math.min(1,(0.9-r.y)/0.1);}
    ao=Math.max(0.5,ao);col.push(ao,ao,ao);if(i===segs)seamPairs.push([nv-segs,nv]);nv++;}});
  const n1=segs+1;for(let k=0;k<rings.length-1;k++){const m=rings[k].m;const arr=byMat[m]||(byMat[m]=[]);const a0=base+k*n1,b0=a0+n1;for(let i=0;i<segs;i++){const i2=i+1;arr.push(a0+i,b0+i,a0+i2, a0+i2,b0+i,b0+i2);}}};
 const H=B('hips'),T=B('torso'),C=B('chest'),HD=B('head');
 const jrow=y=>RR_UV.J0+(1.462-y)/(1.462-1.03)*(RR_UV.J1-RR_UV.J0);const prow=y=>RR_UV.P0+(0.985-y)/(0.985-0.03)*(RR_UV.P1-RR_UV.P0);
 const SEAM=0;/* 胴の継ぎ目は左脇（+x）：正面(+z)がu=0.25、右脇がu=0.5、背中がu=0.75 */
 /* 胴体（骨盤→腰→胸→肩→首）：断面は角の丸い四角（背中は平ら、胸は丸い） */
 tube([
  {y:0.79,rx:0.02,rz:0.015,w:[[H,1]],m:RR_MAT.uni,row:prow(0.80),useam:SEAM,shape:2.4,ao:'torso'},
  {y:0.82,rx:0.12,rz:0.085,w:[[H,1]],m:RR_MAT.uni,row:prow(0.82),useam:SEAM,shape:2.4},
  {y:0.87,rx:0.158,rz:0.104,w:[[H,1]],m:RR_MAT.uni,row:prow(0.87),useam:SEAM,shape:2.4},
  {y:0.93,rx:0.166,rz:0.11,w:[[H,1]],m:RR_MAT.uni,row:prow(0.93),useam:SEAM,shape:2.4},
  {y:0.985,rx:0.158,rz:0.104,w:[[H,0.55],[T,0.45]],m:RR_MAT.belt,row:prow(0.985),useam:SEAM,shape:2.4},
  {y:1.03,rx:0.15,rz:0.1,w:[[T,1]],m:RR_MAT.uni,row:jrow(1.03),useam:SEAM,shape:2.4},
  {y:1.12,rx:0.146,rz:0.098,w:[[T,0.5],[C,0.5]],m:RR_MAT.uni,row:jrow(1.12),useam:SEAM,shape:2.4},
  {y:1.22,rx:0.16,rz:0.108,w:[[C,1]],m:RR_MAT.uni,row:jrow(1.22),useam:SEAM,shape:2.5},
  {y:1.32,rx:0.182,rz:0.122,w:[[C,1]],m:RR_MAT.uni,row:jrow(1.32),useam:SEAM,shape:2.6},
  {y:1.39,rx:0.198,rz:0.12,w:[[C,1]],m:RR_MAT.uni,row:jrow(1.39),useam:SEAM,shape:2.6},
  {y:1.43,rx:0.192,rz:0.108,w:[[C,1]],m:RR_MAT.uni,row:jrow(1.43),useam:SEAM,shape:2.4},
  {y:1.455,rx:0.13,rz:0.088,w:[[C,1]],m:RR_MAT.uni,row:jrow(1.455),useam:SEAM,shape:2.2},
  {y:1.465,rx:0.085,rz:0.072,w:[[C,1]],m:RR_MAT.skin,row:jrow(1.462),useam:SEAM,shape:2},
  {y:1.49,rx:0.06,rz:0.058,w:[[C,0.5],[HD,0.5]],m:RR_MAT.skin,row:0.5,useam:SEAM,shape:2},
  {y:1.56,rx:0.062,rz:0.062,w:[[HD,1]],m:RR_MAT.skin,row:0.5,useam:SEAM,shape:2},
 ],32);
 /* 脚：腰から足首まで1本の筒。外側がu=0.5（サイドライン） */
 for(const s of ['r','l']){const sg=s==='r'?-1:1;const TH=B(s+'Hip'),SHN=B(s+'Knee');const x=sg*RR.HIPX;const seam=sg<0?0:Math.PI;
  tube([
   {y:0.96,x:x*0.6,rx:0.06,rz:0.07,w:[[H,1]],m:RR_MAT.uni,row:prow(0.96),useam:seam,shape:2.2,ao:'leg'},
   {y:0.92,x:x*0.85,rx:0.09,rz:0.1,w:[[H,0.8],[TH,0.2]],m:RR_MAT.uni,row:prow(0.92),useam:seam,shape:2.2},
   {y:0.87,x,rx:0.094,rz:0.102,w:[[H,0.45],[TH,0.55]],m:RR_MAT.uni,row:prow(0.87),useam:seam,shape:2.2},
   {y:0.80,x,rx:0.091,rz:0.098,w:[[TH,1]],m:RR_MAT.uni,row:prow(0.80),useam:seam,shape:2.2},
   {y:0.68,x,rx:0.083,rz:0.088,w:[[TH,1]],m:RR_MAT.uni,row:prow(0.68),useam:seam,shape:2.2},
   {y:0.56,x,rx:0.072,rz:0.076,w:[[TH,1]],m:RR_MAT.uni,row:prow(0.56),useam:seam,shape:2.2},
   {y:0.49,x,rx:0.066,rz:0.069,w:[[TH,0.72],[SHN,0.28]],m:RR_MAT.uni,row:prow(0.49),useam:seam,shape:2.1},
   {y:0.45,x,rx:0.064,rz:0.068,w:[[TH,0.5],[SHN,0.5]],m:RR_MAT.uni,row:prow(0.45),useam:seam,shape:2.1},
   {y:0.41,x,rx:0.064,rz:0.069,w:[[TH,0.25],[SHN,0.75]],m:RR_MAT.uni,row:prow(0.41),useam:seam,shape:2.1},
   {y:0.35,x,rx:0.067,rz:0.073,w:[[SHN,1]],m:RR_MAT.uni,row:prow(0.35),useam:seam,shape:2.1},
   {y:0.25,x,rx:0.06,rz:0.064,w:[[SHN,1]],m:RR_MAT.uni,row:prow(0.25),useam:seam,shape:2.1},
   {y:0.14,x,rx:0.049,rz:0.051,w:[[SHN,1]],m:RR_MAT.uni,row:prow(0.14),useam:seam,shape:2.1},
   {y:0.09,x,rx:0.045,rz:0.047,w:[[SHN,1]],m:RR_MAT.sock,row:0.5,useam:seam,shape:2.1},
   {y:0.05,x,rx:0.041,rz:0.043,w:[[SHN,1]],m:RR_MAT.sock,row:0.5,useam:seam,shape:2.1},
   {y:0.03,x,rx:0.02,rz:0.02,w:[[SHN,1]],m:RR_MAT.sock,row:0.5,useam:seam,shape:2},
  ],22);}
 /* 腕：肩（三角筋）→上腕→前腕→手 を1本の筒で */
 for(const s of ['r','l']){const sg=s==='r'?-1:1;const UA=B(s+'Sh'),FA=B(s+'El'),HA=B(s+'Hand');const x=sg*RR.SHX;const srow=y=>RR_UV.S0+(1.465-y)/(1.465-1.265)*(RR_UV.S1-RR_UV.S0);
  tube([
   {y:1.458,x:x-sg*0.04,rx:0.02,rz:0.02,w:[[C,1]],m:RR_MAT.uni,row:srow(1.465),shape:2,ao:'arm'},
   {y:1.452,x:x-sg*0.022,rx:0.052,rz:0.05,w:[[C,1]],m:RR_MAT.uni,row:srow(1.465),shape:2},
   {y:1.44,x:x-sg*0.008,rx:0.072,rz:0.068,w:[[C,1]],m:RR_MAT.uni,row:srow(1.455),shape:2},
   {y:1.425,x,rx:0.074,rz:0.07,w:[[C,0.6],[UA,0.4]],m:RR_MAT.uni,row:srow(1.43),shape:2},
   {y:1.39,x,rx:0.068,rz:0.065,w:[[C,0.2],[UA,0.8]],m:RR_MAT.uni,row:srow(1.39),shape:2},
   {y:1.34,x,rx:0.062,rz:0.06,w:[[UA,1]],m:RR_MAT.uni,row:srow(1.34),shape:2},
   {y:1.29,x,rx:0.057,rz:0.055,w:[[UA,1]],m:RR_MAT.uni,row:srow(1.29),shape:2},
   {y:1.265,x,rx:0.054,rz:0.052,w:[[UA,1]],m:RR_MAT.skin,row:srow(1.265),shape:2},
   {y:1.19,x,rx:0.05,rz:0.049,w:[[UA,1]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:1.15,x,rx:0.047,rz:0.046,w:[[UA,0.7],[FA,0.3]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:1.12,x,rx:0.046,rz:0.045,w:[[UA,0.5],[FA,0.5]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:1.09,x,rx:0.046,rz:0.044,w:[[UA,0.25],[FA,0.75]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:1.02,x,rx:0.048,rz:0.046,w:[[FA,1]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:0.93,x,rx:0.039,rz:0.037,w:[[FA,1]],m:RR_MAT.skin,row:0.5,shape:2},
   {y:0.88,x,rx:0.034,rz:0.03,w:[[FA,0.7],[HA,0.3]],m:RR_MAT.hands,row:0.5,shape:2},
   {y:0.85,x,rx:0.033,rz:0.027,w:[[FA,0.5],[HA,0.5]],m:RR_MAT.hands,row:0.5,shape:2.2},
   {y:0.82,x,rx:0.038,rz:0.025,w:[[HA,1]],m:RR_MAT.hands,row:0.5,shape:2.4},
   {y:0.78,x,rx:0.047,rz:0.022,w:[[HA,1]],m:RR_MAT.hands,row:0.5,shape:2.6},
   {y:0.73,x,rx:0.043,rz:0.02,w:[[HA,1]],m:RR_MAT.hands,row:0.5,shape:2.6},
   {y:0.69,x,rx:0.03,rz:0.015,w:[[HA,1]],m:RR_MAT.hands,row:0.5,shape:2.2},
   {y:0.675,x,rx:0.008,rz:0.005,w:[[HA,1]],m:RR_MAT.hands,row:0.5,shape:2},
  ],16);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinI,4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinW,4));
 const idx=[];let start=0;const mats=Object.keys(byMat).map(Number).sort((a,b)=>a-b);for(const m of mats){const arr=byMat[m];idx.push(...arr);g.addGroup(start,arr.length,m);start+=arr.length;}
 g.setIndex(idx);g.computeVertexNormals();
 /* 継ぎ目（UVのために複製した頂点）の法線を揃えて折れ目を消す */{const nr=g.attributes.normal;for(const [a,b] of seamPairs){const nx=(nr.getX(a)+nr.getX(b))/2,ny=(nr.getY(a)+nr.getY(b))/2,nz=(nr.getZ(a)+nr.getZ(b))/2;const l=Math.hypot(nx,ny,nz)||1;nr.setXYZ(a,nx/l,ny/l,nz/l);nr.setXYZ(b,nx/l,ny/l,nz/l);}nr.needsUpdate=true;}
 g.computeBoundingSphere();RR_GEO=g;return g;}
/* ---- 布の凹凸（共通バンプマップ） ---- */
function rrBump(){if(RR_BUMP)return RR_BUMP;const N=512;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,N,N);
 let sd=11;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff;};
 for(let i=0;i<260;i++){const x=rnd()*N,y=rnd()*N,r=12+rnd()*60;const gr=g.createRadialGradient(x,y,0,x,y,r);const v=rnd()<0.5?110:150;gr.addColorStop(0,`rgba(${v},${v},${v},0.5)`);gr.addColorStop(1,'rgba(128,128,128,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
 for(let i=0;i<4000;i++){const v=118+Math.floor(rnd()*20);g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(rnd()*N,rnd()*N,1.5,1.5);}
 const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);RR_BUMP=t;return t;}
/* ---- チームのユニフォーム定義を正規化 ---- */
function rrUniform(c){c=c||{};return {base:c.base||'#f4f4f4',trim:c.trim||'#223',cap:c.cap||c.trim||'#223',capBrim:c.capBrim||c.cap||c.trim||'#223',pants:c.pants||'#f4f4f4',style:c.style||'plain',text:c.text||'',textFont:c.textFont||'graduate',textColor:c.textColor||c.trim||'#223',textOutline:c.textOutline||c.base||'#fff',numFont:c.numFont||'oswald',numColor:c.numColor||c.trim||'#223',numOutline:c.numOutline||c.base||'#fff',mark:c.mark||(c.text?[...c.text][0]:''),emblem:c.emblem||null};}
function rrFont(id){try{return fontCss(id);}catch(e){return 'sans-serif';}}
/* ユニフォームのアトラス（チームごとにキャッシュ） */
function rrAtlas(u){const key=[u.base,u.trim,u.pants,u.style].join('|');if(RR_ATLAS[key])return RR_ATLAS[key];
 const N=1024;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
 const J0=RR_UV.J0*N,J1=RR_UV.J1*N,S0=RR_UV.S0*N,S1=RR_UV.S1*N,P0=RR_UV.P0*N,P1=RR_UV.P1*N;
 let sd=5;const rnd=()=>{sd=(sd*1103515245+12345)&0x7fffffff;return sd/0x7fffffff;};
 const weave=(y0,y1)=>{g.fillStyle='rgba(0,0,0,.045)';for(let y=y0;y<y1;y+=3)g.fillRect(0,y,N,1);g.fillStyle='rgba(255,255,255,.05)';for(let i=0;i<2500;i++)g.fillRect(rnd()*N,y0+rnd()*(y1-y0),1.5,1.5);};
 /* ジャージ本体 */g.fillStyle=u.base;g.fillRect(0,J0,N,J1-J0);
 if(u.style==='pin'){g.fillStyle=u.trim;for(let x=8;x<N;x+=26)g.fillRect(x,J0,2.2,J1-J0);}
 if(u.style==='band'){g.fillStyle=u.trim;g.fillRect(0,J0+(J1-J0)*0.30,N*0.5,(J1-J0)*0.22);}
 if(u.style==='raglan'){g.fillStyle=u.trim;for(const cx of [0,N*0.5,N]){g.beginPath();g.moveTo(cx-150,J0);g.lineTo(cx+150,J0);g.lineTo(cx,J0+95);g.closePath();g.fill();}}
 /* 前立て（正面 u=0.25 → x=256） */{const x=N*0.25;if(u.style==='placket'){g.fillStyle=u.trim;g.fillRect(x-9,J0,18,J1-J0);g.fillStyle=u.base;g.fillRect(x-5,J0,10,J1-J0);}
  g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=1.5;g.beginPath();g.moveTo(x,J0+10);g.lineTo(x,J1);g.stroke();
  for(let k=0;k<5;k++){const y=J0+48+k*68;g.fillStyle='#f3f1ea';g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();g.strokeStyle='rgba(0,0,0,.45)';g.lineWidth=1;g.stroke();}}
 /* 襟（上端の縁取り） */g.fillStyle=u.trim;g.fillRect(0,J0,N,13);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(0,J0+13,N,3);
 weave(J0,J1);
 /* 袖 */g.fillStyle=u.style==='raglan'?u.trim:u.base;g.fillRect(0,S0,N,S1-S0);
 if(u.style==='sleeve'){g.fillStyle=u.trim;g.fillRect(0,S1-26,N,26);g.fillStyle=u.base;g.fillRect(0,S1-16,N,4);}
 else if(u.style==='pin'){g.fillStyle=u.trim;for(let x=8;x<N;x+=26)g.fillRect(x,S0,2.2,S1-S0);g.fillRect(0,S1-8,N,8);}
 else if(u.style!=='plain'&&u.style!=='raglan'){g.fillStyle=u.trim;g.fillRect(0,S1-9,N,9);}
 weave(S0,S1);
 /* ズボン：サイドライン（u=0.5 → x=512）とベルト通し */g.fillStyle=u.pants;g.fillRect(0,P0,N,P1-P0);
 if(u.style!=='plain'){g.fillStyle=u.trim;g.fillRect(N*0.5-7,P0+30,14,P1-P0-30);if(u.style==='pin'||u.style==='placket'){g.fillStyle=u.pants;g.fillRect(N*0.5-2,P0+30,4,P1-P0-30);}}
 g.fillStyle='rgba(0,0,0,.25)';for(const x of [N*0.12,N*0.37,N*0.62,N*0.87])g.fillRect(x-6,P0,12,22);
 weave(P0,P1);
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=R3.renderer?Math.min(8,R3.renderer.capabilities.getMaxAnisotropy()):4;t.wrapS=THREE.RepeatWrapping;
 const mat=new THREE.MeshStandardMaterial({map:t,bumpMap:rrBump(),bumpScale:0.004,roughness:0.9,metalness:0,envMap:R3.env||null,envMapIntensity:0.2,vertexColors:true});RR_ATLAS[key]={tex:t,mat};return RR_ATLAS[key];}
/* 帽子マーク（チーム名の頭文字） */
function rrMark(u){const key=[u.mark,u.cap,u.trim,u.base].join('|');if(RR_MARK[key])return RR_MARK[key];const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const col=u.cap===u.base?u.trim:u.base;if(u.mark){g.font='700 86px "Dela Gothic One","Noto Sans JP",sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=10;g.strokeStyle=u.trim===u.cap?'rgba(255,255,255,.9)':u.trim;g.strokeText(u.mark,64,70);g.fillStyle=col;g.fillText(u.mark,64,70);}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;RR_MARK[key]=t;return t;}
/* 顔のテクスチャ（肌色＋目・眉・鼻・口・頬）。球の正面は u=0.25、目は赤道 */
function rrFaceTex(skin){if(RR_FACE&&RR_FACE[skin])return RR_FACE[skin];RR_FACE=RR_FACE||{};const cv=document.createElement('canvas');cv.width=512;cv.height=256;const g=cv.getContext('2d');
 const base=new THREE.Color(skin);g.fillStyle=skin;g.fillRect(0,0,512,256);
 const shade=(k)=>'#'+base.clone().multiplyScalar(k).getHexString();
 /* 坊主頭：頭頂〜後頭部をやや暗く（髪の青み） */{const gr=g.createLinearGradient(0,0,0,110);gr.addColorStop(0,'rgba(60,45,40,.55)');gr.addColorStop(0.6,'rgba(60,45,40,.35)');gr.addColorStop(1,'rgba(60,45,40,0)');g.fillStyle=gr;g.fillRect(0,0,512,110);
  g.fillStyle='rgba(60,45,40,.28)';g.fillRect(256,0,256,150);/* 後頭部 */g.fillRect(0,0,70,150);g.fillRect(442,0,70,150);}
 const ex=128,ey=128;
 /* 眉 */for(const sg of [-1,1]){const x=ex+sg*28;g.strokeStyle='#2a1c14';g.lineWidth=4.5;g.lineCap='round';g.beginPath();g.moveTo(x-sg*16,ey-20);g.quadraticCurveTo(x,ey-26,x+sg*14,ey-21);g.stroke();}
 /* 目 */for(const sg of [-1,1]){const x=ex+sg*27;
  g.fillStyle='rgba(120,70,50,.25)';g.beginPath();g.ellipse(x,ey+2,16,9,0,0,Math.PI*2);g.fill();
  g.fillStyle='#f8f3ee';g.beginPath();g.ellipse(x,ey,13,6.5,0,0,Math.PI*2);g.fill();
  g.fillStyle='#3b2416';g.beginPath();g.arc(x+sg*1,ey+0.5,5.2,0,Math.PI*2);g.fill();g.fillStyle='#120a06';g.beginPath();g.arc(x+sg*1,ey+0.5,2.6,0,Math.PI*2);g.fill();
  g.fillStyle='rgba(255,255,255,.8)';g.beginPath();g.arc(x+sg*1-1.5,ey-1.5,1.3,0,Math.PI*2);g.fill();
  g.strokeStyle='#2a1a12';g.lineWidth=2.2;g.beginPath();g.ellipse(x,ey-1,13.5,7,0,Math.PI,Math.PI*2);g.stroke();}
 /* 鼻 */{g.fillStyle='rgba(90,50,30,.22)';g.beginPath();g.moveTo(ex-3,ey+6);g.quadraticCurveTo(ex-9,ey+30,ex-10,ey+34);g.quadraticCurveTo(ex,ey+40,ex+10,ey+34);g.quadraticCurveTo(ex+5,ey+28,ex+3,ey+6);g.closePath();g.fill();
  g.fillStyle='rgba(60,30,20,.45)';g.beginPath();g.ellipse(ex-6,ey+34,3.5,2,0,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(ex+6,ey+34,3.5,2,0,0,Math.PI*2);g.fill();}
 /* 口 */{g.strokeStyle='#8a4a3c';g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(ex-13,ey+56);g.quadraticCurveTo(ex,ey+61,ex+13,ey+56);g.stroke();g.fillStyle='rgba(200,120,110,.35)';g.beginPath();g.moveTo(ex-13,ey+56);g.quadraticCurveTo(ex,ey+66,ex+13,ey+56);g.quadraticCurveTo(ex,ey+60,ex-13,ey+56);g.fill();}
 /* 頬・顎の影 */g.fillStyle='rgba(200,90,70,.10)';g.beginPath();g.ellipse(ex-40,ey+28,18,12,0,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(ex+40,ey+28,18,12,0,0,Math.PI*2);g.fill();
 g.fillStyle='rgba(60,35,25,.14)';g.fillRect(0,ey+80,512,60);
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;RR_FACE[skin]=t;return t;}
let RR_N=0;
class R3RigReal{
 constructor(){this.g=new THREE.Group();this.j={};this.col=null;this.uni=null;this.pose=null;this.helmet=false;this.gear=null;this.skin=RR_SKIN[(RR_N++)%RR_SKIN.length];this.mirrored=false;this.build();}
 build(){this.buildBody();this.buildGear();}
 /* 手続き生成の体（スキンメッシュ）。GLB版（R3RigGL）はここを置き換える */
 buildBody(){const G=this.g,j=this.j;const bone=(p,x,y,z)=>{const b=new THREE.Bone();b.position.set(x,y,z);p.add(b);return b;};
  j.hips=bone(G,0,RR.HIPS,0);j.torso=bone(j.hips,0,RR.TORSO,0);j.chest=bone(j.torso,0,RR.CHEST,0);j.head=bone(j.chest,0,RR.NECK,0);
  for(const s of ['r','l']){const sg=s==='r'?-1:1;j[s+'Sh']=bone(j.chest,sg*RR.SHX,RR.SHY,0);j[s+'El']=bone(j[s+'Sh'],0,-RR.UA,0);j[s+'Hand']=bone(j[s+'El'],0,-RR.FA,0);
   j[s+'Hip']=bone(j.hips,sg*RR.HIPX,RR.HIPY,0);j[s+'Knee']=bone(j[s+'Hip'],0,-RR.TH,0);}
  G.updateMatrixWorld(true);
  const bones=RR_BONES.map(k=>j[k]);const skel=new THREE.Skeleton(bones);
  const mats=[];for(let i=0;i<5;i++)mats.push(r3MatP('#ffffff'));
  const body=this.body=new THREE.SkinnedMesh(rrBuildBody(),mats);body.castShadow=true;body.receiveShadow=true;body.frustumCulled=false;G.add(body);body.bind(skel,new THREE.Matrix4());
  /* 装備の取り付け寸法：頭の中心・半径、胸の半径、すね長、手首→拳 */
  this.dim={hipsY:RR.HIPS,headCy:0.13,headCz:0,headR:0.105,chestR:0.123,chestY:0.12,textY:0.13,shin:RR.SH,palm:0.12,fist:0.075,L1:RR.UA,L2:RR.FA,hasHead:false,hasFeet:false,hasHands:false};
  const mesh=(p,geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;};
  /* 頭（楕円体＋顔テクスチャ）・耳 */
  this.headM=mesh(j.head,r3Geo('rhead',()=>{const g=new THREE.SphereGeometry(0.1,32,24);g.scale(0.95,1.15,1.03);return g;}),new THREE.MeshStandardMaterial({map:rrFaceTex(this.skin),roughness:0.55,metalness:0,envMap:R3.env||null,envMapIntensity:0.3}));this.headM.position.y=0.13;
  for(const sg of [-1,1]){const e=mesh(j.head,r3Geo('rear',()=>{const g=new THREE.SphereGeometry(0.023,10,8);g.scale(0.5,1,0.8);return g;}),r3MatP(this.skin,{roughness:0.62}));e.position.set(sg*0.096,0.125,-0.005);}}
 /* 装備・小物：帽子・ヘルメット・マスク・プロテクター・靴・グラブ・バット・背番号。dim に合わせて拡縮する */
 buildGear(){const G=this.g,j=this.j;const D=this.dim;const mesh=(p,geo,mat)=>{const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;p.add(m);return m;};
  const hs=D.headR/0.105;const HG=this.headG=new THREE.Group();HG.position.set(0,D.headCy,D.headCz||0);HG.scale.setScalar(hs);j.head.add(HG);const hy=y=>y-0.13;
  /* 帽子（クラウン＋つば＋マーク）・ヘルメット（耳当て付き） */
  this.capM=mesh(HG,r3Geo('rcap',()=>{const g=new THREE.SphereGeometry(0.112,28,14,0,Math.PI*2,0,Math.PI*0.56);g.scale(1,0.82,1.06);return g;}),r3MatP('#333'));this.capM.position.set(0,hy(0.178),0.0);this.capM.rotation.x=0.1;
  this.brimM=mesh(HG,r3Geo('rbrim',()=>{const g=new THREE.CylinderGeometry(0.118,0.118,0.009,24,1,false,-Math.PI*0.42,Math.PI*0.84);g.scale(1,1,1.7);return g;}),r3MatP('#333'));this.brimM.position.set(0,hy(0.188),0.03);this.brimM.rotation.x=0.26;
  this.btnM=mesh(HG,r3Sph(0.012),r3MatP('#333'));this.btnM.position.set(0,hy(0.268),-0.005);
  this.markM=new THREE.Mesh(r3Geo('rmark',()=>new THREE.PlaneGeometry(0.06,0.06)),new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false}));this.markM.position.set(0,hy(0.205),0.106);this.markM.rotation.x=-0.35;this.markM.castShadow=false;HG.add(this.markM);
  this.helmetM=mesh(HG,r3Geo('rhelm',()=>{const a=new THREE.SphereGeometry(0.118,28,16,0,Math.PI*2,0,Math.PI*0.53);a.scale(1,0.95,1.08);const b=new THREE.SphereGeometry(0.118,28,16,Math.PI*0.9,Math.PI*1.2,Math.PI*0.5,Math.PI*0.24);b.scale(1,0.95,1.08);
   const pa=a.attributes.position.array,pb=b.attributes.position.array;const pos=new Float32Array(pa.length+pb.length);pos.set(pa);pos.set(pb,pa.length);const ia=a.index.array,ib=b.index.array;const na=pa.length/3;const idx=new Uint16Array(ia.length+ib.length);idx.set(ia);for(let i=0;i<ib.length;i++)idx[ia.length+i]=ib[i]+na;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeVertexNormals();return g;}),r3MatP('#333',{roughness:0.3}));this.helmetM.position.set(0,hy(0.172),0.0);this.helmetM.visible=false;
  this.hbrimM=mesh(HG,r3Geo('rhbrim',()=>{const g=new THREE.CylinderGeometry(0.118,0.118,0.012,24,1,false,-Math.PI*0.4,Math.PI*0.8);g.scale(1,1,1.3);return g;}),r3MatP('#333',{roughness:0.3}));this.hbrimM.position.set(0,hy(0.185),0.035);this.hbrimM.rotation.x=0.18;this.hbrimM.visible=false;
  this.flapM=mesh(HG,r3Geo('rflap',()=>{const g=new THREE.SphereGeometry(0.045,12,10);g.scale(0.45,1.25,1.1);return g;}),r3MatP('#333',{roughness:0.3}));this.flapM.position.set(0.108,hy(0.115),0.012);this.flapM.visible=false;
  /* 捕手・審判のマスク（金属バー＋パッド） */
  this.maskG=new THREE.Group();HG.add(this.maskG);this.maskG.position.set(0,0,0.0);this.maskG.visible=false;
  {const bar=r3MatP('#2a2d33',{roughness:0.4,metalness:0.6});const pad=r3MatP('#1c1c1e',{roughness:0.9});
   for(const y of [-0.055,-0.02,0.015,0.05]){const t=new THREE.Mesh(r3Geo('rmbar',()=>new THREE.TorusGeometry(0.105,0.004,6,20,Math.PI)),bar);t.position.set(0,y,0.02);t.rotation.set(0,0,Math.PI);t.rotation.y=Math.PI/2;t.rotation.x=0;t.castShadow=false;this.maskG.add(t);}
   for(const x of [-0.03,0.03]){const v=new THREE.Mesh(r3Geo('rmv',()=>new THREE.CylinderGeometry(0.0035,0.0035,0.15,6)),bar);v.position.set(x,0,0.118);v.castShadow=false;this.maskG.add(v);}
   const chin=new THREE.Mesh(r3Geo('rmchin',()=>{const g=new THREE.TorusGeometry(0.1,0.02,8,24,Math.PI*0.9);g.rotateZ(Math.PI*1.05);return g;}),pad);chin.position.set(0,-0.03,0.035);this.maskG.add(chin);
   const fore=new THREE.Mesh(r3Geo('rmfore',()=>{const g=new THREE.TorusGeometry(0.105,0.018,8,24,Math.PI*0.8);g.rotateZ(Math.PI*0.1);return g;}),pad);fore.position.set(0,0.07,0.03);this.maskG.add(fore);}
  /* 捕手のプロテクター・レガース（胸・すねの寸法に合わせる） */
  const cs=D.chestR/0.123;const CG=this.chestG=new THREE.Group();CG.scale.setScalar(cs);j.chest.add(CG);
  this.protM=mesh(CG,r3Geo('rprot',()=>{const g=new THREE.SphereGeometry(0.2,20,14,0,Math.PI,0.2,Math.PI*0.62);g.scale(0.95,1.05,0.55);return g;}),r3MatP('#1f2a44',{roughness:0.8}));this.protM.position.set(0,0.09,0.05);this.protM.rotation.y=-Math.PI/2;this.protM.visible=false;if(D.hasHead){this.protM.scale.set(1.25,1.15,1.6);}
  this.throatM=mesh(CG,r3Geo('rthroat',()=>{const g=new THREE.CylinderGeometry(0.075,0.075,0.05,14,1,true,-Math.PI*0.45,Math.PI*0.9);return g;}),r3MatP('#1f2a44',{roughness:0.8,side:THREE.DoubleSide}));this.throatM.position.set(0,0.30,0.06);this.throatM.visible=false;
  const ks=D.shin/RR.SH;
  for(const s of ['r','l']){const KG=new THREE.Group();KG.scale.setScalar(ks);j[s+'Knee'].add(KG);const lg=mesh(KG,r3Geo('rleg',()=>{const g=new THREE.CylinderGeometry(0.075,0.062,0.36,14,1,true,-Math.PI*0.5,Math.PI);g.translate(0,-0.19,0);return g;}),r3MatP('#1f2a44',{roughness:0.8,side:THREE.DoubleSide}));lg.position.set(0,0.0,0.01);lg.rotation.y=-Math.PI/2;lg.visible=false;this[s+'LegM']=lg;
   const kn=mesh(KG,r3Geo('rknee',()=>{const g=new THREE.SphereGeometry(0.075,14,10,0,Math.PI,0,Math.PI*0.7);return g;}),r3MatP('#1f2a44',{roughness:0.8}));kn.position.set(0,0.0,0.012);kn.rotation.y=-Math.PI/2;kn.visible=false;this[s+'KneeM']=kn;
   /* 靴（アッパー＋白い靴底）：足のあるモデルでは不要 */
   if(!D.hasFeet){const sh=mesh(KG,r3Geo('rshoe',()=>{const g=new THREE.CapsuleGeometry(0.043,0.16,4,10);g.rotateX(Math.PI/2);g.scale(1.05,0.72,1);g.translate(0,0,0.045);return g;}),r3MatP('#1c1c1e',{roughness:0.5}));sh.position.set(0,-RR.SH+0.004,0.0);this[s+'FootM']=sh;
    const sole=mesh(KG,r3Geo('rsole',()=>{const g=new THREE.BoxGeometry(0.088,0.012,0.26);g.translate(0,0,0.045);return g;}),r3MatP('#e9e7e0',{roughness:0.7}));sole.position.set(0,-RR.SH-0.02,0.0);sole.castShadow=false;}}
  /* グラブ（左手）：本体＋ウェブ＋親指 */
  this.glove=new THREE.Group();j.lHand.add(this.glove);this.glove.position.set(0,-D.palm+0.035,0.03);this.glove.visible=false;
  {const gm=r3MatP('#8b5e34',{roughness:0.7}),gm2=r3MatP('#a8773f',{roughness:0.75});mesh(this.glove,r3Geo('rglove',()=>{const g=new THREE.SphereGeometry(0.11,16,12);g.scale(1,1.25,0.42);return g;}),gm);
   const web=mesh(this.glove,r3Geo('rgweb',()=>{const g=new THREE.BoxGeometry(0.07,0.09,0.012);return g;}),gm2);web.position.set(0.055,0.09,0.0);web.rotation.z=0.5;
   const th=mesh(this.glove,r3Geo('rgthumb',()=>{const g=new THREE.CapsuleGeometry(0.022,0.07,4,8);return g;}),gm);th.position.set(0.085,0.02,0.0);th.rotation.z=0.75;}
  /* 手のひら位置（ボールを握る位置） */this.palm={};for(const s of ['r','l']){const o=new THREE.Object3D();o.position.set(0,-D.palm,0.02);j[s+'Hand'].add(o);this.palm[s]=o;}
  /* バット */
  this.bat=new THREE.Group();G.add(this.bat);mesh(this.bat,r3Geo('batR',()=>{const g=new THREE.CylinderGeometry(0.034,0.014,0.84,18);g.translate(0,0.32,0);return g;}),r3MatP('#d6ab74',{roughness:0.4}));const knob=mesh(this.bat,r3Geo('knob',()=>new THREE.CylinderGeometry(0.035,0.035,0.02,8)),r3MatP('#222'));knob.position.y=-0.1;
  mesh(this.bat,r3Geo('rgrip',()=>{const g=new THREE.CylinderGeometry(0.02,0.019,0.25,10);g.translate(0,0.03,0);return g;}),r3MatP('#2a2a2a',{roughness:0.9}));this.bat.visible=false;
  /* 背番号・胸文字（リグごとのキャンバス。左利きで鏡像になるときは反転して描く）：胴の曲面に沿った帯（楕円柱の一部）に描く */
  this.numCv=document.createElement('canvas');this.numCv.width=this.numCv.height=128;this.numTex=new THREE.CanvasTexture(this.numCv);this.numTex.colorSpace=THREE.SRGBColorSpace;
  this.numM=new THREE.Mesh(r3Geo('rnumcyl',()=>{const g=new THREE.CylinderGeometry(0.123,0.123,0.2,14,1,true,Math.PI-0.62,1.24);g.scale(1.5,1,1);return g;}),new THREE.MeshBasicMaterial({map:this.numTex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));this.numM.position.set(0,D.chestY/cs,0.0);this.numM.castShadow=false;CG.add(this.numM);this.numVal=null;this.numKey=null;
  this.txtCv=document.createElement('canvas');this.txtCv.width=256;this.txtCv.height=96;this.txtTex=new THREE.CanvasTexture(this.txtCv);this.txtTex.colorSpace=THREE.SRGBColorSpace;
  this.txtM=new THREE.Mesh(r3Geo('rtxtcyl',()=>{const g=new THREE.CylinderGeometry(0.121,0.121,0.09,14,1,true,-0.72,1.44);g.scale(1.5,1,1);return g;}),new THREE.MeshBasicMaterial({map:this.txtTex,transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2}));this.txtM.position.set(0,D.textY/cs,0.0);this.txtM.castShadow=false;CG.add(this.txtM);this.txtKey=null;}
 _drawNum(){const u=this.uni;const n=this.numVal;const key=[n,u&&u.numFont,u&&u.numColor,u&&u.numOutline,this.mirrored].join('|');if(key===this.numKey)return;this.numKey=key;const g=this.numCv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,128,128);if(n==null)return;
  if(this.mirrored){g.translate(128,0);g.scale(-1,1);}g.font=`700 92px ${u?rrFont(u.numFont):'Oswald,sans-serif'}`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=8;g.strokeStyle=u?u.numOutline:'#fff';g.strokeText(String(n),64,70);g.fillStyle=u?u.numColor:'#222';g.fillText(String(n),64,70);this.numTex.needsUpdate=true;}
 _drawText(){const u=this.uni;const key=[u&&u.text,u&&u.textFont,u&&u.textColor,u&&u.textOutline,u&&u.style,this.mirrored].join('|');if(key===this.txtKey)return;this.txtKey=key;const g=this.txtCv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,256,96);if(!u||!u.text){this.txtTex.needsUpdate=true;return;}
  if(this.mirrored){g.translate(256,0);g.scale(-1,1);}const len=[...u.text].length;const fs=Math.min(64,Math.max(26,Math.round(250/Math.max(1,len))));g.font=`700 ${fs}px ${rrFont(u.textFont)}`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=6;g.strokeStyle=u.textOutline;g.strokeText(u.text,128,50);g.fillStyle=u.textColor;g.fillText(u.text,128,50);this.txtTex.needsUpdate=true;}
 setNumber(n,col){this.numVal=n;this.numM.visible=n!=null;this._drawNum();}
 setColors(c,helmet){if(this.col!==c){this.col=c;const u=this.uni=rrUniform(c);const m=this.body.material;
   m[RR_MAT.uni]=rrAtlas(u).mat;m[RR_MAT.skin]=r3MatP(this.skin,{roughness:0.6,vertexColors:true});m[RR_MAT.belt]=r3MatP(u.cap&&u.cap!==u.pants?u.cap:'#222',{roughness:0.7,vertexColors:true});m[RR_MAT.sock]=r3MatP(u.cap&&u.cap!==u.base?u.cap:'#f4f4f4',{vertexColors:true});
   const capM=r3MatP(u.cap),brimM=r3MatP(u.capBrim),helmM=r3MatP(u.cap,{roughness:0.3});this.capM.material=capM;this.brimM.material=brimM;this.btnM.material=capM;this.helmetM.material=helmM;this.hbrimM.material=helmM;this.flapM.material=helmM;
   this.markM.material.map=rrMark(u);this.markM.material.needsUpdate=true;this.markM.visible=!!u.mark;
   const prot=r3MatP(u.cap&&u.cap!=='#f4f4f4'?u.cap:'#1f2a44',{roughness:0.8}),prot2=r3MatP(u.cap&&u.cap!=='#f4f4f4'?u.cap:'#1f2a44',{roughness:0.8,side:THREE.DoubleSide});this.protM.material=prot;this.throatM.material=prot2;this.rLegM.material=prot2;this.lLegM.material=prot2;this.rKneeM.material=prot;this.lKneeM.material=prot;
   this.txtM.visible=!!u.text;this._drawText();this._drawNum();}
  this.setHelmet(helmet);}
 setHelmet(on){on=!!on||this.gear==='catcher';if(this.helmet===on&&this._helmetInit)return;this._helmetInit=true;this.helmet=on;this.helmetM.visible=on;this.hbrimM.visible=on;this.flapM.visible=on&&this.gear!=='catcher';this.capM.visible=!on;this.brimM.visible=!on;this.btnM.visible=!on;this.markM.visible=!on&&!!(this.uni&&this.uni.mark);
  /* 打者・走者はバッティンググローブ */if(this.uni)this.body.material[RR_MAT.hands]=on?r3MatP(this.uni.cap||'#222',{roughness:0.6,vertexColors:true}):r3MatP(this.skin,{roughness:0.6,vertexColors:true});}
 /* 装備：null／'catcher'（マスク・プロテクター・レガース・ヘルメット）／'umpire'（マスク） */
 setGear(kind){kind=kind||null;if(this.gear===kind)return;this.gear=kind;const c=kind==='catcher';this.maskG.visible=!!kind;this.protM.visible=c;this.throatM.visible=c;this.rLegM.visible=c;this.lLegM.visible=c;this.rKneeM.visible=c;this.lKneeM.visible=c;
  if(c){this._helmetInit=false;this.setHelmet(true);this.flapM.visible=false;this.glove.visible=false;}}
 /* リグ座標系（g のスケール・位置を除く）でのノードの行列 */
 _localM(node){const M=new THREE.Matrix4();const chain=[];let n=node;while(n&&n!==this.g){chain.unshift(n);n=n.parent;}for(const c of chain){c.updateMatrix();M.multiply(c.matrix);}return M;}
 /* 2関節IK：side の手首を target（リグ座標）へ。pole は肘を向けたい方向のヒント */
 ikArm(side,target,pole){const j=this.j;const sh=j[side+'Sh'],el=j[side+'El'];const L1=this.dim.L1,L2=this.dim.L2;
  const Mp=this._localM(sh.parent);const S=sh.position.clone().applyMatrix4(Mp);const Rp=new THREE.Quaternion().setFromRotationMatrix(Mp);const Rpi=Rp.clone().invert();
  const d=target.clone().sub(S).applyQuaternion(Rpi);let dist=clamp(d.length(),0.08,L1+L2-0.01);
  const cosT=(L1*L1+L2*L2-dist*dist)/(2*L1*L2);const theta=Math.acos(clamp(cosT,-1,1));const f=Math.PI-theta;el.rotation.set(-f,0,0);
  const W0=new THREE.Vector3(0,-L1-L2*Math.cos(f),L2*Math.sin(f)).normalize();const dn=d.clone().normalize();const q=new THREE.Quaternion().setFromUnitVectors(W0,dn);
  const E0=new THREE.Vector3(0,-L1,0).applyQuaternion(q);const pl=(pole||new THREE.Vector3(0,-1,0)).clone().applyQuaternion(Rpi);
  const ep=E0.clone().addScaledVector(dn,-E0.dot(dn)),pp=pl.clone().addScaledVector(dn,-pl.dot(dn));
  if(ep.lengthSq()>1e-6&&pp.lengthSq()>1e-6){ep.normalize();pp.normalize();const ang=Math.atan2(ep.clone().cross(pp).dot(dn),ep.dot(pp));q.premultiply(new THREE.Quaternion().setFromAxisAngle(dn,ang));}
  sh.quaternion.copy(q);}
 apply(p){const j=this.j;for(const k in j)j[k].rotation.set(0,0,0);const hp=this.dim.hipsPos||[0,RR.HIPS,0];j.hips.position.set(hp[0],hp[1]+(p.dy||0),hp[2]+(p.dz||0));
  const mir=this.g.scale.x<0;if(mir!==this.mirrored){this.mirrored=mir;this._drawNum();this._drawText();}
  for(const k in p){const r=p[k];if(!Array.isArray(r))continue;if(k==='torso'){j.torso.rotation.set(r[0]*0.45,r[1]*0.4,r[2]*0.45);j.chest.rotation.set(r[0]*0.55,r[1]*0.6,r[2]*0.55);continue;}const jo=j[k];if(jo)jo.rotation.set(r[0]||0,r[1]||0,r[2]||0);}
  if(this.bat.visible){/* バット：右手（上の手）の拳の位置に握り、左手は2関節IKでグリップ下端へ */
   const Mh=this._localM(j.rHand);const wrist=new THREE.Vector3().setFromMatrixPosition(Mh);const hd=new THREE.Vector3(0,-1,0).transformDirection(Mh);const fist=wrist.clone().addScaledVector(hd,this.dim.fist);
   const d=p.batDir||[0,1,0];const v=new THREE.Vector3(d[0],d[1],d[2]).normalize();this.bat.position.copy(fist).addScaledVector(v,-0.07);this.bat.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v);
   if(p.ik!==false){const grip=this.bat.position.clone();const pole=new THREE.Vector3(0.25,-1,-0.35);this.ikArm('l',grip,pole);
    const Me=this._localM(j.lEl);const fd=new THREE.Vector3(0,-1,0).transformDirection(Me);this.ikArm('l',grip.clone().addScaledVector(fd,-0.07),pole);}}
  this.pose=p;}
 face(dx,dz){this.g.rotation.y=Math.atan2(dx,dz);}
 at(x,y,z){this.g.position.set(x,y,z);}
 handPos(side){const v=new THREE.Vector3();this.palm[side||'r'].getWorldPosition(v);return v;}
}
/* 2頭身リグにも同じメソッドを用意（装備なし） */
R3Rig.prototype.setGear=function(){};
