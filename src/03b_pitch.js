/* ================= 一球単位エンジン（操作モード／プロスピ風） =================
 座標系は捕手視点。x:-1..1 がストライクゾーンの横幅（-が三塁側＝右打者の内角）、y:-1..1 が縦（-が高め、+が低め）。
 ゾーン外は絶対値が1を超える。投球→（打者の反応）→結果 を1球ずつ解決し、打席の結果は従来エンジンと同じ関数で状態へ反映する。 */
const PITCH_PROF={
 'ストレート':{bx:0,by:-0.12,late:0.5},
 'ツーシーム':{bx:0.25,by:0.15,late:0.75},
 'シュート':{bx:0.4,by:0.15,late:0.65},
 'カットボール':{bx:-0.22,by:0.08,late:0.8},
 'スライダー':{bx:-0.55,by:0.25,late:0.6},
 '高速スライダー':{bx:-0.4,by:0.15,late:0.75},
 '縦スライダー':{bx:-0.2,by:0.6,late:0.7},
 'カーブ':{bx:-0.4,by:0.7,late:0.35},
 'スローカーブ':{bx:-0.45,by:0.85,late:0.3},
 'フォーク':{bx:0,by:0.7,late:0.78},
 'スプリット':{bx:0.05,by:0.5,late:0.82},
 'チェンジアップ':{bx:0.2,by:0.4,late:0.55},
 'シンカー':{bx:0.35,by:0.5,late:0.6},
 'パーム':{bx:0.1,by:0.55,late:0.5},
 'ナックル':{bx:0,by:0.4,late:0.5,rnd:0.6},
};
function pitchProf(name){return PITCH_PROF[name]||{bx:0,by:0.3,late:0.6};}
const FENCE=a=>100+20*Math.cos(a*Math.PI/90);
function zoneLabel(x,y,bHand){const ax=Math.abs(x),ay=Math.abs(y);if(ax>1.6||ay>1.6)return ax>1.6?(x*(bHand==='左'?1:-1)>0?'内角に大きく外れた':'外角に大きく外れた'):(y>0?'ワンバウンド気味':'高く抜けた');
 const inside=(bHand==='左'?x>0:x<0);const h=ax<0.34?'真ん中':inside?'内角':'外角';const v=ay<0.34?'':y<0?'高め':'低め';const out=ax>1||ay>1?'（ボール）':'';return (h==='真ん中'&&!v?'ど真ん中':h+v)+out;}
function dirLabel(a){return a<-30?'レフト線':a<-12?'レフト':a<=12?'センター':a<=30?'ライト':'ライト線';}
function fielderOf(c){const a=c.a;if(c.type==='ground'||c.type==='bunt')return a<-28?'三':a<-5?'遊':a<5?'投':a<28?'二':'一';if(c.type==='pop'||c.dist<45){if(c.type==='pop'&&c.dist<14)return '捕';return a<-28?'三':a<-5?'遊':a<5?'投':a<28?'二':'一';}return a<-15?'左':a<=15?'中':'右';}
const POS_JA={投:'ピッチャー',捕:'キャッチャー',一:'ファースト',二:'セカンド',三:'サード',遊:'ショート',左:'レフト',中:'センター',右:'ライト'};

/* 打席開始：CPU側の采配もここで決める */
Match.prototype.paStart=function(){const t=this.bat(),d=this.def();
 if(!d.isUser||this.autoUntil)this.aiPitchingChange(d);
 const slot=t.lineup[t.batIdx];const b=slot.p,p=d.pitcher;
 const bHand=b.bats==='両'?(p.throws==='右'?'左':'右'):b.bats;
 const pa={b,p,bHand,balls:0,strikes:0,pitches:[],cmd:null,buntMode:false,done:false,res:null,n:0,runnerGo:false,bm:{},pm:{},aggro:false};this.pa=pa;
 if(d.demon&&(d.demon.inn!==this.inn||d.demon.top!==this.top))d.demon=null;
 if(!t.isUser||this.autoUntil){const bc=this.aiBatCommand();if(bc==='bunt')pa.buntMode=true;else if(bc==='steal')pa.cmd='steal';}
 if(!d.isUser||this.autoUntil){const dc=this.aiDefCommand();if(dc==='ibb')pa.cmd='ibb';}
 return pa;};
/* 敬遠 */
Match.prototype.paIbb=function(){const pa=this.pa;const t=this.bat(),d=this.def();const b=pa.b,p=pa.p;const bs=bst(t,b),ps=pst(d,p);
 bs.pa++;bs.bb++;ps.bb++;this.forceAdvance(b);d.pc[p.id]=(d.pc[p.id]||0)+4;ps.np+=4;this.addLog(`${this.outs}死${this.basesStr()} ${b.name} 敬遠四球`,'bb');
 const ev={kind:'ibb',text:'敬遠四球',paDone:true,res:'IBB',count:[4,pa.strikes]};this.paEnd(ev,'IBB');return ev;};
Match.prototype.paEnd=function(ev,res){const pa=this.pa;const d=this.def();pa.done=true;pa.res=res;ev.paDone=true;ev.res=res;if(d.compose>0)d.compose--;const inn=this.inn,top=this.top;this.nextBatter();if(this.inn!==inn||this.top!==top||this.done)ev.halfEnd=true;};
/* CPU投手の配球 */
Match.prototype.cpuPitchInput=function(){const pa=this.pa;const p=pa.p,b=pa.b;const ps=p.pit.pitches.length?p.pit.pitches:[{name:'ストレート',velo:p.pit.velo,move:40,sharp:40,ctrl:40}];
 const strikes=pa.strikes,balls=pa.balls;
 const pm=pa.pm||{};const lastFast=pa.pitches.length?pa.pitches[pa.pitches.length-1].name==='ストレート':false;
 const w=ps.map(x=>{let q=Math.max(5,(x.move+x.sharp+x.ctrl)/3);if(x.name==='ストレート')q*=balls>strikes?2.2:1.3;else if(strikes===2)q*=1.5;if(balls===3)q*=Math.max(0.2,x.ctrl/50);
  if(pm.pitchPref==='fast'&&x.name==='ストレート')q*=3;if(pm.pitchPref==='break2'&&strikes===2&&x.name!=='ストレート')q*=3;if(pm.pitchPref==='alt'){if(lastFast&&x.name!=='ストレート')q*=4;if(!lastFast&&x.name==='ストレート')q*=4;}return q;});
 let r=R()*sum(w);let pitch=ps[0];for(let i=0;i<ps.length;i++){r-=w[i];if(r<=0){pitch=ps[i];break;}}
 const chase=clamp([0.15,0.32,0.55][strikes]-balls*0.1+(pm.chase||0),0.02,0.8);let tx,ty;
 const inS=pa.bHand==='左'?1:-1;const pw=(b.bat.powR+b.bat.powL)/2;
 if(R()<chase){const side=R()<0.62?-inS:inS;tx=side*rf(1.05,1.45);ty=R()<0.65?rf(0.9,1.5):rf(-1.4,-0.9);const prof=pitchProf(pitch.name);if(prof.by>0.4){tx=rf(-0.7,0.7);ty=rf(1.05,1.5);}}
 else{const corner=R()<0.75;tx=corner?pick([-1,1])*rf(0.45,0.85):rf(-0.5,0.5);ty=corner?(R()<(pw>=65?0.72:0.55)?rf(0.35,0.85):rf(-0.85,-0.3)):rf(-0.5,0.6);if(balls===3&&strikes<2){tx*=0.6;ty*=0.6;}}
 const risp=this.bases[1]||this.bases[2];let power=((strikes===2)||(risp&&this.inn>=7))&&R()<0.6?'max':'normal';
 if(pm.zoneTight){tx*=1-pm.zoneTight;ty*=1-pm.zoneTight;}if(pm.ty)ty=clamp(ty+pm.ty,-1.6,1.6);if(pm.tx){const dir=pm.tx==='in'?inS:-inS;tx=clamp(tx+dir*(pm.txAmt||0.3)*(pm.e||1),-1.6,1.6);if(tx*dir<0)tx=dir*Math.abs(tx)*0.5;}
 if(pm.power)power=pm.power;
 return {pitch,tx,ty,power,rel:null};};
