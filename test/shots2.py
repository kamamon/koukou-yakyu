import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath('../dist/高校野球シミュレーション.html')
AUTOQ=open('shots.py').read().split('AUTOQ="""')[1].split('"""')[0]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page()
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url or 'gstatic' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.fill('#cuMoney','8000');pg.fill('#cuStars','2');pg.fill('#cuScout','7');pg.fill('#cuCoach','7')
    pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    # to May week 2 -> district tournament modal
    pg.evaluate("for(let i=0;i<5;i++){"+AUTOQ+"advanceWeek();}closeModal();render();");pg.wait_for_timeout(50)
    pg.screenshot(path='t_tourney_modal.png')
    pg.evaluate("document.querySelector('#modal details').open=true");pg.wait_for_timeout(30)
    pg.evaluate("document.querySelector('.bracket').scrollIntoView()");pg.wait_for_timeout(30);pg.screenshot(path='t_bracket.png')
    # play through district with auto
    pg.evaluate(AUTOQ+"closeModal();render();");pg.wait_for_timeout(50)
    pg.click('[data-act="tab"][data-tab="match"]');pg.wait_for_timeout(50)
    # open tournament log detail
    pg.click('[data-act="tab"][data-tab="more"]');pg.click('[data-act="moreTab"][data-t="history"]');pg.wait_for_timeout(30)
    if pg.query_selector('[data-act="tlog"]'):
        pg.click('[data-act="tlog"]');pg.wait_for_timeout(50);pg.screenshot(path='t_tlog.png');pg.click('[data-act="closeModal"]')
    # advance to July (candidates in June) then scout detail
    pg.evaluate("for(let i=0;i<6;i++){"+AUTOQ+"advanceWeek();}"+AUTOQ+"closeModal();render();");pg.wait_for_timeout(50)
    pg.click('[data-act="tab"][data-tab="scout"]');pg.wait_for_timeout(50)
    pg.screenshot(path='t_scout.png')
    pg.click('[data-act="candDetail"]');pg.wait_for_timeout(50);pg.screenshot(path='t_cand_detail.png')
    for i in range(3):
        if pg.query_selector('[data-act="candVisitM"]'): pg.click('[data-act="candVisitM"]');pg.wait_for_timeout(30)
    pg.screenshot(path='t_cand_detail3.png');pg.click('[data-act="closeModal"]')
    # player detail with potential/caps
    pg.click('[data-act="tab"][data-tab="players"]');pg.wait_for_timeout(30)
    pid=pg.evaluate("(G.players.find(p=>p.scouted&&p.unique.length)||G.players[0]).id")
    pg.click(f'[data-act="pdetail"][data-id="{pid}"]');pg.wait_for_timeout(50);pg.screenshot(path='t_player.png');pg.click('[data-act="closeModal"]')
    # advance to Aug week 3 (after koshien/nationals) then newspaper
    pg.evaluate("for(let i=0;i<8;i++){"+AUTOQ+"advanceWeek();}"+AUTOQ+"closeModal();render();");pg.wait_for_timeout(50)
    pg.click('[data-act="tab"][data-tab="more"]');pg.click('[data-act="moreTab"][data-t="news"]');pg.wait_for_timeout(50)
    pg.screenshot(path='t_news.png',full_page=True)
    pg.click('[data-act="newsOpen"]');pg.wait_for_timeout(50);pg.screenshot(path='t_news_article.png');pg.click('[data-act="closeModal"]')
    pg.click('[data-act="moreTab"][data-t="records"]');pg.wait_for_timeout(50);pg.screenshot(path='t_records.png',full_page=True)
    # graduation talk: advance to March week 3
    pg.evaluate("for(let i=0;i<40;i++){if(G.month===3&&G.week===3)break;"+AUTOQ+"advanceWeek();}closeModal();render();");pg.wait_for_timeout(50)
    if pg.query_selector('[data-act="gradChoose"]'):
        pg.screenshot(path='t_grad1.png');pg.click('[data-act="gradChoose"]');pg.wait_for_timeout(50);pg.screenshot(path='t_grad2.png')
    print('errs',errs)
    b.close()
