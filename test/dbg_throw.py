import os
from playwright.sync_api import sync_playwright
HTML=os.path.abspath(os.path.join(os.path.dirname(__file__),'../dist/高校野球シミュレーション.html'))
with sync_playwright() as p:
    b=p.chromium.launch();ctx=b.new_context(viewport={'width':390,'height':844});pg=ctx.new_page()
    pg.route("**/*",lambda r: r.abort() if 'googleapis' in r.request.url else r.continue_())
    pg.on('pageerror',lambda e: print('PAGEERR',e))
    pg.goto('file://'+HTML);pg.wait_for_timeout(200)
    pg.check('input[name=suMode][value=custom]');pg.click('[data-act="startGame"]');pg.wait_for_timeout(100)
    if pg.query_selector('[data-act="qShift"]'): pg.click('[data-act="qShift"]')
    pg.evaluate("enqueue({type:'practice',opp:{name:'横浜学院',strength:60,pref:'神奈川'}});render();")
    pg.wait_for_timeout(100)
    pg.select_option('#modeSel','action');pg.click('[data-act="lineupSave"]');pg.wait_for_timeout(300)
    pg.click('[data-act="arBannerNext"]');pg.wait_for_timeout(250)
    r=pg.evaluate("""(()=>{const m=AR.m;arAbortPA();let g=0;while(!m.done&&g++<400&&m.userBatting())m.step();AR.banner=null;AR.bannerEl=null;arOverlay('','');arNextPA();
      const info={side:AR.side,phase:AR.phase,pa:!!m.pa,done:m.pa&&m.pa.done,askDef:m.askDef,auto:m.autoUntil,isUser:m.def().isUser};
      if(AR.side!=='pit'||!m.pa||m.pa.done)return info;const t=m.bat();m.outs=Math.min(m.outs,1);if(!m.bases[0]){m.bases[0]=t.lineup[(t.batIdx+8)%9].p;}
      const P=m.throwPitch(null);AR.cur=P;const sw={type:'meet',cx:P.x,cy:P.y,dt:0};let ev=null;let tries=0;
      for(let i=0;i<80&&!ev;i++){tries++;const c=m.contact(m.pa.be,m.pa.pe,P,sw,m.pa.bHand);if(c.kind==='inplay'){c.la=2;c.ev=118;c.a=-12;m.battedBall(c,m.pa.be,m.pa.pe);if(c.res!=='GO'){c.res='GO';c.fpos='遊';c.type='ground';c.dist=22;}ev={P,sw,kind:'inplay',bb:c,c,text:'',paDone:false,count:[0,0]};m.askDef=true;m.applyInplay(ev,null);info.dec=ev.decision?ev.decision.kind:null;if(!ev.decision){m.paEnd(ev,'GO');}}}
      info.tries=tries;info.ev=!!ev;if(ev){AR.swung=true;AR.swingT=performance.now()-400;AR.ev=ev;arShowResult(ev);}info.phase2=AR.phase;return info;})()""")
    print(r)
    for i in range(20):
        pg.wait_for_timeout(300)
        ph=pg.evaluate("AR.phase")
        if ph=='decide':
            print('decide reached');pg.screenshot(path='m_throw_decide.png');break
    print('phase',pg.evaluate("AR.phase"))
    if pg.evaluate("AR.phase")=='decide':
        pg.click('[data-act="arDecide"][data-t="2"]');pg.wait_for_timeout(900);pg.screenshot(path='m_throw_play.png')
        for i in range(20):
            pg.wait_for_timeout(300)
            if pg.evaluate("AR.phase")=='after':
                pg.wait_for_timeout(200);pg.screenshot(path='m_throw_result.png');break
    b.close()
