/* ================= フィールドプレイ演出（3/4俯瞰・カメラ追従） =================
 ワールド座標：X=一塁側が+（m）、Y=センター方向が+（m）、Z=高さ（m）。本塁が原点。
 シーンは時刻(ms)をキーにした各エンティティの経路で表し、毎フレーム補間して描く。 */
const FW_BASE=[[0,0],[19.4,19.4],[0,38.8],[-19.4,19.4],[0,0]];
const FW_SPEED=0.74; /* 実時間に対する演出の速さ（小さいほど速く進む） */
function fwPolar(d,a){const r=a*Math.PI/180;return [d*Math.sin(r),d*Math.cos(r)];}
function fwDist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function fwLerp(a,b,u){return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];}
function fwDefPos(d){const P={投:[0,18.4],捕:[0,-2.2],一:[19,21.9],二:[10.9,40.6],三:[-19,21.9],遊:[-10.9,40.6],左:[-38.6,75.7],中:[0,95],右:[38.6,75.7]};
 if(d&&d.infieldIn){P.一=[15.5,17.5];P.二=[8.5,31];P.三=[-15.5,17.5];P.遊=[-8.5,31];}
 if(d&&d.ofDeep){P.左=[-43,85];P.中=[0,106];P.右=[43,85];}if(d&&d.ofIn){P.左=[-33,64];P.中=[0,80];P.右=[33,64];}
 return P;}
/* 経路：[{t,x,y,z?}] を時刻で補間 */
function fwAt(path,t){if(!path||!path.length)return null;if(t<=path[0].t)return path[0];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i];if(t<=b.t){const u=b.t===a.t?1:(t-a.t)/(b.t-a.t);const z=(a.z||0)+((b.z||0)-(a.z||0))*u+(b.arc?b.arc*4*u*(1-u):0);return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z,moving:true,seg:i};}}const l=path[path.length-1];return {x:l.x,y:l.y,z:l.z||0,moving:false,seg:path.length};}
function fwPathLen(path){let s=0;for(let i=1;i<path.length;i++)s+=fwDist([path[i-1].x,path[i-1].y],[path[i].x,path[i].y]);return s;}
/* 塁から塁への経路点（中間の塁を経由） */
function fwBasePath(from,to){const pts=[];for(let b=from;b<=to;b++)pts.push(FW_BASE[b]);return pts;}
/* 走者の経路を作る：t0から出発、速度v(m/s)。arrive指定なら到着時刻に合わせる */
function fwRunnerPath(from,to,t0,v,arriveAt,lead){const pts=fwBasePath(from,to);const start=lead?fwLerp(pts[0],pts[1]||pts[0],Math.min(0.12,lead/27.4)):pts[0];pts[0]=start;let len=0;for(let i=1;i<pts.length;i++)len+=fwDist(pts[i-1],pts[i]);
 let dur=len/v*1000*FW_SPEED;if(arriveAt!=null){dur=Math.max(250,arriveAt-t0);}
 const path=[{t:t0,x:pts[0][0],y:pts[0][1]}];let acc=0;for(let i=1;i<pts.length;i++){acc+=fwDist(pts[i-1],pts[i]);path.push({t:t0+dur*(len?acc/len:1),x:pts[i][0],y:pts[i][1]});}return path;}
