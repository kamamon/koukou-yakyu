"""ポーズ／クリップのギャラリーを3Dで描いて確認する"""
import os,sys,json
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
three=open(os.path.join(ROOT,'vendor/three.min.js'),encoding='utf-8').read()
mod=open(os.path.join(ROOT,'src/08f_ui_3d.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'src/08g_ui_rig.js'),encoding='utf-8').read()+'\n'+open(os.path.join(ROOT,'src/08i_ui_gl.js'),encoding='utf-8').read()
MODEL=os.environ.get('MODEL','real')
OUT=os.environ.get('OUT','pose_gallery')
PERROW=os.environ.get('PERROW','4')
STYLE=os.environ.get('STYLE','placket')
# 表示するポーズ：[label, poseName or clip:name@u, mirror, facingYaw(deg)]
ITEMS=json.loads(sys.argv[1]) if len(sys.argv)>1 else [
 ["stand","stand",0,20],["ready","ready",0,0],["crouch","crouch",0,0],["umpire","umpire",0,0],["set","pset",0,0],
 ["stance(投手から)","stance",0,-90],["stance(捕手から)","stance",0,90],["load","load",0,-90],["stride","stride",0,-90],["launch","launch",0,-90],
 ["contact","contact",0,-90],["ext","ext",0,-90],["follow","follow",0,-90],["bunt","bunt",0,-90],["LH stance","stance",1,90],
 ["prock","prock",0,0],["pbal","pbal",0,0],["pstride","pstride",0,0],["pcock","pcock",0,0],["pacc","pacc",0,0],
 ["prel","prel",0,0],["pext","pext",0,0],["pland","pland",0,0],["pset2","pset2",0,0],["plift2","plift2",0,0],
 ["pbal(横)","pbal",0,90],["pstride(横)","pstride",0,90],["pcock(横)","pcock",0,90],["pacc(横)","pacc",0,90],["prel(横)","prel",0,90],
 ["three prel","prel_three",0,0],["side prel","prel_side",0,0],["under prel","prel_under",0,0],["side pcock","pcock_side",0,0],["under pacc","pacc_under",0,0],
 ["throwWind","throwWind",0,-30],["throwRel","throwRel",0,-30],["catchHigh","catchHigh",0,0],["catchLow","catchLow",0,0],["slide","slide",0,-60],
 ["run@0","run:0",0,-40],["run@1.5","run:1.5",0,-40],["swing@0.45","clip:swing@0.45",0,-90],["windup@0.5","clip:windup_over@0.5",0,0],["windup@0.83","clip:windup_over@0.83",0,0],
]
html=f"""<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#9fcbea"><canvas id="c" width="1500" height="900"></canvas>
<script>{three}</script>
<script>const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));const AR={{}};const FENCE=a=>100;function arNight(){{return false}};function toast(){{}};const $=()=>null;function actionSettings(){{return {{model3d:'{MODEL}'}};}}const UNI_FONTS=[{{id:'oswald',css:"'Oswald',sans-serif"}},{{id:'graduate',css:"'Graduate',serif"}}];function fontCss(id){{const f=UNI_FONTS.find(x=>x.id===id)||UNI_FONTS[0];return f.css;}}</script>
<script>{mod}</script>
<script>
const items={json.dumps(ITEMS,ensure_ascii=False)};
const r=new THREE.WebGLRenderer({{canvas:document.getElementById('c'),antialias:true}});r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;r.setClearColor(0x9fcbea);
const s=new THREE.Scene();const cam=new THREE.PerspectiveCamera(42,1500/900,0.1,100);
s.add(new THREE.HemisphereLight(0xffffff,0x446633,0.8));const d=new THREE.DirectionalLight(0xffffff,1.1);d.position.set(5,12,8);d.castShadow=true;d.shadow.mapSize.set(2048,2048);d.shadow.camera.left=-12;d.shadow.camera.right=12;d.shadow.camera.top=12;d.shadow.camera.bottom=-12;s.add(d);
const g=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshLambertMaterial({{color:0x6e5544}}));g.rotation.x=-Math.PI/2;g.receiveShadow=true;s.add(g);
const cols={{base:'#f2f2ee',trim:'#0b2a4a',cap:'#0b2a4a',capBrim:'#0b2a4a',pants:'#f2f2ee',style:'{STYLE}',text:'青葉',textFont:'graduate',textColor:'#0b2a4a',textOutline:'#ffffff',numFont:'oswald',numColor:'#0b2a4a',numOutline:'#ffffff',mark:'青'}};
const perRow={PERROW};const rows=Math.ceil(items.length/perRow);
const rigsByRow=[];items.forEach((it,i)=>{{const rig=r3NewRig();const batty=/^(stance|load|stride|launch|contact|ext|follow|bunt|clip:swing)/.test(it[1]);rig.setColors(cols,batty||/slide|run/.test(it[1]));rig.bat.visible=batty;if(rig.setGear)rig.setGear(it[4]||null);rig.setNumber(it[5]!=null?it[5]:1,cols.trim);rig.glove.visible=!rig.bat.visible;
 let pose;const nm=it[1];if(nm.startsWith('clip:')){{const [c,u]=nm.slice(5).split('@');pose=r3ClipPose(c,parseFloat(u));}}else if(nm.startsWith('run:')){{pose=r3RunPose(parseFloat(nm.slice(4)),1);}}else pose=RP[nm];rig.apply(pose);
 const col=i%perRow,row=Math.floor(i/perRow);const yaw=it[3]*Math.PI/180;const dzc=(pose&&pose.dz)||0;rig.at((col-(perRow-1)/2)*2.0-Math.sin(yaw)*dzc,0,(row-(rows-1)/2)*3.6-Math.cos(yaw)*dzc);rig.g.rotation.y=yaw;rig.g.scale.x=it[2]?-1:1;s.add(rig.g);(rigsByRow[row]=rigsByRow[row]||[]).push(rig);
 /* ラベル */const cv=document.createElement('canvas');cv.width=256;cv.height=64;const gg=cv.getContext('2d');gg.fillStyle='rgba(0,0,0,.6)';gg.fillRect(0,0,256,64);gg.fillStyle='#fff';gg.font='700 34px sans-serif';gg.textAlign='center';gg.textBaseline='middle';gg.fillText(it[0],128,32);const sp=new THREE.Sprite(new THREE.SpriteMaterial({{map:new THREE.CanvasTexture(cv)}}));sp.scale.set(1.5,0.37,1);sp.position.set(rig.g.position.x,2.15,rig.g.position.z);s.add(sp);rig.label=sp;}});
window.showRow=function(row){{rigsByRow.forEach((rs,ri)=>rs.forEach(rg=>{{rg.g.visible=ri===row;rg.label.visible=ri===row;}}));const z=(row-(rows-1)/2)*3.6;cam.position.set(0,1.6,z+7.6);cam.lookAt(0,0.95,z+0.4);cam.fov=33;cam.updateProjectionMatrix();r.render(s,cam);}};
window.rows=rows;showRow(0);window.done=true;
</script></body></html>"""
out=os.path.join(ROOT,'test','pose_gallery.html');open(out,'w',encoding='utf-8').write(html)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1500,'height':900});errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+out);pg.wait_for_timeout(1500)
    rows=pg.evaluate('window.rows')
    from PIL import Image
    ims=[]
    for i in range(rows):
        pg.evaluate(f'showRow({i})');pg.wait_for_timeout(200)
        fn=os.path.join(ROOT,'test',f'{OUT}_row{i}.png');pg.screenshot(path=fn);ims.append(Image.open(fn).crop((0,120,1500,780)))
    sheet=Image.new('RGB',(1500,660*rows));[sheet.paste(im,(0,660*i)) for i,im in enumerate(ims)];sheet.save(os.path.join(ROOT,'test',OUT+'.png'))
    print('errs',errs);b.close()
