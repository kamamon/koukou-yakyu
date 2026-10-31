import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
OUT=os.environ.get('OUT','np')
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.goto('file://'+HTML);pg.wait_for_timeout(300)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(200)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    # 大会を開幕させて展望号をつくり、何試合か自動で進める
    pg.evaluate("""(()=>{startTourney('pref');const t=G.tourney;let g=0;
      while(!t.done&&userMatch(t)&&g++<3){const um=userMatch(t);const opp=um.a.isUser?um.b:um.a;const M=createMatch(opp,t.kind,t.name);M.autoUntil='end';let k=0;while(!M.done&&k++<4000)M.step();const res=applyMatchResult(M,{importance:t.imp,kind:t.kind,label:t.name});tourneyUserResult(res);if(g===1){G.week++;}}
      G.queue=G.queue.filter(q=>q.type!=='tourney');render();})()""")
    pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_home.png')
    pg.evaluate("ACT.openPaper()");pg.wait_for_timeout(400)
    h=pg.evaluate("document.querySelector('.np').getBoundingClientRect().height")
    pg.set_viewport_size({'width':390,'height':int(h)+300});pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_latest.png',full_page=True)
    # 展望号（いちばん古い大会の号）を探す
    idx=pg.evaluate("newsIssues().findIndex(is=>is.items[0].kind==='preview')")
    pg.evaluate(f"UI.newsIssue={idx};render()");pg.wait_for_timeout(300)
    h=pg.evaluate("document.querySelector('.np').getBoundingClientRect().height")
    pg.set_viewport_size({'width':390,'height':int(h)+300});pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_preview.png',full_page=True)
    # 号外（ダミー）
    pg.evaluate("addNews('大会',`${G.school.name}、甲子園出場決定！`,`夏の甲子園 神奈川大会で${G.school.name}が優勝し、夏の甲子園への切符をつかんだ。`,{imp:5,extra:true,head:`${schoolShort(G.school.name)} 甲子園へ`,sub:'神奈川大会 優勝',pid:G.players[0].id});UI.newsIssue=0;render();")
    pg.wait_for_timeout(300)
    h=pg.evaluate("document.querySelector('.np').getBoundingClientRect().height")
    pg.set_viewport_size({'width':390,'height':int(h)+300});pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_gogai.png',full_page=True)
    # 記事を開く
    pg.set_viewport_size({'width':390,'height':844})
    pg.evaluate("UI.newsIssue=1;render()");pg.wait_for_timeout(200)
    pg.click('.np-lead');pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}_read.png')
    print('issues',pg.evaluate("newsIssues().length"),'errs',errs)
    b.close()
