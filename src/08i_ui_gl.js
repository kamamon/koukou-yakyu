/* ================= GLB 選手モデル（MakeHuman ベース・CC0）の読み込みとリグ =================
 assets/player.glb（tools/build_player.py で生成）を読み、R3RigReal と同じインターフェースで動かす。
 ・骨は hips/torso/chest/head/rSh/rEl/rHand/lSh/lEl/lHand/rHip/rKnee/rFoot/lHip/lKnee/lFoot（基本姿勢で軸はワールド一致）
 ・body（肌）・uniform（服のシェル）・eyes の3メッシュが1つのスケルトンを共有
 ・表情はモーフターゲット（focus/shout/smile/sad/grit/blink）、顔のバリエーション（face0..2）
 ・ユニフォームはチームごとに Canvas で合成したテクスチャ（マスク・デザインレイヤー・陰影・しわ法線・汚れ） */
const GL={data:null,loading:null,failed:false,tex:{},atlas:{}};
function glAssetBase(){const s=(typeof R3_ASSET_BASE!=='undefined'&&R3_ASSET_BASE)||'assets/';return s;}
function glParse(buf,url){const dv=new DataView(buf);if(dv.getUint32(0,true)!==0x46546C67)throw new Error('not glb');const len=dv.getUint32(8,true);let off=12,json=null,bin=null;
 while(off<len){const clen=dv.getUint32(off,true),ctype=dv.getUint32(off+4,true);off+=8;if(ctype===0x4E4F534A)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,off,clen)));else if(ctype===0x004E4942)bin=buf.slice(off,off+clen);off+=clen;}
 const acc=i=>{const a=json.accessors[i];const bv=json.bufferViews[a.bufferView];const C={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];return {arr:new C(bin,(bv.byteOffset||0)+(a.byteOffset||0),a.count*size),size};};
 return {json,bin,acc,base:url.replace(/[^\/]*$/,'')};}
/* 読み込み（一度だけ）。成功したら R3.glReady=true にしてリグを作り直す */
function glLoad(){if(GL.data||GL.loading||GL.failed)return GL.loading;const base=glAssetBase();
 const img=(name)=>new Promise((res,rej)=>{const im=new Image();if(/^https?:/.test(base))im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>rej(new Error('image '+name));im.src=base+name;});
 GL.loading=fetch(base+'player.glb').then(r=>{if(!r.ok)throw new Error('glb '+r.status);return r.arrayBuffer();}).then(buf=>{GL.data=glParse(buf,base+'player.glb');
  return Promise.all(['skin.jpg','eye.jpg','uni_mask.png','uni_shade.jpg','uni_normal.jpg','uni_dirt.jpg','uni_layers.png','uni_zones.png','hand_mask.png'].map(n=>img(n).then(im=>{GL.tex[n]=im;},e=>{console.warn('texture missing',n);})));})
 .then(()=>{GL.ready=true;try{if(typeof r3RebuildRigs==='function'&&R3.scene){R3.rigModel=null;r3RebuildRigs();}}catch(e){console.warn(e);}})
 .catch(e=>{console.warn('player.glb load failed → 手続き生成モデルを使用',e);GL.failed=true;});
 return GL.loading;}
function glTexture(name,srgb){if(GL.tex['_'+name])return GL.tex['_'+name];const im=GL.tex[name];if(!im)return null;const t=new THREE.Texture(im);t.needsUpdate=true;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=R3.renderer?Math.min(8,R3.renderer.capabilities.getMaxAnisotropy()):4;t.flipY=false;GL.tex['_'+name]=t;return t;}
/* ---- ユニフォーム・テクスチャの合成（チームごとにキャッシュ） ----
 uni_mask.png: R=ジャージ G=ズボン B=ベルト A=肌（服なし）
 uni_layers.png: R=襟・袖口・ズボンのライン（全デザイン共通の縁取り） G=前立て・ボタン B=ピンストライプ A=ラグラン／胸バンド（上位ビットで区別） */
