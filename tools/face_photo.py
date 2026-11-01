"""写真の顔を選手モデルの肌テクスチャに焼き込む（試作：1人分）
 1) モデル（変形なしの基本形）を正面から正射影でレンダーする
 2) 写真とレンダーの両方で MediaPipe Face Mesh の 478 点を取る
 3) 点の対応から「モデル正面座標 → 写真の画素」の写像（薄板スプライン）を作る
 4) 肌テクスチャ（UV）の各画素について 3D 位置を正面に投影し、写真から色を取って顔の範囲だけ合成する
    写真の陰影は大きなぼかしで平らにし（ゲーム側でライティングされるため）、体の肌色は写真に合わせる
 実行（MediaPipe 0.10.14 が入った Python で）:
   python tools/face_photo.py <写真.png> <出力名 例: skin_face1.jpg>
 出力: assets/<出力名>、tools/out/face_*.png（確認用）"""
import os, sys, math, json, numpy as np
from PIL import Image, ImageFilter
import cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import JOINTS
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
ASSETS = os.path.join(ROOT, 'assets'); TMP = os.path.join(HERE, 'out')
D = np.load(os.path.join(TMP, 'model.npz'), allow_pickle=True)
V = D['V']; VT = D['VT']; N = D['N']; dom = D['dom']
body_tris = D['body_tris']; body_tt = D['body_tt']
EV = D['EV']; EVT = D['EVT']; etv = D['etv']; ett = D['ett']; EN = D['EN']
ext = {k: D['extra'][i] for i, k in enumerate(['headTop', 'lEye', 'rEye', 'lFingerTip', 'rFingerTip', 'lToe', 'rToe'])}
eyeC = (ext['lEye'] + ext['rEye']) / 2

# ---------------- 1) 正面の正射影レンダー ----------------
BOX = (-0.12, 0.12, 1.40, 1.80)  # x0 x1 y0 y1（メートル）
PPM = 4000  # 1m あたりの画素

def to_px(x, y): return (x - BOX[0]) * PPM, (BOX[3] - y) * PPM
def to_model(px, py): return BOX[0] + px / PPM, BOX[3] - py / PPM

def raster_front(Vs, tris, UV, tt, Ns, mesh_id, buf):
    """z バッファ付きで三角形を描き、画素ごとに uv・法線・メッシュ番号・3D位置を記録"""
    H, W = buf['z'].shape
    sx, sy = to_px(Vs[:, 0], Vs[:, 1])
    for f in range(len(tris)):
        tv = tris[f]; ti = tt[f]
        if (ti < 0).any(): continue
        X = sx[tv]; Y = sy[tv]; Z = Vs[tv, 2]
        if Y.max() < 0 or Y.min() > H or X.max() < 0 or X.min() > W: continue
        x0 = int(max(0, math.floor(X.min()))); x1 = int(min(W - 1, math.ceil(X.max())))
        y0 = int(max(0, math.floor(Y.min()))); y1 = int(min(H - 1, math.ceil(Y.max())))
        if x1 < x0 or y1 < y0: continue
        d = (X[1] - X[0]) * (Y[2] - Y[0]) - (X[2] - X[0]) * (Y[1] - Y[0])
        if abs(d) < 1e-9: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l1 = ((xs - X[0]) * (Y[2] - Y[0]) - (ys - Y[0]) * (X[2] - X[0])) / d
        l2 = ((X[1] - X[0]) * (ys - Y[0]) - (Y[1] - Y[0]) * (xs - X[0])) / d
        l0 = 1 - l1 - l2
        ins = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not ins.any(): continue
        z = l0 * Z[0] + l1 * Z[1] + l2 * Z[2]
        yy, xx = np.nonzero(ins); yy += y0; xx += x0; zz = z[ins]
        closer = zz > buf['z'][yy, xx]
        if not closer.any(): continue
        yy = yy[closer]; xx = xx[closer]; w0 = l0[ins][closer]; w1 = l1[ins][closer]; w2 = l2[ins][closer]
        buf['z'][yy, xx] = zz[closer]
        uv = UV[ti]; buf['uv'][yy, xx] = w0[:, None] * uv[0] + w1[:, None] * uv[1] + w2[:, None] * uv[2]
        nn = Ns[tv]; buf['n'][yy, xx] = w0[:, None] * nn[0] + w1[:, None] * nn[1] + w2[:, None] * nn[2]
        pp = Vs[tv]; buf['p'][yy, xx] = w0[:, None] * pp[0] + w1[:, None] * pp[1] + w2[:, None] * pp[2]
        buf['id'][yy, xx] = mesh_id

