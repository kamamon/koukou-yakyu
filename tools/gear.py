"""帽子とヘルメットを選手モデルの頭の形に合わせて作る → assets/gear.glb と素材テクスチャ（cap.png / cap_n.jpg / helmet.png）
 頭の中心から放射状に頭皮までの距離を測り、そこから少し外側に布（帽子）／殻（ヘルメット）の面を張るので、すき間も食い込みも出ない。
 ・帽子：6枚はぎのクラウン（前2枚は芯入りで立つ）、縫い目・ステッチ・ハトメ・天ボタン、反りのあるつば（表＝つばの色・裏＝濃い緑）、正面のマーク
 ・ヘルメット：両耳当て付き（高校野球の規定）、つば、内側のパッドと縁、正面のマーク
 座標：モデル空間（m）。書き出す頂点は頭の関節からの相対位置（ゲーム側で頭の骨の子にする）。
 方位角 th は頭の縦軸まわり（0=正面 +z、+π/2=+x）、極角 ph は真上=0。
 実行: python3 tools/gear.py（tools/out/model.npz を使う。build_player.py の後）"""
import os, sys, json, struct, math, numpy as np
from scipy import ndimage
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *

ROOT = os.path.dirname(HERE); OUT = os.path.join(ROOT, 'assets'); TMP = os.path.join(HERE, 'out')
D = np.load(os.path.join(TMP, 'model.npz'), allow_pickle=True)
V = D['V']; TRIS = D['body_tris_all']
POS = {j: D['pos'][i] for i, j in enumerate(JOINTS)}
EXT = {k: D['extra'][i] for i, k in enumerate(['headTop', 'lEye', 'rEye', 'lFingerTip', 'rFingerTip', 'lToe', 'rToe'])}
EYE = (EXT['lEye'] + EXT['rEye']) / 2; EYEY = EYE[1]
TAU = 2 * math.pi

def ear_vertices():
    s = set()
    for side in 'lr':
        idx, d = load_target(os.path.join(MH, 'targets', 'ears', side + '-ear-wing-incr.target'))
        m = np.linalg.norm(d, axis=1); s |= set(idx[m >= m.max() * 0.1].tolist())
    return np.array(sorted(s))
EAR = V[ear_vertices()]

# ---------------- 頭の形（中心からの距離の場） ----------------
def skull_center():
    cr = (V[:, 1] > EYEY + 0.01) & (np.abs(V[:, 0]) < 0.075) & (V[:, 1] < EXT['headTop'][1] + 0.01) & (np.linalg.norm(V - [0, EYEY + 0.03, 0.047], axis=1) < 0.16)
    P = V[cr]; A = np.c_[2 * P, np.ones(len(P))]; b = (P ** 2).sum(1)
    c = np.linalg.lstsq(A, b, rcond=None)[0][:3]; c[0] = 0.0
    return c
C = skull_center()

def dirs(th, ph):
    th = np.asarray(th, float); ph = np.asarray(ph, float)
    return np.stack([np.sin(ph) * np.sin(th), np.cos(ph), np.sin(ph) * np.cos(th)], -1)

def raycast(O, Dd, P0, P1, P2, chunk=96):
    """原点 O（共通）から方向 Dd へ。最も近い交点までの距離（なければ nan）"""
    e1 = P1 - P0; e2 = P2 - P0; s = O - P0; q = np.cross(s, e1); te = (e2 * q).sum(-1)
    out = np.full(len(Dd), np.nan)
    for a in range(0, len(Dd), chunk):
        d = Dd[a:a + chunk][:, None, :]
        p = np.cross(d, e2[None]); det = (e1[None] * p).sum(-1)
        ok = np.abs(det) > 1e-12; inv = np.where(ok, 1.0 / np.where(ok, det, 1), 0)
        u = (s[None] * p).sum(-1) * inv; v = (d * q[None]).sum(-1) * inv; t = te[None] * inv
        hit = ok & (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6) & (t > 1e-5)
        t = np.where(hit, t, np.inf); m = t.min(1); out[a:a + chunk] = np.where(np.isfinite(m), m, np.nan)
    return out

HEAD_T = TRIS[(V[TRIS][:, :, 1] > EYEY - 0.16).all(1)]
P0, P1, P2 = V[HEAD_T[:, 0]], V[HEAD_T[:, 1]], V[HEAD_T[:, 2]]
NTH, NPH, PHMAX = 144, 80, math.radians(132)
_th = np.arange(NTH) * TAU / NTH; _ph = np.linspace(0, PHMAX, NPH)
_TT, _PP = np.meshgrid(_th, _ph)
R_RAW = raycast(C, dirs(_TT.ravel(), _PP.ravel()), P0, P1, P2).reshape(NPH, NTH)
if np.isnan(R_RAW).any():  # 当たらなかった方向は近くの値で埋める
    idx = ndimage.distance_transform_edt(np.isnan(R_RAW), return_distances=False, return_indices=True)
    R_RAW = R_RAW[idx[0], idx[1]]

def field(sigma):
    return ndimage.gaussian_filter(R_RAW, sigma, mode=('nearest', 'wrap'))

def sample(F, th, ph):
    th = np.asarray(th, float); ph = np.asarray(ph, float)
    Fp = np.concatenate([F, F[:, :1]], 1)
    i = np.clip(ph / PHMAX * (NPH - 1), 0, NPH - 1); j = np.mod(th, TAU) / TAU * NTH
    return ndimage.map_coordinates(Fp, [i.ravel(), j.ravel()], order=1, mode='nearest').reshape(th.shape)

def phi_at_height(F, th, y, off=0.0):
    """方位 th で、面（距離場 F＋off）の高さが y になる極角"""
    th = np.atleast_1d(np.asarray(th, float)); y = np.broadcast_to(np.asarray(y, float), th.shape)
    phs = np.linspace(math.radians(5), PHMAX - 0.01, 600)
    TT = np.repeat(th[:, None], len(phs), 1); PP = np.repeat(phs[None], len(th), 0)
    off = np.asarray(off, float); off = off[:, None] if off.ndim == 1 else off
    Y = C[1] + (sample(F, TT, PP) + off) * np.cos(PP)
    out = np.zeros(len(th))
    for k in range(len(th)):
        below = np.nonzero(Y[k] <= y[k])[0]
        if not len(below): out[k] = phs[-1]; continue
        b = below[0]
        if b == 0: out[k] = phs[0]; continue
        y0, y1 = Y[k, b - 1], Y[k, b]; f = (y0 - y[k]) / max(1e-9, y0 - y1); out[k] = phs[b - 1] + f * (phs[b] - phs[b - 1])
    return out

# 帽子とヘルメットのかぶりの線（目の高さからの差）。正面は額、横は耳の上、後ろは後頭部
def cap_line(th): th = np.asarray(th, float); return EYEY + 0.019 + 0.024 * np.cos(th) - 0.003 * np.cos(2 * th)
def helm_line(th): th = np.asarray(th, float); return EYEY + 0.0075 + 0.033 * np.cos(th) - 0.0045 * np.cos(2 * th)

