import os,sys,random,time
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
PITCHES=int(sys.argv[1]) if len(sys.argv)>1 else 40
SHOT=len(sys.argv)>2 and sys.argv[2]=='shot'
DARK=len(sys.argv)>3 and sys.argv[3]=='dark'
errs=[]
def main():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']);ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
        pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.on('console',lambda m: print('CONSOLE',m.text[:500]) if ('3D' in m.text or m.type=='error' and 'ERR_FAILED' not in m.text) else None)
        pg.goto('file://'+HTML);pg.wait_for_timeout(200)
        pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'テスト高校',strength:58,pref:'神奈川'}});render();")
        pg.wait_for_timeout(100)
        pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
        assert pg.evaluate("!!document.querySelector('#arena') && !document.querySelector('#arena').hidden"),'arena not shown'
        shots=set()
        def shot(name):
            if SHOT and name not in shots:
                shots.add(name);pg.screenshot(path=f'a_{name}{"_d" if DARK else ""}.png')
        n=0;steps=0;decided=0;pit_thrown=0;bat_swung=0;replays=[0]
        while steps<4000:
            steps+=1
            st=pg.evaluate("({ph:AR.phase,side:AR.side,hidden:!AR.el||AR.el.hidden,done:AR.m?AR.m.done:true,n:AR.m&&AR.m.pa?AR.m.pa.n:0,panel:!!AR.panel,wait:AR.banner?AR.banner.wait:false,inn:AR.m?AR.m.inn:0})")
            if st['hidden']:
                break
            ph=st['ph'];side=st['side']
            if n>=PITCHES:
                # おまかせで終了
                pg.click('[data-act="arMenu"]');pg.wait_for_timeout(50);shot('menu')
                pg.click('[data-act="arAutoInn"]');pg.wait_for_timeout(100);shot('autoinn')
                if pg.query_selector('[data-act="arBannerNext"]'):pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(100)
                # 1打席だけ操作してから最後まで
                pg.wait_for_timeout(200)
                pg.click('[data-act="arMenu"]');pg.wait_for_timeout(50);pg.click('[data-act="arAutoEnd"]');pg.wait_for_timeout(300)
                break
            if ph=='pre' and side=='bat' and not st['panel']:
                shot('bat_pre')
                if n%7==3:
                    pg.click('[data-act="arSwingType"][data-k="power"]')
                elif n%7==5:
                    pg.click('[data-act="arSwingType"][data-k="meet"]')
                # 作戦ボタンがあれば時々押す
                if n%9==4 and pg.query_selector('[data-act="arCmd"][data-c="steal"]'):pg.click('[data-act="arCmd"][data-c="steal"]')
                pg.click('[data-act="arThrow"]');n+=1;pg.wait_for_timeout(30)
            elif ph in('wind','flight') and side=='bat':
                # 球の到達点・時刻に合わせてスイング（少しノイズ）
                ex=random.gauss(0,0.22);ey=random.gauss(0,0.18);et=random.gauss(0,60)
                swung=pg.evaluate(f"""(()=>{{if(AR.phase!=='flight'&&AR.phase!=='wind')return false;const P=AR.cur;if(!P)return false;if(AR.swung)return false;const start=AR.phase==='flight'?AR.t0:(AR.windT0+arWindDur());const t=start+(P.T-70)*AR.speed+{et};const wait=Math.max(0,t-performance.now());setTimeout(()=>{{if(AR.phase==='flight'&&!AR.swung){{AR.cursor={{x:P.x+{ex},y:P.y+{ey}}};arSwing();}}}},wait);return true;}})()""")
                if swung:
                    bat_swung+=1
                    pg.wait_for_timeout(400)
                    shot('bat_flight')
                pg.wait_for_timeout(900)
            elif ph=='pre' and side=='pit' and not st['panel']:
                shot('pit_pre')
                # 球種を選ぶ
                btns=pg.query_selector_all('[data-act="arPitchSel"]')
                if btns:btns[random.randrange(len(btns))].click()
                if n%6==2 and pg.query_selector('[data-act="arPower"][data-k="max"]'):pg.click('[data-act="arPower"][data-k="max"]')
                if n%11==5 and pg.query_selector('[data-act="arShift"][data-k="in"]'):pg.click('[data-act="arShift"][data-k="in"]')
                if n%13==7 and pg.query_selector('[data-act="arPickoff"]'):pg.click('[data-act="arPickoff"]');pg.wait_for_timeout(100)
                if n%10==9:
                    pg.click('[data-act="arAutoPitch"]');n+=1;pit_thrown+=1;pg.wait_for_timeout(50);continue
                # ゾーンをタップ
                r=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();const z=arZone();return [r.left+z.cx,r.top+z.cy,z.w,z.h];})()")
                tx=r[0]+random.uniform(-0.9,0.9)*r[2]/2;ty=r[1]+random.uniform(-0.9,0.9)*r[3]/2
                pg.mouse.click(tx,ty);n+=1;pit_thrown+=1;pg.wait_for_timeout(random.randint(80,500))
                if pg.evaluate("AR.phase")=='gauge':
                    shot('gauge');pg.mouse.click(tx,ty)
                pg.wait_for_timeout(200)
            elif ph=='flight' and side=='pit':
                shot('pit_flight');pg.wait_for_timeout(300)
            elif ph=='decide':
                kind=pg.evaluate("AR.pending&&AR.pending.decision?AR.pending.decision.kind:''")
                shot('decide_'+('throw' if kind=='throw' else 'run'));decided+=1
                btns=pg.query_selector_all('[data-act="arDecide"]')
                if btns:btns[random.randrange(len(btns))].click()
                pg.wait_for_timeout(100)
            elif ph=='replay':
                shot('replay');replays[0]+=1;pg.wait_for_timeout(400)
            elif ph=='field':
                shot('field');pg.wait_for_timeout(300)
            elif ph=='after':
                shot('after_'+side);pg.wait_for_timeout(200)
            elif ph=='half':
                shot('half')
                if st['wait']:
                    pg.click('[data-act="arBannerNext"]')
                pg.wait_for_timeout(300)
            elif ph=='gauge':
                pg.wait_for_timeout(120);pg.evaluate("arRelease()")
            else:
                pg.wait_for_timeout(150)
        pg.wait_for_timeout(300)
        # 結果モーダル
        hid=pg.evaluate("!AR.el||AR.el.hidden")
        res=pg.evaluate("UI.match&&UI.match.res?[UI.match.res.score,UI.match.res.won,UI.match.res.inn]:null")
        print('arena hidden',hid,'result',res,'pitches',n,'swung',bat_swung,'thrown',pit_thrown,'decided',decided,'replays',replays[0],'steps',steps)
        shot('result')
        if pg.query_selector('[data-act="mClose"]'):pg.click('[data-act="mClose"]');pg.wait_for_timeout(100)
        print('stats',pg.evaluate("(()=>{const a=active().filter(p=>p.season.pa>0||p.season.ipo>0);return a.slice(0,5).map(p=>p.name+' '+JSON.stringify({pa:p.season.pa,h:p.season.h,ipo:p.season.ipo,pk:p.season.pk}));})()"))
        print('ERRORS',len(errs));[print(e[:300]) for e in errs[:10]]
        b.close()
main()
