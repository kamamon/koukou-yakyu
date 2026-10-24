"""MakeHuman（CC0）のベースメッシュから、ゲーム用の選手モデル assets/player.glb を作る。
 - 体型：若い男性・アジア系・やや筋肉質 のマクロターゲットを合成
 - 骨格：MakeHuman の163本をゲームの16関節に統合、Aポーズを「腕を下ろした基本姿勢」に焼き直す
 - 服：helper-tights をユニフォーム（ジャージ＋ズボン）のシェルとして使い、前腕と手の部分は削除
 - 表情：表情ユニット（目・眉・口）を合成したモーフターゲット、顔のバリエーション
 - 目：low-poly の眼球メッシュ
実行: python3 tools/build_player.py  → assets/player.glb と中間データ(tools/out/*.npz)"""
import os, sys, json, struct, math, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mhlib import *

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets')
TMP = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
T = lambda *p: os.path.join(MH, 'targets', *p)

HEIGHT = 1.75

def build(seed=0):
    V0, VT, faces = load_obj(os.path.join(MH, 'base.obj'))
    nv = len(V0)
    # ---- 体型 ----
    body_targets = [
        (T('macrodetails', 'universal-male-young-averagemuscle-averageweight.target'), 0.6),
        (T('macrodetails', 'universal-male-young-maxmuscle-averageweight.target'), 0.4),
        (T('macrodetails', 'asian-male-young.target'), 0.8),
        (T('macrodetails', 'asian-male-child.target'), 0.2),
        (T('torso', 'torso-muscle-pectoral-incr.target'), 0.2),
        (T('torso', 'torso-muscle-dorsi-incr.target'), 0.25),
        (T('neck', 'neck-scale-horiz-incr.target'), 0.15),
    ]
    V = apply_targets(V0, [(p, w) for p, w in body_targets if os.path.exists(p)])
    sk, wdict = load_skeleton()
    # ---- 単位変換（dm→m）と身長正規化 ----
    body_idx = sorted(set(i for vi, ti, g in faces if g == 'body' for i in vi))
    ymin = V[body_idx][:, 1].min(); ymax = V[body_idx][:, 1].max()
    scale = HEIGHT / ((ymax - ymin) * 0.1)
    V = (V - [0, ymin, 0]) * 0.1 * scale
    print('scale', round(scale, 4), 'height', round((V[body_idx][:, 1].max()), 3))
    # ---- 関節 ----
    pos = joint_positions(V, sk)
    wi, ww, wfull = merged_weights(nv, wdict)
    # ---- Aポーズ → 腕を下ろした基本姿勢に焼き直す（線形ブレンドスキニング） ----
    rot = {j: np.array([0, 0, 0, 1.0]) for j in JOINTS}
    for s in 'lr':
        d_up = pos[s + 'El'] - pos[s + 'Sh']; d_fo = pos[s + 'Hand'] - pos[s + 'El']; d_ha = pos[s + 'FingerTip'] - pos[s + 'Hand']
        # 上腕は真下よりわずかに外側（自然な立ち姿）
        rot[s + 'Sh'] = quat_from_to(d_up, np.array([0.1 if s == 'l' else -0.1, -1.0, 0.0]))
        rot[s + 'El'] = quat_from_to(d_fo, d_up)
        rot[s + 'Hand'] = quat_from_to(d_ha, d_fo)
    # 関節のワールド回転・位置（階層順）
    order = ['hips', 'torso', 'chest', 'head', 'rSh', 'rEl', 'rHand', 'lSh', 'lEl', 'lHand', 'rHip', 'rKnee', 'rFoot', 'lHip', 'lKnee', 'lFoot']
    wq = {}; wp = {}
    for j in order:
        p = PARENT[j]
        if p is None:
            wq[j] = rot[j]; wp[j] = pos[j]
        else:
            wq[j] = quat_mul(wq[p], rot[j]); wp[j] = wp[p] + quat_rot(wq[p], pos[j] - pos[p])
    # 頂点を焼く：v' = Σ w (wp[j] + R_j (v - pos[j]))
    Vb = np.zeros_like(V)
    for k in range(4):
        jidx = wi[:, k]; w = ww[:, k][:, None]
        for ji, j in enumerate(JOINTS):
            m = jidx == ji
            if not m.any(): continue
            local = V[m] - pos[j]
            Vb[m] += w[m] * (wp[j] + np.array([quat_rot(wq[j], v) for v in local]))
    V = Vb
    pos = {j: wp[j] for j in JOINTS}
    # 補助点（焼いた後の位置）
    extra_pts = {}
    sk_pos_raw = joint_positions(Vb, sk)
    for k in ['headTop', 'lEye', 'rEye', 'lFingerTip', 'rFingerTip', 'lToe', 'rToe']:
        extra_pts[k] = sk_pos_raw[k]
    # ---- 面 ----
    tv, tt = triangulate(faces)
    groups = np.array([g for vi, ti, g in faces for _ in range(2 if len(vi) == 4 else 1)])
    body_tris = tv[groups == 'body']; body_tt = tt[groups == 'body']
    tight_tris = tv[groups == 'helper-tights']; tight_tt = tt[groups == 'helper-tights']
    N_all = vertex_normals(V, np.concatenate([body_tris, tight_tris]))
    # ---- 領域分類（体の頂点） ----
    dom = wi[:, 0]  # 支配関節
    jn = lambda i: JOINTS[int(dom[i])]
    y_neck = pos['head'][1]; y_waist = pos['hips'][1] + 0.075
    y_shL = pos['lSh'][1]; y_elL = pos['lEl'][1]
    def covered(i):
        """ユニフォームに隠れる体の頂点（袖の下・ズボンの下）"""
        j = jn(i); y = V[i, 1]
        if j in ('hips', 'torso', 'rHip', 'lHip', 'rKnee', 'lKnee'): return True
        if j == 'chest': return y < y_neck - 0.02
        if j in ('rSh', 'lSh'): return y > y_elL + (y_shL - y_elL) * 0.42
        return False
    # ---- 服（tights）の頂点：法線方向に少し膨らませる。前腕・手の面は削除 ----
    tight_idx = sorted(set(tight_tris.flatten().tolist()))
    tight_set = set(tight_idx)
    Vc = V.copy()
    for i in tight_idx:
        j = jn(i); y = V[i, 1]
        off = 0.012 if y > y_waist else 0.009
        Vc[i] = V[i] + N_all[i] * off
    keep_t = []
    for fi, t in enumerate(tight_tris):
        ok = True
        for i in t:
            j = jn(i)
            if j in ('rEl', 'lEl', 'rHand', 'lHand'): ok = False
            if j in ('rSh', 'lSh') and V[i, 1] < y_elL + (y_shL - y_elL) * 0.45: ok = False
        if ok: keep_t.append(fi)
    keep_t = np.array(keep_t)
    tight_tris_k = tight_tris[keep_t]; tight_tt_k = tight_tt[keep_t]
    # 体：服に完全に隠れる面を削除（境界の余裕を残す）
    cov = np.array([covered(i) for i in range(nv)])
    keep_b = np.array([not (cov[t[0]] and cov[t[1]] and cov[t[2]]) for t in body_tris])
    body_tris_k = body_tris[keep_b]; body_tt_k = body_tt[keep_b]
    print('body tris', len(body_tris), '->', len(body_tris_k), ' tights tris', len(tight_tris), '->', len(tight_tris_k))
    # ---- 服の UV を作り直す（helper-tights の UV は小さすぎる）：部位ごとの円筒展開を横長の帯に並べる ----
    VT2, tight_tt_k = cloth_uv(V, tight_tris_k, dom, pos)
    # ---- 表情モーフ（表情ユニットの合成） ----
    E = lambda n: T('expression', 'asian', n + '.target')
    expressions = {
        'focus': [('eyebrows-left-down', 0.7), ('eyebrows-right-down', 0.7), ('eye-left-slit', 0.35), ('eye-right-slit', 0.35), ('mouth-compression', 0.5), ('nose-compression', 0.2)],
        'shout': [('mouth-open', 0.85), ('eyebrows-left-inner-up', 0.5), ('eyebrows-right-inner-up', 0.5), ('eye-left-opened-up', 0.3), ('eye-right-opened-up', 0.3), ('mouth-retraction', 0.3)],
        'smile': [('mouth-corner-puller', 0.85), ('eye-left-slit', 0.45), ('eye-right-slit', 0.45), ('mouth-elevation', 0.2), ('nose-left-elevation', 0.15), ('nose-right-elevation', 0.15)],
        'sad': [('eyebrows-left-inner-up', 0.7), ('eyebrows-right-inner-up', 0.7), ('mouth-depression', 0.6), ('eye-left-closure', 0.25), ('eye-right-closure', 0.25), ('mouth-corner-puller', -0.2)],
        'grit': [('mouth-retraction', 0.6), ('mouth-compression', 0.4), ('eyebrows-left-down', 0.5), ('eyebrows-right-down', 0.5), ('eye-left-slit', 0.2), ('eye-right-slit', 0.2), ('neck-platysma', 0.3)],
        'blink': [('eye-left-closure', 1.0), ('eye-right-closure', 1.0)],
    }
    morphs = {}
    for name, units in expressions.items():
        D = target_offsets(nv, [(E(u), w) for u, w in units]) * 0.1 * scale
        morphs[name] = D
    # 顔のバリエーション（頭・鼻・口・頬・顎のターゲットをランダムに少しずつ）
    rng = np.random.RandomState(7)
    def face_variant(k):
        cands = []
        for d in ['head', 'nose', 'mouth', 'cheek', 'chin', 'forehead', 'eyes', 'eyebrows', 'ears']:
            p = T(d)
            if os.path.isdir(p):
                for f in sorted(os.listdir(p)):
                    if f.endswith('.target'): cands.append(os.path.join(p, f))
        rs = np.random.RandomState(100 + k)
        pick = rs.choice(len(cands), size=14, replace=False)
        items = [(cands[i], float(rs.uniform(-0.6, 0.6))) for i in pick]
        return target_offsets(nv, items) * 0.1 * scale
    for k in range(3):
        morphs['face%d' % k] = face_variant(k)
    # ---- 眼球 ----
    EV, EVT, efaces = load_obj(os.path.join(MH, 'eyes', 'low-poly.obj'))
    refs = []
    with open(os.path.join(MH, 'eyes', 'low-poly.mhclo'), encoding='utf-8') as f:
        on = False
        for line in f:
            if line.startswith('verts'): on = True; continue
            if on:
                p = line.split()
                if not p: continue
                if not p[0].lstrip('-').isdigit(): break
                refs.append(int(p[0]))
    refs = np.array(refs[:len(EV)])
    EVp = V[refs]  # 焼いた後の体の補助頂点位置
    etv, ett = triangulate(efaces)
    EN = vertex_normals(EVp, etv)
    # ---- 中間データを保存（テクスチャ生成で使う） ----
    np.savez_compressed(os.path.join(TMP, 'model.npz'), V=V, Vc=Vc, VT=VT, N=N_all, wi=wi, ww=ww, wfull=wfull,
                        body_tris=body_tris_k, body_tt=body_tt_k, body_tris_all=body_tris, body_tt_all=body_tt,
                        tight_tris=tight_tris_k, tight_tt=tight_tt_k, VT2=VT2,
                        cov=cov, dom=dom, pos=np.array([pos[j] for j in JOINTS]), extra=np.array([extra_pts[k] for k in ['headTop', 'lEye', 'rEye', 'lFingerTip', 'rFingerTip', 'lToe', 'rToe']]),
                        EV=EVp, EVT=EVT, etv=etv, ett=ett, EN=EN, morph_names=np.array(list(morphs.keys())), morphs=np.array([morphs[k] for k in morphs]))
    return dict(V=V, Vc=Vc, VT=VT, VT2=VT2, N=N_all, wi=wi, ww=ww, body_tris=body_tris_k, body_tt=body_tt_k, tight_tris=tight_tris_k, tight_tt=tight_tt_k,
                pos=pos, extra=extra_pts, morphs=morphs, EV=EVp, EVT=EVT, etv=etv, ett=ett, EN=EN, scale=scale)