/* 投球：入力（投手の狙い）から実際の球を生成。副作用：球数 */
Match.prototype.throwPitch=function(inp){const pa=this.pa;const d=this.def(),p=pa.p,b=pa.b;
 inp=inp||this.cpuPitchInput();
 const pitch=inp.pitch;const pe=this.pitchingEff(p,b,pitch);const be=this.battingEff(b,p,pitch);pa.pe=pe;pa.be=be;
 const pm=pa.pm||{},bm=pa.bm||{};
 pe.k+=pm.k||0;pe.hit+=pm.hit||0;pe.hr+=pm.hr||0;pe.velo+=pm.velo||0;be.meet+=bm.meet||0;be.pow+=bm.pow||0;be.eye+=bm.eye||0;be.bunt+=bm.buntSkill||0;
 if(d.stealAlert&&this.bases.some(Boolean))pe.ctrlMod-=3;
 const power=inp.power||'normal';
 let ctrl=pitch.ctrl+pe.ctrlMod+(pm.ctrl||0)+(power==='max'?-8:power==='ease'?6:0)+(inp.ctrlAdj||0);
 let sig=clamp(0.62-(ctrl-50)/260,0.2,0.95)*(1+pe.tired*0.8);
 let relF=1,slip=false;
 if(inp.rel!=null){const r=inp.rel;relF=r<0.1?0.5:r<0.3?0.8:r<0.6?1.3:1.9;if(r>=0.6&&R()<0.25)slip=true;}
 sig*=relF;
 let x,y;
 if(inp.pitchout){x=-(pa.bHand==='左'?1:-1)*2.1;y=-0.6;}
 else{x=inp.tx+gauss(0,sig*0.85);y=inp.ty+gauss(0,sig);if(slip){y-=0.8;x+=gauss(0,0.4);}}
 let v=pitch.velo-pe.tired*8+(power==='max'?2:power==='ease'?-4:0)+(pm.velo||0)+(inp.veloAdj||0)+gauss(0,1.2);if(slip)v-=5;
 if(pitch.name==='ストレート')v=Math.min(v,p.pit.velo+2+Math.max(0,inp.veloAdj||0)*0.5);
 v=Math.round(v);
 const prof=pitchProf(pitch.name);const mag=0.5+(pitch.move+pe.moveMod)/100;const hs=p.throws==='左'?-1:1;
 let bx=-prof.bx*mag*hs,by=prof.by*mag;/* 物理と同じ向き：右投手のスライダーは一塁側（+x）へ、シュートは三塁側（-x）へ曲がる */if(prof.rnd){bx+=gauss(0,prof.rnd*mag);by+=gauss(0,prof.rnd*mag*0.6);}
 const late=clamp(prof.late+((pitch.sharp+pe.sharpMod)-50)/300,0.25,0.9);
 const T=Math.round(1250-(v-110)*7);
 const ps=pst(d,p);d.pc[p.id]=(d.pc[p.id]||0)+1;ps.np++;if(pm.npExtra&&R()<0.5)d.pc[p.id]++;if(pm.npSave&&R()<0.3)d.pc[p.id]=Math.max(0,d.pc[p.id]-1);
 if(pitch.name==='ストレート'&&v>ps.maxV)ps.maxV=v;
 pa.runnerGo=(pa.cmd==='steal'||pa.cmd==='hitrun'||pa.cmd==='squeeze')&&this.bases.some(Boolean);
 const P={name:pitch.name,v,tx:inp.tx,ty:inp.ty,x,y,bx,by,late,T,power,slip,sharp:pitch.sharp+pe.sharpMod,move:pitch.move+pe.moveMod,strike:Math.abs(x)<=1&&Math.abs(y)<=1,n:pa.n+1,cmd:pa.cmd,pitchout:!!inp.pitchout,hs,form:p.pitForm||'over',bHand:pa.bHand,label:zoneLabel(x,y,pa.bHand)};
 pa.cur=P;return P;};
/* CPU打者の反応：null=見逃し、または{type,cx,cy,dt} */
Match.prototype.cpuSwingInput=function(P){const pa=this.pa;const be=pa.be,b=pa.b;const strikes=pa.strikes,balls=pa.balls;
 if(pa.cmd==='take')return null;
 const eyeF=clamp((be.eye-30)/80,0,0.85);const brk=Math.hypot(P.bx,P.by);
 const pe=pa.pe;const r0=clamp(0.30+(be.meet-50)/330,0.12,0.5);
 const nsg=clamp(0.46+(pe.k-be.meet)/450+Math.max(0,P.v-125)/450+(P.sharp-50)/1100,0.20,1.05);
 const sp=clamp(0.3*r0-(be.eye-50)/900+(pe.k-50)/1200,0.03,0.25)+brk*0.12*(1-eyeF)*P.late;
 const px=P.x+gauss(0,sp),py=P.y+gauss(0,sp);
 const dz=Math.max(Math.abs(px),Math.abs(py));
 if(P.pitchout&&!pa.runnerGo)return null;
 if(pa.cmd==='squeeze'&&this.bases[2]){return {type:'bunt',cx:px+gauss(0,0.2),cy:py+gauss(0,0.15),dt:gauss(0,60)};}
 const bm=pa.bm||{},pm=pa.pm||{};
 if((pa.buntMode||bm.bunt)&&strikes<2){if(dz<=1.15+(bm.safety?0.1:0))return {type:'bunt',cx:px+gauss(0,0.15),cy:py+gauss(0,0.12),dt:gauss(0,40)};return null;}
 let margin=(strikes===2?0.32:0.1)-(be.eye-50)/400+(bm.margin||0);
 if(balls===3&&strikes<2)margin-=0.5;if(balls===0&&strikes===0)margin-=0.12;
 let swingP;
 if(dz<=1+margin){swingP=strikes===2?0.92:(balls===3?0.3:balls===0&&strikes===0?0.55:0.75);}
 else{const over=dz-(1+margin);swingP=Math.max(0.01,0.3*Math.exp(-over*3))*(strikes===2?1.5:1)*(1-eyeF*0.6);}
 if(bm.swingMul&&strikes<2)swingP*=bm.swingMul;if(bm.firstMul&&balls===0&&strikes===0&&dz<=1.05)swingP=Math.min(0.97,swingP*bm.firstMul);
 if(pa.cmd==='hitrun')swingP=dz<=1.5?0.97:0.6;
 if(R()>=swingP)return null;
 const sc=clamp(nsg*r0*(bm.noiseMul||1),0.05,0.5);
 const expV=pa.p.pit.velo;let st=63+(pe.k-be.meet)*0.35+Math.max(0,P.v-125)*0.45+Math.abs(P.v-expV)*2.0*(1-eyeF*0.7)+(P.name!=='ストレート'?P.late*30*(1-eyeF):0)+(pm.stBias||0);
 let type=(strikes<2&&be.pow>=55&&R()<0.35+(be.pow-55)/80)?'power':'meet';if(bm.swing&&R()<(bm.swingProb==null?1:bm.swingProb)&&!(strikes===2&&bm.swing==='power'&&R()<0.3))type=bm.swing;
 return {type,cx:px+gauss(0,sc),cy:py+gauss(0,sc)-(bm.cyUp||0),dt:gauss(0,st)+(bm.dtBias||0)};};
