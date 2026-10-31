/* ================= ユニフォーム編集 ================= */
function colorField(label,k,val,scope){return `<label class="f">${label}<div class="row" style="justify-content:flex-start"><input type="color" value="${esc(val)}" data-inp="uni" data-scope="${scope}" data-k="${k}"><div class="swatches">${COLOR_PRESETS.map(c=>`<button type="button" style="background:${c}" data-act="uniSwatch" data-scope="${scope}" data-k="${k}" data-c="${c}" aria-label="${c}"></button>`).join('')}</div></div></label>`;}
function uniformEditorHtml(u,e){const fontOpts=sel=>UNI_FONTS.map(f=>`<option value="${f.id}"${sel===f.id?' selected':''} style="font-family:${f.css}">${esc(f.name)}</option>`).join('');
 return `<div id="uniPreview">${uniformPreview(u,e,{w:120,number:1})}</div>
 <div class="grid2" style="margin-top:10px">
 ${colorField('ユニフォーム基本色','base',u.base,'u')}${colorField('差し色（襟・ライン）','trim',u.trim,'u')}
 <label class="f">デザイン<select data-inp="uni" data-scope="u" data-k="style">${UNI_STYLES.map(s=>`<option value="${s.id}"${u.style===s.id?' selected':''}>${s.name}</option>`).join('')}</select></label>
 <label class="f">胸文字（漢字・ローマ字）<input type="text" maxlength="12" value="${esc(u.text)}" data-inp="uni" data-scope="u" data-k="text"></label>
 <label class="f">胸文字フォント<select data-inp="uni" data-scope="u" data-k="textFont">${fontOpts(u.textFont)}</select></label>
 ${colorField('胸文字の色','textColor',u.textColor,'u')}${colorField('胸文字の縁取り','textOutline',u.textOutline,'u')}
 <label class="f">背番号フォント<select data-inp="uni" data-scope="u" data-k="numFont">${fontOpts(u.numFont)}</select></label>
 ${colorField('背番号の色','numColor',u.numColor,'u')}${colorField('背番号の縁取り','numOutline',u.numOutline,'u')}
 ${colorField('帽子の色','cap',u.cap,'u')}${colorField('つばの色','capBrim',u.capBrim,'u')}
 </div><div class="sep"></div><b>校章</b><div class="grid2" style="margin-top:6px">
 <label class="f">形<select data-inp="uni" data-scope="e" data-k="shape">${EMBLEM_SHAPES.map(s=>`<option value="${s.id}"${e.shape===s.id?' selected':''}>${s.name}</option>`).join('')}</select></label>
 <label class="f">校章の文字（1〜3文字）<input type="text" maxlength="3" value="${esc(e.text)}" data-inp="uni" data-scope="e" data-k="text"></label>
 <label class="f">文字フォント<select data-inp="uni" data-scope="e" data-k="textFont">${fontOpts(e.textFont)}</select></label>
 ${colorField('文字の色','textColor',e.textColor,'e')}${colorField('地の色','bg',e.bg,'e')}${colorField('縁の色','border',e.border,'e')}
 <label class="f"><span class="row" style="justify-content:flex-start;gap:6px"><input type="checkbox" ${e.ring?'checked':''} data-inp="uni" data-scope="e" data-k="ring" style="width:18px;height:18px">内側の輪郭線を入れる</span></label>${colorField('輪郭線の色','ringColor',e.ringColor,'e')}
 </div>`;}