# ---------------- 服の UV（部位ごとの円筒展開） ----------------
UV_ROWS = {'torso': (0.0, 0.34), 'lLeg': (0.34, 0.55), 'rLeg': (0.55, 0.76), 'lArm': (0.76, 0.88), 'rArm': (0.88, 1.0)}
def cloth_uv(V, tris, dom, pos):
    region_of = {}
    for j in JOINTS:
        if j in ('hips', 'torso', 'chest', 'head'): region_of[j] = 'torso'
        elif j.startswith('l') and j.endswith(('Sh', 'El', 'Hand')): region_of[j] = 'lArm'
        elif j.startswith('r') and j.endswith(('Sh', 'El', 'Hand')): region_of[j] = 'rArm'
        elif j.startswith('l'): region_of[j] = 'lLeg'
        else: region_of[j] = 'rLeg'
    vreg = [region_of[JOINTS[int(dom[i])]] for i in range(len(V))]
    # 面の部位＝多数決
    freg = []
    for t in tris:
        rs = [vreg[i] for i in t]
        freg.append(max(set(rs), key=rs.count))
    # 部位ごとの範囲
    idx_by = {}
    for t, r in zip(tris, freg):
        idx_by.setdefault(r, set()).update(t.tolist())
    span = {r: (V[list(ix)][:, 1].max(), V[list(ix)][:, 1].min()) for r, ix in idx_by.items()}
    def uv_of(i, r):
        x, y, z = V[i]
        if r == 'torso':
            th = math.atan2(x, z); u = (th + math.pi) / (2 * math.pi)
            top, bot = span[r]; vn = (top - y) / max(1e-6, top - bot)
        elif r.endswith('Leg'):
            s = r[0]; sg = 1 if s == 'l' else -1
            hip, knee, foot = pos[s + 'Hip'], pos[s + 'Knee'], pos[s + 'Foot']
            if y > knee[1]:
                k = (hip[1] - y) / max(1e-6, hip[1] - knee[1]); c = hip + (knee - hip) * min(max(k, -0.5), 1)
            else:
                k = (knee[1] - y) / max(1e-6, knee[1] - foot[1]); c = knee + (foot - knee) * min(max(k, 0), 1.2)
            th = math.atan2(z - c[2], (x - c[0]) * sg); u = (th + math.pi) / (2 * math.pi)
            top, bot = span[r]; vn = (top - y) / max(1e-6, top - bot)
        else:
            s = r[0]; sh, el = pos[s + 'Sh'], pos[s + 'El']; ax = el - sh; L = np.linalg.norm(ax); ax = ax / L
            d = np.array([x, y, z]) - sh; t = float(np.dot(d, ax)) / L
            ref = np.array([0, 0, 1.0]); e1 = ref - ax * np.dot(ref, ax); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
            dp = d - ax * np.dot(d, ax); th = math.atan2(float(np.dot(dp, e2)), float(np.dot(dp, e1))); u = (th + math.pi) / (2 * math.pi)
            vn = (t + 0.3) / 1.3
        v0, v1 = UV_ROWS[r]; vn = min(max(vn, 0.0), 1.0)
        return u, v0 + (v1 - v0) * (0.02 + 0.96 * vn)
    VT2 = []; key = {}; tt = np.zeros(tris.shape, dtype=np.int64)
    for f, (t, r) in enumerate(zip(tris, freg)):
        uvs = [uv_of(int(i), r) for i in t]
        us = [u for u, v in uvs]
        if max(us) - min(us) > 0.5:  # 継ぎ目をまたぐ面：小さい u を +1
            uvs = [(u + 1 if u < 0.5 else u, v) for u, v in uvs]
        for k in range(3):
            u, v = uvs[k]; kk = (int(t[k]), r, round(u, 5), round(v, 5))
            if kk not in key:
                key[kk] = len(VT2); VT2.append([u, 1 - v])  # OBJ と同じ向き（v=0 が下）で保存
            tt[f, k] = key[kk]
    return np.array(VT2), tt

