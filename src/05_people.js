/* ================= 設備・経営 ================= */
function buyFacility(key,idx){const m=FAC[key].models[idx];if(!m)return 'none';if(G.money<m.cost)return 'money';spend(m.cost,'設備購入');G.fac[key]={model:idx,dur:m.dur,maxDur:m.dur,broken:false};addNews('学校',`${G.school.name}が${m.name}を導入`,`${G.school.name}野球部は${yen(m.cost)}をかけて${FAC[key].name}（${m.name}）を整備した。${teamKnow()<m.know?'ただし部員の知識レベルが不足しており、当面は性能を活かしきれない見込みだ。':''}`);notice(`${m.name}を導入した。`);return 'ok';}
function repairFacility(key){const f=G.fac[key];if(!f)return 'none';const m=FAC[key].models[f.model];const cost=Math.round(m.cost*0.35);if(G.money<cost)return 'money';spend(cost,'設備修理');f.dur=Math.round(f.maxDur*0.85);f.broken=false;f.maxDur=Math.max(20,Math.round(f.maxDur*0.93));notice(`${m.name}を修理した。`);return 'ok';}
function repairCost(key){const f=G.fac[key];return f?Math.round(FAC[key].models[f.model].cost*0.35):0;}
function scrapFacility(key){delete G.fac[key];}
function upgradeGround(){const next=GROUND_LV[G.ground.lv];if(!next)return 'max';if(G.money<next.cost)return 'money';spend(next.cost,'グラウンド改修');G.ground.lv++;G.ground.dur=next.maxDur;addNews('学校',`${G.school.name}がグラウンドを改修`,`${next.name}に生まれ変わった${G.school.name}のグラウンド。部員の成長への好影響が期待される。`);return 'ok';}
function upgradeDorm(){const next=DORM_LV[G.dorm.lv+1];if(!next)return 'max';if(G.money<next.cost)return 'money';spend(next.cost,'寮の整備');G.dorm.lv++;addNews('学校',`${G.school.name}、${next.name}を整備`,`野球部員のための${next.name}が完成した。維持費は月${next.upkeep}万円。`);return 'ok';}
function coachSpec(m){const s=G.coach.spec;if(s==='投手育成'&&m.pOnly)return 1.15;if(s==='打撃'&&(m===TRAIN.bat||m===TRAIN.power))return 1.15;if(s==='守備'&&(m===TRAIN.field||m===TRAIN.bunt))return 1.15;if(s==='走塁'&&(m===TRAIN.run||m===TRAIN.stamina))return 1.15;if(s==='育成全般')return 1.07;return 1;}
function coachCareer(level){if(level>=8)return pick(['甲子園優勝'+ri(1,3)+'回','全国制覇の経験あり','甲子園出場'+ri(8,15)+'回']);if(level>=6)return pick(['甲子園出場'+ri(3,7)+'回','プロ選手を'+ri(3,8)+'人輩出','地区大会優勝'+ri(2,5)+'回']);if(level>=4)return pick(['甲子園出場'+ri(1,2)+'回','県大会優勝'+ri(1,3)+'回','プロ選手を'+ri(1,2)+'人輩出']);return pick(['県大会ベスト8','指導歴'+ri(3,10)+'年','地区大会優勝']);}
function scoutCareer(level){if(level>=7)return '発掘したプロ選手'+ri(5,12)+'人';if(level>=4)return '発掘したプロ選手'+ri(1,4)+'人';return pick(['中学野球の取材歴'+ri(3,12)+'年','地元の中学に顔が利く']);}
function mkCoachCand(){const lvMax=clamp(3+Math.floor(G.rep/14),4,9);const level=ri(2,lvMax);const age=ri(30,66);const spec=pick(COACH_SPECS).id,style=pick(COACH_STYLES).id;return {name:pick(COACH_SURNAMES.concat(SURNAMES))+' '+pick(GIVEN),age,level,salary:Math.round((level*level*12+100)*rf(0.85,1.15)),spec,style,type:'外部',years:0,bio:pick(COACH_BIOS),career:coachCareer(level)};}
function mkScoutCand(){const lvMax=clamp(3+Math.floor(G.rep/14),4,9);const level=ri(1,lvMax);const age=ri(28,66);return {name:pick(SURNAMES)+' '+pick(GIVEN),age,level,salary:Math.round((level*level*8+60)*rf(0.85,1.15)),spec:pick(SCOUT_SPECS).id,type:'外部',years:0,bio:pick(SCOUT_BIOS),career:scoutCareer(level)};}
function refreshMarkets(){G.coachMarket=Array.from({length:8},mkCoachCand).sort((a,b)=>b.level-a.level);G.scoutMarket=Array.from({length:8},mkScoutCand).sort((a,b)=>b.level-a.level);G.marketYear=G.year;}
function searchMarket(kind){if(G.money<30)return 'money';spend(30,'人材紹介料');if(kind==='coach')G.coachMarket=Array.from({length:8},mkCoachCand).sort((a,b)=>b.level-a.level);else G.scoutMarket=Array.from({length:8},mkScoutCand).sort((a,b)=>b.level-a.level);return 'ok';}
function hireCoach(i){const c=G.coachMarket[i];if(!c)return 'none';if(G.money<c.salary/12)return 'money';G.coach=Object.assign({},c,{years:0});G.coachMarket.splice(i,1);addNews('学校',`${G.school.name}が${c.name}氏を監督に招へい`,`${c.bio}の${c.name}氏（${c.age}、${c.career}）が${G.school.name}野球部の監督に就任した。専門は${c.spec}、${c.style}な指導で知られる。年俸は${yen(c.salary)}とみられる。`);notice(`${c.name}監督が就任した。`);autoLineup();return 'ok';}
function hireScout(i){const c=G.scoutMarket[i];if(!c)return 'none';if(G.money<c.salary/12)return 'money';G.scout=Object.assign({},c,{years:0});G.scoutMarket.splice(i,1);addNews('学校',`${G.school.name}がスカウトを採用`,`${c.bio}の${c.name}氏がスカウトとして${G.school.name}野球部に加わった。${c.spec}。`);notice(`スカウト${c.name}が加わった。`);return 'ok';}
function fireCoach(){const old=G.coach;G.coach={name:pick(COACH_SURNAMES)+' '+pick(GIVEN),level:ri(1,2),salary:0,age:ri(30,52),type:'教師',years:0,spec:'なし',style:pick(COACH_STYLES).id,bio:'学校の先生',career:'指導歴'+ri(0,5)+'年'};notice(`${old.name}監督が退任し、学校の先生が監督を務めることになった。`);}
function fireScout(){if(!G.scout)return;notice(`スカウト${G.scout.name}との契約を終了した。`);G.scout=null;}
function staffLeaveCheck(){const c=G.coach;let msgs=[];
 if(c.type==='外部'){let reason=null;if(c.age>=65&&R()<0.5)reason='高齢のため勇退';else if(R()<0.05)reason='家庭の事情で退任';else if(c.level>=6&&G.rep<55&&R()<0.15)reason='強豪校からの引き抜き';if(reason){addNews('学校',`${c.name}監督が退任`,`${G.school.name}の${c.name}監督が${reason}。後任は当面、学校の教員が務める。`);msgs.push(`${c.name}監督が${reason}しました。`);fireCoach();}}
 else{if(c.age>=60&&R()<0.4){msgs.push(`${c.name}先生が定年退職し、別の先生が監督を引き継ぎました。`);G.coach={name:pick(COACH_SURNAMES)+' '+pick(GIVEN),level:ri(1,2),salary:0,age:ri(28,45),type:'教師',years:0,spec:'なし',style:pick(COACH_STYLES).id,bio:'学校の先生',career:'指導歴'+ri(0,5)+'年'};}else if(c.level<5&&R()<0.3){c.level++;msgs.push(`${c.name}先生が経験を積み、監督レベルが${c.level}に上がりました。`);}}
 const s=G.scout;if(s){let reason=null;if(s.age>=66&&R()<0.5)reason='高齢のため引退';else if(R()<0.06)reason='家庭の事情で退職';else if(s.level>=6&&G.rep<55&&R()<0.15)reason='強豪校からの引き抜き';if(reason){msgs.push(`スカウト${s.name}が${reason}しました。`);addNews('学校',`スカウト${s.name}氏が退職`,`${G.school.name}のスカウト${s.name}氏が${reason}。`);G.scout=null;}}
 if(msgs.length)enqueue({type:'msg',title:'スタッフの異動',body:msgs.join('\n')});}