function glAtlas(u){const key=[u.base,u.trim,u.pants,u.cap,u.style].join('|');if(GL.atlas[key])return GL.atlas[key];
 const mask=GL.tex['uni_mask.png'],lay=GL.tex['uni_layers.png'],zon=GL.tex['uni_zones.png'],shade=GL.tex['uni_shade.jpg'];const N=mask?mask.width:1024;
 const cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d');
 if(!mask){g.fillStyle=u.base;g.fillRect(0,0,N,N);}
 else{const tmp=document.createElement('canvas');tmp.width=tmp.height=N;const tg=tmp.getContext('2d');tg.drawImage(mask,0,0,N,N);const M=tg.getImageData(0,0,N,N).data;
  let L=null;if(lay){tg.clearRect(0,0,N,N);tg.drawImage(lay,0,0,N,N);L=tg.getImageData(0,0,N,N).data;}
  let Z=null;if(zon){tg.clearRect(0,0,N,N);tg.drawImage(zon,0,0,N,N);Z=tg.getImageData(0,0,N,N).data;}
  let S=null;if(shade){tg.clearRect(0,0,N,N);tg.drawImage(shade,0,0,N,N);S=tg.getImageData(0,0,N,N).data;}
  const out=g.createImageData(N,N);const o=out.data;const C=h=>{const c=new THREE.Color(h);return [c.r*255,c.g*255,c.b*255];};
  const base=C(u.base),trim=C(u.trim),pants=C(u.pants||'#f4f4f4'),belt=C(u.cap&&u.cap!==u.pants?u.cap:'#222');
  const st=u.style||'plain';const pin=st==='pin',placket=st==='placket',sleeve=st==='sleeve',raglan=st==='raglan',band=st==='band';
  for(let i=0;i<N*N;i++){const k=i*4;const mj=M[k]/255,mp=M[k+1]/255,mb=M[k+2]/255;let r,gg,b;
   if(mb>0.5){r=belt[0];gg=belt[1];b=belt[2];}else if(mp>0.5){r=pants[0];gg=pants[1];b=pants[2];}else{r=base[0];gg=base[1];b=base[2];}
   if(L){const edge=L[k]/255,plk=L[k+1]/255,pst=L[k+2]/255;const zr=Z?Z[k]/255:0,zg=Z?Z[k+1]/255:0,zb=Z?Z[k+2]/255:0;/* zones: R=ラグラン G=胸バンド B=袖口帯(0.5)・ズボンのサイドライン(1.0) */
    let a=0;if(edge>0)a=Math.max(a,edge);if(placket&&plk>0)a=Math.max(a,Math.min(1,plk*1.2));if(pin&&pst>0&&mp<0.5)a=Math.max(a,pst);
    if(raglan&&zr>0.5)a=1;if(band&&zg>0.5)a=1;if((sleeve||band)&&zb>0.4&&zb<0.6)a=1;if(st!=='plain'&&zb>0.9&&mp>0.5)a=1;
    if(a>0){r=r+(trim[0]-r)*a;gg=gg+(trim[1]-gg)*a;b=b+(trim[2]-b)*a;}
    if(placket&&plk>0.98){/* ボタン */r=245;gg=243;b=238;}}
   if(S){const s=S[k]/255;const f=0.55+0.5*s;r*=f;gg*=f;b*=f;}
   o[k]=r;o[k+1]=gg;o[k+2]=b;o[k+3]=255;}
  g.putImageData(out,0,0);}
 const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=R3.renderer?Math.min(8,R3.renderer.capabilities.getMaxAnisotropy()):4;
 const mat=new THREE.MeshStandardMaterial({map:t,roughness:0.9,metalness:0,envMap:R3.env||null,envMapIntensity:0.18,normalMap:glTexture('uni_normal.jpg',false),normalScale:new THREE.Vector2(0.8,0.8)});
 GL.atlas[key]={tex:t,mat};return GL.atlas[key];}
/* 汚れ・バッティンググローブをシェーダーに差し込む（材質はリグごとに複製して uniform を持つ） */
function glDirtMaterial(src,dirtTex){const m=src.clone();m.userData.u={uDirt:{value:0}};m.onBeforeCompile=sh=>{sh.uniforms.uDirt=m.userData.u.uDirt;sh.uniforms.uDirtMap={value:dirtTex};
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n{vec4 dd=texture2D(uDirtMap,vMapUv);float k=clamp(dd.r*uDirt,0.0,0.85);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.36,0.27,0.19),k);}\n#endif').replace('uniform vec3 diffuse;','uniform vec3 diffuse;uniform float uDirt;uniform sampler2D uDirtMap;');};
 m.customProgramCacheKey=()=>'dirt';return m;}
