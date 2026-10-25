/* ================= ユーティリティ ================= */
const R=Math.random;
const ri=(a,b)=>a+Math.floor(R()*(b-a+1));
const rf=(a,b)=>a+R()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const pick=a=>a[Math.floor(R()*a.length)];
const shuffle=a=>{const b=a.slice();for(let i=b.length-1;i>0;i--){const j=Math.floor(R()*(i+1));const t=b[i];b[i]=b[j];b[j]=t;}return b;};
const gauss=(m,s)=>{let u=0,v=0;while(u===0)u=R();while(v===0)v=R();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
const letter=v=>v>=90?'S':v>=80?'A':v>=70?'B':v>=60?'C':v>=50?'D':v>=40?'E':v>=30?'F':'G';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=n=>{n=Math.round(n);const neg=n<0;n=Math.abs(n);let s='';if(n>=10000){s+=Math.floor(n/10000)+'億';if(n%10000)s+=(n%10000)+'万';}else s=n+'万';return (neg?'-':'')+s+'円';};
const sum=a=>a.reduce((s,v)=>s+v,0);
const avg=a=>a.length?sum(a)/a.length:0;
const ipStr=outs=>Math.floor(outs/3)+(outs%3?'.'+(outs%3):'');
function genName(){return pick(SURNAMES)+' '+pick(GIVEN);}
function genSchoolName(prefName){const r=R();if(r<0.25)return prefName+pick(SCHOOL_WORDS)+'高校';if(r<0.45)return pick(SCHOOL_WORDS)+'学園';if(r<0.6)return pick(SCHOOL_WORDS)+'学院';return pick(SCHOOL_WORDS)+pick(SCHOOL_SUFFIX);}
function blankStats(){return {g:0,pa:0,ab:0,h:0,hr:0,rbi:0,bb:0,so:0,sb:0,r:0,ipo:0,ph:0,pr:0,per:0,pbb:0,pk:0,w:0,l:0,gs:0};}

/* ================= ゲーム状態 ================= */
let G=null;
const POS_BONUS={投:{},捕:{arm:8,field:5,thr:5,speed:-5},一:{powR:8,powL:6,speed:-4,field:-3},二:{field:6,thr:5,speed:3,powR:-4,powL:-4},三:{arm:6,powR:4,field:3},遊:{field:8,thr:6,speed:5,powR:-3,powL:-3},左:{powR:5,powL:5},中:{speed:8,field:5,rfR:4,rfL:4},右:{arm:8,powR:4,powL:3}};
const PITCH_SPEED_OFF={カーブ:[-22,-30],スローカーブ:[-30,-40],スライダー:[-8,-15],高速スライダー:[-4,-9],縦スライダー:[-8,-14],カットボール:[-4,-8],フォーク:[-8,-15],スプリット:[-5,-10],チェンジアップ:[-15,-25],シンカー:[-10,-18],シュート:[-4,-8],ツーシーム:[-2,-5],パーム:[-20,-30],ナックル:[-30,-45]};

function pickPos(){const r=R();if(r<0.28)return '投';if(r<0.38)return '捕';return pick(['一','二','三','遊','左','中','右']);}
function statv(m,s){return Math.round(clamp(gauss(m,s==null?9:s),12,96));}
/* 球速: 弱小校の投手は90〜110km/h、県の上位校のエースで130台後半、140km/hは県に数人、150km/h超は地方に1〜2人程度 */
function veloFromQ(q){const base=q<=80?76+0.76*q:137+0.6*(q-80);return Math.round(clamp(base+gauss(0,2.5),85,156));}

function veloCapFor(pot,velo){const base=118+pot*3.6+ri(0,3);return Math.round(clamp(Math.max(base,velo+2),velo+2,156));}
/* 投球フォーム（3D表示用）：オーバー／スリークォーター／サイド／アンダー */
function pickPitForm(){const r=R();return r<0.42?'over':r<0.78?'three':r<0.93?'side':'under';}
function genPlayer(o){
 const q=o.q, grade=o.grade||1;
 const p={id:G.seq++,name:o.name||genName(),grade,height:Math.round(clamp(gauss(172,5.5),158,194)),weight:0,throws:R()<0.8?'右':'左',bats:'右',pos:o.pos||pickPos(),sub:[],
  bat:{},pit:{velo:0,stamina:0,hrR:0,hrL:0,hitR:0,hitL:0,kR:0,kL:0,pitches:[]},tough:0,abilities:[],unique:[],potential:0,growth:pick(['早熟','普通','普通','晩成']),academic:0,
  talentP:0,talentC:0,revealed:{P:false,C:false},fatigue:ri(0,20),injury:0,training:'bat',mentor:null,posChange:null,retired:false,caps:{},noise:{},number:null,
  scouted:!!o.scouted,rank:o.rank||null,title:o.title||null,joinYear:G.year,hometown:o.hometown||G.school.pref,season:blankStats(),career:blankStats(),xp:0,u18:0,star:0,weeks:0,maxVelo:0,awakened:0,persona:pickPersona(),trust:0,pitForm:pickPitForm()};
 p.trust=clamp(Math.round(gauss(38,12)+(grade-1)*12),5,90);
 p.weight=Math.round(clamp(p.height-105+gauss(0,6),50,98));p.training=p.pos==='投'?'pitch':'bat';
 const r=R();p.bats=p.throws==='左'?(R()<0.85?'左':'両'):(r<0.62?'右':r<0.93?'左':'両');
 p.potential=o.potential!=null?clamp(Math.round(o.potential),1,10):Math.round(clamp(gauss(5,2)+(q-45)/8,1,10));
 p.academic=Math.round(clamp(gauss(G.school.hensachi,7),20,92));
 p.tough=Math.round(clamp(gauss(50,15),10,95));
 const isP=p.pos==='投';
 p.talentP=isP?Math.round(clamp(gauss(q+8,8),20,99)):Math.round(R()<0.12?clamp(gauss(q+10,8),20,99):clamp(gauss(30,10),5,60));
 p.talentC=p.pos==='捕'?Math.round(clamp(gauss(q+8,8),20,99)):Math.round(R()<0.10?clamp(gauss(q+10,8),20,99):clamp(gauss(30,10),5,60));
 const bq=isP?q-10:q; const bonus=POS_BONUS[p.pos]||{};
 for(const k of ALL_BAT)p.bat[k]=statv(bq+(bonus[k]||0));
 if(p.bats==='両'){p.bat.meetL=statv(bq+2);}
 if(p.bats==='左'){p.bat.meetL=statv(bq-3);p.bat.powL=statv(bq-3);}
 const pq=isP?q:q-22;
 p.pit.velo=veloFromQ(pq);if(isP&&R()<0.025)p.pit.velo+=ri(4,8);
 if(isP&&p.potential>=9&&R()<0.3)p.pit.velo+=ri(2,5);
 for(const k of ALL_PIT)p.pit[k]=statv(pq);
 if(p.throws==='左'){p.pit.kL=statv(pq+4);p.pit.hitL=statv(pq+4);}
 const npitch=isP?(q<45?ri(1,2):q<60?ri(2,3):ri(2,4)):ri(0,1);
 p.pit.pitches=[{name:'ストレート',velo:p.pit.velo,move:statv(pq),sharp:statv(pq),ctrl:statv(pq)}];
 const names=shuffle(PITCH_NAMES.filter(n=>n!=='ナックル'||R()<0.2)).slice(0,npitch);
 for(const n of names){const off=PITCH_SPEED_OFF[n]||[-10,-20];p.pit.pitches.push({name:n,velo:p.pit.velo+ri(off[1],off[0]),move:statv(pq-3),sharp:statv(pq-3),ctrl:statv(pq)});}
 const capBase=q+p.potential*4.5;
 for(const k of ALL_BAT)p.caps['bat'+k]=Math.round(clamp(Math.max(p.bat[k]+3,capBase+gauss(4,7)),20,100));
 for(const k of ALL_PIT)p.caps['pit'+k]=Math.round(clamp(Math.max(p.pit[k]+3,pq+p.potential*4.5+gauss(4,7)),20,100));
 p.caps.velo=veloCapFor(p.potential,p.pit.velo);
 p.caps.pitch=Math.round(clamp(pq+p.potential*4.5+gauss(6,7),40,100));
 for(const k of ALL_BAT)p.noise['bat'+k]=gauss(0,1);
 for(const k of ALL_PIT)p.noise['pit'+k]=gauss(0,1);
 p.noise.velo=gauss(0,1);p.noise.pot=gauss(0,1);
 if(!isP){const cands=POS.filter(x=>x!=='投'&&x!==p.pos);const n=R()<0.5?1:R()<0.7?2:0;p.sub=shuffle(cands).slice(0,n);}
 const up=o.uniqProb==null?0.03:o.uniqProb;
 if(R()<up)p.unique.push(isP?pick(UNIQ_P.concat(UNIQ_X)):pick(UNIQ_B.concat(UNIQ_X)));
 if(o.forceUnique&&!p.unique.length)p.unique.push(isP?pick(UNIQ_P):pick(UNIQ_B));
 const na=q>65?ri(1,3):q>50?ri(0,2):(R()<0.3?1:0);
 const pool=(isP?NORMAL_P:NORMAL_B).concat(NORMAL_X);
 for(let i=0;i<na;i++){const a=pick(pool);if(!p.abilities.includes(a)&&abilReqOk(p,a))p.abilities.push(a);}
 if(R()<0.15){const neg=pick((isP?NEG_P:NEG_B).concat(NEG_X));if(!p.abilities.includes(neg))p.abilities.push(neg);}
 return p;
}
function abilReqOk(p,a){const d=ABIL[a];if(!d||!d.req)return true;const r=d.req;if(r.pow!=null&&(p.bat.powR+p.bat.powL)/2<r.pow)return false;if(r.meet!=null&&(p.bat.meetR+p.bat.meetL)/2<r.meet)return false;if(r.speed!=null&&p.bat.speed<r.speed)return false;if(r.steal!=null&&p.bat.steal<r.steal)return false;if(r.bunt!=null&&p.bat.bunt<r.bunt)return false;if(r.arm!=null&&p.bat.arm<r.arm)return false;if(r.velo!=null&&p.pit.velo<r.velo)return false;if(r.sharp!=null&&avg(p.pit.pitches.map(x=>x.sharp))<r.sharp)return false;if(r.pitches!=null&&p.pit.pitches.length<r.pitches)return false;return true;}
function potLetter(v){return v>=10?'S':v>=9?'A':v>=8?'B':v>=7?'C':v>=6?'D':v>=5?'E':v>=4?'F':'G';}
function shownPot(p){const f=clamp(1-(G.scout?G.scout.level*0.12:0)-G.coach.level*0.04,0,1);if(f<0.2)return potLetter(p.potential)+'（'+p.potential+'）';const n=clamp(p.noise.pot||0,-1.5,1.5);const v=clamp(Math.round(p.potential+n*f*2.5),1,10);return f<0.6?potLetter(v)+'前後':'？（スカウトのレベルで判明）';}
function has(p,a){return p.abilities.includes(a)||p.unique.includes(a);}
function isPitcher(p){return p.pos==='投';}
function pitchQ(p){const ps=p.pit.pitches;return avg(ps.map(x=>x.move*0.35+x.sharp*0.4+x.ctrl*0.25));}
function ctrlAvg(p){return avg(p.pit.pitches.map(x=>x.ctrl));}
function batRating(p){const b=p.bat;return b.meetR*0.2+b.meetL*0.12+b.powR*0.17+b.powL*0.1+b.eye*0.08+b.speed*0.1+b.field*0.1+b.arm*0.05+b.thr*0.04+b.clutch*0.04;}
function pitRating(p){const t=p.pit;const v=clamp((t.velo-95)*1.8,0,100);return v*0.22+t.stamina*0.1+t.hrR*0.08+t.hrL*0.06+t.hitR*0.1+t.hitL*0.08+t.kR*0.1+t.kL*0.08+pitchQ(p)*0.18;}
function rating(p){return isPitcher(p)?pitRating(p)*0.8+batRating(p)*0.2:batRating(p);}
/* 総合ランクの文字：Sは全国でも数人しかいない水準（個々の能力値の文字より厳しい） */
const ratingLetter=v=>v>=94?'S':v>=86?'A':v>=77?'B':v>=68?'C':v>=58?'D':v>=48?'E':v>=38?'F':'G';
function ratingRank(p){return ratingLetter(rating(p));}
/* 学校の強さの文字：90以上（S）は全国で3〜5校だけ */
const strengthLetter=v=>letter(v);
function fogLevel(){const c=G.coach.level,s=G.scout?G.scout.level:0;return clamp(1-c*0.09-s*0.03,0,1);}
function shown(p,g,k){const t=p[g][k];const n=clamp(p.noise[g+k]||0,-2,2);return clamp(t+n*fogLevel()*10,1,100);}
function shownVelo(p){return Math.round(p.pit.velo+(p.noise.velo||0)*fogLevel()*5);}
function dispStat(p,g,k){const f=fogLevel();const v=shown(p,g,k);return f<0.15?`${letter(v)} ${Math.round(v)}`:(f<0.5?`${letter(v)} ${Math.round(v/5)*5}±`:`${letter(v)}?`);}
const POS_NAME={投:'投手',捕:'捕手',一:'一塁手',二:'二塁手',三:'三塁手',遊:'遊撃手',左:'左翼手',中:'中堅手',右:'右翼手'};
function posName(pos){return POS_NAME[pos]||pos;}
function playerPosLabel(p){return p.pos+(p.sub.length?'('+p.sub.join('')+')':'');}
function active(){return G.players.filter(p=>!p.retired);}
function healthy(){return G.players.filter(p=>!p.retired&&p.injury===0);}
function teamKnow(){const a=active();const av=a.length?avg(a.map(p=>p.academic)):50;return Math.round(av*0.8+G.coach.level*2.5+(alumniEff('know')?6:0)+catSum('know')+(G.coach.style==='理論派'?5:0));}
function teamStrength(){const hs=healthy().length>=9?healthy():active();const b=hs.filter(p=>!isPitcher(p)).sort((a,b)=>batRating(b)-batRating(a)).slice(0,8);const ps=hs.filter(isPitcher).sort((a,b)=>pitRating(b)-pitRating(a)).slice(0,2);if(!b.length||!ps.length)return 30;return Math.round(avg(b.map(batRating))*0.6+avg(ps.map(pitRating))*0.4);}
function alumniEff(eff){return G.graduates.some(g=>g.status==='working'&&g.jobEff===eff);}

/* ================= 新規ゲーム ================= */
function defaultUniform(){return {base:'#ffffff',trim:'#0b2a4a',style:'pin',text:'AOBA',textFont:'graduate',textColor:'#0b2a4a',textOutline:'#ffffff',numFont:'oswald',numColor:'#0b2a4a',numOutline:'#ffffff',cap:'#0b2a4a',capBrim:'#0b2a4a',pants:'#ffffff'};}
function defaultEmblem(){return {shape:'shield',bg:'#0b2a4a',border:'#e0a100',text:'青',textFont:'zen',textColor:'#ffffff',ring:true,ringColor:'#e0a100'};}
function newGame(cfg){
 const pref=PREF_DATA.find(p=>p.name===cfg.pref)||PREF_DATA[13];
 G={ver:1,seq:1,year:1,calYear:2026,month:4,week:1,turn:0,
  school:{name:cfg.name||'青葉高校',pref:pref.name,region:pref.region,pw:pref.pw,type:cfg.type||'公立',size:cfg.size||'中',hensachi:cfg.hensachi||52,principalUsed:false},
  uniform:cfg.uniform||defaultUniform(),emblem:cfg.emblem||defaultEmblem(),
  money:0,budget:0,budgetMult:1,nextBudgetMult:1,rep:0,
  coach:{name:pick(COACH_SURNAMES)+' '+pick(GIVEN),level:ri(1,2),salary:0,age:ri(30,52),type:'教師',years:0,spec:'なし'},scout:null,
  fac:{},ground:{lv:1,dur:100},dorm:{lv:0,dur:100},
  players:[],graduates:[],candidates:[],recruits:[],news:[],history:[],queue:[],notices:[],
  flags:{},fin:{income:0,expense:0,items:{}},camp:null,maint:'g1',practiceList:[],practicedThisWeek:false,
  lineup:null,sp:null,settings:{mode:'card'},schools:{local:[],pref:[],powers:{}},results:{},coachMarket:[],scoutMarket:[],u18Log:[],tourney:null,lastMatch:null,marketYear:0,mode:cfg.mode||'normal',goal:null,gameOver:false,tourneyLog:[],records:{},candidatesAll:[]};
 const elite=G.mode==='elite';
 G.rep=elite?ri(76,86):clamp(Math.round((G.school.type==='私立'?30:18)+({小:0,中:5,大:10})[G.school.size]+(G.school.hensachi>62?-4:0)+ri(-4,4)),5,60);
 if(elite){G.coach={name:pick(COACH_SURNAMES)+' '+pick(GIVEN),level:ri(6,8),salary:0,age:ri(45,60),type:'外部',years:ri(3,15),spec:pick(COACH_SPECS).id,style:pick(COACH_STYLES).id,bio:'名将として知られる',career:'甲子園出場'+ri(5,15)+'回'};G.coach.salary=G.coach.level*G.coach.level*12+100;
  G.scout={name:pick(SURNAMES)+' '+pick(GIVEN),level:ri(4,6),salary:0,age:ri(40,58),type:'外部',years:ri(1,8),spec:pick(SCOUT_SPECS).id,bio:'元プロスカウト',career:''};G.scout.salary=G.scout.level*G.scout.level*8+60;
  const pre={bullpen:2,machine:2,cage:1,indoor:1,weight:1,medical:1,bath:1,cafeteria:1,video:0,study:1,gear:1};for(const k in pre){const m=FAC[k].models[pre[k]];G.fac[k]={model:pre[k],dur:Math.round(m.dur*rf(0.5,0.9)),maxDur:m.dur,broken:false};}
  G.ground={lv:3,dur:140};G.dorm={lv:2,dur:100};G.goal={level:3,trust:60,text:'',history:[]};}
 const custom=G.mode==='custom'?Object.assign({money:1000,budgetMult:1,rep:40,q:55,coachLevel:3,scoutLevel:2,facLevel:1,ground:2,dorm:1,goals:false,goalLevel:2,trust:60,uniq:5,stars:0,starQ:80,starPot:10},cfg.custom||{}):null;
 if(custom){G.rep=clamp(Math.round(custom.rep),0,100);G.baseBudgetMult=clamp(custom.budgetMult,0.2,5);
  const cl=clamp(Math.round(custom.coachLevel),1,9);if(cl>=3){G.coach={name:pick(COACH_SURNAMES)+' '+pick(GIVEN),level:cl,salary:cl*cl*12+100,age:ri(38,60),type:'外部',years:0,spec:pick(COACH_SPECS).id,style:pick(COACH_STYLES).id,bio:pick(COACH_BIOS),career:''};}else{G.coach.level=cl;}
  const sl=clamp(Math.round(custom.scoutLevel),0,9);G.scout=sl>0?{name:pick(SURNAMES)+' '+pick(GIVEN),level:sl,salary:sl*sl*8+60,age:ri(35,60),type:'外部',years:0,spec:pick(SCOUT_SPECS).id,bio:pick(SCOUT_BIOS),career:''}:null;
  const fl=clamp(Math.round(custom.facLevel),0,3);const sets=[{},{bullpen:0,machine:0,weight:0,medical:0},{bullpen:1,machine:1,cage:1,indoor:1,weight:1,medical:1,bath:1,study:1,gear:1},null];
  const set=fl===3?Object.fromEntries(FAC_KEYS.map(k=>[k,FAC[k].models.length-1])):sets[fl];for(const k in set){const m=FAC[k].models[set[k]];G.fac[k]={model:set[k],dur:m.dur,maxDur:m.dur,broken:false};}
  G.ground={lv:clamp(Math.round(custom.ground),1,5),dur:0};G.ground.dur=GROUND_LV[G.ground.lv-1].maxDur;G.dorm={lv:clamp(Math.round(custom.dorm),0,4),dur:100};
  if(custom.goals)G.goal={level:clamp(Math.round(custom.goalLevel),1,7),trust:clamp(Math.round(custom.trust),10,100),text:'',history:[]};}
 const ns=G.school.pw>=5?48:G.school.pw>=4?32:G.school.pw>=3?24:16;
 const prefNames=new Set([G.school.name]);
 const mk=(st)=>{let n;do{n=genSchoolName(G.school.pref);}while(prefNames.has(n));prefNames.add(n);return {name:n,strength:st,pref:G.school.pref};};
 for(let i=0;i<ns-1;i++){const base=i<3?58+G.school.pw*6:i<8?50+G.school.pw*4:36+G.school.pw*3;G.schools.pref.push(mk(Math.round(clamp(base+gauss(0,6),25,95))));}
 G.schools.local=shuffle(G.schools.pref.slice(3)).slice(0,7);
 for(const pr of PREF_DATA){const used=pr.name===G.school.pref?prefNames:new Set();G.schools.powers[pr.name]=[0,1,2].map(i=>{let n;do{n=genSchoolName(pr.name);}while(used.has(n));used.add(n);return {name:n,strength:Math.round(clamp(62+pr.pw*4.5-i*4+gauss(0,4),45,88)),pref:pr.name};});}
 applyEliteSchools();refreshStars(true);
 for(let g=1;g<=3;g++){const n=elite?ri(13,16):ri(10,13);for(let i=0;i<n;i++){const q=custom?clamp(gauss(custom.q+(g-1)*4,6),20,95):elite?clamp(gauss(68+(g-1)*4,6),50,92):clamp(gauss(40+G.rep*0.12+(g-1)*5,7),25,75);G.players.push(genPlayer({grade:g,q,uniqProb:custom?clamp(custom.uniq,0,100)/100:elite?0.12:0.03}));}}
 if(custom&&custom.stars>0){const n=clamp(Math.round(custom.stars),0,9);for(let i=0;i<n;i++){const pos=i%3===0?'投':i%3===1?pick(['遊','中','捕']):pick(['一','三','左','右','二']);const p=genPlayer({grade:1,q:clamp(custom.starQ||80,50,95),pos,potential:clamp(custom.starPot||10,1,10),uniqProb:1,forceUnique:true,scouted:true,rank:'S',title:pick(TITLES_NATIONAL)});if(pos==='投'){p.pit.velo=Math.max(p.pit.velo,veloFromQ(custom.starQ||80)+ri(0,4));p.pit.pitches[0].velo=Math.round(p.pit.velo);p.caps.velo=veloCapFor(p.potential,p.pit.velo);}G.players.push(p);}}
 ensurePositions();
 G.budget=calcBudget();G.money=custom?Math.round(custom.money):G.budget;G.fin={income:G.money,expense:0,items:{[custom?'初期資金':'学校予算']:G.money}};
 autoLineup();autoNumbers();
 G.practiceList=genPracticeList();
 addNews('お知らせ',`${G.school.name}野球部、新体制でスタート`,`${G.calYear}年、${G.school.pref}の${G.school.name}野球部は新しい監督体制のもと${G.players.length}人でスタートを切った。学校からの予算は${yen(G.budget)}。`);
 notice('新しい年度が始まった。まずは部員の練習メニューを設定しよう。');
 if(G.goal)announceGoal();
 return G;
}
function ensurePositions(){const need={投:3,捕:2,一:1,二:1,三:1,遊:1,左:1,中:1,右:1};const a=active();
 for(const pos in need){let have=a.filter(p=>p.pos===pos).length;
  while(have<need[pos]){const surplus=a.filter(p=>p.pos!==pos&&!p.posChange&&a.filter(x=>x.pos===p.pos).length>(need[p.pos]||1)).sort((x,y)=>rating(x)-rating(y));const cand=surplus[0];if(!cand)break;
   cand.pos=pos;cand.sub=cand.sub.filter(s=>s!==pos);if(pos==='投'){cand.pit.velo=Math.max(cand.pit.velo,106);cand.caps.velo=Math.max(cand.caps.velo,cand.pit.velo+6);cand.pit.pitches[0].velo=Math.round(cand.pit.velo);}have++;}}}
function calcBudget(){const s=G.school;const base={公立:{小:420,中:620,大:900},私立:{小:950,中:1500,大:2400}}[s.type][s.size];return Math.round(base*(0.6+G.rep/100*0.9)*(G.budgetMult||1)*(G.baseBudgetMult||1)*(G.mode==='elite'?1.6:1));}
function notice(msg){G.notices.unshift({t:dateStr(),m:msg});if(G.notices.length>40)G.notices.length=40;}
function dateStr(){return `${G.calYear}年${G.month}月${G.week}週`;}
function enqueue(ev){G.queue.push(ev);}
function spend(amt,label){amt=Math.round(amt);G.money-=amt;G.fin.expense+=amt;G.fin.items[label]=(G.fin.items[label]||0)+amt;}
function income(amt,label){amt=Math.round(amt);G.money+=amt;G.fin.income+=amt;G.fin.items[label]=(G.fin.items[label]||0)-amt;}
function addNews(cat,title,body,extra){G.news.unshift(Object.assign({cat,title,body,t:dateStr(),y:G.year,cy:G.calYear,mo:G.month,wk:G.week,imp:1},extra||{}));if(G.news.length>600)G.news.length=600;}

/* ================= 背番号・オーダー ================= */
function autoNumbers(){const used=new Set();const a=active();if(G.lineup){for(const s of G.lineup){const p=a.find(x=>x.id===s.pid);if(p){p.number=POS_NUM[s.pos];used.add(p.number);}}}
 const rest=a.filter(p=>!G.lineup||!G.lineup.some(s=>s.pid===p.id)).sort((x,y)=>rating(y)-rating(x));let n=10;for(const p of rest){while(used.has(n))n++;p.number=n;used.add(n);n++;}
 G.players.filter(p=>p.retired).forEach(p=>{p.number=null;});}
function posFit(p,pos){if(p.pos===pos)return 1;if(p.sub.includes(pos))return 0.85;if(pos==='投')return 0.3;if(pos==='捕')return 0.55;return 0.7;}
function autoLineup(){const hs=healthy().filter(p=>!p.posChange||p.posChange.kind!=='main');const pool=hs.length>=9?hs:active();
 const ps=pool.filter(isPitcher).sort((a,b)=>pitRating(b)*(1-a.fatigue/400)-pitRating(a)*(1-b.fatigue/400));
 let sp=ps[0]||pool.slice().sort((a,b)=>pitRating(b)-pitRating(a))[0];
 if(!sp){G.lineup=null;G.sp=null;return;}
 const used=new Set([sp.id]);const slots=[];
 for(const pos of ['捕','遊','二','中','三','一','右','左']){const c=pool.filter(p=>!used.has(p.id)).sort((a,b)=>batRating(b)*posFit(b,pos)-batRating(a)*posFit(a,pos))[0];if(!c)break;used.add(c.id);slots.push({pid:c.id,pos});}
 if(slots.length<8){G.lineup=null;G.sp=sp.id;return;}
 const byP=id=>pool.find(p=>p.id===id);
 const s=slots.slice().sort((a,b)=>batRating(byP(b.pid))-batRating(byP(a.pid)));
 const rest=s.slice(3).sort((a,b)=>byP(b.pid).bat.speed-byP(a.pid).bat.speed);
 const order=[rest[0],rest[1],s[0],s[1],s[2]].concat(rest.slice(2),[{pid:sp.id,pos:'投'}]);
 G.lineup=order.filter(Boolean);G.sp=sp.id;}
function ensureLineup(){const a=active();const ok=G.lineup&&G.lineup.length===9&&G.lineup.every(s=>{const p=a.find(x=>x.id===s.pid);return p&&p.injury===0;})&&new Set(G.lineup.map(s=>s.pid)).size===9&&G.lineup.some(s=>s.pos==='投');if(!ok)autoLineup();}
function benchPlayers(){const ids=new Set((G.lineup||[]).map(s=>s.pid));return healthy().filter(p=>!ids.has(p.id)).sort((a,b)=>rating(b)-rating(a)).slice(0,11);}

/* ================= 成長 ================= */
function facEff(key){const f=G.fac[key];if(!f||f.broken)return 1.0;const m=FAC[key].models[f.model];let e=m.eff;if(teamKnow()<m.know)e=1+(e-1)*0.4;if(f.dur<f.maxDur*0.25)e=1+(e-1)*0.7;return e;}
function hasFac(key){const f=G.fac[key];return !!(f&&!f.broken);}
function catMult(cat){let s=0;for(const k of FAC_KEYS){const f=G.fac[k];if(!f||f.broken||FAC[k].cat!==cat)continue;s+=facEff(k)-1;}return Math.min(1+s*0.65,2.6);}
const CAT_CAP={rest:22,know:32,rep:8,cost:70};
function catSum(cat){let s=0;for(const k of FAC_KEYS){const f=G.fac[k];if(!f||f.broken||FAC[k].cat!==cat)continue;const m=FAC[k].models[f.model];let e=m.eff;if(teamKnowRaw()<m.know)e*=0.5;if(f.dur<f.maxDur*0.25)e*=0.7;s+=e;}return Math.min(s,CAT_CAP[cat]||999);}
function hasCat(cat){return FAC_KEYS.some(k=>G.fac[k]&&!G.fac[k].broken&&FAC[k].cat===cat);}
function teamKnowRaw(){const a=active();const av=a.length?avg(a.map(p=>p.academic)):50;return Math.round(av*0.8+G.coach.level*2.5);}
function facUpkeep(){let s=0;for(const k of FAC_KEYS){const f=G.fac[k];if(!f)continue;s+=FAC[k].models[f.model].cost*0.004;}return s;}
function growMult(){const coach=(0.8+G.coach.level*0.07)*(G.coach.style==='熱血'?1.06:1);const gr=GROUND_LV[G.ground.lv-1].eff*(G.ground.dur<30?0.85:1);const all=catMult('all');const dorm=DORM_LV[G.dorm.lv].eff;const camp=G.camp?G.camp.mult:1;const alum=alumniEff('coach')?1.05:1;return coach*gr*all*dorm*camp*alum;}
function gradeMult(p){const t={早熟:[1.35,1.0,0.7],普通:[1.0,1.1,1.0],晩成:[0.7,1.0,1.4]}[p.growth]||[1,1,1];return t[p.grade-1]||1;}
function bodyMult(p,k){if(['powR','powL','arm'].includes(k))return 1+(p.weight-70)/220;if(['speed','steal'].includes(k))return 1-(p.weight-70)/320;if(k==='velo')return 1+(p.height-172)/160;return 1;}
function grow(p,g,k,amt){const cap=p.caps[g+k]||100;const cur=p[g][k];if(cur>=cap)return 0;const near=(cap-cur)<10?0.5:1;const add=amt*near*rf(0.6,1.4)*bodyMult(p,k);p[g][k]=Math.min(cap,cur+add);return add;}
function growPitch(p,k,amt){const cap=p.caps.pitch||100;const n=p.pit.pitches.length?ri(1,Math.min(2,p.pit.pitches.length)):0;const sel=shuffle(p.pit.pitches).slice(0,n);for(const pt of sel){if(pt[k]>=cap)continue;pt[k]=Math.min(cap,pt[k]+amt*rf(0.6,1.4)*(cap-pt[k]<10?0.5:1));}}
function growVelo(p,amt){const cap=p.caps.velo||150;if(p.pit.velo>=cap)return;p.pit.velo=Math.min(cap,p.pit.velo+amt*rf(0.5,1.5)*bodyMult(p,'velo'));p.pit.pitches[0].velo=Math.round(p.pit.velo);}
function dormRec(){return DORM_LV[G.dorm.lv].rec+catSum('rest')+(alumniEff('fatigue')?3:0)+(G.coach.style==='温厚'?2:0)-(G.coach.style==='熱血'?2:0);}
function isMentoring(p){return G.players.some(x=>x.mentor&&x.mentor.seniorId===p.id);}
function canTrain(key,p){const m=TRAIN[key];if(!m)return false;if(m.lv>G.coach.level)return false;if(m.pOnly&&!(isPitcher(p)||(p.posChange&&p.posChange.to==='投')))return false;if(m.catReq&&!hasCat(m.cat))return false;return true;}
function trainPlayer(p){
 p.weeks++;
 if(p.retired){p.fatigue=Math.max(0,p.fatigue-15);return;}
 if(p.injury>0){p.injury--;p.fatigue=Math.max(0,p.fatigue-12);if(p.injury===0)notice(`${p.name}がケガから復帰した。`);return;}
 if(isMentoring(p)){p.fatigue=clamp(p.fatigue+4-dormRec(),0,100);return;}
 if(p.mentor){mentorWeek(p);return;}
 if(p.posChange){posChangeWeek(p);return;}
 if(p.training==='rest'||!TRAIN[p.training]){p.fatigue=Math.max(0,p.fatigue-(30+dormRec())*abilStatic(p,'recRest'));return;}
 if(!canTrain(p.training,p))p.training=isPitcher(p)?'pitch':'bat';
 const m=TRAIN[p.training];
 const fatPen=p.fatigue>75?0.45:p.fatigue>55?0.8:1;
 const meta=abilAcc(p,{grade1:p.grade===1});
 const gm=growMult()*gradeMult(p)*(0.8+p.potential*0.04)*fatPen*(meta.grow||1)*(1+condOf(p)*0.08);
 let eff=m.cat?catMult(m.cat):1.0;if(m.catReq&&!hasCat(m.cat))eff=0.3;if(p.training==='free'&&G.coach.style==='放任')eff*=1.4;
 const g=0.9*gm*eff*(m.tough&&alumniEff('stamina')?1.1:1)*coachSpec(m);
 const b=m.all?Object.fromEntries(ALL_BAT.map(k=>[k,m.all])):(m.b||{});
 const pp=m.all?Object.assign(Object.fromEntries(ALL_PIT.map(k=>[k,m.all])),{ctrl:.3,move:.3,sharp:.3,velo:.08}):(m.p||{});
 for(const k in b)grow(p,'bat',k,g*b[k]*(isPitcher(p)?0.6:1));
 if(isPitcher(p)){for(const k in pp){if(k==='velo')growVelo(p,g*pp[k]);else if(['ctrl','move','sharp'].includes(k))growPitch(p,k,g*pp[k]*1.4);else grow(p,'pit',k,g*pp[k]);}}
 if(m.tough&&p.tough<95)p.tough+=0.06;
 const med=catMult('medical');
 p.fatigue=clamp(p.fatigue+m.fat/((med-1)*0.5+1)+(G.camp?G.camp.fat*0.5:0)-5-dormRec()+(meta.fatigue||0),0,100);
 injuryCheck(p);
 abilityChance(p,p.training);
 talentReveal(p);
}
function injuryCheck(p,mult){const med=catMult('medical');let risk=(p.fatigue>55?(p.fatigue-55)/450:0.002)*(1.7-p.tough/100)*(G.ground.dur<30?1.5:1)/med*abilStatic(p,'injury')*(G.coach.style==='厳格'?1.1:1)*(mult||1);if(R()<risk){p.injury=ri(2,10);if(alumniEff('injury'))p.injury=Math.max(1,Math.round(p.injury*0.75));notice(`${p.name}がケガをした（全治${p.injury}週）。`);return true;}return false;}
function abilityChance(p,key){const base=0.012*(1+G.coach.level*0.08)*(G.coach.spec==='特能指導'?1.5:1)*(G.coach.style==='厳格'?1.3:1)*abilStatic(p,'learn');if(R()>base)return;const isP=isPitcher(p);
 const pool=ABIL_LIST.filter(a=>{const d=ABIL[a];if(!d.learn||!d.learn.includes(key)||d.u||d.neg)return false;if(d.t==='p'&&!isP)return false;if(d.t==='b'&&isP&&R()<0.7)return false;if(has(p,a))return false;return abilReqOk(p,a);});
 if(!pool.length)return;const a=pick(pool);p.abilities.push(a);notice(`${p.name}が特殊能力「${a}」を習得した！`);}
function learnMatchAbility(p,tag,prob){if(R()>prob*abilStatic(p,'learn'))return null;const isP=isPitcher(p);const pool=ABIL_LIST.filter(a=>{const d=ABIL[a];if(d.ml!==tag||d.u||d.neg)return false;if(d.t==='p'&&!isP)return false;if(d.t==='b'&&isP)return false;if(has(p,a))return false;return abilReqOk(p,a);});if(!pool.length)return null;const a=pick(pool);p.abilities.push(a);notice(`${p.name}が試合で「${a}」を習得！`);return a;}
function giveNegative(p,cands){if(abilStatic(p,'negImmune')>0)return null;if(G.coach.spec==='メンタル'&&R()<0.5)return null;const pool=cands.filter(a=>!has(p,a));if(!pool.length)return null;const a=pick(pool);p.abilities.push(a);return a;}
function tryAwaken(p,imp,perf){const base=(imp>=2?0.07:imp>=1.3?0.04:0.015)*abilStatic(p,'awaken')*(perf>=12?1.5:1);if(p.potential>=10||R()>base)return false;const add=ri(2,3);p.potential=Math.min(10,p.potential+add);p.awakened=(p.awakened||0)+1;for(const k in p.caps){if(k==='velo')p.caps.velo=Math.min(156,p.caps.velo+ri(3,6));else p.caps[k]=Math.min(100,p.caps[k]+ri(8,14));}
 notice(`${p.name}が覚醒した！潜在能力が大きく上昇した。`);addNews('特集',`${G.school.name}の${p.name}、覚醒の予感`,`大舞台での活躍をきっかけに${p.name}（${p.grade}年・${posName(p.pos)}）は一段上の選手へと変貌しつつある。関係者は「潜在能力が一気に開花した」と語る。`,{imp:3,pid:p.id});return true;}
function talentReveal(p){if(!p.revealed.P&&p.talentP>=70&&!isPitcher(p)&&R()<0.02+G.coach.level*0.006){p.revealed.P=true;notice(`監督が${p.name}の投手としての才能に気づいた！`);}if(!p.revealed.C&&p.talentC>=70&&p.pos!=='捕'&&R()<0.02+G.coach.level*0.006){p.revealed.C=true;notice(`監督が${p.name}の捕手としての才能に気づいた！`);}}
function mentorWeek(p){const s=G.players.find(x=>x.id===p.mentor.seniorId);if(!s||s.retired&&p.mentor.weeks>3||!has(s,p.mentor.ability)){notice(`${p.name}の先輩指導は中止になった。`);p.mentor=null;return;}p.mentor.weeks--;p.fatigue=clamp(p.fatigue+5-dormRec(),0,100);if(p.mentor.weeks<=0){const ok=R()<0.5+G.coach.level*0.045;if(ok&&!has(p,p.mentor.ability)){p.abilities.push(p.mentor.ability);notice(`${p.name}が${s.name}から「${p.mentor.ability}」を受け継いだ！`);addNews('部内',`先輩の技を継承`,`${G.school.name}の${p.name}（${p.grade}年）が先輩${s.name}の指導で「${p.mentor.ability}」を身につけた。`);}else notice(`${p.name}の先輩指導は実を結ばなかった…`);p.mentor=null;p.training=isPitcher(p)?'pitch':'bat';}}
function posChangeWeek(p){const pc=p.posChange;pc.weeks--;grow(p,'bat','field',0.3);p.fatigue=clamp(p.fatigue+8-dormRec(),0,100);if(pc.weeks<=0){if(pc.kind==='sub'){if(!p.sub.includes(pc.to)&&p.sub.length<4)p.sub.push(pc.to);notice(`${p.name}がサブポジション「${pc.to}」を習得した。`);}else{const old=p.pos;if(old!==pc.to){if(!p.sub.includes(old)&&p.sub.length<4&&old!=='投')p.sub.push(old);p.sub=p.sub.filter(x=>x!==pc.to);p.pos=pc.to;let boost=0;if(pc.to==='投'&&p.talentP>=70)boost=p.talentP>=85?16:10;if(pc.to==='捕'&&p.talentC>=70)boost=p.talentC>=85?14:9;if(pc.to==='投'){for(const k of ALL_PIT){p.pit[k]=clamp(p.pit[k]+boost+(boost?0:3),10,99);p.caps['pit'+k]=Math.max(p.caps['pit'+k],p.pit[k]+10);}growVelo(p,boost?boost*0.6:2);p.caps.velo=Math.max(p.caps.velo,veloCapFor(p.potential,p.pit.velo));if(p.pit.pitches.length<2){const n=pick(PITCH_NAMES);const off=PITCH_SPEED_OFF[n]||[-10,-20];p.pit.pitches.push({name:n,velo:p.pit.velo+ri(off[1],off[0]),move:40,sharp:40,ctrl:40});}if(boost)p.pit.pitches.forEach(pt=>{pt.move=clamp(pt.move+boost*0.7,1,99);pt.sharp=clamp(pt.sharp+boost*0.7,1,99);pt.ctrl=clamp(pt.ctrl+boost*0.5,1,99);});}
 if(pc.to==='捕'){['arm','field','thr'].forEach(k=>{p.bat[k]=clamp(p.bat[k]+boost+3,1,99);p.caps['bat'+k]=Math.max(p.caps['bat'+k],p.bat[k]+8);});}
 if(boost)notice(`${p.name}が${pc.to}に転向！才能が開花し能力が大幅に上がった！`);else notice(`${p.name}が${old}から${pc.to}にポジションを変更した。`);}}
 p.posChange=null;p.training=isPitcher(p)?'pitch':'bat';}}
function bodyGrowth(){for(const p of G.players){if(p.grade>=3||p.retired)continue;const dh=ri(0,2),dw=ri(0,3);p.height+=dh;p.weight+=dw;if(isPitcher(p)){const room=(p.caps.velo||150)-p.pit.velo;if(room>0){p.pit.velo=Math.min(p.caps.velo,p.pit.velo+Math.min(room,rf(0.5,2)*(0.6+p.potential*0.06)));p.pit.pitches[0].velo=Math.round(p.pit.velo);}}}}
function startMentor(p,seniorId,ability){const s=G.players.find(x=>x.id===seniorId);if(!s||!has(s,ability))return false;if(ABIL[ability].u)return false;p.mentor={seniorId,ability,weeks:8};p.training='mentor';return true;}
function startPosChange(p,to,kind){p.posChange={to,kind,weeks:kind==='sub'?4:6};p.training='posChange';return true;}

/* ================= 週進行 ================= */
function applyMaintenance(){const lv=GROUND_LV[G.ground.lv-1];let add=0;const gk=catMult('ground');const pick_=(g)=>active().filter(p=>p.injury===0&&(g==='all'||p.grade===g));let parts=[];
 if(G.maint==='pro'){if(G.money>=10){spend(10,'グラウンド整備(業者)');add=28*(alumniEff('ground')?1.2:1);}}
 else if(G.maint==='all')parts=pick_('all');else if(G.maint==='g1')parts=pick_(1);else if(G.maint==='g2')parts=pick_(2);
 if(parts.length){add=Math.min(30,parts.length*1.2)*(alumniEff('ground')?1.3:1);for(const p of parts){p.fatigue=clamp(p.fatigue+3,0,100);grow(p,'bat','speed',0.04);grow(p,'bat','field',0.03);}}
 G.ground.dur=clamp(G.ground.dur-3/gk+add*gk,0,lv.maxDur);}
function decayFacilities(){for(const k of FAC_KEYS){const f=G.fac[k];if(!f||f.broken)continue;if(R()<0.8)f.dur-=1;if(R()<0.08)f.dur-=1;if(f.dur<=0){f.dur=0;f.broken=true;notice(`${FAC[k].name}（${FAC[k].models[f.model].name}）が故障した！修理か買い替えが必要だ。`);}}}
function monthlyCosts(){if(G.coach.salary)spend(G.coach.salary/12,'監督給与');if(G.scout&&G.scout.salary)spend(G.scout.salary/12,'スカウト給与');const d=DORM_LV[G.dorm.lv];if(d.upkeep)spend(d.upkeep,'寮の維持費');spend(3+active().length*0.15,'用具・消耗品');const up=facUpkeep();if(up>0)spend(up,'設備維持費');if(G.month===4)spend(12,'保険・連盟登録費');}
function genPracticeList(){const list=[];const loc=shuffle(G.schools.pref).slice(0,4).map(s=>({name:s.name,strength:s.strength,dist:R()<0.5?0:1,elite:!!s.elite}));const far=[];for(let i=0;i<2;i++){const pr=pick(PREF_DATA);const pw=pick(G.schools.powers[pr.name]);far.push({name:pw.name,strength:Math.round(clamp(pw.strength+gauss(0,5),30,pw.elite?95:89)),dist:pr.region===G.school.region?2:3,pref:pr.name,elite:!!pw.elite});}
 for(const o of loc.concat(far)){o.home=R()<0.5;o.cost=practiceCost(o);list.push(o);}return list;}
function practiceCost(o){const disc=Math.min(60,catSum('cost'))/100;const items={バス代:Math.round((4+o.dist*4)*(1-disc)*10)/10,運転手:Math.round(2*(1-disc)*10)/10,弁当代:2.5};if(o.dist>=3)items['宿泊費']=28;if(!o.home)items['球場使用料']=o.dist>=2?5:3;items.total=Math.round(Object.values(items).reduce((s,v)=>s+v,0)*10)/10;return items;}
function weekTick(){
 for(const p of G.players){trainPlayer(p);condWeekly(p);}
 applyMaintenance();decayFacilities();
 if(G.camp){G.camp.weeks--;if(G.camp.weeks<=0){G.camp=null;notice('合宿が終了した。');}}
 G.practiceList=genPracticeList();G.practicedThisWeek=false;
 G.week++;if(G.week>4){G.week=1;G.month=G.month===12?1:G.month+1;if(G.month===1)G.calYear++;if(G.month===4)G.year++;monthlyCosts();candidateMonthly();}
 if(G.week===3)featureArticles();
 G.turn++;
 fireEvents();
 maybeEvent();
}
/* ---- 全国の強豪校と注目選手 ----
 Sランク（強さ90以上）の学校は全国で3〜5校。それ以外は89以下に抑える。 */
function allSchools(){const arr=G.schools.pref.slice();for(const k in G.schools.powers)arr.push(...G.schools.powers[k]);return arr;}
/* 既存校・注目選手の学校と名前がかぶらない新しい校名（その場限りの出場校用） */
function genSchoolNameU(pref){const taken=new Set(allSchools().filter(s=>s.pref===pref).map(s=>s.name));for(const st of (G.stars||[]))if(st.pref===pref)taken.add(st.school);if(G.school&&G.school.pref===pref)taken.add(G.school.name);let n;let g=0;do{n=genSchoolName(pref);}while(taken.has(n)&&g++<30);return n;}
function applyEliteSchools(){const arr=allSchools();for(const s of arr){s.elite=false;if(s.strength>88)s.strength=88;}
 const n=3+ri(0,2);const ranked=arr.map(s=>({s,k:s.strength+(PREF_DATA.find(p=>p.name===s.pref)||{pw:2}).pw*1.5+gauss(0,3)})).sort((a,b)=>b.k-a.k);
 for(let i=0;i<n&&i<ranked.length;i++){const s=ranked[i].s;s.elite=true;s.strength=ri(90,94);}}
function isEliteSchool(name){return allSchools().some(s=>s.name===name&&s.elite);}
/* 注目選手：全国でSランクは数人、Aランクは十数人。強豪校に所属し、対戦時はその学校のロスターに実際に入る */
const STAR_TITLES_P=['昨夏の甲子園で8強入りのエース','U-18日本代表候補','最速15{v}km/hの本格派','県大会ノーヒットノーラン達成','プロ注目の右腕','プロ注目の左腕','中学時代に全国制覇の経験'];
const STAR_TITLES_B=['高校通算{hr}本塁打のスラッガー','U-18日本代表候補','50m5秒台の俊足巧打','昨夏の甲子園で打率5割','プロ注目の強打者','中学時代に全国制覇の経験','1年夏からレギュラーの天才'];
function refreshStars(init){G.stars=G.stars||[];
 if(!init){for(const st of G.stars)st.grade++;G.stars=G.stars.filter(st=>st.grade<=3);for(const st of G.stars)st.q=Math.min(97,st.q+ri(0,2));}
 const arr=allSchools();const elites=arr.filter(s=>s.elite);const strong=arr.filter(s=>!s.elite&&s.strength>=84);
 const mk=(school,rank,grade)=>{const taken=G.stars.filter(x=>x.school===school.name).map(x=>x.pos);const isP=!taken.includes('投')&&R()<0.45;const pos=isP?'投':(pick(shuffle(['遊','中','捕','三','一','右','左','二']).filter(x=>!taken.includes(x)))||'一');const q=rank==='S'?ri(95,97):ri(90,92);const name=genName();
  let title=pick(isP?STAR_TITLES_P:STAR_TITLES_B);title=title.replace('{v}',String(ri(0,4))).replace('{hr}',String(ri(30,55)));
  return {id:'star'+Math.random().toString(36).slice(2,8),name,pos,school:school.name,pref:school.pref,grade:grade||ri(1,3),q,rank,title,throws:isP&&R()<0.3?'左':'右',bats:R()<0.35?'左':'右'};};
 const sCount=()=>G.stars.filter(x=>x.rank==='S').length,aCount=()=>G.stars.filter(x=>x.rank==='A').length;
 const sTarget=init?ri(3,5):ri(3,5),aTarget=12+ri(0,6);
 let guard=0;while(sCount()<sTarget&&elites.length&&guard++<40){const sc=pick(elites);if(G.stars.filter(x=>x.school===sc.name).length>=3)continue;G.stars.push(mk(sc,'S',init?ri(1,3):ri(1,2)));}
 guard=0;while(aCount()<aTarget&&(strong.length||elites.length)&&guard++<80){const pool=strong.length&&R()<0.6?strong:elites;const sc=pick(pool);if(G.stars.filter(x=>x.school===sc.name).length>=3)continue;G.stars.push(mk(sc,'A',init?ri(1,3):ri(1,2)));}}
function starsOf(schoolName,pref){return (G.stars||[]).filter(st=>st.school===schoolName&&(!pref||!st.pref||st.pref===pref));}
/* 総合値が上限を超えないように全体を縮める（無名のCPU選手が偶然Sになるのを防ぐ） */
function capRating(p,max){for(let it=0;it<6&&rating(p)>max;it++){const f=Math.max(0.8,(max-0.6)/rating(p));for(const k of ALL_BAT)p.bat[k]=Math.round(p.bat[k]*f);const t=p.pit;for(const k of ALL_PIT)t[k]=Math.round(t[k]*f);t.velo=Math.round(95+(t.velo-95)*f);for(const q of t.pitches){q.move=Math.round(q.move*f);q.sharp=Math.round(q.sharp*f);q.ctrl=Math.round(q.ctrl*f);}if(t.pitches[0])t.pitches[0].velo=t.velo;}return p;}
/* 能力を底上げして総合値を目標に合わせる（注目選手の生成用） */
function boostToRating(p,target){const isP=isPitcher(p);
 for(let it=0;it<10;it++){const need=target-rating(p);if(need<=0)break;const d=Math.max(0.4,need*1.1);
  for(const k of ALL_BAT)p.bat[k]=Math.min(99,p.bat[k]+d*(isP?0.6:1));
  if(isP){const t=p.pit;t.velo=Math.min(158,t.velo+d/1.8);for(const k of ALL_PIT)t[k]=Math.min(99,t[k]+d);for(const q of t.pitches){q.move=Math.min(99,q.move+d);q.sharp=Math.min(99,q.sharp+d);q.ctrl=Math.min(99,q.ctrl+d);}}}
 for(const k of ALL_BAT)p.bat[k]=Math.round(p.bat[k]);const t=p.pit;for(const k of ALL_PIT)t[k]=Math.round(t[k]);t.velo=Math.round(t.velo);for(const q of t.pitches){q.move=Math.round(q.move);q.sharp=Math.round(q.sharp);q.ctrl=Math.round(q.ctrl);}if(t.pitches[0])t.pitches[0].velo=t.velo;
 for(const k of ALL_BAT)p.caps['bat'+k]=Math.max(p.caps['bat'+k]||0,p.bat[k]);for(const k of ALL_PIT)p.caps['pit'+k]=Math.max(p.caps['pit'+k]||0,t[k]);if(p.caps.velo!=null)p.caps.velo=Math.max(p.caps.velo,t.velo);return p;}
function advanceWeek(){if(G.queue.length||G.gameOver)return false;weekTick();saveGame();return true;}
function fireEvents(){const key=G.month+'-'+G.week;
 switch(key){
  case '4-1':newFiscalYear();break;
  case '4-2':driftSchools();break;
  case '5-2':startTourney('district');break;
  case '6-1':genCandidates();notice('来年度入学の中学生情報が届いた。スカウトタブで確認しよう。');break;
  case '7-2':startTourney('pref');break;
  case '8-1':if(G.flags.koshien)startTourney('koshien');break;
  case '8-2':midSchoolNationals();break;
  case '8-3':enqueue({type:'camp',season:'夏'});break;
  case '8-4':u18Event();break;
  case '9-2':startTourney('autumnDistrict');break;
  case '9-3':if(G.flags.autumnPref)startTourney('autumnPref');break;
  case '9-4':if(G.players.some(p=>p.grade===3&&!p.path))enqueue({type:'career'});break;
  case '10-4':draftEvent();break;
  case '10-1':bodyGrowth();break;
  case '10-2':if(G.flags.regional)startTourney('regional');break;
  case '11-2':if(G.flags.jingu)startTourney('jingu');break;
  case '12-3':enqueue({type:'camp',season:'冬'});break;
  case '1-2':refreshMarkets();notice('監督・スカウトの候補者情報が更新された（経営タブ）。');break;
  case '1-4':senbatsuSelection();break;
  case '2-3':enqueue({type:'budget'});break;
  case '2-4':recruitClose();break;
  case '3-1':if(G.flags.senbatsu)startTourney('senbatsu');else enqueue({type:'invite'});break;
  case '3-3':enqueue({type:'graduation'});break;
  case '3-4':staffLeaveCheck();yearEndRecord();if(G.goal)evaluateGoal();enqueue({type:'yearEnd'});break;
 }
}
function newFiscalYear(){
 G.players.forEach(p=>{p.grade++;p.season=blankStats();p.u18=0;});
 G.players=G.players.filter(p=>p.grade<=3);
 G.budgetMult=G.nextBudgetMult||1;G.nextBudgetMult=1;
 G.budget=calcBudget();G.money+=G.budget;G.fin={income:G.budget,expense:0,items:{'学校予算':G.budget}};
 updateAlumni();
 G.coach.age++;G.coach.years++;if(G.scout){G.scout.age++;G.scout.years++;}
 G.school.principalUsed=false;G.flags={};G.results={};
 bodyGrowth();
 const newbies=makeNewMembers();
 ensurePositions();autoLineup();autoNumbers();
 G.rep=clamp(G.rep-1+Math.round(Object.values(G.fac).filter(f=>f&&!f.broken).length*0.3+catSum('rep')),0,100);
 if(G.goal)announceGoal();
 enqueue({type:'entrance',ids:newbies.map(p=>p.id)});
 addNews('学校',`${G.calYear}年度の予算決定`,`${G.school.name}野球部の今年度予算は${yen(G.budget)}となった。評判${G.rep}、予算係数${(G.budgetMult*100).toFixed(0)}%。`);
}
function makeNewMembers(){const newbies=[];for(const r of G.recruits){let p;if(r.player){p=r.player;p.grade=1;p.joinYear=G.year;p.scouted=true;p.rank=r.rank;p.title=r.title;p.hometown=r.pref;p.season=blankStats();p.fatigue=ri(0,15);}else{p=genPlayer({grade:1,q:r.q,pos:r.pos,name:r.name,scouted:true,rank:r.rank,title:r.title,hometown:r.pref,uniqProb:r.rank==='S'?0.6:r.rank==='A'?0.35:r.rank==='B'?0.15:0.05});if(r.throws){p.throws=r.throws;}if(r.unique&&!p.unique.length)p.unique.push(r.unique);}G.players.push(p);newbies.push(p);if(r.title)addNews('特集',`${G.school.name}に入学の${p.name}君、中学時代は${r.title}！`,`この春${G.school.name}に入学した${p.name}君（${posName(p.pos)}）は、中学時代に${r.title}の実績を持つ逸材。${r.pref!==G.school.pref?r.pref+'から':''}${G.school.name}を選んだ理由を「設備と監督の熱意」と語った。`);}
 G.recruits=[];const nWalk=clamp(ri(10,14)-Math.max(0,newbies.length-4),4,14);
 for(let i=0;i<nWalk;i++){const q=clamp(gauss(37+G.rep*0.16-Math.max(0,G.school.hensachi-60)*0.35,7),22,70);G.players.push(genPlayer({grade:1,q}));newbies.push(G.players[G.players.length-1]);}
 return newbies;}
function retireThirdYears(reason){const t=G.players.filter(p=>p.grade===3&&!p.retired);if(!t.length)return;t.forEach(p=>{p.retired=true;p.training='rest';p.mentor=null;p.posChange=null;});G.players.forEach(p=>{if(p.mentor&&t.some(x=>x.id===p.mentor.seniorId)){p.mentor=null;p.training='bat';}});notice(`3年生${t.length}人が引退した（${reason}）。新チームが始動する。`);autoLineup();autoNumbers();}

/* ================= 強豪校モード：理事会の目標 ================= */
const GOALS=[
{lv:1,text:'夏の県大会ベスト8以上',check:r=>['優勝','準優勝','ベスト4','ベスト8'].includes(r.pref)},
{lv:2,text:'夏の県大会ベスト4以上',check:r=>['優勝','準優勝','ベスト4'].includes(r.pref)},
{lv:3,text:'夏の県大会 決勝進出',check:r=>['優勝','準優勝'].includes(r.pref)},
{lv:4,text:'甲子園出場（春または夏）',check:r=>r.pref==='優勝'||!!r.senbatsu},
{lv:5,text:'甲子園ベスト8以上',check:r=>r.pref==='優勝'&&['優勝','準優勝','ベスト4','ベスト8'].includes(r.koshien)},
{lv:6,text:'甲子園ベスト4以上',check:r=>r.pref==='優勝'&&['優勝','準優勝','ベスト4'].includes(r.koshien)},
{lv:7,text:'甲子園優勝',check:r=>r.koshien==='優勝'},
];
function announceGoal(){const g=G.goal;g.text=GOALS[g.level-1].text;enqueue({type:'msg',title:'理事会からの通達',body:`今年度の目標：${g.text}\n加えて年度末に赤字を出さないこと。\n現在の理事会の信頼度：${g.trust}\n目標を達成できなければ信頼を失い、信頼度が0になると監督は解任される。`});}
function evaluateGoal(){const g=G.goal;const def=GOALS[g.level-1];const ok=def.check(G.results);let d=ok?20:-30;let notes=[];if(ok){notes.push('目標達成（+20）');if(G.results.koshien==='優勝'){d+=20;notes.push('全国制覇ボーナス（+20）');}}else notes.push('目標未達（-30）');if(G.money<0){d-=15;notes.push('赤字決算（-15）');}
 g.trust=clamp(g.trust+d,-100,100);g.history.push({year:G.calYear,text:g.text,ok,d,trust:g.trust});
 const fired=g.trust<=0;if(ok&&g.level<7)g.level++;
 if(fired){G.gameOver=true;addNews('学校',`${G.school.name}、${G.coach.name}監督を解任`,`理事会は目標未達を理由に監督の解任を決めた。`);}
 enqueue({type:'goal',ok,d,notes,fired,trust:g.trust});}

/* ================= ドラフト会議イベント ================= */
function draftEvent(){const cands=G.players.filter(p=>p.grade===3&&(p.path==='プロ'||p.path==='MLB')&&!p.draft);if(!cands.length)return;const our=[];
 for(const p of cands){if(p.path==='MLB'){p.draft={status:'MLB',team:pick(MLB_TEAMS),year:G.calYear};G.rep=clamp(G.rep+12,0,100);addNews('卒業生',`${p.name}、高卒でMLB挑戦！`,`${G.school.name}の${p.name}（${posName(p.pos)}）が${p.draft.team}と契約で合意。日本球界を経由せずメジャーに挑む。`,{imp:3,pid:p.id});}
  else{p.draft=draftOutcome(p);our.push({p,d:p.draft});if(p.draft.status==='指名'){G.rep=clamp(G.rep+(p.draft.rank===1?8:4),0,100);addNews('卒業生',`${G.school.name}の${p.name}、${p.draft.round}で${p.draft.team}へ`,`プロ野球ドラフト会議で${G.school.name}の${p.name}（${posName(p.pos)}）が${p.draft.round}で${p.draft.team}に指名された。${p.draft.lottery&&p.draft.lottery.length>1?p.draft.lottery.length+'球団が競合し、抽選の末に交渉権を獲得した。':''}`,{imp:3,pid:p.id});}else{addNews('卒業生',`${p.name}、ドラフト指名漏れ`,`プロ志望届を出していた${G.school.name}の${p.name}（${posName(p.pos)}）は指名されなかった。進路を改めて考えることになる。`,{imp:2,pid:p.id});}}}
 enqueue({type:'draft',ids:cands.map(p=>p.id),board:draftBoard(our)});}
