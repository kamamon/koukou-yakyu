const fs=require('fs');const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n');
new Function('module',src+`;function saveGame(){}
newGame({name:'x',pref:'神奈川',type:'公立',size:'中',hensachi:50});
const t=startTourney('district');
try{const h=tourneyRoundsHtml(t);console.log('district ok',h.length);}catch(e){console.log('ERR district',e.stack.split('\\n').slice(0,3).join('|'));}
const t2=startTourney('pref');
try{const h=tourneyRoundsHtml(t2);console.log('pref ok',h.length,'P',t2.P,'rounds',t2.rounds.length);}catch(e){console.log('ERR pref',e.stack.split('\\n').slice(0,3).join('|'));}
`)({});