/* ====== インプレーのシーン構築 ====== */
function fwBuildScene(c,play,opt){opt=opt||{};const m=AR.m;const d=m.def();const DP=fwDefPos(d);const S=FW_SPEED;
 const sc={t0:performance.now(),T:0,ball:[],fielders:{},runners:[],callouts:[],fx:[],pauseAt:null,kind:'inplay',res:c.res,primary:c.fpos,pois:[],ended:false};
 for(const k in DP)sc.fielders[k]={path:[{t:0,x:DP[k][0],y:DP[k][1]}],pose:[],face:k==='捕'?1:-1};
 const an=c.anim=c.anim||{roll:rf(0.5,1),bob:rf(0,1),ang:gauss(0,1)};
 const a=c.a||0;const dist=Math.max(4,c.dist||10);const type=c.type;const air=type==='fly'||type==='line'||type==='pop';const caught=c.res==='FO'||c.res==='LO'||c.res==='PO';
 const launch=[0,0.6,1.0];
 let Tland,Tcatch,pick=null,Tpick=null,land;
 const isHR=c.res==='HR';
 if(air){const land0=fwPolar(dist,a);land=land0;const fd=FENCE(a);
  /* 物理軌道（重力＋空気抵抗＋バックスピン）。到達距離はエンジンの判定（dist）に合わせて初速を補正する */
  let la=c.la==null?(type==='fly'?32:type==='line'?14:62):c.la;if(isHR)la=Math.max(la,24);let path=null;
  try{path=phHitPath(c.ev||(type==='pop'?90:110),la,a,isHR?Math.max(dist,fd+6):dist,{x0:0,y0:0.4,z0:1.0});}catch(e){path=null;}
  if(path&&path.pts&&path.pts.length>3){const pts=path.pts;const step=Math.max(1,Math.floor(pts.length/48));
   for(let i=0;i<pts.length;i+=step){const q=pts[i];sc.ball.push({t:q.t*1000*S,x:q.x,y:q.y,z:Math.max(0,q.z)});}
   const ql=pts[pts.length-1];if(sc.ball[sc.ball.length-1].t<ql.t*1000*S)sc.ball.push({t:ql.t*1000*S,x:ql.x,y:ql.y,z:0});
   const Th=ql.t*1000*S;Tland=Th;land=[ql.x,ql.y];
   if(caught){/* 落下中に捕球高さへ来た時刻で止める */let Tc=Th*0.93;if(type!=='line'){for(let i=sc.ball.length-1;i>0;i--){if(sc.ball[i].z>=1.7){Tc=sc.ball[i].t+(sc.ball[Math.min(i+1,sc.ball.length-1)].t-sc.ball[i].t)*0.5;break;}}}
    Tcatch=Math.max(200,Math.min(Th*0.97,Tc));const p=fwAt(sc.ball,Tcatch);pick=[p.x,p.y];Tpick=Tcatch;sc.ball.splice(sc.ball.findIndex(x=>x.t>=Tcatch));sc.ball.push({t:Tcatch,x:p.x,y:p.y,z:Math.max(1.2,Math.min(2.4,p.z))});}
   else if(isHR){/* フェンスを越えた先、スタンドに落ちる */let cut=-1;for(let i=1;i<sc.ball.length;i++){const q=sc.ball[i];if(Math.hypot(q.x,q.y)>=fd&&q.z<=1.5&&q.t>Th*0.5){cut=i;break;}}
    if(cut>0){sc.ball.splice(cut+1);sc.ball[cut].z=1.5;}const e=sc.ball[sc.ball.length-1];land=[e.x,e.y];Tland=e.t;sc.hrCross=null;for(let i=1;i<sc.ball.length;i++){const q=sc.ball[i];if(Math.hypot(q.x,q.y)>=fd){sc.hrCross=q.t;break;}}}
   else{/* 落ちてから転がる */const roll=fwPolar(dist+4+an.roll*8,a);sc.ball.push({t:Th+(380+an.roll*300)*S,x:roll[0],y:roll[1],z:0,arc:1.2});land=roll;Tland=sc.ball[sc.ball.length-1].t;}}
  else{const Th=(type==='fly'?1.5+dist/75:type==='line'?0.65+dist/110:2.0+dist/90)*1000*S;const hmax=type==='fly'?10+dist/5:type==='line'?2.5+dist/30:16+dist/5;
   sc.ball.push({t:0,x:0,y:0,z:1});sc.ball.push({t:Th,x:land[0],y:land[1],z:isHR?2.5:0,arc:hmax});Tland=Th;
   if(caught){Tcatch=Th*0.93;const p=fwAt(sc.ball,Tcatch);pick=[p.x,p.y];Tpick=Tcatch;sc.ball.splice(1,1,{t:Tcatch,x:p.x,y:p.y,z:1.5,arc:hmax*0.93});}
   else if(isHR){const extra=fwPolar(Math.max(dist,fd+6),a);sc.ball[1]={t:Th,x:extra[0],y:extra[1],z:3,arc:hmax};land=extra;Tland=Th;}
   else{const roll=fwPolar(dist+4+an.roll*8,a);sc.ball.push({t:Th+(380+an.roll*300)*S,x:roll[0],y:roll[1],z:0,arc:1.2});land=roll;Tland=sc.ball[sc.ball.length-1].t;}}}
 else{/* ゴロ・バント：減速しながら転がる */const v0=c.bunt?clamp(dist*0.8,5,12):clamp((c.ev||100)*0.3,14,38);const dec=v0*v0/(2*dist);const end=fwPolar(dist,a);const Tstop=(v0/dec)*1000*S;
  sc.ball.push({t:0,x:0,y:0,z:0.3});const n=5;for(let i=1;i<=n;i++){const tt=(v0/dec)*i/n;const s=v0*tt-0.5*dec*tt*tt;const p=fwPolar(s,a);sc.ball.push({t:tt*1000*S,x:p[0],y:p[1],z:i<3?0.25:0.05});}
  land=end;Tland=Tstop;}
 /* 捕球する野手を決める */
 let fielder=c.fpos;const ofByAng=a<-15?'左':a<=15?'中':'右';const isHit=['1B','2B','3B'].includes(c.res);
 const infield=['投','捕','一','二','三','遊'].includes(fielder);
 const fp=sc.fielders;
 const runTo=(k,pt,arrive,t0)=>{const f=fp[k];const st=f.path[f.path.length-1];const dd=fwDist([st.x,st.y],pt);const v=7.6;let dur=dd/v*1000*S;if(arrive!=null){dur=Math.max(120,arrive-(t0||st.t));}f.path.push({t:(t0||st.t)+dur,x:pt[0],y:pt[1]});return (t0||st.t)+dur;};
 if(caught){/* 捕球点へ走り込む */runTo(fielder,pick,Tcatch);fp[fielder].pose.push({t:Tcatch-150*S,p:type==='pop'||type==='fly'?'catchHigh':'catchLow'});fp[fielder].pose.push({t:Tcatch+400*S,p:'throw'});sc.callouts.push({t:Tcatch,x:pick[0],y:pick[1],z:2,text:'キャッチ！',kind:'catch'});Tpick=Tcatch;}
 else if(isHR){const fd=FENCE(a);const fence=fwPolar(fd-2,a);runTo(fielder,fence,Tland*0.9);fp[fielder].pose.push({t:Tland*0.5,p:'lookUp'});const cross=sc.hrCross!=null?sc.hrCross:Tland*(fd/Math.max(dist,fd+6));sc.callouts.push({t:cross+100,x:land[0],y:land[1],z:4,text:'ホームラン！！',kind:'hr',dur:1800});sc.fx.push({t:cross,x:land[0],y:land[1],kind:'fireworks'});Tpick=Tland+600;}
 else if(!air){/* ゴロ：捕球地点＝野手が追いつける最初の点 */const f0=DP[fielder];let best=null;for(let i=1;i<sc.ball.length;i++){const bp=sc.ball[i];const need=fwDist(f0,[bp.x,bp.y])/7.6*1000*S;if(need<=bp.t+60){best=bp;break;}}
  if(c.res==='E'){const bp=best||sc.ball[Math.min(2,sc.ball.length-1)];runTo(fielder,[bp.x,bp.y],bp.t);fp[fielder].pose.push({t:bp.t-100,p:'catchLow'});/* はじく */const off=fwPolar(4+an.bob*4,a+(an.ang>0?35:-35));sc.ball.splice(sc.ball.findIndex(x=>x.t>=bp.t)+1);sc.ball.push({t:bp.t+500*S,x:bp.x+off[0],y:bp.y+off[1],z:0,arc:1});sc.callouts.push({t:bp.t+80,x:bp.x,y:bp.y,z:2,text:'エラー！',kind:'err'});pick=[bp.x+off[0],bp.y+off[1]];Tpick=runTo(fielder,pick,null,bp.t+350*S)+150;fp[fielder].pose.push({t:Tpick,p:'throw'});land=pick;}
  else if(isHit&&infield){/* 内野を抜ける：内野手は届かず、外野手が拾う */const near=fwPolar(Math.min(dist*0.55,30),a);runTo(fielder,[near[0]+(an.ang>0?2:-2),near[1]],null);fp[fielder].pose.push({t:fwAt(sc.ball,0).t+300,p:'dive'});const of=ofByAng;const stop=sc.ball[sc.ball.length-1];const dd=fwDist(DP[of],[stop.x,stop.y]);let Tm=Math.max(stop.t*0.8,dd/8.5*1000*S);pick=[stop.x,stop.y];Tpick=runTo(of,pick,Tm);fp[of].pose.push({t:Tpick-120,p:'catchLow'});fp[of].pose.push({t:Tpick+300*S,p:'throw'});fielder=of;Tpick+=200*S;}
  else{const bp=best||sc.ball[sc.ball.length-1];pick=[bp.x,bp.y];runTo(fielder,pick,bp.t);fp[fielder].pose.push({t:bp.t-120,p:'catchLow'});Tpick=bp.t+(c.bunt?350:260)*S;fp[fielder].pose.push({t:Tpick-80,p:'throw'});sc.ball.splice(sc.ball.findIndex(x=>x.t>=bp.t)+1);}}
 else{/* 外野／内野に落ちるヒット（またはエラー） */const stop=sc.ball[sc.ball.length-1];pick=[stop.x,stop.y];const who=c.res==='E'?fielder:(dist<45?fielder:(['左','中','右'].includes(fielder)?fielder:ofByAng));fielder=who;
  const dd=fwDist(DP[who],pick);const Tm=Math.max(Tland*0.9,dd/8.5*1000*S);Tpick=runTo(who,pick,Tm)+220*S;fp[who].pose.push({t:Tpick-200*S,p:'catchLow'});fp[who].pose.push({t:Tpick,p:'throw'});
  if(c.res==='E'){sc.callouts.push({t:Tpick-100,x:pick[0],y:pick[1],z:2,text:'エラー！',kind:'err'});Tpick+=500*S;}
  /* 落下点に野手が届かず：ポーズ */if(dist>=45&&!isHR)fp[who].pose.push({t:Tland*0.5,p:'run'});}
 sc.primary=fielder;sc.Tpick=Tpick;sc.pick=pick||land;
 /* ====== 走者と送球 ====== */
 const t=m.bat();const cb=arTeamColors(t);const cd=arTeamColors(d);sc.colBat=cb;sc.colDef=cd;sc.defTeam=d;sc.batTeam=t;
 const pend=!play;const vOf=sp=>6.6+(sp-50)/22;
 const runners=play?play.runners:[];const batterRec=play?play.batter:null;
 const dec=opt.dec;
 /* 保留中（走塁判断待ち）の仮想結果 */
 let vr=[],vb=null;
 if(pend){const B=m.bases;const mk=(r,from,to)=>({pid:r.id,name:r.name,from,to,outAt:null,speed:m.runnerSpeed(r)});
  if(B[2])vr.push(mk(B[2],3,dec&&dec.kind==='tag'?3:(dec&&dec.kind==='throw'&&!d.infieldIn&&!(B[0]&&B[1])?3:4)));
  if(B[1])vr.push(mk(B[1],2,c.res==='FO'?2:3));
  if(B[0])vr.push(mk(B[0],1,c.res==='FO'?1:c.res==='2B'?3:2));
  vb={pid:m.pa.b.id,name:m.pa.b.name,to:c.res==='FO'?1:c.res==='2B'?2:1,outAt:c.res==='FO'?0:null,speed:m.pa.be.speed};
  sc.pauseAt=Tpick+150;sc.decision=dec;}
 const RL=pend?vr:runners;const BR=pend?vb:batterRec;
 /* 送球先を決める */
 const outs=[];for(const r of RL)if(r.outAt&&r.outAt>0)outs.push({base:r.outAt,who:r});
 if(BR&&BR.outAt&&BR.outAt>0)outs.push({base:BR.outAt,who:BR,batter:true});
 outs.sort((x,y)=>y.base-x.base);
 let throws=[];
 if(!isHR){
  if(outs.length){for(const o of outs)throws.push({base:o.base,out:o});}
  else if(!pend){let lead=0;for(const r of RL)if(r.to<4&&r.to>lead)lead=r.to;if(BR&&BR.to<4&&BR.to>lead)lead=BR.to;if(play&&play.throwTo){/* ユーザーの送球先（セーフ） */const tb=play.throwTo;throws.push({base:tb,safe:RL.find(r=>r.to===tb)||(BR&&BR.to===tb?BR:null)});}else if(caught){const tag=RL.find(r=>r.to===4&&r.from===3);if(tag)throws.push({base:4,safe:tag});}else if(c.res!=='E'||true){throws.push({base:Math.min(4,Math.max(2,lead+1)),safe:null});}}
  else if(pend){/* 判断待ち：ここで止める */}}
 /* 送球の生成 */
 const cover={1:'一',2:'遊',3:'三',4:'捕'};const alt={一:'投',遊:'二',三:'遊',捕:'投'};
 let tCur=Tpick;let from=sc.pick;let lastThrowEnd=Tpick;
 const ballTail=sc.ball[sc.ball.length-1];if(!isHR&&(ballTail.t<Tpick)){sc.ball.push({t:Tpick,x:sc.pick[0],y:sc.pick[1],z:0.8});}
 const bpos=fwAt(sc.ball,Tpick);from=[bpos.x,bpos.y];
 const throwPlan=[];
 for(const th of throws){const B=FW_BASE[th.base];let cv=cover[th.base];if(cv===fielder)cv=alt[cv];if(cv==='捕'&&fielder==='捕')cv='投';
  const dd=fwDist(from,B);const Tt=dd/30*1000*S;const Ta=tCur+Tt;
  sc.ball.push({t:Ta,x:B[0],y:B[1],z:1.2,arc:Math.min(4,dd/25)});
  /* カバーの野手が塁へ */const f=fp[cv];const st=f.path[f.path.length-1];if(fwDist([st.x,st.y],B)>0.5){const arrive=Math.min(Ta-100,Math.max(st.t+200,Ta-400));f.path.push({t:Math.max(st.t+50,arrive),x:B[0]+(th.base===4?0:0.8),y:B[1]+(th.base===4?-0.8:0.8)});}
  f.pose.push({t:Ta-150,p:th.base===4?'catchLow':'catchHigh'});
  throwPlan.push({base:th.base,Ta,out:th.out,safe:th.safe,from:from.slice(),cv});
  tCur=Ta+280*S;from=B;lastThrowEnd=Ta;}
 sc.throws=throwPlan;
 /* 走者の経路 */
 const mkRun=(rec,isBatter)=>{if(!rec)return;const col=cb;const v=vOf(rec.speed||55);let from0=isBatter?0:rec.from;let to=rec.to;const outAt=rec.outAt;
  const r={pid:rec.pid,name:rec.name,col,path:null,outAt:null,safeAt:null,scored:to===4&&!outAt,isBatter,helmet:true};
  if(isBatter&&outAt===0){/* 捕球されてアウト：一塁へ走りかけて止まる */const stopT=Tcatch!=null?Tcatch:Tland;const far=Math.min(0.75,stopT/(27.4/v*1000*S));r.path=[{t:0,x:0,y:0},{t:stopT,x:19.4*far,y:19.4*far}];r.outAt={t:stopT,base:0};sc.runners.push(r);return;}
  /* 判断後の再開：保留塁まで走ってから続きを走る */
  const dd=opt.dec;const hold=dd?(dd.kind==='third'?2:3):null;const resumed=opt.resume!=null&&dd&&!isBatter&&dd.runner&&rec.pid===dd.runner.id&&hold!=null&&(outAt?outAt>hold:to>hold);
  if(resumed){const t0=dd.kind==='tag'?Tcatch:(air?Math.min(Tland*0.45,350):0);const p1=dd.kind==='tag'?[{t:0,x:FW_BASE[3][0],y:FW_BASE[3][1]},{t:t0,x:FW_BASE[3][0],y:FW_BASE[3][1]}]:fwRunnerPath(from0,hold,t0,v,null,3);const T1=Math.max(p1[p1.length-1].t,opt.resume);const dest=outAt||to;const th=throwPlan.find(x=>x.base===dest);let arrive=null;
   if(outAt){arrive=(th?th.Ta:Tpick+800)+140*S;r.outAt={t:arrive,base:outAt};}else if(th){const nat=T1+27.4/v*1000*S;arrive=Math.min(nat,th.Ta-160*S);if(arrive<T1+250)arrive=T1+250;r.safeAt={t:arrive,base:to};}
   const p2=fwRunnerPath(hold,dest,T1,v,arrive,0);r.path=p1.concat(p2.slice(1));r.slide=true;if(!outAt&&to===4){sc.callouts.push({t:r.path[r.path.length-1].t,x:0,y:0,z:2.5,text:'得点！',kind:'score'});}sc.runners.push(r);return;}
  if(outAt&&outAt>0){const th=throwPlan.find(x=>x.base===outAt);const Ta=th?th.Ta:Tpick+800;const arrive=Ta+140*S;const t0=isBatter?0:(air&&!caught?Math.min(Tland*0.5,300):0);r.path=fwRunnerPath(from0,outAt,t0,v,arrive,isBatter?0:3);r.outAt={t:arrive,base:outAt};
   if(outAt===4||(!isBatter&&outAt>1))r.slide=true;}
  else{const th=throwPlan.find(x=>x.base===to&&!x.out);let t0=isBatter?0:(caught?(from0===3&&to===4?Tcatch:Tcatch+300):(air?Math.min(Tland*0.45,350):0));
   if(isHR){t0=200;r.path=fwRunnerPath(from0,4,t0,30,null,0);r.trot=true;}
   else{let arrive=null;if(th){const nat=t0+fwPathLen(fwRunnerPath(from0,to,t0,v,null,isBatter?0:3).map(p=>p))/v*1000*S;arrive=Math.min(nat,th.Ta-160*S);if(arrive<t0+300)arrive=t0+300;r.safeAt={t:arrive,base:to};}
    r.path=fwRunnerPath(from0,to,t0,v,arrive,isBatter?0:3);if(to===4&&from0!==4)r.slide=!!th;}
   if(to===4&&!isHR){const tl=r.path[r.path.length-1].t;sc.callouts.push({t:tl,x:0,y:0,z:2.5,text:'得点！',kind:'score'});}
   if(isHR){const tl=r.path[r.path.length-1].t;sc.callouts.push({t:tl,x:0,y:0,z:2.5,text:'ホームイン',kind:'score',dur:900});}}
  sc.runners.push(r);};
 for(const rec of RL)mkRun(rec,false);
 mkRun(BR,true);
 /* アウト／セーフの表示 */
 for(const th of throwPlan){const B=FW_BASE[th.base];if(th.out){sc.callouts.push({t:th.out.who?Math.max(th.Ta,(sc.runners.find(r=>r.pid===th.out.who.pid)||{outAt:{t:th.Ta}}).outAt.t):th.Ta,x:B[0],y:B[1],z:2.2,text:'アウト！',kind:'out'});}
  else if(th.safe||sc.runners.some(r=>r.safeAt&&r.safeAt.base===th.base)){const rr=sc.runners.find(r=>r.safeAt&&r.safeAt.base===th.base);sc.callouts.push({t:Math.max(th.Ta,rr?rr.safeAt.t:th.Ta),x:B[0],y:B[1],z:2.2,text:'セーフ！',kind:'safe'});}}
 if(caught&&BR&&BR.outAt===0){const p=sc.pick;sc.callouts.push({t:Tcatch+350,x:p[0],y:p[1],z:2.5,text:'アウト！',kind:'out'});}
 /* 終了時刻 */let T=Math.max(Tpick+600,lastThrowEnd+500);for(const r of sc.runners){const tl=r.path[r.path.length-1].t;T=Math.max(T,tl+350);}for(const cl of sc.callouts)T=Math.max(T,cl.t+(cl.dur||900));
 if(isHR)T=Math.max(T,Tland+2400);
 sc.T=pend?sc.pauseAt+10:T;sc.Tfull=T;sc.rate=clamp(T/4200,1,2.4);
 return sc;}