/* ================= 予算委員会 ================= */
function resultScore(){const r=G.results;const sc=(k,tbl)=>{const l=r[k];if(!l)return 0;return tbl[l]||0;};return sc('district',{優勝:2,準優勝:1})+sc('pref',{優勝:10,準優勝:5,ベスト4:3,ベスト8:1})+sc('koshien',{優勝:20,準優勝:12,ベスト4:8,ベスト8:5,'3回戦敗退':3,'2回戦敗退':2,'1回戦敗退':1})+sc('autumnPref',{優勝:3,準優勝:2})+sc('regional',{優勝:6,準優勝:4,ベスト4:2})+sc('jingu',{優勝:8,準優勝:5})+sc('invite3',{優勝:4,準優勝:2})+sc('senbatsu',{優勝:18,準優勝:11,ベスト4:7,ベスト8:4,'2回戦敗退':2,'1回戦敗退':1});}
function committeeStart(){const mood=clamp(45+(alumniEff('budget')?8:0)+(G.school.type==='私立'?4:0)+Math.round((G.rep-30)/5)+(G.money<0?-10:0),10,80);G.committee={round:1,mood,used:[],log:[],done:false,result:null};return G.committee;}
function committeeOptions(){const rs=resultScore();const missing=FAC_KEYS.filter(k=>!G.fac[k]).length,broken=FAC_KEYS.filter(k=>G.fac[k]&&G.fac[k].broken).length;const grads=G.graduates.filter(g=>g.gradYear===G.calYear);const pro=grads.filter(g=>g.path==='プロ'||g.path==='MLB').length,univ=grads.filter(g=>g.path==='大学').length;const rich=G.graduates.some(g=>g.rich||g.path==='プロ'||g.path==='MLB');
 return [
 {id:'results',name:'今年度の実績をアピール',delta:rs>=12?20:rs>=8?14:rs>=4?8:rs>=1?3:-8,hint:rs>=4?'成果が出ている':'目立った実績がない'},
 {id:'plan',name:'具体的な設備投資計画を提示',delta:(missing>=3?12:missing>=1?8:2)+(broken?4:0),hint:missing?'不足設備を示せる':'設備は充実している'},
 {id:'career',name:'部員の進路実績を説明',delta:Math.min(16,pro*8+univ*2)-(grads.length?0:3),hint:pro?'プロ入りの実績がある':'特筆すべき進路はない'},
 {id:'pr',name:'地域貢献と宣伝効果を訴える',delta:G.rep>=60?12:G.rep>=40?6:-2,hint:`評判${G.rep}`},
 {id:'saving',name:'堅実な収支を報告',delta:G.money<0?-10:(G.fin.expense<G.fin.income*0.9?8:2),hint:G.money<0?'赤字が出ている':'収支は健全'},
 {id:'alumni',name:'卒業生からの支援を約束',delta:rich?10:-5,hint:rich?'支援が見込める卒業生がいる':'めぼしい卒業生がいない'},
 {id:'apology',name:'不振を謝罪し再起を誓う',delta:rs<1?6:-4,hint:'低姿勢で臨む'},
 ].filter(o=>!G.committee.used.includes(o.id));}
function committeeChoose(id){const c=G.committee;const o=committeeOptions().find(x=>x.id===id);if(!o)return null;c.used.push(id);const d=o.delta+ri(-3,3);c.mood=clamp(c.mood+d,0,100);const react=d>=10?'委員たちは大きくうなずいた。':d>=4?'まずまずの反応だ。':d>=0?'反応は薄い。':d>=-5?'事務長が眉をひそめた。':'校長の表情が曇った…';c.log.push({name:o.name,d,react});c.round++;return {o,d,react};}
function committeeRequest(pct){const c=G.committee;const p=clamp(0.5+(c.mood-50)/60-(pct-15)/100,0.05,0.95);const ok=R()<p;let mult;if(ok){mult=1+pct/100+(c.mood>=85?0.05:0);}else{mult=c.mood>=50?1.0:0.9;}if(G.money<0)mult-=0.05;G.nextBudgetMult=mult;c.done=true;c.result={ok,p,mult,pct};addNews('学校',ok?`野球部予算、${Math.round((mult-1)*100)}%増額へ`:`野球部の予算要求は通らず`,ok?`予算委員会で${G.coach.name}監督の説明が認められ、来年度の野球部予算は${Math.round((mult-1)*100)}%増となる見込み。`:`予算委員会は野球部の${pct}%増額要求を退けた。来年度は${mult<1?Math.round((1-mult)*100)+'%減額':'据え置き'}となる。`);return c.result;}
/* ================= スカウト ================= */
const DEMANDS={
 bullpen:{text:'ブルペンがあること',met:()=>hasFac('bullpen')},
 indoor:{text:'室内練習場があること',met:()=>hasFac('indoor')},
 weight:{text:'ウエイトルームがあること',met:()=>hasFac('weight')},
 medical:{text:'トレーナー室があること',met:()=>hasFac('medical')},
 dorm:{text:'寮があること',met:()=>G.dorm.lv>=1},
 coach4:{text:'監督レベル4以上',met:()=>G.coach.level>=4},
 coach6:{text:'監督レベル6以上',met:()=>G.coach.level>=6},
 rep40:{text:'学校の評判40以上',met:()=>G.rep>=40},
 rep60:{text:'学校の評判60以上',met:()=>G.rep>=60},
 district:{text:'今年の地区大会優勝以上',met:()=>G.results.district==='優勝'||['優勝','準優勝','ベスト4'].includes(G.results.pref)},
 koshien:{text:'甲子園出場経験（3年以内）',met:()=>G.flags.koshien||G.history.slice(-3).some(h=>h.results&&h.results.koshien)},
 academic:{text:'進学校（偏差値60以上）',met:()=>G.school.hensachi>=60},
 ground3:{text:'グラウンドLv3以上',met:()=>G.ground.lv>=3},
 cage:{text:'バッティングケージがあること',met:()=>hasFac('cage')},
 video:{text:'映像分析ができること',met:()=>hasCat('analysis')},
 cafeteria:{text:'食堂があること',met:()=>hasFac('cafeteria')},
 bath:{text:'浴場があること',met:()=>hasFac('bath')},
};
function rankFromP(){let r=R();for(const k of RANKS){r-=RANK_P[k];if(r<=0)return k;}return 'G';}
function candPos(title){if(!title)return pickPos();if(title.includes('投手')||title==='全国最多奪三振')return '投';if(title.includes('本塁打'))return pick(['一','三','左','右','捕']);if(title.includes('首位打者'))return pick(['遊','二','中']);if(title.includes('盗塁'))return '中';return pickPos();}
function makeCandidate(o){const rank=o.rank;const q=clamp(Math.round(RANK_Q[rank]+gauss(0,3)),25,92);const nd=rank==='S'?ri(3,5):rank==='A'?ri(2,4):rank==='B'?ri(1,3):rank==='C'?ri(0,2):ri(0,1);
 const pool=Object.keys(DEMANDS);const dem=shuffle(pool).slice(0,nd);if(o.pref!==G.school.pref&&!dem.includes('dorm')&&R()<0.6)dem.push('dorm');
 let conn=null;const cr=R();if(cr<0.05)conn='監督の知り合い';else if(cr<0.1)conn='親が母校OB';else if(cr<0.13&&G.graduates.some(g=>g.path==='プロ'||g.path==='MLB'))conn='憧れの選手の出身校';
 const sl=G.scout?G.scout.level:0;const ss=G.scout?G.scout.spec:'';const rankPen={S:28,A:16,B:8,C:3,D:0,E:0,F:0,G:0}[rank];
 const pos=o.pos||candPos(o.title);
 const pl=genPlayer({grade:1,q,pos,scouted:true,rank,title:o.title||null,hometown:o.pref,potential:o.potential,uniqProb:rank==='S'?0.6:rank==='A'?0.35:rank==='B'?0.15:0.05});
 if(o.potential==null&&(rank==='S'||rank==='A'))pl.potential=Math.max(pl.potential,ri(7,10));
 pl.caps.velo=veloCapFor(pl.potential,pl.pit.velo);
 const c={id:G.seq++,pid:pl.id,player:pl,name:pl.name,pos:pl.pos,throws:pl.throws,rank,q,title:o.title||null,pref:o.pref,demands:dem,conn,interest:0,info:Math.min(2,(sl>=7?2:sl>=4?1:0)+(ss==='データ重視'?1:0)),visits:0,negos:0,signed:false,lost:false,noise:ri(-1,1),potential:pl.potential,growth:pl.growth,unique:pl.unique[0]||null,national:!!o.national,msch:o.msch||genSchoolName(o.pref).replace(/高校|学園|学院|高等学校/,'中学')};
 const unmet=dem.filter(d=>!DEMANDS[d].met()).length;const proAl=Math.min(15,G.graduates.filter(g=>g.path==='プロ'||g.path==='MLB').length*5);
 c.interest=clamp(Math.round(22+(G.rep-30)*0.4+(conn?45:0)+sl*2-rankPen-unmet*8+proAl+gauss(0,6)+(ss==='地元密着'&&o.pref===G.school.pref?8:0)+(G.coach.style==='人脈家'?5:0)),0,78);
 return c;}
