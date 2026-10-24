import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1);pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(250)
    def goto(side):
        for i in range(60):
            st=pg.evaluate("[AR.phase,AR.side]")
            if st[0]=='pre' and st[1]==side:return True
            if st[0]=='half':pg.click('[data-act="arBannerNext"]')
            elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
            elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
            elif st[0]=='decide':pg.evaluate("ACT.arDecide({v:'0'})")
            pg.wait_for_timeout(200)
        return False
    def wf(k=2,ms=4000):
        n0=pg.evaluate("AR.drawN||0")
        for i in range(ms//50):
            pg.wait_for_timeout(50)
            if pg.evaluate("AR.drawN||0")>=n0+k:return
    goto('pit');wf();pg.screenshot(path='mode_real.png')
    # メニューから切り替え
    pg.evaluate("ACT.arMenu()");pg.wait_for_timeout(200)
    pg.select_option('select[data-k="model3d"]','chibi');pg.wait_for_timeout(300)
    print('model',pg.evaluate("[actionSettings().model3d,R3.rigModel,R3.batter.constructor.name]"))
    pg.evaluate("ACT.arPanelClose()");wf();pg.screenshot(path='mode_chibi.png')
    pg.evaluate("ACT.arMenu()");pg.wait_for_timeout(200);pg.select_option('select[data-k="model3d"]','real');pg.wait_for_timeout(300);pg.evaluate("ACT.arPanelClose()")
    print('model',pg.evaluate("[actionSettings().model3d,R3.rigModel,R3.batter.constructor.name]"))
    # 2D表示での投球
    pg.evaluate("ACT.arMenu()");pg.wait_for_timeout(200);pg.select_option('select[data-k="view3d"]','0');pg.wait_for_timeout(300);pg.evaluate("ACT.arPanelClose()")
    goto('bat');pg.evaluate("window.__t=performance.now();window.__realNow=performance.now.bind(performance);performance.now=()=>window.__t;")
    pg.evaluate("arThrowCpu();")
    for i in range(6):
        pg.evaluate("window.__t+=330");pg.wait_for_timeout(120);pg.screenshot(path=f'mode_2d_{i}.png')
    print('2d phase',pg.evaluate("[AR.phase,AR.cur&&AR.cur.name,AR.cur&&AR.cur.form]"))
    print('ERRORS',errs[:5])
    b.close()