/* ====== 走者プレー（盗塁・牽制・暴投）のシーン ====== */
function fwBuildRunnerScene(rp){const m=AR.m;const d=m.def();const DP=fwDefPos(d);const S=FW_SPEED;const cb=arTeamColors(m.bat());
 const sc={t0:performance.now(),T:0,ball:[],fielders:{},runners:[],callouts:[],fx:[],pauseAt:null,kind:rp.kind,primary:'捕',ended:false,colBat:cb,colDef:arTeamColors(d),defTeam:d,batTeam:m.bat()};
 for(const k in DP)sc.fielders[k]={path:[{t:0,x:DP[k][0],y:DP[k][1]}],pose:[],face:k==='捕'?1:-1};
 const fp=sc.fielders;const cover={1:'一',2:'遊',3:'三',4:'捕'};
 const v=6.6+((rp.speed||55)-50)/22;
 if(rp.kind==='steal'){const B=FW_BASE[rp.to];const cv=cover[rp.to];const from=[0,-2.2];const dd=fwDist(from,B);const Tt=320*S+dd/30*1000*S;
  sc.ball.push({t:0,x:0,y:-1.5,z:1});sc.ball.push({t:320*S,x:0,y:-1.5,z:1.6});sc.ball.push({t:Tt,x:B[0],y:B[1],z:1,arc:3});
  fp['捕'].pose.push({t:0,p:'throw'});if(cv!=='捕'){const f=fp[cv];f.path.push({t:Math.max(150,Tt-350),x:B[0]+0.8,y:B[1]+0.8});f.pose.push({t:Tt-150,p:'catchLow'});}
  const arrive=rp.ok?Math.max(500,Tt-170*S):Tt+150*S;const r={pid:rp.pid,name:rp.name,col:cb,path:fwRunnerPath(rp.from,rp.to,-250,v,arrive,5),outAt:rp.ok?null:{t:arrive,base:rp.to},safeAt:rp.ok?{t:arrive,base:rp.to}:null,slide:true,helmet:true};sc.runners.push(r);
  sc.callouts.push({t:Math.max(arrive,Tt)+60,x:B[0],y:B[1],z:2.2,text:rp.ok?'セーフ！':'アウト！',kind:rp.ok?'safe':'out'});sc.T=Math.max(arrive,Tt)+1100;}
 else if(rp.kind==='pickoff'){const B=FW_BASE[rp.from];const cv=cover[rp.from];const from=DP['投'];const dd=fwDist(from,B);const Tt=200*S+dd/28*1000*S;
  sc.ball.push({t:0,x:from[0],y:from[1],z:1.5});sc.ball.push({t:200*S,x:from[0],y:from[1],z:1.6});
  fp['投'].pose.push({t:0,p:'throw'});
  const lead=fwLerp(B,FW_BASE[rp.from+1]||FW_BASE[4],0.14);
  if(rp.err){const past=fwLerp(B,[B[0]+(rp.from===1?12:-12),B[1]+6],1);sc.ball.push({t:Tt,x:B[0],y:B[1],z:1,arc:2});sc.ball.push({t:Tt+700*S,x:past[0],y:past[1],z:0,arc:1});const f=fp[cv];f.path.push({t:Tt+800*S,x:past[0],y:past[1]});sc.callouts.push({t:Tt+100,x:B[0],y:B[1],z:2.2,text:'悪送球！',kind:'err'});
   const r={pid:rp.pid,name:rp.name,col:cb,path:[{t:0,x:lead[0],y:lead[1]}].concat(fwRunnerPath(rp.from,rp.to,Tt+200,v,null,0).slice(0)),helmet:true};sc.runners.push(r);sc.T=r.path[r.path.length-1].t+900;}
  else{sc.ball.push({t:Tt,x:B[0],y:B[1],z:0.8,arc:1.5});const f=fp[cv];if(fwDist([f.path[0].x,f.path[0].y],B)>1.5)f.path.push({t:Math.max(100,Tt-250),x:B[0]+0.6,y:B[1]+0.6});f.pose.push({t:Tt-120,p:'catchLow'});
   const back=rp.ok?Tt-120*S:Tt+140*S;const r={pid:rp.pid,name:rp.name,col:cb,path:[{t:0,x:lead[0],y:lead[1]},{t:150,x:lead[0],y:lead[1]},{t:Math.max(400,back),x:B[0],y:B[1]}],outAt:rp.ok?null:{t:back,base:rp.from},safeAt:rp.ok?{t:back,base:rp.from}:null,slide:true,helmet:true};sc.runners.push(r);
   sc.callouts.push({t:Math.max(back,Tt)+60,x:B[0],y:B[1],z:2.2,text:rp.ok?'セーフ！':'アウト！',kind:rp.ok?'safe':'out'});sc.T=Math.max(back,Tt)+1100;}}
 else if(rp.kind==='wp'){const stop=[gauss(0,3),-14];sc.ball.push({t:0,x:0,y:-1,z:1});sc.ball.push({t:700*S,x:stop[0],y:stop[1],z:0,arc:0.6});const f=fp['捕'];f.path.push({t:1100*S,x:stop[0],y:stop[1]+1});f.pose.push({t:900*S,p:'catchLow'});
  for(const mv of rp.moves){const r={pid:mv.pid,name:mv.name,col:cb,path:fwRunnerPath(mv.from,mv.to,250,6.6+((mv.speed||55)-50)/22,null,3),helmet:true,scored:mv.to===4};sc.runners.push(r);if(mv.to===4)sc.callouts.push({t:r.path[r.path.length-1].t,x:0,y:0,z:2.5,text:'得点！',kind:'score'});}
  sc.callouts.push({t:300,x:stop[0],y:stop[1],z:2,text:'暴投！',kind:'err'});let T=1600;for(const r of sc.runners)T=Math.max(T,r.path[r.path.length-1].t+500);sc.T=T;}
 else{sc.T=600;}
 sc.Tfull=sc.T;sc.rate=clamp(sc.T/3000,1,2);return sc;}
