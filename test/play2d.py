import os,sys,io,base64,json
from playwright.sync_api import sync_playwright
from PIL import Image
sys.argv=[sys.argv[0]]
exec(open('play_lab.py').read().split("def main():")[0])
out=os.environ.get('OUT','/tmp/p2d.jpg')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':390,'height':844});errs=[]
    pg.add_init_script('window.__crowdN=200;window.__introHold=true');pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_timeout(300)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'):pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(500)
    for i in range(60):
        st=pg.evaluate("AR.phase")
        if st=='pre':break
        if st=='intro':pg.evaluate("arPlayBall()")
        elif st=='half':pg.evaluate("arAfterBanner()")
        pg.wait_for_timeout(200)
    pg.evaluate(JS_SETUP.replace('%W%','390').replace('%H%','300'))
    pg.evaluate("cancelAnimationFrame(AR.raf);r3Stop();")
    sc=SCN[os.environ.get('S','dp643')]
    info=pg.evaluate(f"__lab.prep({json.dumps(sc,ensure_ascii=False)})")
    T=info['T'];ims=[]
    for i in range(8):
        t=T*i/7
        url=pg.evaluate(f"(()=>{{AR.cam=null;window.__sc.cut=true;fwDrawScene(window.__now0+{t},{t});return AR.cv.toDataURL('image/jpeg',0.85);}})()")
        ims.append(Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB'))
    w,h=ims[0].size;sheet=Image.new('RGB',(w*4,h*2))
    for i,im in enumerate(ims):sheet.paste(im,((i%4)*w,(i//4)*h))
    sheet.save(out,quality=85);print('T',T,'errors',errs[:5])
    b.close()