# ---------------- glTF 書き出し ----------------
class GLB:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.accs = []
    def _pad(self):
        while len(self.bin) % 4: self.bin.append(0)
    def add(self, arr, comp, atype, target=None, minmax=False):
        self._pad(); arr = np.ascontiguousarray(arr)
        off = len(self.bin); self.bin += arr.tobytes()
        view = {'buffer': 0, 'byteOffset': off, 'byteLength': arr.nbytes}
        if target: view['target'] = target
        self.views.append(view)
        acc = {'bufferView': len(self.views) - 1, 'componentType': comp, 'count': int(arr.shape[0]), 'type': atype}
        if minmax:
            acc['min'] = [float(x) for x in arr.min(0)]; acc['max'] = [float(x) for x in arr.max(0)]
        self.accs.append(acc); return len(self.accs) - 1

def split_by_uv(V, N, VT, tris, tt, wi, ww, morph_list):  # noqa
    """UV の継ぎ目で頂点を複製し、(頂点配列, 三角形index) を作る"""
    key = {}; outV = []; outN = []; outT = []; outWi = []; outWw = []; outM = [[] for _ in morph_list]; src = []
    idx = np.zeros(tris.shape, dtype=np.int64)
    for f in range(len(tris)):
        for k in range(3):
            v = int(tris[f, k]); t = int(tt[f, k])
            kk = (v, t)
            if kk not in key:
                key[kk] = len(outV); outV.append(V[v]); outN.append(N[v]); outT.append([VT[t][0], 1 - VT[t][1]] if t >= 0 else [0, 0]); outWi.append(wi[v]); outWw.append(ww[v]); src.append(v)
                for mi, M in enumerate(morph_list): outM[mi].append(M[v])
            idx[f, k] = key[kk]
    return (np.array(outV, dtype=np.float32), np.array(outN, dtype=np.float32), np.array(outT, dtype=np.float32), np.array(outWi, dtype=np.uint16), np.array(outWw, dtype=np.float32),
            [np.array(m, dtype=np.float32) for m in outM], idx.astype(np.uint32), np.array(src))