def sample(img, u, v):
    """uv（v は OBJ 向き）でテクスチャを双一次補間"""
    H, W = img.shape[:2]
    mx = (u * W - 0.5).astype(np.float32); my = ((1 - v) * H - 0.5).astype(np.float32)
    return cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)

def render_front(skin_path, eye_path=None):
    W = int((BOX[1] - BOX[0]) * PPM); H = int((BOX[3] - BOX[2]) * PPM)
    buf = {'z': np.full((H, W), -np.inf), 'uv': np.zeros((H, W, 2)), 'n': np.zeros((H, W, 3)), 'p': np.zeros((H, W, 3)), 'id': np.zeros((H, W), np.int8)}
    head = np.where(V[:, 1] > BOX[2] - 0.02)[0]; keep = np.isin(body_tris, head).all(1)
    raster_front(V, body_tris[keep], VT, body_tt[keep], N, 1, buf)
    raster_front(EV, etv, EVT, ett, EN, 2, buf)
    skin = cv2.imread(skin_path).astype(np.float32); eye = cv2.imread(eye_path or os.path.join(ASSETS, 'eye.jpg')).astype(np.float32)
    u = buf['uv'][..., 0]; v = buf['uv'][..., 1]
    col = np.where((buf['id'] == 2)[..., None], sample(eye, u, v), sample(skin, u, v))
    n = buf['n'] / np.maximum(1e-6, np.linalg.norm(buf['n'], axis=-1, keepdims=True))
    L = np.array([0.15, 0.35, 1.0]); L /= np.linalg.norm(L)
    shade = 0.45 + 0.6 * np.clip((n * L).sum(-1), 0, 1)
    img = col * shade[..., None]
    bg = np.array([200, 200, 200], np.float32)
    img = np.where((buf['id'] > 0)[..., None], img, bg)
    return np.clip(img, 0, 255).astype(np.uint8), buf

# ---------------- 2) ランドマーク ----------------
def landmarks(img_bgr):
    import mediapipe as mp
    h, w = img_bgr.shape[:2]
    with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.2) as fm:
        r = fm.process(cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB))
    if not r.multi_face_landmarks: return None
    return np.array([[p.x * w, p.y * h, p.z * w] for p in r.multi_face_landmarks[0].landmark])

def draw_lm(img, L, path):
    im = img.copy()
    for i, (x, y, _) in enumerate(L):
        cv2.circle(im, (int(round(x)), int(round(y))), 2, (0, 255, 0) if i < 468 else (0, 0, 255), -1)
    cv2.imwrite(path, im)

# MediaPipe Face Mesh の部位（点番号）
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
EYE_R = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
EYE_L = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]
BROW_R = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
BROW_L = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
NOSE_LOW = [98, 97, 2, 326, 327, 294, 278, 344, 440, 275, 4, 45, 220, 115, 48, 64]

def poly_mask(shape, pts, dilate=0):
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.round(pts).astype(np.int32)], 255)
    if dilate > 0: m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * dilate + 1, 2 * dilate + 1)))
    return m > 0

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def blur_norm(val, mask, sigma):
    """マスク内だけで平均したぼかし（正規化畳み込み）"""
    m = mask.astype(np.float32); k = int(sigma * 3) * 2 + 1
    num = cv2.GaussianBlur(val * m[..., None] if val.ndim == 3 else val * m, (k, k), sigma)
    den = cv2.GaussianBlur(m, (k, k), sigma)
    return num / np.maximum(den, 1e-4)[..., None] if val.ndim == 3 else num / np.maximum(den, 1e-4)

