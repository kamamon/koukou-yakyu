import sys, os, json, time, random
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
WEEKS=int(sys.argv[1]) if len(sys.argv)>1 else 120
SHOT=len(sys.argv)>2 and sys.argv[2]=='shot'
MODE=sys.argv[3] if len(sys.argv)>3 else 'normal'
errors=[]
def sc(h):
    try: h.click(timeout=1500,force=True)
    except Exception as e: pass
def run():
    with sync_playwright() as p:
        b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-unsafe-swiftshader'])
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
        pg=ctx.new_page();pg.add_init_script('window.__crowdN=1200')
        pg.set_default_timeout(4000)
        pg.route("**/*",lambda route: route.abort() if 'googleapis' in route.request.url or 'gstatic' in route.request.url else route.continue_())
        pg.on('pageerror',lambda e: errors.append('PAGEERROR: '+str(e)))
        pg.on('console',lambda m: errors.append('CONSOLE '+m.type+': '+m.text) if m.type in ('error',) and 'Failed to load resource' not in m.text else None)
        pg.goto('file://'+HTML)
        pg.wait_for_timeout(300)
        assert pg.is_visible('#setup'), 'setup not visible'
        pg.fill('#suName','青葉学園')
        pg.select_option('#suPref','東京')
        pg.select_option('#suType','私立')
        pg.fill('input[data-scope="u"][data-k="text"]','AOBA')
        pg.check(f'input[name=suMode][value={MODE}]')
        if MODE=='custom':
            pg.fill('#cuMoney','3000'); pg.select_option('#cuGoals','1'); pg.fill('#cuStars','3')
        if SHOT: pg.screenshot(path='/home/claude/hsb/test/shot_setup.png',full_page=True)
        pg.click('[data-act="startGame"]')
        pg.wait_for_timeout(200)
        assert pg.is_visible('#game'),'game not visible'
        if SHOT: pg.screenshot(path='/home/claude/hsb/test/shot_home.png',full_page=False)
        week=0; matches=0; shots=0
        def modal_open():
            return pg.evaluate("!document.getElementById('overlay').hidden")
        def handle_modal(depth=0):
            nonlocal matches, shots
            if depth>60: raise Exception('modal loop')
            if not modal_open(): return
            html=pg.inner_html('#modal')
            def has(a): return pg.query_selector(f'[data-act="{a}"]') is not None
            if has('qShift'):
                pg.click('[data-act="qShift"]')
            elif has('tPlay'):
                pg.click('[data-act="tPlay"]')
            elif has('lineupSave'):
                mode=random.choice(['auto','digest','manager'])
                if pg.query_selector('#modeSel'): pg.select_option('#modeSel',mode,timeout=3000)
                pg.click('[data-act="lineupSave"]')
                guard=0
                while modal_open() and guard<400:
                    guard+=1
                    if pg.query_selector('[data-act="mClose"]'):
                        if SHOT and shots<3:
                            pg.screenshot(path=f'/home/claude/hsb/test/shot_result{shots}.png'); shots+=1
                        pg.click('[data-act="mClose"]'); matches+=1; break
                    for a in ['mNextHalf','mToEnd']:
                        pass
                    if pg.query_selector('[data-act="mNext3"]'):
                        if SHOT and shots<3 and random.random()<0.3:
                            pg.screenshot(path=f'/home/claude/hsb/test/shot_match{shots}.png'); shots+=1
                        pg.click('[data-act="mToEnd"]' if random.random()<0.5 else '[data-act="mNext3"]')
                    elif pg.query_selector('[data-act="mCmd"]'):
                        acts=[e.get_attribute('data-c') for e in pg.query_selector_all('[data-act="mCmd"]')]
                        if pg.query_selector('[data-act="mPinchList"]') and random.random()<0.1:
                            pg.click('[data-act="mPinchList"]');
                            if pg.query_selector('[data-act="mPinch"]'): pg.click('[data-act="mPinch"]')
                            continue
                        if pg.query_selector('[data-act="mChangeList"]') and random.random()<0.15:
                            pg.click('[data-act="mChangeList"]');
                            if pg.query_selector('[data-act="mChange"]'): pg.click('[data-act="mChange"]')
                            continue
                        if pg.query_selector('[data-act="mTimeout"]') and random.random()<0.1:
                            pg.click('[data-act="mTimeout"]'); continue
                        if pg.query_selector('[data-act="mInfield"]') and random.random()<0.2:
                            pg.click('[data-act="mInfield"]'); continue
                        if random.random()<0.08 and pg.query_selector('[data-act="mAutoInn"]'):
                            pg.click('[data-act="mAutoInn"]'); continue
                        c=random.choice(acts)
                        pg.click(f'[data-act="mCmd"][data-c="{c}"]')
                    elif pg.query_selector('[data-act="mCont"]'):
                        pg.click('[data-act="mCont"]')
                    elif pg.query_selector('[data-act="mAutoEnd"]'):
                        pg.click('[data-act="mAutoEnd"]')
                    else:
                        raise Exception('stuck in match: '+pg.inner_html('#modal')[:300])
            elif has('tClose'):
                if SHOT and shots<6:
                    pg.screenshot(path=f'/home/claude/hsb/test/shot_tourney{shots}.png',full_page=True); shots+=1
                pg.click('[data-act="tClose"]')
            elif has('campGo'):
                btns=pg.query_selector_all('[data-act="campGo"]:not([disabled])')
                if btns and random.random()<0.7: sc(btns[0])
                else: pg.click('[data-act="qShift"]')
            elif has('u18Go'):
                pg.click('[data-act="u18Go"]')
            elif has('budgetChoose'):
                pg.click('[data-act="budgetChoose"]')
            elif has('budgetReq'):
                pg.click('[data-act="budgetReq"]')
            elif has('inviteGo'):
                pg.click('[data-act="inviteGo"]')
            elif has('eventChoose'):
                btns=pg.query_selector_all('[data-act="eventChoose"]')
                sc(random.choice(btns))
            elif has('draftLottery'):
                pg.click('[data-act="draftLottery"]')
            elif has('draftLotShow'):
                pg.click('[data-act="draftLotShow"]')
            elif has('draftNext'):
                pg.click('[data-act="draftNext"]')
            elif has('gradChoose'):
                btns=pg.query_selector_all('[data-act="gradChoose"]')
                sc(random.choice(btns))
            elif has('gradNext'):
                pg.click('[data-act="gradNext"]')
            elif has('closeQ'):
                pg.click('[data-act="closeQ"]')
            elif has('closeModal'):
                pg.click('[data-act="closeModal"]')
            else:
                raise Exception('unknown modal: '+html[:400])
            pg.wait_for_timeout(10)
            handle_modal(depth+1)
        for i in range(WEEKS):
            handle_modal()
            # random management actions
            r=random.random()
            if r<0.15:
                pg.click('[data-act="tab"][data-tab="mgmt"]'); pg.wait_for_timeout(10)
                btns=pg.query_selector_all('[data-act="buyFac"]:not([disabled])')
                if btns and random.random()<0.5: sc(random.choice(btns))
                if pg.query_selector('[data-act="hireCoach"]') and random.random()<0.2: pg.click('[data-act="hireCoach"]')
                if pg.query_selector('[data-act="hireScout"]') and random.random()<0.2: pg.click('[data-act="hireScout"]')
                if pg.query_selector('[data-act="upGround"]') and random.random()<0.1: pg.click('[data-act="upGround"]')
                if pg.query_selector('[data-act="repairFac"]') and random.random()<0.5: pg.click('[data-act="repairFac"]')
                if SHOT and i==30: pg.screenshot(path='/home/claude/hsb/test/shot_mgmt.png',full_page=True)
            elif r<0.3:
                pg.click('[data-act="tab"][data-tab="players"]'); pg.wait_for_timeout(10)
                names=pg.query_selector_all('[data-act="pdetail"]')
                if names:
                    sc(random.choice(names)); pg.wait_for_timeout(10)
                    if SHOT and i==10: pg.screenshot(path='/home/claude/hsb/test/shot_player.png',full_page=True)
                    if random.random()<0.3 and pg.query_selector('#mentorSel:not([disabled])'):
                        opts=[o.get_attribute('value') for o in pg.query_selector_all('#mentorSel option') if o.get_attribute('value')]
                        if opts: pg.select_option('#mentorSel',opts[0]); pg.click('[data-act="startMentor"]')
                    if random.random()<0.2 and pg.query_selector('[data-act="startPos"]') and pg.query_selector('#posSel:not([disabled])'):
                        pg.click('[data-act="startPos"][data-kind="sub"]')
                    if pg.query_selector('[data-act="closeModal"]'): pg.click('[data-act="closeModal"]')
                sel=pg.query_selector('#bulkSel')
                if sel and random.random()<0.5:
                    opts=[o.get_attribute('value') for o in sel.query_selector_all('option')]
                    try:
                        pg.select_option('#bulkSel',random.choice(opts),timeout=2000); pg.click('[data-act="bulkApply"]',timeout=2000)
                    except Exception: pass
                if SHOT and i==5: pg.screenshot(path='/home/claude/hsb/test/shot_players.png',full_page=False)
            elif r<0.45:
                pg.click('[data-act="tab"][data-tab="scout"]'); pg.wait_for_timeout(10)
                for a in ['candNego','candVisit']:
                    btns=pg.query_selector_all(f'[data-act="{a}"]')
                    if btns: sc(random.choice(btns))
                if SHOT and i==40: pg.screenshot(path='/home/claude/hsb/test/shot_scout.png',full_page=True)
            elif r<0.55:
                pg.click('[data-act="tab"][data-tab="match"]'); pg.wait_for_timeout(10)
                if random.random()<0.4:
                    pg.click('[data-act="lineupEdit"]'); pg.wait_for_timeout(10)
                    ls=pg.query_selector_all('[data-act="lsel"]')
                    if len(ls)>=2: sc(ls[0]); sc(ls[1])
                    ls=pg.query_selector_all('[data-act="lsel"]')
                    if ls: sc(ls[2])
                    bb=pg.query_selector_all('[data-act="lbench"]')
                    if bb: sc(bb[0])
                    mv=pg.query_selector_all('[data-act="lmove"]')
                    if mv: sc(mv[1])
                    if pg.query_selector('[data-act="lineupSave"]'): pg.click('[data-act="lineupSave"]')
                    if modal_open() and pg.query_selector('[data-act="closeModal"]'): pg.click('[data-act="closeModal"]')
                if random.random()<0.3 and pg.query_selector('[data-act="lastMatch"]'):
                    pg.click('[data-act="lastMatch"]'); pg.click('[data-act="closeModal"]')
                if SHOT and i==20: pg.screenshot(path='/home/claude/hsb/test/shot_match_tab.png',full_page=True)
            elif r<0.65:
                pg.click('[data-act="tab"][data-tab="more"]'); pg.wait_for_timeout(10)
                t=random.choice(['alumni','news','history','settings','records','abil'])
                pg.click(f'[data-act="moreTab"][data-t="{t}"]')
                if t=='alumni':
                    a=pg.query_selector_all('[data-act="alumDetail"]')
                    if a: sc(random.choice(a)); pg.click('[data-act="closeModal"]')
                if t=='settings' and random.random()<0.3:
                    pg.click('[data-act="uniformEditor"]'); pg.wait_for_timeout(10)
                    pg.select_option('select[data-scope="u"][data-k="style"]','raglan',timeout=8000)
                    pg.click('[data-act="uniSwatch"][data-scope="u"][data-k="base"]')
                    pg.click('[data-act="uniSave"]')
                if t=='news':
                    if pg.query_selector('[data-act="newsIssue"]'): pg.click('[data-act="newsIssue"]')
                    arts=pg.query_selector_all('[data-act="newsOpen"]')
                    if arts: sc(random.choice(arts)); pg.wait_for_timeout(10)
                    if pg.query_selector('[data-act="closeModal"]'): pg.click('[data-act="closeModal"]')
                if t=='history':
                    a=pg.query_selector_all('[data-act="tlog"]')
                    if a: sc(random.choice(a)); pg.click('[data-act="closeModal"]')
                if SHOT and i==60 and t=='news': pg.screenshot(path='/home/claude/hsb/test/shot_news.png',full_page=True)
            else:
                pg.click('[data-act="tab"][data-tab="home"]'); pg.wait_for_timeout(10)
                if random.random()<0.25:
                    btns=pg.query_selector_all('[data-act="practice"]')
                    if btns: sc(btns[0]); pg.wait_for_timeout(10); handle_modal()
            handle_modal()
            pg.click('[data-act="tab"][data-tab="home"]'); pg.wait_for_timeout(5)
            if pg.query_selector('[data-act="advance"]'):
                pg.click('[data-act="advance"]'); week+=1
            else:
                handle_modal()
            if errors: break
        info=pg.evaluate("({date:dateStr(),money:G.money,rep:G.rep,players:G.players.length,grads:G.graduates.length,queue:G.queue.length,results:G.results,fac:Object.keys(G.fac),coach:G.coach.level,scout:G.scout?G.scout.level:null,lineup:!!G.lineup,news:G.news.length,strength:teamStrength()})")
        print('weeks advanced',week,'matches',matches,json.dumps(info,ensure_ascii=False))
        # reload test (save persistence)
        pg.reload(); pg.wait_for_timeout(300)
        print('after reload game visible:',pg.is_visible('#game'),'date',pg.evaluate("G?dateStr():null"))
        if SHOT: pg.screenshot(path='/home/claude/hsb/test/shot_end.png',full_page=False)
        b.close()
try:
    run()
except Exception as e:
    import traceback; tb=[l.strip() for l in traceback.format_exc().splitlines() if 'ui_test.py' in l]; errors.append('EXC: '+str(e).splitlines()[0]+' @ '+' | '.join(tb[-2:]))
print('ERRORS:',len(errors))
for e in errors[:20]: print(e)