function glSkinMaterial(skinTex,handTex,tint){const m=new THREE.MeshStandardMaterial({map:skinTex,roughness:0.55,metalness:0,envMap:R3.env||null,envMapIntensity:0.25,color:new THREE.Color(tint||'#ffffff')});m.userData.u={uGlove:{value:0},uGloveCol:{value:new THREE.Color('#222')}};
 m.onBeforeCompile=sh=>{sh.uniforms.uGlove=m.userData.u.uGlove;sh.uniforms.uGloveCol=m.userData.u.uGloveCol;sh.uniforms.uHandMap={value:handTex};
  sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n{float h=texture2D(uHandMap,vMapUv).r*uGlove;diffuseColor.rgb=mix(diffuseColor.rgb,uGloveCol,clamp(h,0.0,1.0));}\n#endif').replace('uniform vec3 diffuse;','uniform vec3 diffuse;uniform float uGlove;uniform vec3 uGloveCol;uniform sampler2D uHandMap;');};
 m.customProgramCacheKey=()=>'skinglove';return m;}
/* ---- リグ ---- */
class R3RigGL extends R3RigReal{
 buildBody(){const G=this.g,j=this.j;const D=GL.data;const js=D.json;const ex=js.extras;const P=ex.jointPos;
  /* 骨：ノードの階層をそのまま */const names=ex.joints;const nodeIdx=js.skins[0].joints;const bones=[];
  names.forEach((n,i)=>{const nd=js.nodes[nodeIdx[i]];const b=new THREE.Bone();b.name=n;const t=nd.translation||[0,0,0];b.position.set(t[0],t[1],t[2]);j[n]=b;bones.push(b);});
  names.forEach((n,i)=>{const nd=js.nodes[nodeIdx[i]];(nd.children||[]).forEach(c=>{const cn=js.nodes[c].name;if(j[cn])j[n].add(j[cn]);});});
  G.add(j.hips);G.updateMatrixWorld(true);
  const ibm=D.acc(js.skins[0].inverseBindMatrices).arr;const inv=[];for(let i=0;i<names.length;i++){const m=new THREE.Matrix4();m.fromArray(ibm,i*16);inv.push(m);}
  const skel=this.skel=new THREE.Skeleton(bones,inv);
  this.dim={hipsPos:P.hips,L1:0,L2:0,hasHead:true,hasFeet:true,hasHands:true};
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);this.dim.L1=dist(P.rSh,P.rEl);this.dim.L2=dist(P.rEl,P.rHand);
  const pts=ex.points;const eyeY=(pts.lEye[1]+pts.rEye[1])/2,eyeZ=(pts.lEye[2]+pts.rEye[2])/2;const headTop=pts.headTop[1];
  const cy=eyeY+0.035-P.head[1];const cz=eyeZ-0.085-P.head[2];this.dim.headCy=cy;this.dim.headCz=cz;this.dim.headR=Math.max(0.09,(headTop-(P.head[1]+cy))*1.02);
  this.dim.chestR=0.125;this.dim.chestY=0.11;this.dim.textY=0.125;this.dim.shin=dist(P.rKnee,P.rFoot);this.dim.palm=dist(P.rHand,pts.rFingerTip)*0.55;this.dim.fist=dist(P.rHand,pts.rFingerTip)*0.42;
  /* メッシュ */const mk=(meshIdx)=>{const mesh=js.meshes[meshIdx];const prim=mesh.primitives[0];const g=new THREE.BufferGeometry();const A=prim.attributes;
   const set=(name,accIdx)=>{const a=D.acc(accIdx);g.setAttribute(name,new THREE.BufferAttribute(a.arr,a.size));};
   set('position',A.POSITION);set('normal',A.NORMAL);set('uv',A.TEXCOORD_0);set('skinIndex',A.JOINTS_0);set('skinWeight',A.WEIGHTS_0);
   const idx=D.acc(prim.indices);g.setIndex(new THREE.BufferAttribute(idx.arr,1));
   if(prim.targets){g.morphAttributes.position=prim.targets.map(t=>{const a=D.acc(t.POSITION);return new THREE.BufferAttribute(a.arr,a.size);});g.morphTargetsRelative=true;}
   return {geo:g,mesh};};
  const findMesh=n=>js.meshes.findIndex(m=>m.name===n);
  const skinTex=glTexture('skin.jpg',true),handTex=glTexture('hand_mask.png',false)||skinTex,eyeTex=glTexture('eye.jpg',true);
  const body=mk(findMesh('body'));this.skinMat=glSkinMaterial(skinTex,handTex);this.body=new THREE.SkinnedMesh(body.geo,this.skinMat);this.body.castShadow=true;this.body.receiveShadow=true;this.body.frustumCulled=false;G.add(this.body);this.body.bind(skel,new THREE.Matrix4());
  this.morphNames=(body.mesh.extras&&body.mesh.extras.targetNames)||ex.morphs||[];this.body.morphTargetInfluences=this.morphNames.map(()=>0);this.expr={};this.exprTarget={};
  const cloth=mk(findMesh('uniform'));this.cloth=new THREE.SkinnedMesh(cloth.geo,r3MatP('#eeeeee'));this.cloth.castShadow=true;this.cloth.receiveShadow=true;this.cloth.frustumCulled=false;G.add(this.cloth);this.cloth.bind(skel,new THREE.Matrix4());
  const eyes=mk(findMesh('eyes'));this.eyes=new THREE.SkinnedMesh(eyes.geo,new THREE.MeshStandardMaterial({map:eyeTex,roughness:0.25,metalness:0,envMap:R3.env||null,envMapIntensity:0.6}));this.eyes.castShadow=false;this.eyes.frustumCulled=false;G.add(this.eyes);this.eyes.bind(skel,new THREE.Matrix4());
  this.headM=null;}
 /* 人物ごとの個性：顔のバリエーションと肌の色（seed から決める） */
 setPerson(seed){seed=(seed==null?0:seed)|0;if(this.person===seed)return;this.person=seed;let s=(seed*2654435761)>>>0;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  const inf=this.body.morphTargetInfluences;this.morphNames.forEach((n,i)=>{if(/^face\d/.test(n))inf[i]=rnd()*1.2-0.3;});
  const tints=['#ffffff','#f6ebe0','#eadbcb','#f8f0e8','#e6d2bf','#f2e3d4'];this.skinMat.color.set(tints[Math.floor(rnd()*tints.length)]);}
 /* 表情：name と強さ。apply() で滑らかに追従する */
 setExpression(name,w){this.exprTarget={};if(name)this.exprTarget[name]=w==null?1:w;}
 _updateExpr(){const inf=this.body.morphTargetInfluences;const k=0.12;const now=performance.now();
  /* まばたき：3〜7秒ごとに約140ms */if(!this.nextBlink)this.nextBlink=now+1500+Math.random()*4000;let bl=0;if(now>this.nextBlink){const d=now-this.nextBlink;if(d<140)bl=d<70?d/70:1-(d-70)/70;else this.nextBlink=now+2500+Math.random()*4500;}
  this.morphNames.forEach((n,i)=>{if(/^face\d/.test(n))return;if(n==='blink'){inf[i]=Math.max(this.exprTarget.blink||0,bl);return;}const t=this.exprTarget[n]||0;inf[i]+=(t-inf[i])*k;});}
 setColors(c,helmet){if(this.col!==c){this.col=c;const u=this.uni=rrUniform(c);
   const at=glAtlas(u);if(!this.clothMat||this.clothMat.userData.src!==at.mat){this.clothMat=glDirtMaterial(at.mat,glTexture('uni_dirt.jpg',false)||at.tex);this.clothMat.userData.src=at.mat;this.cloth.material=this.clothMat;}
   const capM=r3MatP(u.cap),brimM=r3MatP(u.capBrim),helmM=r3MatP(u.cap,{roughness:0.3});this.capM.material=capM;this.brimM.material=brimM;this.btnM.material=capM;this.helmetM.material=helmM;this.hbrimM.material=helmM;this.flapM.material=helmM;
   this.markM.material.map=rrMark(u);this.markM.material.needsUpdate=true;this.markM.visible=!!u.mark;
   const prot=r3MatP(u.cap&&u.cap!=='#f4f4f4'?u.cap:'#1f2a44',{roughness:0.8}),prot2=r3MatP(u.cap&&u.cap!=='#f4f4f4'?u.cap:'#1f2a44',{roughness:0.8,side:THREE.DoubleSide});this.protM.material=prot;this.throatM.material=prot2;this.rLegM.material=prot2;this.lLegM.material=prot2;this.rKneeM.material=prot;this.lKneeM.material=prot;
   this.skinMat.userData.u.uGloveCol.value.set(u.cap||'#222');this.txtM.visible=!!u.text;this._drawText();this._drawNum();}
  this.setHelmet(helmet);}
 setHelmet(on){on=!!on||this.gear==='catcher';if(this.helmet===on&&this._helmetInit)return;this._helmetInit=true;this.helmet=on;this.helmetM.visible=on;this.hbrimM.visible=on;this.flapM.visible=on&&this.gear!=='catcher';this.capM.visible=!on;this.brimM.visible=!on;this.btnM.visible=!on;this.markM.visible=!on&&!!(this.uni&&this.uni.mark);
  /* 打者・走者はバッティンググローブ（シェーダーで手の領域を着色） */this.skinMat.userData.u.uGlove.value=on?1:0;}
 setDirt(k){if(this.clothMat)this.clothMat.userData.u.uDirt.value=clamp(k||0,0,1);}
 apply(p){super.apply(p);this._updateExpr();}
}
/* R3RigReal にも空の実装 */
R3RigReal.prototype.setPerson=function(){};R3RigReal.prototype.setExpression=function(){};R3RigReal.prototype.setDirt=function(){};
R3Rig.prototype.setPerson=function(){};R3Rig.prototype.setExpression=function(){};R3Rig.prototype.setDirt=function(){};
/* リグ生成：GLB が読めていればそれを使う */
function r3NewRig(){const S=actionSettings();if(S.model3d==='chibi')return new R3Rig();if(GL.ready)return new R3RigGL();if(!GL.loading&&!GL.failed)glLoad();return new R3RigReal();}
