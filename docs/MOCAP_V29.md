# v29 実測モーション素材
The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.
Source: https://mocap.cs.cmu.edu/ ; BVH conversion Bruce Hahne (cgspeed); mirror https://github.com/una-dinosauria/cmu-mocap . CMU allows use in products but prohibits resale of the motion data by itself. Do not sell the converted clips separately.

- p_set_mc2: CMU 124_02 投球 A, source frames 250–500, 127 keys, 1808.3ms. 投球用候補
- p_set_mc3: CMU 124_02 投球 B, source frames 916–1153, 120 keys, 1775ms. 投球用候補
- v29_bunt_mc: CMU 124_08 バント, source frames 438–590, 77 keys, 1300ms. 検証・参考用
- v29_swing_mc: CMU 124_07 スイング（参考用）, source frames 264–406, 73 keys, 1000ms. 検証・参考用
- v29_stop_mc: CMU 127_05 急停止, source frames 4–206, 102 keys, 1683.3ms. 検証・参考用
- v29_side_mc: CMU 127_13 左方向ステップ, source frames 4–178, 88 keys, 1450ms. 検証・参考用

元の実測骨格からT姿勢差分・親子ローカル回転・脚長正規化・足接地チャンネルを変換。イベントは映像実測ではなく手速度と足位置から推定。スイング・バントはバット・ボール実測を含まないため検証用。指はCMUでは実測されていないため補間を実測と表記しない。ゲームでの動きの品質は実機目視確認が必要。
