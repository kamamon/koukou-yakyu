/* 物理モデルの検証：投球の到達精度と変化量、打球の飛距離フィット */
const fs=require('fs');const path=require('path');
const src=['01_data.js','02_core.js','03c_phys.js'].map(f=>fs.readFileSync(path.join(__dirname,'../src',f),'utf8')).join('\n');
const code=src+`\nmodule.exports={phPitchPath,phHitPath,PH_SPIN};`;
const m={exports:{}};new Function('module','require',code)(m,require);const L=m.exports;
let maxErr=0;const rows=[];
for(const name of Object.keys(L.PH_SPIN)){const v=name==='ストレート'?145:name.includes('スローカーブ')?95:name==='カーブ'?110:name==='チェンジアップ'?118:name==='フォーク'||name==='スプリット'?130:125;
 const P={name,v,hs:1,form:'over',x:0.3,y:0.2,n:3};const r=L.phPitchPath(P);
 /* 変化量：回転なしの直線（重力のみ）との比較ではなく、初速方向の延長線と到達点の差（いわゆる変化量） */
 const st=r.rel;const dirx=Math.sin(r.ph)*Math.cos(r.th),diry=-Math.cos(r.ph)*Math.cos(r.th),dirz=Math.sin(r.th);const dy=(st[1]-0.2);const k=dy/(-diry);const lineX=st[0]+dirx*k,lineZ=st[2]+dirz*k;
 const last=r.pts[r.pts.length-1];const brkX=(last.x-lineX)*100,brkZ=(last.z-lineZ)*100;
 maxErr=Math.max(maxErr,Math.abs(r.err[0]),Math.abs(r.err[1]));rows.push(`${name.padEnd(8,'　')} ${v}km/h T=${(r.T*1000).toFixed(0)}ms 横${brkX>0?'+':''}${brkX.toFixed(0)}cm 縦${brkZ>0?'+':''}${brkZ.toFixed(0)}cm`);}
console.log(rows.join('\n'));console.log('max landing error (m):',maxErr.toFixed(4));
/* 左投げ：スライダーの横変化が反転するか */
const rR=L.phPitchPath({name:'スライダー',v:125,hs:1,form:'over',x:0,y:0,n:1}),rL=L.phPitchPath({name:'スライダー',v:125,hs:-1,form:'over',x:0,y:0,n:1});
console.log('slider initial dir R/L (ph):',rR.ph.toFixed(3),rL.ph.toFixed(3));
/* 打球 */let hitErr=0;const hits=[[165,28,5,125],[140,15,-20,70],[120,40,10,55],[150,22,30,98],[100,5,0,30]];
for(const [ev,la,a,d] of hits){const r=L.phHitPath(ev,la,a,d);hitErr=Math.max(hitErr,Math.abs(r.d-d));console.log(`ev${ev} la${la} a${a} dist${d} → d=${r.d.toFixed(1)} t=${r.t.toFixed(2)}s apex=${r.apex.toFixed(1)}m mult=${r.mult.toFixed(2)} pts=${r.pts.length}`);}
console.log('max hit distance error (m):',hitErr.toFixed(3));
