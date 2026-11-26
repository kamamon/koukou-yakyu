/* Catalog inspection: direct playback using the same runtime motion interpolation and IK. */
(function(){
 const C=V28Catalog,items=C.motion.concat(typeof V29_CAPTURE_IDS==='undefined'?[]:V29_CAPTURE_IDS.map(id=>({id,group:'実測',base:id,label:MODEF[id].mocap}))),groups=[...new Set(items.map(m=>m.group))];let chosen=items[0].id;
 const typeOf=m=>m.group==='投球'||m.group==='守備'?'field':m.group==='打撃'||/v29_(swing|bunt)_mc/.test(m.id)?'bat':m.group==='走塁'||/v29_(stop|side)_mc/.test(m.id)?'runner':m.base==='v28_catcher'?'catcher':'field';
 const oldApply=R3RigReal.prototype.apply;
 R3RigReal.prototype.apply=function(p){if(this._v28Body){const b=this._v28Body;this.g.scale.set((this.g.scale.x<0?-1:1)*b.x,b.y,b.z);}return oldApply.call(this,p);};
 MV_SCN.catalog={label:'生成モーション',build:()=>{const m=items.find(x=>x.id===chosen)||items[0],def=MODEF[m.id];const k=typeOf(m);return {ents:{P:{ts:1,mir:MV.hand==='左'?-1:1,segs:[{k:'clip',clip:m.id,t0:0,t1:def.dur+500,x:0,y:3,yaw:0}]}},kinds:{P:k},ball:null,T:def.dur+500,subj:'P',focus:[0,3,.95],ts:1};}};
 const oldRig=mvRig;
 mvRig=function(key,kind){const r=oldRig(key,kind);if(MV.scn==='catalog'&&r instanceof R3RigReal){const b=C.physique({height:+$('#v28-height').value,weight:+$('#v28-weight').value});r._v28Body=b;r.g.scale.set(b.x,b.y,b.z);}return r;};
 const group=$('#v28-motion-group'),clip=$('#v28-motion-clip'),button=$('#v28-motion-play');
 if(!group||!clip||!button)return;
 for(const name of groups){const option=document.createElement('option');option.value=name;option.textContent=name;group.appendChild(option);}
 const fill=()=>{clip.replaceChildren();for(const m of items.filter(m=>m.group===group.value)){const o=document.createElement('option');o.value=m.id;o.textContent=m.label;clip.appendChild(o);}chosen=clip.value;};group.addEventListener('change',fill);fill();
 const load=()=>{chosen=clip.value;const m=items.find(x=>x.id===chosen);if(!m)return;MV_SCN.catalog.label=m.group+' / '+m.label;mvLoad('catalog');};
 button.addEventListener('click',load);clip.addEventListener('change',load);for(const id of ['v28-height','v28-weight'])$('#'+id).addEventListener('change',()=>{if(MV.scn==='catalog')load();});
})();
