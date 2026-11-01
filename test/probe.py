"""モーション確認ページで数値を読む：python3 probe.py 場面 'JS式（t を使う）' t1,t2,..."""
import sys,os,json
from playwright.sync_api import sync_playwright
scn,expr,ts=sys.argv[1],sys.argv[2],[float(x) for x in sys.argv[3].split(',')]
hand=sys.argv[4] if len(sys.argv)>4 else '右'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':320,'height':300});errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(os.environ.get('URL','http://localhost:8765/pwa/motion.html'))
    for i in range(80):
        if pg.evaluate("typeof GL!=='undefined'&&(GL.ready||GL.failed)&&typeof MV!=='undefined'&&MV.sc"):break
        pg.wait_for_timeout(250)
    pg.evaluate(f"MV.hand='{hand}';MV.play=false;MV.glDone=true;mvLoad('{scn}');")
    for t in ts:
        r=pg.evaluate(f"(()=>{{MV.t={t};const res=moFrame(MV.ctx,MV.t);const t={t};return {expr};}})()")
        print(t, json.dumps(r))
    print('errors',errs[:4]);b.close()