function uniDraft(){return UI.uniDraft;}
INP.uni=(d,el)=>{const dr=uniDraft();if(!dr)return;const t=d.scope==='u'?dr.u:dr.e;t[d.k]=el.type==='checkbox'?el.checked:el.value;const pv=$('#uniPreview');if(pv)pv.innerHTML=uniformPreview(dr.u,dr.e,{w:120,number:1});};
ACT.uniSwatch=d=>{const dr=uniDraft();if(!dr)return;const t=d.scope==='u'?dr.u:dr.e;t[d.k]=d.c;const inp=document.querySelector(`input[type=color][data-scope="${d.scope}"][data-k="${d.k}"]`);if(inp)inp.value=d.c;const pv=$('#uniPreview');if(pv)pv.innerHTML=uniformPreview(dr.u,dr.e,{w:120,number:1});};
ACT.uniformEditor=()=>{UI.uniDraft={u:Object.assign({},G.uniform),e:Object.assign({},G.emblem)};openModal(`<h2>ユニフォーム・校章の設定</h2>${uniformEditorHtml(UI.uniDraft.u,UI.uniDraft.e)}<div class="wrap" style="margin-top:10px">${b('保存','uniSave',{},'primary')}${b('キャンセル','closeModal')}</div>`);};
ACT.uniSave=()=>{const dr=uniDraft();if(dr){G.uniform=dr.u;G.emblem=dr.e;saveGame();}UI.uniDraft=null;closeModal();render();toast('ユニフォームを保存しました');};
/* ================= 新規ゲーム画面 ================= */
function showSetup(){$('#game').hidden=true;const s=$('#setup');s.hidden=false;
 if(!UI.setup)UI.setup={name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:52,mode:'normal',custom:{money:1000,budgetMult:1,rep:40,q:55,coachLevel:3,scoutLevel:2,facLevel:1,ground:2,dorm:1,goals:false,goalLevel:2,trust:60,uniq:5,stars:0,starQ:80,starPot:10},u:defaultUniform(),e:defaultEmblem()};
 UI.uniDraft={u:UI.setup.u,e:UI.setup.e};const st=UI.setup;
 const prefOpts=REGIONS.map(r=>`<optgroup label="${r}">${PREF_DATA.filter(p=>p.region===r).map(p=>`<option value="${esc(p.name)}"${st.pref===p.name?' selected':''}>${esc(p.name)}（激戦度${'★'.repeat(p.pw)}）</option>`).join('')}</optgroup>`).join('');
 s.innerHTML=`<div class="hero"><h1>高校野球シミュレーション <span class="ver" style="font-size:11px;font-weight:600;opacity:.7;vertical-align:middle;font-family:var(--font-num)">v${appVer()}</span></h1><p>ひとつの高校を率いて、育成・経営・スカウト・そして甲子園へ。</p></div>
 ${hasSave()?`<section class="card"><div class="row"><span>前回のセーブデータがあります</span>${b('続きから','continueGame',{},'primary')}</div></section>`:''}
 <section class="card"><h3>1. ゲームモード</h3><div class="col">
 <label class="check" style="border:1px solid var(--line);border-radius:10px;padding:8px"><input type="radio" name="suMode" value="normal" ${st.mode!=='elite'?'checked':''}><span><b>弱小校から甲子園を目指す</b><br><span class="small muted">予算も選手も平凡。設備・監督・スカウトに投資しながら少しずつ強くなる王道モード。</span></span></label>
 <label class="check" style="border:1px solid var(--line);border-radius:10px;padding:8px"><input type="radio" name="suMode" value="custom" ${st.mode==='custom'?'checked':''}><span><b>カスタムスタート</b><br><span class="small muted">初期資金・予算倍率・評判・選手の強さ・監督やスカウトのレベル・設備・目標の有無を自由に設定。</span></span></label>
 <label class="check" style="border:1px solid var(--line);border-radius:10px;padding:8px"><input type="radio" name="suMode" value="elite" ${st.mode==='elite'?'checked':''}><span><b>強豪校の監督として結果を出す</b><br><span class="small muted">名門校に招かれた監督。選手は全国級、予算は1.6倍、設備も揃っているが、理事会から毎年目標（初年度は夏の県大会決勝進出、達成すると翌年は一段階上）が課される。未達で信頼度-30、赤字で-15、信頼度0で解任されゲームオーバー。</span></span></label>
 </div></section>
 <section class="card" id="customBox" ${st.mode==='custom'?'':'hidden'}><h3>カスタム設定</h3><div class="grid2">
 ${[['cuMoney','初期資金（万円）',0,100000,500,st.custom.money],['cuBudget','年間予算の倍率',2,100,1,Math.round(st.custom.budgetMult*10)],['cuRep','評判',0,100,1,st.custom.rep],['cuQ','初期部員の平均能力',25,90,1,st.custom.q],['cuUniq','固有特能持ちの割合（%）',0,100,1,st.custom.uniq],['cuCoach','監督レベル（3以上は外部招へい・給与あり）',1,9,1,st.custom.coachLevel],['cuScout','スカウトレベル（0=なし）',0,9,1,st.custom.scoutLevel],['cuGround','グラウンドLv',1,5,1,st.custom.ground],['cuDorm','寮Lv（0=なし）',0,4,1,st.custom.dorm],['cuStars','最強の新入生の人数（1年生に加わる）',0,9,1,st.custom.stars],['cuStarQ','最強の新入生の能力',60,95,1,st.custom.starQ],['cuStarPot','最強の新入生の潜在能力（10=S）',6,10,1,st.custom.starPot]].map(f=>`<label class="f">${f[1]}：<b id="${f[0]}V">${f[0]==='cuBudget'?(f[5]/10).toFixed(1)+'倍':f[5]}</b><input type="range" id="${f[0]}" min="${f[2]}" max="${f[3]}" step="${f[4]}" value="${f[5]}" data-inp="cu"></label>`).join('')}
 <label class="f">初期設備<select id="cuFac">${['なし','基本セット（ブルペン・マシン・ウエイト・救護室）','充実セット（室内練習場・食堂など9種）','全設備（約50種）を最上級で導入'].map((n,i)=>`<option value="${i}"${st.custom.facLevel===i?' selected':''}>${n}</option>`).join('')}</select></label>
 <label class="f">理事会の目標<select id="cuGoals"><option value="0"${!st.custom.goals?' selected':''}>課さない（解任なし）</option><option value="1"${st.custom.goals?' selected':''}>課す（未達で信頼を失い解任あり）</option></select></label>
 <label class="f">最初の目標<select id="cuGoalLv">${GOALS.map(g=>`<option value="${g.lv}"${st.custom.goalLevel===g.lv?' selected':''}>${g.text}</option>`).join('')}</select></label>
 <label class="f">初期信頼度：<b id="cuTrustV">${st.custom.trust}</b><input type="range" id="cuTrust" min="10" max="100" value="${st.custom.trust}" data-inp="cu"></label>
 </div><div class="hint">予算の倍率は毎年の学校予算に掛かります（例：×2.0で2倍）。「最強の新入生」は固有特能を持ち、指定した潜在能力で1年生として入部します（投手・野手が混ざります）。</div></section>
 <section class="card"><h3>2. 学校の設定</h3><div class="col">
 <label class="f">学校名<input type="text" id="suName" value="${esc(st.name)}" maxlength="14"></label>
 <label class="f">都道府県（激戦区ほど予選が厳しい）<select id="suPref">${prefOpts}</select></label>
 <div class="grid2"><label class="f">形態（私立は予算が多い）<select id="suType"><option value="公立"${st.type==='公立'?' selected':''}>公立</option><option value="私立"${st.type==='私立'?' selected':''}>私立</option></select></label>
 <label class="f">学校の規模<select id="suSize"><option value="小"${st.size==='小'?' selected':''}>小規模</option><option value="中"${st.size==='中'?' selected':''}>中規模</option><option value="大"${st.size==='大'?' selected':''}>大規模</option></select></label></div>
 <label class="f">偏差値 <span id="suHensV">${st.hensachi}</span>（高いと部員の学力・知識が高く卒業後の職業も良いが、野球の素質は控えめ）<input type="range" min="40" max="72" value="${st.hensachi}" id="suHens" data-inp="hens"></label>
 </div></section>
 <section class="card"><h3>3. ユニフォームと校章</h3>${uniformEditorHtml(st.u,st.e)}</section>
 <section class="card"><h3>4. スタート</h3><div class="hint">公立校は予算が少なく、まずは設備と監督の強化から。私立校は資金に余裕がありスカウトを活かしやすい設定です。</div><div style="margin-top:8px">${b('この設定でゲームを始める','startGame',{},'primary big')}</div></section>`;}
