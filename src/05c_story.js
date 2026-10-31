/* ================= 記事づくり（試合記事・大会展望・コラム・他校の話題） =================
 新聞の一面に載る記事を、試合の経過や大会の顔ぶれから書き起こす。表示は 07b_ui_news.js */
const VENUE={district:'市営球場',autumnDistrict:'市営球場',pref:'県営球場',autumnPref:'県営球場',regional:'地区大会会場',koshien:'甲子園球場',senbatsu:'甲子園球場',jingu:'神宮球場',invite1:'招待大会会場',invite2:'招待大会会場',invite3:'招待大会会場'};
function ipText(ipo){const w=Math.floor(ipo/3),r=ipo%3;return r?`${w}回${r}/3`:`${w}回`;}
/* 大会のこの試合が何回戦か、勝てばどこまで進むか */
function stageInfo(t){if(!t||!t.rounds||!t.rounds[t.cur])return null;const n=t.rounds[t.cur].length;const rn=roundName(t,t.cur);
 const winWord=n===1?'優勝':n===2?'決勝進出':n===4?'4強入り':n===8?'8強入り':`${t.cur+2}回戦進出`;const loseWord=(t.userGames||[]).length===0?'初戦敗退':`${rn}で敗退`;return {rn,winWord,loseWord,final:n===1,semi:n===2,first:(t.userGames||[]).length===0};}
