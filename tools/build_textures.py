"""選手モデルのテクスチャを生成する（build_player.py の中間データ tools/out/model.npz を使う）
 出力（assets/）：
  skin.png      肌（日焼け・坊主頭・眉・唇・鼻孔・口の中・目の縁・靴と靴下・陰影）
  hand_mask.png 手の領域（バッティンググローブ用）
  uni_mask.png  R=ジャージ G=ズボン B=ベルト
  uni_layers.png R=襟・袖口・裾の縁取り G=前立て（1.0=ボタン） B=ピンストライプ
  uni_zones.png  R=ラグラン領域 G=胸バンド領域 B=袖口帯(0.5)・ズボンのサイドライン(1.0)
  uni_shade.png  服の陰影（乗算）
  uni_normal.png 服のしわの法線マップ
  uni_dirt.png   汚れ（ひざ・腰・ひじ・胸）
実行: python3 tools/build_textures.py"""
import os, sys, math, numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *
ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, 'assets'); TMP = os.path.join(HERE, 'out')
D = np.load(os.path.join(TMP, 'model.npz'), allow_pickle=True)
V = D['V']; VT = D['VT']; N = D['N']; wi = D['wi']; ww = D['ww']; wfull = D['wfull']; dom = D['dom']
body_tris = D['body_tris_all']; body_tt = D['body_tt_all']; tight_tris = D['tight_tris']; tight_tt = D['tight_tt']
pos = {j: D['pos'][i] for i, j in enumerate(JOINTS)}
ext = {k: D['extra'][i] for i, k in enumerate(['headTop', 'lEye', 'rEye', 'lFingerTip', 'rFingerTip', 'lToe', 'rToe'])}
nv = len(V)
T = lambda *p: os.path.join(MH, 'targets', *p)
rng = np.random.RandomState(3)

# ---------- 補助：頂点集合（表情ターゲットなどから） ----------
def target_verts(path, frac=0.0):
    idx, d = load_target(path)
    if frac <= 0: return set(idx.tolist())
    m = np.linalg.norm(d, axis=1); keep = m >= m.max() * frac
    return set(idx[keep].tolist())
E = lambda n: T('expression', 'asian', n + '.target')
brow0 = target_verts(E('eyebrows-left-up'), 0.45) | target_verts(E('eyebrows-right-up'), 0.45)
lips0 = target_verts(E('mouth-eversion'), 0.45)
lid_set = target_verts(E('eye-left-closure'), 0.05) | target_verts(E('eye-right-closure'), 0.05)
lipV = V[list(lips0)]; mouth_y = lipV[:, 1].mean(); mouth_z = lipV[:, 2].max()
lips = {i for i in lips0 if abs(V[i, 1] - mouth_y) < 0.014}
# 体メッシュの境界辺（目の穴の縁＝まつ毛の線）
from collections import Counter
ec = Counter()
for t in body_tris:
    for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        ec[(min(a, b), max(a, b))] += 1
boundary = set()
for (a, b), c in ec.items():
    if c == 1: boundary.add(a); boundary.add(b)
eyeC = (ext['lEye'] + ext['rEye']) / 2
lash = {i for i in boundary if np.linalg.norm(V[i] - eyeC) < 0.06}
brow = {i for i in brow0 if V[i, 1] > eyeC[1] + 0.012 and V[i, 1] < eyeC[1] + 0.04}
# 頭皮：hair helper の近く
hair_idx = sorted(set(i for vi in D['body_tris_all'].tolist() for i in vi))  # placeholder (body)
# hair helper は model.npz に入れていないので、頭頂の高さと形で近似：目の高さより上で後頭部〜頭頂
headTop = ext['headTop'][1]; eyeY = eyeC[1]
# 近傍（AO/キャビティ用）
adj = [[] for _ in range(nv)]
for t in np.concatenate([body_tris, tight_tris]):
    for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        adj[a].append(b); adj[b].append(a)
cav = np.zeros(nv)
for i in range(nv):
    if adj[i]:
        m = V[adj[i]].mean(0) - V[i]
        cav[i] = np.dot(N[i], m)  # 正=凹
cav = np.clip(cav / 0.004, -1, 1)