# ---------------- メッシュ部品 ----------------
class Part:
    def __init__(self): self.V = []; self.UV = []; self.T = [[], []]; self.flat = []
    def add(self, P, uv):
        i = len(self.V); self.V.append(np.asarray(P, float)); self.UV.append(np.asarray(uv, float)); return i
    def grid(self, P, UV, group=0, wrap=False, flip=False):
        """P: (n, m, 3) の格子を三角形に。flip=True で裏向き"""
        n, m = P.shape[:2]; base = len(self.V)
        for a in range(n):
            for b in range(m): self.V.append(P[a, b]); self.UV.append(UV[a, b])
        idx = lambda a, b: base + a * m + b
        for a in range(n - 1):
            for b in range(m - 1):
                t1 = (idx(a, b), idx(a + 1, b), idx(a + 1, b + 1)); t2 = (idx(a, b), idx(a + 1, b + 1), idx(a, b + 1))
                if flip: t1 = t1[::-1]; t2 = t2[::-1]
                self.T[group] += [t1, t2]
        return base
    def orient(self, inside_point=None, outward=None):
        """各グループの三角形を外向き（中心から離れる向き）に揃える。outward=False のグループは内向き"""
        Vv = np.array(self.V)
        for g in range(len(self.T)):
            if not self.T[g]: continue
            T = np.array(self.T[g]); n = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]])
            c = Vv[T].mean(1) - (inside_point if inside_point is not None else C)
            want = True if outward is None else outward[g]
            bad = ((n * c).sum(1) < 0) == want
            T[bad] = T[bad][:, ::-1]; self.T[g] = [tuple(t) for t in T]
    def arrays(self):
        Vv = np.array(self.V, np.float64); UV = np.array(self.UV, np.float64)
        Nn = np.zeros_like(Vv)
        for g in self.T:
            if not g: continue
            T = np.array(g); n = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]])
            for k in range(3): np.add.at(Nn, T[:, k], n)
        Nn /= np.maximum(1e-12, np.linalg.norm(Nn, axis=1, keepdims=True))
        return Vv, Nn, UV, [np.array(g, np.uint32) if g else np.zeros((0, 3), np.uint32) for g in self.T]

# ---------------- 帽子 ----------------
CAP = dict(o_edge=0.0032, o_top=0.0105, front=0.0075, L0=0.070, tilt=math.radians(13), bend=0.010, thick=0.0042, theta_b=1.36)
F_CAP = field(2.0)
def cap_off(th, t):
    th = np.asarray(th, float); t = np.asarray(t, float)
    o = CAP['o_edge'] + (CAP['o_top'] - CAP['o_edge']) * (1 - t ** 2.2)
    o = o + CAP['front'] * np.maximum(0, np.cos(th)) ** 2 * np.sin(math.pi * np.clip(t, 0, 1)) ** 1.1
    return o
def cap_point(th, t, extra=0.0):
    ph = t * PHE_CAP(th); r = sample(F_CAP, th, ph) + cap_off(th, t) + extra
    return C + r[..., None] * dirs(th, ph)
_th_f = np.linspace(0, TAU, 721)
_phe_cap = phi_at_height(F_CAP, _th_f, cap_line(_th_f), CAP['o_edge'])
def PHE_CAP(th): return np.interp(np.mod(th, TAU), _th_f, _phe_cap)

def build_cap():
    crown = Part(); crown.T = [[]]
    NT, NV = 96, 26
    ths = np.linspace(0, TAU, NT + 1)
    ts = np.concatenate([np.linspace(0.03, 0.9, 20), np.linspace(0.9, 1.0, NV - 19)[1:]])
    TT, SS = np.meshgrid(ths, ts, indexing='ij')
    P = cap_point(TT, SS)
    UV = np.stack([TT / TAU, 0.02 + 0.56 * SS], -1)
    crown.grid(P, UV)
    # 天頂（ボタンの下）を閉じる
    top = C + (sample(F_CAP, 0.0, 0.0) + cap_off(0.0, 0.0)) * np.array([0, 1.0, 0])
    ip = crown.add(top, [0.5, 0.02]); m = len(ts)
    for a in range(NT): crown.T[0].append((ip, a * m, (a + 1) * m))
    # 縁（すべり）：外側の縁から頭皮の少し内側まで折り返して、頭とのすき間を消す
    phe = PHE_CAP(ths); r_in = sample(field(0.7), ths, phe) - 0.0022
    Pin = C + r_in[:, None] * dirs(ths, phe)
    Pr = np.stack([P[:, -1], (P[:, -1] + Pin) / 2 - np.array([0, 0.0008, 0]), Pin], 1)
    UVr = np.stack([np.stack([ths / TAU] * 3, 1), np.tile([0.585, 0.592, 0.6], (NT + 1, 1))], -1)
    crown.grid(Pr, UVr)
    crown.orient()
    # 天ボタン
    btn = Part(); btn.T = [[]]
    up = np.array([0, 1.0, 0]); cb = top - up * 0.0012
    rings = []
    for k, be in enumerate(np.linspace(0, math.pi / 2, 5)):
        ring = [cb + np.array([0.0068 * math.cos(be) * math.sin(a), 0.0042 * math.sin(be), 0.0068 * math.cos(be) * math.cos(a)]) for a in np.linspace(0, TAU, 17)]
        rings.append(ring)
    btn.grid(np.array(rings).transpose(1, 0, 2), np.full((17, 5, 2), [0.5, 0.008])); btn.orient(inside_point=cb - up * 0.01)
    # つば：正面の縁（th=±theta_b の範囲）に沿って前へ。横から見て下向き、幅方向に反る
    thb = CAP['theta_b']; thf = np.linspace(-thb - 0.05, thb + 0.05, 400)
    E = cap_point(thf, np.ones_like(thf))
    Wb = float(np.interp(thb, thf, E[:, 0]))
    ns = 45; X = Wb * np.sin(np.linspace(-math.pi / 2, math.pi / 2, ns))
    zA = np.interp(X, E[:, 0], E[:, 2]); yA = np.interp(X, E[:, 0], E[:, 1])
    L = CAP['L0'] * np.clip(1 - np.abs(X / Wb) ** 2.3, 0, 1) ** (1 / 2.3)
    nt = 14; tau = np.linspace(0, 1, nt)
    XX = np.repeat(X[:, None], nt, 1); LL = np.repeat(L[:, None], nt, 1); TA = np.repeat(tau[None], ns, 0)
    ytop = yA[:, None] + 0.0032 - TA * LL * math.tan(CAP['tilt']) - CAP['bend'] * (XX / Wb) ** 2 * (TA * LL / CAP['L0'])
    ztop = zA[:, None] - 0.0018 + TA * LL
    Ptop = np.stack([XX, ytop, ztop], -1); Pbot = Ptop - np.array([0, CAP['thick'], 0])
    brim = Part()
    UVt = np.stack([(XX / Wb + 1) / 2, 0.64 + 0.32 * TA], -1)
    brim.grid(Ptop, UVt, 0)
    # 縁（半円）：外周の外向き水平方向へふくらませる
    tx = np.gradient(Ptop[:, -1, 0]); tz = np.gradient(Ptop[:, -1, 2]); nrm = np.stack([tz, np.zeros(ns), -tx], -1); nrm /= np.maximum(1e-9, np.linalg.norm(nrm, axis=1, keepdims=True))
    if (nrm[ns // 2, 2]) < 0: nrm = -nrm
    bes = np.linspace(0, math.pi, 6)
    Pe = np.stack([Ptop[:, -1] + (Pbot[:, -1] - Ptop[:, -1]) * (1 - math.cos(b)) / 2 + nrm * (CAP['thick'] / 2) * math.sin(b) for b in bes], 1)
    UVe = np.stack([np.repeat(((X / Wb + 1) / 2)[:, None], len(bes), 1), np.repeat(np.linspace(0.962, 0.978, len(bes))[None], ns, 0)], -1)
    brim.grid(Pe, UVe, 0)
    brim.grid(Pbot, UVt, 1)
    # 向き：表は上向き、裏は下向き、縁は外向き
    Vv = np.array(brim.V)
    for g in range(2):
        T = np.array(brim.T[g]); n = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]])
        if g == 0:
            cen = Vv[T].mean(1); isedge = np.array([min(t) >= len(Ptop.reshape(-1, 3)) for t in T])
            want = np.where(isedge[:, None], (cen - np.array([C[0], 0, C[2]])) * np.array([1, 0, 1]), np.array([0, 1.0, 0]))
        else:
            want = np.tile([0, -1.0, 0], (len(T), 1))
        bad = (n * want).sum(1) < 0; T[bad] = T[bad][:, ::-1]; brim.T[g] = [tuple(t) for t in T]
    # マーク：正面のパネルの中央（つばの 1.2cm 上から 5cm 角）
    mark = Part(); mark.T = [[]]
    tt = np.linspace(1, 0, 400); Pz = cap_point(np.zeros_like(tt), tt)
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Pz, axis=0), axis=1))])
    na = 17; A = np.linspace(-1, 1, na); hw, hh, c0 = 0.026, 0.025, 0.012 + 0.025
    Pm = np.zeros((na, na, 3)); UVm = np.zeros((na, na, 2))
    for i, a in enumerate(A):
        for k, b in enumerate(A):
            tb = float(np.interp(c0 + b * hh, arc, tt)); ph = tb * PHE_CAP(0.0); r = float(sample(F_CAP, 0.0, ph) + cap_off(0.0, tb))
            th = a * hw / max(1e-6, r * math.sin(ph))
            Pm[i, k] = cap_point(np.array(th), np.array(tb), 0.0009); UVm[i, k] = [(a + 1) / 2, (b + 1) / 2]
    mark.grid(Pm, UVm); mark.orient()
    return {'cap': crown, 'capBtn': btn, 'capBrim': brim, 'capMark': mark}

