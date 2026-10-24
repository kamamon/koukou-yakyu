#!/bin/bash
# 選手・球場モデルビューワーを1ファイルのHTMLにまとめる
set -e
cd "$(dirname "$0")/.."
THREE="$(cat vendor/three.min.js)"
DATA="$(grep -E '^const (UNI_FONTS|POS_NUM)' src/01_data.js; sed -n '/^const UNI_FONTS=\[/,/^\];/p' src/01_data.js | tail -n +2)"
CORE="const R3_ASSET_BASE='${ASSET_BASE:-assets/}';const clamp=(v,a,b)=>v<a?a:v>b?b:v;const FENCE=a=>100+20*Math.cos(a*Math.PI/90);function gauss(m,s){let u=0,v=0;while(u===0)u=Math.random();while(v===0)v=Math.random();return m+s*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}"
MODS="$(cat src/03c_phys.js src/08f_ui_3d.js src/08g_ui_rig.js src/08h_ui_stadium.js src/08i_ui_gl.js viewer/viewer.js)"
mkdir -p dist
{
cat <<'HTML'
<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<title>選手・球場モデルビューワー</title>
<style>
:root{--bg:#0e1116;--fg:#e8e6e1;--ac:#ffd166}
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--bg);color:var(--fg);font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;overflow:hidden}
#wrap{display:flex;flex-direction:column;height:100%}
#stage{flex:1;position:relative;min-height:0;background:#9fcbea;touch-action:none}
#stage canvas{display:block}
#hud{position:absolute;left:8px;top:8px;font-size:12px;background:rgba(0,0,0,.45);padding:4px 8px;border-radius:6px;pointer-events:none}
#err{position:absolute;left:8px;bottom:8px;color:#ff8a80;font-size:12px}
#panel{padding:8px 10px calc(10px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:6px;max-height:46%;overflow:auto;background:#141821;border-top:1px solid #2a3140}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.row b{font-size:11px;color:#9aa5b5;min-width:56px}
button{font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid #3a4253;background:#1e2533;color:var(--fg)}
button.on{background:#2f6fd6;border-color:#2f6fd6;color:#fff}
.hint{font-size:11px;color:#9aa5b5}
</style></head><body><div id="wrap">
<div id="stage"><div id="hud"><span id="fps">–</span>　ドラッグで回転 / ピンチ・ホイールでズーム</div><div id="err"></div></div>
<div id="panel">
<div class="row"><b>見る</b><button data-preset="pitcher">投手</button><button data-preset="pitcherFace">投手（顔）</button><button data-preset="batter">打者</button><button data-preset="catcher">捕手・審判</button><button data-preset="fielder">野手</button></div>
<div class="row"><b>カメラ</b><button data-preset="batCam">打席視点</button><button data-preset="cfCam">センター</button><button data-preset="wide">全景</button><button data-preset="roof">銀傘</button><button data-preset="alps">アルプス</button><button data-preset="board">ボード</button></div>
<div class="row"><b>動き</b><button data-anim="idle">静止</button><button data-anim="pitch">投球</button><button data-anim="swing">スイング</button>　<b>フォーム</b><button data-set="form" data-v="over" class="on">オーバー</button><button data-set="form" data-v="three">スリークォーター</button><button data-set="form" data-v="side">サイド</button><button data-set="form" data-v="under">アンダー</button></div>
<div class="row"><b>利き</b><button data-set="hand" data-v="右" class="on">右投</button><button data-set="hand" data-v="左">左投</button><button data-set="bhand" data-v="右" class="on">右打</button><button data-set="bhand" data-v="左">左打</button>　<b>時間</b><button data-set="night" data-v="0" class="on">デーゲーム</button><button data-set="night" data-v="1">ナイター</button></div>
<div class="row"><b>ユニ</b><button data-set="uni" data-v="0" class="on">紺・前立て</button><button data-set="uni" data-v="1">赤・袖ライン</button><button data-set="uni" data-v="2">縦じま</button><button data-set="uni" data-v="3">緑・ラグラン</button><button data-set="uni" data-v="4">黒・胸バンド</button>　<b>モデル</b><button data-set="model" data-v="real" class="on">リアル</button><button data-set="model" data-v="chibi">パワプロ風</button></div>
<div class="hint">ゲーム本体と同じ3Dデータをそのまま表示しています（照明・影・トーンマッピングも同じ）。</div>
</div></div>
HTML
printf '<script>\n%s\n</script>\n<script>\n%s\n%s\n%s\n</script>\n</body></html>\n' "$THREE" "$DATA" "$CORE" "$MODS"
} > dist/viewer.html
echo "viewer: $(wc -c < dist/viewer.html) bytes"
