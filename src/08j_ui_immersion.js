/* ================= 臨場感 =================
 実況と場内アナウンス（字幕／音声）、サイレン、ブラスバンドと太鼓の応援、歓声、観客の入り、
 試合中の写真（新聞・アルバムに載る）、勝利後の校歌斉唱、甲子園の土、宿命のライバル。
 応援の旋律と校歌はこのゲームのためのオリジナル。 */
const IM={logN:0,band:null,amb:null,ambGain:null,voices:null,capT:0,annSeen:null,songT0:0};
function imSettings(){const S=actionSettings();if(!S.voice)S.voice='text';if(S.cheer==null)S.cheer=true;if(S.song==null)S.song=true;return S;}
function imAudio(){const S=actionSettings();if(!S.sound)return null;try{if(!AR.audio){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AR.audio=new C();}if(AR.audio.state==='suspended')AR.audio.resume();return AR.audio;}catch(e){return null;}}
/* ---- 字幕と音声 ---- */
function imCaption(text,role){const el=$('#arcap');if(!el)return;el.hidden=false;el.className='ar-cap '+(role||'pbp')+' show';el.innerHTML=`<span class="who">${role==='anc'?'場内':'実況'}</span>${esc(text)}`;clearTimeout(IM.capT);IM.capT=setTimeout(()=>{el.classList.remove('show');setTimeout(()=>{if(!el.classList.contains('show'))el.hidden=true;},350);},role==='anc'?3200:2600);}
function imVoices(){if(IM.voices)return IM.voices;try{const vs=window.speechSynthesis.getVoices().filter(v=>/^ja/i.test(v.lang));if(!vs.length)return null;const fem=vs.find(v=>/kyoko|o-ren|haruka|nanami|sayaka|mizuki|female|女性/i.test(v.name))||vs[0];const male=vs.find(v=>/otoya|hattori|ichiro|keita|daichi|male|男性/i.test(v.name)&&v!==fem)||vs.find(v=>v!==fem)||vs[0];IM.voices={anc:fem,pbp:male};return IM.voices;}catch(e){return null;}}
/* role: anc=場内アナウンス（女性の声）／pbp=実況。pri: 2=いま話している内容を止めてでも話す */
function imSay(text,role,pri){const S=imSettings();if(S.voice==='off'||!AR.el||AR.el.hidden||!text)return;imCaption(text,role);
 if(S.voice!=='voice'||!window.speechSynthesis)return;try{const ss=window.speechSynthesis;if(pri>=2)ss.cancel();else if(ss.speaking&&ss.pending)return;
  const u=new SpeechSynthesisUtterance(String(text).replace(/[（）「」]/g,' '));u.lang='ja-JP';const vs=imVoices();if(vs&&vs[role])u.voice=vs[role];u.rate=role==='anc'?0.92:1.12;u.pitch=role==='anc'?1.2:1.0;u.volume=0.95;ss.speak(u);}catch(e){}}
function imStopVoice(){try{if(window.speechSynthesis)window.speechSynthesis.cancel();}catch(e){}}
/* ---- 場内アナウンス：打者紹介（その打者の最初の打席は2回繰り返す） ---- */
function imAnnounceBatter(){const m=AR.m;if(!m||m.done)return;const t=m.bat();const slot=t.lineup[t.batIdx];if(!slot)return;const p=slot.p;const k=t.name+'|'+p.id;if(!IM.annSeen)IM.annSeen=new Set();
 const pos={投:'ピッチャー',捕:'キャッチャー',一:'ファースト',二:'セカンド',三:'サード',遊:'ショート',左:'レフト',中:'センター',右:'ライト',指:'指名打者'}[slot.pos]||posName(slot.pos);const first=!IM.annSeen.has(k);IM.annSeen.add(k);const nm=p.name.split(/\s/)[0]+'くん';
 imSay(first?`${t.batIdx+1}番、${pos}、${nm}。${pos}、${nm}。`:`${t.batIdx+1}番、${pos}、${nm}。`,'anc',1);}
