"""プレー演出の確認用：任意の打球・走者・アウトカウントでプレーを作り、
 (1) 3D のコマ撮りシート（play_<name>_frames.jpg）と (2) 真上から見た全員の動きの図（play_<name>_map.png）を出す。
 dist/ をローカルサーバー（http://localhost:8765/）で配信して実行する。
 使い方: python3 play_lab.py [シナリオ名,...]   （シナリオは下の SCN、または環境変数 SCN_JSON にJSON）"""
import os, sys, json, base64, io, math
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

URL = os.environ.get('URL', 'http://localhost:8765/pwa/index.html')
OUTDIR = os.environ.get('OUTDIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lab'))
os.makedirs(OUTDIR, exist_ok=True)
W, H = int(os.environ.get('W', '640')), int(os.environ.get('H', '400'))
NF = int(os.environ.get('NF', '12'))
CAM = os.environ.get('CAM', 'field')  # field | high | fixed:x,y,z,lx,ly,lz,fov（フィールド座標 x=一塁側 y=センター方向 z=高さ）
# シナリオ：bases=[一塁,二塁,三塁] に走者がいるか、c=打球（engine の bb と同じ形）、choice=走塁/送球の判断
SCN = {
 'go6': {'bases': [0, 0, 0], 'outs': 0, 'c': {'type': 'ground', 'a': -18, 'dist': 34, 'ev': 115, 'la': -4, 'res': 'GO', 'fpos': '遊'}},
 'dp643': {'bases': [1, 0, 0], 'outs': 0, 'c': {'type': 'ground', 'a': -12, 'dist': 33, 'ev': 120, 'la': -4, 'res': 'GO', 'fpos': '遊'}, 'choice': {'throwTo': 2}, 'seed': 3},
 'go3_r2': {'bases': [0, 1, 0], 'outs': 1, 'c': {'type': 'ground', 'a': 30, 'dist': 28, 'ev': 105, 'la': -4, 'res': 'GO', 'fpos': '一'}},
 'single_lf_r2': {'bases': [0, 1, 0], 'outs': 1, 'c': {'type': 'ground', 'a': -25, 'dist': 62, 'ev': 135, 'la': 4, 'res': '1B', 'fpos': '遊'}, 'choice': {'send': True}},
 'double_rc_r1': {'bases': [1, 0, 0], 'outs': 0, 'c': {'type': 'line', 'a': 22, 'dist': 92, 'ev': 150, 'la': 16, 'res': '2B', 'fpos': '右'}, 'choice': {'send': True}},
 'fly_cf_tag': {'bases': [0, 0, 1], 'outs': 0, 'c': {'type': 'fly', 'a': 4, 'dist': 88, 'ev': 140, 'la': 34, 'res': 'FO', 'fpos': '中'}, 'choice': {'send': True}},
 'liner_ss': {'bases': [1, 0, 0], 'outs': 0, 'c': {'type': 'line', 'a': -12, 'dist': 38, 'ev': 140, 'la': 9, 'res': 'LO', 'fpos': '遊'}},
 'single_cf_empty': {'bases': [0, 0, 0], 'outs': 0, 'c': {'type': 'line', 'a': 2, 'dist': 70, 'ev': 140, 'la': 12, 'res': '1B', 'fpos': '中'}},
 'triple_rf': {'bases': [0, 0, 0], 'outs': 1, 'c': {'type': 'line', 'a': 40, 'dist': 98, 'ev': 155, 'la': 18, 'res': '3B', 'fpos': '右'}},
 'hr_lf': {'bases': [1, 0, 0], 'outs': 1, 'c': {'type': 'fly', 'a': -30, 'dist': 112, 'ev': 165, 'la': 30, 'res': 'HR', 'fpos': '左'}},
 'bunt_sac': {'bases': [1, 0, 0], 'outs': 0, 'c': {'type': 'bunt', 'a': -10, 'dist': 14, 'ev': 60, 'la': -5, 'res': 'SAC', 'fpos': '三', 'bunt': True}},
 'steal2': {'bases': [1, 0, 0], 'outs': 0, 'rp': {'kind': 'steal', 'from': 1, 'to': 2, 'ok': True}},
 'steal2out': {'bases': [1, 0, 0], 'outs': 0, 'rp': {'kind': 'steal', 'from': 1, 'to': 2, 'ok': False}},
 'pick1': {'bases': [1, 0, 0], 'outs': 0, 'rp': {'kind': 'pickoff', 'from': 1, 'to': 1, 'ok': True}},
 'pick1out': {'bases': [1, 0, 0], 'outs': 0, 'rp': {'kind': 'pickoff', 'from': 1, 'to': 1, 'ok': False}},
 'pick1err': {'bases': [1, 0, 0], 'outs': 0, 'rp': {'kind': 'pickoff', 'from': 1, 'to': 2, 'ok': True, 'err': True}},
 'wp_r3': {'bases': [1, 0, 1], 'outs': 0, 'rp': {'kind': 'wp', 'from': 3, 'moves': [{'from': 3, 'to': 4}, {'from': 1, 'to': 2}]}},
 'pop_2b': {'bases': [1, 1, 0], 'outs': 0, 'c': {'type': 'pop', 'a': 18, 'dist': 26, 'ev': 90, 'la': 62, 'res': 'PO', 'fpos': '二'}},
}
names = sys.argv[1].split(',') if len(sys.argv) > 1 else list(SCN)
if os.environ.get('SCN_JSON'): SCN.update(json.loads(os.environ['SCN_JSON']))