# ---------------- ヘルメット ----------------
HELM = dict(o_edge=0.0165, o_top=0.0215, side=0.011, L0=0.050, tilt=math.radians(7), thick=0.0058, theta_b=1.12)
F_HELM = field(4.5)
def helm_off(t, th=0.0):
    t = np.asarray(t, float); th = np.asarray(th, float)
    return HELM['o_edge'] + (HELM['o_top'] - HELM['o_edge']) * (1 - t ** 2) + HELM['side'] * np.sin(th) ** 2 * t ** 2
_phe_helm = phi_at_height(F_HELM, _th_f, helm_line(_th_f), HELM['o_edge'] + HELM['side'] * np.sin(_th_f) ** 2)
def PHE_HELM(th): return np.interp(np.mod(th, TAU), _th_f, _phe_helm)
def helm_point(th, t, extra=0.0):
    ph = t * PHE_HELM(th); r = sample(F_HELM, th, ph) + helm_off(t, th) + extra
    return C + r[..., None] * dirs(th, ph)

FLAP_R = {}
def horiz_radius(th, y, pts, wy=0.006):
    """高さ y・方位 th の付近にある点の、縦軸からの水平距離の最大値"""
    dx = pts[:, 0] - C[0]; dz = pts[:, 2] - C[2]; a = np.arctan2(dx, dz); rh = np.hypot(dx, dz)
    out = np.zeros(np.shape(th))
    for idx in np.ndindex(np.shape(th)):
        t0 = np.asarray(th)[idx]; y0 = np.asarray(y)[idx]
        da = np.abs((a - t0 + math.pi) % TAU - math.pi); m = (da < 0.16) & (np.abs(pts[:, 1] - y0) < wy)
        out[idx] = rh[m].max() if m.any() else 0.0
    return out

# ヘルメットの縁：打者用は両耳当てが一体になった殻（こめかみから下がり、耳を覆って後頭部へ）。捕手用は耳当てなし
HB_CTRL = np.array([[0, 0.036], [40, 0.034], [52, 0.030], [58, 0.016], [64, -0.012], [72, -0.042], [82, -0.062], [96, -0.068], [110, -0.064], [120, -0.052], [130, -0.040], [145, -0.032], [180, -0.030]])
def helm_edge_bat(th):
    a = np.degrees(np.abs((np.asarray(th, float) + math.pi) % TAU - math.pi)); return EYEY + np.interp(a, HB_CTRL[:, 0], HB_CTRL[:, 1])
def helm_edge_cat(th): return helm_line(th)
HEAD_NEAR = V[(V[:, 1] > EYEY - 0.12) & (V[:, 1] < EYEY + 0.05)]
def _need_grid(ths, ys, thick):
    """耳当ての内側が耳・頬・顎に当たらない外面の水平半径（方位×高さの格子）"""
    dx = HEAD_NEAR[:, 0] - C[0]; dz = HEAD_NEAR[:, 2] - C[2]; a = np.arctan2(dx, dz); rh = np.hypot(dx, dz)
    ex = EAR[:, 0] - C[0]; ez = EAR[:, 2] - C[2]; ea = np.arctan2(ex, ez); er = np.hypot(ex, ez)
    out = np.zeros((len(ths), len(ys))); oute = np.zeros((len(ths), len(ys)))
    earset = set(map(tuple, np.round(EAR, 6)))
    notear = np.array([tuple(np.round(p, 6)) not in earset for p in HEAD_NEAR])
    for i, t0 in enumerate(ths):
        da = (np.abs((a - t0 + math.pi) % TAU - math.pi) < 0.07) & notear; dea = np.abs((ea - t0 + math.pi) % TAU - math.pi) < 0.07
        for k, y0 in enumerate(ys):
            m = da & (np.abs(HEAD_NEAR[:, 1] - y0) < 0.004); me = dea & (np.abs(EAR[:, 1] - y0) < 0.004)
            out[i, k] = rh[m].max() + thick + 0.003 if m.any() else 0
            oute[i, k] = er[me].max() + thick + 0.0055 if me.any() else 0
    return out, oute

def _ellipse_r(th, a, b, zo):
    """中心 (C.x, C.z+zo)、半径 a（横）b（前後）の楕円までの、C からの方位 th の距離"""
    s_, c_ = np.sin(th), np.cos(th); A = s_ ** 2 / a ** 2 + c_ ** 2 / b ** 2; B = zo * c_ / b ** 2; Cc = zo ** 2 / b ** 2 - 1
    return (B + np.sqrt(np.maximum(B * B - A * Cc, 0))) / A

def skirt_field(ths, ys, need_h, need_e, Req, yeq):
    """耳当て部分の半径：各高さで頭を包む最小の楕円＋耳のふくらみ（なめらかな形にする）"""
    As = np.arange(0.07, 0.125, 0.002); Bs = np.arange(0.07, 0.135, 0.002); Zs = np.arange(-0.012, 0.0121, 0.004)
    AA, BB, ZZ = np.meshgrid(As, Bs, Zs, indexing='ij'); AA = AA.ravel(); BB = BB.ravel(); ZZ = ZZ.ravel()
    Rall = _ellipse_r(ths[None, :], AA[:, None], BB[:, None], ZZ[:, None])  # (combos, NT)
    par = np.zeros((len(ys), 3)); valid = np.zeros(len(ys), bool)
    for k in range(len(ys)):
        nd = need_h[:, k]
        if nd.max() <= 0: continue
        ok = (Rall >= nd[None, :]).all(1)
        if not ok.any(): continue
        j = np.argmin(np.where(ok, AA * BB, np.inf)); par[k] = [AA[j], BB[j], ZZ[j]]; valid[k] = True
    # 上の方（頭のてっぺん寄り）は有効な最初の値で埋め、高さ方向にならす
    if valid.any():
        first = np.argmax(valid); par[:first] = par[first]
        for k in range(1, len(ys)):
            if not valid[k]: par[k] = par[k - 1]
        par = ndimage.gaussian_filter1d(ndimage.maximum_filter1d(par, 9, axis=0), 5, axis=0)
    Rel = np.stack([_ellipse_r(ths, *par[k]) for k in range(len(ys))], 1)  # (NT, ny)
    # 耳のふくらみ（上下が平らな山）
    th_e = abs(math.atan2(EAR[EAR[:, 0] > 0].mean(0)[0] - C[0], EAR[EAR[:, 0] > 0].mean(0)[2] - C[2]))
    shape = np.exp(-(np.abs(np.abs((ths + math.pi) % TAU - math.pi) - th_e) / 0.42) ** 2.6)
    A = np.max(np.maximum(need_e - Rel, 0) / np.maximum(shape[:, None], 0.2), axis=0)
    A = ndimage.gaussian_filter1d(ndimage.maximum_filter1d(A, 21), 7) + 0.0012
    R = Rel + shape[:, None] * A[None, :]
    return np.maximum(R, Req[:, None] * 0 + R)

