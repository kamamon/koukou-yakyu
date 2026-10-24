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
    found=pg.evaluate("""()=>{const m=AR.m;for(let g=0;g<3000;g++){if(m.done)return null;if(!m.pa||m.pa.done){m.paStart();m.askRun=true;}
      if(m.pa.cmd==='ibb'){m.paIbb();continue;}
      if(!m.userBatting()){m.cpuFinishPA();continue;}
      const P=m.throwPitch(null);const sw=m.cpuSwingInput(P);const ev=m.resolvePitch(P,sw);
      if(ev.kind==='inplay'&&ev.decision){AR.side='bat';AR.phase='pre';arShowResult(ev);return {kind:ev.decision.kind,pause:AR.field.pauseAt,T:AR.field.T};}}
      return null;}""")
    print('found',found)
    if found:
        pg.wait_for_timeout(100)
        pg.evaluate("AR.field.t0=performance.now()-AR.field.pauseAt*0.5/(AR.field.rate||1);");pg.wait_for_timeout(80);pg.screenshot(path='fd_1.png')
        pg.evaluate("AR.field.t0=performance.now()-AR.field.pauseAt/(AR.field.rate||1);");pg.wait_for_timeout(150)
        print('phase',pg.evaluate("AR.phase"));pg.screenshot(path='fd_2.png')
        pg.click('[data-act="arDecide"][data-v="1"]');pg.wait_for_timeout(100)
        print('phase',pg.evaluate("AR.phase"),pg.evaluate("[AR.field.T,AR.field.rate,AR.ev.runText]"))
        T=pg.evaluate("AR.field.T");pa=pg.evaluate("AR.field.ev&&AR.field.ev.play?JSON.stringify(AR.field.ev.play.runners):''");print(pa)
        for i in range(4):
            t=found['pause']+(T-found['pause'])*(i+1)/4
            pg.evaluate(f"AR.field.t0=performance.now()-{t}/(AR.field.rate||1);");pg.wait_for_timeout(80);pg.screenshot(path=f'fd_{3+i}.png')
    print('ERRORS',errs)
    b.close()