def prepare_photo(photo, P):
    """写真の大きな陰影を平らにする。P=写真のランドマーク（画素）"""
    img = photo.astype(np.float32) / 255.0
    lin = img ** 2.2
    lum = lin @ np.array([0.0722, 0.7152, 0.2126], np.float32)  # BGR
    sh = img.shape
    # 肌の領域：顔の輪郭から目・眉・唇・鼻の穴を除く。額は輪郭の上端から生え際まで伸ばす
    oval = P[FACE_OVAL, :2]
    skin = poly_mask(sh, oval)
    for part, dl in ((EYE_R, 14), (EYE_L, 14), (BROW_R, 10), (BROW_L, 10), (LIPS, 8)):
        skin &= ~poly_mask(sh, P[part, :2], dl)
    hull = cv2.convexHull(np.round(P[[64, 98, 97, 2, 326, 327, 294], :2]).astype(np.int32))[:, 0, :].astype(np.float32)
    skin &= ~poly_mask(sh, hull, 6)
    ipd = np.linalg.norm(P[468, :2] - P[473, :2])
    low = blur_norm(lum, skin, ipd * 0.22)
    ref = np.median(lum[skin])
    k = np.clip((ref / np.maximum(low, 1e-4)) ** 0.6, 0.8, 1.6)
    out = lin * k[..., None]
    # テカリ（鼻筋・鼻先・額の白い反射）はまわりの肌の色で埋める（明るさを下げるだけだと灰色になる）
    lum2 = out @ np.array([0.0722, 0.7152, 0.2126], np.float32)
    low_s = blur_norm(lum2, skin, ipd * 0.05)
    ratio = lum2 / np.maximum(low_s, 1e-4)
    spec = smoothstep(1.04, 1.22, ratio) * skin
    spec = cv2.GaussianBlur(spec.astype(np.float32), (0, 0), ipd * 0.008)
    fill = blur_norm(out, skin & (ratio < 1.04), ipd * 0.035)
    out = out * (1 - spec[..., None]) + fill * spec[..., None]
    # 目の開いた部分（白目）は暗いまつ毛の色にする：モデルのまぶたと少しずれても白い縁が出ないように
    lash = np.array([0.012, 0.011, 0.014], np.float32)  # BGR（線形）
    for part in (EYE_R, EYE_L):
        em = cv2.GaussianBlur(poly_mask(sh, P[part, :2], 2).astype(np.float32), (0, 0), 1.2)
        out = out * (1 - em[..., None]) + lash[None, None, :] * em[..., None]
    out = np.clip(out, 0, 1) ** (1 / 2.2)
    return out, skin, ref

def lash_line(S):
    """体メッシュの目の穴の縁（まつ毛の線）を UV 上に描いたマスク"""
    from collections import Counter
    tris = D['body_tris']; tt = D['body_tt']
    ec = Counter(); uvof = {}
    for f in range(len(tris)):
        for a, b, ta, tb in ((0, 1, 0, 1), (1, 2, 1, 2), (2, 0, 2, 0)):
            va, vb = int(tris[f, a]), int(tris[f, b]); k = (min(va, vb), max(va, vb))
            ec[k] += 1; uvof[k] = (tt[f, ta], tt[f, tb]) if va < vb else (tt[f, tb], tt[f, ta])
    m = np.zeros((S, S), np.uint8)
    for k, c in ec.items():
        if c != 1: continue
        if np.linalg.norm(V[k[0]] - eyeC) > 0.06 or np.linalg.norm(V[k[1]] - eyeC) > 0.06: continue
        ta, tb = uvof[k]
        pa = (VT[ta, 0] * S, (1 - VT[ta, 1]) * S); pb = (VT[tb, 0] * S, (1 - VT[tb, 1]) * S)
        cv2.line(m, (int(round(pa[0] * 4)), int(round(pa[1] * 4))), (int(round(pb[0] * 4)), int(round(pb[1] * 4))), 255, 3, cv2.LINE_AA, shift=2)
    return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 1.0)