/* ---- 実況：結果に応じたひとこと ---- */
function imCallResult(ev,before){const m=AR.m;if(!m)return;const k=ev.kind;const pa=m.pa;const b=pa&&pa.b?pa.b:null;const nm=b?b.name.split(/\s/)[0]:'';
 const runs=before?(m.score[0]+m.score[1])-(before[0]+before[1]):0;const batUser=m.bat().isUser;
 let line='';
 if(k==='kSwing')line=pick([`空振り三振！`,`振った！空振り三振！`,`${nm}、空振り三振！`]);
 else if(k==='kLook')line=pick([`見逃し三振！`,`手が出ない！見逃し三振！`]);
 else if(k==='bb')line=pick(['フォアボール。','四球を選びました。']);
 else if(k==='hbp')line='デッドボール。';
 else if(k==='inplay'&&ev.bb){const r=ev.bb.res;if(r==='HR')line=pick(['打った！大きい！','打ったー！これは大きい！']);else if(r==='3B')line='打った！右中間を破る！';else if(r==='2B')line=pick(['打った！長打コース！','打球は外野の間を抜けた！']);else if(r==='1B')line=pick(['打った！ヒット！','しぶとく外野へ運んだ！','うまく合わせた！']);else if(r==='E')line='おっと、エラーだ！';else if(ev.play&&ev.play.outs>=2)line='ダブルプレー！';else line=R()<0.5?'打ち取りました。':'';}
 if(runs>0&&!(ev.bb&&ev.bb.res==='HR')){const tn=schoolShort(m.bat().name);const s=m.score;const lead=batUser?(m.A.isUser?s[0]-s[1]:s[1]-s[0]):(m.A.isUser?s[1]-s[0]:s[0]-s[1]);line+=` ${tn}、${runs===1?'1点':runs+'点'}${lead===0?'、同点！':lead>0&&lead<=runs?'、勝ち越し！':'！'}`;imCrowdRoar(batUser?1:0.6);}
 if(line)imSay(line.trim(),'pbp',(k==='inplay'||k==='kSwing'||k==='kLook')?2:1);
 if(k==='inplay'&&ev.bb&&['1B','2B','3B','E'].includes(ev.bb.res))imCrowdRoar(batUser?0.8:0.5);}
function imCallHR(){const m=AR.m;const b=m&&m.pa?m.pa.b:null;imSay(`入った！ホームラン！${b?b.name.split(/\s/)[0]+'！':''}`,'pbp',2);imCrowdRoar(1.4);}
function imCallSubs(){const m=AR.m;if(!m)return;const L=m.log;for(let i=IM.logN;i<L.length;i++){const l=L[i];if(l.kind!=='sub')continue;const mm=l.text.match(/(投手交代|代打|代走|守備交代)：(.+?)→([^（]+)/);if(!mm)continue;const o=mm[2].split(/\s/)[0],n=mm[3].trim().split(/\s/)[0];
  const kind=mm[1]==='投手交代'?'ピッチャー':mm[1]==='代打'?'バッター':mm[1]==='代走'?'ランナー':'守備';imSay(kind==='守備'?`守備の交代をお知らせいたします。${o}くんに代わりまして、${n}くん。`:`${kind}、${o}くんに代わりまして、${n}くん。`,'anc',1);}
 IM.logN=L.length;}
/* ---- サイレン（試合開始・終了） ---- */
function imSiren(dur){const a=imAudio();if(!a)return;try{dur=dur||5.5;const t=a.currentTime+0.05;const g=a.createGain();const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1500;
 const dl=a.createDelay();dl.delayTime.value=0.23;const fb=a.createGain();fb.gain.value=0.32;dl.connect(fb);fb.connect(dl);
 const os=[0,1].map(i=>{const o=a.createOscillator();o.type=i?'square':'sawtooth';o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(i?655:650,t+1.6);o.frequency.setValueAtTime(i?655:650,t+dur-1.4);o.frequency.exponentialRampToValueAtTime(170,t+dur);o.connect(lp);return o;});
 const lfo=a.createOscillator();lfo.frequency.value=6;const lg=a.createGain();lg.gain.value=5;lfo.connect(lg);os.forEach(o=>lg.connect(o.frequency));
 g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.06,t+0.9);g.gain.setValueAtTime(0.06,t+dur-1.1);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
 lp.connect(g);g.connect(a.destination);g.connect(dl);dl.connect(a.destination);os.forEach(o=>{o.start(t);o.stop(t+dur+0.1);});lfo.start(t);lfo.stop(t+dur+0.1);}catch(e){}}
