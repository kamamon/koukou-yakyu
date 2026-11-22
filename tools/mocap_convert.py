"""CMU の BVH（cgspeed 版）を、ゲームの選手の骨格（16関節）のクリップへ変換する。

考え方
  ・ゲームの骨格は、立った姿勢（腕は下ろす）で全関節の回転が 0（ワールドの軸と同じ向き）。
  ・BVH の1フレーム目はTポーズ。各関節の「Tポーズからのワールド回転の差」を、
    ゲームの骨格をTポーズにした向きに掛けて、ワールドの向きを作る。
  ・親のワールドの向きで割ってローカル回転にし、three.js の Euler(XYZ) にする。
  ・腰の位置は、左右の股関節の中点を使う。単位は脚の長さの比で m に直す。
  ・足は母指球（ToeBase）の位置を足の目標（fr/fl）として渡す。地面についている間は高さ 0。

出力（JSON）: {fps, dur, ev:[{t,k}], end:{dx,dz}, keys:{ch:[[...],...]}, info}
"""
import json
import math
import sys

import numpy as np

from bvh import load_bvh

# ---- ゲームの骨格（player.glb の jointPos と同じ） ----
TJ = {
    'hips': [0.0, 0.917, -0.003], 'torso': [0.0, 1.008, -0.035], 'chest': [0.0, 1.138, -0.036], 'head': [0.0, 1.485, 0.006],
    'rSh': [-0.188, 1.376, 0.012], 'rEl': [-0.214, 1.125, 0.012], 'rHand': [-0.24, 0.865, 0.012],
    'lSh': [0.188, 1.376, 0.012], 'lEl': [0.214, 1.125, 0.012], 'lHand': [0.24, 0.865, 0.012],
    'rHip': [-0.109, 0.915, -0.014], 'rKnee': [-0.153, 0.493, 0.026], 'rFoot': [-0.195, 0.07, 0.01],
    'lHip': [0.109, 0.915, -0.014], 'lKnee': [0.153, 0.493, 0.026], 'lFoot': [0.195, 0.07, 0.01],
}
TPAR = {'hips': None, 'torso': 'hips', 'chest': 'torso', 'head': 'chest', 'rSh': 'chest', 'rEl': 'rSh', 'rHand': 'rEl',
        'lSh': 'chest', 'lEl': 'lSh', 'lHand': 'lEl', 'rHip': 'hips', 'rKnee': 'rHip', 'rFoot': 'rKnee',
        'lHip': 'hips', 'lKnee': 'lHip', 'lFoot': 'lKnee'}
TPTS = {'rFingerTip': [-0.26, 0.663, 0.012], 'lFingerTip': [0.26, 0.663, 0.012], 'rToe': [-0.17, 0.025, 0.174],
        'lToe': [0.17, 0.025, 0.174], 'headTop': [0.0, 1.758, 0.036]}
# 骨の向き（関節→子）。腕と脚と足と手だけ、Tポーズの向きに合わせる
TBONE = {'rSh': 'rEl', 'rEl': 'rHand', 'rHand': 'rFingerTip', 'lSh': 'lEl', 'lEl': 'lHand', 'lHand': 'lFingerTip',
         'rHip': 'rKnee', 'rKnee': 'rFoot', 'rFoot': 'rToe', 'lHip': 'lKnee', 'lKnee': 'lFoot', 'lFoot': 'lToe'}
# ゲームの関節 ← BVH の関節
MAP = {'hips': 'Hips', 'torso': 'Spine', 'chest': 'Spine1', 'head': 'Head',
       'rSh': 'RightArm', 'rEl': 'RightForeArm', 'rHand': 'RightHand',
       'lSh': 'LeftArm', 'lEl': 'LeftForeArm', 'lHand': 'LeftHand',
       'rHip': 'RightUpLeg', 'rKnee': 'RightLeg', 'rFoot': 'RightFoot',
       'lHip': 'LeftUpLeg', 'lKnee': 'LeftLeg', 'lFoot': 'LeftFoot'}
SBONE = {'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightHandIndex1',
         'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandIndex1',
         'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase',
         'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase'}
ORDER = ['hips', 'torso', 'chest', 'head', 'rSh', 'rEl', 'rHand', 'lSh', 'lEl', 'lHand', 'rHip', 'rKnee', 'rFoot', 'lHip', 'lKnee', 'lFoot']
LEG_T = 0.85  # ゲームの股関節→足首


def tp(name):
    return np.array(TJ[name] if name in TJ else TPTS[name], float)


def min_rot(a, b):
    """a を b へ向ける最小の回転行列"""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.999999:
        ax = np.cross(a, [1, 0, 0])
        if np.linalg.norm(ax) < 1e-6:
            ax = np.cross(a, [0, 1, 0])
        ax /= np.linalg.norm(ax)
        return 2 * np.outer(ax, ax) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def euler_xyz(M):
    """three.js の Euler('XYZ') と同じ分解"""
    m13 = max(-1.0, min(1.0, M[0, 2]))
    y = math.asin(m13)
    if abs(m13) < 0.9999999:
        x = math.atan2(-M[1, 2], M[2, 2])
        z = math.atan2(-M[0, 1], M[0, 0])
    else:
        x = math.atan2(M[2, 1], M[1, 1])
        z = 0.0
    return [x, y, z]