# ---------- ラスタライザ：UV 三角形 → 属性画像 ----------
def rasterize(tris, tt, size, attrs, VTs=None, wrap=False):
    """attrs: dict name -> per-vertex array (nv×k)。戻り: dict name -> image array (size×size×k), mask。wrap=True なら u>1 を折り返す"""
    W = size * 2 if wrap else size
    out = {k: np.zeros((size, W, (a.shape[1] if a.ndim > 1 else 1)), dtype=np.float32) for k, a in attrs.items()}
    mask = np.zeros((size, W), dtype=bool)
    uv = (VT if VTs is None else VTs).copy(); uv[:, 1] = 1 - uv[:, 1]; uv *= size
    for f in range(len(tris)):
        tv = tris[f]; ti = tt[f]
        if (ti < 0).any(): continue
        p = uv[ti]  # 3×2
        x0 = int(max(0, math.floor(p[:, 0].min()) - 1)); x1 = int(min(W - 1, math.ceil(p[:, 0].max()) + 1))
        y0 = int(max(0, math.floor(p[:, 1].min()) - 1)); y1 = int(min(size - 1, math.ceil(p[:, 1].max()) + 1))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (p[1, 0] - p[0, 0]) * (p[2, 1] - p[0, 1]) - (p[2, 0] - p[0, 0]) * (p[1, 1] - p[0, 1])
        if abs(d) < 1e-9: continue
        l1 = ((p[1, 0] - p[0, 0]) * (ys - p[0, 1]) - (p[1, 1] - p[0, 1]) * (xs - p[0, 0])) / d  # weight for v2
        l2 = ((xs - p[0, 0]) * (p[2, 1] - p[0, 1]) - (ys - p[0, 1]) * (p[2, 0] - p[0, 0])) / d  # weight for v1
        l0 = 1 - l1 - l2
        eps = -0.02  # 少し膨らませて継ぎ目を埋める
        inside = (l0 >= eps) & (l1 >= eps) & (l2 >= eps)
        if not inside.any(): continue
        yy, xx = np.nonzero(inside)
        yy = yy + y0; xx = xx + x0
        w0 = l0[inside]; w1 = l2[inside]; w2 = l1[inside]
        for k, a in attrs.items():
            av = a[tv]
            val = w0[:, None] * av[0] + w1[:, None] * av[1] + w2[:, None] * av[2] if a.ndim > 1 else (w0 * av[0] + w1 * av[1] + w2 * av[2])[:, None]
            out[k][yy, xx] = val
        mask[yy, xx] = True
    if wrap:  # 右半分（u>1）を左へ折り返す
        for k in out:
            right = out[k][:, size:]; m2 = mask[:, size:]
            out[k][:, :size][m2] = right[m2]; out[k] = out[k][:, :size]
        mask[:, :size] |= mask[:, size:]; mask = mask[:, :size]
    return out, mask

def dilate(img, mask, r=3):
    """マスク外の画素を近傍の値で埋める（継ぎ目のにじみ対策）"""
    from scipy import ndimage
    idx = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
    return img[idx[0], idx[1]]

