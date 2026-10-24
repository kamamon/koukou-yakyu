import os,sys
from playwright.sync_api import sync_playwright
from PIL import Image
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/viewer.html'))
URL=os.environ.get('URL','file://'+HTML)
errs=[]
CUSTOM=os.environ.get('CUSTOM','')
presets=sys.argv[1].split(',') if len(sys.argv)>1 else ['pitcher','pitcherFace','batter','catcher','fielder','batCam','cfCam','wide','roof','alps','board']
W,H=int(os.environ.get('W','900')),int(os.environ.get('H','700'))
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=1);pg=ctx.new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)));pg.on('console',lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
    pg.goto(URL);pg.wait_for_timeout(3000);pg.evaluate('VW.paused=true');pg.wait_for_timeout(1500)
    for i in range(40):
        if pg.evaluate('!!(window.GL&&(GL.ready||GL.failed))'):break
        pg.wait_for_timeout(500)
    print('GL',pg.evaluate('[!!GL.ready,!!GL.failed,R3.batter.constructor.name]'))
    rect=pg.evaluate("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
    for k in presets:
        extra=os.environ.get('EXTRA','')
        pg.evaluate(f"vwPreset('{k}');VW.anim='idle';{extra};{CUSTOM};vwRender(performance.now())")
        pg.wait_for_timeout(600)
        pg.screenshot(path=f'vw_{k}.png',clip={'x':rect[0],'y':rect[1],'width':rect[2],'height':rect[3]})
    print('ERRORS',errs[:6])
    b.close()
ims=[Image.open(f'vw_{k}.png') for k in presets]
w,h=ims[0].size;cols=3;rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(w*cols,h*rows));[sh.paste(im,((i%cols)*w,(i//cols)*h)) for i,im in enumerate(ims)];sh.save('vw_sheet.png');print(sh.size)
