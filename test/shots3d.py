import os,sys,random
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
URL=os.environ.get('URL','file://'+HTML)
DARK=len(sys.argv)>1 and sys.argv[1]=='dark'
errs=[]
def main():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
        pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto(URL);pg.wait_for_timeout(200)
        pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();")
        pg.wait_for_timeout(100)
        pg.evaluate("G.settings.action=Object.assign(G.settings.action||{},{speed:1.3});")
        pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
        sfx='_d' if DARK else ''
        def wf(k=2,ms=4000):
            n0=pg.evaluate("AR.drawN||0")
            for i in range(ms//50):
                pg.wait_for_timeout(50)
                if pg.evaluate("AR.drawN||0")>=n0+k:return
        def shot(n):wf();pg.screenshot(path=f'm3_{n}{sfx}.png')
        shot('playball')
        pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(250)
        shot('lower_third')
        # 打席：投球→スイング（打者側になるまで進める）
        for i in range(40):
            st=pg.evaluate("[AR.phase,AR.side]")
            if st[0]=='pre' and st[1]=='bat':break
            if st[0]=='half':pg.click('[data-act="arBannerNext"]')
            elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
            elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
            pg.wait_for_timeout(250)
        side=pg.evaluate("AR.side");pg.wait_for_timeout(300);shot('bat_pre')
        if side=='bat':
            pg.click('[data-act="arThrow"]');pg.wait_for_timeout(700);shot('flight')
            pg.evaluate("(()=>{const P=AR.cur;if(!P)return;AR.cursor={x:P.x+0.05,y:P.y-0.05};const t=AR.t0+(P.T-70)*AR.speed;setTimeout(()=>{if(AR.phase==='flight'&&!AR.swung)arSwing();},Math.max(0,t-performance.now()));})()")
            pg.wait_for_timeout(1500);shot('after_swing')
        # 本塁打を強制：次の打席でHRイベントを作る
        for i in range(30):
            st=pg.evaluate("[AR.phase,AR.side]")
            if st[0]=='pre' and st[1]=='bat':break
            if st[0]=='half':pg.click('[data-act="arBannerNext"]')
            elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
            elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
            pg.wait_for_timeout(250)
        pg.evaluate("""(()=>{const m=AR.m;if(AR.side!=='bat'||AR.phase!=='pre'){return;}
          const P=m.throwPitch(null);AR.cur=P;const sw={type:'power',cx:P.x,cy:P.y,dt:0};
          /* 強制的に本塁打にする */const origR=R;
          let ev=null;for(let i=0;i<60&&!ev;i++){const c=m.contact(m.pa.be,m.pa.pe,P,sw,m.pa.bHand);if(c.kind==='inplay'){c.ev=Math.max(c.ev,165);c.la=28;c.a=5;m.battedBall(c,m.pa.be,m.pa.pe);if(c.res!=='HR'){c.res='HR';c.fpos='中';}ev={P,sw,kind:'inplay',bb:c,c,text:'',paDone:false,count:[0,0]};m.applyInplay(ev,null);if(!ev.decision)m.paEnd(ev,'HR');}}
          if(ev){AR.swung=true;AR.swingT=performance.now()-400;AR.ev=ev;arShowResult(ev);}})()""")
        pg.wait_for_timeout(1200);shot('hr_field')
        for i in range(12):
            pg.wait_for_timeout(500)
            ph=pg.evaluate("AR.phase")
            if ph=='replay':
                shot('hr_replay');break
        for i in range(20):
            pg.wait_for_timeout(400)
            ph=pg.evaluate("AR.phase")
            if ph=='after':
                pg.wait_for_timeout(300);shot('hr_banner');break
        # 攻守交代ボード
        pg.evaluate("arAbortPA();ACT.arAutoInn();");pg.wait_for_timeout(300);shot('half_board')
        pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(300)
        # 投手側：メーター
        for i in range(30):
            if pg.evaluate("AR.side")=='pit' and pg.evaluate("AR.phase")=='pre':break
            pg.evaluate("arAbortPA();arNextPA();");pg.wait_for_timeout(150)
            if pg.evaluate("AR.phase")=='half':pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(200)
        if pg.evaluate("AR.side")=='pit':
            shot('pit_pre')
            r=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();const z=arZone();return [r.left+z.cx,r.top+z.cy,z.w,z.h];})()")
            pg.mouse.click(r[0]+10,r[1]+10);pg.wait_for_timeout(500);shot('meter_power')
            pg.mouse.click(r[0]+10,r[1]+10);pg.wait_for_timeout(350);shot('meter_acc')
            pg.mouse.click(r[0]+10,r[1]+10);pg.wait_for_timeout(1400);shot('pit_result')
        # 守備の送球判断を強制
        pg.evaluate("""(()=>{const m=AR.m;arAbortPA();let g=0;while(!m.done&&g++<400&&m.userBatting())m.step();AR.banner=null;AR.bannerEl=null;arOverlay('','');arNextPA();
          if(AR.side!=='pit'||!m.pa||m.pa.done)return;const t=m.bat();m.outs=Math.min(m.outs,1);if(!m.bases[0]){m.bases[0]=t.lineup[(t.batIdx+8)%9].p;}if(!m.bases[2]&&Math.random()<0.5){m.bases[2]=t.lineup[(t.batIdx+7)%9].p;}
          const P=m.throwPitch(null);AR.cur=P;const sw={type:'meet',cx:P.x,cy:P.y,dt:0};let ev=null;
          for(let i=0;i<80&&!ev;i++){const c=m.contact(m.pa.be,m.pa.pe,P,sw,m.pa.bHand);if(c.kind==='inplay'){c.la=2;c.ev=118;c.a=-12;m.battedBall(c,m.pa.be,m.pa.pe);if(c.res!=='GO'){c.res='GO';c.fpos='遊';c.type='ground';c.dist=22;}ev={P,sw,kind:'inplay',bb:c,c,text:'',paDone:false,count:[0,0]};m.askDef=true;m.applyInplay(ev,null);if(!ev.decision){m.paEnd(ev,'GO');}}}
          if(ev){AR.swung=true;AR.swingT=performance.now()-400;AR.ev=ev;arShowResult(ev);}})()""")
        for i in range(20):
            pg.wait_for_timeout(300)
            if pg.evaluate("AR.phase")=='decide':
                pg.wait_for_timeout(200);shot('throw_decide');break
        if pg.evaluate("AR.phase")=='decide':
            pg.click('[data-act="arDecide"][data-t="2"]');pg.wait_for_timeout(900);shot('throw_play')
            for i in range(20):
                pg.wait_for_timeout(300)
                if pg.evaluate("AR.phase")=='after':
                    pg.wait_for_timeout(200);shot('throw_result');break
        print('ERRORS',len(errs));[print(e[:300]) for e in errs[:10]]
        b.close()
main()