INP.hens=(d,el)=>{const v=$('#suHensV');if(v)v.textContent=el.value;};
INP.cu=(d,el)=>{const v=$('#'+el.id+'V');if(v)v.textContent=el.id==='cuBudget'?(el.value/10).toFixed(1)+'倍':el.value;};
document.addEventListener('change',e=>{if(e.target&&e.target.name==='suMode'){const box=$('#customBox');if(box)box.hidden=e.target.value!=='custom';if(UI.setup)UI.setup.mode=e.target.value;}});
ACT.continueGame=()=>{if(loadGame()){UI.uniDraft=null;render();}else toast('読み込めませんでした');};
ACT.startGame=()=>{const st=UI.setup;st.name=$('#suName').value.trim()||'青葉高校';st.pref=$('#suPref').value;st.type=$('#suType').value;st.size=$('#suSize').value;st.hensachi=parseInt($('#suHens').value)||52;const mr=document.querySelector('input[name=suMode]:checked');st.mode=mr?mr.value:'normal';
 const gv=id=>parseFloat($('#'+id).value);st.custom={money:gv('cuMoney'),budgetMult:gv('cuBudget')/10,rep:gv('cuRep'),q:gv('cuQ'),uniq:gv('cuUniq'),coachLevel:gv('cuCoach'),scoutLevel:gv('cuScout'),ground:gv('cuGround'),dorm:gv('cuDorm'),facLevel:parseInt($('#cuFac').value),goals:$('#cuGoals').value==='1',goalLevel:parseInt($('#cuGoalLv').value),trust:gv('cuTrust'),stars:gv('cuStars'),starQ:gv('cuStarQ'),starPot:gv('cuStarPot')};
 newGame({name:st.name,pref:st.pref,type:st.type,size:st.size,hensachi:st.hensachi,mode:st.mode,custom:st.custom,uniform:st.u,emblem:st.e});refreshMarkets();UI.uniDraft=null;UI.tab='home';saveGame();render();window.scrollTo(0,0);toast('ゲームを開始しました');};
/* ================= 起動 ================= */
function boot(data){data=data||{};if(data.save){try{G=JSON.parse(data.save);migrate();}catch(e){G=null;}}
 if(!G&&hasSave()){loadGame();}
 const hot=window.claude&&window.claude.hot;if(hot&&hot.snapshot){try{hot.snapshot(()=>({save:G?serialize():null}));}catch(e){}}
 render();}
(function(){const hot=window.claude&&window.claude.hot;if(hot&&hot.ready)hot.ready(boot);else boot((hot&&hot.data)||{});})();