def build_shell(edge_fn, NT=80, NVd=18, NVs=12, ear=True, thick=0.0105):
    """頭頂から縁までの経線を方位ごとに作る。ドーム（頭の形＋すき間）→ いちばん張り出した所から下はまっすぐ下ろす（耳当て）。
    外面と内面（パッド）は同じ経線パラメータで作るので交差しない。行はドーム部と下ろした部分で別々にそろえる"""
    ths = np.linspace(0, TAU, NT + 1)
    phs = np.radians(np.arange(0, 128, 0.5))
    ys = np.arange(EYEY + 0.06, EYEY - 0.085, -0.001)
    o_e, o_t, side = HELM['o_edge'], HELM['o_top'], HELM['side']
    dome = []
    for th in ths[:-1]:
        rs = sample(F_HELM, np.full_like(phs, th), phs)
        q = np.clip(phs / 1.65, 0, 1)
        off = o_e + (o_t - o_e) * (1 - q ** 2) + side * math.sin(th) ** 2 * q ** 2
        r = rs + off
        Rh = r * np.sin(phs); lo = np.nonzero(phs > math.radians(45))[0]
        k_eq = lo[np.argmax(Rh[lo])]
        dome.append((r, Rh, k_eq))
    Req = np.array([d[1][d[2]] for d in dome]); yeq = np.array([C[1] + d[0][d[2]] * math.cos(phs[d[2]]) for d in dome])
    if ear:
        need_h, need_e = _need_grid(ths[:-1], ys, thick)
        R = skirt_field(ths[:-1], ys, need_h, need_e, Req, yeq)
        R = np.maximum(R, Req[:, None] - 0.0025 * np.clip((yeq[:, None] - ys[None]) / 0.06, 0, 1))
        R = ndimage.gaussian_filter(R, (1.5, 3.0), mode=('wrap', 'nearest'))
    else:
        R = np.repeat(Req[:, None], len(ys), 1) - 0.0025 * np.clip((yeq[:, None] - ys[None]) / 0.06, 0, 1)
    ramp = np.clip((yeq[:, None] - ys[None]) / 0.034, 0, 1); ramp = ramp * ramp * (3 - 2 * ramp)
    R = Req[:, None] + (R - Req[:, None]) * ramp
    OUT = np.zeros((NT + 1, NVd + NVs, 3)); INN = np.zeros_like(OUT)
    def resample(Po, Pi, n):
        if len(Po) < 2: return np.repeat(Po[:1], n, 0), np.repeat(Pi[:1], n, 0)
        sl = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(Po, axis=0), axis=1))])
        if sl[-1] < 1e-9: return np.repeat(Po[:1], n, 0), np.repeat(Pi[:1], n, 0)
        ss = np.linspace(0, sl[-1], n)
        return (np.stack([np.interp(ss, sl, Po[:, k]) for k in range(3)], -1), np.stack([np.interp(ss, sl, Pi[:, k]) for k in range(3)], -1))
    for i, th in enumerate(ths[:-1]):
        r, Rh, k_eq = dome[i]; d = dirs(np.full_like(phs, th), phs); ye = float(edge_fn(th))
        Pd = C + r[:, None] * d; Pdi = C + (r - thick)[:, None] * d
        if ye >= Pd[k_eq, 1]:
            k = int(np.nonzero(Pd[:, 1] <= ye)[0][0]); f = (Pd[k - 1, 1] - ye) / max(1e-9, Pd[k - 1, 1] - Pd[k, 1])
            Po = np.vstack([Pd[:k], Pd[k - 1] + (Pd[k] - Pd[k - 1]) * f]); Pi = np.vstack([Pdi[:k], Pdi[k - 1] + (Pdi[k] - Pdi[k - 1]) * f])
            Ro, Ri = resample(Po, Pi, NVd); So = np.repeat(Ro[-1:], NVs, 0); Si = np.repeat(Ri[-1:], NVs, 0)
        else:
            Ro, Ri = resample(Pd[:k_eq + 1], Pdi[:k_eq + 1], NVd)
            yy = np.concatenate([ys[(ys < Pd[k_eq, 1]) & (ys > ye)], [ye]])
            Rs = np.interp(yy, ys[::-1], R[i][::-1])
            sk_o = np.stack([C[0] + Rs * math.sin(th), yy, C[2] + Rs * math.cos(th)], -1); sk_i = np.stack([C[0] + (Rs - thick) * math.sin(th), yy, C[2] + (Rs - thick) * math.cos(th)], -1)
            So, Si = resample(np.vstack([Ro[-1:], sk_o]), np.vstack([Ri[-1:], sk_i]), NVs + 1); So = So[1:]; Si = Si[1:]
        OUT[i] = np.vstack([Ro, So]); INN[i] = np.vstack([Ri, Si])
    OUT[-1] = OUT[0]; INN[-1] = INN[0]
    NV = NVd + NVs
    vv = np.concatenate([np.linspace(0, 0.6, NVd), np.linspace(0.6, 0.9, NVs + 1)[1:]])
    UV = np.stack([np.repeat((ths / TAU)[:, None], NV, 1), np.repeat(vv[None], NT + 1, 0)], -1)
    shell = Part(); shell.grid(OUT, UV, 0)
    # 縁：外面の縁から内面の縁へ、下にふくらむ半円でつなぐ
    Eo = OUT[:, -1]; Ei = INN[:, -1]; mid = (Eo + Ei) / 2; half = (Eo - Ei) / 2; down = np.array([0, -1.0, 0]) * (thick / 2)
    Prim = np.stack([mid + half * math.cos(b) + down * math.sin(b) for b in np.linspace(0, math.pi, 7)], 1)
    shell.grid(Prim, np.stack([np.repeat((ths / TAU)[:, None], 7, 1), np.full((NT + 1, 7), 0.95)], -1), 0)
    k0 = NVd // 2
    Pin = INN[:, k0:][:, ::-1]
    shell.grid(Pin, np.full(Pin.shape[:2] + (2,), [0.5, 0.97]), 1)
    ip = shell.add(OUT[0, 0], [0.5, 0.0])
    for a_ in range(NT): shell.T[0].append((ip, a_ * NV, (a_ + 1) * NV))
    # 向き：外面と縁は外向き（縁は下向き寄り）、内面は内向き
    Vv = np.array(shell.V)
    for g in range(2):
        T = np.array(shell.T[g]); nn = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]]); c = Vv[T].mean(1) - C
        nrm_ok = np.linalg.norm(nn, axis=1) > 1e-14
        bad = (((nn * c).sum(1) < 0) == (g == 0)) & nrm_ok; T[bad] = T[bad][:, ::-1]
        shell.T[g] = [tuple(t) for t, ok in zip(T, nrm_ok) if ok]
    return shell, OUT, ths, None

def ear_check(Pg, ths, thick):
    """耳の点が殻の内面より内側にあるか（その方位の経線を高さで補間して水平距離を比べる）。正なら余裕あり"""
    worst = 1.0; n = 0
    for p in EAR:
        th = math.atan2(p[0] - C[0], p[2] - C[2]); i = int(round((th % TAU) / TAU * (len(ths) - 1))) % (len(ths) - 1)
        col = Pg[i]; yv = col[:, 1]; rv = np.hypot(col[:, 0] - C[0], col[:, 2] - C[2])
        if not (yv.min() <= p[1] <= yv.max()): worst = min(worst, -1.0); continue
        o = np.argsort(yv); r = float(np.interp(p[1], yv[o], rv[o])); n += 1
        worst = min(worst, r - thick - math.hypot(p[0] - C[0], p[2] - C[2]))
    return worst

