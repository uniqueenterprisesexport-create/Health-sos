import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.HEALTH_SOS_DB=':memory:';
const {server}=await import('../server.mjs');
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base=`http://127.0.0.1:${server.address().port}`;
async function req(path,body,token){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
test('API sessions, role enforcement, optimistic concurrency, privacy controls',async()=>{
 try{
  assert.equal((await req('/api/health')).data.mode,'sqlite');assert.equal((await req('/api/state')).status,401);
  const {token}= (await req('/api/session',{role:'patient'})).data;const initial=(await req('/api/state',undefined,token)).data;
  const created=await req('/api/action',{revision:initial.revision,action:'incident.create',payload:{name:'Demo',lat:28.61,lon:77.2}},token);assert.equal(created.status,200);
  const stale=await req('/api/action',{revision:initial.revision,action:'incident.create',payload:{lat:28.61,lon:77.2}},token);assert.equal(stale.status,409);
  const blocked=await req('/api/action',{revision:created.data.state.revision,action:'settlement.run',payload:{}},token);assert.equal(blocked.status,400);
  assert.equal((await req('/api/reset',{},token)).status,403);
  assert.equal((await req('/api/scene',{image:'data:image/jpeg;base64,AAAA',consent:false},token)).status,400);
  assert.equal((await req('/api/hospitals?lat=999&lon=0')).status,400);
  const cross=await fetch(base+'/api/session',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:JSON.stringify({role:'government'})});assert.equal(cross.status,403);
  const staticPage=await fetch(base+'/');assert.equal(staticPage.status,200);assert.ok((await staticPage.text()).includes('Health SOS'));
 }finally{await new Promise(ok=>server.close(ok));}
});
