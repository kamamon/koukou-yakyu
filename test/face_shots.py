"""写真から作った顔（試作）の見え方を、今の顔と並べて撮る（dist/ をローカルサーバーで配信して実行）"""
import os, sys
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
URL = os.environ.get('URL', 'http://localhost:8765/viewer.html')
W, H = int(os.environ.get('W', '560')), int(os.environ.get('H', '640'))
shots = [('faceUp', 0, 0.0), ('faceUp', 1900, -0.6), ('pitcherFace', 1000, 0.45)]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': W, 'height': H + 260}, device_scale_factor=1)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(2500); pg.evaluate('VW.paused=true')
    for i in range(60):
        if pg.evaluate('!!(window.GL&&(GL.ready||GL.failed))'): break
        pg.wait_for_timeout(500)
    print('GL', pg.evaluate('[!!GL.ready,!!GL.failed]'))
    rect = pg.evaluate("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
    files = []
    for face in ('paint', 'photo'):
        for k, t, yaw in shots:
            pg.evaluate(f"vwSet('face','{face}');vwPreset('{k}');VW.yaw={yaw};VW.t0=0;vwRender({t})")
            for i in range(40):
                if face == 'paint' or pg.evaluate("!!(VW_FACE.face1&&VW_FACE.face1.ready)"): break
                pg.wait_for_timeout(250)
            pg.wait_for_timeout(300); pg.evaluate(f"vwRender({t});vwRender({t})"); pg.wait_for_timeout(400)
            fn = f'face_{face}_{k}_{t}.png'; pg.screenshot(path=fn, clip={'x': rect[0], 'y': rect[1], 'width': rect[2], 'height': rect[3]}); files.append(fn)
    print('ERRORS', errs[:6])
    b.close()
ims = [Image.open(f) for f in files]; w, h = ims[0].size; n = len(shots)
sh = Image.new('RGB', (w * n, h * 2 + 40), 'white'); d = ImageDraw.Draw(sh)
try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 22)
except Exception: font = None
for i, im in enumerate(ims): sh.paste(im, ((i % n) * w, (i // n) * (h + 20) + 20))
d.text((8, 0), '今の顔（手描きテクスチャ）', fill='black', font=font); d.text((8, h + 20), '写真から作った顔（試作）', fill='black', font=font)
sh.save('face_compare.png'); print(sh.size)
