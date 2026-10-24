/* ================= 調子（コンディション） ================= */
function condOf(p){return p.cond&&p.cond.w>0?p.cond.v:0;}
function setCond(p,v,w){p.cond={v:clamp(v,-2,2),w:w||ri(3,6)};}
function condLabel(p){const v=condOf(p);return v>=2?'絶好調':v===1?'好調':v===-1?'不調':v<=-2?'絶不調':'普通';}
function condIcon(p){const v=condOf(p);return v>=2?'⤴⤴':v===1?'⤴':v===-1?'⤵':v<=-2?'⤵⤵':'';}
function condWeekly(p){if(p.cond&&p.cond.w>0){p.cond.w--;if(p.cond.w<=0)p.cond=null;}else if(R()<0.05){setCond(p,R()<0.55?1:-1,ri(3,6));}}
/* ================= ランダムイベント ================= */
function boostStats(p,keys,amt){for(const k of keys){if(ALL_BAT.includes(k))grow(p,'bat',k,amt);else if(ALL_PIT.includes(k))grow(p,'pit',k,amt);else if(k==='velo')growVelo(p,amt*0.3);else if(['ctrl','move','sharp'].includes(k))growPitch(p,k,amt);}}
function teamFatigue(d){for(const p of active())p.fatigue=clamp(p.fatigue+d,0,100);}
function evPlayer(){const a=active().filter(p=>p.injury===0);return a.length?pick(a):null;}
const EVENTS=[
{id:'kids',w:3,title:'少年野球教室の依頼',text:()=>'地元の少年野球チームから、部員による野球教室を開いてほしいと依頼が来た。謝礼も出るという。',choices:[
 {label:'引き受ける（謝礼20万円・評判+1・部員は少し疲れる）',eff:()=>{income(20,'野球教室の謝礼');G.rep=clamp(G.rep+1,0,100);teamFatigue(5);return '子どもたちに大人気。謝礼20万円を受け取り、地域での評判も上がった。';}},
 {label:'練習を優先して断る',eff:()=>'丁寧に断った。練習に集中できた。'}]},
{id:'ob',w:3,title:'OBからの差し入れ',text:()=>'野球部のOBが練習を見に来て、「後輩のために」と申し出てくれた。',choices:[
 {label:'活動費として受け取る（+30万円）',eff:()=>{income(30,'OBからの寄付');return '30万円を活動費に充てることになった。';}},
 {label:'用具の修理をお願いする',eff:()=>{let n=0;for(const k in G.fac){const f=G.fac[k];if(f&&!f.broken){f.dur=Math.min(f.maxDur,f.dur+20);n++;}}G.ground.dur=Math.min(GROUND_LV[G.ground.lv-1].maxDur,G.ground.dur+20);return `OBの伝手で${n}つの設備とグラウンドを手入れしてもらえた。`;}}]},
{id:'worry',w:4,p:true,title:p=>`${p.name}の悩み`,text:p=>`${p.name}（${p.grade}年）が練習後に監督室を訪ねてきた。「最近、思うように結果が出なくて…」`,choices:[
 {label:'じっくり話を聞く',eff:p=>{if(R()<0.6){setCond(p,1,5);boostStats(p,isPitcher(p)?['kR','kL','hitR']:['meetR','meetL','eye'],2);return `${p.name}は吹っ切れた顔で帰っていった。調子が上向き、少し成長した。`;}abilityChance(p,'free');return `${p.name}は話せてすっきりしたようだ。`;}},
 {label:'「結果は後からついてくる」と突き放す',eff:p=>{if(R()<0.5){setCond(p,-1,4);return `${p.name}は納得できない様子。しばらく不調が続きそうだ。`;}boostStats(p,['clutch'],3);return `${p.name}は奮起した。チャンスでの集中力が上がった。`;}}]},
{id:'tv',w:2,title:'テレビ局の取材',text:()=>'地元テレビ局から野球部の密着取材の申し込みがあった。',choices:[
 {label:'受ける（評判+4・練習時間が削られ疲労+）',eff:()=>{G.rep=clamp(G.rep+4,0,100);teamFatigue(6);addNews('学校',`${G.school.name}野球部にテレビ密着`,`地元局が${G.school.name}野球部の練習風景を特集。選手たちの素顔に反響が集まった。`,{imp:1});return '放送は好評で、学校の評判が上がった。';}},
 {label:'丁重に断る',eff:()=>'練習に集中した。'}]},
{id:'storm',w:2,title:'台風でグラウンドが損傷',text:()=>'台風が直撃し、グラウンドの土が流れて使えない状態になった。',choices:[
 {label:'業者に復旧を頼む（-20万円）',eff:()=>{spend(20,'グラウンド復旧');G.ground.dur=Math.max(G.ground.dur-5,0);return '業者が3日で復旧。練習への影響は最小限だった。';}},
 {label:'部員総出で整備する',eff:()=>{G.ground.dur=Math.max(0,G.ground.dur-25);teamFatigue(10);for(const p of active())grow(p,'bat','speed',0.1);return '丸2日かけて部員で整備。疲れたが足腰は鍛えられた。';}}]},
{id:'sponsor',w:2,title:'地元企業からの申し出',text:()=>'地元企業の社長から「看板を出す代わりに支援したい」と申し出があった。',choices:[
 {label:'看板を設置して支援を受ける（+80万円）',eff:()=>{income(80,'企業からの支援');return '外野フェンスに看板が並び、80万円の支援を受けた。';}},
 {label:'学校の方針で断る',eff:()=>{G.rep=clamp(G.rep+1,0,100);return '堅実な姿勢が評価され、評判が少し上がった。';}}]},
{id:'sick',w:4,p:true,title:p=>`${p.name}の体調`,text:p=>`${p.name}が朝から顔色が悪い。「大丈夫です」と言っているが…`,choices:[
 {label:'無理をさせず休ませる',eff:p=>{p.fatigue=Math.max(0,p.fatigue-20);return `${p.name}を休ませた。翌日には元気を取り戻した。`;}},
 {label:'本人の意思を尊重して練習させる',eff:p=>{if(R()<0.45){p.injury=ri(2,5);return `${p.name}は練習中に倒れ、全治${p.injury}週のケガをしてしまった…`;}boostStats(p,['stamina','speed'],2);p.tough=Math.min(99,p.tough+1);return `${p.name}は最後までやり通した。少したくましくなった。`;}}]},
{id:'joint',w:3,title:'合同練習の誘い',text:()=>'県内の強豪校から合同練習の誘いが来た。バス代がかかるが得るものは大きそうだ。',choices:[
 {label:'参加する（-12万円）',eff:()=>{if(G.money<12)return 'お金が足りず参加できなかった…';spend(12,'合同練習の交通費');for(const p of active()){boostStats(p,isPitcher(p)?['kR','hitR','ctrl']:['meetR','field','eye'],1.5);p.fatigue=clamp(p.fatigue+8,0,100);}return '強豪校の練習を体感し、全員が刺激を受けた。';}},
 {label:'今回は見送る',eff:()=>'いつもどおり練習した。'}]},
{id:'lecture',w:2,title:'監督への講演依頼',text:()=>'地域の指導者講習会で講演をしてほしいと依頼が来た。謝礼は15万円。',choices:[
 {label:'引き受ける',eff:()=>{income(15,'講演の謝礼');return '講演は好評。謝礼15万円を部の活動費にした。';}},
 {label:'断る',eff:()=>'練習に集中した。'}]},
{id:'fight',w:3,p:true,title:'部員同士の衝突',text:p=>`練習中に${p.name}と別の部員が口論になり、雰囲気が悪くなった。`,choices:[
 {label:'全員を集めて話し合う',eff:p=>{for(const q of active())if(R()<0.5)setCond(q,1,3);return '本音をぶつけ合い、チームはむしろまとまった。';}},
 {label:'当人同士に任せる',eff:p=>{if(R()<0.5){setCond(p,-1,4);return 'しこりが残り、しばらく空気が重かった。';}return 'いつの間にか仲直りしていた。'}}]},
{id:'alum',w:2,title:'卒業生が練習を見学',text:()=>'大学で野球を続けている卒業生が練習に顔を出し、「後輩に教えたい」と言ってくれた。',choices:[
 {label:'投手陣を見てもらう',eff:()=>{for(const p of active().filter(isPitcher))boostStats(p,['ctrl','move','kR'],2);return '投手陣が多くのヒントを得た。';}},
 {label:'野手陣を見てもらう',eff:()=>{for(const p of active().filter(q=>!isPitcher(q)))boostStats(p,['meetR','meetL','field'],1.5);return '野手陣が打撃と守備のコツをつかんだ。';}}]},
{id:'method',w:3,title:'新しい練習法',text:()=>'部員が動画で見つけた新しいトレーニング法を試したいと言ってきた。',choices:[
 {label:'試してみる',eff:()=>{if(R()<0.5){for(const p of active())boostStats(p,['speed','stamina','powR'],1.5);return '効果てきめん。全体の身体能力が少し上がった。';}teamFatigue(12);return '合わなかったようで、疲れだけが残った…';}},
 {label:'従来の練習を続ける',eff:()=>'堅実に練習した。'}]},
{id:'theft',w:1,title:'部室で盗難',text:()=>'部室の金庫から活動費が盗まれていたことが分かった。',choices:[
 {label:'警察に届ける',eff:()=>{const amt=Math.min(G.money,ri(10,30));spend(amt,'盗難被害');return `${amt}万円の被害。警察が捜査中だ。`;}},
 {label:'部内で解決する',eff:()=>{const amt=Math.min(G.money,ri(10,30));spend(amt,'盗難被害');for(const q of active())if(R()<0.3)setCond(q,-1,3);return `${amt}万円の被害。疑心暗鬼が広がり雰囲気が悪くなった。`;}}]},
{id:'marathon',w:2,title:'校内マラソン大会',text:()=>'校内マラソン大会が開かれる。野球部として本気で走るか、流すか。',choices:[
 {label:'本気で走る',eff:()=>{for(const p of active()){boostStats(p,['stamina','speed'],2);p.fatigue=clamp(p.fatigue+12,0,100);}return '野球部が上位を独占。スタミナがついた。';}},
 {label:'ケガをしないよう流す',eff:()=>'無難に終えた。'}]},
{id:'nutrition',w:2,title:'栄養講習の案内',text:()=>'栄養士による講習会の案内が届いた。費用は10万円。',choices:[
 {label:'受講する（-10万円）',eff:()=>{if(G.money<10)return 'お金が足りなかった…';spend(10,'栄養講習');for(const p of active())p.tough=Math.min(99,p.tough+2);return '食事の意識が変わり、部員が丈夫になった。';}},
 {label:'見送る',eff:()=>'見送った。'}]},
{id:'scoutvisit',w:2,p:true,title:'プロのスカウトが視察',text:p=>`プロ野球のスカウトが練習を視察に来た。お目当ては${p.name}らしい。`,choices:[
 {label:'普段通り練習させる',eff:p=>{if(R()<0.6){setCond(p,1,4);G.rep=clamp(G.rep+1,0,100);return `${p.name}は視線を力に変え、好調に。スカウトの評価も上々だった。`;}setCond(p,-1,3);return `${p.name}は意識しすぎて動きが硬くなってしまった。`;}},
 {label:'特別メニューでアピールさせる',eff:p=>{boostStats(p,isPitcher(p)?['velo','kR']:['powR','powL'],2);p.fatigue=clamp(p.fatigue+10,0,100);return `${p.name}は全力でアピール。能力が少し伸びたが疲れた。`;}}]},
{id:'hot',w:4,p:true,title:p=>`${p.name}が絶好調`,text:p=>`ここ数日、${p.name}のバットやボールが冴えわたっている。`,choices:[
 {label:'試合で積極的に起用する',eff:p=>{setCond(p,2,4);return `${p.name}は絶好調。しばらく手がつけられない。`;}},
 {label:'調子に乗らないよう引き締める',eff:p=>{setCond(p,1,8);boostStats(p,['clutch'],2);return `${p.name}は落ち着いて練習を続け、長く好調を保てそうだ。`;}}]},
{id:'festival',w:2,title:'文化祭の手伝い',text:()=>'生徒会から文化祭の設営を手伝ってほしいと頼まれた。',choices:[
 {label:'手伝う（評判+2・疲労+）',eff:()=>{G.rep=clamp(G.rep+2,0,100);teamFatigue(6);return '野球部の働きぶりが校内で評判になった。';}},
 {label:'練習を優先する',eff:()=>'練習に集中した。'}]},
{id:'cleanup',w:2,title:'地域清掃活動',text:()=>'町内会から清掃活動への参加を求められた。',choices:[
 {label:'参加する',eff:()=>{G.rep=clamp(G.rep+1,0,100);teamFatigue(3);if(R()<0.3){income(10,'町内会からの差し入れ');return '町内会が差し入れと10万円の寄付をしてくれた。';}return '地域の人に感謝され、評判が少し上がった。';}},
 {label:'一部の部員だけ参加',eff:()=>'無難にこなした。'}]},
{id:'vendor',w:1,title:'怪しい用具業者',text:()=>'「プロも使う最新バット」を格安で売る業者が現れた。15万円。',choices:[
 {label:'買う（-15万円）',eff:()=>{if(G.money<15)return 'お金が足りなかった。';spend(15,'用具購入');if(R()<0.5){for(const p of active().filter(q=>!isPitcher(q)))boostStats(p,['powR','powL'],2);return '本当に良いバットだった。野手のパワーが上がった。';}return '粗悪品だった…。お金をムダにした。';}},
 {label:'断る',eff:()=>'相手にしなかった。'}]},
{id:'rain',w:2,title:'長雨',text:()=>'一週間ずっと雨。グラウンドが使えない。',choices:[
 {label:'室内でできる練習に切り替える',eff:()=>{for(const p of active())boostStats(p,['eye','bunt','ctrl'],1.5);return '基本練習を徹底。細かい技術が上がった。';}},
 {label:'思い切って休養にする',eff:()=>{teamFatigue(-20);return '全員しっかり休み、疲れが抜けた。';}}]},
{id:'talent',w:1,p:true,title:'監督の発見',text:p=>`練習を見ていて、${p.name}に別の適性があるような気がしてきた。`,choices:[
 {label:'投手として投げさせてみる',eff:p=>{if(p.talentP>=70){p.revealed.P=true;return `${p.name}の球は想像以上。投手の才能がある！`;}return `${p.name}の投球は平凡だった。`;}},
 {label:'捕手をやらせてみる',eff:p=>{if(p.talentC>=70){p.revealed.C=true;return `${p.name}のリードと肩は本物。捕手の才能がある！`;}return `${p.name}は捕手には向いていないようだ。`;}}]},
{id:'media',w:2,p:true,title:'雑誌の取材',text:p=>`野球専門誌が${p.name}を特集したいと言ってきた。`,choices:[
 {label:'受ける',eff:p=>{G.rep=clamp(G.rep+2,0,100);addNews('特集',`${G.school.name}・${p.name}が専門誌で特集`,`野球専門誌が${G.school.name}の${p.name}（${p.grade}年・${posName(p.pos)}）を特集。${isPitcher(p)?'最速'+(p.maxVelo||Math.round(p.pit.velo))+'km/hの'+(p.throws==='左'?'左腕':'右腕'):'打席での存在感'}に注目が集まっている。`,{imp:2,pid:p.id});if(R()<0.4)setCond(p,-1,3);return `${p.name}の特集が掲載され、学校の評判が上がった。${condOf(p)<0?'本人は少し浮き足立っている。':''}`;}},
 {label:'本人のために断る',eff:p=>{setCond(p,1,3);return `${p.name}は集中して練習に打ち込めた。`;}}]},
{id:'donation2',w:1,title:'匿名の寄付',text:()=>'学校宛てに匿名で野球部への寄付が届いた。',choices:[
 {label:'ありがたく受け取る',eff:()=>{const amt=ri(30,120);income(amt,'匿名の寄付');return `${amt}万円の寄付。感謝状を新聞に出した。`;}}]},
{id:'birthday',w:2,p:true,title:p=>`${p.name}の誕生日`,text:p=>`今日は${p.name}の誕生日。部員たちがサプライズを企画している。`,choices:[
 {label:'練習を早めに切り上げて祝う',eff:p=>{setCond(p,1,4);for(const q of active())q.fatigue=Math.max(0,q.fatigue-5);return `チーム全体が和やかな雰囲気に。${p.name}は上機嫌だ。`;}},
 {label:'練習後に軽く祝う',eff:p=>{setCond(p,1,2);return `${p.name}は照れながら喜んだ。`;}}]},
{id:'pitcher_arm',w:2,title:'エースの肩に違和感',text:()=>{const a=active().filter(isPitcher).sort((x,y)=>pitRating(y)-pitRating(x))[0];return a?`${a.name}が「肩に少し違和感がある」と言ってきた。`:'投手が肩の違和感を訴えた。';},choices:[
 {label:'精密検査を受けさせる（-5万円）',eff:()=>{const a=active().filter(isPitcher).sort((x,y)=>pitRating(y)-pitRating(x))[0];if(!a)return '問題なかった。';spend(5,'検査費用');a.training='rest';a.fatigue=Math.max(0,a.fatigue-15);return `${a.name}は大事をとって1週間休養。大きなケガを防げた。`;}},
 {label:'様子を見る',eff:()=>{const a=active().filter(isPitcher).sort((x,y)=>pitRating(y)-pitRating(x))[0];if(!a)return '問題なかった。';if(R()<0.4){a.injury=ri(4,10);return `${a.name}は投げ続けて肩を痛め、全治${a.injury}週…`;}return `${a.name}の違和感は数日で消えた。`;}}]},
];
function maybeEvent(){if(G.queue.length)return;const key=G.month+'-'+G.week;if(['4-1','7-2','8-1','2-3','3-3','10-4','9-4'].includes(key))return;if(R()>0.14)return;const pool=EVENTS.filter(e=>!(e.p&&!evPlayer()));const tot=sum(pool.map(e=>e.w));let r=R()*tot;let ev=pool[0];for(const e of pool){r-=e.w;if(r<=0){ev=e;break;}}const p=ev.p?evPlayer():null;enqueue({type:'event',id:ev.id,pid:p?p.id:null});}
function eventById(id){return EVENTS.find(e=>e.id===id);}
