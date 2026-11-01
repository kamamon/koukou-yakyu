#!/bin/bash
# モーション確認ページ（デバッグ用）を1ファイルのHTMLにまとめる
set -e
cd "$(dirname "$0")/.."
THREE="$(cat vendor/three.min.js)"
DATA="$(grep -E '^const (UNI_FONTS|POS_NUM)' src/01_data.js; sed -n '/^const UNI_FONTS=\[/,/^\];/p' src/01_data.js | tail -n +2)"
CORE="const R3_ASSET_BASE='${ASSET_BASE:-assets/}';const clamp=(v,a,b)=>v<a?a:v>b?b:v;const FENCE=a=>100+20*Math.cos(a*Math.PI/90);function gauss(m,s){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}"
MODS="$(cat src/03c_phys.js src/08f_ui_3d.js src/08g_ui_rig.js src/08h_ui_stadium.js src/08i_ui_gl.js src/08k_ui_motion.js src/08l_ui_moves.js viewer/motion.js)"
mkdir -p dist
{
cat <<'HTML'
<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>モーション確認</title>
<style>
:root{--bg:#0e1116;--fg:#e8e6e1;--ac:#ffd166}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;overflow:hidden}
#wrap{display:flex;flex-direction:column;height:100%}
#stage{flex:1;position:relative;min-height:0;background:#9fcbea;touch-action:none}
#stage canvas{display:block}
#hud{position:absolute;left:8px;top:8px;font-size:12px;line-height:1.45;background:rgba(0,0,0,.55);padding:5px 9px;border-radius:6px;pointer-events:none;max-width:calc(100% - 16px)}
#err{position:absolute;left:8px;bottom:8px;color:#ff8a80;font-size:11px;white-space:pre-wrap;max-height:40%;overflow:auto}
#panel{padding:8px 10px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;max-height:44%;overflow:auto;background:#141821;border-top:1px solid #2a3140}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.row b{font-size:11px;color:#9aa5b5;min-width:44px}
button{font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid #3a4253;background:#1e2533;color:var(--fg)}
button.on{background:#2f6fd6;border-color:#2f6fd6;color:#fff}
input[type=range]{flex:1;min-width:160px}
.hint{font-size:11px;color:#9aa5b5}
</style></head><body><div id="wrap">
<div id="stage"><div id="hud">–</div><div id="err"></div></div>
<div id="panel">
<div class="row"><b>動作</b><button data-scn="pitch" class="on">投球</button><button data-scn="swing">スイング</button><button data-scn="gb">ゴロ捕球→送球</button><button data-scn="run">走り（加速→停止）</button><button data-scn="turn">方向転換</button><button data-scn="side">横移動・後退</button><button data-scn="fly">フライ捕球→送球</button><button data-scn="slide">スライディング</button></div>
<div class="row"><b>投手</b><button data-act="hand">右投げ</button>　<button data-form="over" class="on">オーバー</button><button data-form="three">スリークォーター</button><button data-form="side">サイド</button><button data-form="under">アンダー</button></div>
<div class="row"><b>再生</b><button data-act="play">一時停止</button><button data-act="step" data-v="-1">◀ コマ</button><button data-act="step" data-v="1">コマ ▶</button><button data-spd="1" class="on">×1</button><button data-spd="0.5">×0.5</button><button data-spd="0.25">×0.25</button><input type="range" id="tsl" min="0" max="2000" step="1" value="0"></div>
<div class="row"><b>視点</b><button data-cam="front">正面</button><button data-cam="side" class="on">側面</button><button data-cam="side2">反対側</button><button data-cam="back">背面</button><button data-cam="top">真上</button>　<b>表示</b><button data-act="skel" class="on">骨格</button><button data-act="marks" class="on">基準点・接地</button></div>
<div class="hint">赤＝投げ手、青＝グラブの手、黄＝グラブのポケット、橙＝バットの芯、緑の輪＝接地している足（灰＝空中）。格子は1マス50cm。</div>
</div></div>
HTML
printf '<script>\n%s\n</script>\n<script>\n%s\n%s\n%s\n</script>\n</body></html>\n' "$THREE" "$DATA" "$CORE" "$MODS"
} > dist/motion.html
echo "motion: $(wc -c < dist/motion.html) bytes"