/* ---- 歓声（ノイズの帯域を揺らす）と盛り上がり ---- */
function imAmbStart(level){const a=imAudio();const S=imSettings();if(!a||!S.cheer||IM.amb)return;try{const len=a.sampleRate*3;const buf=a.createBuffer(1,len,a.sampleRate);const ch=buf.getChannelData(0);let lp=0;for(let i=0;i<len;i++){lp=lp*0.96+(Math.random()*2-1)*0.04;ch[i]=lp*6;}
 const src=a.createBufferSource();src.buffer=buf;src.loop=true;const bp=a.createBiquadFilter();bp.type='bandpass';bp.frequency.value=700;bp.Q.value=0.6;const g=a.createGain();g.gain.value=0.012+0.03*(level||0.4);src.connect(bp);bp.connect(g);g.connect(a.destination);src.start();IM.amb=src;IM.ambGain=g;IM.ambBase=g.gain.value;}catch(e){}}
function imCrowdRoar(k){const a=AR.audio;if(!a||!IM.ambGain)return;try{const t=a.currentTime;const g=IM.ambGain.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(IM.ambBase+0.09*(k||1),t+0.35);g.linearRampToValueAtTime(IM.ambBase,t+2.8);}catch(e){}}
function imAmbStop(){try{if(IM.amb){IM.amb.stop();IM.amb.disconnect();}}catch(e){}IM.amb=null;IM.ambGain=null;}
/* ---- ブラスバンドと太鼓（オリジナルの応援リフ）：攻撃中の投球間だけ鳴らす ---- */
const IM_RIFFS=[[[67,.5],[67,.5],[69,.5],[67,.5],[72,1],[71,1],[69,.5],[69,.5],[71,.5],[69,.5],[67,2]],[[64,.5],[67,.5],[69,1],[69,.5],[67,.5],[64,1],[62,.5],[64,.5],[67,1],[62,2]],[[72,.75],[72,.25],[71,.5],[69,.5],[67,1],[69,1],[71,.5],[72,.5],[74,1],[72,2]]];
function imBandTick(now){const S=imSettings();const a=AR.audio;const m=AR.m;if(!S.cheer||!S.sound||!a||!m||m.done){imBandStop();return;}
 const ph=AR.phase;const play=(ph==='pre'||ph==='wind'||ph==='gauge'||ph==='sim')&&!AR.panel;if(!play){if(IM.band)IM.band.next=Math.max(IM.band.next,a.currentTime+0.3);return;}
 const userBat=m.bat().isUser;
 if(!IM.band||IM.band.side!==userBat){IM.band={side:userBat,next:a.currentTime+0.15,beat:0,riff:(m.bat().batIdx+(userBat?0:1))%IM_RIFFS.length,ni:0,nt:0};}
 const bd=IM.band;const spb=60/138;const vol=userBat?1:0.45;
 while(bd.next<a.currentTime+0.25){const t=bd.next;const bt=bd.beat%8;imDrum(t,bt%2===0?0.11*vol:0.06*vol,bt%2===0?90:150);if(bt===7||bt===3)imDrum(t+spb/2,0.05*vol,160);
  /* 旋律：4小節ごとに1回 */if(bd.beat%16===0){let tt=t;for(const [n,d] of IM_RIFFS[bd.riff]){imBrass(tt,n,d*spb*0.92,0.035*vol);tt+=d*spb;}}
  bd.beat++;bd.next+=spb;}}