def write_glb(M, path):
    g = GLB(); jsn = {'asset': {'version': '2.0', 'generator': 'koukou-yakyu build_player.py', 'copyright': 'base mesh: MakeHuman (CC0)'}, 'scene': 0}
    pos = M['pos']
    # ノード：関節
    nodes = []; node_of = {}
    for j in JOINTS:
        p = PARENT[j]; t = pos[j] - (pos[p] if p else 0)
        node_of[j] = len(nodes); nodes.append({'name': j, 'translation': [float(x) for x in t]})
    for j in JOINTS:
        p = PARENT[j]
        if p: nodes[node_of[p]].setdefault('children', []).append(node_of[j])
    ibm = []
    for j in JOINTS:
        m = np.eye(4); m[:3, 3] = -pos[j]; ibm.append(m.T.astype(np.float32))  # glTF は列優先
    ibm_acc = g.add(np.array(ibm).reshape(len(JOINTS), 16), 5126, 'MAT4')
    jsn['skins'] = [{'joints': [node_of[j] for j in JOINTS], 'inverseBindMatrices': ibm_acc, 'skeleton': node_of['hips']}]
    meshes = []; mesh_nodes = []
    morph_names = list(M['morphs'].keys())
    def add_mesh(name, V, N, tris, tt, wi, ww, morphs, material, VT=None):
        Vs, Ns, Ts, Wi, Ww, Ms, idx, src = split_by_uv(V, N, M['VT'] if VT is None else VT, tris, tt, wi, ww, morphs)
        prim = {'attributes': {'POSITION': g.add(Vs, 5126, 'VEC3', 34962, True), 'NORMAL': g.add(Ns, 5126, 'VEC3', 34962), 'TEXCOORD_0': g.add(Ts, 5126, 'VEC2', 34962),
                               'JOINTS_0': g.add(Wi, 5123, 'VEC4', 34962), 'WEIGHTS_0': g.add(Ww, 5126, 'VEC4', 34962)},
                'indices': g.add(idx.reshape(-1), 5125, 'SCALAR', 34963), 'material': material}
        mesh = {'name': name, 'primitives': [prim]}
        if Ms:
            prim['targets'] = [{'POSITION': g.add(m, 5126, 'VEC3', 34962, True)} for m in Ms]
            mesh['extras'] = {'targetNames': morph_names}
        meshes.append(mesh); return len(meshes) - 1, src
    mats = [{'name': 'skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.55}},
            {'name': 'uniform', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.9}},
            {'name': 'eye', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 1}, 'metallicFactor': 0, 'roughnessFactor': 0.2}}]
    jsn['materials'] = mats
    jsn['images'] = [{'uri': 'skin.png'}, {'uri': 'eye.png'}]
    jsn['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    jsn['textures'] = [{'source': 0, 'sampler': 0}, {'source': 1, 'sampler': 0}]
    morph_list = [M['morphs'][k] for k in morph_names]
    mi_body, src_body = add_mesh('body', M['V'], M['N'], M['body_tris'], M['body_tt'], M['wi'], M['ww'], morph_list, 0)
    mi_cloth, src_cloth = add_mesh('uniform', M['Vc'], M['N'], M['tight_tris'], M['tight_tt'], M['wi'], M['ww'], [], 1, VT=M['VT2'])
    # 目：頭の関節に100%
    ne = len(M['EV']); hidx = JOINTS.index('head')
    ewi = np.zeros((ne, 4), dtype=np.uint16); ewi[:, 0] = hidx; eww = np.zeros((ne, 4), dtype=np.float32); eww[:, 0] = 1
    VTe = M['EVT']
    key = {}; EVs = []; ENs = []; ETs = []; eidx = np.zeros(M['etv'].shape, dtype=np.uint32)
    for f in range(len(M['etv'])):
        for k in range(3):
            v = int(M['etv'][f, k]); t = int(M['ett'][f, k]); kk = (v, t)
            if kk not in key:
                key[kk] = len(EVs); EVs.append(M['EV'][v]); ENs.append(M['EN'][v]); ETs.append([VTe[t][0], 1 - VTe[t][1]])
            eidx[f, k] = key[kk]
    EVs = np.array(EVs, dtype=np.float32); ENs = np.array(ENs, dtype=np.float32); ETs = np.array(ETs, dtype=np.float32)
    ewi2 = np.zeros((len(EVs), 4), dtype=np.uint16); ewi2[:, 0] = hidx; eww2 = np.zeros((len(EVs), 4), dtype=np.float32); eww2[:, 0] = 1
    prim = {'attributes': {'POSITION': g.add(EVs, 5126, 'VEC3', 34962, True), 'NORMAL': g.add(ENs, 5126, 'VEC3', 34962), 'TEXCOORD_0': g.add(ETs, 5126, 'VEC2', 34962),
                           'JOINTS_0': g.add(ewi2, 5123, 'VEC4', 34962), 'WEIGHTS_0': g.add(eww2, 5126, 'VEC4', 34962)}, 'indices': g.add(eidx.reshape(-1), 5125, 'SCALAR', 34963), 'material': 2}
    meshes.append({'name': 'eyes', 'primitives': [prim]}); mi_eyes = len(meshes) - 1
    jsn['meshes'] = meshes
    for mi, nm in [(mi_body, 'body'), (mi_cloth, 'uniform'), (mi_eyes, 'eyes')]:
        nodes.append({'name': nm, 'mesh': mi, 'skin': 0}); mesh_nodes.append(len(nodes) - 1)
    jsn['nodes'] = nodes
    jsn['scenes'] = [{'nodes': [node_of['hips']] + mesh_nodes}]
    ex = M['extra']
    jsn['extras'] = {'joints': JOINTS, 'jointPos': {j: [float(x) for x in pos[j]] for j in JOINTS},
                     'points': {k: [float(x) for x in ex[k]] for k in ex}, 'morphs': morph_names, 'height': HEIGHT}
    jsn['buffers'] = [{'byteLength': len(g.bin)}]
    jsn['bufferViews'] = g.views; jsn['accessors'] = g.accs
    js = json.dumps(jsn, separators=(',', ':')).encode('utf-8')
    while len(js) % 4: js += b' '
    g._pad()
    total = 12 + 8 + len(js) + 8 + len(g.bin)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total)); f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(g.bin), 0x004E4942)); f.write(bytes(g.bin))
    print('wrote', path, total // 1024, 'KB')

if __name__ == '__main__':
    M = build()
    write_glb(M, os.path.join(OUT, 'player.glb'))