/* スイングと球の接触判定 */
Match.prototype.contact=function(be,pe,P,sw,bHand){const meet=be.meet,pow=be.pow;
 let r=0.30+(meet-50)/330;if(sw.type==='power')r*=0.72;r=clamp(r,0.12,0.5);const em=sw.ease||null;if(em)r*=em.r||1;const rx=r*1.25,ry=r*0.85;
 const d=Math.hypot((sw.cx-P.x)/rx,(sw.cy-P.y)/ry);
 const tw=(55+(meet-50)*0.2)*(em?(em.tw||1):1);const adt=Math.abs(sw.dt);
 const tf=adt<=tw?1:adt<=2.2*tw?1-(adt-tw)/(1.2*tw)*0.7:adt<=3.2*tw?0.3:0;
 const res={kind:'miss',d,tf,tw,rx,ry};
 if(tf===0||d>1.3)return res;
 if(d>1){if(R()<0.6){res.kind='foul';res.tip=true;}return res;}
 const posF=1-0.18*Math.max(0,Math.hypot(P.x,P.y)-0.8);
 const q=(1-d*0.6)*tf;res.q=q;
 /* 打球速度（km/h）：高校生の上限は160前後。完璧な当たり×パワーで伸び、投手の被弾性・被安打性で少し落ちる */
 /* パワーは加速度的に効く（S級は150km/h超が当たり前で、年間100本塁打も狙える） */
 const pw=Math.min(pow,105);const powX=(pw-50)*0.2+Math.pow(clamp(pw-70,0,30),2)/80;/* 本塁打用のパワー上積み（安打判定には使わない） */
 let ev=97+q*posF*30+(pw-50)*0.25+powX-(pe.hit-50)*0.06-(pe.hr-50)*0.08+(sw.type==='power'?8:0)+gauss(0,8);
 const bmc=(this.pa&&this.pa.bm)||{},pmc=(this.pa&&this.pa.pm)||{};
 let la=10+clamp((sw.cy-P.y)/ry,-1,1)*30+(sw.type==='power'?5:0)+clamp(pow-50,0,50)*0.1+gauss(0,9)+(bmc.laBias||0)-(pmc.gb||0);/* 強打者はやや打ち上げる */
 const hs=bHand==='左'?-1:1;
 let a=clamp(sw.dt,-3.2*tw,3.2*tw)/(2.5*tw)*35*hs+gauss(0,13)+(bmc.aBias||0)*(-hs);
 Object.assign(res,{ev:Math.round(ev),la:Math.round(la),a:Math.round(a),powX:Math.round(powX)});
 const pFoul=clamp(0.08+d*0.3+(1-tf)*0.45+(Math.hypot(P.x,P.y)>1?0.15:0),0,0.92);
 if(Math.abs(a)>45||(la>62&&R()<0.5)||R()<pFoul){res.kind='foul';return res;}
 res.kind='inplay';return res;};
/* 打球の行方（安打／アウトの種類） */
Match.prototype.battedBall=function(c,be,pe){const d=this.def();const bHand=this.pa.bHand;const pm=this.pa.pm||{};const dm=d.demon&&d.demon.inn===this.inn&&d.demon.top===this.top?d.demon.lv:0;const def=(bHand==='右'?d.defR:d.defL)+(pm.def||0)-(dm?4+2*dm:0);
 const ev=c.ev,la=c.la,a=c.a;const evc=ev-(c.powX||0);/* 安打判定用（パワー上積みを除いた打球速度） */const type=la<8?'ground':la<22?'line':la<48?'fly':'pop';c.type=type;
 /* 飛距離：20〜45度でよく飛ぶ（実測に近い形）。150km/h・30度で約115m */const lar=(Math.min(la,60)+8)*Math.PI/180;let f=Math.pow(Math.max(0,Math.sin(2*lar)),0.8);if(la>45)f*=Math.max(0,1-(la-45)/50);
 let dist=0.0052*ev*ev*f;if(type==='ground')dist=clamp((ev-60)*0.6,8,70);if(type==='pop')dist=Math.min(dist,60);c.dist=Math.round(dist);
 const fence=FENCE(a);c.fence=Math.round(fence);
 const gap=Math.abs(a)>12&&Math.abs(a)<32;const line=Math.abs(a)>38;
 /* フェンス際はぎりぎり越える／越えないの確率的な判定 */
 if((type==='fly'||type==='line')&&dist>=fence-10&&R()<clamp((dist-(fence-10))/16,0,1)){c.res='HR';c.dist=Math.max(c.dist,Math.round(fence+1));c.fpos=fielderOf(c);return c;}
 let hp,xb=0,tr=0;const ofDeep=d.ofDeep?1:0,ofIn=d.ofIn?1:0;
 /* 格下投手に対する上積み（ミート−被安打性の二乗）：強打者が弱い相手を打ち込む */const edge=Math.pow(clamp(be.meet-pe.hit,0,60),2)/50000+(be.meet-50)/900;
 if(type==='ground'){hp=0.17+(evc-110)/500+(be.speed-50)/450-(def-50)/600+(d.infieldIn?0.07:0)+(line?0.08:0)+edge;xb=line&&evc>115?0.5:0.04;tr=line&&be.speed>=70?0.1:0;}
 else if(type==='line'){hp=0.57+(evc-120)/350-(def-50)/700+edge;xb=0.22+(dist-80)/150+(gap?0.15:0)+(be.speed-50)/400+ofIn*0.12-ofDeep*0.08;tr=(dist>80&&Math.abs(a)>25?0.1+(be.speed-50)/250:0.01);}
 else if(type==='fly'){if(dist<45){hp=0.04;xb=0;}else if(dist<62){hp=0.32-(def-50)/300+ofDeep*0.12-ofIn*0.12;xb=0.15;}else if(dist<82){hp=0.10-(def-50)/500+ofDeep*0.05-ofIn*0.04;xb=0.3;}else if(dist<fence-12){hp=0.16+(gap?0.14:0)-(def-50)/600-ofDeep*0.04;xb=0.55;}else{hp=0.45-ofDeep*0.12+ofIn*0.1;xb=0.75;tr=0.14+(be.speed-50)/250;}}
 else{hp=0.03;xb=0;}
 hp=clamp(hp*(1+pe.tired*0.15),0.02,0.72);
 const ep=clamp((0.02-(def-50)/3000)*(1-d.errRes),0.004,0.05)*(type==='ground'?1.6:type==='fly'?0.7:0.4)*(dm?1.5+0.8*dm:1);
 const r=R();
 if(r<hp){const x=R();c.res=x<clamp(tr,0,0.3)?'3B':x<clamp(tr+xb,0,0.9)?'2B':'1B';}
 else if(r<hp+ep)c.res='E';
 else c.res=type==='ground'?'GO':type==='line'?'LO':type==='fly'?'FO':'PO';
 c.fpos=fielderOf(c);return c;};