function imDrum(t,v,f){const a=AR.audio;try{const n=a.createBufferSource();const len=Math.floor(a.sampleRate*0.18);const buf=a.createBuffer(1,len,a.sampleRate);const ch=buf.getChannelData(0);for(let i=0;i<len;i++){const e=Math.exp(-i/(len*0.18));ch[i]=(Math.sin(i/a.sampleRate*2*Math.PI*f)*0.8+(Math.random()*2-1)*0.35)*e;}n.buffer=buf;const g=a.createGain();g.gain.value=v;n.connect(g);g.connect(a.destination);n.start(t);}catch(e){}}
function imBrass(t,note,d,v){const a=AR.audio;try{const f=440*Math.pow(2,(note-69)/12);const o=a.createOscillator(),o2=a.createOscillator();o.type='sawtooth';o2.type='sawtooth';o.frequency.value=f;o2.frequency.value=f*1.004;const lp=a.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(900,t);lp.frequency.linearRampToValueAtTime(2400,t+0.06);const g=a.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.03);g.gain.setValueAtTime(v*0.8,t+Math.max(0.05,d-0.06));g.gain.linearRampToValueAtTime(0.0001,t+d);o.connect(lp);o2.connect(lp);lp.connect(g);g.connect(a.destination);o.start(t);o2.start(t);o.stop(t+d+0.05);o2.stop(t+d+0.05);}catch(e){}}
function imBandStop(){IM.band=null;}
/* ---- 観客の入り：大会・回戦・評判で変わる（練習試合はまばら、甲子園の決勝は満員） ---- */
function imCrowdFill(ctx){const k=ctx&&ctx.kind||'practice';const t=G.tourney&&G.tourney.kind===k&&!G.tourney.done?G.tourney:null;const prog=t&&t.rounds&&t.rounds[t.cur]?1-Math.min(1,Math.log2(Math.max(1,t.rounds[t.cur].length))/5):0;
 let f;if(k==='practice')f={in:0.05,alps:0.08,of:0};else if(k==='district'||k==='autumnDistrict'||k==='invite1')f={in:0.14,alps:0.3,of:0.04};
 else if(k==='koshien'||k==='senbatsu')f={in:0.72+0.28*prog,alps:1,of:0.55+0.45*prog};else if(k==='jingu'||k==='invite3'||k==='invite2')f={in:0.45,alps:0.7,of:0.25};
 else f={in:0.22+0.65*prog,alps:0.45+0.5*prog,of:0.08+0.75*prog};
 f.alps=Math.min(1,f.alps*(0.7+G.rep/300));return f;}
function r3CrowdFill(f){const im=R3.crowd,hm=R3.crowdH;if(!im||!R3.crowdSeed)return;const tmp=new THREE.Object3D();
 R3.crowdSeed.forEach((q,i)=>{const on=q.p<(f[q.zone]==null?f.of:f[q.zone]);tmp.position.set(q.x,q.y,q.z);tmp.rotation.set(0,q.rot,0);tmp.scale.setScalar(on?q.sc:0.0001);tmp.updateMatrix();im.setMatrixAt(i,tmp.matrix);hm.setMatrixAt(i,tmp.matrix);});
 im.instanceMatrix.needsUpdate=true;hm.instanceMatrix.needsUpdate=true;R3.crowdFill=f;}
