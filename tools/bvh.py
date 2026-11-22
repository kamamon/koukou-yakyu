"""BVH の読み込みと順運動学（CMU / cgspeed 形式）。

使い方:
    from bvh import load_bvh
    B = load_bvh('124_01.bvh')
    B.names, B.parents, B.offsets, B.frames, B.dt
    R, P = B.fk()   # R: [F, J, 3, 3] ワールド回転, P: [F, J, 3] ワールド位置（BVHの単位）
"""
import numpy as np


def _rot(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    if axis == 'X':
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == 'Y':
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def _rot_batch(axis, deg):
    a = np.radians(deg)
    c, s = np.cos(a), np.sin(a)
    o, z = np.ones_like(a), np.zeros_like(a)
    if axis == 'X':
        m = [[o, z, z], [z, c, -s], [z, s, c]]
    elif axis == 'Y':
        m = [[c, z, s], [z, o, z], [-s, z, c]]
    else:
        m = [[c, -s, z], [s, c, z], [z, z, o]]
    return np.moveaxis(np.array(m), [0, 1], [-2, -1])


class BVH:
    def __init__(self):
        self.names, self.parents, self.offsets, self.channels = [], [], [], []
        self.ends = {}
        self.frames = None
        self.dt = 1 / 120

    def local_rot(self):
        """各関節のローカル回転 [F, J, 3, 3]"""
        F = self.frames.shape[0]
        J = len(self.names)
        out = np.tile(np.eye(3), (F, J, 1, 1))
        col = 0
        for j, ch in enumerate(self.channels):
            R = np.tile(np.eye(3), (F, 1, 1))
            for c in ch:
                if c.endswith('rotation'):
                    R = R @ _rot_batch(c[0], self.frames[:, col])
                col += 1
            out[:, j] = R
        return out

    def root_pos(self):
        col = 0
        pos = np.zeros((self.frames.shape[0], 3))
        for c in self.channels[0]:
            if c.endswith('position'):
                pos[:, 'XYZ'.index(c[0])] = self.frames[:, col]
            col += 1
        return pos

    def fk(self):
        L = self.local_rot()
        F, J = L.shape[:2]
        R = np.zeros_like(L)
        P = np.zeros((F, J, 3))
        rp = self.root_pos()
        off = np.array(self.offsets)
        for j in range(J):
            p = self.parents[j]
            if p < 0:
                R[:, j] = L[:, j]
                P[:, j] = rp + off[j]
            else:
                R[:, j] = R[:, p] @ L[:, j]
                P[:, j] = P[:, p] + np.einsum('fij,j->fi', R[:, p], off[j])
        return R, P


def load_bvh(path):
    B = BVH()
    toks = open(path).read().split()
    i = 0
    stack = []
    last = -1
    while toks[i] != 'MOTION':
        t = toks[i]
        if t in ('ROOT', 'JOINT'):
            name = toks[i + 1]
            B.names.append(name)
            B.parents.append(stack[-1] if stack else -1)
            B.offsets.append([0, 0, 0])
            B.channels.append([])
            last = len(B.names) - 1
            i += 2
        elif t == 'End':
            # End Site: 親の末端の位置だけ記録
            j = i + 2  # '{'
            assert toks[j + 1] == 'OFFSET'
            B.ends[stack[-1]] = [float(x) for x in toks[j + 2:j + 5]]
            i = j + 6  # 'OFFSET x y z }'
        elif t == '{':
            stack.append(last)
            i += 1
        elif t == '}':
            stack.pop()
            i += 1
        elif t == 'OFFSET':
            B.offsets[last] = [float(x) for x in toks[i + 1:i + 4]]
            i += 4
        elif t == 'CHANNELS':
            n = int(toks[i + 1])
            B.channels[last] = toks[i + 2:i + 2 + n]
            i += 2 + n
        else:
            i += 1
    i += 1
    assert toks[i] == 'Frames:'
    nf = int(toks[i + 1])
    assert toks[i + 2] == 'Frame' and toks[i + 3] == 'Time:'
    B.dt = float(toks[i + 4])
    vals = np.array([float(x) for x in toks[i + 5:]])
    nc = sum(len(c) for c in B.channels)
    B.frames = vals.reshape(nf, nc)
    return B
