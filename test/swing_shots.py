import os,sys
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page()
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'テスト高校',strength:58,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(100)
    # make sure user is batting: if pitching, finish the half quickly
    side=pg.evaluate("AR.side")
    if side=='pit':
        pg.evaluate("(()=>{const m=AR.m;const inn=m.inn,top=m.top;arAbortPA();while(!m.done&&m.inn===inn&&m.top===top)m.step();cancelAnimationFrame(AR.raf);AR.raf=0;m.askRun=true;m.paStart();AR.side='bat';AR.phase='pre';AR.dots=[];arRenderAll();})()")
    else:
        pg.evaluate("cancelAnimationFrame(AR.raf);AR.raf=0;")
    def capture(kind,want):
        for attempt in range(25):
            r=pg.evaluate(f"""(()=>{{const m=AR.m;if(!m.pa||m.pa.done){{m.paStart();AR.dots=[];}}AR.panel=null;const P=m.throwPitch(null);AR.cur=P;AR.swing=null;AR.swung=false;AR.swingT=null;AR.ev=null;AR.caughtSnd=false;AR.phase='flight';AR.t0=performance.now();
              // 疑似スイング：{kind}
              const miss='{want}'==='miss';AR.cursor=miss?{{x:P.x+1.6,y:P.y}}:{{x:P.x,y:P.y}};const now=performance.now();const ideal=AR.t0+(P.T-70)*AR.speed;AR.swung=true;AR.swingT=ideal;AR.swing={{type:'meet',cx:AR.cursor.x,cy:AR.cursor.y,dt:miss?0:0}};AR.ev=m.resolvePitch(P,AR.swing);return AR.ev.kind;}})()""")
            if (want=='miss' and r in('miss','kSwing')) or (want=='hit' and r=='inplay') or (want=='foul' and r=='foul'):
                break
        print(kind,'ev',r)
        off=pg.evaluate("AR.swingT-AR.t0")
        for i,d in enumerate([-300,-60,0,60,120,220,320]):
            pg.evaluate(f"(()=>{{const now=performance.now();AR.swingT=now-({d});AR.t0=AR.swingT-{off};arDraw(now);}})()")
            pg.wait_for_timeout(30)
            pg.screenshot(path=f'sw_{kind}_{i}.png')
    capture('miss','miss');capture('hit','hit');capture('foul','foul')
    print('ERRORS',errs)
    b.close()
