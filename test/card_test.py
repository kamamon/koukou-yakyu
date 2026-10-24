import os,sys,random
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
PAS=int(sys.argv[1]) if len(sys.argv)>1 else 30
SHOT=len(sys.argv)>2 and sys.argv[2]=='shot'
DARK=len(sys.argv)>3 and sys.argv[3]=='dark'
ANIM=sys.argv[4] if len(sys.argv)>4 else 'full'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.on('console',lambda m: print('CONSOLE',m.text[:500]) if ('3D' in m.text or m.type=='error' and 'ERR_FAILED' not in m.text) else None)
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'テスト高校',strength:58,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    print('mode select default',pg.evaluate("document.querySelector('#modeSel').value"))
    pg.select_option('#modeSel','card');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    pg.evaluate(f"actionSettings().cardAnim='{ANIM}';")
    shots=set()
    def shot(name):
        if SHOT and name not in shots:
            shots.add(name);pg.screenshot(path=f'c_{name}{"_d" if DARK else ""}.png')
    n=0;steps=0;used={}
    while steps<3000:
        steps+=1
        st=pg.evaluate("({ph:AR.phase,side:AR.side,hidden:!AR.el||AR.el.hidden,wait:AR.banner?AR.banner.wait:false,panel:!!AR.panel})")
        if st['hidden']:break
        ph=st['ph']
        if n>=PAS:
            for k in range(4):
                pg.click('[data-act="arMenu"]');pg.wait_for_timeout(50);shot('menu')
                if pg.query_selector('[data-act="arAutoEnd"]'):
                    try:
                        pg.click('[data-act="arAutoEnd"]',timeout=5000);break
                    except Exception as e:print('menu retry',str(e)[:60])
                pg.wait_for_timeout(300)
            pg.wait_for_timeout(300);break
        if ph=='pre' and not st['panel']:
            shot('pre_'+st['side'])
            cards=pg.query_selector_all('.ccard:not(.off)[data-act="cdPlay"]')
            if n%8==5 and pg.query_selector('[data-act="cdSwap"]'):pg.click('[data-act="cdSwap"]');pg.wait_for_timeout(30);cards=pg.query_selector_all('.ccard:not(.off)[data-act="cdPlay"]')
            if n%7==3 and st['side']=='pit' and pg.query_selector('[data-act="cdAlert"][data-k="bunt"]'):pg.click('[data-act="cdAlert"][data-k="bunt"]')
            if n%9==4 and st['side']=='bat' and pg.query_selector('[data-act="arPinchList"]'):
                pg.click('[data-act="arPinchList"]');pg.wait_for_timeout(30);shot('pinch');pb=pg.query_selector_all('[data-act="arPinch"]')
                if pb:pb[0].click()
                else:pg.click('[data-act="arPanelClose"]')
                pg.wait_for_timeout(30);cards=pg.query_selector_all('.ccard:not(.off)[data-act="cdPlay"]')
            try:
                if cards and random.random()<0.8:
                    c=random.choice(cards);name=c.query_selector('.cn').inner_text();uid=c.get_attribute('data-uid');used[name]=used.get(name,0)+1;pg.click(f'.ccard[data-uid="{uid}"]',timeout=3000)
                else:
                    pg.click('[data-act="cdPass"]',timeout=3000)
            except Exception as e:
                print('click skip',str(e)[:80])
            n+=1;pg.wait_for_timeout(60)
        elif ph in('wind','flight'):
            shot('flight_'+st['side']);pg.wait_for_timeout(250)
        elif ph=='field':
            shot('field');pg.wait_for_timeout(250)
        elif ph=='after':
            shot('after_'+st['side']);pg.wait_for_timeout(200)
        elif ph=='half':
            shot('half')
            if st['wait']:pg.click('[data-act="arBannerNext"]')
            pg.wait_for_timeout(250)
        else:
            pg.wait_for_timeout(100)
    hid=pg.evaluate("!AR.el||AR.el.hidden");res=pg.evaluate("UI.match&&UI.match.res?[UI.match.res.score,UI.match.res.won,UI.match.res.inn]:null")
    print('arena hidden',hid,'result',res,'PAs',n,'steps',steps,'cards used',used)
    shot('result')
    if pg.query_selector('[data-act="mClose"]'):pg.click('[data-act="mClose"]');pg.wait_for_timeout(100)
    print('trust sample',pg.evaluate("active().slice(0,6).map(p=>p.name+':'+Math.round(p.trust)+'/'+p.persona)"))
    print('ERRORS',len(errs));[print(e[:400]) for e in errs[:8]]
    b.close()
