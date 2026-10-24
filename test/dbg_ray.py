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
    wf()
    print(pg.evaluate("""(()=>{const rc=new THREE.Raycaster();const out=[];for(const [px,py] of [[0.5,0.9],[0.2,0.85],[0.8,0.85],[0.5,0.97]]){const nd=new THREE.Vector2(px*2-1,1-py*2);rc.setFromCamera(nd,R3.cam);const hits=rc.intersectObjects(R3.scene.children,true).filter(h=>{let v=true;for(let q=h.object;q;q=q.parent){if(q.visible===false){v=false;break;}}return v;});const h=hits[0];if(!h){out.push([px,py,'none']);continue;}let root=h.object;while(root.parent&&root.parent!==R3.scene)root=root.parent;out.push([px,py,h.object.type,h.object.geometry.type,h.object.material&&h.object.material.type,h.distance.toFixed(2),root.type,root.position.toArray().map(v=>+v.toFixed(2)),h.object.name,h.instanceId]);}return out;})()"""))
    b.close()
