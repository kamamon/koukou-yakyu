"""新しい操作（押して投球→離してスイング／投球は2回押し）の検証。performance.now を差し替えて時間を制御"""
import os,sys
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
errs=[]
def main():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1);pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
        pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto('file://'+HTML);pg.wait_for_timeout(200)
        pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();");pg.wait_for_timeout(100)
        pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(400)
        pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(300)
        def goto(side):
            for i in range(60):
                st=pg.evaluate("[AR.phase,AR.side]")
                if st[0]=='pre' and st[1]==side:return True
                if st[0]=='half':pg.click('[data-act="arBannerNext"]')
                elif st[0] in('after','field','replay'):pg.evaluate("arSkip()")
                elif st[0]=='pre':pg.evaluate("arAbortPA();arNextPA();")
                elif st[0]=='decide':pg.evaluate("ACT.arDecide({v:'0'})")
                pg.wait_for_timeout(200)
            return False
        rect=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height];})()")
        cx=rect[0]+rect[2]*0.5;cy=rect[1]+rect[3]*0.75
        # ---- 打撃：押す→投球開始、動かす→カーソル、離す→スイング
        assert goto('bat'),'bat pre not reached'
        print('settings',pg.evaluate("({meter:actionSettings().meter,defThrow:actionSettings().defThrow,ease:actionSettings().batEase})"))
        pg.evaluate("window.__realNow=performance.now.bind(performance);window.__t=performance.now();performance.now=()=>window.__t;")
        c0=pg.evaluate("AR.cursor")
        pg.mouse.move(cx,cy);pg.mouse.down();pg.wait_for_timeout(100)
        print('after down',pg.evaluate("[AR.phase,AR.hold,!!AR.cur]"))
        for i in range(30):
            pg.evaluate("window.__t+=120");pg.wait_for_timeout(150)
            if pg.evaluate("AR.phase")=='flight':break
        print('flight?',pg.evaluate("AR.phase"))
        pg.mouse.move(cx+40,cy-30,steps=4);pg.wait_for_timeout(100)
        c1=pg.evaluate("AR.cursor");print('cursor moved',c0,'->',c1)
        # ボール到達の少し前で離す
        pg.evaluate("window.__t=AR.t0+(AR.cur.T-70)*AR.speed-10");pg.wait_for_timeout(100)
        pg.mouse.up();pg.wait_for_timeout(150)
        print('after up',pg.evaluate("[AR.phase,AR.swung,AR.ev?AR.ev.kind:null,AR.swing?Math.round(AR.swing.dt):null,AR.swing?AR.swing.ease:null]"))
        # 早く離したら見逃し
        pg.evaluate("window.__t+=3000");pg.wait_for_timeout(300)
        for i in range(10):
            ph=pg.evaluate("AR.phase")
            if ph=='pre':break
            pg.evaluate("window.__t+=1500");pg.wait_for_timeout(200)
            if pg.evaluate("AR.phase")=='decide':pg.evaluate("ACT.arDecide({v:'0'})")
            if pg.evaluate("AR.phase")=='half':pg.click('[data-act="arBannerNext"]')
        if pg.evaluate("AR.side")=='bat' and pg.evaluate("AR.phase")=='pre':
            pg.mouse.move(cx,cy);pg.mouse.down();pg.wait_for_timeout(100);pg.evaluate("window.__t+=200");pg.wait_for_timeout(50);pg.mouse.up();pg.wait_for_timeout(100)
            pg.evaluate("window.__t+=2500");pg.wait_for_timeout(200)
            print('early release → take?',pg.evaluate("[AR.phase,AR.swung,AR.ev?AR.ev.kind:null]"))
        # ---- 投球：ドラッグで狙い、タップで開始、タップでリリース
        pg.evaluate("performance.now=window.__realNow;")
        assert goto('pit'),'pit pre not reached'
        pg.evaluate("window.__t=performance.now();performance.now=()=>window.__t;")
        t0=pg.evaluate("AR.target");print('default target',t0)
        pg.mouse.move(cx,cy);pg.mouse.down();pg.mouse.move(cx+60,cy+20,steps=5);pg.mouse.up();pg.wait_for_timeout(100)
        t1=pg.evaluate("AR.target");print('drag target',t1,'phase',pg.evaluate("AR.phase"))
        pg.mouse.click(cx,cy+40);pg.wait_for_timeout(150)
        print('tap1 →',pg.evaluate("[AR.phase,AR.gauge?AR.gauge.mode:null]"))
        pg.evaluate("window.__t+=380");pg.wait_for_timeout(100)
        pg.mouse.click(cx,cy+40);pg.wait_for_timeout(150)
        print('tap2 →',pg.evaluate("[AR.phase,AR.cur?AR.cur.v:null,AR.meterRes]"))
        print('ERRORS',len(errs));[print(e[:300]) for e in errs[:10]]
        b.close()
main()
