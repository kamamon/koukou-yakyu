#!/bin/bash
set -e
cd "$(dirname "$0")"
FONTS='https://fonts.googleapis.com/css2?family=BIZ+UDPGothic:wght@400;700&family=Zen+Antique&family=Oswald:wght@500;700&family=Anton&family=Bebas+Neue&family=Graduate&family=Rye&family=Alfa+Slab+One&family=Black+Ops+One&family=Permanent+Marker&family=Bungee&family=Russo+One&family=Dela+Gothic+One&family=Reggae+One&family=Yuji+Syuku&family=Kaisei+Decol&family=RocknRoll+One&family=Shippori+Mincho:wght@700&family=Rampart+One&family=Mochiy+Pop+One&family=Noto+Sans+JP:wght@400;700&display=swap'
APPVER=$(cat VERSION)
VER=$(date +%Y%m%d%H%M%S)
VERJS="<script>const APP_VER='${APPVER}',APP_BUILD='${VER}';</script>"
HEAD="<title>高校野球シミュレーション</title>
$VERJS
<meta name=\"claude:viewport-fit-sides\" content=\"cover\">
<link rel=\"stylesheet\" href=\"$FONTS\">
<style>
$(cat src/00_style.css)
</style>"
DOM='<div id="setup" class="setup" hidden></div>
<div id="game" hidden>
 <header class="top" id="topbar"></header>
 <main id="content"></main>
 <nav class="tabs" id="nav" aria-label="メニュー"></nav>
</div>
<div id="overlay" class="overlay" hidden><div class="modal" id="modal" role="dialog" aria-modal="true"></div></div>
<div id="toast" class="toast" hidden></div>'
JS="$(cat src/01_data.js src/01b_abil.js src/01c_fac.js src/01d_cards.js src/02_core.js src/03_match.js src/03b_pitch.js src/03c_phys.js src/04_tourney.js src/05_people.js src/05b_events.js src/06_ui_base.js src/07_ui_tabs.js src/07b_ui_news.js src/08_ui_match.js src/08b_ui_edit.js src/08c_ui_action.js src/08d_ui_field.js src/08e_ui_card.js src/08f_ui_3d.js src/08g_ui_rig.js src/08h_ui_stadium.js src/08i_ui_gl.js src/09_ui_setup.js)"
THREE="$(cat vendor/three.min.js)"
# 選手モデル（GLB・テクスチャ）の置き場所：単体HTML／アーティファクト版は GitHub Pages から取得、PWA版は同梱
PAGES_ASSETS='<script>const R3_ASSET_BASE="https://kamamon.github.io/koukou-yakyu/assets/";</script>'
LOCAL_ASSETS='<script>const R3_ASSET_BASE="assets/";</script>'
mkdir -p dist
# アーティファクト版（骨組みは公開時に付与される）
printf '%s\n%s\n%s\n<script>\n%s\n</script>\n<script>\n%s\n</script>\n' "$HEAD" "$DOM" "$PAGES_ASSETS" "$THREE" "$JS" > dist/artifact.html
# 単体ファイル版
printf '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n%s\n</head>\n<body>\n%s\n%s\n<script>\n%s\n</script>\n<script>\n%s\n</script>\n</body>\n</html>\n' "$HEAD" "$DOM" "$PAGES_ASSETS" "$THREE" "$JS" > "dist/高校野球シミュレーション.html"
# PWA版（ホスティングしてSafariの「ホーム画面に追加」でアプリ化）
mkdir -p dist/pwa
PWAHEAD='<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="高校野球">
<meta name="theme-color" content="#1e6b43">'
# ステータスバーは black-translucent を使わない（iOS 26.1以降はコンテンツの上にグラデーションのモヤが描かれるため）。theme-color の色で塗りつぶす
SWREG='<script>if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("./sw.js").catch(()=>{});});}</script>'
printf '<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n%s\n%s\n</head>\n<body>\n%s\n%s\n<script>\n%s\n</script>\n<script>\n%s\n</script>\n%s\n</body>\n</html>\n' "$PWAHEAD" "$HEAD" "$DOM" "$LOCAL_ASSETS" "$THREE" "$JS" "$SWREG" > dist/pwa/index.html
cp pwa_src/manifest.webmanifest pwa_src/apple-touch-icon.png pwa_src/icon-192.png pwa_src/icon-512.png dist/pwa/
# 選手モデルとテクスチャ（tools/build_player.py, tools/build_textures.py の出力）
mkdir -p dist/pwa/assets dist/assets
cp assets/* dist/pwa/assets/ 2>/dev/null || true
cp assets/* dist/assets/ 2>/dev/null || true
ASSETS=$(cd assets && ls | sed "s#^#'./assets/#; s#\$#'#" | paste -sd, -)
sed "s/__VERSION__/$VER/; s#__ASSETS__#$ASSETS#" pwa_src/sw.js > dist/pwa/sw.js
# ビューワー
ASSET_BASE='assets/' bash viewer/build_viewer.sh >/dev/null && cp dist/viewer.html dist/pwa/viewer.html
ASSET_BASE='https://kamamon.github.io/koukou-yakyu/assets/' bash viewer/build_viewer.sh >/dev/null
(cd dist && rm -f 高校野球シミュレーション_PWA.zip && zip -qr 高校野球シミュレーション_PWA.zip pwa)
echo "built: $(wc -c < dist/artifact.html) bytes (pwa ver $VER)"