function genCandidates(){const sl=G.scout?G.scout.level:0;const ss=G.scout?G.scout.spec:'';const list=[];
 const champPref=pick(PREF_DATA).name,runPref=pick(PREF_DATA).name;const champSch=genSchoolName(champPref).replace(/高校|学園|学院|高等学校/,'中学'),runSch=genSchoolName(runPref).replace(/高校|学園|学院|高等学校/,'中学');
 for(const t of TITLES_NATIONAL){const isChamp=['全国大会優勝投手','全国大会MVP'].includes(t);const isRun=t==='全国準優勝投手';const pr=isChamp?champPref:isRun?runPref:pick(PREF_DATA).name;list.push(makeCandidate({rank:isChamp?(R()<0.25?'S':'A'):(R()<0.06?'S':'A'),title:t,pref:pr,national:true,msch:isChamp?champSch:isRun?runSch:undefined}));}
 for(const t of TITLES_PREF)list.push(makeCandidate({rank:R()<0.3?'A':'B',title:t,pref:G.school.pref}));
 const n=8+Math.round(sl*1.5)+(ss==='中学野球に精通'?4:0);
 for(let i=0;i<n;i++){const local=R()<(sl>=3?0.6:0.95);const pr=local?G.school.pref:pick(PREF_DATA).name;let rank=rankFromP();if(sl>=5&&R()<0.25&&RANKS.indexOf(rank)>2)rank=RANKS[RANKS.indexOf(rank)-1];const title=R()<0.25?pick(TITLES_MISC):null;list.push(makeCandidate({rank,title,pref:pr}));}
 if(R()<0.15){list.push(makeCandidate({rank:R()<0.12?'S':'A',title:null,pref:pick(PREF_DATA).name}));}
 if(ss==='若手発掘'){for(let i=0;i<2;i++)list.push(makeCandidate({rank:R()<0.3?'A':'B',title:null,pref:R()<0.6?G.school.pref:pick(PREF_DATA).name,potential:ri(8,10)}));}
 G.candidatesAll=list;G.candidates=list;G.candidatesYear=G.year;G.mschNationals={champ:champSch,champPref,run:runSch,runPref};
 const star=list.find(c=>c.title==='全国大会優勝投手');if(star)addNews('中学野球',`全国制覇の${star.name}投手、進路に注目`,`中学の全国大会で優勝投手となった${star.pref}・${star.msch}の${star.name}君（15）。各地の強豪校がすでに動き始めているという。`,{imp:2,avatar:{seed:star.pid,pref:star.pref}});}
function visibleCandidates(){return (G.candidatesAll||[]).filter(candVisible);}
function candById(id){return (G.candidatesAll||[]).find(c=>c.id==id);}
function candVisible(c){const sl=G.scout?G.scout.level:0;const ss=G.scout?G.scout.spec:'';if(c.pref===G.school.pref)return true;if(c.national)return sl>=(ss==='全国に人脈'?3:5)||G.rep>=65;return sl>=3||G.rep>=55;}
function candDispRank(c){const i=RANKS.indexOf(c.rank);if(c.info>=2)return c.rank;if(c.info===1){const j=clamp(i+c.noise,0,7);return RANKS[j];}const lo=clamp(i-2,0,7),hi=clamp(i+2,0,7);return RANKS[lo]+'〜'+RANKS[hi];}
function candDispPot(c){const sl=G.scout?G.scout.level:0;const pl=c.player;if(c.info>=3||(c.info>=2&&sl>=6))return potLetter(pl.potential)+'（'+pl.potential+'）';if(c.info>=2)return potLetter(clamp(pl.potential+c.noise,1,10))+'前後';if(c.info>=1&&sl>=4)return potLetter(clamp(pl.potential+c.noise*2,1,10))+'？';return '？';}
function candNegoCost(c){return 12+(c.pref===G.school.pref?0:PREF_DATA.find(p=>p.name===c.pref).region===G.school.region?6:14);}
function candVisit(c){const cost=8+(c.pref===G.school.pref?0:8);if(G.money<cost)return 'money';if(c.info>=3)return 'max';spend(cost,'スカウト活動費');c.visits++;c.info=Math.min(3,c.info+1);if(c.info>=2&&c.unique&&R()<0.8)c.uniqueKnown=true;if(c.info>=3)c.uniqueKnown=true;return 'ok';}
function candNegotiate(c,withPrincipal){const cost=candNegoCost(c);if(G.money<cost)return 'money';if(c.signed||c.lost)return 'closed';if(c.negos>=6&&!withPrincipal)return 'limit';if(withPrincipal){if(G.school.principalUsed)return 'principalUsed';G.school.principalUsed=true;}
 spend(cost,'スカウト活動費');c.negos++;const sl=G.scout?G.scout.level:0;const met=c.demands.filter(d=>DEMANDS[d].met()).length,unmet=c.demands.length-met;
 let gain=9+sl*2+(c.demands.length?met/c.demands.length*10:6)-unmet*3+gauss(0,5)+(alumniEff('nego')?3:0)+(G.scout&&G.scout.spec==='交渉上手'?4:0)+(withPrincipal?35:0);if(c.negos>3&&!withPrincipal)gain*=0.7;gain=Math.round(gain);
 c.interest=clamp(c.interest+gain,0,100);let msg;
 if(c.interest>=80){c.signed=true;G.recruits.push({name:c.name,pos:c.pos,q:c.q,rank:c.rank,title:c.title,pref:c.pref,throws:c.throws,unique:c.unique,player:c.player});msg=`${c.name}君が${G.school.name}への入学を決めた！（入部内定）`;addNews('スカウト',`${c.title?c.title+'の':''}${c.name}君、${G.school.name}へ`,`${c.pref}・${c.msch}の${c.name}君（${posName(c.pos)}）が来春${G.school.name}に進学することを明らかにした。${c.conn?c.conn+'という縁もあり決断した。':''}`,{imp:c.rank==='S'||c.rank==='A'?3:2,avatar:{seed:c.pid,pref:c.pref}});}
 else if(gain>=12)msg=`${c.name}君は好感触だ。（興味 ${c.interest}）`;else if(gain>=5)msg=`${c.name}君は話を聞いてくれた。（興味 ${c.interest}）`;else msg=`${c.name}君の反応はいまひとつ。要望に応えられていないようだ。（興味 ${c.interest}）`;
 return {status:'ok',msg,gain};}