def rasterize_uv(S):
    """肌テクスチャ（build_textures.py と同じ三角形・UV）の各画素の 3D 位置と法線"""
    tris = D['body_tris_all']; tt = D['body_tt_all']
    head = V[:, 1] > eyeC[1] - 0.2; keep = head[tris].all(1)
    tris = tris[keep]; tt = tt[keep]
    P = np.zeros((S, S, 3), np.float32); Nn = np.zeros((S, S, 3), np.float32); M = np.zeros((S, S), bool)
    uv = VT.copy(); uv[:, 1] = 1 - uv[:, 1]; uv *= S
    for f in range(len(tris)):
        tv = tris[f]; ti = tt[f]
        if (ti < 0).any(): continue
        p = uv[ti]
        x0 = int(max(0, math.floor(p[:, 0].min()) - 1)); x1 = int(min(S - 1, math.ceil(p[:, 0].max()) + 1))
        y0 = int(max(0, math.floor(p[:, 1].min()) - 1)); y1 = int(min(S - 1, math.ceil(p[:, 1].max()) + 1))
        if x1 < x0 or y1 < y0: continue
        d = (p[1, 0] - p[0, 0]) * (p[2, 1] - p[0, 1]) - (p[2, 0] - p[0, 0]) * (p[1, 1] - p[0, 1])
        if abs(d) < 1e-9: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        l2 = ((xs - p[0, 0]) * (p[2, 1] - p[0, 1]) - (ys - p[0, 1]) * (p[2, 0] - p[0, 0])) / d
        l1 = ((p[1, 0] - p[0, 0]) * (ys - p[0, 1]) - (p[1, 1] - p[0, 1]) * (xs - p[0, 0])) / d
        l0 = 1 - l1 - l2
        ins = (l0 >= -0.02) & (l1 >= -0.02) & (l2 >= -0.02)
        if not ins.any(): continue
        yy, xx = np.nonzero(ins); yy += y0; xx += x0
        w0 = l0[ins]; w1 = l2[ins]; w2 = l1[ins]
        P[yy, xx] = w0[:, None] * V[tv[0]] + w1[:, None] * V[tv[1]] + w2[:, None] * V[tv[2]]
        Nn[yy, xx] = w0[:, None] * N[tv[0]] + w1[:, None] * N[tv[1]] + w2[:, None] * N[tv[2]]
        M[yy, xx] = True
    return P, Nn, M

def remap_pts(img, x, y, **kw):
    """点列の座標で画像を補間サンプル（cv2.remap の大きさ制限を避けて2次元に並べ替える）"""
    n = len(x); w = 1024; h = (n + w - 1) // w
    mx = np.zeros(h * w, np.float32); my = np.zeros(h * w, np.float32); mx[:n] = x; my[:n] = y
    r = cv2.remap(img, mx.reshape(h, w), my.reshape(h, w), cv2.INTER_LINEAR, **kw)
    return r.reshape(h * w, *img.shape[2:])[:n]

