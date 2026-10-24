import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/viewer.html'))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);pg=b.new_page(viewport={'width':600,'height':700})
    errs=[];pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('file://'+HTML);pg.wait_for_timeout(3000);pg.evaluate('VW.paused=true');pg.wait_for_timeout(1000)
    print(pg.evaluate("""(()=>{const o=[];for(const [n,r] of [['ump',R3.umps[0]],['catcher',R3.fielders['捕']],['batter',R3.batter]]){o.push([n,r.capM.visible,r.helmetM.visible,r.maskG.visible,r.gear,r.helmet,r.capM.material.color.getHexString(),r.headM.position.toArray()]);}return o;})()"""))
    print('errs',errs)
    b.close()
