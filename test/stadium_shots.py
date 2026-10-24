"""球場の見た目を複数カメラで撮る（ゲームのシーンを使う）"""
import os,sys
from playwright.sync_api import sync_playwright
from PIL import Image
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
DARK=len(sys.argv)>1 and sys.argv[1]=='dark'
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':800,'height':600},device_scale_factor=1,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: errs.append(str(e)))
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
    pg.wait_for_timeout(500)
    # ループを止めて手動でカメラを置く
    pg.evaluate("cancelAnimationFrame(AR.raf);AR.raf=0;window.__stop=true;")
    rect=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
    print('canvas',rect)
    shots=[('home_high',[0,28,40],[0,2,-60],50),('cf_cam',[0.9,4.3,-29.5],[-0.1,0.55,9],23),('alps_1b',[60,18,-20],[0,1,-20],55),('outfield_in',[20,3,-100],[0,8,20],60),('roof',[-30,12,20],[0,10,-5],60),('board',[0,6,-80],[0,16,-135],40)]
    for name,pos,look,fov in shots:
        pg.evaluate(f"""(()=>{{R3.cam.position.set({pos[0]},{pos[1]},{pos[2]});R3.cam.lookAt({look[0]},{look[1]},{look[2]});R3.cam.fov={fov};R3.cam.updateProjectionMatrix();R3.cam.updateMatrixWorld();R3.renderer.render(R3.scene,R3.cam);}})()""")
        pg.wait_for_timeout(400)
        pg.screenshot(path=f'st_{name}{"_d" if DARK else ""}.png',clip={'x':rect[0],'y':rect[1],'width':rect[2],'height':rect[3]})
    print('ERRORS',errs[:5])
    b.close()
sfx='_d' if DARK else ''
ims=[Image.open(f'st_{n}{sfx}.png') for n in ['home_high','cf_cam','alps_1b','outfield_in','roof','board']]
w,h=ims[0].size
sh=Image.new('RGB',(w*3,h*2));[sh.paste(im,((i%3)*w,(i//3)*h)) for i,im in enumerate(ims)];sh.save(f'st_sheet{sfx}.png');print(sh.size)