/* ====== カメラ ====== */
function fwProj(x,y,z){return [x,y*0.6+(z||0)*0.8];}
function fwCamTarget(sc,t){const W=AR.W,H=AR.H;const pts=[];const b=fwAt(sc.ball,t);
 if(sc.kind==='inplay'){const started=t<(sc.Tpick||0)+400;if(sc.res==='HR'&&t>(sc.Tpick||0)){for(const r of sc.runners){const p=fwAt(r.path,t);if(p.moving)pts.push([p.x,p.y,0]);}pts.push([0,0,0]);}else if(b)pts.push([b.x,b.y,b.z]);
  if(started&&sc.primary&&sc.fielders[sc.primary]){const f=fwAt(sc.fielders[sc.primary].path,t);pts.push([f.x,f.y,0]);}
  const th=(sc.throws||[]).find(x=>t>=x.Ta-900&&t<=x.Ta+700);if(th){const B=FW_BASE[th.base];pts.push([B[0],B[1],0]);for(const r of sc.runners){const p=fwAt(r.path,t);if(p.moving)pts.push([p.x,p.y,0]);}}
  if(t<350){pts.push([0,0,0]);}
  if(!pts.length)pts.push([0,20,0]);}
 else{for(const r of sc.runners){const p=fwAt(r.path,t);pts.push([p.x,p.y,0]);}if(b)pts.push([b.x,b.y,b.z]);pts.push([0,0,0]);}
 let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;for(const p of pts){const q=fwProj(p[0],p[1],p[2]);minx=Math.min(minx,q[0]);maxx=Math.max(maxx,q[0]);miny=Math.min(miny,q[1]);maxy=Math.max(maxy,q[1]);}
 const bw=Math.max(maxx-minx,18),bh=Math.max(maxy-miny,14);
 const s=clamp(Math.min((W-70)/bw,(H-150)/bh),3.4,sc.kind==='inplay'?13:15);
 return {x:(minx+maxx)/2,y:(miny+maxy)/2+ (6/s),s};}