/* ---- 写真：3D（または2D）の画面をその瞬間に切り取って新聞・アルバムへ ---- */
function imGrab(){try{const src=r3on()?R3.renderer.domElement:AR.cv;if(!src||!src.width)return null;const W=440,H=330;const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');const sw=src.width,sh=src.height;let cw=sw,ch=sw*H/W;if(ch>sh){ch=sh;cw=sh*W/H;}g.drawImage(src,(sw-cw)/2,(sh-ch)/2*0.8,cw,ch,0,0,W,H);return c.toDataURL('image/jpeg',0.7);}catch(e){return null;}}
function imSnap(kind,cap,pri){if(!AR.snaps)AR.snaps=[];if(AR.snaps.some(s=>s.kind===kind&&kind!=='end'))return;const store=d=>{if(d)AR.snaps.push({kind,cap,pri,data:d});};
 if(r3on()){R3.snapReq=store;}else store(imGrab());}
function savePhoto(data,cap,label){G.photos=G.photos||[];const id='ph'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);G.photos.unshift({id,data,cap:cap||'',label:label||'',t:dateStr(),cy:G.calYear});
 /* 容量のため、ピン留めしていない写真は12枚まで */let n=0;G.photos=G.photos.filter(p=>p.pin||(++n)<=12);return id;}
function imPhotoMoments(now){const m=AR.m;if(!m)return;const ph=AR.phase;const S=imSettings();
 if(ph==='field'&&AR.field&&AR.field.kind==='inplay'&&AR.field.c&&AR.field.c.res==='HR'&&!AR.field.snapped){const sc=AR.field;const t=fwTime(sc,now);if(t>sc.T*0.38){sc.snapped=true;const b=m.pa?m.pa.b:null;if(m.bat().isUser&&b)imSnap('hr',`${b.name}の本塁打。打球は${sc.c.dist}メートル先のスタンドへ`,3);}}
 if(ph==='after'&&R3.lastPhaseReact&&AR.ev&&!AR.ev.snapped&&now-AR.resultAt>950){AR.ev.snapped=true;const pa=m.pa;if(m.def().isUser&&pa)imSnap('k',`${pa.p.name}が${pa.b.name}を三振に仕留める`,1);}}
/* ---- 校歌（このゲームのために作ったオリジナルの歌詞と旋律） ---- */
function schoolSong(){if(G.school.song&&G.school.song.lines)return G.school.song;const s=G.school;let h=7;for(const ch of s.name+s.pref)h=(h*31+ch.charCodeAt(0))>>>0;const pk=(arr,k)=>arr[(h>>>(k*3))%arr.length];const nm=s.name.replace(/高等学校|高校$/,'');
 const lines=[`${pk(['朝日に映ゆる','遥かに仰ぐ','緑したたる','潮風かおる','霞たなびく'],1)}　${s.pref}の${pk(['山なみ','大空','野辺','海原','流れ'],2)}`,`${pk(['集いし我ら','学びの友よ','若き命の','誇りも高き'],3)}　${pk(['希望に燃えて','意気高らかに','手を携えて','明日をひらかん'],4)}`,`${pk(['真理の道を','文武の道を','自由の空を','若人の夢を'],5)}　${pk(['ひたすら行かん','ともに拓かん','たゆまず進まん','いま羽ばたかん'],6)}`,`${pk(['ああ','おお'],7)}　${nm}　${pk(['われらが母校','その名ぞ輝く','永遠に栄えよ'],8)}`];
 G.school.song={lines,key:h%5};return G.school.song;}
const IM_SONG=[[60,1],[64,1],[67,1.5],[65,.5],[64,1],[62,1],[60,2],[62,1],[64,1],[65,1],[67,1],[69,2],[67,2],[69,1],[67,1],[65,1],[64,1],[62,1.5],[64,.5],[65,2],[67,1],[64,1],[62,1],[67,1],[60,3],[0,1]];
function imPlaySong(){const a=imAudio();if(!a)return 0;const sg=schoolSong();const tr=[0,2,-1,3,-3][sg.key||0];const spb=60/80;let t=a.currentTime+0.2;const t0=t;
 for(const [n,d] of IM_SONG){if(n){const f=440*Math.pow(2,(n+tr-69)/12);[1,2,3].forEach((hm,i)=>{const o=a.createOscillator();o.type='sine';o.frequency.value=f*hm;const g=a.createGain();const v=[0.05,0.018,0.008][i];g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.05);g.gain.setValueAtTime(v*0.85,t+d*spb-0.08);g.gain.linearRampToValueAtTime(0.0001,t+d*spb);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d*spb+0.05);});
   /* 和音（低音） */const r=n+tr-12-((n-60)%12>=7?7:(n-60)%12>=4?4:0);const o=a.createOscillator();o.type='triangle';o.frequency.value=440*Math.pow(2,(r-69)/12);const g=a.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(0.025,t+0.08);g.gain.linearRampToValueAtTime(0.0001,t+d*spb);o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+d*spb+0.05);}
  t+=d*spb;}
 return (t-t0)*1000;}
/* ---- 試合後のセレモニー：勝てば校歌斉唱、甲子園で負ければ土を持ち帰る ---- */
function imCeremony(){const m=AR.m;const ctx=AR.ctx||{};const S=imSettings();if(!S.song||!m||!m.done)return null;const u=m.user();if(!u)return null;const won=m.winner===(m.A.isUser?0:1);const kind=(UI.match&&UI.match.ctx&&UI.match.ctx.kind)||ctx.kind||'practice';
 if(won&&kind!=='practice')return 'song';if(!won&&(kind==='koshien'||kind==='senbatsu'))return 'soil';return null;}
function imStartCeremony(type){AR.cer={type,t0:performance.now(),dur:type==='song'?Math.max(15000,imPlaySong()+1200):9000,i:-1};imBandStop();imStopVoice();arSetPhase('cer');
 if(type==='song'){const sg=schoolSong();imSay(`ただいまから、${G.school.name}の校歌を斉唱し、${G.school.name}の校旗を掲揚いたします。`,'anc',2);AR.cer.lines=sg.lines;}
 else{const th=active().filter(p=>p.grade===3).map(p=>p.name.split(/\s/)[0]);AR.cer.names=th.slice(0,6);mementoAdd('甲子園の土',`${G.calYear}年 ${UI.match&&UI.match.ctx?UI.match.ctx.label:''}。3年生${th.length}人がグラウンドの土を袋に詰めた`);}
 arRenderAll();}
