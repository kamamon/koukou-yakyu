import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
OUT=os.path.dirname(os.path.abspath(__file__))
errors=[]
AUTOQ="""
(function(){
 let guard=0;
 while(G.queue.length&&guard++<50){const ev=G.queue[0];
  switch(ev.type){
   case 'tourney':{const t=G.tourney;let g2=0;while(!t.done&&userMatch(t)&&g2++<20){const um=userMatch(t);const opp=um.a.isUser?um.b:um.a;const M=createMatch(opp,t.kind,t.name);M.autoUntil='end';let g=0;while(!M.done&&g++<3000)M.step();const res=applyMatchResult(M,{importance:t.imp,kind:t.kind,label:t.name});tourneyUserResult(res);}G.tourneyLog=G.tourneyLog||[];G.tourneyLog.push({name:t.name,kind:t.kind,year:t.year,userLabel:t.userLabel,rounds:t.rounds,userGames:t.userGames,champion:t.champion,done:true,cur:t.cur,teams:t.teams});G.tourney=null;G.queue.shift();break;}
   case 'camp':{setCamp('local',1);G.queue.shift();break;}
   case 'u18':{u18Resolve(ev.ids);G.queue.shift();break;}
   case 'budget':{committeeStart();for(let i=0;i<3;i++){const o=committeeOptions();committeeChoose(o[0].id);}committeeRequest(15);G.queue.shift();break;}
   case 'invite':{startTourney('invite2');G.queue.shift();break;}
   case 'graduation':{const th=G.players.filter(p=>p.grade===3);for(const p of th)graduate(p,playerWish(p));G.players=G.players.filter(p=>p.grade!==3);autoLineup();autoNumbers();G.queue.shift();break;}
   default:G.queue.shift();
  }}
})();
"""
def main():
    with sync_playwright() as p:
        b=p.chromium.launch()
        for theme in ['light','dark']:
            ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,color_scheme=theme)
            pg=ctx.new_page()
            pg.route("**/*",lambda route: route.abort() if 'googleapis' in route.request.url or 'gstatic' in route.request.url else route.continue_())
            pg.on('pageerror',lambda e: errors.append('PAGEERROR: '+str(e)))
            pg.goto('file://'+HTML); pg.wait_for_timeout(200)
            pg.fill('#suName','青葉学園'); pg.select_option('#suPref','神奈川'); pg.select_option('#suType','私立')
            pg.click('[data-act="startGame"]'); pg.wait_for_timeout(100)
            # advance to June week 2 (10 weeks) auto-resolving
            pg.evaluate("for(let i=0;i<11;i++){"+AUTOQ+"advanceWeek();}"+AUTOQ+"render();")
            if theme=='light':
                pg.click('[data-act="tab"][data-tab="players"]'); pg.wait_for_timeout(50)
                pg.click('[data-act="pdetail"]'); pg.wait_for_timeout(50)
                pg.screenshot(path=f'{OUT}/s_player_{theme}.png',full_page=True)
                pg.click('[data-act="closeModal"]')
            pg.click('[data-act="tab"][data-tab="scout"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_scout_{theme}.png',full_page=False)
            # manager-mode match: start a practice game
            pg.click('[data-act="tab"][data-tab="home"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_home_{theme}.png',full_page=False)
            pg.evaluate("G.money=5000;G.practicedThisWeek=false;render();")
            pg.click('[data-act="practice"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_lineup_{theme}.png',full_page=False)
            pg.select_option('#modeSel','manager'); pg.click('[data-act="lineupSave"]'); pg.wait_for_timeout(50)
            # proceed until we get a batting decision
            for i in range(60):
                if pg.query_selector('[data-act="mCmd"][data-c="bunt"]') or pg.query_selector('[data-act="mChangeList"]'): break
                if pg.query_selector('[data-act="mCmd"]'): pg.click('[data-act="mCmd"][data-c="none"]')
                elif pg.query_selector('[data-act="mCont"]'): pg.click('[data-act="mCont"]')
                elif pg.query_selector('[data-act="mClose"]'): break
                pg.wait_for_timeout(10)
            pg.screenshot(path=f'{OUT}/s_match_{theme}.png',full_page=False)
            pg.evaluate("UI.match&&UI.match.m&&(UI.match.m.autoUntil='end')")
            if pg.query_selector('[data-act="mAutoEnd"]'): pg.click('[data-act="mAutoEnd"]')
            elif pg.query_selector('[data-act="mCmd"]'): pg.click('[data-act="mCmd"][data-c="none"]')
            pg.wait_for_timeout(50)
            if pg.query_selector('[data-act="mClose"]'): pg.click('[data-act="mClose"]')
            # advance to Feb week 3 (budget) : from 6-2 → 2-3 : months 6..2 → weeks: (6:2 remaining 2) + 7..12 (24) + 1 (4) + 2 weeks(2)=32
            pg.evaluate("for(let i=0;i<40;i++){if(G.month===2&&G.week===3)break;"+AUTOQ+"advanceWeek();}render();")
            pg.wait_for_timeout(50)
            if pg.query_selector('[data-act="budgetChoose"]'):
                pg.screenshot(path=f'{OUT}/s_budget_{theme}.png',full_page=False)
                pg.click('[data-act="budgetChoose"]'); pg.click('[data-act="budgetChoose"]'); pg.click('[data-act="budgetChoose"]')
                pg.click('[data-act="budgetReq"]'); pg.click('[data-act="closeQ"]')
            pg.evaluate("for(let i=0;i<10;i++){if(G.month===3&&G.week===3)break;"+AUTOQ+"advanceWeek();}render();")
            pg.wait_for_timeout(50)
            if pg.query_selector('[data-act="gradGo"]'):
                pg.screenshot(path=f'{OUT}/s_grad_{theme}.png',full_page=False)
                pg.click('[data-act="gradGo"]'); pg.click('[data-act="closeQ"]')
            pg.evaluate("for(let i=0;i<3;i++){"+AUTOQ+"advanceWeek();}render();")
            pg.wait_for_timeout(50)
            if pg.query_selector('[data-act="qShift"]'):
                pg.screenshot(path=f'{OUT}/s_entrance_{theme}.png',full_page=False)
                pg.click('[data-act="qShift"]')
            pg.click('[data-act="tab"][data-tab="more"]'); pg.click('[data-act="moreTab"][data-t="news"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_news_{theme}.png',full_page=False)
            pg.click('[data-act="moreTab"][data-t="alumni"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_alumni_{theme}.png',full_page=False)
            pg.click('[data-act="tab"][data-tab="match"]'); pg.wait_for_timeout(50)
            pg.screenshot(path=f'{OUT}/s_matchtab_{theme}.png',full_page=False)
            ctx.close()
        b.close()
main()
print('errors',errors)