JS_SETUP = r"""
window.__lab = {
 prep(sc) {
  const m = AR.m; cancelAnimationFrame(AR.raf); AR.raf = null;
  if (sc.seed != null) { let s = sc.seed * 9301 + 49297; Math.random = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  m.askRun = false; m.askDef = false; m.autoUntil = null;
  const t = m.bat(); const others = t.lineup.map(x => x.p).filter(p => p !== m.pa.b);
  m.bases = sc.bases.map((on, i) => on ? others[i] : null); m.outs = sc.outs || 0;
  const pa = m.pa; const pt = pa.p.pit.pitches[0]; pa.pe = m.pitchingEff(pa.p, pa.b, pt); pa.be = m.battingEff(pa.b, pa.p, pt); pa.pm = pa.pm || {}; pa.bm = pa.bm || {};
  pa.runnerGo = !!sc.go; pa.cmd = sc.cmd || null; pa.done = false;
  let ev, s;
  if (sc.rp) { const rp = Object.assign({}, sc.rp); const r = m.bases[rp.from - 1] || others[0]; rp.pid = r.id; rp.name = r.name; rp.speed = m.runnerSpeed(r); if (rp.moves) rp.moves = rp.moves.map((mv, i) => { const rr = m.bases[mv.from - 1] || others[i]; return Object.assign({}, mv, { pid: rr.id, name: rr.name, speed: m.runnerSpeed(rr) }); });
   ev = { kind: rp.kind, text: rp.kind, play: rp }; s = plRunSceneSafe(rp); }
  else { ev = { kind: 'inplay', bb: Object.assign({}, sc.c) }; ev.bb.fpos = ev.bb.fpos || fielderOf(ev.bb);
  m.applyInplay(ev, sc.choice || null);
  s = (window.__legacy?fwBuildScene:plBuildSafe)(ev.bb, ev.play, {}); s.c = ev.bb; } s.ev = ev; AR.field = s; AR.ev = ev; AR.phase = 'field'; R3.lastPhase = 'field';
  window.__sc = s; window.__now0 = 100000;
  R3.renderer.setPixelRatio(1); R3.renderer.setSize(%W%, %H%, false); R3.cam.aspect = %W% / %H%; R3.cam.updateProjectionMatrix(); R3.W = %W%; R3.H = %H%;
  return { T: s.T, play: ev.play||null, text: ev.text||'' };
 },
 dump(step) {
  const s = window.__sc; const out = { T: s.T, fielders: {}, runners: [], ball: [], throws: s.throws || [], callouts: s.callouts.map(c => ({ t: c.t, text: c.text, x: c.x, y: c.y })), roles: null };
  for (const k in s.fielders) { const f = s.fielders[k]; const arr = []; for (let t = 0; t <= s.T; t += step) { const p = fwAt(f.path, t); arr.push([t, p.x, p.y, fwPoseAt(f, t)]); } out.fielders[k] = arr; }
  for (const r of s.runners) { const arr = []; for (let t = 0; t <= s.T; t += step) { const p = fwAt(r.path, t); arr.push([t, p.x, p.y]); } out.runners.push({ name: r.name, isBatter: !!r.isBatter, out: r.outAt, safe: r.safeAt, pts: arr }); }
  for (let t = 0; t <= s.T; t += step) { const b = fwAt(s.ball, t); if (b) out.ball.push([t, b.x, b.y, b.z]); }
  return out;
 },
 frame(t, cam) {
  const s = window.__sc; const now = window.__now0 + t; r3FieldScene(s, t, now);
  if (cam === 'field') r3FieldCam(s, t, true, now);
  else if (cam === 'high') { r3SetCam(r3V(0, -42, 34), r3V(0, 32, 0), 48, true); }
  else if (cam.startsWith('ent:')) { const a = cam.split(':'); const e = s.mo.ents[a[1]]; const p = plEntPos(e, t); const dist = +(a[2] || 9); const ang = a[3] != null ? +a[3] * Math.PI / 180 : Math.atan2(-p[0], -p[1]); const cx = p[0] + Math.sin(ang) * dist, cy = p[1] + Math.cos(ang) * dist; r3SetCam(r3V(cx, cy, 2.6 + dist * 0.12), r3V(p[0], p[1], 0.9), 36, true); }
  else { const v = cam.split(':')[1].split(',').map(Number); r3SetCam(r3V(v[0], v[1], v[2]), r3V(v[3], v[4], v[5]), v[6] || 40, true); }
  R3.renderer.render(R3.scene, R3.cam); return R3.cv.toDataURL('image/jpeg', 0.85);
 }
};
"""

