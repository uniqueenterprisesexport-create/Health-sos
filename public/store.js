import {initialState,transition,roles,sweepInventory,haversine,normalizeState} from './model.js';
let server=false, cache=null, session=null, db=null;
const channel=typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('health-sos'):null;
const listeners=new Set();
channel?.addEventListener('message',()=>listeners.forEach(fn=>fn()));
export function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
function openDB(){return new Promise((resolve,reject)=>{const q=indexedDB.open('health-sos-prototype',1);q.onupgradeneeded=()=>q.result.createObjectStore('state');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});}
function localRead(){return new Promise((resolve,reject)=>{const q=db.transaction('state').objectStore('state').get('current');q.onsuccess=()=>resolve(q.result?normalizeState(q.result):q.result);q.onerror=()=>reject(q.error);});}
async function localInit(){db=await openDB();const existing=await localRead();if(existing)return existing;return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),q=store.get('current');let s;q.onsuccess=()=>{try{s=q.result||initialState();if(!q.result)store.put(s,'current');}catch(error){tx.abort();reject(error);}};tx.oncomplete=()=>resolve(s);tx.onerror=()=>reject(tx.error);});}
async function request(path,options={}){const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed');return data;}
export async function init(){
  try{const r=await fetch('/api/health',{signal:AbortSignal.timeout(1800)});server=r.ok&&(await r.json()).mode==='sqlite';}catch{}
  if(server){session=await request('/api/session',{method:'POST',body:JSON.stringify({role:'patient'})});cache=await request('/api/state',{headers:{Authorization:`Bearer ${session.token}`}});}
  else {cache=await localInit();if(sweepInventory(structuredClone(cache))){await act('stock.scan',{},'pharmacy');}}return cache;
}
export const mode=()=>server?'sqlite':'browser';
export async function setRole(role){if(!roles.includes(role))throw Error('Unknown role');if(server)session=await request('/api/session',{method:'POST',body:JSON.stringify({role})});}
export async function read(){cache=server?await request('/api/state',{headers:{Authorization:`Bearer ${session.token}`}}):await localRead();return cache;}
export async function act(action,payload,role){
  if(server){const data=await request('/api/action',{method:'POST',headers:{Authorization:`Bearer ${session.token}`},body:JSON.stringify({action,payload,revision:cache.revision})});cache=data.state;channel?.postMessage('update');return data;}
  return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let result;const q=store.get('current');q.onsuccess=()=>{try{result=transition(q.result,action,payload,role);store.put(result.state,'current');}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>{cache=result.state;channel?.postMessage('update');resolve(result);};tx.onerror=()=>reject(tx.error||Error('Storage unavailable'));});
}
export async function reset(){if(server){cache=await request('/api/reset',{method:'POST',headers:{Authorization:`Bearer ${session.token}`},body:'{}'});}else{cache=initialState();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(cache,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}channel?.postMessage('update');return cache;}
export async function cameraAnalyze(image){if(!server)return null;return request('/api/vision',{method:'POST',headers:{Authorization:`Bearer ${session.token}`},body:JSON.stringify({image})});}
export async function describeScene(image){return request('/api/scene',{method:'POST',headers:{...(session?{Authorization:`Bearer ${session.token}`}:{})},body:JSON.stringify({image,consent:true})});}
export async function nearby(lat,lon,radius=8000){
  if(server){try{return await nominatimNearby(lat,lon,radius);}catch{}try{return await request(`/api/hospitals?lat=${lat}&lon=${lon}&radius=${radius}`);}catch{ /* Try the browser network if the demo server cannot reach the directory. */ }}
  try{return await nominatimNearby(lat,lon,radius);}catch{}
  const query=`[out:json][timeout:18];nwr["amenity"="hospital"](around:${radius},${lat},${lon});out center tags;`;
  let lastError;for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
    try{const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(22000)});if(!r.ok)throw Error(`Directory returned ${r.status}`);const data=await r.json();return {source:'OpenStreetMap / Overpass',at:new Date().toISOString(),hospitals:mapOSM(data)};}catch(e){lastError=e;}}
  throw Error(`Live hospital directory unavailable. Check your internet connection; no fictional results substituted. ${lastError?.message||''}`);
}
export function mapOSM(data){return (data.elements||[]).filter(e=>e.tags?.name&&(e.lat!==undefined||e.center)).map(e=>({id:`osm-${e.type}-${e.id}`,name:e.tags.name,lat:e.lat??e.center.lat,lon:e.lon??e.center.lon,phone:e.tags['contact:phone']||e.tags.phone||'',address:[e.tags['addr:street'],e.tags['addr:city']].filter(Boolean).join(', '),website:e.tags.website||e.tags['contact:website']||'',osm:`https://www.openstreetmap.org/${e.type}/${e.id}`}));}

export async function nominatimNearby(lat,lon,radius=8000){
  const dy=radius/111320,dx=radius/(111320*Math.max(.05,Math.cos(lat*Math.PI/180)));
  const viewbox=[Math.max(-180,lon-dx),Math.min(90,lat+dy),Math.min(180,lon+dx),Math.max(-90,lat-dy)].join(',');
  const url='https://nominatim.openstreetmap.org/search?'+new URLSearchParams({format:'jsonv2',q:'[hospital]',viewbox,bounded:'1',limit:'40',extratags:'1'});
  const headers=typeof window==='undefined'?{'User-Agent':'HealthSOS-NEEEV-Prototype/0.1 (https://github.com/uniqueenterprisesexport-create/Health-sos)'}:{};
  const r=await fetch(url,{headers,signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error('Hospital directory returned '+r.status);
  const rows=await r.json();const hospitals=rows.filter(e=>e.type==='hospital'||e.addresstype==='hospital').map(e=>({id:`osm-${e.osm_type}-${e.osm_id}`,name:e.name||e.display_name.split(',')[0],lat:Number(e.lat),lon:Number(e.lon),phone:e.extratags?.phone||e.extratags?.['contact:phone']||'',address:e.display_name,osm:`https://www.openstreetmap.org/${e.osm_type}/${e.osm_id}`})).filter(h=>haversine({lat,lon},h)<=radius/1000).sort((a,b)=>haversine({lat,lon},a)-haversine({lat,lon},b));
  return {source:'OpenStreetMap / Nominatim (up to 40 matching listings; not exhaustive)',at:new Date().toISOString(),hospitals};
}
