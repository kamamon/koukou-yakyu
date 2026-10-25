/* ================= オーダー編集（タップで入れ替え） ================= */
function lineupWorkInit(){ensureLineup();UI.lw=(G.lineup||[]).map(s=>({pid:s.pid,pos:s.pos}));UI.lsel=null;}
function fitMark(p,pos){const f=posFit(p,pos);return f>=1?'':f>=0.85?'<span class="tiny muted">(サブ)</span>':'<span class="tiny err">(不慣れ)</span>';}
function slotRating(p,pos){return pos==='投'?pitRating(p):batRating(p);}
function showLineupModal(ctx){UI.lineupCtx=ctx;lineupWorkInit();renderLineupEditor();}
function renderLineupEditor(){const ctx=UI.lineupCtx;const lw=UI.lw;const sel=UI.lsel;const inL=new Set(lw.map(s=>s.pid));
 const rows=lw.map((s,i)=>{const p=pById(s.pid);const isSel=sel===i;return `<div class="lrow ${isSel?'sel':''}"><span class="num muted">${i+1}</span><select data-chg="lpos" data-i="${i}" class="lpos">${POS.map(x=>`<option value="${x}"${s.pos===x?' selected':''}>${x}</option>`).join('')}</select><span class="lname" data-act="lsel" data-i="${i}">${p?`<b>${esc(p.name)}</b> <span class="muted small">${p.grade}年 ${esc(playerPosLabel(p))}</span> ${rk(slotRating(p,s.pos))} ${fitMark(p,s.pos)}${p.fatigue>=60?'<span class="tiny err"> 疲</span>':''}${condIcon(p)?'<span class="tiny"> '+condIcon(p)+'</span>':''}`:'<span class="err">未設定</span>'}</span><span class="larrows">${b('▲','lmove',{i,d:-1},'sm ghost')}${b('▼','lmove',{i,d:1},'sm ghost')}</span></div>`;}).join('');
 const selPos=sel!=null?lw[sel].pos:null;
 const bench=healthy().filter(p=>!inL.has(p.id)).sort((a,b)=>{if(selPos){const fa=posFit(a,selPos),fb=posFit(b,selPos);if(fa!==fb)return fb-fa;return slotRating(b,selPos)-slotRating(a,selPos);}return rating(b)-rating(a);});
 const benchHtml=bench.map(p=>`<button class="btn sm bpl" data-act="lbench" data-id="${p.id}">${esc(p.name)} <span class="muted">${p.grade}年 ${esc(playerPosLabel(p))}</span> ${rk(selPos?slotRating(p,selPos):rating(p))}${selPos?fitMark(p,selPos):''}${p.fatigue>=60?'<span class="tiny err"> 疲</span>':''}</button>`).join('');
 const mode=ctx?`<label class="f">試合の進め方<select id="modeSel">${SIM_MODES.map(m=>`<option value="${m.id}"${G.settings.mode===m.id?' selected':''}>${m.name}</option>`).join('')}</select></label>`:'';
 const head=ctx?`<h2>${esc(ctx.label)}</h2><div class="ev"><span>対戦相手：<b>${esc(ctx.opp.name)}</b>（${esc(ctx.opp.pref||'')}）</span><span>強さ ${rk(ctx.opp.strength)}</span></div>`:'<h2>オーダー編集</h2>';
 const st=$('#modal')?$('#modal').scrollTop:0;
 openModal(`${head}<div class="hint">選手名をタップ→別の選手名をタップで<b>入れ替え</b>。選手名をタップしてから下の控え選手をタップすると<b>その打順に入ります</b>。▲▼で打順の移動、左の守備位置は直接変更（重複すると自動で入れ替わります）。</div><div id="lineupForm" style="margin-top:8px">${rows}</div>
 <div class="row" style="margin-top:8px"><b class="small">控え選手${selPos?'（'+selPos+'の適性順）':''}</b><span class="tiny muted">${sel!=null?(lw[sel].pos+'の枠に入れる選手をタップ'):'打順をタップすると入替候補を表示'}</span></div><div class="wrap" style="margin-top:4px">${benchHtml||'<span class="muted small">控えなし</span>'}</div>
 <div id="lineupErr" class="err"></div>${mode}<div class="wrap" style="margin-top:8px">${b('自動編成','lineupAutoModal',{},'')}${b(ctx?'決定して試合へ':'決定','lineupSave',{},'primary')}${ctx?'':b('キャンセル','closeModal',{})}</div>`,!!ctx);
 if($('#modal'))$('#modal').scrollTop=st;}
