"""MakeHuman（CC0）のベースメッシュ・ターゲット・スケルトンを読み、ゲーム用の選手モデルを組み立てる共通ライブラリ。
単位：MakeHuman は dm。読み込み後にメートルへ変換し、身長 1.75m に正規化する。
座標系：Y上、顔が +Z、左手が +X（three.js と同じ）。"""
import os, json, math, numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MH = os.path.join(HERE, 'mh')

def load_obj(path):
    V = []; VT = []; faces = []; grp = None
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('v '):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('vt '):
                VT.append([float(x) for x in line.split()[1:3]])
            elif line.startswith('g '):
                grp = line.split()[1]
            elif line.startswith('f '):
                vi = []; ti = []
                for p in line.split()[1:]:
                    a = p.split('/')
                    vi.append(int(a[0]) - 1)
                    ti.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
                faces.append((vi, ti, grp))
    return np.array(V, dtype=np.float64), np.array(VT, dtype=np.float64), faces

def load_target(path):
    idx = []; d = []
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('#') or not line.strip():
                continue
            p = line.split()
            idx.append(int(p[0])); d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64).reshape(-1, 3)

def apply_targets(V, items):
    """items: [(path, weight)] を V に加算（V は dm 単位のまま）"""
    V = V.copy()
    for path, w in items:
        if w == 0: continue
        idx, d = load_target(path)
        V[idx] += d * w
    return V

def target_offsets(nverts, items):
    """合成オフセット配列（nverts×3）を返す"""
    D = np.zeros((nverts, 3))
    for path, w in items:
        if w == 0: continue
        idx, d = load_target(path)
        D[idx] += d * w
    return D

# ---- 骨格 ----
# ゲーム側の関節とその親。MakeHuman の骨をこれらに統合する
JOINTS = ['hips', 'torso', 'chest', 'head', 'rSh', 'rEl', 'rHand', 'lSh', 'lEl', 'lHand', 'rHip', 'rKnee', 'rFoot', 'lHip', 'lKnee', 'lFoot']
PARENT = {'hips': None, 'torso': 'hips', 'chest': 'torso', 'head': 'chest', 'rSh': 'chest', 'rEl': 'rSh', 'rHand': 'rEl', 'lSh': 'chest', 'lEl': 'lSh', 'lHand': 'lEl',
          'rHip': 'hips', 'rKnee': 'rHip', 'rFoot': 'rKnee', 'lHip': 'hips', 'lKnee': 'lHip', 'lFoot': 'lKnee'}
# 関節位置に使う MakeHuman 骨（head 側）
JOINT_BONE = {'hips': 'spine05', 'torso': 'spine04', 'chest': 'spine02', 'head': 'neck01', 'rSh': 'upperarm01.R', 'rEl': 'lowerarm01.R', 'rHand': 'wrist.R',
              'lSh': 'upperarm01.L', 'lEl': 'lowerarm01.L', 'lHand': 'wrist.L', 'rHip': 'upperleg01.R', 'rKnee': 'lowerleg01.R', 'rFoot': 'foot.R',
              'lHip': 'upperleg01.L', 'lKnee': 'lowerleg01.L', 'lFoot': 'foot.L'}

def bone_to_joint(name):
    n = name
    side = 'l' if n.endswith('.L') else ('r' if n.endswith('.R') else '')
    base = n[:-2] if side else n
    if base in ('root', 'pelvis', 'spine05'): return 'hips'
    if base in ('spine04', 'spine03'): return 'torso'
    if base in ('spine02', 'spine01', 'clavicle', 'shoulder01', 'breast'): return 'chest'
    if base.startswith('neck') or base in ('head', 'jaw', 'eye', 'tongue00', 'tongue01', 'tongue02', 'tongue03', 'tongue04', 'tongue05', 'tongue06', 'tongue07') or base.startswith(('levator', 'oris', 'risorius', 'orbicularis', 'oculi', 'temporalis', 'special', 'tongue')):
        return 'head'
    if base.startswith('upperarm'): return side + 'Sh'
    if base.startswith('lowerarm'): return side + 'El'
    if base.startswith(('wrist', 'metacarpal', 'finger')): return side + 'Hand'
    if base.startswith('upperleg'): return side + 'Hip'
    if base.startswith('lowerleg'): return side + 'Knee'
    if base.startswith(('foot', 'toe')): return side + 'Foot'
    return None