/* 試合記事：見出し・袖見出し・本文・談話を経過から書く */
function gameStory(m,res,ctx){try{
 const ui=m.A.isUser?0:1;const us=ui===0?m.A:m.B,them=ui===0?m.B:m.A;const S=schoolShort(G.school.name),O=schoolShort(them.name);
 const won=res.won,sc=res.score,log=m.log||[];const official=ctx.kind!=='practice';const t=official?G.tourney:null;const st=official?stageInfo(t):null;
 let maxDef=0,maxLead=0,lastLeader=0,leadChanges=0;for(const l of log){if(!l.s)continue;const o=l.s[ui],x=l.s[1-ui];maxDef=Math.max(maxDef,x-o);maxLead=Math.max(maxLead,o-x);const ld=Math.sign(o-x);if(ld!==0&&ld!==lastLeader){if(lastLeader!==0)leadChanges++;lastLeader=ld;}}
 const called=res.reason==='コールド';const fullInn=(m.opt&&m.opt.innings)||9;const extra=m.inn>fullInn;
 const walkoff=won&&ui===1&&!called&&m.inn>=fullInn&&log.some(l=>l.kind==='inn'&&l.inn===m.inn&&l.top===false);
 const sayonaraLoss=!won&&ui===0&&!called&&m.inn>=fullInn&&log.some(l=>l.kind==='inn'&&l.inn===m.inn&&l.top===false)&&m.line[1][m.inn-1]>0;
 const hitsUs=sum(res.box.bat.map(b=>b.h)),hitsThem=sum(res.oppBox.bat.map(b=>b.h));const hrs=res.box.bat.filter(b=>b.hr>0);const nHR=sum(hrs.map(b=>b.hr));
 const pits=res.box.pit.slice().sort((a,b)=>b.ipo-a.ipo);const ace=pits[0];const shutout=won&&sc[1]===0;const noHit=won&&hitsThem===0&&m.inn>=Math.min(fullInn,7);const bigK=ace&&ace.so>=10;
 const complete=ace&&pits.length===1;const grand=log.some(l=>l.kind==='hr'&&/4ラン本塁打/.test(l.text)&&res.box.bat.some(b=>l.text.includes(b.name)));
 /* サヨナラ・決勝打の主役：最後に点が入った打席の打者 */
 let hero=null;{for(let i=log.length-1;i>=0;i--){const l=log[i];if(!l.s||l.kind==='inn'||l.kind==='sub'||l.kind==='note')continue;const prevS=(log[i-1]&&log[i-1].s)||[0,0];if(l.s[ui]>prevS[ui]){hero=res.box.bat.map(b=>b.name).find(nm=>l.text.includes(nm))||null;break;}}}
 const mvp=res.mvpName||'';const mvpLine=res.mvpLine||'';const score=`${sc[0]}－${sc[1]}`;
 let head,sub,imp=official?2:1,extraEd=false;
 if(won){
  if(noHit&&ace){head=`${ace.name} 無安打無得点`;sub=`${S} ${st?st.winWord:'快勝'}`;imp=3;}
  else if(walkoff){head=`${S} 劇的サヨナラ`;sub=`${m.inn}回裏 ${hero||mvp}が決めた`;imp=official?3:2;}
  else if(maxDef>=3){head=`${S} ${maxDef}点差はね返す`;sub=`逆転で${st?st.winWord:'白星'}`;imp=official?3:2;}
  else if(extra){head=`${S} 延長${m.inn}回 死闘制す`;sub=st?st.winWord:'粘り勝ち';}
  else if(shutout&&bigK&&complete){head=`${ace.name} ${ace.so}K完封`;sub=`${S} ${st?st.winWord:'零封'}`;}
  else if(called&&st&&st.first){head=`${S} コールド発進`;sub=`${score} ${mvp?mvp+'が躍動':''}`;}
  else if(nHR>=3){head=`${S} ${nHR}発 打ち勝つ`;sub=st?st.winWord:'圧勝';}
  else if(grand){head=`${S} 満塁弾で突き放す`;sub=st?st.winWord:'快勝';}
  else if(st&&st.final){head=`${S} 頂点`;sub=`${t.name} 制す`;imp=3;}
  else if(isRival(them.name)){head=`${S} 宿敵${O}を撃破`;sub=`${st?st.winWord+'　':''}${score}`;imp=Math.max(imp,official?3:2);}
  else{head=`${S} ${st?st.winWord:'白星'}`;sub=mvp?`${mvp} ${mvpLine}`:`${score}で${O}破る`;}
 }else{
  if(sayonaraLoss){head=`${S} 無念のサヨナラ負け`;sub=st?st.loseWord:'あと一歩';}
  else if(sc[1]-sc[0]<=1){head=`${S} 惜敗`;sub=st?st.loseWord:'あと一歩';}
  else if(sc[1]-sc[0]>=7){head=`${S} 力尽きる`;sub=st?st.loseWord:`${O}に完敗`;}
  else if(isRival(them.name)){head=`${S} 宿敵${O}に屈す`;sub=st?st.loseWord:`${score}`;}
  else{head=`${S} ${st?st.loseWord:'黒星'}`;sub=`${O}に${score}`;}
  if(official&&(ctx.kind==='koshien'||ctx.kind==='pref')){const d=sayonaraLoss?'無念のサヨナラ負け':sc[1]-sc[0]<=1?`${O}に惜敗`:sc[1]-sc[0]>=7?`${O}に大敗`:`${O}に${sc[0]}－${sc[1]}`;sub=`${st?st.loseWord+'　':''}${d}`;head=`${S}の夏 終わる`;}
 }
 const venue=VENUE[ctx.kind]||'グラウンド';const winner=won?G.school.name:them.name,loser=won?them.name:G.school.name;const ws=won?sc[0]:sc[1],ls=won?sc[1]:sc[0];
 const parts=[];
 parts.push(`${ctx.label}${st?'の'+st.rn:''}が${dateStr()}、${venue}で行われ、${winner}が${loser}を${ws}－${ls}で${won?'下した':'破った'}${called?`（${m.inn}回コールド）`:extra?`（延長${m.inn}回）`:''}。`);
 if(walkoff)parts.push(`同点で迎えた${m.inn}回裏、${hero||'打線'}の一打でサヨナラ勝ちを収めた。`);
 else if(won&&maxDef>=3)parts.push(`一時は最大${maxDef}点のリードを許したが、打線が粘り強くつないで試合をひっくり返した。`);
 else if(sayonaraLoss)parts.push(`${m.inn}回裏に${them.name}の反撃を受け、最後はサヨナラで力尽きた。`);
 if(hrs.length)parts.push(`${hrs.map(b=>b.name+(b.hr>1?`（${b.hr}本）`:'')).join('、')}に本塁打が飛び出した。`);
 if(ace){const r=ace.r;parts.push(won?`投げては${ace.name}が${ipText(ace.ipo)}を${ace.h}安打${ace.so}奪三振${r?r+'失点':'無失点'}${complete?(r?'で完投':'で完封'):'と好投'}。`:`${ace.name}は${ipText(ace.ipo)}を${ace.h}安打${r}失点${ace.so>=7?`、${ace.so}奪三振と力投したが`:'と'}${won?'':'踏ん張りきれなかった'}。`);}
 if(mvp&&!walkoff&&won&&(!ace||mvp!==ace.name))parts.push(`打っては${mvp}が${mvpLine}と気を吐いた。`);
 parts.push(won?`打線は${hitsUs}安打を放った。`:`打線は${hitsUs}安打に終わった。`);
 if(isRival(them.name)&&G.rival){if(won)G.rival.w++;else G.rival.l++;parts.push(`宿命のライバル${them.name}との対戦成績は${G.rival.w}勝${G.rival.l}敗となった。`);}
 if(st&&won&&!st.final)parts.push(`${st.winWord==='決勝進出'?'決勝':'次戦'}に向け、勢いに乗る。`);
 if(!won&&official&&(ctx.kind==='pref'||ctx.kind==='koshien'))parts.push(`3年生にとって最後の夏が終わった。`);
 const coach=G.coach&&G.coach.name?G.coach.name+'監督':'監督';
 const qC=won?pick(['最後まで諦めない野球ができた。次も一戦必勝で臨みたい','選手たちが本当によく粘ってくれた。まだ通過点です','苦しい試合だったが、練習してきたことを出せた','守りから流れをつくれた。次も自分たちの野球をするだけ']):pick(['選手はよくやってくれた。勝たせてあげられなかったのは私の責任','この悔しさを次につなげたい。下級生は今日の景色を忘れないでほしい','相手が一枚上手だった。もう一度鍛え直します','最後まで食らいついた選手たちを誇りに思う']);
 const heroName=walkoff?(hero||mvp):mvp;const qH=heroName?(won?pick(['みんながつないでくれた。自分は決めるだけでした','狙い球を絞っていました。最高の気分です','チームの勝利に貢献できてうれしい。次も打ちます','監督を胴上げするまで負けられない']):pick(['悔しいです。この経験を次に生かします','仲間に申し訳ない。もっと強くなって戻ってきます','最後まで楽しんでやれました。後輩たちに託します'])):'';
 const quotes=[{who:coach,text:qC}];if(qH)quotes.push({who:heroName,text:qH});
 const mvpP=res.mvpId?G.players.find(p=>p.id===res.mvpId):null;
 G.npDay=(G.npDay||0)+1;/* 試合の翌日の紙面に載る（大会は1週の中で日ごとに号が出る） */
 const n={cat:official?'試合':'練習試合',title:head,body:parts.join(''),t:dateStr(),y:G.year,cy:G.calYear,mo:G.month,wk:G.week,d:G.npDay,imp,kind:'game',sub,quotes,pid:mvpP?mvpP.id:null,
  line:{names:[m.A.name,m.B.name],line:m.line.map(r=>r.slice(0,m.inn)),R:m.score.slice(),H:ui===0?[hitsUs,hitsThem]:[hitsThem,hitsUs],ui},round:st?st.rn:'',label:ctx.label,won};
 G.news.unshift(n);if(G.news.length>600)G.news.length=600;return n;}catch(e){if(typeof console!=='undefined')console.warn('gameStory',e);return null;}}