function fwCamStep(sc,t){const tg=fwCamTarget(sc,t);const c=AR.cam||(AR.cam={x:tg.x,y:tg.y,s:tg.s});const k=sc.cut?1:0.1;c.x+=(tg.x-c.x)*k;c.y+=(tg.y-c.y)*k;c.s+=(tg.s-c.s)*k*0.8;sc.cut=false;return c;}
function fwToScr(cam,x,y,z){if(r3on())return r3WorldToScreen(x,y,z||0);const q=fwProj(x,y,z);return [AR.W/2+(q[0]-cam.x)*cam.s,AR.H*0.55-(q[1]-cam.y)*cam.s];}
/* ====== 描画 ====== */
/* 観客席の点（固定の疑似乱数で生成） */
const FW_CROWD=(()=>{const out=[];let s=12345;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};const cols=['#e8e4da','#d9534f','#3b6fb6','#f0c75e','#8aa5c8','#2b2f36','#c9b7a0','#f4f4f4','#6aa84f'];for(let i=0;i<520;i++){const a=-60+rnd()*120;const r=(Math.abs(a)>45?FENCE(45)+(Math.abs(a)-45)*1.4:FENCE(a))+3.5+rnd()*11;out.push({a,r,col:cols[Math.floor(rnd()*cols.length)],z:2+rnd()*5});}return out;})();
function fwDrawGround(g,cam){const W=AR.W,H=AR.H;const PL=arPal();const night=arNight();
 /* 空とスタンド外周 */const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,PL.sky1);sky.addColorStop(0.5,PL.sky2);sky.addColorStop(1,PL.stand1);g.fillStyle=sky;g.fillRect(0,0,W,H);
 g.save();g.translate(W/2-cam.x*cam.s,H*0.55+cam.y*cam.s);g.scale(cam.s,-cam.s*0.6);
 /* 観客席（フェンスの外側の帯） */g.fillStyle=PL.stand2;g.beginPath();for(let a=-62;a<=62;a+=4){const aa=clamp(a,-45,45);const r=FENCE(aa)+(Math.abs(a)>45?(Math.abs(a)-45)*1.4:0)+16;const p=fwPolar(r,a);if(a===-62)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);}g.lineTo(80,-30);g.lineTo(-80,-30);g.closePath();g.fill();
 g.fillStyle=PL.stand1;g.beginPath();for(let a=-62;a<=62;a+=4){const aa=clamp(a,-45,45);const r=FENCE(aa)+(Math.abs(a)>45?(Math.abs(a)-45)*1.4:0)+8;const p=fwPolar(r,a);if(a===-62)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);}for(let a=62;a>=-62;a-=4){const aa=clamp(a,-45,45);const r=FENCE(aa)+(Math.abs(a)>45?(Math.abs(a)-45)*1.4:0)+2.5;const p=fwPolar(r,a);g.lineTo(p[0],p[1]);}g.closePath();g.fill();
 {const dsz=cam.s>9?0.8:1.2;for(const c of FW_CROWD){const p=fwPolar(c.r,c.a);g.fillStyle=c.col;g.fillRect(p[0]-dsz/2,p[1]-dsz/2,dsz,dsz);}}
 /* 芝（扇形＋ファウルグラウンド） */g.fillStyle=PL.grass1;g.beginPath();g.moveTo(-60,-14);for(let a=-52;a<=52;a+=4){const aa=clamp(a,-45,45);const r=FENCE(aa)+(Math.abs(a)>45?(Math.abs(a)-45)*1.4:0);const p=fwPolar(r,a);g.lineTo(p[0],p[1]);}g.lineTo(60,-14);g.closePath();g.fill();
 g.save();g.clip();g.fillStyle=PL.grass2;for(let r=9;r<130;r+=18){g.beginPath();g.arc(0,0,r+9,0,Math.PI*2);g.arc(0,0,r,0,Math.PI*2,true);g.fill();}g.restore();
 /* ウォーニングトラック */g.fillStyle=PL.dirt2;g.beginPath();for(let a=-45;a<=45;a+=3){const p=fwPolar(FENCE(a)+0.2,a);if(a===-45)g.moveTo(p[0],p[1]);else g.lineTo(p[0],p[1]);}for(let a=45;a>=-45;a-=3){const p=fwPolar(FENCE(a)-3.2,a);g.lineTo(p[0],p[1]);}g.closePath();g.fill();
 /* 内野の土 */g.fillStyle=PL.dirt;g.beginPath();g.arc(0,18.4,29,0,Math.PI*2);g.fill();
 g.fillStyle=PL.grass1;g.beginPath();g.moveTo(0,3.2);g.lineTo(16.4,19.4);g.lineTo(0,35.6);g.lineTo(-16.4,19.4);g.closePath();g.fill();
 g.fillStyle=PL.dirt;g.beginPath();g.arc(0,18.4,2.8,0,Math.PI*2);g.fill();g.beginPath();g.arc(0,0,4.2,0,Math.PI*2);g.fill();
 /* ファウルライン */g.strokeStyle=PL.chalk;g.lineWidth=0.35;g.beginPath();g.moveTo(0,0);const fl=fwPolar(FENCE(-45),-45);g.lineTo(fl[0],fl[1]);g.moveTo(0,0);const fr=fwPolar(FENCE(45),45);g.lineTo(fr[0],fr[1]);g.stroke();
 /* バッターボックス */g.strokeStyle=PL.chalk;g.lineWidth=0.18;g.strokeRect(-2.2,-1.1,1.4,2.2);g.strokeRect(0.8,-1.1,1.4,2.2);
 /* 塁 */g.fillStyle='#ffffff';for(let i=1;i<=3;i++){const B=FW_BASE[i];g.save();g.translate(B[0],B[1]);g.rotate(Math.PI/4);g.fillRect(-0.5,-0.5,1,1);g.restore();}
 g.beginPath();g.moveTo(-0.45,0.25);g.lineTo(0.45,0.25);g.lineTo(0.45,-0.15);g.lineTo(0,-0.5);g.lineTo(-0.45,-0.15);g.closePath();g.fill();
 g.restore();
 /* フェンス（壁） */g.beginPath();let first=true;for(let a=-45;a<=45;a+=3){const p=fwPolar(FENCE(a),a);const s0=fwToScr(cam,p[0],p[1],0);if(first){g.moveTo(s0[0],s0[1]);first=false;}else g.lineTo(s0[0],s0[1]);}
 for(let a=45;a>=-45;a-=3){const p=fwPolar(FENCE(a),a);const s1=fwToScr(cam,p[0],p[1],3.2);g.lineTo(s1[0],s1[1]);}g.closePath();g.fillStyle=PL.fence;g.fill();
 g.beginPath();first=true;for(let a=-45;a<=45;a+=3){const p=fwPolar(FENCE(a),a);const s1=fwToScr(cam,p[0],p[1],3.2);if(first){g.moveTo(s1[0],s1[1]);first=false;}else g.lineTo(s1[0],s1[1]);}g.strokeStyle=PL.fenceLine;g.lineWidth=Math.max(1.5,cam.s*0.25);g.stroke();
 /* ファウルポール */for(const a of [-45,45]){const p=fwPolar(FENCE(a),a);const b0=fwToScr(cam,p[0],p[1],0),b1=fwToScr(cam,p[0],p[1],14);g.strokeStyle='#ffd84a';g.lineWidth=Math.max(1.5,cam.s*0.22);g.beginPath();g.moveTo(b0[0],b0[1]);g.lineTo(b1[0],b1[1]);g.stroke();}
 /* バックスクリーンのスコアボード */{const sb=AR.m;if(sb){const y=FENCE(0)+13;const c0=fwToScr(cam,-16,y,4),c1=fwToScr(cam,16,y,4),c2=fwToScr(cam,16,y,15),c3=fwToScr(cam,-16,y,15);const w=c1[0]-c0[0];if(w>40&&c0[1]>-60&&c2[1]<H+60){g.fillStyle='#10161c';g.beginPath();g.moveTo(c0[0],c0[1]);g.lineTo(c1[0],c1[1]);g.lineTo(c2[0],c2[1]);g.lineTo(c3[0],c3[1]);g.closePath();g.fill();g.strokeStyle='#3a4552';g.lineWidth=1;g.stroke();const hh=c0[1]-c3[1];const fs=Math.max(8,Math.min(22,w/9));g.fillStyle='#ffd166';g.font=`700 ${fs}px ${getComputedStyle(document.body).getPropertyValue('--font-num')||'monospace'}`;g.textAlign='center';g.textBaseline='middle';g.fillText(`${sb.score[0]}  -  ${sb.score[1]}`,(c0[0]+c1[0])/2,c3[1]+hh*0.42);g.fillStyle='#e8e4da';g.font=`${Math.max(7,fs*0.55)}px sans-serif`;g.fillText(`${sb.inn}回${sb.top?'表':'裏'}  ${sb.outs}アウト`,(c0[0]+c1[0])/2,c3[1]+hh*0.78);}}}}
