const fs=require('fs');const path=require('path');
const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`
function saveGame(){}
module.exports={newGame,G:()=>G,cpuRoster,buildTeams,isPitcher,PREF_DATA,genPlayer,active};
`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
for(const pref of ['神奈川','岡山','鳥取']){
 L.newGame({name:'青葉高校',pref,type:'公立',size:'中',hensachi:55});
 const teams=L.buildTeams('pref');
 const vel=[];
 for(const t of teams){if(t.isUser){for(const p of L.active().filter(L.isPitcher))vel.push(Math.round(p.pit.velo));continue;}const r=L.cpuRoster(t.name,t.strength,t.pref);for(const p of r.lineup.map(s=>s.p).concat(r.bench))if(L.isPitcher(p))vel.push(Math.round(p.pit.velo));}
 vel.sort((a,b)=>b-a);
 const bands=[150,145,140,135,130,120,110,100,0].map((lo,i,a)=>[lo,vel.filter(v=>v>=lo&&(i===0||v<a[i-1])).length]);
 console.log(pref,'teams',teams.length,'pitchers',vel.length,'top5',vel.slice(0,5).join(','),'bands',bands.map(b=>b[0]+'+:'+b[1]).join(' '),'user',L.active().filter(L.isPitcher).map(p=>Math.round(p.pit.velo)).join(','));
}
// region-wide 150+ count: all powerhouses in 関東 + pref teams
L.newGame({name:'青葉高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
let over150=0,over145=0,total=0;
for(let rep=0;rep<10;rep++){for(const pr of L.PREF_DATA.filter(p=>p.region==='関東')){const teams=L.buildTeams('koshien').filter(t=>t.pref===pr.name);for(const pw of Object.values(L.G().schools.powers[pr.name])){const r=L.cpuRoster(pw.name,pw.strength,pr.name);for(const p of r.lineup.map(s=>s.p).concat(r.bench))if(L.isPitcher(p)){total++;if(p.pit.velo>=150)over150++;if(p.pit.velo>=145)over145++;}}}}
console.log('関東 powerhouse pitchers (10 samples):',total,'145+:',over145,'150+:',over150);