/* ---- 記念の品（アルバムに残る） ---- */
function mementoAdd(title,text){G.mementos=G.mementos||[];G.mementos.unshift({title,text,t:dateStr(),cy:G.calYear});if(G.mementos.length>60)G.mementos.length=60;}
/* ---- 宿命のライバル：県内でいちばん手強い学校。対戦成績を記録し、紙面とカットインで扱う ---- */
function ensureRival(){if(G.rival&&G.rival.name)return G.rival;const c=(G.schools&&G.schools.pref||[]).filter(s=>s.name!==G.school.name).sort((a,b)=>b.strength-a.strength)[0];if(!c)return null;G.rival={name:c.name,pref:c.pref||G.school.pref,w:0,l:0,since:G.calYear};return G.rival;}
function isRival(name){const r=G.rival;return !!(r&&name&&r.name===name);}
/* ---- 大会展望（開幕号の一面） ---- */
function teamPower(){const a=active().filter(p=>p.injury===0);const ps=a.filter(isPitcher).map(pitRating).sort((x,y)=>y-x);const ef=G.lineup?effectiveLineup():null;const bats=ef?ef.slots.map(s=>s.p).filter(Boolean):a.slice().sort((x,y)=>batRating(y)-batRating(x)).slice(0,9);
 const star=v=>clamp(Math.round((v-30)/10),1,5);
 return {pit:star(avg(ps.slice(0,2).length?ps.slice(0,2):[30])),bat:star(avg(bats.map(batRating))),def:star(avg(bats.map(p=>p.bat.field*0.6+p.bat.thr*0.2+p.bat.arm*0.2))),run:star(avg(bats.map(p=>p.bat.speed)))};}