/* ミニ人物。sx,syは足元。hは身長px */
function fwFigure(g,sx,sy,h,col,o){o=o||{};const s=h/100;const face=o.face||1;g.save();g.translate(sx,sy);if(face<0)g.scale(-1,1);g.lineCap='round';g.lineJoin='round';
 const pose=o.pose||'stand';const ph=o.phase||0;const run=pose==='run';
 const lo=run?Math.sin(ph)*14:0;const legY=pose==='catchLow'||pose==='ready'?-30:-40;
 /* 影 */g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(0,1,16*s,5*s,0,0,Math.PI*2);g.fill();
 /* 脚 */g.strokeStyle=col.pants;g.lineWidth=12*s;g.beginPath();g.moveTo(-6*s,legY*s);g.lineTo((-9+lo)*s,-2*s);g.moveTo(6*s,legY*s);g.lineTo((9-lo)*s,-2*s);g.stroke();
 if(pose==='slide'){g.restore();g.save();g.translate(sx,sy);if(face<0)g.scale(-1,1);g.strokeStyle=col.pants;g.lineWidth=12*s;g.beginPath();g.moveTo(-10*s,-8*s);g.lineTo(18*s,-4*s);g.stroke();g.fillStyle=col.base;g.beginPath();g.ellipse(-12*s,-14*s,16*s,10*s,-0.3,0,Math.PI*2);g.fill();g.fillStyle='#e7b48a';g.beginPath();g.arc(-26*s,-20*s,8*s,0,Math.PI*2);g.fill();g.fillStyle=col.cap;g.beginPath();g.arc(-26*s,-22*s,8.5*s,Math.PI*0.9,Math.PI*2.1);g.fill();g.restore();return;}
 /* 胴 */const ty=pose==='catchLow'||pose==='ready'?-66:-76;g.fillStyle=col.base;g.beginPath();g.moveTo(-15*s,ty*s);g.lineTo(15*s,ty*s);g.lineTo(12*s,(legY+2)*s);g.lineTo(-12*s,(legY+2)*s);g.closePath();g.fill();g.strokeStyle=col.trim;g.lineWidth=2*s;g.stroke();
 /* 腕とグラブ */let gl=[22,-48];let th=[-22,-50];
 if(pose==='catchHigh')gl=[14,-96];else if(pose==='catchLow')gl=[18,-26];else if(pose==='throw'){th=[-26,-82];gl=[20,-60];}else if(pose==='lookUp')gl=[10,-40];else if(run){gl=[20+Math.sin(ph)*8,-56];th=[-20-Math.sin(ph)*8,-56];}
 g.strokeStyle=col.base;g.lineWidth=7*s;g.beginPath();g.moveTo(12*s,(ty+4)*s);g.lineTo(gl[0]*s,gl[1]*s);g.moveTo(-12*s,(ty+4)*s);g.lineTo(th[0]*s,th[1]*s);g.stroke();
 if(o.glove!==false){g.fillStyle='#8b5e34';g.beginPath();g.arc(gl[0]*s,gl[1]*s,6*s,0,Math.PI*2);g.fill();}else{g.fillStyle='#e7b48a';g.beginPath();g.arc(gl[0]*s,gl[1]*s,4*s,0,Math.PI*2);g.fill();}
 g.fillStyle='#e7b48a';g.beginPath();g.arc(th[0]*s,th[1]*s,4*s,0,Math.PI*2);g.fill();
 /* 頭 */const hy=(ty-12)*s;g.fillStyle='#e7b48a';g.beginPath();g.arc(0,hy,9*s,0,Math.PI*2);g.fill();g.fillStyle=col.cap;if(o.helmet){g.beginPath();g.arc(0,hy-1*s,9.8*s,Math.PI*0.95,Math.PI*2.05);g.fill();g.beginPath();g.moveTo(0,hy-1*s);g.lineTo(13*s,hy+1*s);g.lineTo(10*s,hy+6*s);g.closePath();g.fill();}else{g.beginPath();g.arc(0,hy-2*s,9.5*s,Math.PI,0);g.fill();g.fillRect(-9*s,hy-3*s,22*s,3*s);}
 if(o.label){const fs=Math.max(9,Math.min(12,10*s));const lw=o.label.length*fs+6,lh=fs+4;g.fillStyle='rgba(0,0,0,.5)';g.beginPath();if(g.roundRect)g.roundRect(-lw/2,hy-14*s-lh,lw,lh,3);else g.rect(-lw/2,hy-14*s-lh,lw,lh);g.fill();g.fillStyle='#fff';g.font=`700 ${fs}px sans-serif`;g.textAlign='center';g.textBaseline='middle';if(face<0){g.save();g.scale(-1,1);g.fillText(o.label,0,hy-14*s-lh/2);g.restore();}else g.fillText(o.label,0,hy-14*s-lh/2);}
 g.restore();}
