const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/08o_ui_nextgen.js'),'utf8');
const boundary=source.indexOf('(function ngInstall(');assert.ok(boundary>0);const C=vm.runInNewContext(source.slice(0,boundary)+'\nNGCore');
assert.equal(C.stick(.05,.04).join(','),'0,0');assert.ok(Math.abs(Math.hypot(...C.stick(1,1))-1)<1e-9);
const pts=[{t:0,x:0,y:0,z:2},{t:100,x:0,y:2,z:.02}];const tail=C.groundTail(pts,8,1);assert.ok(Math.abs(tail.at(-1).y-10)<1e-6);assert.ok(tail.every((p,i)=>p.z>=.0366&&(!i||p.t>tail[i-1].t)));assert.equal(tail.at(-1).z,.0366);
assert.equal(C.wall([{x:0,y:9,z:5},{x:0,y:11,z:4}],10).cleared,true);assert.equal(C.wall([{x:0,y:9,z:2},{x:0,y:11,z:2}],10).cleared,false);assert.equal(C.wall([{x:0,y:1,z:1},{x:0,y:2,z:0}],10),null);
assert.equal(C.random(42)(),C.random(42)());console.log('NGCore tests passed');
