/* White Ball Press v33. 50 themes × 10 lead/headline treatments × 10 structures = 5,000 patterns. */
const V33News=(function newsCore(){
 // 50 event-specific subjects; each has 10 lead/headline treatments × 10 story structures.
 const themes=[
 ["walkoffW","試合","サヨナラ勝ち","最後の得点","最終回の攻防"],
 ["walkoffL","試合","サヨナラ負け","最終回の失点","最後の守備"],
 ["comeback","試合","逆転勝利","追う展開からの得点","反撃の過程"],
 ["blown","試合","逆転負け","先行した展開","リードを失った経過"],
 ["extraW","試合","延長戦制す","延長の攻防","規定回以降の得点"],
 ["extraL","試合","延長で敗戦","延長の攻防","決着までの経過"],
 ["nohit","試合","無安打無得点","被安打ゼロ","投手陣の成績"],
 ["shutoutW","試合","零封勝利","無失点の守り","投手陣の成績"],
 ["shutoutL","試合","無得点で敗戦","得点できなかった打線","攻撃の記録"],
 ["calledW","試合","コールド勝ち","規定による早期決着","得点差"],
 ["calledL","試合","コールド負け","規定による早期決着","失点経過"],
 ["bigW","試合","大差で勝利","得点差を広げた攻撃","得点の内訳"],
 ["bigL","試合","大差で敗戦","得点差が開いた経過","失点の内訳"],
 ["closeW","試合","接戦に勝利","一点差の攻防","決勝点"],
 ["closeL","試合","一点差で敗戦","一点を争った展開","得点差"],
 ["slugW","試合","打撃戦制す","両校の得点","打線の成績"],
 ["slugL","試合","打撃戦で敗戦","両校の得点","攻守の成績"],
 ["duelW","試合","投手戦制す","少ない得点での決着","投手陣の数字"],
 ["win","試合","白星","勝利までの経過","投打の記録"],
 ["loss","試合","黒星","敗戦までの経過","投打の記録"],
 ["champion","大会","大会優勝","大会結果","優勝の意味"],
 ["qualified","大会","出場決定","選考・出場条件","次の大会"],
 ["eliminated","大会","大会敗退・落選","確定した大会結果","今後の日程"],
 ["preview","展望","開幕展望","出場校の顔ぶれ","優勝候補と初戦"],
 ["regional","大会","地区大会の行方","地区の戦績","次の出場条件"],
 ["rival","大会","ライバル対決","両校の対戦記録","次の対戦"],
 ["bracket","大会","大会途中経過","確定した勝ち上がり","組み合わせ"],
 ["schedule","展望","大会・試合日程","予定された日程","準備期間"],
 ["record","記録","校記録更新","更新した数値","従来の記録との比較"],
 ["velocity","記録","球速の新記録","計測された球速","投手の成長"],
 ["recruit","スカウト","進学・入部内定","内定した進路","新年度の編成"],
 ["junior","中学野球","中学球界の話題","中学大会・進路の情報","高校へのステップ"],
 ["national","全国","全国の注目校・選手","全国の選手情報","注目される実績"],
 ["international","U-18","代表の戦い","代表大会の成績","国際舞台での経験"],
 ["feature","特集","選手特集","選手のプロフィール","持ち味と成績"],
 ["awakening","特集","才能の開花","成長のきっかけ","今後の育成"],
 ["mentoring","部内","技術の継承","身につけた技術","先輩から後輩へ"],
 ["camp","部内","合宿・強化練習","合宿の内容","練習計画"],
 ["facility","学校","施設・設備整備","導入・改修の内容","練習環境"],
 ["budget","学校","部の財政・予算","決定した予算","資金の使い道"],
 ["staff","学校","指導体制の変更","就任・退任の内容","新体制の課題"],
 ["school","学校","学校・地域の話題","学校での出来事","部活動との関わり"],
 ["graduation","学校","卒業・新入部員","世代交代の内容","新しいチーム"],
 ["draft","卒業生","プロ・海外への進路","決定した進路","次の舞台"],
 ["alumni","卒業生","OBの活躍・転機","卒業後の記録","母校とのつながり"],
 ["health","部内","コンディション","部員の疲労・負傷状況","練習と休養"],
 ["roster","部内","チームの現在地","学年別の部員構成","選手層"],
 ["batStats","成績","打撃成績分析","今季の打撃成績","出場機会と安打"],
 ["pitStats","成績","投手成績分析","今季の投手成績","投球回と失点"],
 ["weekly","部内","一週間の育成記録","今週の活動","変化と次週"]
 ].map(([id,cat,label,focus,angle])=>({id,cat,label,focus,angle}));
 const byId=Object.fromEntries(themes.map(x=>[x.id,x]));
 const orders=[
 ["key","timeline","bat","pit","other","context"],["timeline","key","pit","bat","context","other"],
 ["bat","key","timeline","pit","other","context"],["pit","timeline","key","bat","other","context"],
 ["other","timeline","key","bat","pit","context"],["context","key","timeline","pit","bat","other"],
 ["key","other","pit","bat","timeline","context"],["timeline","bat","other","key","pit","context"],
 ["bat","pit","key","other","timeline","context"],["key","context","other","timeline","bat","pit"]
 ];
 const styles=[
 ["速報","結果から読む"],["詳報","時系列で読む"],["打撃分析","攻撃に注目"],["投手・守備分析","守りに注目"],["対戦相手","相手側からも見る"],
 ["背景","大会や学校の事情"],["焦点","決着のポイント"],["データ","数字で振り返る"],["選手","個人の記録を読む"],["次戦展望","今後への視点"]
 ];
 const headlines=[
 (f,t)=>f.headline,(f,t)=>`${f.subject}　${t.label}`,(f,t)=>`${t.label}　${f.subject}`,
 (f,t)=>`${f.subject}の${t.focus}`,(f,t)=>`${t.label}の記録　${f.subject}`,
 (f,t)=>`${f.subject}　${t.angle}`,(f,t)=>`${t.focus}を追う　${f.subject}`,
 (f,t)=>`${f.subject}　数字で見る${t.label}`,(f,t)=>`${t.angle}に焦点　${f.subject}`,
 (f,t)=>`${f.subject}　${t.label}詳報`
 ];
 const clean=x=>String(x??"").trim();
 const sentence=x=>{x=clean(x);return !x?"":/[。！？!?]$/.test(x)?x:x+"。";};
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 function select(id,key,recent=[]){let n=hash(key)%100;const avoid=new Set(recent);for(let i=0;i<100&&avoid.has(id+"-"+String(n+1).padStart(3,"0"));i++)n=(n+37)%100;return n;}
 function compose(id,n,f){
  const t=byId[id];if(!t||!Number.isInteger(n)||n<0||n>=100)throw Error("invalid news pattern");
  const a=Math.floor(n/10),b=n%10,blocks=f.blocks||{},main=sentence(f.lead),p=[];
  const opening=[
   ()=>main,
   ()=>`${t.label}の一報が入った。${main}`,
   ()=>`${t.focus}に動きがあった。${main}`,
   ()=>`${main}本紙は${t.focus}に注目した。`,
   ()=>`${main}${t.angle}も見逃せない。`,
   ()=>`${main}${t.focus}について、記録をもとに整理した。`,
   ()=>`${main}記録から${t.focus}をたどる。`,
   ()=>`${main}${t.angle}を数字と事実から読み解く。`,
   ()=>`${main}今回の焦点は${t.focus}だ。`,
   ()=>`${main}ここからは${t.angle}を中心に見ていく。`
  ][a]();
  const used=new Set([main]);for(const k of orders[b]){const x=sentence(blocks[k]);if(x&&!used.has(x)&&!main.includes(x)){used.add(x);p.push(x);}}
  // The final editorial sentence is a lens, not an invented observation or quotation.
  const closers=[
   `以上が今回の${t.focus}に関する記録だ。`,
   `${t.angle}については、経過と結果を分けて捉えたい。`,
   `${t.focus}を評価する際には、一つの数字だけでなく前後の経過も重要になる。`,
   `${t.angle}は、次に同じ状況を迎えた時の判断材料となる。`,
   `${t.focus}を見るうえで、相手や周囲の状況も併せて確認する必要がある。`,
   `${t.angle}を理解するには、今回の結果を従来の取り組みと照らし合わせることが欠かせない。`,
   `${t.focus}の要点は、結果につながった事実を一つずつ検証することにある。`,
   `${t.angle}は数字で確認できる部分と、今後の経過を待つべき部分に分けて見ていきたい。`,
   `${t.focus}に関わる一人一人の取り組みも、引き続き記録していく。`,
   `${t.angle}が次にどうつながるか。今後の動向にも注目したい。`
  ][b];
  if(f.outlook)p.push(sentence(f.outlook));
  p.push(f.editorial&&f.editorial[b]?sentence(f.editorial[b]):closers);
  const head=clean(headlines[a](f,t))||f.headline;
  return {id:id+"-"+String(n+1).padStart(3,"0"),theme:id,genre:t.cat,style:styles[b][0],headline:head,deck:clean(f.deck)||t.angle,lead:main,body:[opening,...p].filter(Boolean).join("\n\n")};
 }
 const total=(a,key)=>a.reduce((n,x)=>n+(Number(x[key])||0),0);
 const fmtIP=n=>Math.floor((n||0)/3)+(n%3?`回${n%3}/3`:"回");
 function matchFacts(res,ctx,school,stage,venue,rival){
  const ui=res.ui===1?1:0,sc=res.score.map(Number),won=!!res.won,opp=res.opp||res.teams?.[1-ui]||"対戦校",winner=won?school:opp,loser=won?opp:school,ws=won?sc[0]:sc[1],ls=won?sc[1]:sc[0],innings=res.inn||9,full=ctx.innings||9,label=ctx.label||res.label||"試合";
  const bat=res.box?.bat||[],pit=res.box?.pit||[],otherBat=res.oppBox?.bat||[],otherPit=res.oppBox?.pit||[],hs=total(bat,"h"),ho=total(otherBat,"h"),hrs=total(bat,"hr"),oppHR=total(otherBat,"hr"),ks=total(pit,"so"),bb=total(pit,"bb"),diff=sc[0]-sc[1];
  const frames=[];let us=0,them=0,maxDef=0,maxLead=0;const lines=res.line||[[],[]];
  for(let i=0;i<innings;i++)for(let side=0;side<2;side++){const v=lines[side]?.[i];if(!Number.isFinite(v))continue;const prev=us-them;if(side===ui)us+=v;else them+=v;maxDef=Math.max(maxDef,them-us);maxLead=Math.max(maxLead,us-them);if(v)frames.push({inn:i+1,top:side===0,ours:side===ui,runs:v,us,them,prev,diff:us-them});}
  const called=res.reason==="コールド",walk=res.reason==="サヨナラ",extra=innings>full;
  let theme=walk?(won?"walkoffW":"walkoffL"):called?(won?"calledW":"calledL"):won&&sc[1]===0&&ho===0&&res.oppBox&&Array.isArray(res.oppBox.bat)&&innings>=Math.min(full,7)?"nohit":extra?(won?"extraW":"extraL"):won&&maxDef>0?"comeback":!won&&maxLead>0?"blown":sc[1]===0&&won?"shutoutW":sc[0]===0&&!won?"shutoutL":Math.abs(diff)>=6?(won?"bigW":"bigL"):sc[0]>=5&&sc[1]>=5?(won?"slugW":"slugL"):Math.abs(diff)===1?(won?"closeW":"closeL"):won&&sc[0]<=3&&sc[1]<=2?"duelW":won?"win":"loss";
  const outcome=byId[theme].label,headline=`${school}　${outcome}`,deck=`${sc[0]}－${sc[1]}　${opp}${stage&&won?"／"+stage.winWord:""}`;
  const lead=`${label}${stage?.rn?"（"+stage.rn+"）":""}が${res.date||""}${venue?"、"+venue+"で":""}行われ、${winner}が${loser}を${ws}－${ls}で下した${called?"（"+innings+"回コールド）":extra?"（延長"+innings+"回）":""}。`;
  const last=frames.at(-1),best=frames.slice().sort((a,b)=>b.runs-a.runs||a.inn-b.inn)[0],when=x=>`${x.inn}回${x.top?"表":"裏"}`;
  let key="";
  if(walk&&last)key=`${when(last)}、${last.ours?school:opp}が${last.runs}点を加え、サヨナラで決着した。`;
  else if(theme==="comeback")key=`${school}は一時${maxDef}点のリードを許したが、最後は${diff}点差で勝利した。`;
  else if(theme==="blown")key=`${school}は最大${maxLead}点をリードしたものの、最終的に${-diff}点差で敗れた。`;
  else if(best)key=`一つの回で最も多く得点したのは${when(best)}。${best.ours?school:opp}が${best.runs}点を挙げた。`;
  const selected=frames.length<=6?frames:frames.filter((f,i)=>i===0||i===frames.length-1||f===best||f.prev*f.diff<=0).slice(0,5).concat(frames.at(-1));
  const unique=[...new Set(selected)].sort((a,b)=>a.inn-b.inn||Number(b.top)-Number(a.top));
  const timeline=unique.length?unique.map(x=>`${when(x)}、${x.ours?school:opp}が${x.runs}点（${school}から見て${x.us}－${x.them}）`).join("。")+"。":"イニング別の得点経過は記録されていない。";
  const batTop=bat.filter(x=>x.h>0||x.rbi>0||x.sb>0).slice().sort((a,b)=>(b.h*2+b.rbi+b.hr*3+b.sb)-(a.h*2+a.rbi+a.hr*3+a.sb)).slice(0,3);
  const batText=`${school}は${hs}安打${hrs?"、"+hrs+"本塁打":""}。`+(batTop.length?batTop.map(x=>`${x.name}は${x.ab||0}打数${x.h||0}安打${x.hr?"、"+x.hr+"本塁打":""}${x.rbi?"、"+x.rbi+"打点":""}${x.sb?"、"+x.sb+"盗塁":""}`).join("。")+"。":"");
  const pitText=pit.length?`${school}の投手陣は${pit.length}人で${ks}奪三振、${bb}四球。`+pit.slice(0,3).map(x=>`${x.name}は${fmtIP(x.ipo)}を投げ、${x.h||0}被安打、${x.r||0}失点、${x.so||0}奪三振`).join("。")+"。":"投手別の成績は記録されていない。";
  const opTop=otherBat.filter(x=>x.h>0||x.rbi>0).sort((a,b)=>b.h+b.rbi-a.h-a.rbi)[0];
  const other=`${opp}は${ho}安打${oppHR?"、"+oppHR+"本塁打":""}。`+(opTop?`${opTop.name}が${opTop.h||0}安打${opTop.rbi?"、"+opTop.rbi+"打点":""}。`:"")+(otherPit.length?`投手陣は計${total(otherPit,"so")}奪三振だった。`:"");
  const context=[stage&&won?`${stage.winWord}となった。`:stage&&!won?`${stage.loseWord}となった。`:"",rival?`ライバルとの通算対戦成績は${rival.w}勝${rival.l}敗。`:"",res.mvpName&&res.mvpLine?`試合の注目選手は${res.mvpName}（${res.mvpLine}）。`:""].filter(Boolean).join("");
  const log=(res.log||[]).filter(l=>["hr","hit","run","err","out","sub"].includes(l.kind)&&l.text).slice(-5).map(l=>`${l.inn}回${l.top?"表":"裏"}　${l.text}`);
  const late=frames.filter(x=>x.inn>=Math.max(1,full-2)),lateUs=late.filter(x=>x.ours).reduce((s,x)=>s+x.runs,0),lateOpp=late.filter(x=>!x.ours).reduce((s,x)=>s+x.runs,0);
  const editorial=[
   `試合を終えてスコアは${sc[0]}対${sc[1]}。${school}の${won?"白星":"黒星"}が記録された。`,
   last?`最後に得点が動いたのは${when(last)}。以後、得点は動かなかった。`:`最終スコアは${ws}対${ls}だった。`,
   `安打数は${school}の${hs}に対し、${opp}は${ho}。得点と安打数を併せて見たい。`,
   `投手陣の${ks}奪三振と${bb}四球も、試合を振り返る上での材料になる。`,
   `${opp}の得点は${sc[1]}、${school}の得点は${sc[0]}。両校の数字が対照をなした。`,
   stage?`大会は${stage.rn}。${won?stage.winWord:stage.loseWord}という結果が残った。`:`この一戦の記録は、次の練習や試合に向けた比較材料となる。`,
   maxDef||maxLead?`試合中の最大点差は、リードが${maxLead}点、ビハインドが${maxDef}点だった（各半イニング終了時）。`:`両校の得点経過を改めて確認したい。`,
   `終盤（${Math.max(1,full-2)}回以降）の得点は${school}が${lateUs}、相手が${lateOpp}。終盤の攻防にも目を向けたい。`,
   batTop.length?`打撃では${batTop[0].name}の${batTop[0].h||0}安打${batTop[0].rbi?"、"+batTop[0].rbi+"打点":""}が記録に残った。`:`個人の成績は投打の記録欄にまとめた。`,
   won?`この白星を次につなげられるか。次の試合での投打にも注目したい。`:`今回の失点や得点機会を検証し、次の試合への材料としたい。`
  ];
  return {theme,subject:school,headline,deck,lead,blocks:{key,timeline,bat:batText,pit:pitText,other,context},stats:{score:sc,hs,ho,hrs,ks,maxDef,maxLead,innings,reason:res.reason||"",ui},log,editorial,people:{bat:batTop.map(x=>({name:x.name,ab:x.ab||0,h:x.h||0,hr:x.hr||0,rbi:x.rbi||0})),pit:pit.slice(0,4).map(x=>({name:x.name,ip:fmtIP(x.ipo),h:x.h||0,r:x.r||0,so:x.so||0}))}};
 }
 function topic(n){
  const s=(n.head||n.title||"")+" "+(n.body||"");
  if(n.kind==="preview")return "preview";
  if(n.cat==="記録")return /球速|最速|km\/h|キロ/.test(s)?"velocity":"record";
  if(n.cat==="大会"){if(/落選|敗退|は準優勝|はベスト/.test(s))return "eliminated";if(/出場決定|出場を決め|甲子園へ|センバツ出場/.test(s))return "qualified";if(/優勝|制覇|日本一|頂点/.test(s))return "champion";return "regional";}
  if(n.cat==="スカウト")return "recruit";if(n.cat==="中学野球")return "junior";if(n.cat==="全国")return "national";if(n.cat==="U-18")return "international";
  if(n.cat==="卒業生")return /指名|契約|挑戦|移籍|プロ入り/.test(s)?"draft":"alumni";
  if(n.cat==="特集")return /覚醒|開花|潜在能力/.test(s)?"awakening":/連覇|制覇/.test(s)?"champion":"feature";
  if(n.cat==="部内")return /継承|受け継|身につけ/.test(s)?"mentoring":/合宿/.test(s)?"camp":/志望|海外挑戦/.test(s)?"draft":"weekly";
  if(n.cat==="学校"||n.cat==="お知らせ")return /予算|増額|財政/.test(s)?"budget":/監督|スカウト.*採用|退職/.test(s)?"staff":/施設|改修|設備|整備|導入|寮/.test(s)?"facility":/卒業|新入部/.test(s)?"graduation":"school";
  if(n.cat==="練習試合"||n.cat==="試合")return /敗戦|敗れ|負け/.test(s)?"loss":"win";return "weekly";
 }
 function sample(id){const t=byId[id],base={subject:"白峰高校",headline:`白峰高校　${t.label}`,deck:t.angle,lead:`白峰高校に関する「${t.label}」の報道サンプル。`,blocks:{key:`${t.focus}を確認するための見本データ。`,timeline:"経過欄には日付、回次、出来事を掲載する。",bat:"打撃・個人の記録欄には確定した数字を掲載する。",pit:"投手・守備の記録欄には投球回や失点を掲載する。",other:"関連情報欄は記事のテーマに応じて構成する。",context:"この記事は記事構成確認用で、実際の試合や選手の記録ではない。"}};return base;}
 return {themes,byId,styles,hash,select,compose,matchFacts,topic,sample};
})();
/* v33 newspaper issue, archive, fact-based reports and weekly coverage. */
(function installNews(){
 const V=V33News,esc0=x=>esc(String(x??"")),sum0=(a,k)=>a.reduce((s,x)=>s+(Number(x[k])||0),0),fmt=n=>Number(n||0).toLocaleString("ja-JP"),limit=600;
 const state={view:"paper",section:"front",q:"",year:"all",cat:"all",page:0};
 function recent(id){return (G.news||[]).slice(0,120).map(n=>n.report?.id).filter(x=>x&&x.startsWith(id+"-"));}
 function attach(n,id,f,keepHead=false){
  if(!n||!V.byId[id])return n;
  const num=V.select(id,[n.cy,n.mo,n.wk,n.d,n.t,n.title,n.body,G.news.length].join("|"),recent(id)),a=V.compose(id,num,f);
  n.report={id:a.id,theme:id,style:a.style,lead:a.lead,deck:a.deck,headline:a.headline};
  if(f.stats)n.report.stats=f.stats;if(f.log?.length)n.report.log=f.log;if(f.people)n.report.people=f.people;
  if(!keepHead){n.title=a.headline;n.head=a.headline;}else if(!n.head)n.head=n.title;
  n.sub=n.sub||a.deck;n.body=a.body;
  n.summary=a.lead;
  return n;
 }
 function snapshotPlayer(pid){const p=(G.players||[]).find(x=>String(x.id)===String(pid));if(!p)return "";const s=p.season||{},grade=p.grade?`${p.grade}年・`:"";
  const lines=[`${p.name}（${grade}${posName(p.pos)}、${p.height||"—"}cm・${p.weight||"—"}kg）`];
  if(s.ab>0)lines.push(`今季は${s.ab}打数${s.h||0}安打${s.hr?"、"+s.hr+"本塁打":""}${s.rbi?"、"+s.rbi+"打点":""}`);
  if(s.ipo>0)lines.push(`投手として${Math.floor(s.ipo/3)}回${s.ipo%3?"と"+s.ipo%3+"/3":""}、${s.pk||0}奪三振`);
  return lines.join("。")+"。";
 }
 function eventFact(n,id){const school=G.school.name,body=String(n.body||n.title||""),p=n.pid&&(G.players||[]).find(p=>String(p.id)===String(n.pid)),subject=p?p.name:school;
  const blocks={},a=active();
  if(p&&["feature","awakening","velocity","record","mentoring","draft"].includes(id))blocks.bat=snapshotPlayer(p.id);
  if(["budget","facility","school","staff"].includes(id))blocks.context=`掲載時点の野球部は現役${a.length}人。${G.coach?.name?"監督は"+G.coach.name+"。":""}`;
  if(id==="budget")blocks.key=`掲載時点の年間予算は${yen(G.budget)}。部の資金残高は${yen(G.money)}。`;
  if(id==="facility")blocks.key=`グラウンドの整備段階は${Number(G.ground?.lv||0)+1}、寮は${Number(G.dorm?.lv||0)+1}。設備の状態と維持費を踏まえた運用が今後の課題となる。`;
  if(id==="staff")blocks.key=G.coach?.name?`掲載時点の監督は${G.coach.name}。${G.scout?.name?"スカウトは"+G.scout.name+"。":""}`:"";
  if(id==="recruit")blocks.context=`来春の入部内定者は掲載時点で${(G.recruits||[]).length}人。`;
  if(id==="graduation")blocks.context=`掲載時点の現役部員は${a.length}人。学年別では${[1,2,3].map(g=>g+"年"+a.filter(x=>x.grade===g).length+"人").join("、")}。`;
  if(id==="camp"&&G.camp)blocks.key=`合宿先は${G.camp.name}。掲載時点で残り${G.camp.weeks}週間。`;
  if(["champion","qualified","eliminated","regional"].includes(id)&&G.tourney?.name)blocks.context=`${G.tourney.name}の大会記録を併せて確認したい。`;
  if(["draft","alumni"].includes(id)&&p?.path)blocks.key=`本人の登録進路は${p.path}。`;
  return {subject,headline:n.head||n.title,deck:n.sub||V.byId[id].angle,lead:body,blocks};
 }
 const oldAdd=addNews;
 addNews=function(cat,title,body,extra){const r=oldAdd(cat,title,body,extra);try{const n=G.news[0];if(!n||n.report)return r;const id=V.byId[extra?.reportTopic]?extra.reportTopic:V.topic(n);attach(n,id,eventFact(n,id),true);}catch(e){console.warn("v33 event article",e);}return r;};
 const coachQuotes={win:["一戦ずつ、できることを積み重ねたい。","結果だけでなく、試合の内容も振り返りたい。","この勝利を次の準備につなげたい。","選手一人一人の取り組みを大事にしたい。","次戦も基本を忘れず臨みたい。","今日の経験を明日からの練習に生かしたい。","ここで満足せず、もう一段上を目指したい。","チームとして次の課題を整理していきたい。"],loss:["悔しい結果だが、ここから何を学ぶかが大切だ。","できたことと課題を整理して、次へ進みたい。","選手たちと一緒に試合を振り返りたい。","結果を受け止め、日々の練習を見直したい。","次に向けて、もう一度足元から取り組みたい。","一つ一つのプレーを振り返るところから始める。","悔しさを次の一歩につなげたい。","今日の結果だけで選手の成長を判断するつもりはない。"]};
 const playerQuotes={win:["次もチームの力になれるよう準備したい。","今日の結果を自信にして、次につなげたい。","一つ一つのプレーを大切にしたい。","また良い結果を残せるよう練習します。","自分の役割を果たせるよう、次も頑張りたい。"],loss:["結果は悔しい。次につながる練習をしたい。","自分のプレーを振り返りたい。","この経験を忘れずに取り組みたい。","課題を一つずつ克服していきたい。","チームの力になれるよう、また準備します。"]};
 const oldGame=gameStory;
 gameStory=function(m,res,ctx){const st=ctx.kind!=="practice"?stageInfo(G.tourney):null,n=oldGame(m,res,ctx);if(!n)return n;
  try{const f=V.matchFacts(res,{...ctx,innings:m.opt?.innings||9},G.school.name,st,VENUE[ctx.kind]||"グラウンド",isRival(res.opp)?G.rival:null);
   const oldImp=n.imp||1;attach(n,f.theme,f);n.sub=f.deck;n.imp=Math.max(oldImp,["walkoffW","comeback","nohit","extraW"].includes(f.theme)?(ctx.kind==="practice"?2:3):1);
   if(st?.final&&res.won){n.imp=Math.max(n.imp,3);n.sub=f.deck+"　優勝";}
   const key=res.won?"win":"loss",h=V.hash(n.report.id+"|"+n.t+"|"+res.opp+"|"+res.score.join("-"));n.quotes=[{who:(G.coach?.name||"監督")+(G.coach?.name?"監督":""),text:coachQuotes[key][h%8]}];if(res.mvpName)n.quotes.push({who:res.mvpName,text:playerQuotes[key][(h>>>5)%5]});n.quoteFiction=true;
   n.cap=res.mvpName?`${res.mvpName}（試合の注目選手）`:"試合の記録";
  }catch(e){console.warn("v33 match report",e);}return n;};
 const oldPreview=tourneyPreview;
 tourneyPreview=function(t){const n=oldPreview(t);if(!n)return n;try{const p=n.preview||{},u=p.user||{},fav=p.fav||[],stars=p.stars||[];
  const f={subject:t.name,headline:n.title,deck:n.sub,lead:`${t.name}が開幕する。出場は${p.teams||t.teams.length}校。本紙は出場校の戦力と登録選手から大会を展望する。`,blocks:{key:fav.length?`本紙の優勝候補は${fav.map(x=>`${x.mark}${x.name}${x.pref?"（"+x.pref+"）":""}`).join("、")}。`:"",timeline:u.opp?`${G.school.name}の初戦の相手は${u.opp.name}。`:"初戦の組み合わせは大会表で確認できる。",bat:stars.length?`注目選手は${stars.map(x=>`${x.name}（${x.school}・${x.grade}年、${x.stat}）`).join("、")}。`:"",context:u.pw?`${G.school.name}の本紙評価は${u.eval||"未評価"}。5段階評価で投手力${u.pw.pit}、攻撃力${u.pw.bat}、守備力${u.pw.def}、機動力${u.pw.run}。`:""},outlook:"本紙予想は開幕時点の評価であり、実際の勝敗を示すものではない。"};
  attach(n,"preview",f,true);
 }catch(e){console.warn("v33 preview",e);}return n;};
 function publish(id,head,lead,blocks={},extra={}){
  const t=V.byId[id];if(!t)return;
  oldAdd(t.cat,head,lead,{imp:extra.imp??.7,kind:extra.kind||"feature",pid:extra.pid??null,...extra});
  const n=G.news[0];attach(n,id,{subject:extra.subject||G.school.name,headline:head,deck:extra.deck||t.angle,lead,blocks,outlook:extra.outlook},true);
  return n;
 }
 function playerFeature(p){const s=p.season||{},position=posName(p.pos);return publish("feature",`${p.name}の現在地　${p.grade}年・${position}`,`${G.school.name}の${p.name}（${p.grade}年・${position}）を取り上げる。身長${p.height}cm、体重${p.weight}kg、${p.throws}投${p.bats}打。`,{bat:s.ab?`今季は${s.ab}打数${s.h||0}安打、${s.hr||0}本塁打、${s.rbi||0}打点。`:"",pit:s.ipo?`投手として${Math.floor(s.ipo/3)}回${s.ipo%3?"と"+s.ipo%3+"/3":""}、${s.pk||0}奪三振。`:"",context:p.title?`中学時代の実績は${p.title}。`:"",key:p.unique?.length?`登録されている固有特能は${p.unique.join("、")}。`:""},{subject:p.name,pid:p.id,imp:1.2});}
 function nationalFeature(force=false){const a=(G.stars||[]).slice();if(!a.length||(!force&&V.hash("world|"+G.calYear+"|"+G.turn)%3!==0))return;
  const s=a[V.hash("star|"+G.calYear+"|"+G.turn)%a.length];const stat=s.pos==="投"&&s.velo?`最速${s.velo}km/h`:s.pos!=="投"&&s.hrTotal?`高校通算${s.hrTotal}本塁打`:"";
  publish("national",`${s.school}・${s.name}に注目`,`${s.pref}の${s.school}に所属する${s.name}（${s.grade}年・${posName(s.pos)}）を全国の注目選手欄で紹介する。`,{key:stat?`登録されている実績は${stat}。`:"",context:s.title?`選手紹介では「${s.title}」とされている。`:"",other:`${s.throws||"—"}投${s.bats||"—"}打。出場大会での活躍に注目したい。`},{subject:s.name,kind:"world",avatar:{seed:s.id||s.name,pref:s.pref},imp:.5});
 }
 worldNews=function(){try{nationalFeature(false);}catch(e){console.warn("v33 national",e);}};
 featureArticles=function(){try{const a=active();if(a.length){const p=a[V.hash("profile|"+G.turn+"|"+G.calYear)%a.length];playerFeature(p);}if(V.hash("national|"+G.turn)%3===0)nationalFeature(true);}catch(e){console.warn("v33 feature",e);}};
 function weeklySnap(){const a=active(),rows=a.map(p=>({id:p.id,name:p.name,grade:p.grade,fat:Number(p.fatigue)||0,inj:Number(p.injury)||0,training:p.training,season:{...(p.season||{})}}));return {rows,turn:G.turn,month:G.month,week:G.week};}
 function weekly(before){const a=weeklySnap(),rows=a.rows,n=rows.length;if(!n)return;const prev=new Map(before.rows.map(p=>[p.id,p])),same=rows.filter(p=>prev.has(p.id)),fat=Math.round(sum0(rows,"fat")/n),oldFat=same.length?Math.round(same.reduce((s,p)=>s+prev.get(p.id).fat,0)/same.length):fat,inj=rows.filter(p=>p.inj>0).length,oldInj=before.rows.filter(p=>p.inj>0).length,school=G.school.name;
  const trained={};for(const p of rows){const k=p.training||"未設定";trained[k]=(trained[k]||0)+1;}
  const counts=[1,2,3].map(g=>`${g}年${rows.filter(p=>p.grade===g).length}人`).join("、"),high=rows.filter(p=>p.fat>=65).length;
  const type=G.turn%4===0?"health":G.turn%4===1?"roster":"weekly";
  publish(type,type==="health"?`${school}のコンディション　負傷${inj}人`:type==="roster"?`${school}　現役${n}人の構成`:`${school}　週間部活動レポート`,`${school}野球部の今週の状況をまとめた。現役${n}人、${counts}。`,{key:`部員の平均疲労度は${fat}。同じ部員を対象にした前週との比較では${oldFat}から${same.length?Math.round(same.reduce((s,p)=>s+p.fat,0)/same.length):fat}。`,timeline:`負傷中の部員は${inj}人（前週${oldInj}人）、疲労度65以上は${high}人。`,context:G.camp?`合宿「${G.camp.name}」は残り${G.camp.weeks}週間。`:""},{imp:.65,deck:"学年別の人数・疲労度・負傷状況"});
  const bat=rows.filter(p=>p.season.ab>=5).sort((a,b)=>(b.season.h||0)/b.season.ab-(a.season.h||0)/a.season.ab||b.season.ab-a.season.ab),pit=rows.filter(p=>p.season.ipo>=3).sort((a,b)=>(b.season.pk||0)-(a.season.pk||0)||b.season.ipo-a.season.ipo);
  if(G.turn%2===0&&bat.length){publish("batStats",`${bat[0].name}が部内打率上位　今季成績`,`${school}の今季打撃成績を、5打数以上の${bat.length}人を対象に集計した。`,{bat:bat.slice(0,5).map(p=>`${p.name}（${p.grade}年） ${p.season.ab}打数${p.season.h||0}安打、打率${((p.season.h||0)/p.season.ab).toFixed(3).replace(/^0/,"")}、${p.season.hr||0}本塁打`).join("。"),context:"打率は打数に対する安打の割合。打数の少ない選手は数字が変動しやすい。"},{subject:bat[0].name,pid:bat[0].id,imp:.8});}
  else if(pit.length){publish("pitStats",`${pit[0].name}の奪三振に注目　投手成績`,`${school}の投手成績を、今季1回以上を投げた${pit.length}人についてまとめた。`,{pit:pit.slice(0,5).map(p=>`${p.name}（${p.grade}年）は${Math.floor(p.season.ipo/3)}回${p.season.ipo%3?"と"+p.season.ipo%3+"/3":""}、${p.season.pk||0}奪三振、${p.season.pr||0}失点`).join("。"),context:"奪三振数だけでなく投球回や失点も合わせて評価したい。"},{subject:pit[0].name,pid:pit[0].id,imp:.8});}
  else if(G.turn%2===0){const p=active()[V.hash("weeklyprofile|"+G.turn)%n];if(p)playerFeature(p);}
  else {const ev=nextEvents().slice(0,4);if(ev.length)publish("schedule",`${school}　これからの日程`,`${school}野球部の今後の主な予定を整理した。`,{timeline:ev.map(x=>`${x.name}（${x.weeks===0?"今週":x.weeks+"週後"}）`).join("。"),context:"大会の出場条件などによって日程は変わることがある。"},{imp:.6});}
  if(G.turn%4===0&&G.rival){const r=G.rival;publish("rival",`${r.name}との対戦記録`,`${school}とライバル${r.name}の通算対戦成績は${r.w}勝${r.l}敗。`,{context:`ライバルとして登録されたのは${r.since}年。`},{subject:school,imp:.6});}
 }
 const oldWeek=weekTick;weekTick=function(){let before=null;try{before=weeklySnap();}catch(e){}const r=oldWeek();if(before)try{weekly(before);}catch(e){console.warn("v33 weekly",e);}return r;};
 const oldAdvance=tourneyAdvance;tourneyAdvance=function(){const t=G.tourney,oldCur=t?.cur;const result=oldAdvance();try{if(t&&!t.done&&t.cur!==oldCur&&!t._news33Rounds?.includes(t.cur)){
  t._news33Rounds=t._news33Rounds||[];t._news33Rounds.push(t.cur);
  const done=(t.rounds[t.cur-1]||[]).filter(m=>m.w&&!m.bye&&Array.isArray(m.s)).slice(0,8),fmt=m=>`${m.a.name} ${m.s[0]}－${m.s[1]} ${m.b.name}`;
  publish("bracket",`${t.name}　${roundName(t,t.cur)}へ`,`${t.name}は${roundName(t,t.cur)}へ進んだ。`,{timeline:done.length?done.map(fmt).join("。"):"",context:`現在のラウンドは${(t.rounds[t.cur]||[]).length}試合の組み合わせ。`},{subject:t.name,imp:1});
 }}catch(e){console.warn("v33 bracket",e);}return result;};
 // Print and archive: the original vertical-layout components remain, but excerpts never overflow.
 const oldBody=npBody;npBody=function(text,bandH,maxBands){const capacity=Math.max(80,Math.floor(bandH/3.45)*15*(maxBands||2)-8),x=String(text||"").replace(/\n+/g,"　");return oldBody(x.length>capacity?x.slice(0,capacity)+"…":x,bandH,maxBands);};
 const oldPhoto=npPhoto;npPhoto=function(n,cls){const h=oldPhoto(n,cls);return n.photo&&npPhotoData(n.photo)?h:h.replace("</figcaption>","<span class=\"np33-ill-label\">［イメージ図］</span></figcaption>");};
 const oldLead=npLead;npLead=function(n){if(n.kind==="preview")return oldLead(n);const i=npIdx(n),h=n.head||n.title,body=(n.summary||n.report?.lead||n.body||"").replace(/\n+/g,"　"),rest=String(n.body||"").split(/\n\s*\n/).slice(n.report?1:0).join("　"),excerpt=rest.length>330?rest.slice(0,330)+"…":rest;
  const quotes=n.quotes?.length?`<div class="np33-quote"><b>談話${n.quoteFiction?"（ゲーム内創作）":"（ゲーム内）"}</b>${n.quotes.slice(0,2).map(q=>`<p>${esc0(q.who)}「${esc0(q.text)}」</p>`).join("")}</div>`:"";
  return `<section class="np-lead np33-lead${n.extra?" gg":""}" data-act="newsOpen" data-i="${i}" role="button" tabindex="0"><div class="np33-kicker"><span>${esc0(n.cat)}</span><span>${esc0(n.report?.style||"記事")}</span></div><div class="np-top"><div class="np-hls">${npHeadline(h,58,n.extra?"gg":"")}${n.sub?`<div class="np-sub${n.extra?" gg":""}">${npTate(String(n.sub).slice(0,27))}</div>`:""}</div>${npPhoto(n,n.extra?"big":"")}</div>${n.line?`<div class="np33-tablewrap">${npLineScore(n.line)}</div>`:""}<p class="np33-standfirst">${esc0(body.slice(0,130))}${body.length>130?"…":""}</p>${excerpt?npBody(excerpt,46,2):""}${quotes}<span class="np33-readlink">記事全文・詳しい記録を読む ›</span></section>`;
 };
 const groups=[["front","一面"],["game","試合・大会"],["club","学校・部内"],["national","全国・進路"],["records","特集・記録"]];
 const section=n=>["試合","練習試合","大会","展望"].includes(n.cat)?"game":["学校","部内","お知らせ"].includes(n.cat)?"club":["全国","中学野球","スカウト","卒業生","U-18"].includes(n.cat)?"national":"records";
 function short(n,max=75){const s=String(n.report?.lead||n.body||"").replace(/\s+/g," ");return s.length>max?s.slice(0,max)+"…":s;}
 function column(is){const lead=is.items[0],theme=lead?.report?.theme,t=V.byId[theme];const texts=[
   "試合の結果は数字として残る。けれど、一球一球の選択や準備がその数字に結びつく。新聞が伝えたいのは、勝敗だけでなく、そこへ至る経過である。",
   "高校野球の時間は限られている。上級生と下級生が同じグラウンドで過ごす日々には、試合成績だけでは測れない意味がある。",
   "春、夏、秋、冬。それぞれの季節に異なる課題がある。記録を振り返り、自分たちの現在地を知ることも次への準備になる。",
   "打席に立つ選手と、ベンチで試合を見つめる選手。チームを支える役割は一つではない。どんな役割も大会を迎えるために欠かせない。"
  ];const h=V.hash(is.key),x=texts[h%texts.length]+(t?`今号は${t.focus}を取り上げた。結果と経過を読み比べ、次への課題を考えたい。`:"");
  return `<aside class="np33-column"><b>球音　<small>編集部コラム</small></b><p>${esc0(x)}</p></aside>`;
 }
 function briefs(items,heading){if(!items.length)return "";return `<div class="np33-briefs"><h3>${esc0(heading)}</h3>${items.map(n=>`<article data-act="newsOpen" data-i="${npIdx(n)}" role="button" tabindex="0"><small>${esc0(n.cat)}${n.extra?"　号外":""}</small><h4>${esc0(n.head||n.title)}</h4><p>${esc0(short(n,95))}</p><span>全文 ›</span></article>`).join("")}</div>`;}
 function page(is,latest){const items=is.items,sec=state.section,selected=sec==="front"?items:items.filter(n=>section(n)===sec),lead=selected[0];
  const links=groups.map(([id,name])=>`<button data-act="news33Section" data-s="${id}" class="${sec===id?"on":""}">${name}<small>${id==="front"?items.length:items.filter(n=>section(n)===id).length}</small></button>`).join("");
  return `<div class="np np33${is.extra?" gg":""}">${npMast(is,latest)}<div class="np33-edition"><span>高校野球専門紙</span><span>${esc0(groups.find(x=>x[0]===sec)?.[1]||"一面")}</span></div><div class="np33-sections">${links}</div>${lead?npLead(lead)+briefs(selected.slice(1),sec==="front"?"本日の記事":"この面の記事"):'<div class="np33-empty">この面の記事はありません。</div>'}${sec==="front"?npModules(is,latest)+(is.extra?"":column(is)+npAds(is)):""}<div class="np-foot">発行　${NP_TITLE}編集部　｜　ゲーム内の架空新聞・記事・談話です</div></div>`;
 }
 const norm=x=>String(x??"").normalize("NFKC").toLowerCase();
 function found(){const words=norm(state.q).split(/\s+/).filter(Boolean);return G.news.filter(n=>(state.year==="all"||String(n.cy||G.calYear)===state.year)&&(state.cat==="all"||n.cat===state.cat)&&words.every(w=>norm([n.title,n.head,n.sub,n.body,n.cat,n.report?.style,n.report?.log?.join(" "),n.quotes?.map(q=>q.who+" "+q.text).join(" ")].join(" ")).includes(w)));}
 function results(){const a=found(),pages=Math.max(1,Math.ceil(a.length/30));state.page=Math.min(state.page,pages-1);return `<div class="np33-resultbar"><span>${a.length}件の記事</span><span>${state.page+1} / ${pages} ページ</span></div><div class="np33-archive-list">${a.slice(state.page*30,(state.page+1)*30).map(n=>`<article class="np33-archive-row" data-act="newsOpen" data-i="${npIdx(n)}" role="button" tabindex="0"><div><small>${esc0(n.cy||"")}年 ${esc0(n.mo||"")}月 ${esc0(n.wk||"")}週　${esc0(n.cat)}${n.extra?"　号外":""}</small><h4>${esc0(n.head||n.title)}</h4><p>${esc0(short(n,115))}</p></div><span>›</span></article>`).join("")||'<div class="np33-empty">該当する記事がありません。</div>'}</div><div class="pnav"><button class="btn sm" data-act="news33Page" data-d="-1" ${state.page===0?"disabled":""}>前へ</button><button class="btn sm" data-act="news33Page" data-d="1" ${state.page>=pages-1?"disabled":""}>次へ</button></div>`;}
 function searchPanel(){const years=[...new Set(G.news.map(n=>String(n.cy||G.calYear)))].sort((a,b)=>+b-+a),cats=[...new Set(G.news.map(n=>n.cat))].sort();const opt=(a,current,all)=>`<option value="all">${all}</option>${a.map(x=>`<option value="${esc0(x)}"${x===current?" selected":""}>${esc0(x)}</option>`).join("")}`;
  return `<section class="card np33-search"><label>記事を検索<input type="search" aria-label="記事を検索" placeholder="選手名・学校名・大会・キーワード" value="${esc0(state.q)}" data-inp="news33Search"></label><div class="np33-filters"><select aria-label="年度" data-chg="news33Year">${opt(years,state.year,"全年度")}</select><select aria-label="カテゴリ" data-chg="news33Cat">${opt(cats,state.cat,"全カテゴリ")}</select></div><div id="np33Results">${results()}</div></section>`;
 }
 viewNewsPaper=function(){const issues=newsIssues();if(!issues.length)return '<div class="muted small">記事はまだありません</div>';UI.newsIssue=clamp(UI.newsIssue||0,0,issues.length-1);const is=issues[UI.newsIssue],back=issues.map((x,k)=>`<option value="${k}"${k===UI.newsIssue?" selected":""}>${x.cy}/${x.mo}/${npDay(x).day}${x.extra?" 号外":""}　${esc0(String(x.items[0].head||x.items[0].title).slice(0,24))}</option>`).join("");
  const nav=`<div class="pnav np33-nav"><button class="btn sm" data-act="newsIssue" data-d="1" ${UI.newsIssue===issues.length-1?"disabled":""}>◀ 前の号</button><select class="np-back" data-chg="newsBack" aria-label="バックナンバー">${back}</select><button class="btn sm" data-act="newsIssue" data-d="-1" ${UI.newsIssue===0?"disabled":""}>次の号 ▶</button></div>`;
  return `<div class="np33-toolbar"><button class="btn sm ${state.view==="paper"?"on":""}" data-act="news33View" data-v="paper">新聞紙面</button><button class="btn sm ${state.view==="search"?"on":""}" data-act="news33View" data-v="search">記事検索</button><a class="btn sm" href="news-patterns.html" target="_blank" rel="noopener">5,000パターン</a></div>${state.view==="search"?searchPanel():nav+page(is,UI.newsIssue===0)+nav}`;
 };
 function updateResults(){const e=document.querySelector("#np33Results");if(e)e.innerHTML=results();}
 INP.news33Search=(d,e)=>{state.q=e.value;state.page=0;updateResults();};
 CHG.news33Year=(d,e)=>{state.year=e.value;state.page=0;updateResults();};CHG.news33Cat=(d,e)=>{state.cat=e.value;state.page=0;updateResults();};
 ACT.news33Page=d=>{state.page=Math.max(0,state.page+Number(d.d));updateResults();};ACT.news33View=d=>{state.view=d.v==="search"?"search":"paper";render();};ACT.news33Section=d=>{if(groups.some(x=>x[0]===d.s)){state.section=d.s;render();}};
 const oldIssue=ACT.newsIssue;ACT.newsIssue=d=>{state.section="front";return oldIssue(d);};
 const oldBack=CHG.newsBack;CHG.newsBack=(d,e)=>{state.section="front";return oldBack(d,e);};
 const oldOpen=ACT.openPaper;ACT.openPaper=d=>{state.view="paper";state.section="front";return oldOpen(d);};
 function statsHtml(n){const r=n.report,s=r?.stats;if(!s)return "";const p=r.people||{},tab=(title,cols,rows)=>rows?.length?`<h4>${title}</h4><div class="np33-tablewrap"><table class="np33-stat"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${esc0(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:"";
  return `<section class="np33-data"><h3>試合の数字</h3><div class="np33-statgrid"><div><small>得点</small><b>${s.score[0]}－${s.score[1]}</b></div><div><small>安打（自校／相手）</small><b>${s.hs}／${s.ho}</b></div><div><small>本塁打</small><b>${s.hrs}</b></div><div><small>奪三振</small><b>${s.ks}</b></div></div>${tab("主な打撃成績",["選手","打数","安打","本塁打","打点"],p.bat?.map(x=>[x.name,x.ab,x.h,x.hr,x.rbi]))}${tab("投手成績",["選手","投球回","被安打","失点","奪三振"],p.pit?.map(x=>[x.name,x.ip,x.h,x.r,x.so]))}</section>`;
 }
 ACT.newsOpen=d=>{const n=G.news[parseInt(d.i,10)];if(!n)return;const pv=n.preview,report=n.report,paras=String(n.body||"").split(/\n\s*\n/).filter(Boolean),pvHtml=pv?`<section class="np33-data"><h3>本紙の優勝候補</h3>${pv.fav.map(f=>`<p>${esc0(f.mark)} <b>${esc0(f.name)}</b> ${esc0(f.pref||"")}　${esc0(f.note)}</p>`).join("")}<h3>注目選手</h3>${pv.stars.map(s=>`<p><b>${esc0(s.name)}</b>（${esc0(s.school)}・${esc0(s.grade)}年） ${esc0(s.stat)}</p>`).join("")}</section>`:"";
  openModal(`<div class="np-read np33-reader"><div class="np-rmast"><span>${NP_TITLE}</span><span>${esc0(n.t)}${n.extra?"　号外":""}</span></div><div class="np33-reader-cat">${esc0(n.cat)}${report?" ・ "+esc0(report.style):""}</div><h2>${esc0(n.head||n.title)}</h2>${n.sub?`<div class="np-rsub">${esc0(n.sub)}</div>`:""}${n.kind==="preview"?"":npPhoto(n,"read")}${n.line?`<div class="np33-tablewrap">${npLineScore(n.line)}</div>`:""}<div class="np33-articlebody">${paras.map(p=>`<p>${esc0(p)}</p>`).join("")}</div>${statsHtml(n)}${n.quotes?.length?`<section class="np33-data"><h3>談話 <small>ゲーム内の創作コメント</small></h3>${n.quotes.map(q=>`<p class="np-rq"><b>${esc0(q.who)}</b>「${esc0(q.text)}」</p>`).join("")}</section>`:""}${report?.log?.length?`<section class="np33-data"><h3>試合経過・記録抜粋</h3>${report.log.map(x=>`<p class="np33-log">${esc0(x)}</p>`).join("")}</section>`:""}${pvHtml}<footer class="np33-readerfoot">${report?`記事構成 ${esc0(report.id)}　｜　`:""}ゲーム内の架空新聞です</footer></div>`);
 };
 document.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target?.matches?.('[data-act="newsOpen"][role="button"]')){e.preventDefault();ACT.newsOpen(e.target.dataset);}});
 window.V33Newspaper={core:V,weekly,publish,attach,state};
})();
