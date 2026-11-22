"""CMU の実測モーション（BVH）から、ゲームのクリップ（src/08n_ui_mocap.js）を作る。

  python3 tools/build_mocap.py <CMUのdataフォルダ>

CMU Graphics Lab Motion Capture Database（http://mocap.cs.cmu.edu/）のデータを使用。
BVH は cgspeed（Bruce Hahne）による変換版。ゲームへの組み込みは許可されている（データ単体の再販売は不可）。
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mocap_convert import Src, convert  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', '08n_ui_mocap.js')

KEYS = ['hips', 'mx', 'dy', 'dz', 'tor', 'chest', 'head', 'rSh', 'rEl', 'rHand', 'lSh', 'lEl', 'lHand',
        'rHip', 'rKnee', 'rFoot', 'lHip', 'lKnee', 'lFoot', 'fr', 'frq', 'fl', 'flq']


def r3(v):
    return round(float(v), 3)


def to_def(res, ev, end, phases, note):
    ch = res['ch']
    tt = res['tt']
    keys = []
    for i, t in enumerate(tt):
        p = {}
        for k in KEYS:
            src = 'dx' if k == 'mx' else k
            v = ch[src][i]
            if np.ndim(v) == 0:
                p[k] = r3(v)
            else:
                p[k] = [r3(x) for x in v]
        keys.append({'t': round(float(t), 1), 'p': p})
    return {'dur': round(float(tt[-1]), 1), 'end': end, 'ev': ev, 'mocap': note, 'phases': phases, 'keys': keys}


def pitch(D):
    path = os.path.join(D, '124', '124_01.bvh')
    S = Src(path)
    dt = S.dt
    f = lambda t: int(round(t / dt))  # noqa: E731
    lt, rt = S.pos('LeftToeBase'), S.pos('RightToeBase')
    a, peak, land, rel, b = f(2.60), f(2.95), f(3.61), f(3.71), f(4.45)
    # 向き：リリース直前の手の速度の向き（投げる方向）を本塁（+Z）へ
    rh = S.pos('RightHand')
    v = (rh[rel - 2:rel + 1] - rh[rel - 6:rel - 3]).mean(0)
    heading = math.atan2(v[0], v[2])
    # 右足（軸足）の母指球を、セットの姿勢（p_setpos）の右足の位置へ
    res = convert(path, a, b, heading, (rt[a, 0], rt[a, 2]), fps=30,
                  remap=[(a, 0), (peak, 330), (land, 900), (rel, 1000), (b, 1000 + (b - rel) * dt * 1000)],
                  place=(-0.06, -0.03))
    ch = res['ch']
    end = {'dx': r3(ch['dx'][-1]), 'dz': r3(ch['dz'][-1])}
    ev = [{'t': 900, 'k': 'fs'}, {'t': 1000, 'k': 'release', 'hand': 'r'}]
    phases = [[0, '始動（実測）'], [330, '脚上げの頂点'], [520, '踏み出し'], [900, '着地'], [1000, 'リリース'], [1050, 'フォロー'], [1400, '守備の姿勢へ']]
    return to_def(res, ev, end, phases, 'CMU 124_01 Baseball Pitch'), res


def main():
    D = sys.argv[1]
    defs = {}
    d, res = pitch(D)
    defs['p_set_mc'] = d
    lines = ['/* ---------- 実測モーション（CMU Graphics Lab Motion Capture Database を骨格に合わせて変換） ----------',
             ' 出典：http://mocap.cs.cmu.edu/（BVH は cgspeed 変換版）。ゲームへの組み込みは許可。データ単体の再配布・販売は不可。',
             ' tools/build_mocap.py で生成。手で直さないこと。',
             ' チャンネル：tor=胴（直接）、chest=胸、mx/dy/dz=腰の移動（m）、fr/fl=足の母指球（ローカル）、frq/flq=[向き,傾き] */']
    for k, v in defs.items():
        lines.append('MODEF.%s=%s;' % (k, json.dumps(v, ensure_ascii=False, separators=(',', ':'))))
    open(OUT, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')
    for k, v in defs.items():
        print(k, 'dur', v['dur'], 'keys', len(v['keys']), 'end', v['end'])


if __name__ == '__main__':
    main()