function imCerLine(now){const c=AR.cer;if(!c||c.type!=='song')return 0;const n=c.lines.length;return Math.min(n-1,Math.floor(clamp((now-c.t0-2200)/(c.dur-3500),0,0.999)*n));}
function imCerHtml(now,first){const c=AR.cer;if(!c)return '';const pop=first?' pop':'';
 if(c.type==='song'){const li=imCerLine(now);return `<div class="cer song${pop}"><div class="cer-h">校歌斉唱</div><div class="cer-s">${esc(G.school.name)}</div><div class="cer-l">${c.lines.map((l,i)=>`<p class="${i===li?'on':i<li?'done':''}">${esc(l)}</p>`).join('')}</div><div class="cer-f">タップで次へ</div></div>`;}
 return `<div class="cer soil${pop}"><div class="cer-h">甲子園の土</div><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><path d="M30 46 Q60 30 90 46 L96 104 Q60 116 24 104 Z" fill="#e8dcc0" stroke="#7a5b33" stroke-width="2"/><path d="M28 66 Q60 58 92 66 L96 104 Q60 116 24 104 Z" fill="#6b4a2f"/><path d="M36 46 Q60 40 84 46" stroke="#7a5b33" stroke-width="3" fill="none"/></svg><div class="cer-t">${c.names&&c.names.length?esc(c.names.join('、'))+'ら3年生が、':''}グラウンドの土を袋に詰めた。<br>この悔しさを、後輩たちが受け継ぐ。</div><div class="cer-f">タップで次へ</div></div>`;}
/* 3D：校歌斉唱では選手が本塁と投手板の間に一列に並び、バックスクリーンを向く */
function r3CeremonyScene(now){const m=AR.m;const u=m.user();const cu=arTeamColors(u);const c=AR.cer;
 const ps=u.lineup.map(s=>s.p);if(u.dh&&u.pitcher&&!ps.includes(u.pitcher))ps.push(u.pitcher);
 const keys=Object.keys(R3.fielders);keys.forEach((k,i)=>{const r=R3.fielders[k];const p=ps[i];if(!p){r.g.visible=false;return;}r.g.visible=true;r.setColors(cu,false);r.setNumber(p.number!=null?p.number:null,cu.trim);r.setGear(null);r.glove.visible=false;r3Dress(r,p);r.g.scale.x=1;
  const x=(i-(keys.length-1)/2)*1.05;const z=c&&c.type==='soil'?-0.6-(i%3)*0.9:-4.2;r.at(x,0,c&&c.type==='soil'?-1.2+(i%2)*0.6:z);
  /* face(0,1)=本塁側を向く／(0,-1)=センター（校旗）側を向く */if(c&&c.type==='soil'){r.face(0,1);const pose=Object.assign({},RP.crouch);pose.head=[-0.5,0,0];pose.rSh=[-1.2,0,-0.2];r.apply(pose);r.setExpression('sad');}else{r.face(0,-1);r.apply(RP.stand);r.setExpression(null);}});
 R3.batter.g.visible=false;for(const r of R3.runners)r.g.visible=false;for(const r of R3.umps)r.g.visible=false;R3.ball.visible=false;R3.mitt.visible=false;
 if(c&&c.type==='soil'){if(R3.schoolFlag)R3.schoolFlag.visible=false;r3SetCam(new THREE.Vector3(2.6,1.7,1.8),new THREE.Vector3(0,0.4,-1),40,false,0.05);return;}
 /* 校歌斉唱：整列した選手の背中越しにバックスクリーンを見る → 望遠で校旗が上がっていく → 再び選手たち */
 const u2=clamp((now-(c?c.t0:now))/(c?c.dur:15000),0,1);const fl=r3SchoolFlag(cu);const fy=R3C_FLAG.y0+(R3C_FLAG.y1-R3C_FLAG.y0)*clamp((u2-0.12)/0.72,0,1);if(fl){fl.visible=true;fl.userData.cloth.position.y=fy;r3WaveFlag(fl,now);}
 const shot=u2<0.32?0:u2<0.74?1:2;const cut=c&&c.shot!==shot;if(c)c.shot=shot;
 if(shot===0){const k=u2/0.32;r3SetCam(new THREE.Vector3(1.4-1.2*k,1.55+0.3*k,1.8+1.2*k),new THREE.Vector3(0,3.2+3*k,-60),38-6*k,cut,0.05);}
 else if(shot===1){r3SetCam(new THREE.Vector3(0.6,1.7,6),new THREE.Vector3(0.9,fy+0.2,-R3C_FLAG.z),7.5,cut,0.08);}
 else{const k=(u2-0.74)/0.26;r3SetCam(new THREE.Vector3(-3.2+1.2*k,1.75,-9.5+1.5*k),new THREE.Vector3(0,1.25,-4.2),40-4*k,cut,0.05);}}