def visor(Pg, ths, thb, L0, tilt, thick, bend):
    """殻の正面の縁につば（ひさし）を付ける"""
    E = Pg[:, -1]; th_s = np.where(ths > math.pi, ths - TAU, ths); o = np.argsort(th_s); th_s = th_s[o]; E = E[o]
    keep = np.abs(th_s) <= thb + 0.06; th_s = th_s[keep]; E = E[keep]
    Wb = float(np.interp(thb, th_s, E[:, 0])); ns = 37; X = Wb * np.sin(np.linspace(-math.pi / 2, math.pi / 2, ns))
    ox = np.argsort(E[:, 0]); zA = np.interp(X, E[ox, 0], E[ox, 2]); yA = np.interp(X, E[ox, 0], E[ox, 1])
    Lx = L0 * np.clip(1 - np.abs(X / Wb) ** 2.6, 0, 1) ** (1 / 2.6)
    nt = 10; tau = np.linspace(0, 1, nt); XX = np.repeat(X[:, None], nt, 1); LL = np.repeat(Lx[:, None], nt, 1); TA = np.repeat(tau[None], ns, 0)
    ytop = yA[:, None] + 0.004 - TA * LL * math.tan(tilt) - bend * (XX / Wb) ** 2 * TA
    Ptop = np.stack([XX, ytop, zA[:, None] - 0.005 + TA * LL], -1); Pbot = Ptop - np.array([0, thick, 0])
    hb = Part(); hb.grid(Ptop, np.full((ns, nt, 2), [0.5, 0.5]), 0)
    tx = np.gradient(Ptop[:, -1, 0]); tz = np.gradient(Ptop[:, -1, 2]); nrm = np.stack([tz, np.zeros(ns), -tx], -1); nrm /= np.maximum(1e-9, np.linalg.norm(nrm, axis=1, keepdims=True))
    if nrm[ns // 2, 2] < 0: nrm = -nrm
    Pe = np.stack([Ptop[:, -1] + (Pbot[:, -1] - Ptop[:, -1]) * (1 - math.cos(b)) / 2 + nrm * (thick / 2) * math.sin(b) for b in np.linspace(0, math.pi, 6)], 1)
    hb.grid(Pe, np.full(Pe.shape[:2] + (2,), [0.5, 0.5]), 0); hb.grid(Pbot, np.full((ns, nt, 2), [0.5, 0.5]), 1)
    Vv = np.array(hb.V); npt = ns * nt
    for g in range(2):
        T = np.array(hb.T[g]); nn = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]])
        if g == 0:
            cen = Vv[T].mean(1); isedge = np.array([min(t) >= npt for t in T])
            want = np.where(isedge[:, None], (cen - np.array([C[0], 0, C[2]])) * np.array([1, 0, 1]), np.array([0, 1.0, 0]))
        else: want = np.tile([0, -1.0, 0], (len(T), 1))
        bad = (nn * want).sum(1) < 0; T[bad] = T[bad][:, ::-1]; hb.T[g] = [tuple(t) for t in T]
    return hb

def front_mark(Pg, hw, hh, gap, lift):
    """殻の正面（th=0 の経線）に沿って、縁から gap 上に高さ 2*hh・幅 2*hw のマークを貼る"""
    col = Pg[0][::-1]  # 縁→頭頂
    arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(col, axis=0), axis=1))])
    na = 15; A = np.linspace(-1, 1, na); Pm = np.zeros((na, na, 3)); UVm = np.zeros((na, na, 2))
    nT = len(Pg) - 1
    for k, b in enumerate(A):
        s = gap + hh + b * hh
        for i, a_ in enumerate(A):
            # 横方向は同じ高さの点を経線の間で補間（弧長で hw*a）
            ring = np.array([Pg[j][::-1][int(np.clip(np.searchsorted(arc, s), 1, len(arc) - 1))] for j in range(nT)])
            ring = np.vstack([ring[nT // 2:], ring[:nT // 2]])  # th=-π..π の順に
            mid = nT - nT // 2
            ra = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(ring, axis=0), axis=1))]); ra -= ra[mid]
            p = np.array([np.interp(a_ * hw, ra, ring[:, q]) for q in range(3)])
            nrm = p - C; nrm /= np.linalg.norm(nrm)
            Pm[i, k] = p + nrm * lift; UVm[i, k] = [(a_ + 1) / 2, (b + 1) / 2]
    m = Part(); m.T = [[]]; m.grid(Pm, UVm); m.orient(); return m

def build_helmet():
    thick = 0.0105
    bat, Pg, ths, L = build_shell(helm_edge_bat, ear=True, thick=thick)
    print('helmet: ear clearance (m) %.4f' % ear_check(Pg, ths, thick))
    cat, Pc, _, _ = build_shell(helm_edge_cat, NVd=18, NVs=5, ear=False, thick=0.0095)
    hb = visor(Pg, ths, 0.92, HELM['L0'], HELM['tilt'], HELM['thick'], 0.004)
    mark = front_mark(Pg, 0.024, 0.022, 0.012, 0.0008)
    # 耳穴の位置（殻の UV）：耳の中心の方位と高さ
    EARC = EAR[EAR[:, 0] > 0].mean(0); th_e = math.atan2(EARC[0] - C[0], EARC[2] - C[2]); i = int(round((th_e % TAU) / TAU * (len(ths) - 1)))
    col = Pg[i]; k = int(np.argmin(np.abs(col[:, 1] - EARC[1])))
    vv = np.concatenate([np.linspace(0, 0.6, 18), np.linspace(0.6, 0.9, 13)[1:]]); v_e = float(vv[k])
    return {'helmet': bat, 'helmCatcher': cat, 'helmBrim': hb, 'helmMark': mark}, (float((th_e % TAU) / TAU), v_e)

# ---------------- 捕手・審判のマスク ----------------
def tube(path, r, n=6):
    """折れ線に沿った管（平行移動フレーム）"""
    P = np.asarray(path, float); T = np.gradient(P, axis=0); T /= np.maximum(1e-9, np.linalg.norm(T, axis=1, keepdims=True))
    ref = np.array([0, 1.0, 0]) if abs(T[0, 1]) < 0.9 else np.array([1.0, 0, 0])
    N0 = np.cross(T[0], ref); N0 /= np.linalg.norm(N0); Ns = [N0]
    for k in range(1, len(P)):
        nn = Ns[-1] - T[k] * np.dot(Ns[-1], T[k]); nn /= max(1e-9, np.linalg.norm(nn)); Ns.append(nn)
    Ns = np.array(Ns); Bs = np.cross(T, Ns)
    ang = np.linspace(0, TAU, n + 1)
    return np.stack([P + r * (np.cos(a) * Ns + np.sin(a) * Bs) for a in ang], 1)  # (len, n+1, 3)

