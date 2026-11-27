/* v35 broadcast camera, pitching delivery editor and optional photographic illustrations. */
const V35Forms=(()=>{
 const rows=[],families=[["over","オーバースロー"],["three","スリークォーター"],["side","サイドスロー"],["under","アンダースロー"]];
 const variants=[["標準",1,1,0],["高い脚上げ",1.25,1,.03],["コンパクト",.55,.88,-.04],["大きな踏み出し",1,1.12,.04],["低重心",.85,.94,-.07],["クイック",.35,.91,-.025],["クロスステップ",.9,1,.08],["間を取る",1.12,1,0]];
 for(const [family,label] of families)for(let i=0;i<variants.length;i++){const [name,lift,stride,cross]=variants[i],id="v35_"+family+"_"+i,src=MODEF["p_set_"+family],def=JSON.parse(JSON.stringify(src));
 for(const k of def.keys){const p=k.p;if(!p)continue;if(p.fl){p.fl[1]*=lift;p.fl[2]*=stride;if(k.t>=620)p.fl[0]+=cross;}if(p.dz!=null)p.dz*=stride;if(p.dy!=null&&i===4)p.dy-=.045*Math.sin(Math.PI*k.t/def.dur);if(i===5&&k.t>0&&k.t<860)k.t=Math.round(k.t*.8+172*k.t/860);if(i===7&&k.t>240&&k.t<620)k.t=Math.round(k.t+45*Math.sin((k.t-240)/380*Math.PI));}
 def.end.dz*=stride;MODEF[id]=def;rows.push({id,family,label:label+"・"+name});}
 for(const [id,label] of [["p_set_mc","実測投球 A"],["p_set_mc2","実測投球 B"],["p_set_mc3","実測投球 C"]])if(MODEF[id])rows.push({id,family:"over",label});
 return rows;
})();
(function(){
 const old=plPitClip;plPitClip=function(p){return p&&V35Forms.some(f=>f.id===p.delivery35)?p.delivery35:old(p);};
 const original=r3PitForm;r3PitForm=function(p){const f=p&&V35Forms.find(x=>x.id===p.delivery35);return f?f.family:original(p);};
 // Fixed telephoto from the center-field camera well. The background is behind home plate, not the outfield wall.
 V31Core.presets.pit.broadcast={p:[7.4,8.0,-96],l:[0,0.85,-8],f:7.5};
 V31Core.presets.pit.center={p:[2.8,7.2,-94],l:[0,.9,-8],f:7.8};
 const oldSettings=actionSettings;actionSettings=function(){const s=oldSettings();if(!s.v35CameraMigrated){s.v31PitCam="broadcast";s.v35CameraMigrated=true;}return s;};
 const photos={pitch:"pitch",bat:"bat",slide:"slide",field:"field",win:"win",meeting:"meeting",crowd:"crowd",emotion:"emotion"};
 function photoKey(n){const t=n.report?.theme||"",s=(n.head||n.title||"");if(/walkoff|comeback|champion|qualified/.test(t))return "win";if(/shutoutW|nohit|duelW|velocity|pitStats/.test(t))return "pitch";if(/slug|batStats|record/.test(t))return "bat";if(/close|extra/.test(t))return "slide";if(/loss|blown|eliminated|health/.test(t))return "meeting";if(/preview|schedule|bracket|regional/.test(t))return "crowd";if(/feature|awakening/.test(t))return "emotion";if(n.kind==="game")return n.won?"bat":"field";return null;}
 const oldPhoto=npPhoto;npPhoto=function(n,cls){if(n.photo&&npPhotoData(n.photo))return oldPhoto(n,cls);const key=photoKey(n);if(!key)return oldPhoto(n,cls);return '<figure class="np-photo '+(cls||'')+'"><img loading="lazy" src="assets/news35/'+photos[key]+'.jpg" alt="野球のイメージ写真" onerror="this.closest(\'figure\').hidden=true"><figcaption>AI生成イメージ写真（実際の選手・試合の記録ではありません）</figcaption></figure>';};
 const oldEdit=playerEditHtml;
 playerEditHtml=function(p){const chosen=V35Forms.find(x=>x.id===p.delivery35)?.id||plPitClip(p),opts=V35Forms.map(f=>'<option value="'+f.id+'"'+(f.id===chosen?' selected':'')+'>'+esc(f.label)+'</option>').join("");
 return oldEdit(p).replace('<b class="small">投手能力</b>','<section class="v35-editor"><h3>投球フォーム</h3><label class="f">フォーム<select data-pe="delivery35" id="v35form">'+opts+'</select></label><canvas id="v35preview" width="640" height="300" aria-label="投球フォーム動作プレビュー"></canvas><div class="wrap"><button type="button" id="v35play" class="btn sm">再生・停止</button><label>速度<select id="v35speed"><option value="1">通常</option><option value=".5">0.5倍</option><option value=".25">0.25倍</option></select></label><label>視点<select id="v35angle"><option value="0">側面</option><option value="1">正面</option><option value="2">背面</option></select></label></div><input id="v35time" type="range" min="0" max="1650" value="0" aria-label="動作時刻"><p class="tiny muted">プレビューは試合と同じモーションクリップ・IKを使用。保存で試合に反映。</p></section><b class="small">投手能力</b>');};
 const oldRead=peReadInto;peReadInto=function(p){oldRead(p);const f=document.querySelector('[data-pe="delivery35"]');if(f&&V35Forms.some(x=>x.id===f.value)){p.delivery35=f.value;p.pitForm=V35Forms.find(x=>x.id===f.value).family;}};
 let dispose=null;
 function preview(){if(dispose){dispose();dispose=null;}const cv=document.querySelector("#v35preview"),sel=document.querySelector("#v35form");if(!cv||!sel)return;
 let renderer;try{renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:false});}catch(e){cv.replaceWith(Object.assign(document.createElement("p"),{textContent:"3Dプレビュー非対応端末。フォーム選択と保存は可能です。"}));return;}
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x203e49);const cam=new THREE.PerspectiveCamera(34,640/300,.1,100);scene.add(new THREE.HemisphereLight(0xffffff,0x66745a,1.5));const light=new THREE.DirectionalLight(0xffedd4,2);light.position.set(4,7,3);scene.add(light);const ground=new THREE.Mesh(new THREE.CircleGeometry(4,48),new THREE.MeshStandardMaterial({color:0x8a6b50}));ground.rotation.x=-Math.PI/2;scene.add(ground);
 const rig=new R3RigReal();scene.add(rig.g);rig.glove.visible=true;rig.bat.visible=false;const slider=document.querySelector("#v35time"),speed=document.querySelector("#v35speed"),angle=document.querySelector("#v35angle"),play=document.querySelector("#v35play");let running=true,t=0,last=0,raf=0,dead=false;
 play.onclick=()=>{running=!running;};slider.oninput=()=>{running=false;t=+slider.value;};sel.onchange=()=>{t=0;running=true;};renderer.setSize(640,300,false);
 function frame(now){if(dead||!cv.isConnected){cleanup();return;}const id=sel.value,def=MODEF[id];if(!def){raf=requestAnimationFrame(frame);return;}const dur=def.dur||1650;slider.max=dur;if(running)t=(t+Math.min(50,last?now-last:0)*+speed.value)%(dur+350);last=now;slider.value=Math.min(t,dur);const hand=document.querySelector('[data-pe="throws"]')?.value==="左"?-1:1,ent={mir:hand,ts:1,segs:[{k:"clip",clip:id,t0:0,t1:dur,x:0,y:0,yaw:0}]},st=moEval(ent,Math.min(t,dur));if(st)moApply(rig,st,ent,t,true);const a=+angle.value;cam.position.set(a===0?5:a===1?0:0,1.8,a===0?1.8:a===1?5:-5);cam.lookAt(0,.9,.55);renderer.render(scene,cam);raf=requestAnimationFrame(frame);}
 function cleanup(){if(dead)return;dead=true;cancelAnimationFrame(raf);renderer.dispose();}dispose=cleanup;raf=requestAnimationFrame(frame);}
 const oldModal=openModal;openModal=function(html,lock){if(dispose){dispose();dispose=null;}const v=oldModal(html,lock);if(document.querySelector("#v35preview"))preview();return v;};
 window.V35PhotoKey=photoKey;
})();
