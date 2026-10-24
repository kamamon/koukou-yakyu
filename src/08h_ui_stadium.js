/* ================= 球場（甲子園風）：段々のスタンド・アルプス・銀傘・バックスクリーン・スコアボード・観客 =================
 極座標：a=本塁から見た角度（0=センター、+が一塁側、±180が本塁後方）、r=本塁からの距離。r3Rin(a) がスタンド最前列の半径。 */
const R3S={zones:[],seats:[],dim:[]};
function r3ZoneOf(a){const A=Math.abs(a);return A<=49?'of':A<117.4?'alps':'in';}
/* 段々のスタンド：a0..a1 の範囲に rows 段。tread=座席面, riser=蹴上げ。座席位置も記録する */
function r3Steps(S,a0,a1,rows,o){const step=o.step||2;const pos=[],col=[],idx=[];let n=0;const tc=new THREE.Color(o.tread),rc=new THREE.Color(o.riser);const dark=o.dark==null?0.78:o.dark;
 const push=(r,h,c)=>{pos.push(r.x,h,r.z);col.push(c.r,c.g,c.b);return n++;};
 const ring=(d,h,c,k)=>{const ids=[];for(let a=a0;a<=a1+1e-6;a+=step){const ri=r3Rin(a)+d;const s=Math.sin(a*Math.PI/180),cs=Math.cos(a*Math.PI/180);ids.push(push({x:ri*s,z:-ri*cs},h,c));}return ids;};
 const quad=(A,B)=>{for(let i=0;i<A.length-1;i++){idx.push(A[i],B[i],A[i+1],A[i+1],B[i],B[i+1]);}};
 const seats=[];const tcDark=tc.clone().multiplyScalar(dark);
 for(let k=0;k<rows;k++){const h=o.h0+k*o.rise;const d0=o.d0+k*o.depth,d1=d0+o.depth;
  const A=ring(d0,h,k%2?tc:tcDark),B=ring(d1,h,k%2?tc:tcDark);quad(A,B);/* 座席面 */
  const C=ring(d1,h+o.rise,rc);quad(B,C);/* 蹴上げ */
  if(o.seats!==false){const dm=d0+o.depth*0.55;for(let a=a0+1;a<a1;a+=o.seatStep||((0.62/((r3Rin(a)+dm)*Math.PI/180))))seats.push({a,d:dm,h:h+0.02,zone:o.zone});}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));m.receiveShadow=true;S.add(m);R3S.dim.push({m,day:0xffffff,night:0x6b7178});R3S.seats.push(...seats);return m;}
