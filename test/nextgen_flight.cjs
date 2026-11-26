const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const P=vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/03c_phys.js'),'utf8')+'\n({phHitPath,phPitchPath})');
const d=wind=>P.phHitPath(145,32,0,null,{wind}).d;assert.ok(d([0,5,0])>d([0,0,0]));assert.ok(d([0,0,0])>d([0,-5,0]));
const p=P.phPitchPath({name:'ストレート',v:130,x:0,y:0,hs:1,n:1});assert.ok(p.T>.3&&p.T<.8);assert.ok(p.err.every(e=>Math.abs(e)<.01));console.log('Flight physics passed');