function candidateMonthly(){const all=G.candidatesAll||[];for(const c of all){if(c.signed||c.lost)continue;const risk=c.rank==='S'?0.14:c.rank==='A'?0.1:c.rank==='B'?0.05:0.02;if(c.interest<60&&R()<risk){c.lost=true;c.lostTo=genSchoolName(c.pref);if(candVisible(c))notice(`${c.name}君は${c.lostTo}への進学を決めたようだ。`);}}}
function recruitClose(){const all=G.candidatesAll||[];const lost=all.filter(c=>!c.signed);for(const c of lost){c.lost=true;if(!c.lostTo)c.lostTo=genSchoolName(c.pref);}const star=lost.find(c=>c.national&&c.title==='全国大会優勝投手');if(star)addNews('中学野球',`${star.name}投手は${star.lostTo}へ`,`全国優勝投手の${star.name}君（${star.pref}・${star.msch}）の進路が${star.lostTo}に決まった。`,{imp:2,avatar:{seed:star.pid,pref:star.pref}});const n=G.recruits.length;notice(`スカウト期間が終了した。来春の入部内定者は${n}人。`);G.candidatesAll=[];G.candidates=[];}
/* 中学全国大会（8月） */
function midSchoolNationals(){const all=G.candidatesAll||[];const n=G.mschNationals;if(!n||!all.length)return;const mvp=all.find(c=>c.title==='全国大会MVP'),wp=all.find(c=>c.title==='全国大会優勝投手'),rp=all.find(c=>c.title==='全国準優勝投手'),hr=all.find(c=>c.title==='全国本塁打王'),ba=all.find(c=>c.title==='全国首位打者');const sc=[ri(2,8),ri(0,4)];
 addNews('中学野球',`全国中学校大会 ${n.champ}（${n.champPref}）が優勝`,`全国中学校軟式野球大会の決勝は${n.champ}が${n.run}（${n.runPref}）を${sc[0]}-${sc[1]}で下し、頂点に立った。${wp?'エース'+wp.name+'君が'+(sc[1]===0?'完封':'力投')+'し、':''}${mvp?mvp.name+'君が大会MVPに選ばれた。':''}${hr?'大会本塁打王は'+hr.pref+'の'+hr.name+'君。':''}${ba?'首位打者は'+ba.pref+'の'+ba.name+'君だった。':''}各地の高校の関心は早くも来春の進路に向いている。`,{imp:3,avatar:wp?{seed:wp.pid,pref:wp.pref}:mvp?{seed:mvp.pid,pref:mvp.pref}:null});
 if(rp)addNews('中学野球',`敗れてなお輝いた${rp.name}投手`,`準優勝に終わった${n.run}のエース${rp.name}君（${rp.pref}）は、大会を通じて${ri(20,40)}奪三振。「高校では必ず全国制覇する」と誓った。`,{imp:2,avatar:{seed:rp.pid,pref:rp.pref}});
 const local=all.filter(c=>c.pref===G.school.pref&&TITLES_PREF.includes(c.title));if(local.length){addNews('中学野球',`${G.school.pref}中学野球 県大会の主役たち`,local.map(c=>`${c.title}は${c.msch}の${c.name}君（${posName(c.pos)}）`).join('。')+'。来春はどの高校の門を叩くのか、注目が集まる。',{imp:2,avatar:{seed:local[0].pid,pref:local[0].pref}});}}
/* ================= U-18 ================= */
/* U-18代表選考：全国トップ級（総合A以上）でなければ選ばれない。甲子園出場・大会での活躍・150km級の速球が後押しする */
function u18Chance(p){const r=rating(p);if(p.grade===1)return r>=88?clamp((r-88)/60,0,0.15)*(G.flags.koshien?1:0.5):0;if(p.grade===2&&r<86)return 0;if(r<80)return 0;let c=clamp((r-80)/15,0,1);c*=G.flags.koshien?1:0.45;if((p.star||0)>0)c*=1.3;if(isPitcher(p)&&p.pit.velo>=145)c+=0.15;if(p.u18)c*=0.6;return clamp(c,0,0.97);}
function u18Event(){const pool=G.players.filter(p=>!p.cpu&&!p.retired||(p.retired&&p.grade===3)).map(p=>({p,c:u18Chance(p)})).filter(x=>x.c>0).sort((a,b)=>b.c-a.c).slice(0,3).filter(x=>R()<x.c).slice(0,2).map(x=>x.p);if(!pool.length)return;enqueue({type:'u18',ids:pool.map(p=>p.id)});}
function u18Resolve(allowIds){const teamRes=pick(['優勝','優勝','準優勝','準優勝','ベスト4','ベスト4','予選敗退']);const out=[];for(const id of allowIds){const p=G.players.find(x=>x.id===id);if(!p)continue;p.u18=1;const perf=rating(p)+gauss(0,12);let text='';
 if(perf>=90){const u=isPitcher(p)?'日本のエース':(p.bat.speed>=75?'世界の韋駄天':'世界の4番');if(!p.unique.includes(u))p.unique.push(u);boostKey(p,8);G.rep=clamp(G.rep+6,0,100);text=`${p.name}はMVP級の活躍！固有特能「${u}」を獲得した。`;addNews('U-18',`${G.school.name}の${p.name}、U-18で世界を圧倒`,`U-18日本代表の${p.name}（${p.grade}年）が大会MVP級の活躍を見せた。チームは${teamRes}。`);}
 else if(perf>=74){boostKey(p,5);G.rep=clamp(G.rep+2,0,100);text=`${p.name}は主力として活躍し、大きく成長した。`;}
 else if(perf<58||(teamRes==='予選敗退'&&perf<68)){const neg=giveNegative(p,['大舞台✕','逆境✕','スランプ','ビビり','弱気']);if(neg)text=`${p.name}は結果を残せず、「${neg}」を抱えて帰ってきた…`;else text=`${p.name}は結果を残せなかったが、気持ちを切り替えて戻ってきた。`;boostKey(p,2);}
 else{boostKey(p,3);text=`${p.name}は出場機会を得て経験を積んだ。`;}
 p.fatigue=clamp(p.fatigue+35,0,100);out.push(text);}
 G.u18Log.push({year:G.calYear,teamRes,texts:out});return {teamRes,texts:out};}
