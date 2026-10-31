// Shared domain logic: browser sandbox and SQLite server run the same transitions.
export const roles = ['patient', 'hospital', 'dispatch', 'pharmacy', 'police', 'government'];
export const uid = (prefix) => {
  // randomUUID requires HTTPS; getRandomValues also supports local HTTP previews.
  const crypto=globalThis.crypto;
  const value=typeof crypto?.randomUUID==='function'?crypto.randomUUID().slice(0,8):Array.from(crypto.getRandomValues(new Uint8Array(4)),x=>x.toString(16).padStart(2,'0')).join('');
  return `${prefix}-${value.toUpperCase()}`;
};
const iso = () => new Date().toISOString();
export function initialState() {
  const now = iso(), day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return {
    schemaVersion:2, revision: 0, createdAt: now,
    hospitals: [
      {id:'demo-north',sourceId:'osm-node-7130306819',name:'AIIMS Emergency',address:'Aurobindo Marg, New Delhi, Delhi',source:'OpenStreetMap',osm:'https://www.openstreetmap.org/node/7130306819',capacitySource:'preview',connected:false,lat:28.567441,lon:77.2096335,beds:8,occupied:3,capabilities:['Emergency','Trauma','CT','ICU'],participating:true,updatedAt:now},
      {id:'demo-east',sourceId:'osm-way-454523330',name:'Safdarjung Hospital',address:'Aurobindo Marg, New Delhi, Delhi',source:'OpenStreetMap',osm:'https://www.openstreetmap.org/way/454523330',capacitySource:'preview',connected:false,lat:28.5673381,lon:77.2049728,beds:6,occupied:2,capabilities:['Emergency','Trauma','CT'],participating:true,updatedAt:now},
      {id:'demo-west',sourceId:'osm-node-9295424879',name:'Indraprastha Apollo Hospital',address:'Mathura Road, New Delhi, Delhi',source:'OpenStreetMap',osm:'https://www.openstreetmap.org/node/9295424879',capacitySource:'preview',connected:false,lat:28.5408159,lon:77.2835195,beds:10,occupied:4,capabilities:['Emergency','ICU'],participating:true,updatedAt:now}
    ],
    incidents: [],
    ambulances: [{id:'AMB-01',label:'Unit 01 · Advanced life support',status:'available',incidentId:null},{id:'AMB-02',label:'Unit 02 · Basic life support',status:'available',incidentId:null}],
    medicines: [
      {id:'MED-01',name:'Sterile saline',batch:'SAL-2608',quantity:42,min:20,expiry:day(120),status:'active',hospitalId:'demo-north'},
      {id:'MED-02',name:'Sterile dressings',batch:'DRS-2610',quantity:6,min:25,expiry:day(45),status:'active',hospitalId:'demo-north'},
      {id:'MED-03',name:'Paracetamol',batch:'PCM-2501',quantity:18,min:20,expiry:day(-2),status:'quarantined',hospitalId:'demo-north'}
    ],
    orders: [], collections: [],
    tariffs:[{id:'TAR-01',code:'ER-ASSESS',name:'Emergency assessment',amount:500,state:'Delhi',scheme:'Workspace tariff',version:1,effective:day(-1)},{id:'TAR-02',code:'WARD-DAY',name:'Ward day',amount:1200,state:'Delhi',scheme:'Workspace tariff',version:1,effective:day(-1)}],
    appointments: [], notifications: [], claims: [], settlements: [], reports: [], audit: [{id:uid('EVT'),at:now,role:'system',action:'Workspace ready',detail:'Hospital names are directory records. Capacity, dispatch, police and payment workflows run in the preview environment.'}]
  };
}
export function freeBeds(state, h, excludingId) {
  const holds=state.incidents.filter(i=>i.id!==excludingId&&i.hospitalId===h.id&&['reserved','accepted','en_route','reroute_pending'].includes(i.status)).length;
  if(!Number.isInteger(h.beds)||!Number.isInteger(h.occupied))return 0;
  return Math.max(0,h.beds-h.occupied-holds);
}
export function isHospitalListing(name){const value=String(name||'').replace(/\./g,'');return /hospital|medical|clinic|health|trauma|emergency|nursing|aiims|medicity|hospice|अस्पताल|चिकित्सा|स्वास्थ्य/i.test(value)&&!/\b(bus stop|back gate|entrance|gate [0-9])\b/i.test(value);}
export function haversine(a,b) {
  const rad=x=>x*Math.PI/180, dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);
  const v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
