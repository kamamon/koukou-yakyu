import os,random
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844})
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: print('PAGEERR',e))
    pg.on('console',lambda m: print('CONSOLE',m.type,m.text[:400]) if m.type in('warning','error') else None)
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'テスト高校',strength:58,pref:'神奈川'}});render();")
    pg.wait_for_timeout(100)
    pg.select_option('#modeSel','card');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    print('3d on at start',pg.evaluate("r3on()"))
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(300)
    n=0
    for step in range(200):
        st=pg.evaluate("({ph:AR.phase,on:r3on(),broken:R3.broken,wait:AR.banner?AR.banner.wait:false,hidden:!AR.el||AR.el.hidden})")
        if st['hidden']:break
        if not st['on']:
            print('3D OFF at step',step,st);break
        if st['ph']=='pre':
            btns=pg.query_selector_all('[data-act="cdPlay"]:not([disabled])')
            if btns:btns[random.randrange(len(btns))].click();n+=1
            pg.wait_for_timeout(200)
        elif st['ph']=='half':
            if st['wait']:pg.click('[data-act="arBannerNext"]')
            pg.wait_for_timeout(200)
        else:
            pg.wait_for_timeout(300)
        if n>=12:break
    print('PAs',n,'final',pg.evaluate("({ph:AR.phase,on:r3on(),broken:R3.broken})"))
    b.close()
