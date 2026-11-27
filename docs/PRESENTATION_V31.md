# v31 試合画面の調査・反映
## 参照資料（公式情報・公開画面）
- PlayStation.Blog 2026-02-03: https://blog.playstation.com/2026/02/03/mlb-the-show-26-gameplay-revealed/
- 公式打撃操作: https://mlb26.manual.theshow.com/ja/controls-hitting.html
- 公式投球操作: https://mlb26.manual.theshow.com/ja/controls-pitching.html
- 公式Gameplay Feature Premiere 2/5（公式動画の説明・公開画像）: https://www.youtube.com/watch?v=C1e1ZwVhXbg
- 公式Presentation Updates 2/19（動画の説明）: https://www.youtube.com/watch?v=oQ9LlhVyFF8
- 公開スクリーンショット: https://showzone.gg/news/mlb-the-show-26-gameplay-feature-premiere-breakdown ; https://gamingtrend.com/reviews/mlb-the-show-26-eview/
実際の公開画面と公式マニュアルから、打者・投手の視点分離、隅のスコア表示、控えめなゾーン、打撃後の分析、フィールド追従、リプレイを設計に反映。動画本編全フレームの解析や実機比較は行っていない。画像・ロゴ・音声・モデルなどの商用素材を転載しない。
## 変更仕様
- 3種類の打撃視点（打席+ゾーン、ワイド、接近）と3種類の投球視点（中継、中央、寄り）。Three.js投影を利用し、左右投打と画面比に合わせ重要点を収める。旧カメラも選択可能。打撃視点では捕手・主審が球を隠さないよう既存非表示処理を維持。
- フィールド: 中継固定位置・追従方式。打球、捕球者、送球先、走者の基準点を含める。既存リプレイの前半/後半カメラを更新。
- 横長画面はスコアをフィールド右下に重ね、詳細情報帯を折りたたむ。縦画面は上部配置。既存操作ボタン・2D/カード・試合ルールは維持。
- 固定PCIと9分割。選択したセル中心を実際のスイング入力に渡す。従来判定時は範囲1.65倍（暫定バランス）、v29 CCD時は許容範囲拡張なし。感度0.65/1/1.5。新投球カメラの横方向をスクリーンに合わせる。
- 打撃後のタイミング、狙い、実際の球位置、打球速度・角度。投球履歴は投球完了後の値のみ。3D操作試合で適用。
- 昼/夕/夜独立設定、近距離シャドウ、異方性フィルタ、球の光・軌跡抑制（アシスト有効時は維持）。既存高校野球の黒土・素材を維持。光学的被写界深度、新規モーション撮影、AAA画質の実証は未実装。
## 検証
node test/presentation_v31.cjs : 6視点×6画面比×左右投打4組＝144ケースの投影、9セル・接触入力・分析データ。モデル全頂点の投影や実機スクリーンショット、FPSとは区別する。