def noise2d(size, scale, seed):
    """滑らかなノイズ（複数オクターブ）"""
    r = np.random.RandomState(seed)
    acc = np.zeros((size, size)); amp = 1; total = 0; s = scale
    while s >= 2:
        n = r.rand(size // s + 2, size // s + 2)
        img = Image.fromarray((n * 255).astype(np.uint8)).resize((size + 2 * s, size + 2 * s), Image.BICUBIC)
        acc += np.asarray(img, dtype=np.float32)[s:s + size, s:s + size] / 255 * amp
        total += amp; amp *= 0.5; s //= 2
    return acc / total

_NT = np.random.RandomState(12345).rand(1 << 20).astype(np.float32)
def noise3(P, cell, seed=0):
    """3次元の値ノイズ（UV の継ぎ目をまたいでも連続）。P: (...,3) メートル、cell: 格子の間隔（m）"""
    X = P / cell + seed * 17.13; I = np.floor(X).astype(np.int64); F = (X - I).astype(np.float32); F = F * F * (3 - 2 * F)
    def h(dx, dy, dz):
        return _NT[((I[..., 0] + dx) * 73856093 ^ (I[..., 1] + dy) * 19349663 ^ (I[..., 2] + dz) * 83492791 ^ seed * 2654435761) & ((1 << 20) - 1)]
    fx, fy, fz = F[..., 0], F[..., 1], F[..., 2]
    x00 = h(0, 0, 0) * (1 - fx) + h(1, 0, 0) * fx; x10 = h(0, 1, 0) * (1 - fx) + h(1, 1, 0) * fx
    x01 = h(0, 0, 1) * (1 - fx) + h(1, 0, 1) * fx; x11 = h(0, 1, 1) * (1 - fx) + h(1, 1, 1) * fx
    return (x00 * (1 - fy) + x10 * fy) * (1 - fz) + (x01 * (1 - fy) + x11 * fy) * fz

def fbm3(P, cell, octaves=4, seed=0):
    acc = 0; amp = 1; tot = 0
    for k in range(octaves):
        acc = acc + amp * noise3(P, cell / (2 ** k), seed + k); tot += amp; amp *= 0.5
    return acc / tot

def save(name, arr, size=None, q=92):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if size: im = im.resize((size, size), Image.LANCZOS)
    if name.endswith('.jpg'): im.save(os.path.join(OUT, name), quality=q, subsampling=0)
    else: im.save(os.path.join(OUT, name))
    print('saved', name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')

# ============ 肌 ============
S = 2048
joint_id = dom.astype(np.float32)
flags = np.zeros((nv, 8), dtype=np.float32)  # 0 brow 1 lips 2 lash 3 mouthIn 4 scalp 5 hand 6 shoe 7 sock
for i in brow: flags[i, 0] = 1
for i in lips: flags[i, 1] = 1
for i in lash: flags[i, 2] = 1
for i in range(nv):
    y, z = V[i, 1], V[i, 2]
    pass
    # 頭皮：目の高さ+6cm より上、または後頭部（z が目より 7cm 以上後ろ）
    headCy = eyeY + 0.03
    if JOINTS[int(dom[i])] == 'head' and y > headCy - 0.02:
        r = np.linalg.norm(V[i] - [0, headCy, eyeC[2] - 0.085])
        if y > eyeY + 0.065 or (V[i, 2] < eyeC[2] - 0.11 and y > eyeY - 0.02): flags[i, 4] = 1
    j = JOINTS[int(dom[i])]
    if j in ('rHand', 'lHand'): flags[i, 5] = 1
    if j in ('rFoot', 'lFoot'):
        flags[i, 6] = 1
    if j in ('rKnee', 'lKnee', 'rFoot', 'lFoot') and y < 0.075 and y > 0.0: flags[i, 7] = 1
# 口の中：口を開けた（雄叫びの）形を正面から描いたとき見える三角形のうち、閉じた形では唇の奥に隠れているもの
_mn = list(D['morph_names']); Vo = V + D['morphs'][_mn.index('shout')]
def zbuf_tris(Vs, tris, box, ppm):
    x0, x1, y0, y1 = box; W = int((x1 - x0) * ppm); H = int((y1 - y0) * ppm)
    zb = np.full((H, W), -np.inf); tid = np.full((H, W), -1, np.int64)
    sx = (Vs[:, 0] - x0) * ppm; sy = (y1 - Vs[:, 1]) * ppm
    for f, tv in enumerate(tris):
        X = sx[tv]; Y = sy[tv]; Z = Vs[tv, 2]
        if X.max() < 0 or X.min() > W or Y.max() < 0 or Y.min() > H: continue
        a0 = int(max(0, math.floor(X.min()))); a1 = int(min(W - 1, math.ceil(X.max()))); b0 = int(max(0, math.floor(Y.min()))); b1 = int(min(H - 1, math.ceil(Y.max())))
        if a1 < a0 or b1 < b0: continue
        d = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0])
        if abs(d) < 1e-12: continue
        xs, ys = np.meshgrid(np.arange(a0, a1 + 1) + 0.5, np.arange(b0, b1 + 1) + 0.5)
        l1 = ((xs - X[0]) * (Y[2] - Y[0]) - (ys - Y[0]) * (X[2] - X[0])) / d; l2 = ((X[1] - X[0]) * (ys - Y[0]) - (Y[1] - Y[0]) * (xs - X[0])) / d; l0 = 1 - l1 - l2
        ins = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
        if not ins.any(): continue
        z = l0 * Z[0] + l1 * Z[1] + l2 * Z[2]; yy, xx = np.nonzero(ins); yy += b0; xx += a0; zz = z[ins]
        c = zz > zb[yy, xx]; zb[yy[c], xx[c]] = zz[c]; tid[yy[c], xx[c]] = f
    return zb, tid