function r3Surf(S,a0,a1,step,f0,f1,col,opt){/* 2つの (d,h) プロファイル間の面 */const pos=[],idx=[];let n=0;for(let a=a0;a<=a1+1e-6;a+=step){const s=Math.sin(a*Math.PI/180),cs=Math.cos(a*Math.PI/180);const ri=r3Rin(a);const p0=f0(a),p1=f1(a);pos.push((ri+p0[0])*s,p0[1],-(ri+p0[0])*cs,(ri+p1[0])*s,p1[1],-(ri+p1[0])*cs);if(n>0){const b=(n-1)*2;idx.push(b,b+1,b+2,b+1,b+3,b+2);}n++;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial(Object.assign({color:new THREE.Color(col),side:THREE.DoubleSide},opt||{})));m.receiveShadow=true;m.castShadow=!!(opt&&opt.cast);S.add(m);return m;}
function r3BuildStadium(S){R3S.seats=[];R3S.dim=[];
 /* 外野フェンス（緑のラバー＋黄色いライン＋下段の暗い帯） */
 R3.fence=r3Ribbon(S,a=>FENCE(Math.min(45,Math.abs(a))),-49,49,2,0,3.2,'#1d4a2a');r3Ribbon(S,a=>FENCE(Math.min(45,Math.abs(a)))-0.02,-49,49,2,3.02,3.3,'#f2c53d');r3Ribbon(S,a=>FENCE(Math.min(45,Math.abs(a)))-0.01,-49,49,2,0,0.35,'#15371f');
 /* フェンスのパッドの継ぎ目 */for(let a=-48;a<=48;a+=3){const r=FENCE(Math.min(45,Math.abs(a)))-0.03;const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);const p=new THREE.Mesh(r3Box(0.08,3.0,0.06,1.5),r3Mat('#163b21'));p.position.set(x,0,-y);p.rotation.y=-a*Math.PI/180;S.add(p);}
 /* サイドの低い壁（ベンチ前〜ポール） */for(const sg of [-1,1]){const W1=[sg*13.5,-7],W2=[sg*75.5,65.6];r3WallSeg(S,W1,W2,2.4,'#2f4a38');r3WallSeg(S,[W1[0],W1[1]+0.02],[W2[0],W2[1]+0.02],0.3,'#1d3324');}
 /* バックネット：低い壁＋ネット */r3Ribbon(S,a=>18,117.4,242.6,4,0,2.6,'#2f4a38');
 {const net=r3Ribbon(S,a=>18.2,117.4,242.6,3,2.6,12,'#000000');net.material=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.3,side:THREE.DoubleSide,depthWrite:false});
  for(let a=120;a<=240;a+=15){const r=18.25;const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);const p=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.08,12,6),r3Mat('#3a3f45'));p.position.set(x,6,-y);S.add(p);}}
 /* バックスクリーン（濃緑の壁）とスコアボード */
 {const bs=r3Surf(S,-4.8,4.8,1.2,a=>[0.5,0],a=>[0.5,9.5],'#173a22');bs.receiveShadow=true;R3S.dim.push({m:bs,day:0xffffff,night:0x55606a});
  const top=r3Surf(S,-4.8,4.8,1.2,a=>[0.5,9.5],a=>[8,9.6],'#2a3b30');R3S.dim.push({m:top,day:0xffffff,night:0x55606a});}
 r3BuildBoard(S);
 /* 段々のスタンド：外野席／アルプス／内野席（2層＋銀傘） */
 R3.stands=[];
 R3.stands.push(r3Steps(S,-49,49,26,{h0:3.6,rise:0.42,depth:0.8,d0:0.3,tread:'#5f8f63',riser:'#8d9299',zone:'of'}));
 for(const sg of [-1,1]){const a0=sg<0?-117.4:49.2,a1=sg<0?-49.2:117.4;R3.stands.push(r3Steps(S,a0,a1,40,{h0:2.6,rise:0.36,depth:0.82,d0:0.4,tread:'#a3ad98',riser:'#868d85',zone:'alps',dark:0.9}));}
 R3.stands.push(r3Steps(S,117.4,242.6,13,{h0:2.1,rise:0.42,depth:0.8,d0:0.3,tread:'#356f3e',riser:'#8d9299',zone:'in'}));
 R3.stands.push(r3Steps(S,117.4,242.6,20,{h0:8.4,rise:0.5,depth:0.8,d0:12.6,tread:'#4d7f58',riser:'#8d9299',zone:'in'}));
 /* 階段通路（放射状の明るい帯） */for(const z of [[-49,49,0.3,3.6,26,0.42,0.8],[-117.4,-49.2,0.4,2.6,40,0.36,0.82],[49.2,117.4,0.4,2.6,40,0.36,0.82],[117.4,242.6,0.3,2.1,13,0.42,0.8],[117.4,242.6,12.6,8.4,20,0.5,0.8]]){const [a0,a1,d0,h0,rows,rise,depth]=z;for(let a=a0+4.5;a<a1;a+=9){const w=0.8;const st=r3Surf(S,a-w/2,a+w/2,w/2,q=>[d0,h0+0.03],q=>[d0+rows*depth,h0+rows*rise+0.03],'#b9bec4');R3S.dim.push({m:st,day:0xffffff,night:0x6b7178});}}
 /* 通路（中段の平らな部分）と前面の壁 */r3Surf(S,117.4,242.6,2,a=>[10.7,7.56],a=>[12.6,7.6],'#8d9299');
 r3Surf(S,117.4,242.6,2,a=>[12.6,7.6],a=>[12.6,8.4],'#6f757e');
 for(const z of [[-49,49,0.3,0,3.6],[-117.4,-49.2,0.4,0,2.6],[49.2,117.4,0.4,0,2.6],[117.4,242.6,0.3,0,2.1]]){r3Surf(S,z[0],z[1],2,a=>[z[2],z[3]],a=>[z[2],z[4]],'#6f757e');}
 /* 銀傘：内野席上層を覆う屋根（手前の庇＋緩やかに上がる面）と後方の支柱 */
 {const roof=r3Surf(S,117.4,242.6,2,a=>[9.5,21.6],a=>[31,25.2],'#8e949c',{cast:true});roof.material=new THREE.MeshStandardMaterial({color:new THREE.Color('#9a9fa6'),roughness:0.55,metalness:0.45,side:THREE.DoubleSide});R3S.dim.push({m:roof,day:0xffffff,night:0x59606a});
  /* 屋根のリブ（骨組み） */for(let a=118;a<=242;a+=3){const r0=r3Rin(a)+9.5,r1=r3Rin(a)+31;const s0=Math.sin(a*Math.PI/180),c0=Math.cos(a*Math.PI/180);const p0=new THREE.Vector3(r0*s0,21.75,-r0*c0),p1=new THREE.Vector3(r1*s0,25.35,-r1*c0);const len=p0.distanceTo(p1);const rib=new THREE.Mesh(new THREE.BoxGeometry(0.25,0.3,len),r3Mat('#6f757e'));rib.position.copy(p0).lerp(p1,0.5);rib.lookAt(p1);S.add(rib);}
  const under=r3Surf(S,117.4,242.6,2,a=>[9.6,21.5],a=>[30.9,25.1],'#6a7079');under.position.y=-0.08;R3S.dim.push({m:under,day:0xffffff,night:0x3d434b});
  const fascia=r3Surf(S,117.4,242.6,2,a=>[9.5,20.3],a=>[9.5,21.6],'#d7dadd');R3S.dim.push({m:fascia,day:0xffffff,night:0x7a7f86});
  const edge=r3Surf(S,117.4,242.6,2,a=>[9.5,20.3],a=>[10.6,20.3],'#c3c7cc');R3S.dim.push({m:edge,day:0xffffff,night:0x6a6f76});
  for(let a=120;a<=240;a+=10){const r=r3Rin(a)+30.5;const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);const p=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.55,25.5,8),r3Mat('#8a9098'));p.position.set(x,12.75,-y);p.castShadow=true;S.add(p);}
  /* 屋根の上のフラッグ */for(let a=130;a<=230;a+=12.5){const r=r3Rin(a)+9.8;const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);r3Flag(S,x,21.6,-y,a,['#d7263d','#ffffff','#1f4e9a','#f2c53d'][Math.round(a/12.5)%4]);}}
 /* 外野席上の旗（大会旗・国旗風） */for(let a=-44;a<=44;a+=8){const r=r3Rin(a)+21.3;const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);r3Flag(S,x,3.6+26*0.42,-y,a,['#ffffff','#d7263d','#1f4e9a','#2d8f4e'][Math.abs(Math.round(a/8))%4]);}
 /* ベンチ（ダッグアウト）：屋根付きの低い構造物 */
 for(const sg of [-1,1]){const g=new THREE.Group();/* サイドの壁（(13.5,-7)→(75.5,65.6)）の外側、本塁寄り */const t=0.3;const wx=13.5+62*t,wy=-7+72.6*t;const nx=0.76,ny=-0.65;const X=sg*(wx+nx*2.7),Y=wy+ny*2.7;g.position.set(X,0,-Y);g.rotation.y=sg*-2.28;
  const back=new THREE.Mesh(r3Box(10,2.4,0.3,1.2),r3Mat('#20262c'));back.position.set(0,0,-2.6);g.add(back);
  const roof=new THREE.Mesh(r3Box(10.6,0.28,3.2,0),r3Mat('#6f757e'));roof.position.set(0,2.45,-1.1);roof.castShadow=true;g.add(roof);
  for(const x of [-5,0,5]){const p=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,2.4,6),r3Mat('#3a3f45'));p.position.set(x,1.2,0.3);g.add(p);}
  const bench=new THREE.Mesh(r3Box(9.5,0.45,0.5,0.22),r3Mat('#4a5560'));bench.position.set(0,0,-1.8);g.add(bench);
  const inner=new THREE.Mesh(r3Box(10,2.2,2.6,1.1),new THREE.MeshLambertMaterial({color:0x101418}));inner.position.set(0,0,-1.3);g.add(inner);
  S.add(g);}
 /* 照明塔（6基）：鉄塔＋ランプ盤 */
 R3.lamps=[];for(const a of [-30,30,-78,78,-128,128]){const r=r3Rin(a)+(Math.abs(a)<50?24:Math.abs(a)<118?36:32);const x=r*Math.sin(a*Math.PI/180),y=r*Math.cos(a*Math.PI/180);
  const tw=new THREE.Mesh(new THREE.CylinderGeometry(0.5,1.3,46,6),r3Mat('#7d848c'));tw.position.set(x,23,-y);tw.castShadow=true;S.add(tw);
  for(const dx of [-1.2,1.2]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.3,42,5),r3Mat('#7d848c'));leg.position.set(x+dx*Math.cos(a*Math.PI/180),21,-y+dx*Math.sin(a*Math.PI/180));S.add(leg);}
  const lamp=new THREE.Mesh(r3Box(13,5.5,0.8,0),new THREE.MeshLambertMaterial({color:0x8a8f99,emissive:0x000000}));lamp.position.set(x,47,-y);lamp.lookAt(0,0,-40);S.add(lamp);R3.lamps.push(lamp);
  const grid=new THREE.Mesh(r3Box(13.4,6,0.3,0),r3Mat('#3b4047'));grid.position.set(x,47,-y);grid.lookAt(0,0,-40);grid.translateZ(-0.6);S.add(grid);}
 /* ファウルポール */for(const sg of [-1,1]){const p=[sg*FENCE(45)*Math.SQRT1_2,FENCE(45)*Math.SQRT1_2];const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,18,8),r3Mat('#ffd84a'));pole.position.set(p[0],9,-p[1]);S.add(pole);const net=new THREE.Mesh(r3Box(0.05,14,1.6,7),new THREE.MeshLambertMaterial({color:0xffd84a,transparent:true,opacity:0.55,side:THREE.DoubleSide}));net.position.set(p[0]-sg*0.8,2,-p[1]-0.8);net.rotation.y=-sg*Math.PI/4;S.add(net);}
 /* 観客 */r3BuildCrowd(S);}
