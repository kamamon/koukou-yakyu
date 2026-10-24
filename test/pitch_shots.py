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
    side=pg.evaluate("AR.side")
    if side=='bat':
        pg.evaluate("(()=>{const m=AR.m;const inn=m.inn,top=m.top;arAbortPA();while(!m.done&&m.inn===inn&&m.top===top)m.step();cancelAnimationFrame(AR.raf);AR.raf=0;m.paStart();AR.side='pit';AR.phase='pre';AR.dots=[];arRenderAll();})()")
    else:
        pg.evaluate("cancelAnimationFrame(AR.raf);AR.raf=0;")
    def capture(kind,want):
        for attempt in range(60):
            r=pg.evaluate(f"""(()=>{{const m=AR.m;if(!m.pa||m.pa.done){{m.paStart();AR.dots=[];}}AR.panel=null;AR.target={{x:0,y:0.2}};AR.pitchSel=0;AR.power='normal';
              const p=m.pa.p;const ps=p.pit.pitches;const inp={{pitch:ps[0],tx:0,ty:0.2,power:'normal',rel:null}};const P=m.throwPitch(inp);AR.cur=P;AR.gauge=null;const sw=m.cpuSwingInput(P);AR.swing=sw;AR.swung=false;AR.swingT=null;AR.caughtSnd=false;AR.cpuSwingAt=sw?(P.T-70+sw.dt):null;AR.ev=m.resolvePitch(P,sw);AR.phase='flight';AR.t0=performance.now();return [AR.ev.kind,!!sw];}})()""")
            if r[1] and ((want=='miss' and r[0] in('miss','kSwing')) or (want=='hit' and r[0]=='inplay')):
                break
        print(kind,'ev',r)
        for i,d in enumerate([-300,-60,0,60,120,220,320]):
            pg.evaluate(f"(()=>{{const now=performance.now();AR.swingT=now-({d});AR.swung=true;AR.t0=AR.swingT-AR.cpuSwingAt*AR.speed;arDraw(now);}})()")
            pg.wait_for_timeout(30)
            pg.screenshot(path=f'pw_{kind}_{i}.png')
    capture('miss','miss');capture('hit','hit')
    print('ERRORS',errs)
    b.close()
