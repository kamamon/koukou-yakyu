#!/usr/bin/env node
/* Export the actual v29 high density weighted meshes from the existing licensed base. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),THREE=require(path.join(root,'vendor/three.min.js'));
const src=fs.readFileSync(path.join(root,'src/08t_deform_v29.js'),'utf8');
const D=new Function('THREE',src+'\nreturn V29Deform;')(THREE);
const data=JSON.parse(fs.readFileSync(path.join(root,'assets/player_deform_v29.json'),'utf8'));
const input=fs.readFileSync(path.join(root,'assets/player.glb'));
assert.equal(input.readUInt32LE(0),0x46546c67);let json,bin;
for(let i=12;i<input.length;){const n=input.readUInt32LE(i),kind=input.readUInt32LE(i+4),b=input.subarray(i+8,i+8+n);if(kind===0x4e4f534a)json=JSON.parse(b.toString('utf8'));if(kind===0x004e4942)bin=Buffer.from(b);i+=8+n;}
assert.ok(json&&bin);const arrays={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function get(i){const a=json.accessors[i],v=json.bufferViews[a.bufferView],C=arrays[a.componentType],n=a.count*size[a.type],off=(v.byteOffset||0)+(a.byteOffset||0);const bytes=bin.subarray(off,off+n*C.BYTES_PER_ELEMENT);return new THREE.BufferAttribute(new C(Uint8Array.from(bytes).buffer),size[a.type]);}
function geometry(m){const p=m.primitives[0],g=new THREE.BufferGeometry();for(const [a,b] of Object.entries({position:'POSITION',normal:'NORMAL',uv:'TEXCOORD_0',skinIndex:'JOINTS_0',skinWeight:'WEIGHTS_0'}))g.setAttribute(a,get(p.attributes[b]));g.setIndex(get(p.indices));if(p.targets){g.morphAttributes.position=p.targets.map(t=>get(t.POSITION));g.morphTargetsRelative=true;}return g;}
const oldLength=bin.length,parts=[bin];let length=oldLength;
function view(bytes,target){const pad=(4-length%4)%4;if(pad){parts.push(Buffer.alloc(pad));length+=pad;}const o=length;parts.push(Buffer.from(bytes));length+=bytes.length;const v={buffer:0,byteOffset:o,byteLength:bytes.length};if(target)v.target=target;return json.bufferViews.push(v)-1;}
function add(attr,componentType,type,target,minmax=false){const arr=attr.array,bytes=Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength),v=view(bytes,target),a={bufferView:v,componentType,count:attr.count,type};if(minmax){a.min=Array(attr.itemSize).fill(Infinity);a.max=Array(attr.itemSize).fill(-Infinity);for(let i=0;i<attr.count;i++)for(let j=0;j<attr.itemSize;j++){const x=arr[i*attr.itemSize+j];a.min[j]=Math.min(a.min[j],x);a.max[j]=Math.max(a.max[j],x);}}return json.accessors.push(a)-1;}
const skin=json.skins[0],nodes=json.nodes,baseNames=json.extras.joints.slice(),ids=Object.fromEntries(baseNames.map((x,i)=>[x,skin.joints[i]])),rest={...data.baseJoints};
assert.equal(baseNames.length,16);assert.deepEqual(baseNames,data.control);
for(const b of data.bones){ids[b.name]=nodes.length;rest[b.name]=b.head;nodes.push({name:b.name,translation:[0,0,0]});skin.joints.push(ids[b.name]);}
for(const b of data.bones){const n=nodes[ids[b.name]],p=nodes[ids[b.parent]];n.translation=b.head.map((x,i)=>x-rest[b.parent][i]);(p.children||(p.children=[])).push(ids[b.name]);}
const orig=get(skin.inverseBindMatrices).array,mat=new Float32Array(skin.joints.length*16);mat.set(orig);
for(let i=0;i<data.bones.length;i++){const a=data.bones[i].head;mat.set(new THREE.Matrix4().makeTranslation(-a[0],-a[1],-a[2]).elements,(baseNames.length+i)*16);}
skin.inverseBindMatrices=add(new THREE.BufferAttribute(mat,16),5126,'MAT4');
const report={bones:skin.joints.length,meshes:[]};assert.equal(report.bones,83);
const used=new Set();
for(const m of json.meshes){const kind=m.name;if(!['body','uniform','eyes'].includes(kind))continue;const row=D.geometry(geometry(m),data,kind),g=row.high,meta=row.low.userData.v29;
 if(kind!=='eyes')assert.ok(meta.matched/meta.total>=.97,kind+' match '+meta.matched+'/'+meta.total);
 const p=m.primitives[0],A=g.attributes;
 for(let i=0;i<A.skinIndex.count;i++){let sum=0;for(let j=0;j<4;j++){const w=A.skinWeight.array[i*4+j],k=A.skinIndex.array[i*4+j];assert.ok(k<83&&w>=0&&Number.isFinite(w));sum+=w;if(w>1e-5)used.add(k);}assert.ok(Math.abs(sum-1)<1e-5);}
 p.attributes={POSITION:add(A.position,5126,'VEC3',34962,true),NORMAL:add(A.normal,5126,'VEC3',34962),TEXCOORD_0:add(A.uv,5126,'VEC2',34962),JOINTS_0:add(A.skinIndex,5123,'VEC4',34962),WEIGHTS_0:add(A.skinWeight,5126,'VEC4',34962)};
 p.indices=add(g.index,g.index.array instanceof Uint32Array?5125:5123,'SCALAR',34963);
 if(g.morphAttributes.position)p.targets=g.morphAttributes.position.map(a=>({POSITION:add(a,5126,'VEC3',34962,true)}));
 report.meshes.push({kind,baseTriangles:row.low.index.count/3,triangles:g.index.count/3,vertices:g.attributes.position.count,matched:meta.matched,total:meta.total});
}
report.usedBones=used.size;
json.extras.joints=baseNames.concat(data.bones.map(b=>b.name));json.extras.jointPos=Object.fromEntries(json.extras.joints.map(k=>[k,rest[k]]));json.extras.v29={control:baseNames,report};
json.asset.generator='koukou-yakyu v29 high density exporter';for(const im of json.images||[]){if(!im.uri)continue;const name=im.uri.includes('skin')?'skin.jpg':im.uri.includes('eye')?'eye.jpg':im.uri;const p=path.join(root,'assets',name);if(fs.existsSync(p)){im.bufferView=view(fs.readFileSync(p));im.mimeType=name.endsWith('.jpg')?'image/jpeg':'image/png';delete im.uri;}}
const pad=(4-length%4)%4;if(pad){parts.push(Buffer.alloc(pad));length+=pad;}json.buffers[0].byteLength=length;let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const b=Buffer.concat(parts),h=Buffer.alloc(20),bh=Buffer.alloc(8);
h.writeUInt32LE(0x46546c67,0);h.writeUInt32LE(2,4);h.writeUInt32LE(20+j.length+8+b.length,8);h.writeUInt32LE(j.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(b.length,0);bh.writeUInt32LE(0x004e4942,4);
const out=path.resolve(process.argv[2]||path.join(root,'dist/player-v29.glb'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([h,j,bh,b]));fs.writeFileSync(out+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
