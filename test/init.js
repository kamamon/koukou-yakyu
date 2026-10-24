const fs=require('fs');const src=['01_data.js','01b_abil.js','01c_fac.js','01d_cards.js','02_core.js','03_match.js','04_tourney.js','05_people.js','05b_events.js'].map(f=>fs.readFileSync('src/'+f,'utf8')).join('\n');
new Function('module',src+`;function saveGame(){}
newGame({name:'x',pref:'岡山',type:'公立',size:'中',hensachi:50,mode:'custom',custom:{money:3000,facLevel:1,goals:true,goalLevel:2}});
console.log('custom1',Object.keys(G.fac),G.money,G.goal&&G.goal.level,G.coach.type,G.coach.level,G.scout&&G.scout.level,G.ground.lv,G.dorm.lv,G.queue.map(q=>q.type));
newGame({name:'x',pref:'岡山',type:'公立',size:'中',hensachi:50,mode:'custom',custom:{facLevel:3}});console.log('custom3 fac',Object.keys(G.fac).length);
newGame({name:'x',pref:'岡山',type:'私立',size:'大',hensachi:50,mode:'elite'});console.log('elite',Object.keys(G.fac).length,G.budget,G.money,G.rep,G.coach.level,teamStrength(),G.queue.map(q=>q.type));
`)({});