print('mouth_y - eyeY = %.4f' % (mouth_y - eyeY))
mbox = (-0.05, 0.05, eyeY - 0.13, eyeY - 0.03); MPPM = 5000
_bt = D['body_tris']
mt = _bt[((np.abs(V[_bt][:, :, 0]) < 0.07) & (V[_bt][:, :, 1] > eyeY - 0.15) & (V[_bt][:, :, 1] < eyeY - 0.01) & (V[_bt][:, :, 2] > 0.0)).all(1)]
zb_o, tid_o = zbuf_tris(Vo, mt, mbox, MPPM); zb_n, _ = zbuf_tris(V, mt, mbox, MPPM)
vis_t = np.unique(tid_o[tid_o >= 0])
cn = V[mt[vis_t]].mean(1); px_ = ((cn[:, 0] - mbox[0]) * MPPM).astype(int); py_ = ((mbox[3] - cn[:, 1]) * MPPM).astype(int)
okp = (px_ >= 0) & (px_ < zb_n.shape[1]) & (py_ >= 0) & (py_ < zb_n.shape[0])
hidden = np.zeros(len(vis_t), bool); hidden[okp] = cn[okp, 2] < zb_n[py_[okp], px_[okp]] - 0.0015
seed_t = set()
for f in vis_t[hidden]:
    for i in mt[f]: flags[i, 3] = 1
# UV の島（同じ UV 頂点を共有する三角形のつながり）ごと口腔とみなす
_btt = D['body_tt']; _bt2 = D['body_tris']
from collections import defaultdict
uv2t = defaultdict(list)
for f, t3 in enumerate(_btt):
    for q in t3: uv2t[int(q)].append(f)
seed = set()
for f, t3 in enumerate(_bt2):
    uvc = VT[_btt[f]].mean(0)
    if all(flags[int(i), 3] for i in t3) and 0.72 < uvc[0] < 0.97 and (1 - uvc[1]) > 0.82: seed.add(f)
isl = set(); stack = list(seed)
while stack:
    f = stack.pop()
    if f in isl: continue
    isl.add(f)
    for q in _btt[f]:
        for g in uv2t[int(q)]:
            if g not in isl: stack.append(g)
# 島が大きすぎる（顔の島につながっている）ときは広げない
if 0 < len(isl) < 1500:
    for f in isl:
        for i in _bt2[f]: flags[int(i), 3] = 1
print('mouth interior verts', int(flags[:, 3].sum()), 'island tris', len(isl))

exposed = np.ones(nv, dtype=np.float32)  # 日焼け（露出部）1 / 服の下 0
cov = D['cov']
for i in range(nv):
    exposed[i] = 0 if cov[i] else 1
attrs = {'pos': V.astype(np.float32), 'nrm': N.astype(np.float32), 'flags': flags, 'cav': cav.astype(np.float32), 'exp': exposed}
print('rasterizing skin...')
R, M = rasterize(body_tris, body_tt, S, attrs)
P = dilate(R['pos'], M); FL = dilate(R['flags'], M); CV = dilate(R['cav'], M)[..., 0]; EX = dilate(R['exp'], M)[..., 0]; NR = dilate(R['nrm'], M)
# 肌の色：露出部は日焼けで赤黒く、服の下は明るい
base_light = np.array([236, 196, 166], dtype=np.float32); base_tan = np.array([205, 150, 112], dtype=np.float32)
img = base_light[None, None, :] * (1 - EX[..., None]) + base_tan[None, None, :] * EX[..., None]
# 日焼けの境界をぼかす
img = np.asarray(Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), dtype=np.float32)
# 低周波の色むら・毛穴
n1 = fbm3(P, 0.09, 3, 1); n2 = fbm3(P, 0.0035, 2, 2)
img *= (0.94 + 0.12 * n1)[..., None]
img *= (0.95 + 0.1 * n2)[..., None]
# 赤み：頬・鼻・耳・肘・ひざ・指
red = np.zeros((S, S), dtype=np.float32)
pz = P[..., 2]; py = P[..., 1]; px = P[..., 0]
cheek = np.exp(-(((np.abs(px) - 0.055) / 0.03) ** 2 + ((py - (eyeY - 0.055)) / 0.035) ** 2)) * (pz > eyeC[2] - 0.06)
nose = np.exp(-((px / 0.018) ** 2 + ((py - (eyeY - 0.035)) / 0.03) ** 2)) * (pz > eyeC[2])
red += 0.5 * cheek + 0.35 * nose
img[..., 0] += 22 * red; img[..., 1] -= 10 * red; img[..., 2] -= 12 * red
# くぼみ（キャビティ）を暗く
img *= (1 - 0.22 * np.clip(CV, 0, 1))[..., None]
# 坊主頭（3mm くらい）：生え際の高さを方位ごとに決め、その上を短い毛で覆う。耳と付け根のまわりは肌
import gear as GEAR
hairC = GEAR.C
def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
HL = np.array([[0, 0.074], [22, 0.071], [38, 0.063], [52, 0.046], [62, 0.024], [70, -0.004], [78, -0.016], [86, -0.018], [96, -0.03], [108, -0.046], [125, -0.066], [150, -0.079], [180, -0.086]])
def hairline(th):
    a = np.degrees(np.abs((th + np.pi) % (2 * np.pi) - np.pi))
    return eyeY + np.interp(a, HL[:, 0], HL[:, 1])