ACT.lsel=d=>{const i=parseInt(d.i);if(UI.lsel==null){UI.lsel=i;}else if(UI.lsel===i){UI.lsel=null;}else{const a=UI.lw[UI.lsel],bb=UI.lw[i];const t=a.pid;a.pid=bb.pid;bb.pid=t;UI.lsel=null;}renderLineupEditor();};
ACT.lmove=d=>{const i=parseInt(d.i),j=i+parseInt(d.d);if(j<0||j>=UI.lw.length)return;const t=UI.lw[i];UI.lw[i]=UI.lw[j];UI.lw[j]=t;if(UI.lsel===i)UI.lsel=j;else if(UI.lsel===j)UI.lsel=i;renderLineupEditor();};
ACT.lbench=d=>{const id=parseInt(d.id);if(UI.lsel==null){toast('先に入れ替えたい打順の選手名をタップしてください');return;}UI.lw[UI.lsel].pid=id;UI.lsel=null;renderLineupEditor();};
CHG.lpos=(d,el)=>{const i=parseInt(d.i);const np=el.value;const other=UI.lw.findIndex((s,k)=>k!==i&&s.pos===np);const old=UI.lw[i].pos;UI.lw[i].pos=np;if(other>=0)UI.lw[other].pos=old;renderLineupEditor();};
ACT.lineupAutoModal=()=>{autoLineup();autoNumbers();lineupWorkInit();renderLineupEditor();};
ACT.lineupSave=()=>{const slots=UI.lw.map(s=>({pid:s.pid,pos:s.pos}));const err=[];if(slots.length!==9||new Set(slots.map(s=>s.pid)).size!==9)err.push('同じ選手が複数の打順にいます。');const posSet=new Set(slots.map(s=>s.pos));if(posSet.size!==9)err.push('守備位置が重複しています。');if(slots.some(s=>!pById(s.pid)||pById(s.pid).injury>0))err.push('ケガ人は出場できません。');
 if(err.length){const e=$('#lineupErr');if(e)e.textContent=err.join(' ');return;}
 G.lineup=slots;G.sp=slots.find(s=>s.pos==='投').pid;autoNumbers();saveGame();
 const ctx=UI.lineupCtx;if(ctx){const mode=$('#modeSel').value;G.settings.mode=mode;startMatchUI(ctx,mode);}else{closeModal();render();toast('オーダーを保存しました');}};
/* ================= ランダムイベント ================= */
function showEventModal(ev){const e=eventById(ev.id);if(!e){G.queue.shift();render();return;}const p=ev.pid?pById(ev.pid):null;if(e.p&&!p){G.queue.shift();render();return;}
 const title=typeof e.title==='function'?e.title(p):e.title;const text=typeof e.text==='function'?e.text(p):e.text;
 openModal(`<h2>${esc(title)}</h2>${p?`<div class="row" style="justify-content:flex-start;gap:8px;margin-bottom:6px">${avatarFor({pid:p.id,size:56})}<div><b>${esc(p.name)}</b> <span class="muted small">${p.grade}年 ${esc(playerPosLabel(p))} ${rkR(p)}</span><div class="tiny muted">調子：${condLabel(p)}　疲労${Math.round(p.fatigue)}</div></div></div>`:''}<div class="talk" style="margin-top:0">${esc(text)}</div><div class="hint">どうする？</div>${e.choices.map((c,i)=>b(esc(c.label),'eventChoose',{id:e.id,i,pid:ev.pid||''},'optbtn')).join('')}`,true);}
