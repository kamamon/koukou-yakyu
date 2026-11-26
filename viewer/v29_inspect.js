/* Inspect the real weighted rig in both model and motion viewers. */
(function(){
 const oldBuild=R3RigGL.prototype.buildBody,oldApply=R3RigGL.prototype.apply;
 R3RigGL.prototype.buildBody=function(){oldBuild.call(this);if(GL.deform29)try{V29Deform.attach(this,GL.deform29);V29Deform.setLOD(this,true);}catch(e){console.warn('v29 rig inspector',e);}};
 R3RigGL.prototype.apply=function(p){oldApply.call(this,p);if(this._v29Rig)V29Deform.articulate(this,p);};
 function scan(){const out=[];if(R3.scene)R3.scene.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton&&o.skeleton.bones.length===83)out.push({bones:o.skeleton.bones.length,vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3,match:o.geometry.userData.v29||null});});return out;}
 window.V29Inspect={scan};
 const panel=document.querySelector('#panel');if(panel){const info=document.createElement('div');info.className='hint';info.textContent='v29 変形ボーン素材をロード中';panel.appendChild(info);const update=()=>{const rows=scan();info.textContent=rows.length?'v29: 83変形ボーン / 高密度メッシュ（実際のスキン付き） 最大 '+Math.max(...rows.map(x=>x.triangles)).toLocaleString()+' 三角形/メッシュ':GL.failed?'GLB読み込み失敗（手続きモデル）':GL.ready?'83ボーン拡張未適用（素材照合を確認）':'v29 変形ボーン素材をロード中';};window.addEventListener('load',()=>{update();setInterval(update,1500);});}
})();