/* 走塁の判断が必要か */
Match.prototype.runDecision=function(c){const res=c.res;const sp=r=>this.runnerSpeed(r);const B=this.bases;
 if(res==='1B'){if(B[1]&&!c.bunt){const r=B[1];const p=clamp(0.62+(sp(r)-50)/220+(this.outs===2?0.08:0),0.2,0.95);return {kind:'home',from:1,runner:r,auto:p,ok:clamp(p+0.12,0.2,0.97),label:`二塁走者 ${r.name} を本塁へ突入させる？`};}
  if(B[0]&&!B[1]&&!c.bunt){const r=B[0];const p=clamp(0.25+(sp(r)-50)/250,0.05,0.8);return {kind:'third',from:0,runner:r,auto:p,ok:clamp(p+0.4,0.3,0.95),label:`一塁走者 ${r.name} を三塁まで走らせる？`};}}
 if(res==='2B'&&B[0]){const r=B[0];const p=clamp(0.42+(sp(r)-50)/200,0.1,0.9);return {kind:'home',from:0,runner:r,auto:p,ok:clamp(p+0.2,0.25,0.95),label:`一塁走者 ${r.name} を本塁へ突入させる？`};}
 if(res==='FO'&&B[2]&&this.outs<2){const r=B[2];const d=this.def();const base=(d.infieldIn?0.3:0.55)+(sp(r)-50)/300;const p=clamp(base+(c.dist-70)/120,0.05,0.95);return {kind:'tag',from:2,runner:r,auto:p,ok:clamp(p+0.15,0.1,0.97),label:`三塁走者 ${r.name} をタッチアップさせる？`};}
 return null;};
/* 守備側の送球判断（ユーザー守備・内野ゴロ・一塁走者あり）：どの塁へ投げるか */
Match.prototype.defDecision=function(c){const d=this.def();const pa=this.pa;if(c.res!=='GO'||pa.runnerGo)return null;const B=this.bases;const r1=B[0],r3=B[2];if(!r1||this.outs>=2)return null;
 const be=pa.be;const def=pa.bHand==='右'?d.defR:d.defL;const sp=r=>this.runnerSpeed(r);const far=c.dist>34;const corner=c.fpos==='一'||c.fpos==='三';
 const dpp=clamp((0.4-(sp(r1)-50)/150-(be.speed-50)/300+(def-50)/400-(be.dpRes||0)-(corner?0.08:0))*((pa.bm&&pa.bm.dpMul)||1),0.05,0.6);
 const p2=clamp(0.9-(sp(r1)-50)/220+(def-50)/500-(far?0.22:0)-(corner?0.06:0)-(c.ev>125?0.05:-0.04),0.3,0.97);
 const pdp=clamp(dpp*1.7+0.12-(far?0.1:0),0.08,0.8);
 const opts=[{t:1,label:'一塁へ',sub:'確実に1アウト',ok:0.97},{t:2,label:'二塁へ',sub:`封殺${Math.round(p2*100)}%・併殺${Math.round(p2*pdp*100)}%`,ok:p2,dp:pdp}];
 if(r3){const pH=clamp((d.infieldIn?0.62:0.28)-(sp(r3)-50)/200+(c.dist<24?0.14:far?-0.12:0)+(def-50)/400,0.05,0.92);opts.push({t:4,label:'本塁へ',sub:'失点を防ぐ',ok:pH});}
 const rec=r3&&opts[2].ok>=0.5?4:p2*(1+pdp)>=1.05?2:1;
 return {kind:'throw',options:opts,rec,label:`${POS_JA[c.fpos]||''}ゴロ！どこへ送球する？`};};