function boostKey(p,amt){if(isPitcher(p)){['hitR','hitL','kR','kL','hrR','hrL','stamina'].forEach(k=>{p.caps['pit'+k]=Math.min(100,p.caps['pit'+k]+amt);grow(p,'pit',k,amt);});p.caps.pitch=Math.min(100,(p.caps.pitch||80)+amt);p.pit.pitches.forEach(pt=>{pt.move=Math.min(99,pt.move+amt*0.6);pt.sharp=Math.min(99,pt.sharp+amt*0.6);pt.ctrl=Math.min(99,pt.ctrl+amt*0.4);});}else{['meetR','meetL','powR','powL','eye','clutch','speed','field'].forEach(k=>{p.caps['bat'+k]=Math.min(100,p.caps['bat'+k]+amt);grow(p,'bat',k,amt);});}}
/* ================= 合宿 ================= */
function setCamp(id,weeks){const c=CAMPS.find(x=>x.id===id);if(!c)return 'none';if(c.rep&&G.rep<c.rep)return 'rep';const cost=c.cost*weeks;if(G.money<cost)return 'money';spend(cost,'合宿費用');G.camp={id:c.id,name:c.name,mult:c.mult,weeks,fat:c.fat};notice(`${c.name}で${weeks}週間の合宿を行う。`);addNews('部内',`${G.school.name}、${c.name}で合宿`,`${G.school.name}野球部は${weeks}週間の合宿に入った。`);return 'ok';}
/* ================= 進路・卒業生 ================= */
const PRO_TEAMS=['東都スカイラークス','港北ウェーブス','中京ゴールデンズ','浪速ブレイカーズ','神戸ハーバーズ','博多ホークアイズ','札幌ノーザンズ','仙台イーグレッツ','千葉シーブリーズ','所沢レオンズ','広島レッドウィングス','京都ファルコンズ'];
const MLB_TEAMS=['ニューヨーク・タイタンズ','ロサンゼルス・サンズ','シカゴ・ウルブズ','テキサス・ロングホーンズ','ボストン・ハーバーズ','シアトル・レインズ'];
const UNIVS=['帝都大','関西学院大','明治学院大','東北学院大','九州産業大','中央学園大','早川大','慶明大','立命大','駒沢学園大'];
const CORPS=['日本製鋼','東京ガス電力','トヨシマ自動車','三ツ星重工','ホンダ技研','JR東日本','NTT西日本','大阪ガス','ヤマハ発動機','鷺宮製作所'];
function careerOptions(p){const r=rating(p);const opts=[];if(r>=93||(p.star||0)>=3)opts.push('MLB');if(r>=74)opts.push('プロ');opts.push('大学','社会人','就職');return opts;}
function playerWish(p){const r=rating(p);if(r>=93&&R()<0.3)return 'MLB';if(r>=88)return R()<0.85?'プロ':'大学';if(r>=82)return R()<0.5?'プロ':'大学';if(r>=76)return R()<0.25?'プロ':R()<0.6?'大学':'社会人';if(r>=62)return R()<0.6?'大学':'社会人';if(p.academic>=60)return R()<0.6?'大学':'就職';return R()<0.5?'就職':'社会人';}
function pickJob(p){const ac=p.academic+(G.school.hensachi>=62?5:0);const el=JOBS.filter(j=>ac>=j.min);const top=el.slice(0,4);return pick(top.length?top:[JOBS[JOBS.length-1]]);}
function graduate(p,path){const r=rating(p);const g={id:p.id,name:p.name,pos:p.pos,rating:Math.round(r),gradYear:G.calYear,path,status:'active',team:null,job:null,jobEff:null,timeline:[],age:18,years:0,level:null,titles:[],rich:false,star:p.star||0,unique:p.unique.slice(),abilities:p.abilities.slice(),academic:p.academic,career:Object.assign({},p.career),maxVelo:p.maxVelo||0,potential:p.potential,joinYear:p.joinYear,height:p.height,weight:p.weight,throws:p.throws,bats:p.bats};
 const add=t=>g.timeline.push({y:G.calYear,t});
 if(path==='プロ'){const d=p.draft||draftOutcome(p);if(d.status==='指名漏れ'){const fb=p.academic>=55?'大学':'社会人';add(`ドラフト指名漏れ。${fb==='大学'?pick(UNIVS)+'に進学し再挑戦':pick(CORPS)+'で社会人野球から再挑戦'}`);g.path=fb;g.team=fb==='大学'?pick(UNIVS):pick(CORPS);g.level=fb==='大学'?'大学生':'社会人';}else{g.team=d.team;g.level='二軍';add(`${d.round}で${d.team}に入団${d.lottery&&d.lottery.length>1?'（'+d.lottery.length+'球団競合）':''}`);if(!p.draft){G.rep=clamp(G.rep+(d.rank===1?8:4),0,100);addNews('卒業生',`${G.school.name}の${p.name}、${d.round}で${d.team}へ`,`${G.school.name}の${p.name}（${posName(p.pos)}）が${d.round}で${d.team}に指名された。`,{imp:3,pid:p.id});}}}
 else if(path==='MLB'){const d=p.draft||{team:pick(MLB_TEAMS)};g.team=d.team;g.level='マイナー';add(`${g.team}とマイナー契約。海を渡る`);if(!p.draft){G.rep=clamp(G.rep+12,0,100);addNews('卒業生',`${p.name}、高卒でMLB挑戦！`,`${G.school.name}の${p.name}が${g.team}と契約。日本球界を経由せずメジャーに挑む。`,{imp:3,pid:p.id});}}
 else if(path==='大学'){g.team=pick(UNIVS);g.level='大学生';add(`${g.team}に進学し野球を続ける`);}
 else if(path==='社会人'){g.team=pick(CORPS);g.level='社会人';add(`${g.team}に入社し社会人野球へ`);}
 else{const job=pickJob(p);g.job=job.name;g.jobEff=job.eff;g.status='working';g.level=job.name;add(job.min>=60?`進学ののち${job.name}の道へ`:`野球を離れ${job.name}として働き始める`);}
 G.graduates.push(g);return g;}
function updateAlumni(){for(const g of G.graduates){g.age++;g.years++;const add=t=>g.timeline.push({y:G.calYear,t});
 if(g.status==='retired'||g.status==='working'){if(g.status==='working')workingYear(g,add);continue;}
 if(g.path==='プロ'||g.path==='MLB'){const mlb=g.path==='MLB';g.rating+=g.age<27?gauss(2.2,3):g.age<=31?gauss(0,2):-gauss(2.5,2);
  const lv=g.rating>=88?(mlb?'スター':'スター'):g.rating>=78?(mlb?'主力':'レギュラー'):g.rating>=70?(mlb?'メジャー':'一軍'):(mlb?'マイナー':'二軍');
  if(lv!==g.level){const up=['二軍','マイナー','一軍','メジャー','レギュラー','主力','スター'].indexOf(lv)>['二軍','マイナー','一軍','メジャー','レギュラー','主力','スター'].indexOf(g.level);g.level=lv;add(up?`${lv}に昇格`:`${lv}に降格`);if(up&&(lv==='レギュラー'||lv==='主力')){G.rep=clamp(G.rep+(mlb?5:3),0,100);addNews('卒業生',`${g.name}（${g.team}）がレギュラー定着`,`${G.school.name}出身の${g.name}が${g.team}でレギュラーに定着した。`);}}
  if(g.rating>=85&&R()<0.22){const t=g.pos==='投'?pick(['最多勝','最優秀防御率','最多奪三振','セーブ王']):pick(['首位打者','本塁打王','打点王','盗塁王','ベストナイン']);g.titles.push(t+(mlb?'(MLB)':''));add(`${t}を獲得！`);G.rep=clamp(G.rep+(mlb?9:5),0,100);addNews('卒業生',`${g.name}が${t}を獲得`,`${G.school.name}出身の${g.name}（${g.team}）が${t}のタイトルを手にした。母校の評判も高まっている。`);}
  if(g.rating>=92&&R()<0.1){g.titles.push('MVP'+(mlb?'(MLB)':''));add('リーグMVPに輝く！');G.rep=clamp(G.rep+(mlb?12:8),0,100);addNews('卒業生',`${g.name}がMVP！`,`${G.school.name}が生んだスター${g.name}がリーグMVPに選ばれた。`);}
  if(!mlb&&g.rating>=93&&g.age>=25&&g.age<=30&&R()<0.2){g.path='MLB';g.team=pick(MLB_TEAMS);g.level='メジャー';add(`${g.team}へ移籍しメジャー挑戦`);G.rep=clamp(G.rep+8,0,100);addNews('卒業生',`${g.name}、メジャー移籍`,`${G.school.name}出身の${g.name}が${g.team}と契約した。`);}
  if(g.age>=30&&(g.rating<68||R()<0.08+(g.age-30)*0.05)){g.status='retired';const post=pick(['球団コーチ','野球解説者','会社員','独立リーグ監督','少年野球指導者']);g.job=post;g.jobEff=post==='球団コーチ'?'coach':post==='会社員'?'donate':null;g.status='working';g.level='引退・'+post;add(`現役を引退し${post}に。通算タイトル${g.titles.length}個`);addNews('卒業生',`${g.name}が現役引退`,`${G.school.name}出身の${g.name}（${g.age}）が現役引退を表明。今後は${post}として活動する。`);}
  if(g.rating<60&&g.age<30&&R()<0.3){g.status='working';g.job='会社員';g.jobEff='donate';g.level='戦力外・会社員';add('戦力外通告を受け、会社員として再出発');}
 }
 else if(g.path==='大学'){g.rating+=gauss(2.5,3);if(g.years>=4){if(g.rating>=78&&R()<0.8){g.path='プロ';g.team=pick(PRO_TEAMS);g.level='二軍';add(`大学経由で${g.team}にドラフト指名`);G.rep=clamp(G.rep+4,0,100);addNews('卒業生',`${g.name}、大学から${g.team}へ`,`${G.school.name}出身の${g.name}が${g.team}にドラフト指名された。`);}else if(g.rating>=66&&R()<0.5){g.path='社会人';g.team=pick(CORPS);g.level='社会人';g.years=0;add(`${g.team}で社会人野球を続ける`);}else{const job=pickJob({academic:g.academic+8});g.job=job.name;g.jobEff=job.eff;g.status='working';g.level=job.name;add(`大学を卒業し${job.name}に`);}}}
 else if(g.path==='社会人'){g.rating+=g.age<=26?gauss(1.5,2.5):-1;if(g.rating>=80&&g.age<=27&&R()<0.3){g.path='プロ';g.team=pick(PRO_TEAMS);g.level='二軍';add(`社会人から${g.team}にドラフト指名`);G.rep=clamp(G.rep+4,0,100);addNews('卒業生',`${g.name}、社会人から${g.team}へ`,`${G.school.name}出身の${g.name}がプロ入りを果たした。`);}else if(g.age>=29){const job=JOBS.find(j=>j.name==='会社員');g.job=job.name;g.jobEff=job.eff;g.status='working';g.level='会社員';add('野球部を引退し会社員として勤務');}}
 }}
