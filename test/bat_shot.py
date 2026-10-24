import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(400)
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(300)
    for i in range(60):
        st=pg.evaluate("[AR.phase,AR.side]")
        if st[0]=='pre' and st[1]=='bat':break
        if st[0]=='half':pg.click('[data-act="arBannerNext"]')
        elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
        elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
        elif st[0]=='decide':pg.evaluate("ACT.arDecide({v:'0'})")
        pg.wait_for_timeout(200)
    def wf():
        n0=pg.evaluate("AR.drawN||0")
        for i in range(60):
            pg.wait_for_timeout(50)
            if pg.evaluate("AR.drawN||0")>=n0+2:return
    wf();pg.screenshot(path='bat_easy_pre.png')
    rect=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
    cx=rect[0]+rect[2]*0.5;cy=rect[1]+rect[3]*0.8
    pg.evaluate("window.__realNow=performance.now.bind(performance);window.__t=performance.now();performance.now=()=>window.__t;")
    pg.mouse.move(cx,cy);pg.mouse.down();pg.wait_for_timeout(100)
    pg.evaluate("window.__t+=650+600");wf();pg.mouse.move(cx+20,cy+10,steps=3);wf();pg.screenshot(path='bat_easy_flight.png')
    pg.evaluate("window.__t=AR.t0+(AR.cur.T-70)*AR.speed");wf();pg.mouse.up();pg.evaluate("window.__t+=120");wf();pg.screenshot(path='bat_easy_swing.png')
    print('swing',pg.evaluate("[AR.swung,AR.ev?AR.ev.kind:null,AR.ev&&AR.ev.c?AR.ev.c.d.toFixed(2):null]"),'errs',errs)
    b.close()
