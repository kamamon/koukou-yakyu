"""Browser regression on Chromium software WebGL. Not a physical-device benchmark."""
import json,os,pathlib,statistics,time
from playwright.sync_api import sync_playwright

URL=os.environ.get('URL','http://127.0.0.1:8765/')
OUT=pathlib.Path(os.environ.get('OUT','dist/v29-browser'))
OUT.mkdir(parents=True,exist_ok=True)
errors=[]
report={}
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    for name,viewport,dpr in [('desktop',{'width':1280,'height':720},1),('mobile-viewport',{'width':390,'height':844},2)]:
        pg=browser.new_page(viewport=viewport,device_scale_factor=dpr)
        pg.add_init_script('window.__crowdN=150')
        pg.route('**/*',lambda r:r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e:errors.append(str(e)))
        pg.goto(URL)
        pg.check('input[name=suMode][value=custom]')
        pg.click('[data-act="startGame"]')
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'テスト高校',strength:58,pref:'神奈川'}});render();")
        pg.select_option('#modeSel','action')
        pg.click('[data-act="lineupSave"]')
        pg.wait_for_function("AR.el && !AR.el.hidden && AR.m")
        pg.wait_for_function("window.V29Runtime && V29Runtime.report().rigs.some(r=>r.bones===83)",timeout=90000)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=str(OUT/(name+'-game.png')))
        stats=pg.evaluate("""async()=>{const times=[];let last=performance.now();for(let i=0;i<45;i++)await new Promise(r=>requestAnimationFrame(t=>{times.push(t-last);last=t;r();}));const q=V29Runtime.report();return {rig:q.rigs,times,report:q.timing,ua:navigator.userAgent,renderer:typeof R3!=='undefined'&&R3.renderer?R3.renderer.info.render:null};}""")
        stats['median_ms']=statistics.median(stats['times'])
        stats['fps_median']=1000/max(.001,stats['median_ms'])
        # Finish a complete match in the real browser engine; controlled CPU mode.
        result=pg.evaluate("""()=>{const m=new Match(cpuRoster('A',55,'神奈川'),cpuRoster('B',55,'神奈川'),{mercy:true,importance:1});m.autoUntil='end';let n=0;while(!m.done&&n++<3000)m.step();return {done:m.done,score:m.score,steps:n};}""")
        assert result['done'],result
        report[name]={'metrics':stats,'complete_match':result}
        pg.close()
    browser.close()
report['page_errors']=errors
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
assert not errors,errors
