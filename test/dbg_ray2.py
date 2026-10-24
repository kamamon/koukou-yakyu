import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1);pg=ctx.new_page()
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(250)
    for i in range(40):
        st=pg.evaluate("[AR.phase,AR.side]")
        if st[0]=='pre' and st[1]=='bat':break
        if st[0]=='half':pg.click('[data-act="arBannerNext"]')
        elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
        elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
        pg.wait_for_timeout(250)
    def wf(k=2,ms=4000):
        n0=pg.evaluate("AR.drawN||0")
        for i in range(ms//50):
            pg.wait_for_timeout(50)
            if pg.evaluate("AR.drawN||0")>=n0+k:return
    wf();pg.screenshot(path='dbg_a.png')
    pg.evaluate("for(const r of [].concat(Object.values(R3.fielders),[R3.batter],R3.runners,R3.umps))r.g.visible=false;window.__hideAll=true;");wf();pg.screenshot(path='dbg_b.png')
    pg.evaluate("R3.crowd.visible=false;R3.crowdH.visible=false;");wf();pg.screenshot(path='dbg_c.png')
    pg.evaluate("R3.crowd.visible=true;R3.crowdH.visible=true;R3.renderer.toneMapping=THREE.NoToneMapping;R3.scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});");wf();pg.screenshot(path='dbg_d.png')
    pg.evaluate("R3.scene.traverse(o=>{if(o.isSkinnedMesh)o.visible=false;});");wf();pg.screenshot(path='dbg_e.png')
    print(pg.evaluate("R3.scene.children.filter(o=>o.visible).map(o=>o.type+':'+(o.geometry?o.geometry.type:'')+':'+(o.material?o.material.type:''))"))
    b.close()
