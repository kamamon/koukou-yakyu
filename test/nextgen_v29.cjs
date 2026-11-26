const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const paths=read('build.sh').match(/JS="\$\(cat ([^)]+)\)"/)[1].split(' '),js=paths.map(read).join('\n');
new Function(js);const anchor=js.lastIndexOf('(function(){const hot=window.claude');assert.ok(anchor>0);
const noop=()=>{},ctx=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:s=>({width:String(s).length*10}),createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),createPattern:()=>null},{get:(o,k)=>k in o?o[k]:noop,set:(o,k,v)=>(o[k]=v,true)});
const doc={addEventListener:noop,removeEventListener:noop,querySelector:()=>null,querySelectorAll:()=>[],documentElement:{style:{}},body:{style:{}},createElement:()=>({getContext:()=>ctx,style:{},addEventListener:noop}),hidden:false},win={addEventListener:noop,removeEventListener:noop,devicePixelRatio:1},store={getItem:()=>null,setItem:noop,removeItem:noop},THREE=require(path.join(root,'vendor/three.min.js')),data=JSON.parse(read('assets/player_deform_v29.json'));
const probe=String.raw`
{
 G={settings:{action:{}}};
 let clips=0,keys=0;for(const id of V29_CAPTURE_IDS){const c=moClip(id);if(!c)throw Error('missing '+id);keys+=MODEF[id].keys.length;for(let i=0;i<=20;i++){const p=moClipAt(c,c.dur*i/20,{});if(!Object.values(p).every(x=>Array.isArray(x)?x.every(Number.isFinite):Number.isFinite(x)))throw Error('nonfinite '+id);}clips++;}
 const C=V29Collision,a={t:0,p:[0,-1,0],bat:[[-1,0,0],[1,0,0]]},b={t:10,p:[0,1,0],bat:[[-1,0,0],[1,0,0]]};const h=C.sweep(a,b,[.03,.03]);if(!h||Math.abs(h.time-4.66625)>.001||C.sweep({...a,p:[0,-1,1]},{...b,p:[0,1,1]},[.03,.03]))throw Error('CCD');
 const L=V29Live,s=L.create({path:{T:1,land:{t:.05},pts:[{t:0,x:0,y:1,z:.0366},{t:1,x:0,y:1,z:.0366}]},fielders:[{key:'投',pos:[0,1],arm:30,speed:7},{key:'一',pos:L.B[1],arm:30,speed:7}],runners:[{id:'b',from:0,speed:7}],side:'pit',air:false});L.step(s);if(s.ball.mode!=='held')throw Error('catch');L.command(s,1);for(let i=0;i<3360&&!s.done;i++)L.step(s);const r=L.result(s);if(!s.done||r.res!=='GO'||r.outs.length!==1)throw Error('force out');
 let nRecords=0;const used=new Set();for(const kind of ['body','uniform']){const q=V29Deform.lookup(data,kind);for(const p of q.points){if(Math.abs(p.w.reduce((x,y)=>x+y,0)-1)>.00001||p.j.some(i=>i>=83))throw Error('weight');for(let i=0;i<4;i++)if(p.w[i]>0)used.add(p.j[i]);}nRecords+=q.points.length;}
 if(data.control.length+data.bones.length!==83)throw Error('rig');
 newGame({name:'検証高校',pref:'神奈川',type:'公立',size:'中',hensachi:55});
 let matches=0,steps=0,results=[];for(let i=0;i<10;i++){const m=new Match(cpuRoster('A',55,'神奈川'),cpuRoster('B',55,'神奈川'),{mercy:true,importance:1});m.autoUntil='end';let n=0;while(!m.done&&n++<3000)m.step();if(!m.done)throw Error('match timeout');matches++;steps+=n;results.push(m.score);}
 return {clips,keys,ccdMs:h.time,live:r.res,records:nRecords,weightedBones:used.size,matches,steps,results};
}
`;
const report=new Function('window','document','navigator','localStorage','THREE','performance','data',js.slice(0,anchor)+'\n'+probe)(win,doc,{},store,THREE,{now:()=>0},data);
assert.equal(report.clips,6);assert.equal(report.matches,10);assert.equal(report.records,16054);assert.equal(report.weightedBones,83);
console.log(JSON.stringify(report,null,2));
