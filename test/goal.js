const fs=require('fs');const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n');
new Function('module',src+`;function saveGame(){}
newGame({name:'x',pref:'岡山',type:'私立',size:'大',hensachi:50,mode:'elite'});
console.log('goal',G.goal.level,G.goal.trust,GOALS[G.goal.level-1].text);
G.results={pref:'ベスト4'};evaluateGoal();console.log('after miss',G.goal.trust,G.gameOver,G.queue.map(q=>q.type));
G.results={pref:'優勝',koshien:'ベスト8'};evaluateGoal();console.log('after hit',G.goal.trust,G.goal.level,G.gameOver);
G.results={pref:'2回戦敗退'};G.money=-10;evaluateGoal();console.log('miss+deficit',G.goal.trust,G.gameOver);
G.results={};evaluateGoal();console.log('miss again',G.goal.trust,G.gameOver,G.queue[G.queue.length-1]);
`)({});