def field_axes(ax):
    import numpy as np
    ax.set_aspect('equal'); ax.set_facecolor('#3d7a3d')
    a = np.radians(np.linspace(-45, 45, 60)); r = 100 + 20 * np.cos(np.radians(np.linspace(-45, 45, 60)) * 2)
    ax.fill(np.concatenate([[0], r * np.sin(a), [0]]), np.concatenate([[0], r * np.cos(a), [0]]), color='#4f8f4f', zorder=0)
    th = np.linspace(0, 2 * np.pi, 80); ax.fill(29 * np.cos(th), 18.4 + 29 * np.sin(th), color='#b08a5a', zorder=1, alpha=0.8)
    ax.fill([0, 16.4, 0, -16.4], [3.2, 19.4, 35.6, 19.4], color='#4f8f4f', zorder=1)
    for b in [(19.4, 19.4), (0, 38.8), (-19.4, 19.4), (0, 0)]: ax.plot(*b, 's', color='white', ms=6, zorder=3)
    ax.plot([0, 90], [0, 90], color='white', lw=0.8, zorder=2); ax.plot([0, -90], [0, 90], color='white', lw=0.8, zorder=2)

def draw_map(name, d, info):
    fig, ax = plt.subplots(figsize=(9, 9)); field_axes(ax)
    cols = {'投': '#ff4d4d', '捕': '#ffa64d', '一': '#ffff4d', '二': '#4dff88', '三': '#4dd2ff', '遊': '#b84dff', '左': '#ff4dc4', '中': '#ffffff', '右': '#8c8c8c'}
    T = d['T']
    for k, arr in d['fielders'].items():
        xs = [p[1] for p in arr]; ys = [p[2] for p in arr]
        ax.plot(xs, ys, '-', color=cols.get(k, 'w'), lw=2, zorder=5); ax.plot(xs[0], ys[0], 'o', color=cols.get(k, 'w'), ms=7, zorder=6)
        ax.text(xs[-1] + 1, ys[-1] + 1, k, color=cols.get(k, 'w'), fontsize=11, weight='bold', zorder=7, family='Noto Sans CJK JP')
        for p in arr[::20]: ax.plot(p[1], p[2], '.', color='k', ms=2, zorder=6)
    for r in d['runners']:
        xs = [p[1] for p in r['pts']]; ys = [p[2] for p in r['pts']]
        ax.plot(xs, ys, '--', color='#ffd166' if not r['isBatter'] else '#ff9f1c', lw=2, zorder=5)
        ax.plot(xs[-1], ys[-1], 'X' if r['out'] else '^', color='#ffd166', ms=9, zorder=6)
    bx = [p[1] for p in d['ball']]; by = [p[2] for p in d['ball']]
    ax.plot(bx, by, ':', color='white', lw=1.4, zorder=4)
    ax.set_xlim(-60, 60); ax.set_ylim(-10, 110)
    ax.set_title(f"{name}  T={T:.0f}ms  {info.get('text','')}", family='Noto Sans CJK JP')
    # 役割の一覧
    if d.get('roles'):
        txt = '\n'.join(f"{k}: {v}" for k, v in d['roles'].items())
        ax.text(-58, 108, txt, va='top', fontsize=9, color='white', family='Noto Sans CJK JP', bbox=dict(facecolor='black', alpha=0.5))
    fn = os.path.join(OUTDIR, f'play_{name}_map.png'); fig.savefig(fn, dpi=80, bbox_inches='tight'); plt.close(fig); return fn

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
        pg.add_init_script('window.__crowdN=600;window.__introHold=true')
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); pg.wait_for_timeout(300)
        pg.check('input[name=suMode][value=custom]'); pg.click('[data-act="startGame"]'); pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();"); pg.wait_for_timeout(100)
        pg.select_option('#modeSel', 'action'); pg.click('[data-act="lineupSave"]'); pg.wait_for_timeout(500)
        for i in range(60):
            if pg.evaluate("typeof GL!=='undefined'&&(GL.ready||GL.failed)"): break
            pg.wait_for_timeout(250)
        print('GL', pg.evaluate("[!!GL.ready,!!GL.failed]"))
        for i in range(60):
            st = pg.evaluate("AR.phase")
            if st == 'pre': break
            if st == 'intro': pg.evaluate("arPlayBall()")
            elif st == 'half': pg.evaluate("arAfterBanner()")
            pg.wait_for_timeout(200)
        pg.evaluate(JS_SETUP.replace('%W%', str(W)).replace('%H%', str(H)))
        for name in names:
            sc = SCN[name]
            info = pg.evaluate(f"__lab.prep({json.dumps(sc, ensure_ascii=False)})")
            T = info['T']; print(name, 'T', round(T), info['text'], json.dumps(info['play'], ensure_ascii=False)[:300])
            d = pg.evaluate("__lab.dump(50)"); json.dump(d, open(os.path.join(OUTDIR, f'play_{name}.json'), 'w'), ensure_ascii=False)
            draw_map(name, d, info)
            ts = [float(x) for x in os.environ['TIMES'].split(',')] if os.environ.get('TIMES') else [T * i / (NF - 1) for i in range(NF)]
            if os.environ.get('PERF'):
                print('perf', pg.evaluate("""(()=>{const s=window.__sc;const N=60;let t0=performance.now();for(let i=0;i<N;i++){r3FieldScene(s,s.T*i/N,window.__now0+s.T*i/N);}const a=(performance.now()-t0)/N;t0=performance.now();for(let i=0;i<N;i++){const t=s.T*i/N;r3FieldScene(s,t,window.__now0+t);R3.renderer.render(R3.scene,R3.cam);}const b=(performance.now()-t0)/N;return {motionMs:+a.toFixed(2),withRenderMs:+b.toFixed(2),ents:Object.keys(s.mo.ents).length};})()"""))
            if os.environ.get('DBG'):
                for t in [float(x) for x in os.environ['DBG'].split(',')]:
                    print(t, pg.evaluate(f"""(()=>{{const s=window.__sc;const t={t};__lab.frame(t,'field');const k=s.primary;const e=s.mo.ents[k];const st=moEval(e,t);const r=R3.fielders[k];const mo=moRig(r);const v=new THREE.Vector3();mo.pocket.getWorldPosition(v);const b=moBallPos(s.mo.ball,t,{{rig:kk=>kk===k?r:null,ts:s.mo.ts}});return {{k,Tc:Math.round(s.Tpick),seg:st.seg.k+':'+(st.seg.clip||st.seg.pose||''),tm:st.tm&&Math.round(st.tm),pocket:[+v.x.toFixed(2),+(-v.z).toFixed(2),+v.y.toFixed(2)],ball:b&&b.map(x=>+x.toFixed(2)),root:[+st.x.toFixed(2),+st.y.toFixed(2)]}};}})()"""))
            ims = []
            for t in ts:
                url = pg.evaluate(f"__lab.frame({t},{json.dumps(sc.get('cam', CAM))})")
                im = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')
                dr = ImageDraw.Draw(im); dr.rectangle([0, 0, 120, 20], fill='black'); dr.text((5, 4), f't={t:.0f}', fill='white'); ims.append(im)
            cols = 4; rows = (len(ims) + cols - 1) // cols
            sheet = Image.new('RGB', (W * cols, H * rows), 'white')
            for i, im in enumerate(ims): sheet.paste(im, ((i % cols) * W, (i // cols) * H))
            sheet.save(os.path.join(OUTDIR, f'play_{name}_frames.jpg'), quality=82)
        print('ERRORS', errs[:5])
        b.close()

main()