function starStat(st){const h=(()=>{let x=7;for(const ch of st.id||st.name)x=(x*31+ch.charCodeAt(0))>>>0;return x;})();
 if(st.pos==='投'){const v=st.velo||Math.round(140+(st.q-88)*1.4+(h%5));return `最速${v}キロ`;}const hr=st.hrTotal||Math.round(18+(st.q-86)*3.2+(h%9));return `高校通算${hr}本`;}
function tourneyPreview(t){try{
 const teams=t.teams.slice();const strength=x=>x.isUser?teamStrength():x.strength;const ranked=teams.slice().sort((a,b)=>strength(b)-strength(a));
 const marks=['◎','○','▲','△','△'];const fav=ranked.slice(0,5).map((x,i)=>{const ss=starsOf(x.name,x.pref);const ace=ss.find(s=>s.pos==='投');const bat=ss.find(s=>s.pos!=='投');
  let hh=7;for(const ch of x.name)hh=(hh*31+ch.charCodeAt(0))>>>0;const sv=strength(x);const pool=sv>=85?['投打に穴がない','分厚い選手層が武器','試合巧者で終盤に強い']:sv>=75?['強力打線が売り','エース中心の守りの野球','堅守と機動力で勝ち上がる','好投手を複数そろえる']:['勢いに乗ると怖い','粘り強い野球が持ち味','伝統の機動力野球','下級生に好選手が多い','初戦の入り方が鍵'];
  const note=x.isUser?'本紙の地元校。総合力で上位をうかがう':ace&&bat?`投打の柱 ${ace.name}・${bat.name}を擁する`:ace?`エース${ace.name}（${ace.grade}年）が軸`:bat?`強打の${bat.name}（${bat.grade}年）に注目`:sv>=90?'全国屈指の総合力':pool[hh%pool.length];
  return {name:x.name,pref:x.pref||'',mark:marks[i],user:!!x.isUser,note};});
 const userRank=ranked.findIndex(x=>x.isUser);const n=teams.length;const userEval=userRank<0?null:userRank<Math.max(1,n*0.08)?'A':userRank<n*0.25?'B':userRank<n*0.5?'C':'D';
 const names=new Set(teams.filter(x=>!x.isUser).map(x=>x.name+'|'+(x.pref||'')));
 const stars=(G.stars||[]).filter(s=>names.has(s.school+'|'+s.pref)).sort((a,b)=>(a.rank==='S'?0:1)-(b.rank==='S'?0:1)||b.q-a.q).slice(0,5).map(s=>({name:s.name,school:s.school,pref:s.pref,grade:s.grade,pos:s.pos,rank:s.rank,title:s.title,stat:starStat(s),seed:s.id}));
 const mine=active().filter(p=>p.injury===0).sort((a,b)=>rating(b)-rating(a))[0];
 if(mine)stars.push({name:mine.name,school:G.school.name,pref:G.school.pref,grade:mine.grade,pos:mine.pos,rank:ratingRank(mine),title:mine.title||'チームの大黒柱',stat:isPitcher(mine)?`最速${Math.round(mine.maxVelo||mine.pit.velo)}キロ`:mine.season.ab>=10?`今季打率${(mine.season.h/mine.season.ab).toFixed(3).replace(/^0/,'')}`:mine.career.hr?`通算${mine.career.hr}本塁打`:`${posName(mine.pos)}`,pid:mine.id,user:true});
 let opp=null;const r1=t.rounds[0]||[];for(const m of r1){if(m.a&&m.a.isUser)opp=m.b;else if(m.b&&m.b.isUser)opp=m.a;}
 const S=schoolShort(G.school.name);const top=fav[0];const pw=teamPower();
 const kindHead={pref:`夏の${G.school.pref}大会 開幕`,koshien:'夏の甲子園 開幕',senbatsu:'センバツ 開幕',autumnPref:`秋季${G.school.pref}大会 開幕`,autumnDistrict:'秋季地区予選 開幕',district:'春季地区大会 開幕',regional:`秋季${G.school.region}大会 開幕`,jingu:'神宮大会 開幕',invite1:'交流招待大会 開幕',invite2:'強豪校招待大会 開幕',invite3:'全国選抜招待大会 開幕'}[t.kind]||`${t.name} 開幕`;
 const sub=t.kind==='koshien'?`${n}代表 頂点へ`:t.kind==='senbatsu'?`${n}校 春の頂点へ`:`${n}校 熱戦へ`;
 const body=`${t.name}が${dateStr()}に開幕する。${n}校が出場し、本紙は${top.name}（${top.pref}）を優勝候補の筆頭に挙げる。${top.note}。${fav[1]?`${fav[1].name}、${fav[2]?fav[2].name:''}がこれを追う。`:''}${stars.length>1?`注目選手は${stars.filter(s=>!s.user).slice(0,3).map(s=>`${s.school}の${s.name}（${s.stat}）`).join('、')}ら。`:''}${S}は${userEval?userEval+'評価':'ノーシード'}。${opp?`初戦で${opp.name}${opp.pref&&opp.pref!==G.school.pref?'（'+opp.pref+'）':''}と対戦する。`:'初戦は不戦勝からのスタートとなる。'}${mine?`投打の中心は${mine.name}（${mine.grade}年）。`:''}${G.rival&&teams.some(x=>isRival(x.name))?`宿命のライバル${G.rival.name}（通算${G.rival.w}勝${G.rival.l}敗）との対決にも注目が集まる。`:''}`;
 G.npDay=(G.npDay||0)+1;
 const nn={cat:'展望',title:kindHead,body,t:dateStr(),y:G.year,cy:G.calYear,mo:G.month,wk:G.week,d:G.npDay,imp:4,kind:'preview',sub,preview:{fav,stars,user:{eval:userEval,opp:opp?{name:opp.name,pref:opp.pref||''}:null,pw},teams:n,tname:t.name}};
 G.news.unshift(nn);if(G.news.length>600)G.news.length=600;return nn;}catch(e){if(typeof console!=='undefined')console.warn('preview',e);return null;}}