def build_mask():
    m = Part()
    # 顔の正面の出っ張り（中心線付近の z の最大）を高さごとに
    face = V[(np.abs(V[:, 0]) < 0.025) & (V[:, 2] > EYE[2] - 0.03)]
    ys = np.linspace(EYEY + 0.03, EYEY - 0.13, 81)
    zf = np.array([face[np.abs(face[:, 1] - y) < 0.004][:, 2].max() if (np.abs(face[:, 1] - y) < 0.004).any() else np.nan for y in ys])
    zf = np.where(np.isnan(zf), np.nanmin(zf), zf); zfr = ndimage.maximum_filter1d(zf, 9)
    zc = C[2] + 0.012; A_ = 0.088
    def zfront(y): return float(np.interp(y, ys[::-1], zfr[::-1])) + 0.034
    def arc_pts(y, a=A_, back=0.0, psi_s=None, n=25):
        b = zfront(y) - zc - back; ps = psi_s if psi_s is not None else math.asin(0.083 / a)
        psi = np.linspace(-ps, ps, n); return np.stack([a * np.sin(psi), np.full(n, y), zc + b * np.cos(psi)], -1)
    y_top, y_bot = EYEY + 0.018, EYEY - 0.112
    bars = [y_top, EYEY - 0.028, EYEY - 0.062, EYEY - 0.09, y_bot]
    for k, y in enumerate(bars):
        P = tube(arc_pts(y), 0.0026 if 0 < k < 4 else 0.0032); m.grid(P, np.full(P.shape[:2] + (2,), [0.5, 0.5]), 0)
    # 縦の棒（中央の2本）と横の枠（耳の前）
    yv = np.linspace(y_top, y_bot, 20)
    for x in (-0.017, 0.017):
        path = np.array([[x, y, zc + (zfront(y) - zc) * math.cos(math.asin(x / A_))] for y in yv]); P = tube(path, 0.0025); m.grid(P, np.full(P.shape[:2] + (2,), [0.5, 0.5]), 0)
    ps = math.asin(0.083 / A_)
    for sg in (-1, 1):
        path = np.array([[sg * A_ * math.sin(ps), y, zc + (zfront(y) - zc) * math.cos(ps)] for y in yv]); P = tube(path, 0.0034); m.grid(P, np.full(P.shape[:2] + (2,), [0.5, 0.5]), 0)
    # パッド（枠の内側の太いクッション）：上・左右・下
    loop = np.vstack([arc_pts(y_top, back=0.01)[::-1]] + [np.array([[sg * (A_ - 0.004) * math.sin(ps), y, zc + (zfront(y) - zc - 0.01) * math.cos(ps)] for y in yv]) for sg in (-1,)] + [arc_pts(y_bot, back=0.01)] + [np.array([[(A_ - 0.004) * math.sin(ps), y, zc + (zfront(y) - zc - 0.01) * math.cos(ps)] for y in yv[::-1]])])
    P = tube(loop, 0.0075, 10); m.grid(P, np.full(P.shape[:2] + (2,), [0.5, 0.5]), 1)
    # のど当て
    gb = arc_pts(y_bot, back=0.006, psi_s=0.42, n=13); rows = []
    for k, d in enumerate(np.linspace(0, 0.048, 6)):
        rows.append(gb + np.array([0, -d, d * 0.35]))
    Pt = np.array(rows).transpose(1, 0, 2); m.grid(Pt, np.full(Pt.shape[:2] + (2,), [0.5, 0.5]), 1)
    m.grid(Pt - np.array([0, 0, 0.004]), np.full(Pt.shape[:2] + (2,), [0.5, 0.5]), 1, flip=True)
    # 後ろのベルト（上：帽子の上を通る、下：耳の下を通る）
    hd = V[(V[:, 1] > EYEY - 0.11) & (V[:, 1] < EYEY + 0.05)]
    hx = hd[:, 0] - C[0]; hz = hd[:, 2] - C[2]; ha = np.arctan2(hx, hz); hr = np.hypot(hx, hz)
    for ys_, off in ((EYEY + 0.012, 0.0085), (EYEY - 0.068, 0.0035)):
        ths_ = np.linspace(1.2, TAU - 1.2, 41); pts = []
        for t in ths_:
            mm = (np.abs((ha - t + math.pi) % TAU - math.pi) < 0.08) & (np.abs(hd[:, 1] - ys_) < 0.006)
            rr = (hr[mm].max() if mm.any() else 0.08) + off; pts.append([C[0] + rr * math.sin(t), ys_, C[2] + rr * math.cos(t)])
        pts = ndimage.gaussian_filter1d(np.array(pts), 1.5, axis=0)
        rib = np.stack([pts + np.array([0, -0.008, 0]), pts + np.array([0, 0.008, 0])], 1)
        m.grid(rib, np.full(rib.shape[:2] + (2,), [0.5, 0.5]), 1); m.grid(rib, np.full(rib.shape[:2] + (2,), [0.5, 0.5]), 1, flip=True)
    return {'mask': m}

# ---------------- 捕手のプロテクターとレガース（体の骨に追従するスキンメッシュ） ----------------
VC = D['Vc']; TT_T = D['tight_tris']; WI = D['wi']; WW = D['ww']; DOM = D['dom']
TQ0, TQ1, TQ2 = VC[TT_T[:, 0]], VC[TT_T[:, 1]], VC[TT_T[:, 2]]
def ray_from(O, Dd):
    """原点ごと（O: (n,3)）の光線とユニフォームの殻の交点距離"""
    out = np.full(len(Dd), np.nan)
    for k in range(len(Dd)):
        out[k] = raycast(O[k], Dd[k:k + 1], TQ0, TQ1, TQ2)[0]
    return out

def skin_weights(P, allowed):
    """各点にいちばん近い体の頂点の骨の重みを写す（allowed 以外の骨は外して正規化）"""
    cand = np.nonzero(np.isin(DOM, [JOINTS.index(j) for j in allowed]))[0]
    from scipy.spatial import cKDTree
    tree = cKDTree(V[cand]); _, ii = tree.query(P); idx = cand[ii]
    wi = WI[idx].astype(np.uint16).copy(); ww = WW[idx].astype(np.float32).copy()
    ok = np.isin(wi, [JOINTS.index(j) for j in allowed]); ww = np.where(ok, ww, 0)
    ssum = ww.sum(1, keepdims=True); bad = ssum[:, 0] < 1e-6
    ww[bad] = 0; ww[bad, 0] = 1; wi[bad, 0] = DOM[idx[bad]]; ssum = ww.sum(1, keepdims=True)
    return wi, ww / ssum

def build_protector():
    """胸のプロテクター：ユニフォームの胸の面から 1.6cm 外。のどの下から腰まで、肩当て付き"""
    nu, nw = 31, 28; U = np.linspace(-1, 1, nu); Wd = np.linspace(0, 1, nw)
    zc = 0.022
    def th_max(y): return np.interp(y, [0.98, 1.08, 1.30, 1.40, 1.47], [1.05, 1.28, 1.28, 1.05, 0.95])
    def y_top(th):
        a = np.abs(th); return np.interp(a, [0, 0.3, 0.55, 0.85, 1.0, 1.2, 1.3], [1.418, 1.432, 1.462, 1.468, 1.43, 1.33, 1.26])
    def y_bot(th):
        a = np.abs(th); return np.interp(a, [0, 0.5, 0.9, 1.3], [1.005, 1.018, 1.04, 1.075])
    UU, WW_ = np.meshgrid(U, Wd, indexing='ij')
    # 高さはまず中心の値で決め、その高さでの横幅で方位を広げる（2回まわして整合）
    TH = UU * 1.2
    for _ in range(3):
        Y = y_bot(TH) + WW_ * (y_top(TH) - y_bot(TH)); TH = UU * th_max(Y)
    O = np.stack([np.zeros_like(Y), Y, np.full_like(Y, zc)], -1).reshape(-1, 3)
    Dd = np.stack([np.sin(TH), np.zeros_like(TH), np.cos(TH)], -1).reshape(-1, 3)
    r = ray_from(O, Dd).reshape(nu, nw)
    if np.isnan(r).any():
        idx = ndimage.distance_transform_edt(np.isnan(r), return_distances=False, return_indices=True); r = r[idx[0], idx[1]]
    r = ndimage.gaussian_filter(ndimage.maximum_filter(r, 3), 1.5) + 0.016
    Po = O.reshape(nu, nw, 3) + Dd.reshape(nu, nw, 3) * r[..., None]
    Pi = O.reshape(nu, nw, 3) + Dd.reshape(nu, nw, 3) * (r - 0.02)[..., None]
    part = Part(); uv = np.stack([0.5 * (UU + 1) / 2, WW_], -1)
    part.grid(Po, uv, 0); part.grid(Pi, np.full(Pi.shape[:2] + (2,), [0.25, 0.5]), 1)
    # 外周の丸い縁
    ring_o = np.concatenate([Po[:, 0], Po[-1, 1:], Po[::-1, -1][1:], Po[0, ::-1][1:-1]]); ring_i = np.concatenate([Pi[:, 0], Pi[-1, 1:], Pi[::-1, -1][1:], Pi[0, ::-1][1:-1]])
    ring_o = np.vstack([ring_o, ring_o[:1]]); ring_i = np.vstack([ring_i, ring_i[:1]])
    mid = (ring_o + ring_i) / 2; half = (ring_o - ring_i) / 2
    tg = np.gradient(mid, axis=0); out = np.cross(tg, half); out /= np.maximum(1e-9, np.linalg.norm(out, axis=1, keepdims=True))
    cen = Po.reshape(-1, 3).mean(0)
    if ((mid - cen) * out).sum() < 0: out = -out
    Pr = np.stack([mid + half * math.cos(b) + out * 0.006 * math.sin(b) for b in np.linspace(0, math.pi, 6)], 1)
    part.grid(Pr, np.full(Pr.shape[:2] + (2,), [0.25, 0.995]), 0)
    # 向き：外面と縁は胴の軸から外向き、内面は内向き
    Vv = np.array(part.V)
    for g in range(2):
        T = np.array(part.T[g]); n = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]]); c = Vv[T].mean(1); c = (c - np.stack([np.zeros(len(c)), c[:, 1], np.full(len(c), zc)], -1))
        bad = ((n * c).sum(1) < 0) == (g == 0); T[bad] = T[bad][:, ::-1]; part.T[g] = [tuple(t) for t in T]
    part.skin = skin_weights(np.array(part.V), ['hips', 'torso', 'chest'])
    return part

