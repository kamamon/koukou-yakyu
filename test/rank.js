// Sランクの希少性チェック：全国の学校とCPUロスターを生成し、S/Aの数を数える
const fs=require('fs');
const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={newGame,G:()=>G,cpuRoster,rating,ratingRank,allSchools,applyEliteSchools,refreshStars,letter,buildTeams,driftSchools,genPracticeList};
`;
const m={exports:{}};
new Function('module','require',code)(m,require);
const L=m.exports;
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
const G=L.G();
let worst={S:0,A:0,schoolsS:0};
for(let trial=0;trial<5;trial++){
 if(trial)L.driftSchools();
 const schools=L.allSchools();
 const sS=schools.filter(s=>s.strength>=90);
 const stars=G.stars;
 if(sS.length<3||sS.length>5)throw new Error('S-rank schools out of range: '+sS.length);
 if(!sS.every(s=>s.elite))throw new Error('non-elite school with S strength');
 const starS=stars.filter(s=>s.rank==='S').length;
 if(starS<3||starS>5)throw new Error('S stars out of range: '+starS);
 // 全学校のロスターを生成し、総合Sの人数を数える
 let nS=0,nA=0,nP=0;const sNames=[];
 for(const s of schools){const r=L.cpuRoster(s.name,s.strength,s.pref);const ps=r.lineup.map(x=>x.p).concat(r.bench);for(const p of ps){nP++;const rk=L.ratingRank(p);if(rk==='S'){nS++;sNames.push(p.name+'@'+s.name+'('+(p.nstar?p.nstar.rank:'-')+')');}else if(rk==='A')nA++;}}
 console.log(`trial ${trial}: schools=${schools.length} eliteS=${sS.length} [${sS.map(s=>s.name+':'+s.strength).join(', ')}] stars S=${starS} A=${stars.filter(s=>s.rank==='A').length} | players=${nP} S=${nS} A=${nA}`);
 if(nS)console.log('  S players:',sNames.join(' / '));
 worst.S=Math.max(worst.S,nS);worst.A=Math.max(worst.A,nA);
 // トーナメントの出場校に90以上の非エリートがいないこと
 for(const kind of ['koshien','senbatsu','jingu','invite2','invite3','regional']){const ts=L.buildTeams(kind);for(const t of ts){if(!t.isUser&&t.strength>=90&&!t.elite)throw new Error(kind+': non-elite team with S strength '+t.name+' '+t.strength);}}
 const pl=L.genPracticeList();for(const t of pl){if(t.strength>=90&&!t.elite)throw new Error('practice: non-elite '+t.name);}
}
if(worst.S>8)throw new Error('too many S players: '+worst.S);
// 総合ランクの文字分布（能力値個別の文字より厳しい）
const r=L.cpuRoster('X',88,'東京');const ps=r.lineup.map(x=>x.p);
console.log('q88 roster ranks:',ps.map(p=>L.ratingRank(p)+Math.round(L.rating(p))).join(' '));
console.log('rank test ok');
