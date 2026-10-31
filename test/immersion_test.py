import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
URL=os.environ.get('URL') or ('file://'+HTML)
MODE=os.environ.get('MODE','2d')
OUT=os.environ.get('OUT','im')
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2);pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200;window.__introHold=true')
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('console',lambda m: print('CONSOLE',m.text[:300]) if (m.type=='error' and 'ERR_FAILED' not in m.text and 'TUNNEL' not in m.text) else None)
    pg.goto(URL);pg.wait_for_timeout(300)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(200)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate(f"actionSettings().view3d={'true' if MODE=='3d' else 'false'};imSettings().voice='text';")
    # 公式戦（県大会）を弱い相手で：大会を開幕→オーダー画面→操作モードで試合へ
    pg.evaluate("""(()=>{G.queue=[];startTourney('pref');const t=G.tourney;const um=userMatch(t);const opp=um.a.isUser?um.b:um.a;opp.strength=12;opp.name='弱小高校';render();ACT.tPlay();})()""")
    pg.wait_for_timeout(400)
    assert pg.evaluate("!!document.querySelector('#lineupForm')"),'lineup editor not shown'
    # DH制の切り替えが動くこと
    pg.click('[data-act="lDH"][data-v="1"]');pg.wait_for_timeout(150)
    assert pg.evaluate("UI.lw.some(s=>s.pos==='指')&&!!UI.lsp"),'DH toggle failed'
    pg.screenshot(path=f'{OUT}_lineup_dh.png')
    pg.click('[data-act="lDH"][data-v="0"]');pg.wait_for_timeout(150)
    assert pg.evaluate("UI.lw.some(s=>s.pos==='投')"),'DH off failed'
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(600)
    pg.evaluate("AR.introHold=true;if(AR.phase==='intro')arPlayBall();");pg.wait_for_timeout(300)
    assert pg.evaluate("AR.phase")=='half',pg.evaluate("AR.phase")
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(500)
    # 何球か投げて字幕が出ることを確認
    caps=0
    for i in range(14):
        st=pg.evaluate("({ph:AR.phase,side:AR.side})")
        if st['ph']=='pre' and st['side']=='bat':pg.click('[data-act="arThrow"]');pg.wait_for_timeout(1300);pg.evaluate("if(AR.phase==='flight'&&!AR.swung){AR.cursor={x:AR.cur.x,y:AR.cur.y};arSwing();}")
        elif st['ph']=='pre' and st['side']=='pit':pg.evaluate("if(document.querySelector('[data-act=\"arAutoPitch\"]'))ACT.arAutoPitch()")
        elif st['ph'] in('after','field','replay'):pg.evaluate("arSkip()")
        elif st['ph']=='half':pg.evaluate("arAfterBanner()")
        elif st['ph']=='decide':pg.evaluate("const b=document.querySelector('[data-act=\"arDecide\"]');if(b)b.click()")
        pg.wait_for_timeout(500)
        if pg.evaluate("!!document.querySelector('#arcap')&&(!document.querySelector('#arcap').hidden||document.querySelector('#arcap').textContent.length>0)"):
            caps+=1
            if caps==1:pg.screenshot(path=f'{OUT}_caption.png')
    print('caption seen',caps)
    if MODE=='3d':
        pg.evaluate("imSnap('hr','テスト用の写真',3)")
        for i in range(30):
            if pg.evaluate("(AR.snaps||[]).length>0"):break
            pg.wait_for_timeout(500)
        snap=pg.evaluate("(AR.snaps||[]).map(s=>s.kind+':'+String(s.data).slice(0,23))");print('snaps',snap)
        assert snap and 'data:image/jpeg' in snap[0],'3D snapshot failed'
    assert caps>0,'no commentary caption appeared'
    # 最後までおまかせ → 試合終了のボード → 校歌斉唱
    pg.evaluate("ACT.arAutoEnd()");pg.wait_for_timeout(300)
    won=pg.evaluate("AR.m.winner===(AR.m.A.isUser?0:1)")
    print('won',won,'score',pg.evaluate("AR.m.score"))
    pg.evaluate("AR.banner&&(AR.banner.until=0)")
    for i in range(40):
        pg.wait_for_timeout(400)
        if pg.evaluate("AR.phase")!='half':break
    ph=pg.evaluate("AR.phase");print('phase after board',ph)
    if won:
        assert ph=='cer',ph
        pg.wait_for_timeout(2600 if MODE=='2d' else 4000);pg.screenshot(path=f'{OUT}_song.png')
        assert '校歌斉唱' in pg.evaluate("document.querySelector('#arov').innerHTML"),'song overlay missing'
        pg.click('[data-act="cerNext"]');pg.wait_for_timeout(400)
    # 結果画面 → 閉じる → 新聞に試合記事
    assert pg.evaluate("UI.match&&UI.match.phase==='result'"),'result not shown'
    art=pg.evaluate("UI.match.res.article?{t:UI.match.res.article.title,s:UI.match.res.article.sub}:null");print('article',art)
    assert art,'no game article'
    pg.click('[data-act="mClose"]');pg.wait_for_timeout(300)
    pg.evaluate("ACT.openPaper()");pg.wait_for_timeout(300)
    h=pg.evaluate("document.querySelector('.np').getBoundingClientRect().height")
    pg.set_viewport_size({'width':390,'height':int(h)+300});pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_paper.png',full_page=True)
    pg.set_viewport_size({'width':390,'height':844})
    pg.evaluate("UI.tab='more';UI.moreTab='album';render()");pg.wait_for_timeout(200)
    pg.screenshot(path=f'{OUT}_album.png')
    print('photos',pg.evaluate("(G.photos||[]).length"),'mementos',pg.evaluate("(G.mementos||[]).length"),'rival',pg.evaluate("JSON.stringify(G.rival)"))
    print('ERRORS',len(errs));[print(e[:300]) for e in errs[:8]]
    assert not errs
    b.close()