/* インプレーの結果を状態へ反映。choice: null=自動判断 / {send:true|false} / {throwTo:1|2|4} */
Match.prototype.applyInplay=function(ev,choice){const pa=this.pa;const t=this.bat(),d=this.def();const b=pa.b,p=pa.p;const bs=bst(t,b),ps=pst(d,p);const c=ev.bb;const be=pa.be;
 const pre=`${this.outs}死${this.basesStr()} `;const name=b.name;const go=pa.runnerGo;const sp=r=>this.runnerSpeed(r);
 const dec=this.runDecision(c);
 if(dec&&this.askRun&&t.isUser&&!this.autoUntil&&choice==null){ev.decision=dec;this.pending=ev;return ev;}
 if(!dec&&this.askDef&&d.isUser&&!this.autoUntil&&choice==null){const dd=this.defDecision(c);if(dd){ev.decision=dd;this.pending=ev;return ev;}}
 this.pending=null;ev.decision=null;
 const throwTo=choice&&choice.throwTo?choice.throwTo:null;
 if(dec&&choice==null&&pa.aggro)choice={send:true,bonus:(pa.bm&&pa.bm.runBonus)||0.05};
 const send=choice?!!choice.send:null;const forced=choice!=null;const sendBonus=choice&&choice.bonus?choice.bonus:0;
 const runText=[];
 /* 走塁記録（演出用） */const before=this.bases.slice();this.scoredNow=[];this.outNow={};let batterOut=null,caught=false;const outsBefore=this.outs;
 const tryAdv=(r,fromIdx,toIdx,autoP,okP)=>{if(!forced){if(R()<autoP){return 'ok';}return 'hold';}if(!send)return 'hold';return R()<Math.min(0.98,okP+sendBonus)?'ok':'out';};
 bs.pa++;
 if(c.res==='SAC'){
  if(pa.cmd==='squeeze'&&this.bases[2]){const r=this.bases[2];this.bases[2]=null;this.scoreRun(r,b,true);runText.push(`スクイズ成功！${r.name}生還`);}
  if(this.bases[1]&&!this.bases[2]){this.bases[2]=this.bases[1];this.bases[1]=null;}if(this.bases[0]&&!this.bases[1]){this.bases[1]=this.bases[0];this.bases[0]=null;}
  this.outsUp(1);batterOut=1;this.addLog(`${pre}${name} 送りバント成功${runText.length?'（'+runText.join('）（')+'）':''}`,'out');ev.text='送りバント成功';}
 else if(c.res==='FC'){bs.ab++;const lead=this.bases[1]&&!this.bases[2]?1:this.bases[2]&&pa.cmd==='squeeze'?2:0;const r=this.bases[lead];this.bases[lead]=null;this.outsUp(1);if(r)this.outNow[r.id]=lead+2;
  if(this.outs<3){if(!this.bases[0])this.bases[0]=b;else if(!this.bases[1])this.bases[1]=b;else this.bases[2]=b;}
  this.addLog(`${pre}${name} バント失敗、${r?r.name+'が':'走者が'}封殺される`,'out');ev.text='バント失敗（走者封殺）';}
 else{bs.ab++;
 switch(c.res){
  case 'HR':{bs.h++;bs.hr++;ps.h++;ps.hr++;const nOn=this.bases.filter(Boolean).length;this.advanceAll(3,b,true);this.scoreRun(b,b,true);this.addLog(`${pre}${name} ${dirLabel(c.a)}へ${nOn+1}ラン本塁打！！（推定${c.dist}m）`,'hr');ev.text=`${nOn+1}ラン本塁打！！`;break;}
  case '3B':{bs.h++;bs.tr++;ps.h++;this.advanceAll(3,b,true);this.bases[2]=b;this.addLog(`${pre}${name} ${dirLabel(c.a)}へ三塁打！`,'hit');ev.text='三塁打！';break;}
  case '2B':{bs.h++;bs.d++;ps.h++;
   if(this.bases[2]){this.scoreRun(this.bases[2],b,true);this.bases[2]=null;}if(this.bases[1]){this.scoreRun(this.bases[1],b,true);this.bases[1]=null;}
   if(this.bases[0]){const r=this.bases[0];this.bases[0]=null;const st=go?'ok':tryAdv(r,0,3,dec?dec.auto:0.42,dec?dec.ok:0.6);if(st==='ok'){this.scoreRun(r,b,true);runText.push(`${r.name}が本塁生還`);}else if(st==='out'){this.outsUp(1);this.outNow[r.id]=4;runText.push(`${r.name}は本塁で憤死…`);}else this.bases[2]=r;}
   this.bases[1]=b;this.addLog(`${pre}${name} ${c.a<-30?'レフト線を破る':c.a<-12?'左中間を破る':c.a<=12?'センターオーバーの':c.a<=30?'右中間を破る':'ライト線を破る'}二塁打！${runText.length?'（'+runText.join('・')+'）':''}`,'hit');ev.text='二塁打！';break;}
  case '1B':{bs.h++;ps.h++;
   if(this.bases[2]){this.scoreRun(this.bases[2],b,true);this.bases[2]=null;}
   if(this.bases[1]){const r=this.bases[1];this.bases[1]=null;const st=go?'ok':tryAdv(r,1,3,dec&&dec.from===1?dec.auto:0.62,dec&&dec.from===1?dec.ok:0.75);if(st==='ok'){this.scoreRun(r,b,true);runText.push(`${r.name}が本塁生還`);}else if(st==='out'){this.outsUp(1);this.outNow[r.id]=4;runText.push(`${r.name}は本塁で憤死…`);}else this.bases[2]=r;}
   if(this.bases[0]){const r=this.bases[0];this.bases[0]=null;let st;if(this.bases[2])st='hold';else if(go)st=R()<0.85?'ok':'hold';else st=dec&&dec.from===0?tryAdv(r,0,2,dec.auto,dec.ok):(R()<0.25+(sp(r)-50)/250?'ok':'hold');
    if(st==='ok'){this.bases[2]=r;runText.push(`${r.name}が三塁へ`);}else if(st==='out'){this.outsUp(1);this.outNow[r.id]=3;runText.push(`${r.name}は三塁で刺された…`);}else{if(!this.bases[1])this.bases[1]=r;else this.bases[2]=r;}}
   if(this.outs<3)this.bases[0]=b;
   this.addLog(`${pre}${name} ${c.bunt?'セーフティバント成功！内野安打':c.type==='ground'&&c.dist<40?'内野安打':dirLabel(c.a)+'前ヒット'}${runText.length?'（'+runText.join('・')+'）':''}`,'hit');ev.text=c.bunt?'セーフティバント成功！':c.type==='ground'&&c.dist<40?'内野安打！':'ヒット！';break;}
  case 'E':{this.errInn=true;if(go&&this.bases[0]&&!this.bases[1]){const r=this.bases[0];this.bases[0]=null;if(!this.bases[2])this.bases[2]=r;else this.bases[1]=r;}this.forceAdvance(b);this.addLog(`${pre}${name} ${POS_JA[c.fpos]||''}のエラーで出塁`,'err');ev.text='エラーで出塁';break;}
  case 'GO':{const r3=this.bases[2],r2=this.bases[1],r1=this.bases[0];const f=POS_JA[c.fpos]||'';
   if(throwTo&&r1&&this.outs<2&&!go){/* ユーザーが送球先を選んだ */const dd=this.defDecision(c);const o=dd&&dd.options.find(x=>x.t===throwTo);const ok=o?o.ok:0.9;ev.throwTo=throwTo;const loaded=!!(r2&&r3);
    const advRest=()=>{if(r3&&this.bases[2]===r3){if(loaded||R()<(d.infieldIn?0.4:0.7)){this.scoreRun(r3,b,true);this.bases[2]=null;}}if(r2&&this.bases[1]===r2&&!this.bases[2]){this.bases[2]=r2;this.bases[1]=null;}if(this.bases[0]===r1&&!this.bases[1]){this.bases[1]=r1;this.bases[0]=null;}};
    if(throwTo===1){this.outsUp(1);batterOut=1;this.addLog(`${pre}${name} ${f}ゴロ`,'out');ev.text=`${f}ゴロ`;if(this.outs<3)advRest();break;}
    if(throwTo===2){if(R()<ok){this.bases[0]=null;this.outsUp(1);this.outNow[r1.id]=2;const dp=R()<((o&&o.dp)||0.3);
      if(dp){this.outsUp(1);batterOut=1;this.addLog(`${pre}${name} 併殺打（${f}ゴロ）`,'out');ev.text='ゲッツー！';}
      else{if(this.outs<3)this.bases[0]=b;this.addLog(`${pre}${name} ${f}ゴロ、一塁走者封殺`,'out');ev.text='二塁で封殺';}
      if(this.outs<3){if(r3){if(loaded||R()<(dp?0.3:0.5)){this.scoreRun(r3,b,!dp);this.bases[2]=null;}}if(r2&&!this.bases[2]){this.bases[2]=r2;this.bases[1]=null;}}}
     else{if(r3){this.scoreRun(r3,b,true);this.bases[2]=null;}if(r2){this.bases[2]=r2;this.bases[1]=null;}this.bases[1]=r1;this.bases[0]=b;this.addLog(`${pre}${name} ${f}ゴロ、二塁送球が間に合わずオールセーフ（野選）`,'hit');ev.text='間に合わない！オールセーフ';}
     break;}
    if(throwTo===4){if(r3&&R()<ok){this.bases[2]=null;this.outsUp(1);this.outNow[r3.id]=4;if(r2){this.bases[2]=r2;this.bases[1]=null;}this.bases[1]=r1;this.bases[0]=b;this.addLog(`${pre}${name} ${f}ゴロ、${r3.name}を本塁で刺す！`,'out');ev.text='本塁タッチアウト！';}
     else{if(r3){this.scoreRun(r3,b,true);this.bases[2]=null;}if(r2){this.bases[2]=r2;this.bases[1]=null;}this.bases[1]=r1;this.bases[0]=b;this.addLog(`${pre}${name} ${f}ゴロ、本塁送球も間に合わず${r3?r3.name+'が生還':''}（野選）`,'hit');ev.text='本塁セーフ！';}
     break;}}
   if(r1&&this.outs<2&&!go){const def=pa.bHand==='右'?d.defR:d.defL;const dpp=clamp((0.4-(sp(r1)-50)/150-(be.speed-50)/300+(def-50)/400-(be.dpRes||0)-(c.fpos==='一'||c.fpos==='三'?0.08:0))*((pa.bm&&pa.bm.dpMul)||1),0.05,0.6);
    if(R()<dpp){this.bases[0]=null;this.outsUp(2);this.outNow[r1.id]=2;batterOut=1;this.addLog(`${pre}${name} 併殺打（${f}ゴロ）`,'out');ev.text='併殺打…';if(this.outs<3){if(r3&&R()<0.3){this.scoreRun(r3,b,false);this.bases[2]=null;}}break;}
    if(R()<0.5){this.bases[0]=b;this.outsUp(1);this.outNow[r1.id]=2;this.addLog(`${pre}${name} ${f}ゴロ、一塁走者封殺`,'out');ev.text='フィールダースチョイス';}
    else{this.outsUp(1);batterOut=1;this.addLog(`${pre}${name} ${f}ゴロ`,'out');ev.text=`${f}ゴロ`;}
    if(this.outs<3){if(r3&&!d.infieldIn&&R()<0.4){this.scoreRun(r3,b,true);this.bases[2]=null;}if(this.bases[1]&&!this.bases[2]&&R()<0.35){this.bases[2]=this.bases[1];this.bases[1]=null;}}
    break;}
   this.outsUp(1);batterOut=1;this.addLog(`${pre}${name} ${f}ゴロ`,'out');ev.text=`${f}ゴロ`;
   if(this.outs<3){if(r3&&!d.infieldIn&&R()<0.45){this.scoreRun(r3,b,true);this.bases[2]=null;}if(r2&&!this.bases[2]&&(go||R()<0.4)){this.bases[2]=r2;this.bases[1]=null;}if(r1&&!this.bases[1]&&(go||R()<0.08)){this.bases[1]=r1;this.bases[0]=null;}}
   break;}
  case 'FO':{this.outsUp(1);caught=true;const f=POS_JA[c.fpos]||'';this.addLog(`${pre}${name} ${f}フライ（${c.dist}m）`,'out');ev.text=`${f}フライ`;
   if(this.outs<3){const r3=this.bases[2];
    if(r3){const st=tryAdv(r3,2,3,dec?dec.auto:0.5,dec?dec.ok:0.7);if(st==='ok'){this.scoreRun(r3,b,true);this.bases[2]=null;bs.ab--;this.addLog(`犠牲フライで${r3.name}生還`,'run');ev.text='犠牲フライ！';}else if(st==='out'){this.bases[2]=null;this.outsUp(1);this.outNow[r3.id]=4;this.addLog(`${r3.name}タッチアップも本塁で憤死`,'out');ev.text='タッチアップ失敗…';}}
    if(this.outs<3&&this.bases[1]&&!this.bases[2]&&c.dist>85&&R()<0.3){this.bases[2]=this.bases[1];this.bases[1]=null;}
    if(go&&this.outs<3){const i=this.bases[1]&&!this.bases[2]?1:0;const r=this.bases[i];if(r&&R()<0.1){this.bases[i]=null;this.outsUp(1);this.outNow[r.id]=i+1;this.addLog(`${r.name}が飛び出して併殺`,'out');}}}
   break;}
  case 'LO':{this.outsUp(1);caught=true;const f=POS_JA[c.fpos]||'';this.addLog(`${pre}${name} ${f}ライナー`,'out');ev.text=`${f}ライナー`;
   if(go&&this.outs<3){const i=this.bases[1]&&!this.bases[2]?1:0;const r=this.bases[i];if(r&&R()<0.4){this.bases[i]=null;this.outsUp(1);this.outNow[r.id]=i+1;this.addLog(`${r.name}が飛び出して併殺`,'out');ev.text='ライナーで併殺…';}}
   break;}
  case 'PO':{this.outsUp(1);caught=true;const f=POS_JA[c.fpos]||'';this.addLog(`${pre}${name} ${c.bunt?'バント小フライ':f+'フライ（小飛球）'}`,'out');ev.text=c.bunt?'バント小フライ…':'小フライ';
   if(pa.cmd==='squeeze'&&this.bases[2]&&this.outs<3&&R()<0.7){const r=this.bases[2];this.bases[2]=null;this.outsUp(1);this.outNow[r.id]=3;this.addLog(`スクイズ失敗、${r.name}が戻れず併殺`,'out');ev.text='スクイズ失敗…';}
   break;}
 }}
 /* 記録をまとめる */
 const after=this.bases;const runners=[];
 before.forEach((r,i)=>{if(!r)return;let to=null,outAt=null;const j=after.indexOf(r);if(j>=0)to=j+1;else if(this.scoredNow.includes(r.id))to=4;else{outAt=this.outNow[r.id]||(i+1);to=outAt;}runners.push({pid:r.id,name:r.name,from:i+1,to,outAt,speed:sp(r)});});
 let bto=null,bout=null;{const j=after.indexOf(b);if(j>=0)bto=j+1;else if(this.scoredNow.includes(b.id))bto=4;else{bout=caught?0:(batterOut||1);bto=bout||1;}}
 ev.play={res:c.res,type:c.type,dist:c.dist,a:c.a,fpos:c.fpos,err:c.res==='E',caught,batter:{pid:b.id,name:b.name,to:bto,outAt:bout,speed:be.speed},runners,scored:this.scoredNow.slice(),outs:this.outs-outsBefore,bunt:!!c.bunt,hand:pa.bHand,throwTo:ev.throwTo||null};
 this.scoredNow=null;this.outNow=null;
 ev.applied=true;return ev;};
