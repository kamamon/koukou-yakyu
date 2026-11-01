"""投球の場面のコマ撮り（ゲーム本体・GL）。時間を止めて少しずつ進める。
 使い方: python3 pitch_lab.py 出力.jpg [side=bat|pit] [swing=ms（ボール到達に対する入力の早さ、負=早い）] [cam=game|side|high|back] [times=0,200,...（windT0からのms）] [runners=1,0,0]"""
import sys,os,io,base64,json
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
out=sys.argv[1];opt=dict(a.split('=',1) for a in sys.argv[2:])
side=opt.get('side','bat');cam=opt.get('cam','game');times=[float(x) for x in opt.get('times','0,300,600,800,950,1100,1250,1400,1600,2000').split(',')]
W,H=int(opt.get('W',480)),int(opt.get('H',400))
URL=os.environ.get('URL','http://localhost:8765/pwa/index.html')
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':W,'height':H+300});errs=[]
    pg.add_init_script('window.__crowdN=400;window.__introHold=true')
    pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m:errs.append(m.text) if m.type in('error','warning') and '3D' in m.text else None)
    pg.goto(URL);pg.wait_for_timeout(300)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'):pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(500)
    for i in range(80):
        if pg.evaluate("typeof GL!=='undefined'&&(GL.ready||GL.failed)"):break
        pg.wait_for_timeout(250)
    for i in range(60):
        st=pg.evaluate("AR.phase")
        if st=='pre':break
        if st=='intro':pg.evaluate("arPlayBall()")
        elif st=='half':pg.evaluate("arAfterBanner()")
        pg.wait_for_timeout(200)
    pg.evaluate("R3.renderer.setPixelRatio(1);actionSettings().cam3d='wide'")
    # 時間を止める
    pg.evaluate("cancelAnimationFrame(AR.raf);window.__t=performance.now();const _pn=performance.now.bind(performance);performance.now=()=>window.__t;window.__step=(dt)=>{window.__t+=dt;arLoop();cancelAnimationFrame(AR.raf);}")
    if 'runners' in opt:
        pg.evaluate(f"(()=>{{const m=AR.m;const t=m.bat();const others=t.lineup.map(x=>x.p).filter(p=>p!==m.pa.b);m.bases={json.dumps([int(x) for x in opt['runners'].split(',')])}.map((on,i)=>on?others[i]:null);}})()")
    if side=='pit' and pg.evaluate("AR.side")!='pit':
        print('side is',pg.evaluate("AR.side"))
    if opt.get('force')=='swing': pg.evaluate("AR.m.cpuSwingInput=function(P){if(!P)return null;return {type:'meet',cx:P.x,cy:P.y,dt:0,ease:0};}")
    if opt.get('force')=='take': pg.evaluate("AR.m.cpuSwingInput=function(P){return null;}")
    pg.evaluate("__step(16)")
    if pg.evaluate("AR.side")=='bat':
        pg.evaluate("arThrowCpu()")
    else:
        pg.evaluate("AR.target={x:0.2,y:0.1};arThrowUser(null)")
    t0=pg.evaluate("AR.windT0")
    swing=opt.get('swing');ims=[];cur=0.0;swung=False
    if opt.get('force')=='swing' and pg.evaluate('AR.side')=='bat' and swing is None: swing='0'
    print('side',pg.evaluate('AR.side'))
    for T in times:
        while cur<T:
            dt=min(16,T-cur);pg.evaluate(f"__step({dt})");cur+=dt
            if swing is not None and not swung and pg.evaluate("AR.phase")=='flight':
                ta=pg.evaluate("AR.t0+AR.cur.T*AR.speed-70*AR.speed")+float(swing)
                if pg.evaluate("window.__t")>=ta:
                    pg.evaluate("AR.cursor={x:AR.cur.x,y:AR.cur.y};arSwing()");swung=True
        if cam!='game':
            v={'side':"r3SetCam(r3V(12,8.5,2.4),r3V(0,8.8,1.0),62,true)",'high':"r3SetCam(r3V(0,-14,9),r3V(0,10,0.5),42,true)",'back':"r3SetCam(r3V(0.6,-4.5,1.7),r3V(0,6,0.9),36,true)",'bat':"r3SetCam(r3V(4.5,-1.5,1.5),r3V(-0.6,0,1.0),38,true)",'pside':"r3SetCam(r3V(-7,17.5,1.6),r3V(0,17.4,1.1),34,true)",'catch':"r3SetCam(r3V(-2.6,-2.6,1.2),r3V(0,-0.55,0.6),42,true)",'field':"r3SetCam(r3V(0,-12,14),r3V(0,30,0),55,true)"}[cam]
            url=pg.evaluate(v+";R3.renderer.render(R3.scene,R3.cam);R3.cv.toDataURL('image/jpeg',0.85)")
        else:
            url=pg.evaluate("R3.renderer.render(R3.scene,R3.cam);R3.cv.toDataURL('image/jpeg',0.85)")
        im=Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGB')
        ph=pg.evaluate("AR.phase")
        if 'dbg' in opt: print(T, pg.evaluate(opt['dbg']))
        d=ImageDraw.Draw(im);d.rectangle([0,0,200,16],fill='black');d.text((4,2),f"t={T:.0f} {ph}",fill='white');ims.append(im)
    cols=min(4,len(ims));rows=(len(ims)+cols-1)//cols;w,h=ims[0].size
    sheet=Image.new('RGB',(w*cols,h*rows),'white')
    for i,im in enumerate(ims):sheet.paste(im,((i%cols)*w,(i//cols)*h))
    sheet.save(out,quality=84)
    print('ev',pg.evaluate("AR.ev&&AR.ev.kind"),'phase',pg.evaluate("AR.phase"),'errors',errs[:6])
    b.close()
