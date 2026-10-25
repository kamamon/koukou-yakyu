import os,sys,time
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
URL=os.environ.get('URL') or ('file://'+HTML)
MODE=os.environ.get('MODE','3d')   # 3d | 2d
DARK=os.environ.get('DARK')=='1'
OUT=os.environ.get('OUT','intro')
errs=[]
def main():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,color_scheme='dark' if DARK else 'light');pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200;window.__introHold=true')
        pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.on('console',lambda m: print('CONSOLE',m.text[:300]) if (m.type=='error' and 'ERR_FAILED' not in m.text and 'googleapis' not in m.text) else None)
        pg.goto(URL);pg.wait_for_timeout(300)
        pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
        if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
        # 選手詳細のレーダーチャート（試合前に確認）
        pg.evaluate("openModal(playerDetailHtml(G.players.find(p=>p.pos==='投')))");pg.wait_for_timeout(200)
        assert pg.evaluate("document.querySelectorAll('.radar').length")==2,'pitcher detail should have 2 radars'
        pg.screenshot(path=f'{OUT}_detail_p.png')
        pg.evaluate("closeModal();openModal(playerDetailHtml(G.players.find(p=>p.pos!=='投')))");pg.wait_for_timeout(200)
        assert pg.evaluate("document.querySelectorAll('.radar').length")>=1,'fielder detail should have a radar'
        pg.screenshot(path=f'{OUT}_detail_b.png')
        pg.evaluate("closeModal()");pg.wait_for_timeout(100)
        pg.evaluate(f"actionSettings().view3d={'true' if MODE=='3d' else 'false'};")
        # Sランクの注目選手がいる強豪校と練習試合
        info=pg.evaluate("""(()=>{const st=G.stars.find(s=>s.rank==='S'&&s.pos!=='投')||G.stars.find(s=>s.rank==='S');const sc=allSchools().find(s=>s.name===st.school&&s.pref===st.pref);
          enqueue({type:'practice',opp:{name:sc.name,strength:sc.strength,pref:sc.pref,elite:!!sc.elite}});render();return {star:st.name,pos:st.pos,school:sc.name,strength:sc.strength,stars:G.stars.filter(x=>x.school===sc.name).map(x=>x.rank+x.pos+x.name)};})()""")
        print('opp',info)
        pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(600)
        pg.evaluate("AR.introHold=true")
        if MODE=='3d':
            # GLモデルの読み込みを待つ（ローカルサーバー経由のときだけ成功する）
            for i in range(40):
                if pg.evaluate("typeof GL!=='undefined'&&(GL.ready||GL.failed)"):break
                pg.wait_for_timeout(250)
            print('GL',pg.evaluate("typeof GL!=='undefined'?{ready:GL.ready,failed:GL.failed}:null"))
        pg.evaluate("if(AR.intro){AR.intro.t0=performance.now();AR.intro.el=-1;}")
        st=pg.evaluate("({ph:AR.phase,items:AR.intro?AR.intro.items.map(i=>i.kind+':'+i.p.name+':'+ratingRank(i.p)+Math.round(rating(i.p))):null})")
        print('intro',st)
        assert st['ph']=='intro',st
        assert st['items'] and len(st['items'])==2,st
        pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}_pit_a.png')
        pg.evaluate("if(AR.intro){AR.intro.t0=performance.now()-4000;}");pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}_pit_b.png')
        html=pg.evaluate("document.querySelector('#arov').innerHTML")
        assert 'ar-cutin' in html and 'radar' in html,'cut-in html missing'
        # 自動で2人目へ（タイマーを進めて確認）
        if MODE=='2d':
            pg.evaluate("window.__introHold=false;AR.introHold=false;if(AR.intro){AR.intro.t0=performance.now()-5000;}")
            for i in range(40):
                if pg.evaluate("AR.intro&&AR.intro.idx===1"):break
                pg.wait_for_timeout(150)
            assert pg.evaluate("AR.intro&&AR.intro.idx===1"),'did not advance to 2nd item'
        else:
            pg.evaluate("arIntroNext()")   # ソフトウェア描画は1フレームが重くタイマーが止まるため手動で進める
            assert pg.evaluate("AR.intro&&AR.intro.idx===1"),'did not advance to 2nd item'
        pg.evaluate("AR.introHold=true");pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}_bat_a.png')
        pg.evaluate("if(AR.intro){AR.intro.t0=performance.now()-4000;}");pg.wait_for_timeout(700)
        pg.screenshot(path=f'{OUT}_bat_b.png')
        # タップでスキップ → PLAY BALL
        r=pg.evaluate("(()=>{const r=AR.cv.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height*0.3];})()")
        pg.mouse.click(r[0],r[1]);pg.wait_for_timeout(300)
        st=pg.evaluate("({ph:AR.phase,title:AR.banner?AR.banner.title:null})")
        print('after skip',st)
        assert st['ph']=='half' and st['title']=='PLAY BALL',st
        pg.screenshot(path=f'{OUT}_playball.png')
        pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(500)
        print('phase',pg.evaluate("AR.phase"))
        print('ERRORS',len(errs));[print(e[:300]) for e in errs[:10]]
        assert not errs
        b.close()
main()