/* ---- 他校の話題（世界が動いている感じを出す短信） ---- */
function worldNews(){if(!G.stars||!G.stars.length||R()>0.4)return;const st=pick(G.stars);const sch=schoolShort(st.school);
 const inSeason=[3,4,5,6,7,8,9,10,11].includes(G.month);
 const lines=st.pos==='投'?[`${st.school}（${st.pref}）の${st.name}（${st.grade}年）が練習試合で${ri(11,17)}奪三振。${starStat(st)}の直球がさえた`,`${sch}のエース${st.name}、スカウト${ri(5,12)}球団が視察`,`${st.name}（${st.school}）、ブルペンで${ri(80,150)}球の熱投`]
  :[`${st.school}（${st.pref}）の${st.name}（${st.grade}年）が${starStat(st)}に到達`,`${sch}の${st.name}、練習試合で${ri(2,3)}打席連続本塁打`,`${st.name}（${st.school}）にプロ${ri(4,11)}球団のスカウトが熱視線`];
 const winter=[`${st.school}の${st.name}、冬の走り込みで体重${ri(3,7)}キロ増`,`${sch}・${st.name}「春は日本一を」と誓う`];
 const text=inSeason?pick(lines):pick(winter);
 G.news.unshift({cat:'全国',title:text.split('。')[0].slice(0,34),body:text+'。',t:dateStr(),y:G.year,cy:G.calYear,mo:G.month,wk:G.week,d:G.npDay||0,imp:0.5,kind:'world',avatar:{seed:st.id||st.name,pref:st.pref}});if(G.news.length>600)G.news.length=600;}