ACT.eventChoose=d=>{const e=eventById(d.id);const p=d.pid?pById(d.pid):null;const c=e.choices[parseInt(d.i)];const res=c.eff(p)||'';if(G.queue[0]&&G.queue[0].type==='event')G.queue.shift();saveGame();openModal(`<h2>${esc(typeof e.title==='function'?e.title(p):e.title)}</h2><div class="talk">${esc(res)}</div>${b('OK','closeQ',{},'primary big')}`,true);};
/* ================= 選手エディット（カスタムスタート専用） ================= */
function canEdit(){return G.mode==='custom';}
function playerEditHtml(p){const num=(label,k,v,min,max,step)=>`<label class="f">${label}<input type="number" min="${min}" max="${max}" step="${step||1}" value="${v}" data-pe="${k}"></label>`;
 const batRows=BAT_KEYS.map(k=>num(k[1],'bat.'+k[0],Math.round(p.bat[k[0]]),1,100)).join('');
 const pitRows=PIT_KEYS.map(k=>num(k[1],'pit.'+k[0],Math.round(p.pit[k[0]]),1,100)).join('');
 const pitches=p.pit.pitches.map((pt,i)=>`<div class="pitchrow"><select data-pe="pitch.${i}.name">${['ストレート'].concat(PITCH_NAMES).map(n=>`<option value="${n}"${pt.name===n?' selected':''}>${n}</option>`).join('')}</select><input type="number" value="${Math.round(pt.velo)}" min="60" max="170" data-pe="pitch.${i}.velo" title="球速"><input type="number" value="${Math.round(pt.move)}" min="1" max="100" data-pe="pitch.${i}.move" title="変化量"><input type="number" value="${Math.round(pt.sharp)}" min="1" max="100" data-pe="pitch.${i}.sharp" title="キレ"><input type="number" value="${Math.round(pt.ctrl)}" min="1" max="100" data-pe="pitch.${i}.ctrl" title="制球">${i>0?b('×','peDelPitch',{id:p.id,i},'sm ghost'):'<span></span>'}</div>`).join('');
 const abGroup=(title,list,set)=>`<details><summary class="small muted" style="cursor:pointer">${title}（${list.filter(a=>set.has(a)).length}）</summary><div class="abgrid">${list.map(a=>`<label class="abchk"><input type="checkbox" data-pe="ab.${esc(a)}" ${set.has(a)?'checked':''}> ${esc(a)}</label>`).join('')}</div></details>`;
 const us=new Set(p.unique),as=new Set(p.abilities);
 return `<h2>選手エディット <span class="muted small">${esc(p.name)}</span></h2><div class="hint">カスタムスタート専用。数値は1〜100（球速はkm/h）。保存すると能力の上限は潜在能力に合わせて再計算されます。</div>
 <div class="grid2 stats">
 <label class="f">名前<input type="text" value="${esc(p.name)}" data-pe="name" maxlength="12"></label>
 <label class="f">学年<select data-pe="grade">${[1,2,3].map(g=>`<option value="${g}"${p.grade===g?' selected':''}>${g}年</option>`).join('')}</select></label>
 ${num('身長(cm)','height',p.height,140,210)}${num('体重(kg)','weight',p.weight,40,130)}
 <label class="f">投げ<select data-pe="throws"><option value="右"${p.throws==='右'?' selected':''}>右投</option><option value="左"${p.throws==='左'?' selected':''}>左投</option></select></label>
 <label class="f">打ち<select data-pe="bats">${['右','左','両'].map(x=>`<option value="${x}"${p.bats===x?' selected':''}>${x}打</option>`).join('')}</select></label>
 <label class="f">守備位置<select data-pe="pos">${POS.map(x=>`<option value="${x}"${p.pos===x?' selected':''}>${posName(x)}</option>`).join('')}</select></label>
 <label class="f">サブポジション（最大4）<input type="text" value="${esc(p.sub.join(''))}" data-pe="sub" placeholder="例：一左"></label>
 ${num('潜在能力(1〜10)','potential',p.potential,1,10)}
 <label class="f">成長型<select data-pe="growth">${['早熟','普通','晩成'].map(x=>`<option value="${x}"${p.growth===x?' selected':''}>${x}</option>`).join('')}</select></label>
 <label class="f">性格<select data-pe="persona">${PERSONAS.map(x=>`<option value="${x.id}"${(p.persona||'ふつう')===x.id?' selected':''}>${x.name}</option>`).join('')}</select></label>
 <label class="f">信頼度（0-100）<input type="number" data-pe="trust" value="${Math.round(p.trust||0)}" min="0" max="100"></label>
 ${num('学力','academic',p.academic,1,100)}${num('丈夫さ','tough',p.tough,1,100)}
 ${num('投手の才能','talentP',p.talentP,1,99)}${num('捕手の才能','talentC',p.talentC,1,99)}
 ${num('背番号','number',p.number||0,0,99)}${num('疲労','fatigue',Math.round(p.fatigue),0,100)}
 </div>
 <div class="sep"></div><b class="small">野手能力</b><div class="grid2 stats">${batRows}</div>
 <div class="sep"></div><b class="small">投手能力</b><div class="grid2 stats">${num('球速(km/h)','pit.velo',Math.round(p.pit.velo),80,170)}${pitRows}</div>
 <div class="small" style="margin-top:6px">球種（球種・球速・変化量・キレ・制球）</div><div id="pitchList">${pitches}</div>${b('球種を追加','peAddPitch',{id:p.id},'sm')}
 <div class="sep"></div><b class="small">特殊能力</b>
 ${abGroup('固有特能（野手）',UNIQ_B,us)}${abGroup('固有特能（投手）',UNIQ_P,us)}${abGroup('固有特能（共通）',UNIQ_X.concat(U18_ONLY),us)}${abGroup('野手の特能',NORMAL_B,as)}${abGroup('投手の特能',NORMAL_P,as)}${abGroup('共通の特能',NORMAL_X,as)}${abGroup('マイナス特能',NEG_B.concat(NEG_P,NEG_X),as)}
 <div class="wrap" style="margin-top:10px">${b('保存','peSave',{id:p.id},'primary')}${b('キャンセル','closeModal',{})}${b('この選手を退部させる','peDelete',{id:p.id},'danger')}</div>`;}