function r3Flag(S,x,y,z,a,col){const g=new THREE.Group();g.position.set(x,y,z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.07,4.2,6),r3Mat('#dfe3e8'));pole.position.y=2.1;g.add(pole);
 const f=new THREE.Mesh(r3Geo('flag',()=>new THREE.PlaneGeometry(1.6,1.0)),new THREE.MeshLambertMaterial({color:new THREE.Color(col),side:THREE.DoubleSide}));f.position.set(0.8,3.6,0);g.add(f);g.rotation.y=-a*Math.PI/180+Math.PI/2+0.4;S.add(g);R3S.flags=R3S.flags||[];R3S.flags.push(f);}
/* 観客（インスタンス：胴＋頭）。座席位置 R3S.seats から配置。アルプスは応援団の色に寄せる */
function r3BuildCrowd(S){const seats=R3S.seats;const N0=Math.min(seats.length,(typeof window!=="undefined"&&window.__crowdN)||14000);
 let s=4242;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
 /* ゾーンごとに配分（本塁後方を密に） */const byZone={in:[],alps:[],of:[]};for(const q of seats)(byZone[q.zone]||byZone.of).push(q);const want={in:Math.round(N0*0.42),alps:Math.round(N0*0.33),of:N0-Math.round(N0*0.42)-Math.round(N0*0.33)};
 const pick=[];for(const z in byZone){const arr=byZone[z];const k=Math.min(arr.length,want[z]);const stride=arr.length/Math.max(1,k);for(let i=0;i<k;i++)pick.push(arr[Math.floor(i*stride)]);}
 const N=pick.length;/* インスタンス数は実際に置く人数に合わせる（余りが原点に出ないように） */
 const geo=new THREE.CapsuleGeometry(0.21,0.34,2,6);geo.translate(0,0.36,0);const im=new THREE.InstancedMesh(geo,new THREE.MeshLambertMaterial({color:0xffffff}),N);im.castShadow=false;im.receiveShadow=false;S.add(im);R3.crowd=im;
 const hg=new THREE.SphereGeometry(0.16,6,5);hg.translate(0,0.78,0);const hm=new THREE.InstancedMesh(hg,new THREE.MeshLambertMaterial({color:0xe9bf9b}),N);hm.castShadow=false;S.add(hm);R3.crowdH=hm;
 R3.crowdSeed=[];const tmp=new THREE.Object3D();const colr=new THREE.Color();const cols=[0xf4f4f4,0xffffff,0xe8e4da,0xf0ede4,0xd9534f,0x3b6fb6,0xf0c75e,0x8aa5c8,0xc9b7a0,0xf4f4f4,0x6aa84f,0x2b2f36,0xff8fab,0x1e3a5f,0xffffff,0xff7a1a,0x7bd1e8,0x9b59b6,0x222222,0x9aa0a6,0xf7f3ea,0xdfe6ee];
 pick.forEach((q,i)=>{const ri=r3Rin(q.a)+q.d;const sn=Math.sin(q.a*Math.PI/180),cs=Math.cos(q.a*Math.PI/180);const x=ri*sn+(rnd()-0.5)*0.2,z=-ri*cs+(rnd()-0.5)*0.2;const rot=Math.atan2(-x,-z-40)+(rnd()-0.5)*0.5;
  R3.crowdSeed.push({x,y:q.h,z,rot,p:rnd(),sc:0.86+rnd()*0.28,zone:q.zone,side:q.a>=0?1:-1});tmp.position.set(x,q.h,z);tmp.rotation.set(0,rot,0);tmp.scale.setScalar(0.86+rnd()*0.28);tmp.updateMatrix();im.setMatrixAt(i,tmp.matrix);hm.setMatrixAt(i,tmp.matrix);colr.setHex(cols[Math.floor(rnd()*cols.length)]);im.setColorAt(i,colr);});
 im.instanceMatrix.needsUpdate=true;hm.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;}
/* 応援団：アルプスを両チームの色に染める（colA=一塁側、colB=三塁側） */
function r3DressCrowd(colA,colB){const im=R3.crowd;if(!im||!R3.crowdSeed)return;const c=new THREE.Color();let s=777;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
 const pal=u=>u?[u.base,u.trim,u.cap,'#ffffff',u.trim,u.base]:['#f4f4f4','#2b2f36','#1e3a5f','#ffffff'];const pa=pal(colA),pb=pal(colB);
 R3.crowdSeed.forEach((q,i)=>{if(q.zone!=='alps')return;const p=q.side>0?pa:pb;c.set(p[Math.floor(rnd()*p.length)]);im.setColorAt(i,c);});if(im.instanceColor)im.instanceColor.needsUpdate=true;}
