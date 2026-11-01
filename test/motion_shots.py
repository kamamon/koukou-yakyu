"""モーション確認ページの静止画：場面・カメラ・時刻を指定してコマ撮り
 使い方: python3 motion_shots.py 出力.png 場面 カメラ t1,t2,... [hand=右|左] [W=480 H=420]"""
import sys,os,io,base64
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
out,scn,cam,ts=sys.argv[1],sys.argv[2],sys.argv[3],[float(x) for x in sys.argv[4].split(',')]
opt=dict(a.split('=') for a in sys.argv[5:])
W,H=int(opt.get('W',480)),int(opt.get('H',420))
URL=os.environ.get('URL','http://localhost:8765/pwa/motion.html')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':W,'height':H+230});errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(URL)
    for i in range(80):
        if pg.evaluate("typeof GL!=='undefined'&&(GL.ready||GL.failed)&&typeof MV!=='undefined'&&MV.sc"):break
        pg.wait_for_timeout(250)
    pg.wait_for_timeout(600)
    if opt.get('hand')=='左': pg.evaluate("MV.hand='左'")
    if 'form' in opt: pg.evaluate(f"MV.form='{opt['form']}'")
    pg.evaluate(f"MV.play=false;MV.glDone=true;mvLoad('{scn}');")
    if 'dist' in opt: pg.evaluate(f"MV.distOverride={opt['dist']}")
    ims=[]
    for t in ts:
        pg.evaluate(f"MV.t={t};mvCamPreset('{cam}');"+(f"MV.dist={opt['dist']};" if 'dist' in opt else '')+(f"MV.pitch={opt['pitch']};" if 'pitch' in opt else '')+"mvFrame();")
        url=pg.evaluate("R3.cv.toDataURL('image/jpeg',0.88)")
        im=Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')
        hud=pg.evaluate("document.querySelector('#hud').innerText")
        d=ImageDraw.Draw(im);d.rectangle([0,0,im.width,16],fill='black');d.text((4,2),f"t={t:.0f} "+hud.split('\n')[1][:60] if '\n' in hud else f"t={t:.0f}",fill='white')
        ims.append(im)
    cols=min(4,len(ims));rows=(len(ims)+cols-1)//cols;w,h=ims[0].size
    sheet=Image.new('RGB',(w*cols,h*rows),'white')
    for i,im in enumerate(ims):sheet.paste(im,((i%cols)*w,(i//cols)*h))
    sheet.save(out,quality=85)
    print('GL',pg.evaluate("GL.ready"),'rig',pg.evaluate("MV.rigs[MV.subj]&&MV.rigs[MV.subj].constructor.name"),'errors',errs[:6])
    b.close()
