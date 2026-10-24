"""3Dアニメーションのコマ撮り（投球→スイング、守備プレー）。performance.now を差し替えて時間を制御する"""
import os,sys
from playwright.sync_api import sync_playwright
from PIL import Image
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
URL=os.environ.get('URL','file://'+HTML)
DARK=len(sys.argv)>1 and sys.argv[1]=='dark'
SIDE=os.environ.get('SIDE','bat')
errs=[]
def main():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
        pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto(URL);pg.wait_for_timeout(200)
        pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();")
        pg.wait_for_timeout(100)
        pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(400)
        pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(300)
        # 打者側になるまで進める
        for i in range(40):
            st=pg.evaluate("[AR.phase,AR.side]")
            if st[0]=='pre' and st[1]==SIDE:break
            if st[0]=='half':pg.click('[data-act="arBannerNext"]')
            elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
            elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
            pg.wait_for_timeout(250)
        # 時計を乗っ取る
        pg.evaluate("window.__t=performance.now();window.__realNow=performance.now.bind(performance);performance.now=()=>window.__t;")
        def step(ms):
            pg.evaluate(f"window.__t+={ms}");pg.wait_for_timeout(120)
        sfx='_d' if DARK else ''
        frames=[]
        # 投球開始（CPU投手）→ 打者はちょうど良いタイミングでスイング
        if SIDE=='bat':
            pg.evaluate("arThrowCpu();")
            pg.evaluate("(()=>{const P=AR.cur;AR.cursor={x:P.x,y:P.y};window.__swingAt=AR.windT0+arWindDur()+(P.T-70)*AR.speed;})()")
        else:
            pg.evaluate("AR.target={x:0,y:0};arThrowUser(null);")
        for i in range(14):
            step(int(os.environ.get('STEP','140')))
            pg.evaluate("if(window.__swingAt&&AR.phase==='flight'&&!AR.swung&&performance.now()>=window.__swingAt){arSwing();window.__swingAt=null;}")
            fn=f'an_{SIDE}_{i}{sfx}.png';pg.screenshot(path=fn);frames.append(fn)
            print(i,pg.evaluate("[AR.phase,R3.cam.position.toArray().map(v=>Math.round(v*10)/10),Math.round(R3.camFov),!!AR.field,AR.ev?AR.ev.kind:null]"))
        # フィールドプレー（結果が出た後）を数コマ
        for i in range(10):
            step(260)
            fn=f'an_{SIDE}f_{i}{sfx}.png';pg.screenshot(path=fn);frames.append(fn)
            print('f',i,pg.evaluate("[AR.phase,R3.cam.position.toArray().map(v=>Math.round(v*10)/10),Math.round(R3.camFov),AR.field?Math.round(fwTime(AR.field,performance.now())):null]"))
        # シート
        ims=[Image.open(f).crop((0,44,390,640)) for f in frames]
        cols=6;rows=(len(ims)+cols-1)//cols
        sheet=Image.new('RGB',(390*cols,596*rows),'white')
        for i,im in enumerate(ims):sheet.paste(im,((i%cols)*390,(i//cols)*596))
        sheet.save(f'an_sheet_{SIDE}{sfx}.png')
        print('phase',pg.evaluate("AR.phase"),'ev',pg.evaluate("AR.ev?AR.ev.kind+' '+(AR.ev.text||''):''"))
        print('ERRORS',len(errs));[print(e[:300]) for e in errs[:10]]
        b.close()
main()