const required=(v,name)=>{if(typeof v!=='string'||!v.trim()||v.length>1500)throw Error(`${name} is required (maximum 1500 characters).`);return v.trim();};
const integer=(v,min,max,name)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} must be a whole number from ${min} to ${max}.`);return n;};
function coord(v,min,max,name){if(v===''||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(`Valid ${name} required.`);return Number(v);}
const find=(items,id,name)=>{const x=items.find(i=>i.id===id);if(!x)throw Error(`${name} not found.`);return x;};
const allow=(role,list)=>{if(!list.includes(role))throw Error('This action is unavailable in this workspace.');};
export function candidates(state,incident) {
  return state.hospitals.filter(h=>h.participating&&isHospitalListing(h.name)&&h.id!==incident.hospitalId&&h.capabilities.includes(incident.need)&&freeBeds(state,h)>0).map(h=>({...h,distance:haversine(incident,h)})).sort((a,b)=>a.distance-b.distance);
}
export function normalizeState(state){
  const s={...state,appointments:state.appointments||[],notifications:state.notifications||[]};
  if(!s.schemaVersion||s.schemaVersion<2){
    const seeded=initialState().hospitals;
    s.hospitals=s.hospitals.map(h=>{const known=seeded.find(n=>n.id===h.id);return known?{...h,...known,beds:h.beds,occupied:h.occupied}:h;});
    s.incidents=s.incidents.map(i=>{if(i.status==='requested'&&i.proposedHospitalId){return {...i,hospitalId:i.proposedHospitalId,proposedHospitalId:null,status:'reserved',reservationScope:'preview',externalConfirmation:false};}return {...i,reservationScope:i.reservationScope||'preview',externalConfirmation:false};});
    s.schemaVersion=2;
  }
  return s;
}
function reserve(s,i,preferred){
  const eligible=s.hospitals.filter(h=>h.participating&&isHospitalListing(h.name)&&h.capabilities.includes(i.need)&&freeBeds(s,h,i.id)>0).sort((a,b)=>haversine(i,a)-haversine(i,b));
  const h=preferred?eligible.find(h=>h.id===preferred):eligible[0];
  if(!h)return false;
  i.hospitalId=h.id;i.proposedHospitalId=null;i.status=i.ambulanceId?'en_route':'reserved';i.reservationScope='preview';i.externalConfirmation=false;
  i.events.push({at:iso(),text:`Capacity automatically reserved in this workspace at ${h.name}. External admission is not confirmed.`});return true;
}
export function transition(current, action, p={}, role='patient') {
  if(!roles.includes(role))throw Error('Unknown workspace.');
  const s=normalizeState(structuredClone(current));let detail='',result=null;
  switch(action) {
    case 'incident.create': {
      allow(role,['patient','hospital','dispatch','police']);
      const i={id:uid('SOS'),name:required(p.name||'Unidentified patient','Patient label'),lat:coord(p.lat,-90,90,'latitude'),lon:coord(p.lon,-180,180,'longitude'),address:String(p.address||'Location shared').slice(0,500),landmark:String(p.landmark||'').slice(0,300),incidentType:p.incidentType||'road_accident',contact:String(p.contact||'').slice(0,30),notes:String(p.notes||'').slice(0,1500),need:p.need||'Emergency',status:'reported',hospitalId:null,proposedHospitalId:null,ambulanceId:null,createdAt:iso(),events:[],observations:p.observations||null,consent:!!p.consent};
      if(!['Emergency','Trauma','CT','ICU'].includes(i.need))throw Error('Unsupported capability.');
      i.events.push({at:iso(),text:'Incident saved. Call 112 to contact emergency services.'});
      const selected=p.preferredHospitalId?s.hospitals.find(h=>h.id===p.preferredHospitalId):null;
      const inRange=s.hospitals.filter(h=>isHospitalListing(h.name)&&haversine(i,h)<=30);
      if(p.autoRequest!==false&&(selected||inRange.length)){
        const target=selected||inRange.filter(h=>h.participating&&freeBeds(s,h)>0).sort((a,b)=>haversine(i,a)-haversine(i,b))[0]||inRange.sort((a,b)=>haversine(i,a)-haversine(i,b))[0];
        if(target&&!reserve(s,i,target.id)){i.hospitalId=target.id;i.status='destination_selected';i.reservationScope='unconfirmed';i.externalConfirmation=false;i.events.push({at:iso(),text:`Destination selected: ${target.name}. Call the hospital to confirm availability.`});}
      }
      if(i.incidentType==='road_accident')s.reports.unshift({id:uid('CASE'),incidentId:i.id,status:'intake',summary:i.notes||'Road accident notification',station:'',officer:'',firDraft:'',officialReference:null,createdAt:iso(),events:[{at:iso(),text:'Case intake saved locally. No police notification sent.'}],externalSubmission:false});
      s.incidents.unshift(i);result=i.id;detail=i.id;break;
    }
    case 'incident.reserve':
    case 'incident.request': {
      allow(role,['patient','dispatch','hospital']);const i=find(s.incidents,p.id,'Incident');
      if(!['reported','destination_selected','reserved'].includes(i.status)||i.ambulanceId)throw Error('This journey is already in progress. The hospital can reroute if needed.');
      if(!reserve(s,i,p.hospitalId))throw Error('No available workspace capacity. Select a real hospital and call to confirm availability.');detail=i.id;break;
    }
    case 'directory.sync': {
      if(!Array.isArray(p.hospitals)||p.hospitals.length>60)throw Error('Invalid hospital directory response.');
      for(const row of p.hospitals){
        if(typeof row.id!=='string'||!/^osm-(node|way|relation)-\d+$/.test(row.id))continue;
        const lat=coord(row.lat,-90,90,'latitude'),lon=coord(row.lon,-180,180,'longitude'),name=required(row.name,'Hospital name');if(!isHospitalListing(name))continue;
        const existing=s.hospitals.find(h=>h.id===row.id||h.sourceId===row.id);
        const entry={name,lat,lon,address:String(row.address||'').slice(0,700),phone:String(row.phone||'').slice(0,100),osm:`https://www.openstreetmap.org/${row.id.split('-')[1]}/${row.id.split('-')[2]}`,source:'OpenStreetMap',sourceId:row.id,directoryUpdatedAt:iso()};
        if(existing)Object.assign(existing,entry);else s.hospitals.push({id:row.id,...entry,beds:8,occupied:0,capabilities:['Emergency'],participating:true,capacitySource:'preview',connected:false,updatedAt:iso()});
      }detail='Real hospital directory updated';break;
    }
    case 'hospital.capacity': {
      allow(role,['hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      const beds=integer(p.beds,0,1000,'Staffed beds'),occupied=integer(p.occupied,0,1000,'Occupied beds');
      if(occupied>beds)throw Error('Occupied beds cannot exceed staffed beds.');
      h.beds=beds;h.occupied=occupied;h.updatedAt=iso();h.participating=true;h.capacitySource='preview';if(!h.capabilities.includes('Emergency'))h.capabilities.push('Emergency');detail=`${h.name}: ${occupied}/${beds}`;break;
    }
    case 'hospital.walkin': {
      allow(role,['hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      if(h.occupied>=h.beds)throw Error('No physical capacity. Escalate to clinical staff.');
      h.occupied++;h.updatedAt=iso();detail=`Walk-in at ${h.name}; review any affected commitments.`;break;
    }
    case 'incident.reroute': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');
      if(!['reserved','accepted','en_route','destination_selected'].includes(i.status))throw Error('Only an incoming patient can be rerouted.');
      const options=candidates(s,i),h=p.hospitalId?options.find(h=>h.id===p.hospitalId):options[0];
      if(!h)throw Error('No suitable alternative with workspace capacity. Current destination retained.');
      const previous=i.hospitalId;if(!reserve(s,i,h.id))throw Error('Capacity changed. Current destination retained.');
      i.events.push({at:iso(),text:`Hospital rerouted from ${s.hospitals.find(h=>h.id===previous)?.name||'previous destination'} to ${h.name}. New workspace reservation recorded.`});detail=i.id;break;
    }
    case 'dispatch.assign': {
      allow(role,['dispatch']);const i=find(s.incidents,p.id,'Incident'),a=find(s.ambulances,p.ambulanceId,'Ambulance');
      if(!['reported','reserved','accepted','destination_selected'].includes(i.status))throw Error('Incident cannot be assigned in its current state.');
      if(a.status!=='available'||i.ambulanceId)throw Error('Ambulance or incident is already assigned.');
      a.status='assigned';a.incidentId=i.id;i.ambulanceId=a.id;if(['accepted','reserved'].includes(i.status))i.status='en_route';
      i.events.push({at:iso(),text:`${a.id} assigned in this workspace. External dispatch is not connected.`});detail=i.id;break;
    }
    case 'incident.arrive': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');
      if(!['reserved','accepted','en_route'].includes(i.status))throw Error('A workspace reservation is required before recording handover.');
      const h=find(s.hospitals,i.hospitalId,'Hospital');if(h.occupied>=h.beds)throw Error('Capacity changed. Clinical escalation required.');
      h.occupied++;h.updatedAt=iso();i.status='arrived';i.receivedBy=required(p.receivedBy,'Receiving staff');i.events.push({at:iso(),text:`Handover received by ${i.receivedBy}.`});
      if(i.ambulanceId){const a=find(s.ambulances,i.ambulanceId,'Ambulance');a.status='available';a.incidentId=null;}detail=i.id;break;
    }
    case 'incident.discharge': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');if(i.status!=='arrived')throw Error('Only an admitted patient can be discharged.');
      const h=find(s.hospitals,i.hospitalId,'Hospital');h.occupied=Math.max(0,h.occupied-1);h.updatedAt=iso();i.status='discharged';i.events.push({at:iso(),text:'Discharge recorded.'});detail=i.id;break;
    }
    case 'appointment.create': {
      allow(role,['patient','hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      const when=required(p.when,'Appointment time');if(!Number.isFinite(Date.parse(when))||Date.parse(when)<Date.now())throw Error('Choose a future appointment time.');
      if(s.appointments.some(a=>a.hospitalId===h.id&&a.when===when&&a.status!=='cancelled'))throw Error('That slot is already requested. Choose another time.');
      const a={id:uid('OPD'),name:required(p.name||'Patient','Patient label'),hospitalId:h.id,when,department:required(p.department,'Department'),status:'requested'};
      s.appointments.unshift(a);result=a.id;detail=a.id;break;
    }
    case 'appointment.confirm': {
      allow(role,['hospital']);const a=find(s.appointments,p.id,'Appointment');if(a.status!=='requested')throw Error('No pending appointment.');a.status='confirmed';detail=a.id;break;
    }
    case 'family.share': {
      allow(role,['patient']);const i=find(s.incidents,p.id,'Incident');if(!p.consent)throw Error('Permission is required to prepare a family update.');
      const h=s.hospitals.find(h=>h.id===i.hospitalId);const n={id:uid('NOTE'),incidentId:i.id,createdAt:iso(),text:`Health SOS update for ${i.id}: ${i.status.replaceAll('_',' ')}. ${h?'Hospital: '+h.name+'.':'Hospital selection pending.'} This is a workspace record; external services have not been contacted.`,status:'prepared_not_sent'};
      s.notifications.unshift(n);detail=n.id;result=n.text;break;
    }
    case 'report.create': {
      allow(role,['patient','hospital','dispatch','police']);const i=find(s.incidents,p.id,'Incident');
      if(s.reports.some(r=>r.incidentId===i.id))throw Error('A police case already exists for this incident.');
      s.reports.unshift({id:uid('CASE'),incidentId:i.id,status:'intake',summary:required(p.summary||i.notes||'Incident requires review.','Summary'),station:'',officer:'',firDraft:'',officialReference:null,createdAt:iso(),events:[],externalSubmission:false});detail=i.id;break;
    }
    case 'police.update': {
      allow(role,['police']);const r=find(s.reports,p.id,'Police case');
      if(r.status==='closed')throw Error('Reopen the case before editing.');
      r.station=String(p.station||'').slice(0,200);r.officer=String(p.officer||'').slice(0,200);r.summary=required(p.summary,'Case summary');r.firDraft=String(p.firDraft||'').slice(0,8000);r.status=r.firDraft.trim()?'fir_draft':'under_review';r.updatedAt=iso();r.externalSubmission=false;
      (r.events??=[]).push({at:iso(),text:r.firDraft?'FIR draft saved for officer review. Nothing filed externally.':'Case details updated.'});detail=r.id;break;
    }
    case 'police.reference': {
      allow(role,['police']);const r=find(s.reports,p.id,'Police case');if(r.status==='closed')throw Error('Reopen the case first.');
      if(p.attestation!==true)throw Error('Confirm this reference was already issued by police.');
      r.officialReference=required(p.reference,'Issued reference');r.station=required(p.station,'Police station');r.officer=required(p.officer,'Recording officer');r.status='reference_recorded';r.referenceVerification='operator_reported';r.externalSubmission=false;
      (r.events??=[]).push({at:iso(),text:'Externally issued reference entered by operator. Health SOS did not file or verify it.'});detail=r.id;break;
    }
    case 'police.close': {
      allow(role,['police']);const r=find(s.reports,p.id,'Police case');if(r.status==='closed')throw Error('Case is already closed.');r.closureNote=required(p.note,'Closure note');r.status='closed';(r.events??=[]).push({at:iso(),text:'Case closed in this workspace: '+r.closureNote});detail=r.id;break;
    }
    case 'police.reopen': {
      allow(role,['police']);const r=find(s.reports,p.id,'Police case');if(r.status!=='closed')throw Error('Case is already open.');r.status=r.officialReference?'reference_recorded':r.firDraft?'fir_draft':'under_review';(r.events??=[]).push({at:iso(),text:'Case reopened.'});detail=r.id;break;
    }
    case 'stock.dispense': {
      allow(role,['pharmacy']);const m=find(s.medicines,p.id,'Stock'),q=integer(p.quantity,1,10000,'Quantity');
      if(m.status!=='active'||m.expiry<iso().slice(0,10))throw Error('Expired or quarantined stock cannot be dispensed.');
      if(q>m.quantity)throw Error('Insufficient stock.');m.quantity-=q;detail=`${m.name}: ${q} dispensed`;break;
    }
    case 'stock.scan': {
      allow(role,['pharmacy']);
      sweepInventory(s);detail='Expiry quarantine, collection and low-stock requests evaluated.';break;
    }
    case 'order.approve': {
      allow(role,['government']);const o=find(s.orders,p.id,'Order');if(o.status!=='requested')throw Error('Order is not pending.');o.status='approved';detail=o.id;break;
    }
    case 'order.receive': {
      allow(role,['pharmacy']);const o=find(s.orders,p.id,'Order');if(o.status!=='approved')throw Error('Supplier approval required.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(p.expiry)||p.expiry<=iso().slice(0,10)||!Number.isFinite(Date.parse(p.expiry)))throw Error('A valid future expiry date is required.');
      const m=find(s.medicines,o.medicineId,'Stock');const batch=required(p.batch,'New batch');
      if(s.medicines.some(x=>x.batch===batch&&x.name===m.name))throw Error('Batch already exists.');
      s.medicines.push({id:uid('MED'),name:m.name,batch,quantity:o.quantity,min:m.min,expiry:p.expiry,status:'active',hospitalId:m.hospitalId});o.status='received';detail=o.id;break;
    }
    case 'collection.complete': {
      allow(role,['government']);const c=find(s.collections,p.id,'Collection');if(c.status==='disposed')throw Error('Collection already completed.');
      const certificate=required(p.certificate,'Disposal certificate reference');const m=find(s.medicines,c.medicineId,'Stock');m.quantity=0;m.status='disposed';c.status='disposed';c.certificate=certificate;detail=`${c.id}; disposal certificate recorded in workspace`;break;
    }
    case 'tariff.save': {
      allow(role,['government']);const amount=integer(p.amount,0,10000000,'Tariff amount');
      const t={id:uid('TAR'),code:required(p.code,'Code'),name:required(p.name,'Service'),amount,state:required(p.state,'State'),scheme:required(p.scheme,'Agreement'),version:1,effective:iso().slice(0,10)};
      const prior=s.tariffs.filter(x=>x.code===t.code&&x.state===t.state&&x.scheme===t.scheme);t.version=1+Math.max(0,...prior.map(x=>x.version));s.tariffs.push(t);detail=`${t.code} v${t.version}`;break;
    }
    case 'claim.create': {
      allow(role,['hospital']);const i=find(s.incidents,p.incidentId,'Incident');if(!['arrived','discharged'].includes(i.status))throw Error('Patient must arrive before billing.');
      const t=find(s.tariffs,p.tariffId,'Tariff');if(s.claims.some(c=>c.incidentId===i.id&&c.tariff.id===t.id))throw Error('This tariff has already been billed for the incident.');
      const latest=s.tariffs.filter(x=>x.code===t.code&&x.state===t.state&&x.scheme===t.scheme).sort((a,b)=>b.version-a.version)[0];if(latest.id!==t.id)throw Error('Use the current tariff version.');
      s.claims.unshift({id:uid('CLM'),incidentId:i.id,hospitalId:i.hospitalId,tariff:structuredClone(t),amount:t.amount,status:'submitted',createdAt:iso()});detail=i.id;break;
    }
    case 'claim.approve': {allow(role,['government']);const c=find(s.claims,p.id,'Claim');if(c.status!=='submitted')throw Error('Claim is not pending.');c.status='approved';detail=c.id;break;}
    case 'settlement.run': {
      allow(role,['government']);const approved=s.claims.filter(c=>c.status==='approved');if(!approved.length)throw Error('No approved claims to settle.');
      const batch={id:uid('PAY'),createdAt:iso(),amount:approved.reduce((n,c)=>n+c.amount,0),claimIds:approved.map(c=>c.id),status:'simulated_paid',cadence:'weekly',transfers:[]};
      for(const c of approved){c.status='simulated_paid';let transfer=batch.transfers.find(x=>x.hospitalId===c.hospitalId);if(!transfer){transfer={hospitalId:c.hospitalId,amount:0};batch.transfers.push(transfer);}transfer.amount+=c.amount;}
      s.settlements.unshift(batch);detail=`${batch.id}; no money moved`;break;
    }
    default:throw Error('Unknown action.');
  }
  sweepInventory(s);
  s.revision++;s.audit.unshift({id:uid('EVT'),at:iso(),role,action,detail});s.audit=s.audit.slice(0,1000);
  return {state:s,result};
}
export function sweepInventory(s) {
  const before=JSON.stringify([s.medicines,s.orders,s.collections]);
  for(const m of s.medicines){
    if(m.status==='disposed')continue;
    if(m.expiry<iso().slice(0,10))m.status='quarantined';
    if(m.status==='quarantined'&&m.quantity>0&&!s.collections.some(c=>c.medicineId===m.id&&c.status!=='disposed'))s.collections.unshift({id:uid('COL'),medicineId:m.id,quantity:m.quantity,status:'requested',certificate:null});
    const activeTotal=s.medicines.filter(x=>x.name===m.name&&x.hospitalId===m.hospitalId&&x.status==='active'&&x.expiry>=iso().slice(0,10)).reduce((n,x)=>n+x.quantity,0);
    if(activeTotal<m.min&&!s.orders.some(o=>s.medicines.find(x=>x.id===o.medicineId)?.name===m.name&&s.medicines.find(x=>x.id===o.medicineId)?.hospitalId===m.hospitalId&&o.status!=='received'))s.orders.unshift({id:uid('PO'),medicineId:m.id,quantity:Math.max(m.min*2-activeTotal,1),status:'requested',createdAt:iso()});
  }
  return before!==JSON.stringify([s.medicines,s.orders,s.collections]);
}
export function guidance({safe, responsive, breathing, bleeding}) {
  const base={title:'Call 112',steps:['Call 112. Use speakerphone and follow the dispatcher.'],level:'urgent'};
  if(safe==='no')return {...base,title:'Stay clear of danger',steps:['Stay away from traffic, fire and electrical hazards.',...base.steps]};
  if(responsive==='no'||breathing==='no'||breathing==='unsure')return {...base,title:'Get emergency help now',steps:[...base.steps,'Tell the dispatcher if the person does not respond or is not breathing normally.','Follow dispatcher-led CPR instructions. A camera cannot confirm breathing or circulation.']};
  if(bleeding==='yes')return {...base,title:'Control external bleeding',steps:[...base.steps,'Use a clean cloth or dressing. Apply firm, steady pressure to external bleeding.','Do not remove an embedded object. Follow the dispatcher.']};
  if(!safe||!responsive||!breathing||!bleeding)return {...base,title:'First, check safety',steps:[...base.steps,'Only approach if it is safe.']};
  return {...base,title:'Stay with the person',steps:[...base.steps,'Avoid unnecessary movement after an accident unless there is immediate danger.','Keep watching for changes. Do not give food, drink or medication based on this app.']};
}