function workingYear(g,add){if(g.job==='起業家'&&!g.rich&&R()<0.12){g.rich=true;g.level='成功した起業家';add('事業が成功し大富豪に！');addNews('卒業生',`${g.name}氏、起業で大成功`,`${G.school.name}出身の${g.name}氏の会社が上場。母校への支援も表明している。`);}
 if(g.rich&&R()<0.35){const amt=ri(200,900);income(amt,'卒業生からの寄付');add(`母校に${yen(amt)}を寄付`);notice(`卒業生${g.name}氏から${yen(amt)}の寄付があった！`);addNews('卒業生',`${g.name}氏が母校に${yen(amt)}寄付`,`${G.school.name}野球部に${g.name}氏から多額の寄付が寄せられた。`);}
 else if(g.jobEff==='donate'&&R()<0.07){const amt=ri(15,70);income(amt,'卒業生からの寄付');add(`母校に${yen(amt)}を寄付`);notice(`卒業生${g.name}さんから${yen(amt)}の寄付があった。`);}
 if(R()<0.06&&['会社員','公務員','教師'].includes(g.job)){add(pick(['昇進した','異動になった','結婚した','子どもが生まれた']));}}
/* ================= 年度末・履歴 ================= */
function yearEndRecord(){G.history.push({year:G.year,calYear:G.calYear,results:Object.assign({},G.results),rep:G.rep,budget:G.budget,income:G.fin.income,expense:G.fin.expense,players:active().length,money:G.money});}
/* ================= 新聞フレーバー ================= */
function featureArticles(){if(R()<0.35){const a=active().filter(p=>rating(p)>=60);if(a.length){const p=a.sort((x,y)=>rating(y)-rating(x))[0];addNews('特集',`${G.school.name}の${p.name}君特集`,`${p.grade}年生の${p.name}（${posName(p.pos)}、${p.height}cm${p.weight}kg）。${p.title?'中学時代は'+p.title+'の実績を持つ。':''}${p.unique.length?'「'+p.unique[0]+'」と称される才能の持ち主で、':''}${isPitcher(p)?'最速'+Math.round(p.pit.velo)+'km/hの'+(p.throws==='左'?'左腕':'右腕')+'は':'打席での存在感は'}${G.school.pref}でも評判だ。`);}}
 if(R()<0.3){const pr=pick(PREF_DATA);const s=pick(G.schools.powers[pr.name]);const nm=genName();const isP=R()<0.5;addNews('全国',`${s.name}の${nm}、${isP?'最速'+(R()<0.1?ri(146,151):ri(133,145))+'km':'高校通算'+ri(20,60)+'本塁打'}`,`${pr.name}の強豪${s.name}の${nm}君が注目を集めている。${isP?'キレのある変化球と速球で三振の山を築く。':'高校通算本塁打を量産し、プロのスカウトも視察に訪れている。'}`);}}

/* ================= 記録 ================= */
const JP_RECORDS={fastest:{v:163,label:'高校生最速 163km/h'},careerHR:{v:111,label:'高校通算本塁打 111本'},gameK:{v:22,label:'1試合奪三振 22'},gameHR:{v:3,label:'1試合本塁打 3本'}};
const REC_DEF={careerHR:{label:'通算本塁打',min:5},seasonHR:{label:'シーズン本塁打',min:4},gameHR:{label:'1試合本塁打',min:2},gameHits:{label:'1試合安打',min:4},careerHits:{label:'通算安打',min:40},careerRBI:{label:'通算打点',min:40},careerSB:{label:'通算盗塁',min:20},careerW:{label:'通算勝利',min:10},careerK:{label:'通算奪三振',min:80},seasonK:{label:'シーズン奪三振',min:50},gameK:{label:'1試合奪三振',min:10},fastest:{label:'最速球速',min:135,unit:'km/h'}};
function setRecord(key,v,p,ctx,silent){G.records=G.records||{};const old=G.records[key];const def=REC_DEF[key];if(v<def.min)return false;if(old&&v<=old.v)return false;G.records[key]={v,name:p.name,pid:p.id,year:G.calYear,label:ctx?ctx.label:''};
 const jp=JP_RECORDS[key];if(jp&&v>=jp.v&&!(old&&old.v>=jp.v)){G.rep=clamp(G.rep+15,0,100);addNews('記録',`${p.name}が歴史的記録！${def.label}${v}${def.unit||''}`,`${G.school.name}の${p.name}（${p.grade}年）が${def.label}で${v}${def.unit||''}を記録し、参考記録「${jp.label}」に並ぶか上回る快挙を達成した。${ctx?ctx.label+'での出来事。':''}全国のメディアが殺到している。`,{imp:3,pid:p.id});return true;}
 if(!silent&&old)addNews('記録',`${p.name}が校記録更新：${def.label}${v}${def.unit||''}`,`${G.school.name}の${p.name}（${p.grade}年・${posName(p.pos)}）が${def.label}で${v}${def.unit||''}を記録し、${old.name}（${old.year}年）の${old.v}${def.unit||''}を上回る校記録を打ち立てた。`,{imp:2,pid:p.id});else if(!silent)addNews('記録',`${p.name}、${def.label}${v}${def.unit||''}で校記録`,`${G.school.name}史上初めて${def.label}${v}${def.unit||''}を記録した${p.name}（${p.grade}年）。今後の伸びに期待がかかる。`,{imp:1,pid:p.id});return true;}