def load_skeleton():
    sk = json.load(open(os.path.join(MH, 'default.mhskel'), encoding='utf-8'))
    w = json.load(open(os.path.join(MH, 'default_weights.mhw'), encoding='utf-8'))['weights']
    return sk, w

def joint_positions(V, sk):
    """各ゲーム関節の位置（V の単位）"""
    J = sk['joints']; B = sk['bones']
    pos = {}
    for j, bn in JOINT_BONE.items():
        pos[j] = V[J[B[bn]['head']]].mean(0)
    pos['headTop'] = V[J[B['head']['tail']]].mean(0)
    for s in 'LR':
        pos[('l' if s == 'L' else 'r') + 'FingerTip'] = V[J[B['finger3-3.' + s]['tail']]].mean(0)
        pos[('l' if s == 'L' else 'r') + 'Toe'] = V[J[B['toe1-1.' + s]['tail']]].mean(0)
        pos[('l' if s == 'L' else 'r') + 'Eye'] = V[J[B['eye.' + s]['head']]].mean(0)
    return pos

def merged_weights(nverts, wdict, warn=True):
    """MakeHuman の骨ウェイトをゲーム関節に統合し、頂点ごとに正規化して上位4つを返す (idx[n,4], w[n,4])"""
    acc = np.zeros((nverts, len(JOINTS)))
    unmapped = set()
    for bone, arr in wdict.items():
        j = bone_to_joint(bone)
        if j is None:
            unmapped.add(bone); continue
        ji = JOINTS.index(j)
        a = np.array(arr)
        if len(a) == 0: continue
        acc[a[:, 0].astype(int), ji] += a[:, 1]
    if warn and unmapped:
        print('unmapped bones:', sorted(unmapped))
    s = acc.sum(1, keepdims=True); s[s == 0] = 1
    acc /= s
    order = np.argsort(-acc, axis=1)[:, :4]
    wi = order.astype(np.uint16)
    ww = np.take_along_axis(acc, order, axis=1)
    ws = ww.sum(1, keepdims=True); ws[ws == 0] = 1
    ww = (ww / ws).astype(np.float32)
    return wi, ww, acc

def vertex_normals(V, tris):
    N = np.zeros_like(V)
    a = V[tris[:, 0]]; b = V[tris[:, 1]]; c = V[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(N, tris[:, k], fn)
    l = np.linalg.norm(N, axis=1, keepdims=True); l[l == 0] = 1
    return N / l

def triangulate(faces):
    """quad/tri 面 → 三角形 (vi, ti) 配列"""
    tv = []; tt = []
    for vi, ti, g in faces:
        if len(vi) == 4:
            tv.append([vi[0], vi[1], vi[2]]); tv.append([vi[0], vi[2], vi[3]])
            tt.append([ti[0], ti[1], ti[2]]); tt.append([ti[0], ti[2], ti[3]])
        else:
            tv.append(vi[:3]); tt.append(ti[:3])
    return np.array(tv, dtype=np.int64), np.array(tt, dtype=np.int64)

def quat_from_to(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    c = np.cross(a, b); d = float(np.dot(a, b))
    if d < -0.999999:
        # 180度：aに直交する軸
        axis = np.cross(a, [1, 0, 0]) if abs(a[0]) < 0.9 else np.cross(a, [0, 1, 0])
        axis /= np.linalg.norm(axis)
        return np.array([axis[0], axis[1], axis[2], 0.0])
    q = np.array([c[0], c[1], c[2], 1 + d])
    return q / np.linalg.norm(q)

def quat_mul(p, q):
    x1, y1, z1, w1 = p; x2, y2, z2, w2 = q
    return np.array([w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2, w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2])

def quat_rot(q, v):
    x, y, z, w = q
    t = 2 * np.cross([x, y, z], v)
    return v + w * t + np.cross([x, y, z], t)

def quat_inv(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])
