"""選手モデルの細部（帽子・ヘルメット・顔・服）を色々な角度から撮って並べる。dist/ をローカルサーバーで配信して実行
 使い方: python3 model_shots.py [出力名] [ビュー名,...]"""
import os, sys, math
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
URL = os.environ.get('URL', 'http://localhost:8765/viewer.html')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'model_sheet.png'
PZ = -18.44 + 0.15  # 投手の位置
VIEWS = {  # 名前: (注視点, 距離, yaw, pitch, 動き)
 'capFront': ((0, 1.66, PZ + 0.03), 0.62, 0.0, 0.04, 'face'),
 'cap34': ((0, 1.66, PZ + 0.0), 0.62, 0.75, 0.06, 'face'),
 'capSide': ((0, 1.66, PZ), 0.62, math.pi / 2, 0.03, 'face'),
 'capBack34': ((0, 1.66, PZ), 0.62, 2.35, 0.08, 'face'),
 'capBack': ((0, 1.64, PZ), 0.62, math.pi, 0.05, 'face'),
 'capTop': ((0, 1.66, PZ), 0.7, 0.5, 0.85, 'face'),
 'capLow': ((0, 1.62, PZ + 0.05), 0.55, 0.35, -0.22, 'face'),
 'helmFront': ((-0.86, 1.55, 0.1), 0.75, math.pi, 0.05, 'idle'),
 'helmSide': ((-0.86, 1.55, 0.1), 0.75, math.pi / 2, 0.05, 'idle'),
 'helmBack': ((-0.86, 1.55, 0.1), 0.75, -math.pi / 2 - 0.4, 0.1, 'idle'),
 'catcher': ((0, 0.95, 1.6), 1.3, math.pi - 0.3, 0.12, 'idle'),
 'pitcherBody': ((0, 1.0, PZ), 2.6, 0.45, 0.1, 'face'),
 'helmClose': ((-0.86, 1.6, 0.1), 0.5, math.pi / 2 + 0.5, 0.05, 'idle'),
 'helmClose2': ((-0.86, 1.6, 0.1), 0.5, math.pi - 0.2, 0.0, 'idle'),
 'helmLow': ((-0.86, 1.55, 0.1), 0.55, math.pi / 2 + 0.2, -0.35, 'idle'),
 'maskFront': ((0, 0.95, 1.6), 0.7, math.pi, 0.08, 'idle'),
 'catcherBody': ((0, 0.6, 1.6), 1.9, math.pi - 0.5, 0.15, 'idle'),
 'catcherBack': ((0, 0.8, 1.6), 1.5, 0.3, 0.2, 'idle'),
 'chest': ((0, 1.35, PZ + 0.05), 0.55, 0.3, 0.05, 'face'),
 'firstFace': ((19, 1.45, -21.9), 0.7, -1.2, 0.05, 'idle'),
 'helmBackClose': ((-0.86, 1.6, 0.1), 0.45, -math.pi / 2 - 0.9, 0.05, 'idle'),
 'helmBackLow': ((-0.86, 1.55, 0.1), 0.5, -math.pi / 2 - 1.3, -0.25, 'idle'),
 'batView': ((0, 1.0, -6), 8.5, 0.0, 0.08, 'idle'),
 'cfView': ((0, 1.2, -10), 20, math.pi, 0.16, 'idle'),
 'catcherMid': ((0, 0.8, 1.6), 3.2, math.pi - 0.15, 0.12, 'idle'),
 'umpFront': ((0.3, 1.25, 2.4), 0.8, math.pi, 0.05, 'idle'),
}
names = sys.argv[2].split(',') if len(sys.argv) > 2 else list(VIEWS)
W, H = int(os.environ.get('W', '520')), int(os.environ.get('H', '520'))
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': W, 'height': H + 300}, device_scale_factor=1)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_timeout(2500); pg.evaluate('VW.paused=true')
    for i in range(60):
        if pg.evaluate('!!(window.GL&&(GL.ready||GL.failed))'): break
        pg.wait_for_timeout(500)
    rect = pg.evaluate("(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
    pg.evaluate(os.environ.get('SETUP', ''))
    files = []
    for k in names:
        t, d, yaw, pitch, anim = VIEWS[k]
        js = f"VW.target.set({t[0]},{t[1]},{t[2]});VW.dist={d};VW.yaw={yaw};VW.pitch={pitch};VW.anim='{anim}';VW.t0=0;vwRender(0)"
        pg.evaluate(js)
        for i in range(30):
            if pg.evaluate("!(window.VW_FACE&&VW_FACE.face1&&!VW_FACE.face1.ready)"): break
            pg.wait_for_timeout(250)
        pg.evaluate("vwRender(0);vwRender(0)"); pg.wait_for_timeout(300)
        fn = f'ms_{k}.png'; pg.screenshot(path=fn, clip={'x': rect[0], 'y': rect[1], 'width': rect[2], 'height': rect[3]}); files.append((k, fn))
    print('ERRORS', errs[:6])
    b.close()
cols = min(4, len(files)); rows = (len(files) + cols - 1) // cols
ims = [Image.open(f) for _, f in files]; w, h = ims[0].size
sh = Image.new('RGB', (w * cols, h * rows), 'white'); d = ImageDraw.Draw(sh)
for i, (im, (k, _)) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h; sh.paste(im, (x, y)); d.rectangle([x, y, x + 120, y + 22], fill='black'); d.text((x + 6, y + 4), k, fill='white')
sh.save(OUT); print(OUT, sh.size)