Match.prototype.finishInplay=function(choice){const ev=this.pending;if(!ev)return null;this.applyInplay(ev,choice||{send:false});this.paEnd(ev,ev.bb.res);return ev;};
/* バント処理 */
Match.prototype.buntPitch=function(P,sw,ev){const pa=this.pa;const d=this.def();const be=pa.be;
 const rx=0.6,ry=0.42;const dd=Math.hypot((sw.cx-P.x)/rx,(sw.cy-P.y)/ry);const adt=Math.abs(sw.dt);
 if(dd>1||adt>260){pa.strikes++;ev.kind=pa.strikes>=3?'kSwing':'miss';ev.bunt=true;return;}
 const q=(1-dd*0.5)*(adt<120?1:0.6);
 const bm=pa.bm||{};const pr=clamp(0.62+(be.bunt-50)/150-(d.defR-50)/500-(d.buntAlert?0.15:0),0.2,0.95)*(0.6+q*0.5);const x=R();
 const squeeze=pa.cmd==='squeeze'&&this.bases[2];
 const canSac=(this.bases[0]||this.bases[1]||this.bases[2])&&this.outs<2&&!bm.safety;
 if(x<pr){const safe=R()<(be.bunt>=72?0.15:0.05)+(be.safeBunt||0)+(be.speed>=75?0.08:0)+(bm.safety?0.3+(be.speed-50)/200-(d.buntAlert?0.2:0):0)||!canSac;ev.kind='inplay';ev.bb={type:'bunt',a:Math.round(gauss(0,20)),dist:ri(8,20),res:safe?'1B':'SAC',q,bunt:true,la:-5,ev:60};}
 else if(x<pr+0.25){if(R()<0.5){if(pa.strikes<2){pa.strikes++;ev.kind='foul';ev.bunt=true;}else{pa.strikes++;ev.kind='kBunt';}}else{ev.kind='inplay';ev.bb={type:'pop',a:Math.round(gauss(0,20)),dist:ri(5,15),res:'PO',bunt:true,la:70,ev:50};}}
 else{if(canSac||squeeze){ev.kind='inplay';ev.bb={type:'bunt',a:Math.round(gauss(0,15)),dist:ri(10,25),res:'FC',bunt:true,la:-5,ev:60};}else{ev.kind='inplay';ev.bb={type:'bunt',a:Math.round(gauss(0,15)),dist:ri(10,25),res:'GO',bunt:true,la:-5,ev:60};}}
 if(ev.bb)ev.bb.fpos=fielderOf(ev.bb);};
