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
    if abs(y - mouth_y) < 0.015 and z < mouth_z - 0.018 and abs(V[i, 0]) < 0.03: flags[i, 3] = 1
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
n1 = noise2d(S, 256, 1); n2 = noise2d(S, 8, 2)
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
# 坊主頭：濃い青黒を半透明で
scalp = np.clip(FL[..., 4], 0, 1)
scalp = np.asarray(Image.fromarray((scalp * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), dtype=np.float32) / 255
hair_col = np.array([48, 40, 42], dtype=np.float32)
stubble = (0.5 + 0.5 * noise2d(S, 4, 5))
img = img * (1 - scalp[..., None] * 0.62 * stubble[..., None]) + hair_col[None, None, :] * (scalp[..., None] * 0.62 * stubble[..., None])
# 眉：濃い毛
browm = np.clip(FL[..., 0], 0, 1)
browm = np.asarray(Image.fromarray((browm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255
strokes = (noise2d(S, 3, 9) > 0.5).astype(np.float32)
bcol = np.array([48, 36, 30], dtype=np.float32)
k = np.clip(browm * (0.45 + 0.45 * strokes) * 0.9, 0, 1)
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
fab = noise2d(U, 4, 11)
h += 0.15 * fab
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
eye = Image.open(os.path.join(MH, 'eyes', 'brown_eye.png')).convert('RGB').resize((512, 512), Image.LANCZOS)
eye.save(os.path.join(OUT, 'eye.jpg'), quality=90); print('saved eye.jpg')
