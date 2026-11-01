/* オフライン用サービスワーカー：本体をキャッシュし、更新は裏で取得 */
const VERSION='20261101182241';
const CACHE='hsb-'+VERSION;
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const ASSETS=['./assets/cap.jpg','./assets/cap_n.jpg','./assets/catcher.jpg','./assets/catcher_n.jpg','./assets/eye.jpg','./assets/eye_face1.jpg','./assets/gear.glb','./assets/hand_mask.png','./assets/head_ao.png','./assets/helmet.png','./assets/player.glb','./assets/skin.jpg','./assets/skin_face1.jpg','./assets/uni_dirt.jpg','./assets/uni_layers.png','./assets/uni_mask.png','./assets/uni_normal.jpg','./assets/uni_shade.jpg','./assets/uni_zones.png'];/* 選手モデル・テクスチャ：インストール時はベストエフォート、以後はキャッシュ優先 */
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL).then(()=>Promise.all(ASSETS.map(a=>c.add(a).catch(()=>{}))))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
 if(url.origin!==location.origin){/* Googleフォントなど：ネット優先、失敗時はキャッシュ */e.respondWith(fetch(req).then(r=>{const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));return r;}).catch(()=>caches.match(req)));return;}
 e.respondWith(caches.match(req).then(hit=>{const net=fetch(req).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp));}return r;}).catch(()=>hit);return hit||net;}));});