/* 暴投 */
Match.prototype.wildPitch=function(ev){const r3=this.bases[2],r2=this.bases[1],r1=this.bases[0];const txt=[];const moves=[];
 if(r3){this.scoreRun(r3,null,false);this.bases[2]=null;txt.push(`${r3.name}が生還`);moves.push({pid:r3.id,name:r3.name,from:3,to:4,speed:this.runnerSpeed(r3)});}
 if(r2&&!this.bases[2]){this.bases[2]=r2;this.bases[1]=null;moves.push({pid:r2.id,name:r2.name,from:2,to:3,speed:this.runnerSpeed(r2)});}
 if(r1&&!this.bases[1]){this.bases[1]=r1;this.bases[0]=null;moves.push({pid:r1.id,name:r1.name,from:1,to:2,speed:this.runnerSpeed(r1)});}
 this.addLog(`暴投で走者が進塁${txt.length?'（'+txt.join('・')+'）':''}`,'run');ev.runner='wp';ev.runText='暴投！走者進塁';ev.runPlay={kind:'wp',moves};};
/* 牽制（守備側ユーザー） */
Match.prototype.pickoff=function(){const pa=this.pa;const i=this.bases[0]&&!this.bases[1]?0:(this.bases[1]&&!this.bases[2]?1:-1);if(i<0)return {kind:'none',text:'牽制できる走者がいません'};const r=this.bases[i];const d=this.def();
 const going=pa.cmd==='steal';const pt=pa.p.pit.pitches[0]||{name:'ストレート',velo:pa.p.pit.velo,move:40,sharp:40,ctrl:40};const pr=(going?0.22:0.06)+(this.pitchingEff(pa.p,pa.b,pt).stealDef||0)/200;const x=R();
 if(x<pr){this.bases[i]=null;this.outsUp(1);this.addLog(`${r.name} 牽制死！`,'out');pa.cmd=null;const ev={kind:'pickoff',text:`${r.name} 牽制死！`,runPlay:{kind:'pickoff',pid:r.id,name:r.name,from:i+1,to:i+1,ok:false,speed:this.runnerSpeed(r)}};if(this.outs>=3){pa.done=true;ev.paDone=true;ev.halfEnd=true;this.endHalf();}return ev;}
 if(x<pr+0.03){this.bases[i]=null;const to=i===1?3:(!this.bases[1]?2:3);if(i===1)this.bases[2]=r;else if(!this.bases[1])this.bases[1]=r;else this.bases[2]=r;this.addLog(`牽制悪送球で${r.name}が進塁`,'run');return {kind:'pickoffErr',text:'牽制悪送球…走者進塁',runPlay:{kind:'pickoff',pid:r.id,name:r.name,from:i+1,to,ok:true,err:true,speed:this.runnerSpeed(r)}};}
 if(going&&R()<0.5)pa.cmd=null;
 return {kind:'pickoffSafe',text:`${r.name} 帰塁、セーフ`,runPlay:{kind:'pickoff',pid:r.id,name:r.name,from:i+1,to:i+1,ok:true,speed:this.runnerSpeed(r)}};};