function fwPoseAt(f,t){let p='stand';for(const q of f.pose){if(t>=q.t)p=q.p;}return p;}
function fwTime(sc,now){return sc.paused?sc.pauseAt:(now-sc.t0)*(sc.rate||1);}
function fwDrawScene(now,tOverride){const g=AR.g,W=AR.W,H=AR.H;const sc=AR.field;if(!sc)return;const m=AR.m;
 let t=tOverride!=null?tOverride:fwTime(sc,now);if(t>sc.T)t=sc.T;
 const cam=fwCamStep(sc,t);const hud=r3on();
 if(!hud){fwDrawGround(g,cam);}
 const ents=[];if(hud){/* 3D時：地面・人物・ボールは3D側で描く */}else{
 /* 審判（球審・一塁・三塁） */const UMP={base:'#2b3340',trim:'#2b3340',cap:'#1b1f26',pants:'#3a4250'};for(const u of [[0,-3.6,1],[26,16.5,-1],[-26,16.5,1]]){ents.push({y:u[1],draw:()=>{const [sx,sy]=fwToScr(cam,u[0],u[1],0);fwFigure(g,sx,sy,cam.s*2.3,UMP,{pose:'ready',face:u[2],glove:false});}});}
 /* 野手 */for(const k in sc.fielders){const f=sc.fielders[k];const p=fwAt(f.path,t);const prev=fwAt(f.path,t-80);let face=f.face;if(p.moving&&Math.abs(p.x-prev.x)>0.05)face=p.x>prev.x?1:-1;f.face=face;let pose=fwPoseAt(f,t);if(p.moving&&(pose==='stand'||pose==='run'))pose='run';ents.push({y:p.y,draw:()=>{const [sx,sy]=fwToScr(cam,p.x,p.y,0);fwFigure(g,sx,sy,cam.s*2.5,sc.colDef,{pose,face,phase:now/70,label:k,glove:true});}});}
 /* 走者 */for(const r of sc.runners){const p=fwAt(r.path,t);const prev=fwAt(r.path,t-80);let face=1;if(Math.abs(p.x-prev.x)>0.05)face=p.x>prev.x?1:-1;const outT=r.outAt?r.outAt.t:null;const isOut=outT!=null&&t>=outT;const sliding=r.slide&&r.path.length&&t>r.path[r.path.length-1].t-260&&t<r.path[r.path.length-1].t+700;const done=!p.moving&&t>r.path[r.path.length-1].t+50;
  if(r.scored&&done&&!r.trot&&t>r.path[r.path.length-1].t+300)continue;
  ents.push({y:p.y-0.01,draw:()=>{const [sx,sy]=fwToScr(cam,p.x,p.y,0);g.save();if(isOut&&t>outT+500)g.globalAlpha=0.5;fwFigure(g,sx,sy,cam.s*2.5,r.col,{pose:sliding?'slide':(p.moving?'run':'stand'),face,phase:now/60,helmet:true,glove:false,label:''});if(!isOut){const hh=cam.s*2.5;g.fillStyle='#ffd166';g.beginPath();g.moveTo(sx-5,sy-hh*1.08-10);g.lineTo(sx+5,sy-hh*1.08-10);g.lineTo(sx,sy-hh*1.08-3);g.closePath();g.fill();}g.restore();}});}
 ents.sort((a,b)=>b.y-a.y);for(const e of ents)e.draw();
 /* ボール（影＋本体＋軌跡） */const b=fwAt(sc.ball,t);if(b&&t<=sc.T){
  const trail=[];for(let k=4;k>=1;k--){const q=fwAt(sc.ball,t-k*28);if(q)trail.push(q);}g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=Math.max(1,cam.s*0.18);g.beginPath();trail.forEach((q,i)=>{const [x,y]=fwToScr(cam,q.x,q.y,q.z);if(i===0)g.moveTo(x,y);else g.lineTo(x,y);});const [bx,by]=fwToScr(cam,b.x,b.y,b.z);g.lineTo(bx,by);g.stroke();
  const [gx,gy]=fwToScr(cam,b.x,b.y,0);g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(gx,gy,Math.max(2,cam.s*0.35),Math.max(1.2,cam.s*0.2),0,0,Math.PI*2);g.fill();
  arDrawBall(g,bx,by,clamp(cam.s*0.26+b.z*0.02*cam.s,2.6,7),now/80);}}
 /* エフェクト（花火） */for(const fx of sc.fx){const dt=t-fx.t;if(dt<0||dt>1800)continue;const [cx,cy]=fwToScr(cam,fx.x,fx.y,3);for(let i=0;i<14;i++){const ang=i/14*Math.PI*2+fx.t;const rr=dt/1800;const px=cx+Math.cos(ang)*rr*90,py=cy+Math.sin(ang)*rr*60-rr*rr*40;g.fillStyle=['#ffd166','#ff5a4a','#5ab0ff','#fff'][i%4];g.globalAlpha=1-rr;g.beginPath();g.arc(px,py,3,0,Math.PI*2);g.fill();}g.globalAlpha=1;}
 /* 効果音 */for(const cl of sc.callouts){if(!cl.snd&&t>=cl.t&&t<cl.t+400){cl.snd=true;arSound(cl.kind==='catch'?'mitt':cl.kind==='out'?'out':cl.kind==='safe'||cl.kind==='score'?'run':cl.kind==='hr'?'hr':cl.kind==='err'?'foul':'ui');}}
 /* スライディングの土煙 */for(const r of sc.runners){if(!r.slide||!r.path.length)continue;const te=r.path[r.path.length-1].t;const dt=t-(te-200);if(dt<0||dt>600)continue;const p=fwAt(r.path,t);const [sx,sy]=fwToScr(cam,p.x,p.y,0);g.save();g.globalAlpha=0.5*(1-dt/600);g.fillStyle='#d9c49a';for(let i=0;i<4;i++){g.beginPath();g.arc(sx-8+i*6-dt*0.01,sy-2-i*3-dt*0.012,4+dt*0.012,0,Math.PI*2);g.fill();}g.restore();}
 /* コールアウト */for(const cl of sc.callouts){const dt=t-cl.t;const dur=cl.dur||900;if(dt<0||dt>dur)continue;const [x,y]=fwToScr(cam,cl.x,cl.y,cl.z||2);const u=Math.min(1,dt/180);const sz=(cl.kind==='hr'?30:cl.kind==='score'?22:22)*(0.6+0.4*u);
  g.save();g.globalAlpha=dt>dur-250?(dur-dt)/250:1;g.font=`700 ${sz}px ${getComputedStyle(document.body).getPropertyValue('--font-display')||'serif'}`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.strokeStyle='rgba(0,0,0,.8)';g.strokeText(cl.text,x,y-sz*0.6);g.fillStyle=cl.kind==='out'?'#ff6b61':cl.kind==='safe'?'#7ef0a0':cl.kind==='hr'||cl.kind==='score'?'#ffd166':cl.kind==='err'?'#ffb347':'#fff';g.fillText(cl.text,x,y-sz*0.6);g.restore();}
 /* 上部の打球情報 */const c=sc.c;if(c){g.fillStyle='rgba(0,0,0,.45)';g.fillRect(0,0,W,22);g.fillStyle='#fff';g.font='12px sans-serif';g.textAlign='left';g.textBaseline='middle';g.fillText(`${c.type==='ground'?'ゴロ':c.type==='line'?'ライナー':c.type==='fly'?'フライ':c.type==='pop'?'小飛球':'バント'}　${c.dist}m${c.ev?'　打球速度 '+c.ev+'km/h':''}　${dirLabel(c.a||0)}方向`,10,11);}
 if(sc.paused){g.fillStyle='rgba(0,0,0,.35)';g.fillRect(0,H-26,W,26);g.fillStyle='#fff';g.font='700 13px sans-serif';g.textAlign='center';g.fillText(sc.decision&&sc.decision.kind==='throw'?'送球先を選択！下のボタンで決める':'走塁の判断！下のボタンで選択',W/2,H-13);}}
function fwSceneTime(sc){if(!sc)return 0;if(sc.paused)return sc.pauseAt;return performance.now()-sc.t0;}