def make_eye(photo, LP, out_name):
    """目玉のテクスチャ（MakeHuman の茶色い目）の虹彩を、写真の瞳の色に塗り替える"""
    eye = cv2.imread(os.path.join(ASSETS, 'eye.jpg')).astype(np.float32) / 255
    # 写真の虹彩の色（瞳孔と映り込みを除いた環）
    cols = []
    for c, ring in ((468, [469, 470, 471, 472]), (473, [474, 475, 476, 477])):
        cx, cy = LP[c, :2]; r = np.linalg.norm(LP[ring, :2] - LP[c, :2], axis=1).mean()
        yy, xx = np.mgrid[int(cy - r):int(cy + r) + 1, int(cx - r):int(cx + r) + 1]
        d = np.hypot(xx - cx, yy - cy); ok = (d > 0.45 * r) & (d < 0.85 * r)
        px = photo[yy[ok], xx[ok]].astype(np.float32) / 255
        lum = px.mean(1); px = px[lum < np.percentile(lum, 80)]
        cols.append(px)
    target = (np.concatenate(cols) ** 2.2).mean(0)
    lin = eye ** 2.2
    b, g, r_ = eye[..., 0], eye[..., 1], eye[..., 2]
    iris = smoothstep(0.08, 0.2, r_ - (g + b) / 2)
    iris = cv2.GaussianBlur(iris, (0, 0), 1.5)
    lum = lin.mean(2); ml = lum[iris > 0.8].mean()
    new = target[None, None, :] * np.clip(lum / ml, 0.2, 3.0)[..., None] ** 0.8
    out = lin * (1 - iris[..., None]) + new * iris[..., None]
    cv2.imwrite(os.path.join(ASSETS, out_name), np.clip(out ** (1 / 2.2) * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print('saved', out_name, 'iris color (sRGB BGR):', (target ** (1 / 2.2) * 255).round())

def fit_map(src, dst, smoothing):
    from scipy.interpolate import RBFInterpolator
    return RBFInterpolator(src, dst, kernel='thin_plate_spline', smoothing=smoothing)

def bake(photo_path, out_name, debug=True):
    skin_path = os.path.join(ASSETS, 'skin.jpg')
    rimg, buf = render_front(skin_path)
    LR = landmarks(rimg); assert LR is not None, 'render landmarks failed'
    photo = cv2.imread(photo_path); LP = landmarks(photo); assert LP is not None, 'photo landmarks failed'
    if debug: draw_lm(photo, LP, os.path.join(TMP, 'face_photo_lm.png')); draw_lm(rimg, LR, os.path.join(TMP, 'face_render_lm.png'))
    # モデル正面座標（目の中心が原点・瞳孔間距離=1）→ 写真の画素
    mx, my = to_model(LR[:, 0], LR[:, 1])
    ipd_m = abs(ext['lEye'][0] - ext['rEye'][0])
    norm = lambda x, y: np.stack([(x - eyeC[0]) / ipd_m, (y - eyeC[1]) / ipd_m], -1)
    use = np.arange(468)
    F = fit_map(norm(mx, my)[use], LP[use, :2], smoothing=0.003)
    res = np.linalg.norm(F(norm(mx, my)[use]) - LP[use, :2], axis=1); print('fit residual px: mean %.2f max %.2f at %d' % (res.mean(), res.max(), use[res.argmax()]))
    flat, pskin, ref = prepare_photo(photo, LP)
    sigma = 0.9; flat_b = cv2.GaussianBlur(flat, (0, 0), sigma)
    # 写真側の「使ってよい範囲」：顔の輪郭（少し内側）＋額は生え際の少し上まで
    ph, pw = photo.shape[:2]
    ipd_p = np.linalg.norm(LP[468, :2] - LP[473, :2])
    oval = LP[FACE_OVAL, :2].copy(); cen = LP[[33, 263, 61, 291], :2].mean(0)
    top = oval[:, 1] < LP[168, 1]  # 眉間より上の点は上に伸ばして額〜生え際を含める
    oval[top, 1] -= ipd_p * 0.55 * np.clip((LP[168, 1] - oval[top, 1]) / (LP[168, 1] - LP[10, 1]), 0, 1)
    oval = cen + (oval - cen) * np.array([0.97, 1.0])
    region = poly_mask(photo.shape, oval).astype(np.float32)
    region = cv2.GaussianBlur(region, (0, 0), ipd_p * 0.06)
    # 肌テクスチャの各画素の 3D 位置と法線
    S = 2048
    P3, N3, M = rasterize_uv(S)
    sel = M & (P3[..., 1] > eyeC[1] - 0.16) & (P3[..., 2] > eyeC[2] - 0.09) & (np.abs(P3[..., 0]) < 0.11)
    ys, xs = np.nonzero(sel)
    p = P3[ys, xs]; n = N3[ys, xs]; n = n / np.maximum(1e-6, np.linalg.norm(n, axis=1, keepdims=True))
    uv = F(norm(p[:, 0], p[:, 1]))
    # 正面から見えているか（z バッファと比べる）
    rx, ry = to_px(p[:, 0], p[:, 1]); rxi = np.clip(rx.astype(int), 0, buf['z'].shape[1] - 1); ryi = np.clip(ry.astype(int), 0, buf['z'].shape[0] - 1)
    zfront = buf['z'][ryi, rxi]
    vis = smoothstep(-0.006, -0.002, p[:, 2] - zfront)
    wn = smoothstep(0.12, 0.42, n[:, 2])
    wr = remap_pts(region, uv[:, 0], uv[:, 1], borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    w = vis * wn * wr
    col = remap_pts(flat_b.astype(np.float32), uv[:, 0], uv[:, 1], borderMode=cv2.BORDER_REPLICATE)
    Wt = np.zeros((S, S), np.float32); Wt[ys, xs] = w
    C = np.zeros((S, S, 3), np.float32); C[ys, xs] = col
    # テクスチャ空間で重みを少しぼかして継ぎ目をなめらかに（色は重みの大きい画素から広げる）
    Wt = cv2.GaussianBlur(Wt, (0, 0), 2.0) * (Wt > 0.001)
    base = cv2.imread(skin_path).astype(np.float32) / 255.0
    # 体の肌色を写真に合わせる（顔の頬・額の平均色の比）
    core = Wt > 0.85
    bc = base[core]; pc = C[core]
    lb = bc.mean(1); lp = pc.mean(1)
    okb = lb > np.median(lb) * 0.8; okp = lp > np.median(lp) * 0.8
    gain = (pc[okp] ** 2.2).mean(0) / np.maximum((bc[okb] ** 2.2).mean(0), 1e-4)
    print('skin gain (B,G,R):', gain.round(3))
    b8 = base * 255; skinness = smoothstep(25, 55, b8[..., 2] - b8[..., 0])
    base_lin = base ** 2.2
    adj_lin = base_lin * (1 + skinness[..., None] * (gain[None, None, :] - 1))
    # 坊主頭（頭皮）の色を写真の生え際の上の色に合わせる（build_textures.py の頭皮と同じ範囲）
    py_, pz_ = P3[..., 1], P3[..., 2]
    scalp = M & (py_ > eyeC[1] - 0.03) & ((py_ > eyeC[1] + 0.065) | ((pz_ < eyeC[2] - 0.11) & (py_ > eyeC[1] - 0.02)))
    scalp = cv2.GaussianBlur(scalp.astype(np.float32), (0, 0), 4.0)
    ytop = oval[:, 1].min()
    hp = photo[int(ytop - 0.25 * ipd_p):int(ytop - 0.05 * ipd_p), int(cen[0] - 0.4 * ipd_p):int(cen[0] + 0.4 * ipd_p)].reshape(-1, 3).astype(np.float32) / 255
    hair_t = (hp ** 2.2).mean(0)
    hs = scalp > 0.9
    hair_b = adj_lin[hs].mean(0)
    hgain = hair_t / np.maximum(hair_b, 1e-4); print('hair gain (B,G,R):', hgain.round(3))
    adj_lin = adj_lin * (1 + scalp[..., None] * (hgain[None, None, :] - 1))
    base_adj = np.clip(adj_lin, 0, 1) ** (1 / 2.2)
    out = base_adj * (1 - Wt[..., None]) + C * Wt[..., None]
    out *= (1 - 0.35 * lash_line(S) * np.clip(Wt * 2, 0, 1))[..., None]
    # ゲームの照明（ACES トーンマッピング）では肌が赤黒く寄るので、少し明るく・彩度を控えめにしておく（靴・靴下は除く）
    ol = np.clip(out, 0, 1) ** 2.2; lm = ol.mean(2, keepdims=True)
    comp = (lm + (ol - lm) * 0.88) * 1.13
    km = np.maximum(skinness, Wt)[..., None]
    out = (ol * (1 - km) + np.clip(comp, 0, 1) * km) ** (1 / 2.2)
    make_eye(photo, LP, out_name.replace('skin_', 'eye_'))
    cv2.imwrite(os.path.join(ASSETS, out_name), np.clip(out * 255, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 90])
    print('saved', out_name, os.path.getsize(os.path.join(ASSETS, out_name)) // 1024, 'KB')
    if debug:
        cv2.imwrite(os.path.join(TMP, 'face_photo_flat.png'), np.clip(flat * 255, 0, 255).astype(np.uint8))
        rg = (photo.astype(np.float32) * (0.35 + 0.65 * region[..., None])).astype(np.uint8); cv2.imwrite(os.path.join(TMP, 'face_photo_region.png'), rg)
        ys0, ys1 = 700, 1300; xs0, xs1 = 1450, 2048
        cv2.imwrite(os.path.join(TMP, 'face_tex_crop.png'), np.clip(out[ys0:ys1, xs0:xs1] * 255, 0, 255).astype(np.uint8))
        r2, _ = render_front(os.path.join(ASSETS, out_name), os.path.join(ASSETS, out_name.replace('skin_', 'eye_'))); cv2.imwrite(os.path.join(TMP, 'face_render_new.png'), r2)

if __name__ == '__main__' and len(sys.argv) >= 2 and sys.argv[1] == 'render':
    img, buf = render_front(os.path.join(ASSETS, 'skin.jpg'))
    cv2.imwrite(os.path.join(TMP, 'face_render.png'), img)
    L = landmarks(img)
    print('render landmarks:', None if L is None else L.shape)
    if L is not None:
        np.save(os.path.join(TMP, 'face_render_lm.npy'), L); draw_lm(img, L, os.path.join(TMP, 'face_render_lm.png'))
elif __name__ == '__main__' and len(sys.argv) >= 3:
    bake(sys.argv[1], sys.argv[2])
