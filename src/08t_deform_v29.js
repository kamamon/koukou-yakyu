/* v29 deform extension: MakeHuman CC0 skin weights, 83 actual deform joints and shared LOD mesh subdivision. */
const V29Deform=(function deformFactory(T){
 const cache=new WeakMap(),spatial=new WeakMap(),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),vec=a=>new T.Vector3(...a);
 function decode(s){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",map=Object.fromEntries([...chars].map((c,i)=>[c,i]));const out=new Uint8Array(Math.floor(s.length*3/4)-(s.endsWith("==")?2:s.endsWith("=")?1:0));let n=0;for(let i=0;i<s.length;i+=4){const x=(map[s[i]]<<18)|(map[s[i+1]]<<12)|((map[s[i+2]]||0)<<6)|(map[s[i+3]]||0);out[n++]=(x>>>16)&255;if(n<out.length)out[n++]=(x>>>8)&255;if(n<out.length)out[n++]=x&255;}return out;}
 function lookup(data,kind){
  let all=spatial.get(data);if(!all){all={};spatial.set(data,all);}if(all[kind])return all[kind];const src=data[kind],buf=decode(src.packed),d=new DataView(buf.buffer),grid=new Map(),points=[],cell=.002;
  const key=(x,y,z)=>x+","+y+","+z;for(let i=0;i<src.count;i++){const o=i*20,p=[d.getInt32(o,true)*data.unit,d.getInt32(o+4,true)*data.unit,d.getInt32(o+8,true)*data.unit],j=Array.from(buf.subarray(o+12,o+16)),w=Array.from(buf.subarray(o+16,o+20),x=>x/255);const n={p,j,w};points.push(n);const k=key(...p.map(x=>Math.floor(x/cell)));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(n);}
  const find=(x,y,z)=>{const k=[x,y,z].map(x=>Math.floor(x/cell));let best=null,ds=.0035**2;for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)for(let c=-2;c<=2;c++){const list=grid.get(key(k[0]+a,k[1]+b,k[2]+c));if(!list)continue;for(const q of list){const d=(q.p[0]-x)**2+(q.p[1]-y)**2+(q.p[2]-z)**2;if(d<ds){ds=d;best=q;}}}return best;};
  return all[kind]={find,points};
 }
 function top(weights){const a=[...weights.entries()].filter(x=>x[1]>1e-8).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4);let n=a.reduce((s,q)=>s+q[1],0);if(!n)return [[0,0,0,0],[1,0,0,0]];while(a.length<4)a.push([0,0]);return [a.map(x=>x[0]),a.map(x=>x[1]/n)];}
 function remap(g,data,kind){
  const geo=g.clone(),pos=geo.attributes.position,si=geo.attributes.skinIndex,sw=geo.attributes.skinWeight,J=new Uint16Array(pos.count*4),W=new Float32Array(pos.count*4),used=new Set();let matched=0;
  const source=kind==="eyes"?null:lookup(data,kind),eyeIds=["mh_eye_L","mh_eye_R"].map(n=>data.control.length+data.bones.findIndex(x=>x.name===n));
  for(let i=0;i<pos.count;i++){const q=source&&source.find(pos.getX(i),pos.getY(i),pos.getZ(i));let j,w;
   if(q){j=q.j;w=q.w;matched++;}
   else if(kind==="eyes"&&eyeIds.every(x=>x>=data.control.length)){j=[pos.getX(i)>=0?eyeIds[0]:eyeIds[1],0,0,0];w=[1,0,0,0];matched++;}
   else{j=[si.getX(i),si.getY(i),si.getZ(i),si.getW(i)];w=[sw.getX(i),sw.getY(i),sw.getZ(i),sw.getW(i)];const s=w.reduce((a,b)=>a+b,0);if(s>1e-8)w=w.map(x=>x/s);else{j=[0,0,0,0];w=[1,0,0,0];}}
   J.set(j,i*4);W.set(w,i*4);for(let k=0;k<4;k++)if(w[k]>.0001)used.add(j[k]);
  }
  geo.setAttribute("skinIndex",new T.BufferAttribute(J,4));geo.setAttribute("skinWeight",new T.BufferAttribute(W,4));geo.userData.v29={matched,total:pos.count,used:[...used]};return geo;
 }
 function subdivide(g){
  if(!g.index)throw Error("indexed mesh required");const A=g.attributes,srcN=A.position.count,idx=g.index.array,edges=new Map(),tri=[],added=[];
  const edge=(a,b)=>{const lo=Math.min(a,b),hi=Math.max(a,b),key=lo+":"+hi;if(edges.has(key))return edges.get(key);const id=srcN+added.length;edges.set(key,id);added.push([lo,hi]);return id;};
  for(let i=0;i<idx.length;i+=3){const a=idx[i],b=idx[i+1],c=idx[i+2],ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);tri.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  const out=new T.BufferGeometry(),count=srcN+added.length;
  function expand(attr){const n=attr.itemSize,F=new Float32Array(count*n);F.set(attr.array);for(let j=0;j<added.length;j++){const [a,b]=added[j],off=(srcN+j)*n;for(let k=0;k<n;k++)F[off+k]=(attr.array[a*n+k]+attr.array[b*n+k])*.5;}return new T.BufferAttribute(F,n,attr.normalized);}
  for(const [name,attr] of Object.entries(A))if(name!=="skinIndex"&&name!=="skinWeight")out.setAttribute(name,expand(attr));
  const J=new Uint16Array(count*4),W=new Float32Array(count*4);J.set(A.skinIndex.array);W.set(A.skinWeight.array);
  for(let i=0;i<added.length;i++){const weights=new Map();for(const id of added[i])for(let k=0;k<4;k++){const j=A.skinIndex.array[id*4+k],w=A.skinWeight.array[id*4+k]*.5;weights.set(j,(weights.get(j)||0)+w);}const [j,w]=top(weights);J.set(j,(srcN+i)*4);W.set(w,(srcN+i)*4);}
  out.setAttribute("skinIndex",new T.BufferAttribute(J,4));out.setAttribute("skinWeight",new T.BufferAttribute(W,4));
  // Phong-style edge smoothing, using the source vertex normals while preserving shared UV seams.
  if(A.normal){const p=out.attributes.position,n=out.attributes.normal,a=new T.Vector3(),b=new T.Vector3(),na=new T.Vector3(),nb=new T.Vector3(),m=new T.Vector3(),qa=new T.Vector3(),qb=new T.Vector3();
   for(let i=0;i<added.length;i++){const [x,y]=added[i];a.fromBufferAttribute(A.position,x);b.fromBufferAttribute(A.position,y);na.fromBufferAttribute(A.normal,x).normalize();nb.fromBufferAttribute(A.normal,y).normalize();m.copy(a).add(b).multiplyScalar(.5);qa.copy(m).addScaledVector(na,-na.dot(m.clone().sub(a)));qb.copy(m).addScaledVector(nb,-nb.dot(m.clone().sub(b)));const sm=qa.add(qb).multiplyScalar(.5).sub(m),lim=Math.min(.003,a.distanceTo(b)*.12);if(sm.length()>lim)sm.setLength(lim);m.addScaledVector(sm,.6);p.setXYZ(srcN+i,m.x,m.y,m.z);na.add(nb).normalize();n.setXYZ(srcN+i,na.x,na.y,na.z);}
  }
  for(const [name,list] of Object.entries(g.morphAttributes))out.morphAttributes[name]=list.map(expand);
  out.morphTargetsRelative=g.morphTargetsRelative;out.setIndex(new T.BufferAttribute(count>65535?new Uint32Array(tri):new Uint16Array(tri),1));out.computeBoundingBox();out.computeBoundingSphere();out.userData.v29=Object.assign({},g.userData.v29,{baseVertices:srcN,vertices:count,baseTriangles:idx.length/3,triangles:tri.length/3});return out;
 }
 function geometry(g,data,kind){let all=cache.get(data);if(!all){all=new Map();cache.set(data,all);}const key=kind+":"+g.attributes.position.count+":"+g.index.count;if(all.has(key))return all.get(key);const low=remap(g,data,kind),high=kind==="eyes"?low:subdivide(low);const row={low,high};all.set(key,row);return row;}
 function attach(r,data){
  if(r._v29Rig||!r.skel||!data||data.control.length!==r.skel.bones.length)return false;
  const old=r.skel,rest={},nodes={},base=r.g;
  for(const n of data.control){if(!r.j[n])return false;rest[n]=vec(data.baseJoints[n]);}
  for(const q of data.bones){if(!rest[q.parent]&&!data.bones.some(x=>x.name===q.parent))throw Error("missing parent "+q.parent);rest[q.name]=vec(q.head);const b=new T.Bone();b.name=q.name;nodes[q.name]=b;}
  const entries=[["body",r.body],["uniform",r.cloth],["eyes",r.eyes]],rows=[];
  for(const [kind,m] of entries){if(!m)continue;const g=geometry(m.geometry,data,kind);const v=g.low.userData.v29;if(kind!=='eyes'&&v.matched/Math.max(1,v.total)<.97)throw Error('deform source mismatch '+kind+' '+v.matched+'/'+v.total);rows.push({kind,m,g});}
  const extra=[];for(const q of data.bones){const b=nodes[q.name],p=nodes[q.parent]||r.j[q.parent];b.position.copy(rest[q.name]).sub(rest[q.parent]);p.add(b);r.j[q.name]=b;extra.push(b);}
  base.updateMatrixWorld(true);const inv=old.boneInverses.concat(extra.map(b=>b.matrixWorld.clone().invert())),skel=new T.Skeleton(old.bones.concat(extra),inv);
  for(const row of rows){row.m.geometry=row.g.low;row.m.bind(skel,new T.Matrix4());}
  r.skel=skel;r._v29Rig={data,rows,extra,names:data.control.concat(data.bones.map(x=>x.name)),high:false};r._v29Rig.info={bones:skel.bones.length,meshes:rows.map(x=>({kind:x.kind,...x.g.high.userData.v29}))};return true;
 }
 function setLOD(r,high){const d=r._v29Rig;if(!d||d.high===high)return;d.high=high;for(const row of d.rows)row.m.geometry=high?row.g.high:row.g.low;}
 function articulate(r,p){
  const d=r._v29Rig;if(!d)return;const bat=r.bat&&r.bat.visible,glove=r.glove&&r.glove.visible,pose=p||{},closed=bat?.75:glove?.50:.17,axes={};
  for(const s of ["L","R"]){const a=d.data.bones.find(x=>x.source==="finger2-1."+s),b=d.data.bones.find(x=>x.source==="finger5-1."+s),f=d.data.bones.find(x=>x.source==="finger3-1."+s);if(a&&b&&f){const across=vec(b.head).sub(vec(a.head)).normalize(),long=vec(f.axis),normal=across.cross(long).normalize();if(s==="R")normal.negate();axes[s]=normal;}}
  for(const q of d.data.bones){const b=r.j[q.name],name=q.source,s=name.endsWith(".L")?"L":name.endsWith(".R")?"R":"",sd=s.toLowerCase(),dir=vec(q.axis);let angle=0,axis=dir;
   if(/^finger[1-5]-[1-3]\./.test(name)){const part=+name.match(/-(\d)\./)[1],finger=+name.match(/finger(\d)/)[1],normal=axes[s]||vec([0,0,1]);axis=dir.clone().cross(normal).normalize();const grip=bat?closed:s==="L"&&glove?closed:.18;angle=(finger===1?.36:grip)*(part===1?.74:part===2?1.08:.67);}
   else if(/^lowerarm02/.test(name)){const v=pose[sd+"Hand"]||[0,0,0];angle=cl(v[1]*.27,-.35,.35);}
   else if(/^upperarm02/.test(name)){const v=pose[sd+"Sh"]||[0,0,0];angle=cl(v[1]*.09,-.18,.18);}
   else if(/^lowerleg02/.test(name)){const v=pose[sd+"Foot"]||[0,0,0];angle=cl(v[1]*.15,-.2,.2);}
   else if(/^toe[1-5]-1\./.test(name)){const foot=pose[sd+"Foot"]||[0,0,0];axis=vec([1,0,0]);angle=cl(-foot[0]*.14,-.16,.16);}
   else if(name==="jaw"){axis=vec([1,0,0]);angle=-(r.exprTarget&&r.exprTarget.shout||0)*.035;}
   if(axis.lengthSq()>1e-8)b.quaternion.setFromAxisAngle(axis.normalize(),angle);
  }
 }
 return {decode,lookup,remap,subdivide,geometry,attach,setLOD,articulate};
})(THREE);