function peReadInto(p){const get=k=>{const el=document.querySelector(`[data-pe="${k}"]`);return el?el.value:null;};const gn=(k,min,max)=>{const v=parseFloat(get(k));return isNaN(v)?null:clamp(v,min,max);};
 const name=get('name');if(name&&name.trim())p.name=name.trim();p.grade=parseInt(get('grade'))||p.grade;p.height=gn('height',140,210)||p.height;p.weight=gn('weight',40,130)||p.weight;p.throws=get('throws')||p.throws;p.bats=get('bats')||p.bats;const pos=get('pos');if(POS.includes(pos))p.pos=pos;
 const sub=(get('sub')||'').split('').filter(x=>POS.includes(x)&&x!==p.pos&&x!=='投');p.sub=[...new Set(sub)].slice(0,4);
 p.potential=Math.round(gn('potential',1,10)||p.potential);p.growth=get('growth')||p.growth;const pers=get('persona');if(pers&&PERSONAS.some(x=>x.id===pers))p.persona=pers;const tr=gn('trust',0,100);if(tr!=null)p.trust=Math.round(tr);p.academic=Math.round(gn('academic',1,100)||p.academic);p.tough=Math.round(gn('tough',1,100)||p.tough);p.talentP=Math.round(gn('talentP',1,99)||p.talentP);p.talentC=Math.round(gn('talentC',1,99)||p.talentC);const nm=gn('number',0,99);p.number=nm?Math.round(nm):null;const ft=gn('fatigue',0,100);if(ft!=null)p.fatigue=ft;
 for(const k of ALL_BAT){const v=gn('bat.'+k,1,100);if(v!=null)p.bat[k]=v;}
 for(const k of ALL_PIT){const v=gn('pit.'+k,1,100);if(v!=null)p.pit[k]=v;}
 const velo=gn('pit.velo',80,170);if(velo!=null)p.pit.velo=velo;
 p.pit.pitches.forEach((pt,i)=>{const n=get(`pitch.${i}.name`);if(n)pt.name=n;const v=gn(`pitch.${i}.velo`,60,170);if(v!=null)pt.velo=v;const mv=gn(`pitch.${i}.move`,1,100);if(mv!=null)pt.move=mv;const sh=gn(`pitch.${i}.sharp`,1,100);if(sh!=null)pt.sharp=sh;const ct=gn(`pitch.${i}.ctrl`,1,100);if(ct!=null)pt.ctrl=ct;});
 if(p.pit.pitches.length)p.pit.pitches[0].velo=Math.round(p.pit.velo);
 const checked=[...document.querySelectorAll('[data-pe^="ab."]')].filter(el=>el.checked).map(el=>el.dataset.pe.slice(3));
 p.unique=checked.filter(a=>ABIL[a]&&ABIL[a].u);p.abilities=checked.filter(a=>ABIL[a]&&!ABIL[a].u);
 /* 上限の再計算 */
 const q=Math.round(rating(p));const capBase=q+p.potential*4.5;for(const k of ALL_BAT)p.caps['bat'+k]=Math.round(clamp(Math.max(p.bat[k]+3,capBase+6),20,100));for(const k of ALL_PIT)p.caps['pit'+k]=Math.round(clamp(Math.max(p.pit[k]+3,capBase+6),20,100));p.caps.velo=veloCapFor(p.potential,p.pit.velo);p.caps.pitch=Math.round(clamp(capBase+8,40,100));
 p.training=isPitcher(p)?'pitch':'bat';}