/* ---- コラム（毎号の一面下段） ---- */
function columnText(cy,mo,wk){const S=G.school.name;const h=((cy*13+mo*7+wk*3)>>>0);const p=arr=>arr[h%arr.length];
 const last=G.lastMatch;const lastLine=last?`先日の${last.label}、${S}は${last.score[0]}－${last.score[1]}で${last.won?'勝った':'敗れた'}。`:'';
 const byMonth={
  1:[`年が明けた。グラウンドの霜を踏みしめながら、球児たちは白い息を吐いて走る。${lastLine}春の訪れまで、地道な日々が続く。冬に流した汗はうそをつかない`,`寒の入り。バットを振る音だけが夕暮れの校庭に響く。派手さはなくとも、この時期の一振りが夏の一打につながる`],
  2:[`立春を過ぎても風は冷たい。それでも練習場のネットの向こうに、球児たちは春の甲子園を思い描く。夢は口にしたときから目標になる`],
  3:[`卒業の季節。グラウンドに一礼して去る三年生の背中を、後輩たちはしっかりと見ていた。受け継がれるのは技術だけではない`,`春の便りが届き始めた。新しいユニフォームに袖を通す日も近い。${lastLine}`],
  4:[`新入部員が真新しいグラブを手にグラウンドへやって来た。声はまだ小さいが、目は輝いている。三年後、彼らはどんな顔をしているだろう`,`桜が散ると、季節は一気に夏へ向かう。新チームの形が見え始める頃だ`],
  5:[`若葉の季節。春の大会はチームの現在地を知る場でもある。${lastLine}負けから学ぶことの方が多いと、昔の監督はよく言っていた`],
  6:[`梅雨空の下、室内練習場ではバットを振る音が絶えない。夏の組み合わせ抽選を前に、どの学校も最後の仕上げに入った`],
  7:[`夏が来た。スタンドの吹奏楽、照りつける日差し、土の匂い。一球ごとに高校生活が凝縮されていく。${lastLine}勝っても負けても、この夏は一度きりだ`,`開会式で行進する球児たちの足取りは力強かった。それぞれの夏が、いま始まる`],
  8:[`甲子園の土は、勝者にも敗者にも等しく熱い。${lastLine}この夏に流した涙の数だけ、人は強くなれる`,`大会が終わり、三年生は静かにグラウンドを去る。新チームの主将は、先輩の背番号をじっと見つめていた`],
  9:[`新チームが動き出した。経験の浅い選手たちにとって、秋の大会は試練の場でもある。${lastLine}伸びしろこそが秋のチームの武器だ`],
  10:[`秋が深まる。来春の選抜出場を懸けた戦いは佳境を迎えた。ドラフト会議のニュースも球児たちの胸を熱くする`],
  11:[`公式戦が終わり、長い冬が始まる。体をつくり、技を磨く日々。春に別人のようになって現れる選手は、きまって冬を大切にした選手だ`],
  12:[`冬合宿。限界まで追い込んだ先に何があるのか、選手たちはまだ知らない。だが、仲間と乗り越えた日々は一生の財産になる`]};
 const coach=G.coach&&G.coach.name?G.coach.name+'監督':'監督';const ap=G.history&&G.history.length?G.history.length:0;
 const closers=[`▼${S}のグラウンドでは今日も白球を追う声が響く。積み重ねた一日一日が、いつか大きな舞台へつながっている`,`▼勝ち負けだけが高校野球ではない。仲間と過ごした時間、悔しさ、喜び。そのすべてが一生の財産になる`,`▼スタンドで声をからす控え部員、ボールを拾う1年生。主役はグラウンドの9人だけではない`,`▼${coach}は言う。「技術より先に、人として成長してほしい」。その言葉を胸に、球児たちは今日もグラウンドへ向かう`,`▼地元の商店街には${S}野球部の写真が貼られている。町の人の声援も、選手たちの背中を押している`];
 return p(byMonth[mo]||byMonth[1])+'。'+closers[(h>>>2)%closers.length];}
/* ---- 架空の広告（紙面の最下段） ---- */
const NP_ADS=[{h:'野球用品のまるやま',t:'グラブの型付け・修理承ります　部活動割引あり',c:'#1f4e8c'},{h:'塩分補給タブレット「夏の一粒」',t:'練習中のこまめな水分と塩分補給を',c:'#c0392b'},{h:'スポーツ整骨院ひかり',t:'投球障害・腰痛のご相談　学生割',c:'#2e7d32'},{h:'ベースボール専門店 ダイヤモンド堂',t:'金属バット・スパイク　新入生セール',c:'#8e44ad'},{h:'応援バス承ります　白鷺観光',t:'甲子園応援ツアー　早期予約受付中',c:'#d35400'},{h:'特製おにぎり 米蔵',t:'練習試合・遠征のお弁当に　団体予約歓迎',c:'#6d4c41'},{h:'学習塾 青空ゼミ',t:'部活と両立　夜9時まで自習室開放',c:'#00838f'},{h:'写真館 フォトスタジオ光',t:'卒業記念・チーム写真の撮影承ります',c:'#455a64'}];
