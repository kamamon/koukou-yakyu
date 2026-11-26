/* Original procedural motion variants and venue profiles. Generated from the existing authored poses; not mocap. */
const V28Catalog=(function catalogFactory(def,poses){
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function hash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
 const motion=[],variants={};
 const copy=o=>JSON.parse(JSON.stringify(o));
 const pose=(base,add)=>Object.assign({},copy(poses[base]||{}),add||{});
 const make=(name,dur,keys,ev=[])=>{def[name]={dur,keys,ev};return name;};
 const runner=make('v28_lead',1100,[{t:0,p:pose('r_lead')},{t:320,p:pose('r_lead',{dy:-.28,torso:[.42,.12,0],head:[-.32,-.2,0]})},{t:720,p:pose('r_lead',{dy:-.16,torso:[.24,-.12,0]})},{t:1100,p:pose('r_lead')}]);
 const slide=make('v28_slide',880,[{t:0,p:pose('r_lead')},{t:240,p:pose('r_slide')},{t:550,p:pose('r_slide',{head:[.4,-.12,0]})},{t:880,p:pose('r_slide')}],[{t:550,k:'base'}]);
 const dive=make('v28_dive',950,[{t:0,p:pose('r_lead')},{t:240,p:pose('r_dive')},{t:580,p:pose('r_dive',{head:[-.72,0,0]})},{t:950,p:pose('r_dive')}],[{t:580,k:'base'}]);
 const idle=make('v28_idle',2100,[{t:0,p:pose('f_stand')},{t:700,p:pose('f_stand',{dy:-.025,head:[.05,.22,0],torso:[.04,0,0]})},{t:1400,p:pose('f_stand',{head:[.02,-.2,0]})},{t:2100,p:pose('f_stand')}]);
 const ready=make('v28_ready',1600,[{t:0,p:pose('f_ready')},{t:550,p:pose('f_ready',{dy:-.23,head:[-.22,.18,0]})},{t:1100,p:pose('f_ready',{dy:-.13,head:[-.18,-.15,0]})},{t:1600,p:pose('f_ready')}]);
 const catcher=make('v28_catcher',1500,[{t:0,p:pose('c_crouch')},{t:500,p:pose('c_crouch',{head:[-.08,.17,0]})},{t:1000,p:pose('c_crouch',{head:[-.1,-.12,0]})},{t:1500,p:pose('c_crouch')}]);
 const emotion=(name,mode)=>{
  const base=pose('f_stand');const high=mode==='win'||mode==='cheer',sad=mode==='sad',bow=mode==='bow';
  const lift=high?{rSh:[-2.25,0,-.3],lSh:[-2.1,0,.3],rEl:[-.75,0,0],lEl:[-.8,0,0],head:[-.22,0,0],torso:[-.08,0,0]}:sad?{dy:-.08,head:[.42,0,0],torso:[.22,0,0],rSh:[.1,0,-.14],lSh:[.1,0,.14]}:bow?{torso:[.53,0,0],head:[.25,0,0],hips:[.13,0,0]}:{rSh:[-1.3,0,-.22],lSh:[-.9,0,.25],rEl:[-1.3,0,0],lEl:[-1.1,0,0],head:[-.07,.13,0]};
  return make(name,1700,[{t:0,p:base},{t:430,p:Object.assign({},base,lift)},{t:950,p:Object.assign({},base,lift,{head:sad?[.51,0,0]:bow?[.28,0,0]:[-.12,-.17,0]})},{t:1700,p:base}]);
 };
 const groups=[
 ['投球',['p_set_over','p_set_three','p_set_side','p_set_under'],['オーバー','スリークォーター','サイド','アンダー']],
 ['打撃',['b_pre','b_swing','b_bunt','b_take'],['始動','スイング','バント','見逃し']],
 ['守備',['f_gb','f_fly','f_line','f_1b','f_throw','f_tag'],['ゴロ','フライ','ライナー','一塁捕球','送球','タッチ']],
 ['走塁',[runner,slide,dive],['リード','足から滑り込み','頭から帰塁']],
 ['待機',[idle,ready,catcher],['立ち姿','守備準備','捕手準備']],
 ['演出',[emotion('v28_win','win'),emotion('v28_cheer','cheer'),emotion('v28_sad','sad'),emotion('v28_bow','bow'),emotion('v28_focus','focus')],['勝利','歓声','悔しさ','礼','鼓舞']]
 ];
 const locked=new Set(['release','contact','catch','fs','tag','base']);
 for(const [group,bases,labels] of groups)for(let j=0;j<bases.length;j++){
  const b=bases[j],src=def[b];if(!src||!src.keys)throw Error('missing motion '+b);
  variants[b]=[];
  for(let i=0;i<20;i++){
   const id='v28_'+b+'_'+String(i+1).padStart(2,'0'),form=i%5,tempo=Math.floor(i/5);
   const amt=(form-2)*.055,tw=(tempo-1.5)*.045;
   const keys=src.keys.map(k=>{
    const q=copy(k),p=q.p||{},dur=src.dur||1500,t=k.t/dur;
    // Keep release/catch/contact and planted foot positions, vary pre/post body motion.
    let w=Math.sin(Math.PI*clamp(t,0,1));
    for(const e of src.ev||[])if(locked.has(e.k))w*=clamp(Math.abs(k.t-e.t)/180,0,1);
    if(p.torso){p.torso[0]+=amt*w;p.torso[1]+=tw*w;}
    if(p.hips){p.hips[0]+=amt*.35*w;p.hips[2]+=tw*.45*w;}
    if(p.head){p.head[0]+=amt*.45*w;p.head[1]+=tw*1.4*w;}
    if(p.dy!=null)p.dy+=amt*.22*w;
    if(group==='演出'&&p.rSh&&p.lSh){p.rSh[0]+=amt*3*w;p.lSh[0]-=tw*3*w;}
    q.p=p;return q;
   });
   def[id]=Object.assign({},src,{keys,variantOf:b,generated:true});
   variants[b].push(id);motion.push({id,group,base:b,label:labels[j]+' '+['低重心','やや低め','標準','伸び','高重心'][form]+' / '+['内向','中央寄り','外向','大きめ'][tempo]});
  }
 }
 const locations=[
 ['school',10,'学校', ['校庭','河川敷','丘陵','住宅街','海辺','農村','山間','学園','郊外','練習場']],
 ['local',12,'地方', ['市民','県営','海浜','緑地','運動公園','山麓','総合','河川公園','森林','臨海','北部','南部']],
 ['city',8,'都市', ['中央','東部','西部','ベイ','新都心','メトロ','城北','都市公園']],
 ['national',3,'全国', ['大銀傘','緑風','蒼天']],
 ['indoor',3,'屋内', ['全天候','アーチ','ドーム']]
 ];
 const venues=[];const palettes=[['#51715f','#73877c','#334d40'],['#5e7291','#8a9299','#354b66'],['#9b7656','#a49783','#664c35'],['#657c83','#909a9b','#3e565d'],['#7b8270','#a5aaa0','#434b3d'],['#5a7967','#9ba4a0','#385b45']];
 for(const [type,n,region,names] of locations)for(let i=0;i<n;i++){
  const p=palettes[i%palettes.length],tier={school:0,local:1,city:2,national:3,indoor:2}[type];
  venues.push({id:type+'_'+String(i+1).padStart(2,'0'),type,name:region+'・'+names[i]+'球場',tier,rows:[3+i%4,9+i%6,16+i%6,25+i%5,12+i%5][['school','local','city','national','indoor'].indexOf(type)],ofRows:[0,i%4,7+i%6,18+i%5,8+i%4][['school','local','city','national','indoor'].indexOf(type)],roof:tier>=2||type==='local'&&i%3===0,palette:p,lights:tier===0?0:tier===1?4:6,seed:hash(type+i),layout:i%3});
 }
 function physique(p){const h=clamp(Number(p&&p.height)||175,150,195),weight=clamp(Number(p&&p.weight)||70,45,105);const bmi=weight/((h/100)**2),width=clamp(Math.sqrt(bmi/22.85),.91,1.13);return {height:h,weight,x:width,y:h/175,z:clamp(width*.97+.03,.91,1.12)};}
 const choose=(base,seed)=>{const a=variants[base];return a?a[hash(seed)%a.length]:base;};
 return {motion,venues,variants,physique,choose,hash};
})(MODEF,MOPOSE);