function recordCheck(p,kind,s,ctx){if(kind==='bat'){setRecord('gameHR',s.hr,p,ctx);setRecord('gameHits',s.h,p,ctx);setRecord('careerHR',p.career.hr,p,ctx);setRecord('seasonHR',p.season.hr,p,ctx);setRecord('careerHits',p.career.h,p,ctx);setRecord('careerRBI',p.career.rbi,p,ctx);setRecord('careerSB',p.career.sb,p,ctx);}else{setRecord('gameK',s.so,p,ctx);setRecord('careerW',p.career.w,p,ctx);setRecord('careerK',p.career.pk,p,ctx);setRecord('seasonK',p.season.pk,p,ctx);}}
function veloRecord(p,v,ctx,old){const isNew=setRecord('fastest',v,p,ctx,true);if(v>=150&&old>=150&&G.turn-(p.lastVeloNews||-99)<8&&!isNew)return;p.lastVeloNews=G.turn;if(v>=150&&old<150)addNews('記録',`${p.name}、ついに${v}km/h！`,`${ctx?ctx.label:'試合'}で${G.school.name}の${p.name}（${p.grade}年）が自己最速となる${v}km/hを計測した。${G.school.pref}の高校生としては歴史的な数字で、プロのスカウトも色めき立った。`,{imp:3,pid:p.id});
 else if(v>=150)addNews('記録',`${p.name}が自己最速更新 ${v}km/h`,`${p.name}（${G.school.name}）が${ctx?ctx.label:'試合'}で${v}km/hを計測し、自己最速を更新した。`,{imp:2,pid:p.id});
 else if(isNew&&v>=140)addNews('記録',`${p.name}が校内最速 ${v}km/h`,`${G.school.name}の${p.name}（${p.grade}年）が${v}km/hを計測し、学校最速記録を更新した。`,{imp:1,pid:p.id});}