def build_legguard(side):
    """すね当て（レガース）：足首からひざ上まで、すねの前と横を覆う。ひざの皿付き。すねの骨に固定"""
    kn = POS[side + 'Knee']; ft = POS[side + 'Foot'] + np.array([0, 0.03, 0])
    ax = kn - ft; L = np.linalg.norm(ax); ax /= L
    f = np.array([0, 0, 1.0]); f = f - ax * f.dot(ax); f /= np.linalg.norm(f); sdir = np.cross(ax, f)
    nu, nt = 25, 24; U = np.linspace(-1, 1, nu); Tt = np.linspace(0.0, 1.13, nt)
    UU, TT = np.meshgrid(U, Tt, indexing='ij')
    thw = np.interp(TT, [0, 0.85, 1.0, 1.13], [2.0, 2.0, 1.45, 0.75]); TH = UU * thw
    O = ft[None, None, :] + TT[..., None] * L * ax[None, None, :]
    Dd = np.cos(TH)[..., None] * f + np.sin(TH)[..., None] * sdir
    r = ray_from(O.reshape(-1, 3), Dd.reshape(-1, 3)).reshape(nu, nt)
    if np.isnan(r).any():
        idx = ndimage.distance_transform_edt(np.isnan(r), return_distances=False, return_indices=True); r = r[idx[0], idx[1]]
    r = ndimage.gaussian_filter(ndimage.maximum_filter(r, 3), 1.2) + 0.012
    # ひざの皿：前に少しふくらませる
    r = r + 0.012 * np.exp(-((TT - 1.0) / 0.07) ** 2) * np.exp(-(TH / 0.7) ** 2)
    Po = O + Dd * r[..., None]; Pi = O + Dd * (r - 0.016)[..., None]
    part = Part(); uv = np.stack([0.5 + 0.5 * (UU + 1) / 2, np.clip(TT / 1.13, 0, 1)], -1)
    part.grid(Po, uv, 0); part.grid(Pi, np.full(Pi.shape[:2] + (2,), [0.75, 0.5]), 1)
    ring_o = np.concatenate([Po[:, 0], Po[-1, 1:], Po[::-1, -1][1:], Po[0, ::-1][1:-1]]); ring_i = np.concatenate([Pi[:, 0], Pi[-1, 1:], Pi[::-1, -1][1:], Pi[0, ::-1][1:-1]])
    ring_o = np.vstack([ring_o, ring_o[:1]]); ring_i = np.vstack([ring_i, ring_i[:1]])
    mid = (ring_o + ring_i) / 2; half = (ring_o - ring_i) / 2
    tg = np.gradient(mid, axis=0); out = np.cross(tg, half); out /= np.maximum(1e-9, np.linalg.norm(out, axis=1, keepdims=True))
    cen = Po.reshape(-1, 3).mean(0)
    if ((mid - cen) * out).sum() < 0: out = -out
    Pr = np.stack([mid + half * math.cos(b) + out * 0.005 * math.sin(b) for b in np.linspace(0, math.pi, 6)], 1)
    part.grid(Pr, np.full(Pr.shape[:2] + (2,), [0.75, 0.995]), 0)
    Vv = np.array(part.V)
    for g in range(2):
        T = np.array(part.T[g]); n = np.cross(Vv[T[:, 1]] - Vv[T[:, 0]], Vv[T[:, 2]] - Vv[T[:, 0]]); c = Vv[T].mean(1) - ft; c = c - np.outer(c @ ax, ax)
        bad = ((n * c).sum(1) < 0) == (g == 0); T[bad] = T[bad][:, ::-1]; part.T[g] = [tuple(t) for t in T]
    n = len(part.V); wi = np.zeros((n, 4), np.uint16); wi[:, 0] = JOINTS.index(side + 'Knee'); ww = np.zeros((n, 4), np.float32); ww[:, 0] = 1
    part.skin = (wi, ww)
    return part

def make_catcher_texture():
    """プロテクター（左半分）とレガース（右半分）の模様：パッドの区切り・縁取り"""
    S = 512; v, u = np.mgrid[0:S, 0:S].astype(np.float64); u = (u + 0.5) / S; v = (v + 0.5) / S
    mul = np.ones((S, S)) * (0.97 + 0.05 * noise_tex(S, S, 16, 7)); hgt = np.zeros((S, S))
    L = u < 0.5; uu = u / 0.5  # 0..1（プロテクター）
    for x0 in (0.5, 0.22, 0.78):
        d = np.abs(uu - x0) * 0.42 * 1000; g = np.exp(-(d / 1.6) ** 2); mul = np.where(L, mul * (1 - 0.35 * g), mul); hgt = np.where(L, hgt - 2.0 * g, hgt)
    for y0 in (0.2, 0.38, 0.56, 0.74, 0.88):
        d = np.abs(v - y0) * 0.45 * 1000; g = np.exp(-(d / 1.6) ** 2); mul = np.where(L, mul * (1 - 0.3 * g), mul); hgt = np.where(L, hgt - 1.8 * g, hgt)
    R = ~L; ur = (u - 0.5) / 0.5
    for x0 in (0.3, 0.5, 0.7):
        d = np.abs(ur - x0) * 0.25 * 1000; g = np.exp(-(d / 2.2) ** 2); mul = np.where(R, mul * (1 + 0.06 * g), mul); hgt = np.where(R, hgt + 2.5 * g, hgt)
    for y0 in (0.33, 0.62, 0.86):
        d = np.abs(v - y0) * 0.5 * 1000; g = np.exp(-(d / 1.5) ** 2); mul = np.where(R, mul * (1 - 0.3 * g), mul); hgt = np.where(R, hgt - 1.6 * g, hgt)
    edge = v > 0.985; mul = np.where(edge, mul * 0.55, mul)
    Image.fromarray(np.clip(mul * 250, 0, 255).astype(np.uint8)).convert('RGB').save(os.path.join(OUT, 'catcher.jpg'), quality=88)
    hs = ndimage.gaussian_filter(hgt, 1.0); gy, gx = np.gradient(hs); k = 0.5; nx = -gx * k; ny = -gy * k; nz = np.ones_like(nx); l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    Image.fromarray(np.clip(np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5], -1) * 255, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'catcher_n.jpg'), quality=90)
    print('saved catcher.jpg catcher_n.jpg')