ACT.playerEdit=d=>{if(!canEdit()){toast('選手エディットはカスタムスタート専用です');return;}const p=pById(d.id);if(!p)return;openModal(playerEditHtml(p));};
ACT.peSave=d=>{const p=pById(d.id);if(!p)return;peReadInto(p);ensurePositions();autoLineup();autoNumbers();saveGame();closeModal();render();toast('選手を更新しました');};
ACT.peAddPitch=d=>{const p=pById(d.id);if(!p)return;peReadInto(p);const n=pick(PITCH_NAMES);const off=PITCH_SPEED_OFF[n]||[-10,-20];p.pit.pitches.push({name:n,velo:Math.round(p.pit.velo)+ri(off[1],off[0]),move:50,sharp:50,ctrl:50});openModal(playerEditHtml(p));};
ACT.peDelPitch=d=>{const p=pById(d.id);if(!p)return;peReadInto(p);const i=parseInt(d.i);if(i>0)p.pit.pitches.splice(i,1);openModal(playerEditHtml(p));};
ACT.peDelete=d=>{const p=pById(d.id);if(!p)return;openModal(`<h2>退部の確認</h2><p>${esc(p.name)}を退部させます（元に戻せません）。</p><div class="wrap">${b('退部させる','peDeleteYes',{id:p.id},'danger')}${b('やめる','closeModal',{})}</div>`);};
ACT.peDeleteYes=d=>{G.players=G.players.filter(p=>p.id!=d.id);ensurePositions();autoLineup();autoNumbers();saveGame();closeModal();render();toast('退部させました');};
ACT.peAdd=()=>{if(!canEdit())return;const p=genPlayer({grade:1,q:55});G.players.push(p);saveGame();openModal(playerEditHtml(p));};
function viewEditList(){if(!canEdit())return '';const list=G.players.slice().sort((a,b)=>a.grade-b.grade||rating(b)-rating(a)).map(p=>`<div class="pl" style="grid-template-columns:1fr auto"><div><div class="nm" data-act="playerEdit" data-id="${p.id}">${esc(p.name)} <span class="muted small">${p.grade}年 ${esc(playerPosLabel(p))} ${rkR(p)} 潜在${p.potential}</span></div></div>${b('編集','playerEdit',{id:p.id},'sm')}</div>`).join('');return `<section class="card"><h3>選手エディット <small>カスタムスタート専用</small></h3><div class="hint">名前・体格・守備位置・潜在能力・全能力値・球種・特殊能力を自由に変更できます。</div><div style="margin:6px 0">${b('新しい選手を追加','peAdd',{},'sm primary')}</div><div class="list">${list}</div></section>`;}