/* 校旗：スコアボードの上のポールに、勝った学校の旗が上がる（チームカラーと校章の文字で描く） */
const R3C_FLAG={x:0,z:132.5+0.4,y0:24.2,y1:30.6};
function r3SchoolFlag(cu){if(!r3on())return null;let g=R3.schoolFlag;
 if(!g){g=new THREE.Group();g.position.set(R3C_FLAG.x,0,-R3C_FLAG.z);const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.1,10,8),r3Mat('#d9dde2'));pole.position.y=23.4+5;g.add(pole);const cap=new THREE.Mesh(new THREE.SphereGeometry(0.18,10,8),r3Mat('#e8c35a'));cap.position.y=23.4+10.1;g.add(cap);
  const cv=document.createElement('canvas');cv.width=384;cv.height=256;const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const geo=new THREE.PlaneGeometry(3,2,14,8);geo.translate(1.5,0,0);
  const cloth=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({map:tex,side:THREE.DoubleSide,emissive:new THREE.Color('#ffffff'),emissiveIntensity:0.18,emissiveMap:tex}));cloth.position.set(0.1,R3C_FLAG.y0,0);g.add(cloth);
  g.userData={cloth,cv,tex,base:geo.attributes.position.array.slice(),key:''};R3.scene.add(g);R3.schoolFlag=g;}
 const key=JSON.stringify([cu.base,cu.trim,cu.mark,G.school.name]);if(g.userData.key!==key){g.userData.key=key;const cv=g.userData.cv;const x=cv.getContext('2d');const W=cv.width,H=cv.height;
  const dark=(h=>{try{const c=h.replace('#','');return parseInt(c.slice(0,2),16)*0.299+parseInt(c.slice(2,4),16)*0.587+parseInt(c.slice(4,6),16)*0.114<140;}catch(e){return true;}});const bg=dark(cu.trim)?cu.trim:(dark(cu.base)?cu.base:'#1b2a4a');const fg=bg===cu.trim?cu.base:'#ffffff';
  x.fillStyle=bg;x.fillRect(0,0,W,H);x.strokeStyle=fg;x.lineWidth=10;x.strokeRect(10,10,W-20,H-20);
  x.beginPath();x.arc(W*0.56,H/2,H*0.3,0,Math.PI*2);x.fillStyle=fg;x.fill();x.beginPath();x.arc(W*0.56,H/2,H*0.24,0,Math.PI*2);x.fillStyle=bg;x.fill();
  x.fillStyle=fg;x.font=`900 ${Math.round(H*0.3)}px "Shippori Mincho","Hiragino Mincho ProN","Noto Serif CJK JP",serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(cu.mark||G.school.name[0],W*0.56,H/2+2);
  const nm=G.school.name;x.font=`700 ${Math.round(H*0.105)}px "Hiragino Mincho ProN","Noto Serif CJK JP",serif`;const step=Math.min(H*0.12,(H-40)/Math.max(1,nm.length));[...nm].forEach((ch,i)=>x.fillText(ch,W*0.15,H/2-(nm.length-1)*step/2+i*step));
  g.userData.tex.needsUpdate=true;}
 return g;}
function r3WaveFlag(g,now){const ud=g.userData;const pos=ud.cloth.geometry.attributes.position;const a=pos.array,b=ud.base;const t=now/1000;
 for(let i=0;i<a.length;i+=3){const x=b[i];const k=x/3;a[i+2]=b[i+2]+Math.sin(x*2.1-t*4.2+b[i+1]*0.8)*0.22*k;a[i+1]=b[i+1]-k*k*0.12;}
 pos.needsUpdate=true;if(!ud.nt||now-ud.nt>120){ud.nt=now;ud.cloth.geometry.computeVertexNormals();}}