# ---------------- テクスチャ ----------------
def noise_tex(h, w, cell, seed):
    r = np.random.RandomState(seed); n = r.rand(h // cell + 3, w // cell + 3)
    return ndimage.zoom(n, cell, order=3)[:h, :w]

def make_cap_textures():
    S = 1024; v, u = np.mgrid[0:S, 0:S].astype(np.float64); u = (u + 0.5) / S; v = (v + 0.5) / S
    mul = np.ones((S, S)); hgt = np.zeros((S, S))
    # 布目（綾織り：斜めの細い畝）
    tw = np.sin((u * S * 1.0 + v * S * 1.0) * 2 * math.pi / 3.2)
    mul *= 1 + 0.025 * tw; hgt += 0.12 * tw
    mul *= 0.97 + 0.06 * noise_tex(S, S, 24, 1)
    # クラウン：縫い目（6枚はぎ・正面中央にも縫い目）
    crown = (v > 0.015) & (v < 0.58); t = np.clip((v - 0.02) / 0.56, 0, 1)
    r_avg = 0.10; phe_avg = float(np.mean(_phe_cap)); circ = TAU * r_avg * np.sin(np.maximum(t, 0.03) * phe_avg)  # その高さの周の長さ（m）
    du = np.abs(((u * 6 + 0.5) % 1) - 0.5) / 6  # 最も近い縫い目までの u の差
    dmm = du * circ * 1000  # mm
    seam = np.exp(-(dmm / 0.55) ** 2)
    stitch_row = np.exp(-((dmm - 2.4) / 0.32) ** 2)
    along = t * 0.56 * 0.14 * 1000  # 縫い目方向の長さ（だいたい mm）
    dash = (np.sin(along * 2 * math.pi / 2.6) > -0.2).astype(float)
    mul = np.where(crown, mul * (1 - 0.42 * seam) * (1 - 0.28 * stitch_row * dash), mul)
    hgt = np.where(crown, hgt - 1.6 * seam - 0.5 * stitch_row * dash, hgt)
    # ハトメ（横と後ろの4枚、上から3割の所）
    pan = np.floor(u * 6 + 0.5) % 6
    for k in (1, 2, 3, 4):
        uc = k / 6; tc = 0.30
        dx = (((u - uc + 0.5) % 1) - 0.5) * circ * 1000; dy = (t - tc) * 0.56 * 0.15 * 1000
        rr = np.hypot(dx, dy)
        ring = np.exp(-((rr - 2.3) / 0.6) ** 2); hole = rr < 1.5
        mul = np.where(crown, mul * (1 + 0.12 * ring) * np.where(hole, 0.32, 1), mul); hgt = np.where(crown, hgt + 0.8 * ring - 1.2 * hole, hgt)
    # すべり（縁の内側の帯）
    band = (v >= 0.58) & (v < 0.62); mul = np.where(band, mul * 0.78, mul)
    # つば（表）：外周に平行なステッチ8本
    brim = (v >= 0.64) & (v < 0.962); tau = (v - 0.64) / 0.32
    for k in range(8):
        tk = 0.42 + k * 0.07
        row = np.exp(-((tau - tk) / 0.0045) ** 2) * (np.sin(u * 2 * math.pi * 150) > -0.3)
        mul = np.where(brim, mul * (1 - 0.3 * row), mul); hgt = np.where(brim, hgt - 0.6 * row, hgt)
    edge = (v >= 0.962) & (v < 0.98); mul = np.where(edge, mul * 0.9, mul)
    Image.fromarray(np.clip(mul * 250, 0, 255).astype(np.uint8)).convert('RGB').save(os.path.join(OUT, 'cap.jpg'), quality=88)
    # 法線マップ（高さの勾配）
    hs = ndimage.gaussian_filter(hgt, 0.7)
    gy, gx = np.gradient(hs)
    k = 0.9; nx = -gx * k; ny = -gy * k; nz = np.ones_like(nx); l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    nm = np.stack([(nx / l * 0.5 + 0.5), (ny / l * 0.5 + 0.5), (nz / l * 0.5 + 0.5)], -1) * 255
    Image.fromarray(np.clip(nm, 0, 255).astype(np.uint8)).save(os.path.join(OUT, 'cap_n.jpg'), quality=92)
    print('saved cap.jpg cap_n.jpg')

def make_helmet_texture(ear_uv):
    S = 512; v, u = np.mgrid[0:S, 0:S].astype(np.float64); u = (u + 0.5) / S; v = (v + 0.5) / S
    mul = np.ones((S, S)) * (0.985 + 0.03 * noise_tex(S, S, 32, 3))
    ue, ve = ear_uv
    for uc in (ue, 1 - ue):
        dx = (((u - uc + 0.5) % 1) - 0.5) * TAU * 0.10 * 1000; dy = (v - ve) / 0.9 * 0.20 * 1000  # だいたい mm
        rr = np.hypot(dx / 1.0, dy / 1.35)
        hole = 1 / (1 + np.exp((rr - 10.5) / 0.6)); ring = np.exp(-((rr - 12.6) / 1.3) ** 2)
        mul = mul * (1 - 0.9 * hole) * (1 + 0.1 * ring)
    Image.fromarray(np.clip(mul * 250, 0, 255).astype(np.uint8)).convert('RGB').save(os.path.join(OUT, 'helmet.png'), optimize=True)
    print('saved helmet.png')

# ---------------- glTF 書き出し ----------------
def write_glb(parts, path, extras):
    bin_ = bytearray(); views = []; accs = []
    def add(arr, comp, atype, target=None, minmax=False):
        while len(bin_) % 4: bin_.append(0)
        arr = np.ascontiguousarray(arr); off = len(bin_); bin_.extend(arr.tobytes())
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes, **({'target': target} if target else {})})
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': atype}
        if minmax: a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
        accs.append(a); return len(accs) - 1
    head = POS['head']; meshes = []; nodes = [{'name': 'head', 'translation': [float(x) for x in head], 'children': []}]
    for name, part in parts.items():
        Vv, Nn, UV, groups = part.arrays()
        assert np.isfinite(Vv).all() and np.isfinite(UV).all(), name + ': NaN in geometry'
        skin = getattr(part, 'skin', None)
        Vl = (Vv if skin is not None else Vv - head).astype(np.float32)
        pa = add(Vl, 5126, 'VEC3', 34962, True); ta = add(UV.astype(np.float32), 5126, 'VEC2', 34962)
        attrs = {'POSITION': pa, 'TEXCOORD_0': ta}  # 法線はゲーム側で計算する（ファイルを軽くするため）
        if skin is not None:
            attrs['JOINTS_0'] = add(skin[0].astype(np.uint16), 5123, 'VEC4', 34962); attrs['WEIGHTS_0'] = add(skin[1].astype(np.float32), 5126, 'VEC4', 34962)
        prims = []
        for gi, T in enumerate(groups):
            if not len(T): continue
            big = len(Vv) > 65000
            prims.append({'attributes': attrs, 'indices': add(T.reshape(-1).astype(np.uint32 if big else np.uint16), 5125 if big else 5123, 'SCALAR', 34963), 'material': gi, 'extras': {'group': gi}})
        meshes.append({'name': name, 'primitives': prims, 'extras': {'skinned': skin is not None}})
        nodes.append({'name': name, 'mesh': len(meshes) - 1}); nodes[0]['children'].append(len(nodes) - 1)
        print(' ', name, 'verts', len(Vv), 'tris', sum(len(t) for t in groups))
    jsn = {'asset': {'version': '2.0', 'generator': 'koukou-yakyu tools/gear.py'}, 'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes, 'meshes': meshes,
           'materials': [{'name': 'outer'}, {'name': 'inner'}], 'extras': extras,
           'buffers': [{'byteLength': len(bin_)}], 'bufferViews': views, 'accessors': accs}
    js = json.dumps(jsn, separators=(',', ':')).encode('utf-8')
    while len(js) % 4: js += b' '
    while len(bin_) % 4: bin_.append(0)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bytes(bin_))
    print('wrote', path, total // 1024, 'KB')

if __name__ == '__main__':
    print('skull center', C.round(4))
    cap = build_cap(); helm, ear_uv = build_helmet(); mask = build_mask()
    mask['catProt'] = build_protector(); mask['catLegR'] = build_legguard('r'); mask['catLegL'] = build_legguard('l')
    parts = {**cap, **helm, **mask}
    write_glb(parts, os.path.join(OUT, 'gear.glb'), {'attach': 'head', 'center': [float(x) for x in C - POS['head']], 'earUV': [float(ear_uv[0]), float(ear_uv[1])]})
    make_cap_textures(); make_helmet_texture(ear_uv); make_catcher_texture()