/* 1球の結果を解決 */
Match.prototype.resolvePitch=function(P,sw){const pa=this.pa;const t=this.bat(),d=this.def();const b=pa.b,p=pa.p;const bs=bst(t,b),ps=pst(d,p);const be=pa.be,pe=pa.pe;
 const ev={P,sw,kind:'',text:'',paDone:false,count:null,runner:null};
 pa.pitches.push(P);pa.n++;
 const go=pa.runnerGo;const inS=pa.bHand==='左'?1:-1;
 if(!sw&&!P.pitchout&&P.x*inS>1.55&&P.y>-1.3&&P.y<1.4&&R()<0.4*((pa.pm&&pa.pm.hbpMul)||1)){ev.kind='hbp';}
 else if(!sw){
  if(P.strike){pa.strikes++;ev.kind=pa.strikes>=3?'kLook':'strike';}
  else{pa.balls++;ev.kind=pa.balls>=4?'bb':'ball';if(!P.pitchout&&this.bases.some(Boolean)&&(Math.abs(P.x)>1.9||P.y>1.9||P.y<-1.8)&&R()<0.35)this.wildPitch(ev);}}
 else if(sw.type==='bunt'){this.buntPitch(P,sw,ev);}
 else{const c=this.contact(be,pe,P,sw,pa.bHand);ev.c=c;
  if(c.kind==='miss'){pa.strikes++;ev.kind=pa.strikes>=3?'kSwing':'miss';}
  else if(c.kind==='foul'){if(pa.strikes<2)pa.strikes++;ev.kind='foul';}
  else{this.battedBall(c,be,pe);ev.kind='inplay';ev.bb=c;}}
 /* 走者が動いている場合（盗塁・エンドラン・スクイズ） */
 if(go&&ev.kind!=='inplay'&&ev.kind!=='foul'&&ev.kind!=='hbp'&&ev.kind!=='bb'){
  if(pa.cmd==='squeeze'&&this.bases[2]){const r=this.bases[2];if(R()<0.7){this.bases[2]=null;this.outsUp(1);this.addLog(`スクイズ失敗、${r.name}が本塁で憤死`,'out');ev.runner='cs';ev.runText='スクイズ失敗…三塁走者アウト';ev.runPlay={kind:'steal',pid:r.id,name:r.name,from:3,to:4,ok:false,speed:this.runnerSpeed(r)};}else{ev.runText='三塁走者はなんとか帰塁';ev.runPlay={kind:'back',pid:r.id,name:r.name,from:3,to:3,ok:true,speed:this.runnerSpeed(r)};}}
  else{const i0=this.bases[1]&&!this.bases[2]?1:(this.bases[0]&&!this.bases[1]?0:-1);const rr=i0>=0?this.bases[i0]:null;const ok=this.trySteal(pe,(P.pitchout?45:0)+(d.stealAlert?15:0)-((pa.bm&&pa.bm.stealBonus)||0));ev.runner=ok?'sb':'cs';ev.runText=ok?'盗塁成功！':'盗塁失敗…';if(rr)ev.runPlay={kind:'steal',pid:rr.id,name:rr.name,from:i0+1,to:i0+2,ok,speed:this.runnerSpeed(rr)};}}
 if(go&&ev.kind==='bb'){ /* 四球で走者はそのまま押し出し進塁 */ }
 if(pa.cmd==='steal'||pa.cmd==='hitrun'||pa.cmd==='squeeze')pa.cmd=null;pa.runnerGo=false;
 const pre=`${this.outs}死${this.basesStr()} `;const name=b.name;
 if(ev.kind==='inplay'){this.applyInplay(ev,null);if(!ev.decision)this.paEnd(ev,ev.bb.res);}
 else if(ev.kind==='kLook'||ev.kind==='kSwing'||ev.kind==='kBunt'){bs.pa++;bs.ab++;bs.so++;ps.so++;this.outsUp(1);this.addLog(`${pre}${name} ${ev.kind==='kLook'?'見逃し':ev.kind==='kBunt'?'バント失敗で':'空振り'}三振（${P.name}）`,'k');ev.text=ev.kind==='kLook'?'見逃し三振！':ev.kind==='kBunt'?'スリーバント失敗':'空振り三振！';this.paEnd(ev,'K');}
 else if(ev.kind==='bb'){bs.pa++;bs.bb++;ps.bb++;this.forceAdvance(b);this.addLog(`${pre}${name} 四球`,'bb');ev.text='四球';this.paEnd(ev,'BB');}
 else if(ev.kind==='hbp'){bs.pa++;ps.bb++;this.forceAdvance(b);this.addLog(`${pre}${name} 死球`,'bb');ev.text='死球';this.paEnd(ev,'HBP');}
 else{ev.text=ev.kind==='strike'?'ストライク':ev.kind==='ball'?'ボール':ev.kind==='miss'?'空振り！':ev.kind==='foul'?'ファウル':'';
  if(this.outs>=3&&!pa.done){pa.done=true;ev.paDone=true;ev.halfEnd=true;this.endHalf();}}
 if(this.done)ev.halfEnd=true;
 ev.count=[pa.balls,pa.strikes];
 return ev;};
/* CPU同士で打席を最後まで（おまかせ用） */
Match.prototype.cpuFinishPA=function(){let g=0;while(this.pa&&!this.pa.done&&g++<40){if(this.pa.cmd==='ibb'){this.paIbb();break;}const P=this.throwPitch(null);const sw=this.cpuSwingInput(P);const ev=this.resolvePitch(P,sw);if(ev.decision)this.finishInplay(null);}};
/* 1打席を一球単位で（CPU同士）：テスト・おまかせ用 */
Match.prototype.stepPitchPA=function(){if(this.done)return;this.paStart();this.cpuFinishPA();};
/* ====== 采配カードの適用（栄冠ナイン風） ====== */
Match.prototype.applyCard=function(card,side){const pa=this.pa;if(!pa||!card)return null;const def=CARD_BY_ID[card.id];if(!def)return null;
 const p=side==='off'?pa.b:pa.p;const eff=cardEffect(card,p,this);const ignored=R()<eff.ignore;
 const info={card,side,e:eff.mul,notes:eff.notes,ignored,player:p};
 if(ignored)return info;
 const M=cardMods(card,eff.mul,this);
 if(side==='off'){Object.assign(pa.bm,M);if(M.cmd)pa.cmd=M.cmd;if(M.bunt)pa.buntMode=true;if(M.aggro)pa.aggro=true;
  if(M.demon){const d=this.def();d.demon={lv:card.lv,inn:this.inn,top:this.top};this.addLog(`${this.bat().name}のベンチに魔物が…！（Lv${card.lv}）`,'note');}}
 else{Object.assign(pa.pm,M);if(M.relay){const d=this.def();if(this.timeout(d)){d.relayDef=(d.relayDef||0)+(M.def||0);d.relayInn=this.inn;d.relayTop=this.top;}}}
 return info;};
/* 1打席をカード付きで最後まで。seq に各投球を記録して返す */
Match.prototype.cardPA=function(offCard,defCard){if(this.done)return null;this.paStart();const pa=this.pa;
 const offInfo=offCard?this.applyCard(offCard,'off'):null;const defInfo=defCard?this.applyCard(defCard,'def'):null;
 const d=this.def();if(d.relayDef&&d.relayInn===this.inn&&d.relayTop===this.top)pa.pm.def=(pa.pm.def||0)+d.relayDef;
 const seq=[];let ev=null;
 if(pa.cmd==='ibb'){ev=this.paIbb();return {ev,seq,offInfo,defInfo,pa};}
 let g=0;while(!pa.done&&g++<40){const P=this.throwPitch(null);const sw=this.cpuSwingInput(P);ev=this.resolvePitch(P,sw);seq.push({P,sw,ev});if(ev.decision)ev=this.finishInplay(null);}
 /* 信頼度の更新 */
 const res=ev?ev.res:null;const good=r=>['1B','2B','3B','HR','BB','HBP','E','SAC','IBB'].includes(r);
 if(offInfo&&!offInfo.ignored){const p=offInfo.player;const cat=CARD_BY_ID[offInfo.card.id].cat;let dT=0;
  if(cat==='run'){const sb=seq.some(x=>x.ev.runner==='sb');const cs=seq.some(x=>x.ev.runner==='cs');if(sb)dT+=2;if(cs)dT-=1;if(res==='SAC'||res==='1B')dT+=1.5;if(res==='FC'||res==='PO')dT-=0.6;}
  else if(cat==='bat'){if(good(res))dT+=1+0.3*offInfo.card.lv;else if(res==='K'||(ev&&ev.text&&ev.text.includes('併殺')))dT-=0.6;}
  else if(offInfo.card.id==='demon')dT+=0;
  if(dT){p.trust=clamp((p.trust||40)+dT,0,100);offInfo.dTrust=dT;}}
 if(defInfo&&!defInfo.ignored){const p=defInfo.player;let dT=0;if(['K','GO','FO','LO','PO','DP','FC','SAC'].includes(res))dT+=0.7;else if(['1B','2B','3B','HR','BB'].includes(res))dT-=0.4;if(dT){p.trust=clamp((p.trust||40)+dT,0,100);defInfo.dTrust=dT;}}
 return {ev,seq,offInfo,defInfo,pa};};