function allTimePlayers(){const cur=G.players.filter(p=>!p.cpu).map(p=>({name:p.name,id:p.id,pos:p.pos,career:p.career,maxVelo:p.maxVelo||0,year:p.joinYear,cur:true,grade:p.grade}));const gr=G.graduates.filter(g=>g.career).map(g=>({name:g.name,id:g.id,pos:g.pos,career:g.career,maxVelo:g.maxVelo||0,year:g.gradYear,cur:false}));return cur.concat(gr);}
const RANK_CATS=[['hr','通算本塁打',p=>p.career.hr,v=>v+'本'],['h','通算安打',p=>p.career.h,v=>v+'本'],['rbi','通算打点',p=>p.career.rbi,v=>v+'点'],['sb','通算盗塁',p=>p.career.sb,v=>v+'個'],['avg','通算打率（100打席以上）',p=>p.career.pa>=100?p.career.h/p.career.ab:-1,v=>v.toFixed(3)],['w','通算勝利',p=>p.career.w,v=>v+'勝'],['pk','通算奪三振',p=>p.career.pk,v=>v+'個'],['era','通算防御率（100アウト以上）',p=>p.career.ipo>=100?-(p.career.per*27/p.career.ipo):-999,v=>(-v).toFixed(2)],['velo','最速球速',p=>p.maxVelo,v=>v+'km/h']];
function rankingHtml(){const all=allTimePlayers();return RANK_CATS.map(c=>{const rows=all.map(p=>({p,v:c[2](p)})).filter(x=>x.v>0||(c[0]==='era'&&x.v>-999)).sort((a,b)=>b.v-a.v).slice(0,10);if(!rows.length)return '';return `<section class="card"><h3>${c[1]}</h3><table class="t">${rows.map((x,i)=>`<tr${x.p.cur?' class="hl"':''}><td>${i+1}</td><td class="l">${esc(x.p.name)}${x.p.cur?'（'+x.p.grade+'年）':'（'+x.p.year+'年卒）'}</td><td>${c[3](x.v)}</td></tr>`).join('')}</table></section>`;}).join('')||'<div class="muted small">まだ記録がありません</div>';}
/* ================= 似顔絵 ================= */
function hashStr(s){let h=2166136261;s=String(s);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function avatarSVG(seed,opt){opt=opt||{};const h=hashStr(seed);const r=n=>(h>>>(n*3))%7;const skins=['#f4d2b4','#e8bc95','#d9a376','#f1c9a5','#c98f5e'];const skin=skins[r(0)%skins.length];const hair=['#1a1a1a','#2b1d12','#3a2a1a','#111','#4a3421'][r(1)%5];const cap=opt.cap||'#1b2a4a';const brim=opt.brim||cap;const base=opt.base||'#ffffff';const trim=opt.trim||cap;const w=opt.size||96;
 const eyes=r(2)%3,mouth=r(3)%3,brow=r(4)%2,face=r(5)%2,hairStyle=r(6)%3;
 const faceShape=face?'M30,42 Q30,20 50,20 Q70,20 70,42 L70,58 Q70,78 50,80 Q30,78 30,58 Z':'M31,40 Q31,18 50,18 Q69,18 69,40 L68,60 Q66,80 50,82 Q34,80 32,60 Z';
 const hairP=hairStyle===0?'M30,42 Q30,14 50,14 Q70,14 70,42 L66,40 Q60,30 50,30 Q40,30 34,40 Z':hairStyle===1?'M29,44 Q28,12 50,12 Q72,12 71,44 L68,42 Q62,26 50,28 Q38,26 32,42 Z':'M30,40 Q32,16 50,16 Q68,16 70,40 L66,36 L60,30 L52,34 L44,28 L36,36 Z';
 const eyeP=eyes===0?'<circle cx="42" cy="48" r="2.4"/><circle cx="58" cy="48" r="2.4"/>':eyes===1?'<ellipse cx="42" cy="48" rx="3" ry="2"/><ellipse cx="58" cy="48" rx="3" ry="2"/>':'<path d="M38,48 q4,-3 8,0 M54,48 q4,-3 8,0" stroke="#222" stroke-width="2" fill="none"/>';
 const browP=brow?'<path d="M37,42 q5,-3 10,0 M53,42 q5,-3 10,0" stroke="'+hair+'" stroke-width="2" fill="none"/>':'<path d="M37,41 l10,0 M53,41 l10,0" stroke="'+hair+'" stroke-width="2.2" fill="none"/>';
 const mouthP=mouth===0?'<path d="M44,66 q6,5 12,0" stroke="#8a3b2e" stroke-width="2" fill="none"/>':mouth===1?'<path d="M44,66 l12,0" stroke="#8a3b2e" stroke-width="2"/>':'<path d="M44,64 q6,7 12,0 z" fill="#8a3b2e"/>';
 const capP=opt.noCap?'':`<path d="M26,38 Q26,8 50,8 Q74,8 74,38 Z" fill="${cap}" stroke="#222" stroke-width="1.5"/><path d="M24,38 Q50,46 88,36 L88,40 Q50,52 22,42 Z" fill="${brim}" stroke="#222" stroke-width="1.5"/>${opt.emblem?`<text x="50" y="30" text-anchor="middle" font-size="11" font-weight="700" fill="${opt.emblemColor||'#fff'}" font-family="${esc(opt.emblemFont||'serif')}">${esc(opt.emblem)}</text>`:''}`;
 return `<svg viewBox="0 0 100 100" width="${w}" height="${w}" class="avatar" role="img" aria-label="似顔絵"><rect x="0" y="0" width="100" height="100" fill="#d8d3c4"/><path d="M14,100 L14,92 Q50,74 86,92 L86,100 Z" fill="${base}" stroke="#222" stroke-width="1.5"/><path d="M36,86 L50,96 L64,86" fill="none" stroke="${trim}" stroke-width="3"/><path d="${faceShape}" fill="${skin}" stroke="#222" stroke-width="1.5"/>${opt.noCap?`<path d="${hairP}" fill="${hair}"/>`:''}${eyeP}${browP}${mouthP}<path d="M48,52 q2,6 0,9" stroke="#b88a6a" stroke-width="1.5" fill="none"/>${capP}</svg>`;}
function avatarFor(a){if(!a)return '';if(a.pid){const p=G.players.find(x=>x.id==a.pid)||G.graduates.find(x=>x.id==a.pid);const u=G.uniform,e=G.emblem;return avatarSVG(a.pid,{cap:u.cap,brim:u.capBrim,base:u.base,trim:u.trim,emblem:e.text,emblemColor:e.textColor,emblemFont:fontCss(e.textFont),size:a.size||96});}
 const av=a.avatar||{};const h=hashStr(av.seed||a.title);const pal=['#1b2a4a','#7a1f1f','#1f5a3a','#2d2d2d','#3b3b8a','#7a4a1f','#114d6b'];const cap=pal[h%pal.length];return avatarSVG(av.seed||a.title,{cap,brim:cap,base:['#ffffff','#f3f0e6','#dfe6ee'][(h>>3)%3],trim:cap,emblem:(av.pref||'').slice(0,1),size:a.size||96});}
/* ================= 進路面談のセリフ ================= */
function gradTalk(p,wish){const r=rating(p);const isP=isPitcher(p);const c=p.career;const line=isP?`通算${c.w}勝${c.l}敗、${c.pk}奪三振`:`通算${c.h}安打${c.hr}本塁打${c.rbi}打点`;
 const say={プロ:pick([`${line}。この3年間で手応えをつかみました。プロの世界で勝負したいです。`,`小さい頃からの夢はプロ野球選手です。ドラフトで名前を呼ばれると信じています。`,`監督、僕はプロに行きます。上で通用する力は、この夏で証明できたと思っています。`]),MLB:pick([`日本を飛び越えて、海の向こうで勝負したいんです。${line}。この力を世界で試したい。`,`メジャーに挑戦します。前例が少ないのは分かっていますが、やらずに後悔したくありません。`]),大学:pick([`まだ体が細いので、大学で4年間鍛えてからプロを目指したいです。`,`大学野球で全国の強い選手と戦って、もう一段上に行きたいです。`,`両親とも相談して、大学に進んで野球を続けるつもりです。`]),社会人:pick([`社会人野球に誘われています。働きながら野球を続けて、ドラフトを狙います。`,`企業チームからお話をいただきました。地元で野球を続けたいです。`]),就職:pick([`野球は高校で区切りをつけようと思います。学力${p.academic}なりに、次の道を探します。`,`正直、自分の実力はよく分かっています。野球は趣味として続けて、${p.academic>=65?'進学して専門職':'就職して社会人'}の道に進みます。`,`家の事情もあって、卒業したら働くつもりです。野球部で学んだことは一生の財産です。`])};
 return say[wish]||say['就職'];}
function gradReply(p,wish,target,ok){if(target===wish)return pick(['はい、その道で頑張ります！','背中を押してもらえて嬉しいです。','ありがとうございます。全力でやります。']);if(ok)return pick([`監督がそう言うなら…分かりました。${target}の道に進みます。`,`正直迷っていました。監督の言葉で決心がつきました。${target}でやります。`,`…はい。${target}に挑戦してみます。`]);return pick([`すみません、やっぱり自分の気持ちは変わりません。${wish}でいきます。`,`お気持ちは嬉しいですが、もう決めているんです。${wish}の道で頑張ります。`,`考えましたが、${wish}にします。応援してください。`]);}

/* ================= ドラフト ================= */
function draftOutcome(p){const r=rating(p);let rank;if(r>=90)rank=1;else if(r>=84)rank=2;else if(r>=78)rank=ri(3,4);else rank=R()<0.5?ri(5,7):0;
 if((r<78&&R()<0.5)||(r<82&&R()<0.3))return {status:'指名漏れ'};
 const team=pick(PRO_TEAMS);let lottery=[team];if(rank===1){const n=r>=94?ri(3,8):r>=91?ri(1,5):ri(1,2);lottery=shuffle(PRO_TEAMS).slice(0,n);if(!lottery.includes(team))lottery[0]=team;}
 return {status:'指名',rank,round:rank===0?'育成ドラフト1位':'ドラフト'+rank+'位',team:rank===1?pick(lottery):team,lottery,year:G.calYear};}
function draftBoard(our){ /* our: [{p,d}] 指名順にならべた架空のドラフト会議 */
 const teams=shuffle(PRO_TEAMS);const rounds=[];const usedOur=new Set();
 const fake=()=>{const isP=R()<0.45;const pr=pick(PREF_DATA);const src=R()<0.55?pick(G.schools.powers[pr.name]).name:R()<0.5?pick(UNIVS):pick(CORPS);return {name:genName(),pos:isP?'投手':pick(['捕手','内野手','外野手']),src,fake:true};};
 for(let rd=1;rd<=7;rd++){const picks=teams.map(t=>({team:t,pick:null}));
  for(const o of our){if(usedOur.has(o.p.id))continue;const d=o.d;if(d.status!=='指名'||d.rank!==rd)continue;const slot=picks.find(x=>x.team===d.team)||picks[0];slot.pick={name:o.p.name,pos:posName(o.p.pos),src:G.school.name,pid:o.p.id,ours:true,lottery:rd===1?d.lottery:null};usedOur.add(o.p.id);}
  for(const x of picks)if(!x.pick)x.pick=fake();
  rounds.push({rd,label:'第'+rd+'巡選択希望選手',picks});}
 const dev=our.filter(o=>o.d.status==='指名'&&o.d.rank===0&&!usedOur.has(o.p.id)).map(o=>({team:o.d.team,pick:{name:o.p.name,pos:posName(o.p.pos),src:G.school.name,pid:o.p.id,ours:true}}));
 if(dev.length)rounds.push({rd:'育成',label:'育成ドラフト',picks:dev});
 return rounds;}
function pressQA(p,d,kind){const r=rating(p);const isP=isPitcher(p);const team=d.team;
 if(kind==='mlb')return [['記者','日本のプロ野球を経由せず、メジャー挑戦を決めた理由は？'],[p.name,pick(['小さい頃からメジャーの舞台に立つことが夢でした。遠回りするより、最短で挑戦したかったんです。','世界最高の舞台で自分の力がどこまで通用するか試したい。怖さより楽しみの方が大きいです。'])],['記者','高校3年間で一番の思い出は？'],[p.name,pick([`${G.school.name}の仲間と戦った夏の大会です。あの経験がなければ今の自分はいません。`,'監督に出会えたことです。野球の考え方がすべて変わりました。'])],['記者','ファンへ一言お願いします。'],[p.name,`必ずメジャーで活躍して、${G.school.pref}に恩返しします。応援よろしくお願いします！`]];
 const q1=d.lottery&&d.lottery.length>1?`${d.lottery.length}球団競合の末、${team}が交渉権を獲得しました。今の気持ちは？`:`${team}から${d.round}で指名されました。今の気持ちは？`;
 return [['記者',q1],[p.name,pick(['名前を呼ばれた瞬間、頭が真っ白になりました。本当に嬉しいです。','ずっと夢見てきた瞬間です。支えてくれた家族と、監督、チームメイトに感謝したいです。','信じられない気持ちですが、ここからがスタートだと思っています。'])],['記者',isP?`持ち味の${Math.round(p.pit.velo)}km/hの速球をプロでどう生かしますか？`:'プロで目指す選手像は？'],[p.name,isP?pick(['まずは体を強くして、1年目から一軍のマウンドに立つことが目標です。','変化球をもっと磨いて、先発ローテーションに入りたいです。']):pick(['走攻守すべてで貢献できる選手になりたいです。','長打力が武器なので、プロでも本塁打を打てる打者を目指します。'])],['記者','高校の後輩たちへメッセージを。'],[p.name,`${G.school.name}で学んだことを誇りに、プロでも頑張ります。後輩たちも甲子園を目指して頑張ってほしいです。`]];}
