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
    pg.wait_for_timeout(1500)
    print(pg.evaluate("""(()=>{const out=[];const cp=R3.cam.position;R3.scene.traverse(o=>{if(!o.isMesh||!o.visible)return;let v=true;for(let q=o;q;q=q.parent){if(q.visible===false){v=false;break;}}if(!v)return;const wp=new THREE.Vector3();o.getWorldPosition(wp);const d=wp.distanceTo(cp);if(d<3){let root=o;while(root.parent&&root.parent!==R3.scene)root=root.parent;out.push([o.geometry.type,o.material&&o.material.type,d.toFixed(2),root.position.toArray().map(v=>+v.toFixed(2)),root.visible,o.isSkinnedMesh?'skinned':'']);}});return out;})()"""))
    print('cam',pg.evaluate("[R3.cam.position.toArray(),R3.camLook&&R3.camLook.toArray(),actionSettings().cam3d,actionSettings().model3d]"))
    b.close()