th_t = np.arctan2(px - hairC[0], pz - hairC[2])
headreg = (py > eyeY - 0.13) & (np.hypot(px - hairC[0], pz - hairC[2]) < 0.16) & (py > eyeY - 0.095 - 0.0 * px)
jit = (fbm3(P, 0.006, 2, 21) - 0.5) * 0.004
hl = hairline(th_t)
dens = smoothstep(hl - 0.0025, hl + 0.0045, py + jit) * headreg
# 前の生え際は少し薄く
front = np.cos(th_t) > 0.5
dens *= np.where(front, 0.55 + 0.45 * smoothstep(hl, hl + 0.01, py), 1.0)
# 耳（耳介）と付け根のまわり 4mm は毛なし
ear_ids = set()
for side in 'lr':
    ii, dd = load_target(T('ears', side + '-ear-wing-incr.target')); mm = np.linalg.norm(dd, axis=1); ear_ids |= set(ii[mm >= mm.max() * 0.1].tolist())
earflag = np.zeros(nv, np.float32); earflag[list(ear_ids)] = 1
RE, _ = rasterize(body_tris, body_tt, S, {'ear': earflag}); EAR = dilate(RE['ear'], M)[..., 0]
from scipy import ndimage as _nd
earm = _nd.binary_dilation(EAR > 0.5, iterations=7)
earm = np.asarray(Image.fromarray((earm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float32) / 255
dens *= (1 - earm)
# うなじの下（首）と顔には生えない（念のため）
dens *= smoothstep(eyeY - 0.11, eyeY - 0.095, py)
stub = noise3(P, 0.00055, 31)
hairk = np.clip(dens * (0.5 + 0.42 * smoothstep(0.25, 0.75, stub) + 0.08 * fbm3(P, 0.02, 2, 33)), 0, 0.92)
hair_col = np.array([34, 30, 31], dtype=np.float32)
img = img * (1 - hairk[..., None]) + hair_col[None, None, :] * hairk[..., None]
np.save(os.path.join(TMP, 'hair_mask.npy'), np.clip(dens, 0, 1).astype(np.float16))
# 眉：眉頭が太く眉尻へ細くなる弓形。毛流れに沿った筋で描く（正面の向きの面だけ）
ax_ = np.abs(px); q = (ax_ - 0.0115) / (0.063 - 0.0115)
ycen = eyeY + 0.0185 + 0.0085 * np.sin(np.clip(q, 0, 1) * np.pi * 0.86)
hw = 0.0040 * (1 - 0.5 * np.clip(q, 0, 1)) + 0.0004
dy = (py - ycen) / hw
band = np.exp(-np.abs(dy) ** 3.0)
ends = smoothstep(-0.08, 0.06, q) * (1 - smoothstep(0.9, 1.04, q))
facing = smoothstep(0.15, 0.4, NR[..., 2]) * (pz > eyeC[2] - 0.04) * (ax_ < 0.075)
Ps = np.stack([px / 0.004, py / 0.00075, pz / 0.004], -1) * 0.001
strokes = smoothstep(0.35, 0.7, noise3(Ps, 0.001, 9))
browm = band * ends * facing
k = np.clip(browm * (0.5 + 0.45 * strokes) * 0.92, 0, 1)
bcol = np.array([36, 28, 24], dtype=np.float32)
img = img * (1 - k[..., None]) + bcol[None, None, :] * k[..., None]
# 唇
lipm = np.clip(FL[..., 1], 0, 1); lipm = np.asarray(Image.fromarray((lipm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32) / 255
lcol = np.array([186, 110, 98], dtype=np.float32)
img = img * (1 - lipm[..., None] * 0.6) + lcol[None, None, :] * (lipm[..., None] * 0.6)
# 口の中・鼻孔
inm = np.clip(FL[..., 3], 0, 1)
img = img * (1 - inm[..., None] * 0.85) + np.array([70, 26, 24], dtype=np.float32)[None, None, :] * (inm[..., None] * 0.85)
nost = np.exp(-((np.abs(px) - 0.012) / 0.006) ** 2 - ((py - (eyeY - 0.05)) / 0.006) ** 2) * (pz > eyeC[2] + 0.01) * (NR[..., 1] < -0.2)
img *= (1 - 0.7 * np.clip(nost, 0, 1))[..., None]
# 目の縁（まつ毛）と目の周りの影
lashm = np.clip(FL[..., 2], 0, 1); lashm = np.asarray(Image.fromarray((lashm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255
img *= (1 - 0.5 * lashm)[..., None]
socket = np.exp(-(((np.abs(px) - 0.031) / 0.03) ** 2 + ((py - eyeY) / 0.025) ** 2)) * (pz > eyeC[2] - 0.05)
img *= (1 - 0.08 * socket)[..., None]
# 靴下（白）と靴（黒・白い靴底）
sock = np.clip(FL[..., 7], 0, 1); shoe = np.clip(FL[..., 6], 0, 1)
img = img * (1 - sock[..., None]) + np.array([240, 240, 236], dtype=np.float32)[None, None, :] * sock[..., None]
shoe_col = np.where((py < 0.022)[..., None], np.array([236, 234, 226], dtype=np.float32), np.array([28, 28, 32], dtype=np.float32))
img = img * (1 - shoe[..., None]) + shoe_col * shoe[..., None]
img = np.where(M[..., None], img, img)  # マスク外も埋め済み
save('skin.jpg', img, q=90)
hand = np.clip(FL[..., 5], 0, 1)
hand = np.asarray(Image.fromarray((hand * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32) / 255
save('hand_mask.png', np.stack([hand * 255] * 3, -1), size=1024)
# 帽子・ヘルメットの縁の影（環境光の遮り）：R=帽子 G=ヘルメット B=耳当て。ゲーム側でかぶっている物に応じて掛ける
dyc = GEAR.cap_line(th_t) - py; dyh = GEAR.helm_line(th_t) - py
fr = smoothstep(0.3, 0.8, np.cos(th_t))
near = headreg & (np.hypot(px - hairC[0], pz - hairC[2]) < 0.14)
ao_cap = np.where(dyc < 0, 0.35, (1 - 0.45 * np.exp(-np.maximum(dyc, 0) / 0.005)) * (1 - 0.26 * fr * np.exp(-np.maximum(dyc, 0) / 0.03)))
ao_helm = np.where(dyh < 0, 0.35, (1 - 0.5 * np.exp(-np.maximum(dyh, 0) / 0.006)) * (1 - 0.2 * fr * np.exp(-np.maximum(dyh, 0) / 0.025)))
# 打者用（両耳当て一体）の縁
dyb = GEAR.helm_edge_bat(th_t) - py
ao_flap = np.where(dyb < 0, 0.35, (1 - 0.5 * np.exp(-np.maximum(dyb, 0) / 0.006)) * (1 - 0.2 * fr * np.exp(-np.maximum(dyb, 0) / 0.025)))
aoimg = np.stack([np.where(near, ao_cap, 1), np.where(near, ao_helm, 1), np.where(near, ao_flap, 1)], -1)
aoimg = np.asarray(Image.fromarray(np.clip(aoimg * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
save('head_ao.png', aoimg, size=1024)

# ============ ユニフォーム（tights の UV） ============
U = 2048
Vc = D['Vc']
waist = pos['hips'][1] + 0.075; chestY = pos['chest'][1]
shY = (pos['lSh'][1] + pos['rSh'][1]) / 2; elY = (pos['lEl'][1] + pos['rEl'][1]) / 2
sleeve_end = elY + (shY - elY) * 0.45
# tights の境界辺（襟・袖口・裾）
ec2 = Counter()
for t in tight_tris:
    for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
        ec2[(min(a, b), max(a, b))] += 1
tb = set()
for (a, b), c in ec2.items():
    if c == 1: tb.add(a); tb.add(b)
tidx = sorted(set(tight_tris.flatten().tolist()))
tflags = np.zeros((nv, 6), dtype=np.float32)  # 0 jersey 1 pants 2 belt 3 edge 4 raglan 5 sleeve(upper arm)
for i in tidx:
    y = V[i, 1]; j = JOINTS[int(dom[i])]
    wsh = wfull[i, JOINTS.index('lSh')] + wfull[i, JOINTS.index('rSh')]
    if abs(y - waist) < 0.022: tflags[i, 2] = 1
    elif y > waist or wsh > 0.3: tflags[i, 0] = 1
    else: tflags[i, 1] = 1
    if wsh > 0.3 and y < shY + 0.02: tflags[i, 5] = 1
    if i in tb: tflags[i, 3] = 1
    if wsh > 0.2 or (j == 'chest' and y > shY - 0.06 and abs(V[i, 0]) > 0.11): tflags[i, 4] = 1
tcav = cav
attrs2 = {'pos': V.astype(np.float32), 'nrm': N.astype(np.float32), 'tf': tflags, 'cav': tcav.astype(np.float32)}
print('rasterizing uniform...')
R2, M2 = rasterize(tight_tris, tight_tt, U, attrs2, VTs=D['VT2'], wrap=True)
P2 = dilate(R2['pos'], M2); TF = dilate(R2['tf'], M2); CV2 = dilate(R2['cav'], M2)[..., 0]; NR2 = dilate(R2['nrm'], M2)
px, py, pz = P2[..., 0], P2[..., 1], P2[..., 2]
jersey = np.clip(TF[..., 0], 0, 1); pants = np.clip(TF[..., 1], 0, 1); belt = np.clip(TF[..., 2], 0, 1)
mask = np.stack([jersey * 255, pants * 255, belt * 255], -1)
save('uni_mask.png', mask)
# 縁取り：境界から 2cm 以内（襟・袖口・裾）。襟は上端のみ
edge = np.clip(TF[..., 3], 0, 1)
edge = np.asarray(Image.fromarray((edge * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)), dtype=np.float32) / 255
collar = edge * (py > shY - 0.02)
cuff = edge * (TF[..., 5] > 0.5) * (py < sleeve_end + 0.04)
hem = edge * (py < 0.12)
# 前立て：正面中央の縦線（腰〜襟）
placket = np.exp(-(px / 0.0045) ** 2) * (pz > 0.02) * (py > waist + 0.02) * (py < shY + 0.04) * jersey
placket = np.clip(placket, 0, 1) * 0.6
for by in np.linspace(waist + 0.06, shY - 0.02, 6):
    placket = np.maximum(placket, np.exp(-((px / 0.009) ** 2 + ((py - by) / 0.009) ** 2)) * (pz > 0.02) * jersey * 1.0)
pin = (np.abs(((px + 1.0) % 0.026) - 0.013) < 0.0016).astype(np.float32) * jersey
layers = np.stack([np.clip(np.maximum(collar, np.maximum(cuff * 0.0, hem * 0.0)) * 255, 0, 255), placket * 255, pin * 255], -1)
save('uni_layers.png', layers)
raglan = np.clip(TF[..., 4], 0, 1) * jersey
band = ((py > chestY + 0.0) & (py < chestY + 0.11) & (pz > 0.03) & (np.abs(px) < 0.17)).astype(np.float32) * jersey
cuffband = ((TF[..., 5] > 0.5) & (py < sleeve_end + 0.035)).astype(np.float32) * jersey
# ズボンのサイドライン：脚の外側（脚の軸からの方向が ±x）
side = np.zeros((U, U), dtype=np.float32)
for s, sg in (('l', 1), ('r', -1)):
    hip = pos[s + 'Hip']; knee = pos[s + 'Knee']; foot = pos[s + 'Foot']
    legm = (pants > 0.5) & (py < hip[1] + 0.02) & (np.sign(px) == sg)
    # 脚の中心線上の点（高さで線形補間）
    cx = np.where(py > knee[1], hip[0] + (knee[0] - hip[0]) * (hip[1] - py) / max(1e-6, hip[1] - knee[1]), knee[0] + (foot[0] - knee[0]) * (knee[1] - py) / max(1e-6, knee[1] - foot[1]))
    cz = np.where(py > knee[1], hip[2] + (knee[2] - hip[2]) * (hip[1] - py) / max(1e-6, hip[1] - knee[1]), knee[2] + (foot[2] - knee[2]) * (knee[1] - py) / max(1e-6, knee[1] - foot[1]))
    ang = np.arctan2(pz - cz, (px - cx) * sg)
    side += legm * (np.abs(ang) < 0.13)
side = np.clip(side, 0, 1)
zones = np.stack([raglan * 255, band * 255, np.maximum(cuffband * 128, side * 255)], -1)
save('uni_zones.png', zones)
# 陰影：キャビティ＋しわ＋脇・股・ベルト下
h = np.zeros((U, U), dtype=np.float32)
fab = noise2d(U, 8, 11)
h += 0.035 * fab
# 関節まわりの折りじわ（距離の正弦）
for jn, amp, freq in (('lEl', 1.0, 90), ('rEl', 1.0, 90), ('lKnee', 1.0, 70), ('rKnee', 1.0, 70), ('lHip', 0.6, 60), ('rHip', 0.6, 60), ('hips', 0.5, 45)):
    c = pos[jn]
    dist = np.sqrt((px - c[0]) ** 2 + (py - c[1]) ** 2 + (pz - c[2]) ** 2)
    h += amp * np.exp(-(dist / 0.16) ** 2) * np.sin(dist * freq + 3 * noise2d(U, 64, 20 + len(jn))) * 0.5
# 布のたるみ（大きな波）
h += 0.5 * (noise2d(U, 128, 31) - 0.5)
h *= (jersey + pants + belt)
hn = (h - h.min()) / max(1e-6, h.max() - h.min())
# 法線マップ（高さの勾配）
gy, gx = np.gradient(hn * 14.0)
nx = -gx; ny = gy; nz = np.ones_like(nx)
l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
normal = np.stack([(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255], -1)
save('uni_normal.jpg', normal, size=1024, q=95)
shade = 1.0 - 0.25 * np.clip(CV2, 0, 1) - 0.18 * (hn - 0.5) - 0.08 * (1 - fab)
armpit = np.exp(-(((np.abs(px) - 0.17) / 0.05) ** 2 + ((py - (shY - 0.08)) / 0.05) ** 2)) * jersey
crotch = np.exp(-((px / 0.05) ** 2 + ((py - (pos['lHip'][1] - 0.03)) / 0.05) ** 2)) * pants
shade -= 0.25 * armpit + 0.25 * crotch
shade = np.clip(shade, 0.35, 1.0)
save('uni_shade.jpg', np.stack([shade * 255] * 3, -1), size=1024, q=90)
# 汚れ
dirt = np.zeros((U, U), dtype=np.float32)
dn = noise2d(U, 32, 41)
for jn, r, a in (('lKnee', 0.13, 1.0), ('rKnee', 0.13, 1.0), ('lHip', 0.17, 0.8), ('rHip', 0.17, 0.8), ('lEl', 0.09, 0.6), ('rEl', 0.09, 0.6), ('hips', 0.2, 0.7), ('chest', 0.14, 0.4)):
    c = pos[jn]
    d2 = ((px - c[0]) / r) ** 2 + ((py - c[1]) / r) ** 2 + ((pz - c[2]) / (r * 1.5)) ** 2
    dirt += a * np.exp(-d2) * (0.4 + 0.8 * dn)
dirt *= (jersey + pants + belt)
dirt = np.clip(dirt * (0.6 + 0.6 * noise2d(U, 6, 43)), 0, 1)
save('uni_dirt.jpg', np.stack([dirt * 255] * 3, -1), size=1024, q=88)
print('done')

# 目のテクスチャ（MakeHuman 同梱・CC0）を縮小して JPEG に
eye = np.asarray(Image.open(os.path.join(MH, 'eyes', 'brown_eye.png')).convert('RGB').resize((512, 512), Image.LANCZOS), dtype=np.float32) / 255
r_, g_, b_ = eye[..., 0], eye[..., 1], eye[..., 2]
iris = np.clip((r_ - (g_ + b_) / 2 - 0.08) / 0.12, 0, 1); iris = np.asarray(Image.fromarray((iris * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), dtype=np.float32) / 255
lin = eye ** 2.2; lum = lin.mean(2); ml = lum[iris > 0.8].mean()
target = (np.array([46, 31, 24], np.float32) / 255) ** 2.2
new_ = target[None, None, :] * np.clip(lum / ml, 0.2, 3.0)[..., None] ** 0.8
out = lin * (1 - iris[..., None]) + new_ * iris[..., None]
Image.fromarray(np.clip(out ** (1 / 2.2) * 255, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'eye.jpg'), quality=90); print('saved eye.jpg')
