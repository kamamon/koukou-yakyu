import os,time
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1);pg=ctx.new_page()
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.click('[data-act="tab"][data-tab="more"]');pg.wait_for_timeout(50);pg.click('[data-act="moreTab"][data-t="settings"]');pg.wait_for_timeout(100)
    t=time.time();pg.click('[data-act="uniformEditor"]');pg.wait_for_timeout(50)
    print('sel',pg.query_selector('select[data-scope="u"][data-k="style"]') is not None, 'modal', pg.query_selector('.modal') is not None, time.time()-t)
    print(pg.evaluate("document.querySelectorAll('select[data-k]').length"), [e.get_attribute('data-k') for e in pg.query_selector_all('select[data-scope]')][:10])
    print('ERRORS',errs[:3])
    b.close()