def unwrap_euler(seq, ref=None):
    """となりのフレームに近い表し方を選ぶ（±2π と (x+π, π−y, z+π) の別解）"""
    out = []
    prev = ref
    for e in seq:
        if prev is None:
            out.append(list(e))
            prev = out[-1]
            continue
        cands = [list(e), [e[0] + math.pi, math.pi - e[1], e[2] + math.pi]]
        best = None
        for c in cands:
            c = [prev[i] + ((c[i] - prev[i] + math.pi) % (2 * math.pi) - math.pi) for i in range(3)]
            d = sum(abs(c[i] - prev[i]) for i in range(3))
            if best is None or d < best[0]:
                best = (d, c)
        out.append(best[1])
        prev = best[1]
    return out


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


class Src:
    def __init__(self, path):
        self.B = load_bvh(path)
        self.R, self.P = self.B.fk()
        self.idx = {n: i for i, n in enumerate(self.B.names)}
        self.dt = self.B.dt
        P0 = self.P[0]
        ix = self.idx
        leg = np.linalg.norm(P0[ix['RightLeg']] - P0[ix['RightUpLeg']]) + np.linalg.norm(P0[ix['RightFoot']] - P0[ix['RightLeg']])
        self.s = LEG_T / leg  # BVH単位 → m

    def pos(self, name):
        return self.P[:, self.idx[name]] * self.s

    def rot(self, name):
        return self.R[:, self.idx[name]]


