import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';

const dist=new URL('../dist/',import.meta.url);
const source=filename=>readFileSync(new URL(filename,dist),'utf8');
function boot(navigator={},installed=false,initial=[]) {
  const classes=new Set(initial),events=new Map();
  const window={navigator,matchMedia:()=>({matches:installed}),addEventListener:(name,fn)=>events.set(name,fn)};
  const document={documentElement:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}},getElementById:()=>null};
  vm.runInNewContext(source('startup.js'),{window,document,navigator,localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
  return classes;
}
test('webapp iPhone : le mode installé active la correction même sans display-mode',()=>{
  assert.ok(boot({standalone:true,userAgent:'iPhone'}).has('ios-standalone'));
});
test('webapp récente : display-mode est reconnu sur iPhone et iPad avec UA desktop',()=>{
  assert.ok(boot({standalone:false,userAgent:'Mozilla/5.0 (iPhone)'},true).has('ios-standalone'));
  assert.ok(boot({userAgent:'Mozilla/5.0 (Macintosh)',platform:'MacIntel',maxTouchPoints:5},true).has('ios-standalone'));
});
test('Safari normal conserve son rendu et enlève un indicateur de mode installé périmé',()=>{
  assert.equal(boot({standalone:false,userAgent:'iPhone'},false,['ios-standalone']).has('ios-standalone'),false);
});
test('les installations Android et desktop ne reçoivent pas le traitement iOS',()=>{
  for(const navigator of [{userAgent:'Android',platform:'Linux armv8l'},{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0},{userAgent:'Windows',platform:'Win32'}])assert.equal(boot(navigator,true).has('ios-standalone'),false);
});

function scrollHeaderFixture() {
  const classes=new Set(),listeners=new Map(),phone={scrollTop:0},main={scrollTop:0};
  const window={navigator:{standalone:true,userAgent:'iPhone'},scrollY:0,matchMedia:()=>({matches:false}),addEventListener(name,callback,options){const list=listeners.get(name)||[];list.push({callback,options});listeners.set(name,list);}};
  const document={documentElement:{scrollTop:0,classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}},body:{scrollTop:0},scrollingElement:{scrollTop:0},getElementById:()=>null,querySelectorAll:()=>[phone,main]};
  vm.runInNewContext(source('startup.js'),{window,document,localStorage:{getItem:()=>null},setTimeout:()=>0,clearTimeout(){}});
  const fire=name=>listeners.get(name)?.forEach(listener=>listener.callback());
  return {classes,window,document,phone,main,fire,listeners};
}
test('header : opaque en haut, flouté pendant le défilement, restauré au retour en haut',()=>{
  const f=scrollHeaderFixture();assert.ok(f.classes.has('ios-standalone'));assert.equal(f.classes.has('header-scrolled'),false);
  f.window.scrollY=50;f.fire('scroll');assert.equal(f.classes.has('header-scrolled'),true);
  f.window.scrollY=0;f.fire('scroll');assert.equal(f.classes.has('header-scrolled'),false);
  f.window.scrollY=90;f.fire('pageshow');assert.equal(f.classes.has('header-scrolled'),true);
});
test('header : les défilements de la racine et des conteneurs sont reconnus même avec scrollY à zéro',()=>{
  const f=scrollHeaderFixture();assert.equal(f.listeners.get('scroll')[0].options.capture,true);assert.equal(f.listeners.get('scroll')[0].options.passive,true);
  for(const surface of [f.document.scrollingElement,f.document.documentElement,f.document.body,f.phone,f.main]){
    surface.scrollTop=70;f.fire('scroll');assert.equal(f.classes.has('header-scrolled'),true);
    surface.scrollTop=0;f.fire('scroll');assert.equal(f.classes.has('header-scrolled'),false);
  }
});

function dependencyURLs() {
  const html=source('index.html'),urls=new Set([...html.matchAll(/(?:src|href)="(\.\/[^"\s]+)"/g)].map(match=>match[1]));
  const queue=[...urls].filter(url=>url.split('?')[0].endsWith('.js')),seen=new Set();
  while(queue.length){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    const code=source(url.split('?')[0]);
    for(const match of code.matchAll(/(?:from\s+|import\s*)['"](\.\/[^'"]+)['"]/g)){urls.add(match[1]);queue.push(match[1]);}
  }
  const manifest=JSON.parse(source('manifest.webmanifest'));manifest.icons.forEach(icon=>urls.add(icon.src));
  return [...urls];
}
async function installedWorker() {
  const events=new Map(),cached=new Set(),deleted=[],origin='https://flex.test';let claimed=false;
  const self={location:{origin},addEventListener:(name,fn)=>events.set(name,fn),skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}};
  let currentCache='';
  const caches={open:async name=>{currentCache=name;return {addAll:async files=>{files.forEach(file=>cached.add(file));},put:async()=>{}};},keys:async()=>['flex-v12','flex-v16',currentCache],delete:async name=>{deleted.push(name);return true;},match:async request=>{const url=typeof request==='string'?request:'./'+new URL(request.url).pathname.slice(1)+new URL(request.url).search;return cached.has(url)?{status:200,url}:undefined;}};
  vm.runInNewContext(source('sw.js'),{self,caches,URL,Response,fetch:async()=>{throw Error('Offline');}});
  let install;events.get('install')({waitUntil:promise=>{install=promise;}});await install;
  return {events,cached,deleted,get currentCache(){return currentCache;},get claimed(){return claimed;},origin};
}
test('la page et tous ses imports correspondent aux URL réellement préchargées hors ligne',async()=>{
  const worker=await installedWorker();
  for(const url of dependencyURLs()){
    assert.ok(existsSync(new URL(url.split('?')[0],dist)),`Fichier absent : ${url}`);
    assert.ok(worker.cached.has(url),`URL absente du préchargement : ${url}`);
    let response;worker.events.get('fetch')({request:{method:'GET',url:new URL(url,worker.origin+'/').href,mode:'cors'},respondWith:promise=>{response=promise;}});
    assert.equal((await response).status,200,`Dépendance indisponible hors ligne : ${url}`);
  }
});
test('l’activation retire les anciens caches sans supprimer le cache courant',async()=>{
  const worker=await installedWorker();let activation;
  worker.events.get('activate')({waitUntil:promise=>{activation=promise;}});await activation;
  assert.deepEqual(worker.deleted,['flex-v12','flex-v16']);assert.equal(worker.claimed,true);assert.ok(!worker.deleted.includes(worker.currentCache));
});
test('une navigation inconnue hors ligne retrouve la page de démarrage',async()=>{
  const worker=await installedWorker();let response;
  worker.events.get('fetch')({request:{method:'GET',url:worker.origin+'/saved-route',mode:'navigate'},respondWith:promise=>{response=promise;}});
  const result=await response;assert.equal(result.status,200);assert.equal(result.url,'./index.html');
});
