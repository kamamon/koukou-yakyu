import os,sys
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
want=sys.argv[1] if len(sys.argv)>1 else 'GO'
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
    # 条件に合うインプレーを探す（状態は変わるが演出確認用）
    found=pg.evaluate("""(want)=>{const m=AR.m;AR.phase='pre';for(let g=0;g<400;g++){if(!m.pa||m.pa.done){if(m.done)return null;m.paStart();}
      if(m.pa.cmd==='ibb'){m.paIbb();continue;}
      // 走者を作るため、たまに四球扱いで埋める
      const P=m.throwPitch(null);const sw=m.cpuSwingInput(P);const ev=m.resolvePitch(P,sw);
      if(ev.kind==='inplay'){const ok=(want==='any')||(want==='run'?(ev.play&&ev.play.runners.length>0&&['1B','2B','GO','FO'].includes(ev.bb.res)):ev.bb.res===want&&(want!=='GO'||true));
        if(ok){AR.side=m.userBatting()?'bat':'pit';arShowResult(ev);return {res:ev.bb.res,T:AR.field.T,play:ev.play,pause:AR.field.pauseAt};}}
      if(ev.halfEnd&&m.done)return null;}
      return null;}""",want)
    print('found',found and {k:found[k] for k in ('res','T','pause')})
    if found:
        T=found['T'];n=6
        for i in range(n+1):
            t=T*i/n
            pg.evaluate(f"AR.field.t0=performance.now()-{t};")
            pg.wait_for_timeout(60)
            pg.screenshot(path=f'f_{want}_{i}.png')
        print(found['play'])
    print('ERRORS',errs)
    b.close()