def convert(path, a, b, heading, origin, fps=30, remap=None, name='clip', foot_ref='RightToeBase', ground=None,
            plant_h=0.02, plant_v=0.35, place=(0.0, 0.0)):
    """a..b: 使う BVH のフレーム範囲。heading: ゲームの +Z にそろえる向き（BVH 水平面の角度, rad）。
    origin: ゲームの原点に置く BVH の点（m, 水平）。remap: [(bvh_frame, clip_ms), ...]（区間ごとに一次補間）"""
    S = Src(path)
    ix = S.idx
    R, P = S.R, S.P * S.s
    # Tポーズの向きのそろえ（ゲーム側）：腕・脚・手・足の骨の向きを Tポーズの骨の向きへ
    Tt = {}
    for t, s in MAP.items():
        if t in TBONE:
            d_bind = tp(TBONE[t]) - tp(t)
            sc = SBONE[s]
            d_src = P[0, ix[sc]] - P[0, ix[s]]
            Tt[t] = min_rot(d_bind, d_src)
        else:
            Tt[t] = np.eye(3)
    H = rot_y(-heading)  # BVH の水平の向き heading を +Z へ
    if ground is None:
        toes = np.minimum(P[a:b, ix['RightToeBase'], 1], P[a:b, ix['LeftToeBase'], 1])
        ground = float(np.percentile(toes, 3)) - 0.02
    frames = list(range(a, b))
    W = {}
    for t, s in MAP.items():
        D = np.einsum('fij,kj->fik', R[a:b, ix[s]], R[0, ix[s]])  # R_f · R_0^T
        W[t] = np.einsum('ij,fjk,kl->fil', H, D, Tt[t])
    L = {}
    for t in ORDER:
        p = TPAR[t]
        L[t] = W[t] if p is None else np.einsum('fji,fjk->fik', W[p], W[t])
    eul = {t: unwrap_euler([euler_xyz(M) for M in L[t]]) for t in ORDER}

    def hz(v):  # BVH の点 → ゲームのローカル（向きと原点をそろえる）
        v = v.copy()
        v[..., 1] -= ground
        v[..., 0] -= origin[0]
        v[..., 2] -= origin[1]
        v = np.einsum('ij,...j->...i', H, v)
        v[..., 0] += place[0]
        v[..., 2] += place[1]
        return v

    pel = hz((P[a:b, ix['RightUpLeg']] + P[a:b, ix['LeftUpLeg']]) / 2)
    hips_bind = tp('hips')
    off = pel - hips_bind  # dx,dy,dz
    feet = {}
    for side, toe, ank in (('r', 'RightToeBase', 'RightFoot'), ('l', 'LeftToeBase', 'LeftFoot')):
        tpos = hz(P[a:b, ix[toe]])
        apos = hz(P[a:b, ix[ank]])
        # 立っているときの母指球の高さ（基準）
        rest_h = float(np.percentile(tpos[:, 1], 5))
        h = tpos[:, 1] - rest_h
        v = np.zeros(len(h))
        v[1:-1] = np.linalg.norm(tpos[2:] - tpos[:-2], axis=1) / (2 * S.dt)
        v[0], v[-1] = v[1], v[-2]
        planted = (h < plant_h) & (v < plant_v)
        hh = np.where(planted, 0.0, np.maximum(h, 0.0) + 0.013)
        fv = tpos - apos
        yaw = np.arctan2(fv[:, 0], fv[:, 2])
        horiz = np.hypot(fv[:, 0], fv[:, 2])
        pitch = np.arctan2(-fv[:, 1], horiz)
        rest_pitch = float(np.median(pitch[planted])) if planted.any() else float(np.median(pitch))
        feet[side] = {'pos': np.stack([tpos[:, 0], hh, tpos[:, 2]], 1), 'q': np.stack([np.unwrap(yaw), pitch - rest_pitch], 1),
                      'planted': planted, 'h': h, 'v': v}
    # 時刻：BVH のフレーム → クリップの ms
    fr = np.array(frames, float)
    if remap:
        rf = np.array([x[0] for x in remap], float)
        rt = np.array([x[1] for x in remap], float)
        tms = np.interp(fr, rf, rt, left=None, right=None)
        # 範囲外は端の速さで延長
        lo = fr < rf[0]
        hi = fr > rf[-1]
        if lo.any():
            k = (rt[1] - rt[0]) / (rf[1] - rf[0])
            tms[lo] = rt[0] + (fr[lo] - rf[0]) * k
        if hi.any():
            k = (rt[-1] - rt[-2]) / (rf[-1] - rf[-2])
            tms[hi] = rt[-1] + (fr[hi] - rf[-1]) * k
    else:
        tms = (fr - a) * S.dt * 1000
    tms -= tms[0]
    dur = float(tms[-1])
    # fps で再サンプル
    n = int(dur / (1000 / fps)) + 1
    tt = np.linspace(0, dur, n)

    def rs(arr):
        arr = np.asarray(arr, float)
        return np.stack([np.interp(tt, tms, arr[:, k]) for k in range(arr.shape[1])], 1)

    ch = {}
    ch['hips'] = rs(eul['hips'])
    ch['dx'] = rs(off[:, 0:1])[:, 0]
    ch['dy'] = rs(off[:, 1:2])[:, 0]
    ch['dz'] = rs(off[:, 2:3])[:, 0]
    ch['tor'] = rs(eul['torso'])
    ch['chest'] = rs(eul['chest'])
    for t in ['head', 'rSh', 'rEl', 'rHand', 'lSh', 'lEl', 'lHand', 'rHip', 'rKnee', 'rFoot', 'lHip', 'lKnee', 'lFoot']:
        ch[t] = rs(eul[t])
    for sd in ('r', 'l'):
        ch['f' + sd] = rs(feet[sd]['pos'])
        # 接地中は高さ 0 を保つ（補間でわずかに浮かないように）
        pl = np.interp(tt, tms, feet[sd]['planted'].astype(float)) > 0.5
        ch['f' + sd][pl, 1] = 0.0
        ch['f' + sd + 'q'] = rs(feet[sd]['q'])
    info = {'src': path.split('/')[-1], 'frames': [a, b], 'scale': S.s, 'ground': ground, 'dt': S.dt}
    return {'name': name, 'fps': fps, 'dur': dur, 'tt': tt, 'ch': ch, 'tms': tms, 'feet': feet, 'off': off, 'W': W, 'S': S,
            'eul': eul, 'info': info, 'frames': frames}


# ---- 検証用：ゲームの骨格での順運動学 ----
def target_fk(Lrot, off):
    """Lrot: {joint: [F,3,3] ローカル回転}, off: [F,3] 腰の移動 → 各関節のワールド位置（m）"""
    F = len(off)
    Wd, Pd = {}, {}
    for t in ORDER:
        p = TPAR[t]
        if p is None:
            Wd[t] = Lrot[t]
            Pd[t] = tp(t)[None, :] + off
        else:
            Wd[t] = np.einsum('fij,fjk->fik', Wd[p], Lrot[t])
            Pd[t] = Pd[p] + np.einsum('fij,j->fi', Wd[p], tp(t) - tp(p))
    ends = {}
    for t, e in (('rHand', 'rFingerTip'), ('lHand', 'lFingerTip'), ('rFoot', 'rToe'), ('lFoot', 'lToe'), ('head', 'headTop')):
        ends[e] = Pd[t] + np.einsum('fij,j->fi', Wd[t], tp(e) - tp(t))
    Pd.update(ends)
    return Pd


def euler_to_m(e):
    x, y, z = e
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rx @ Ry @ Rz


def to_json(res, ev, end=None, extra=None):
    ch = res['ch']
    out = {'fps': res['fps'], 'dur': round(res['dur'], 1), 'ev': ev, 'ch': {}, 'info': res['info']}
    if end:
        out['end'] = end
    if extra:
        out.update(extra)
    for k, v in ch.items():
        v = np.asarray(v)
        if v.ndim == 1:
            out['ch'][k] = [round(float(x), 3) for x in v]
        else:
            out['ch'][k] = [[round(float(x), 3) for x in row] for row in v]
    return out


if __name__ == '__main__':
    print('use from a script')
