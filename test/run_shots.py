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
    r=pg.evaluate("""(()=>{const m=AR.m;// 走者を一塁に置いて盗塁
      if(!m.pa||m.pa.done)m.paStart();const t=m.bat();const runner=t.lineup[(t.batIdx+8)%9].p;m.bases[0]=runner;m.pa.cmd='steal';
      for(let i=0;i<30;i++){const P=m.throwPitch(null);const ev=m.resolvePitch(P,null);if(ev.runPlay){AR.cur=P;AR.swung=false;AR.ev=ev;arShowResult(ev);return ev.runPlay;}if(m.pa.done)break;}return null;})()""")
    print('runPlay',r)
    pg.wait_for_timeout(700)
    print('phase',pg.evaluate("AR.phase"),pg.evaluate("AR.field&&AR.field.kind"))
    pg.evaluate("cancelAnimationFrame(AR.raf);AR.raf=0;")
    T=pg.evaluate("AR.field.T")
    for i in range(6):
        t=T*i/5
        pg.evaluate(f"(()=>{{AR.field.t0=performance.now()-{t}/(AR.field.rate||1);arDraw(performance.now());}})()");pg.wait_for_timeout(30);pg.screenshot(path=f'rs_{i}.png')
    print('ERRORS',errs)
    b.close()
