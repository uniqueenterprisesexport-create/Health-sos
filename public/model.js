// Shared domain logic: browser sandbox and SQLite server run the same transitions.
export const roles = ['patient', 'hospital', 'dispatch', 'pharmacy', 'government'];
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
    revision: 0, createdAt: now,
    hospitals: [
      {id:'demo-north',name:'North Campus Demo Hospital',lat:28.6139,lon:77.2090,beds:8,occupied:3,capabilities:['Emergency','Trauma','CT','ICU'],participating:true,updatedAt:now},
      {id:'demo-east',name:'East District Demo Hospital',lat:28.625,lon:77.235,beds:6,occupied:2,capabilities:['Emergency','Trauma','CT'],participating:true,updatedAt:now},
      {id:'demo-west',name:'West Community Demo Hospital',lat:28.601,lon:77.18,beds:10,occupied:4,capabilities:['Emergency','ICU'],participating:true,updatedAt:now}
    ],
    incidents: [],
    ambulances: [{id:'AMB-01',label:'Unit 01 · simulated ALS',status:'available',incidentId:null},{id:'AMB-02',label:'Unit 02 · simulated BLS',status:'available',incidentId:null}],
    medicines: [
      {id:'MED-01',name:'Sterile saline · demo stock',batch:'SAL-2608',quantity:42,min:20,expiry:day(120),status:'active',hospitalId:'demo-north'},
      {id:'MED-02',name:'Sterile dressings · demo stock',batch:'DRS-2610',quantity:6,min:25,expiry:day(45),status:'active',hospitalId:'demo-north'},
      {id:'MED-03',name:'Paracetamol · demo stock',batch:'PCM-2501',quantity:18,min:20,expiry:day(-2),status:'quarantined',hospitalId:'demo-north'}
    ],
    orders: [], collections: [],
    tariffs:[{id:'TAR-01',code:'DEMO-ER',name:'Emergency assessment',amount:500,state:'Delhi',scheme:'Prototype agreement',version:1,effective:day(-1)},{id:'TAR-02',code:'DEMO-BED',name:'Ward day',amount:1200,state:'Delhi',scheme:'Prototype agreement',version:1,effective:day(-1)}],
    appointments: [], notifications: [], claims: [], settlements: [], reports: [], audit: [{id:uid('EVT'),at:now,role:'system',action:'Prototype initialised',detail:'All seeded institutions, capacity, prices and inventory are fictional.'}]
  };
}
export function freeBeds(state, h, excludingId) {
  const holds=state.incidents.filter(i=>i.id!==excludingId&&i.hospitalId===h.id&&['accepted','en_route','reroute_pending'].includes(i.status)).length;
  return Math.max(0,h.beds-h.occupied-holds);
}
export function haversine(a,b) {
  const rad=x=>x*Math.PI/180, dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon);
  const v=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
}
const required=(v,name)=>{if(typeof v!=='string'||!v.trim()||v.length>1500)throw Error(`${name} is required (maximum 1500 characters).`);return v.trim();};
const integer=(v,min,max,name)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} must be a whole number from ${min} to ${max}.`);return n;};
function coord(v,min,max,name){if(v===''||v===null||v===undefined||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(`Valid ${name} required.`);return Number(v);}
const find=(items,id,name)=>{const x=items.find(i=>i.id===id);if(!x)throw Error(`${name} not found.`);return x;};
const allow=(role,list)=>{if(!list.includes(role))throw Error('This action is unavailable for this demo role.');};
export function candidates(state,incident) {
  return state.hospitals.filter(h=>h.participating&&h.id!==incident.hospitalId&&h.capabilities.includes(incident.need)&&freeBeds(state,h)>0).map(h=>({...h,distance:haversine(incident,h)})).sort((a,b)=>a.distance-b.distance);
}
export function normalizeState(state){return {...state,appointments:state.appointments||[],notifications:state.notifications||[]};}
export function transition(current, action, p={}, role='patient') {
  if(!roles.includes(role))throw Error('Unknown demo role.');
  const s=normalizeState(structuredClone(current));let detail='',result=null;
  switch(action) {
    case 'incident.create': {
      allow(role,['patient','hospital','dispatch']);
      const i={id:uid('SOS'),name:required(p.name||'Unidentified patient','Patient label'),lat:coord(p.lat,-90,90,'latitude'),lon:coord(p.lon,-180,180,'longitude'),notes:String(p.notes||'').slice(0,1500),need:p.need||'Emergency',status:'reported',hospitalId:null,proposedHospitalId:null,ambulanceId:null,createdAt:iso(),events:[],observations:p.observations||null,consent:!!p.consent};
      if(!['Emergency','Trauma','CT','ICU'].includes(i.need))throw Error('Unsupported capability.');
      i.events.push({at:iso(),text:'Reported in prototype. Emergency services have not been contacted.'});
      if(p.autoRequest){const selected=s.hospitals.filter(h=>h.participating&&h.capabilities.includes(i.need)&&freeBeds(s,h)>0).sort((a,b)=>haversine(i,a)-haversine(i,b))[0];if(selected){i.proposedHospitalId=selected.id;i.status='requested';i.events.push({at:iso(),text:`Automatically requested nearest matching demo facility: ${selected.name}. Staff acceptance required.`});}}
      s.incidents.unshift(i);result=i.id;detail=i.id;break;
    }
    case 'incident.request': {
      allow(role,['patient','dispatch','hospital']);const i=find(s.incidents,p.id,'Incident'),h=find(s.hospitals,p.hospitalId,'Hospital');
      if(!['reported','requested'].includes(i.status))throw Error('This incident already has an active hospital journey.');
      if(!h.participating||!h.capabilities.includes(i.need))throw Error('Hospital lacks the requested prototype capability.');
      if(freeBeds(s,h,i.id)<1)throw Error('No uncommitted demo capacity.');
      i.proposedHospitalId=h.id;i.status='requested';i.events.push({at:iso(),text:`Request sent to ${h.name}; awaiting staff acceptance.`});detail=i.id;break;
    }
    case 'hospital.accept': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');
      if(!['requested','reroute_pending'].includes(i.status))throw Error('No pending hospital request.');
      const h=find(s.hospitals,i.proposedHospitalId,'Proposed hospital');
      if(!h.capabilities.includes(i.need)||freeBeds(s,h,i.id)<1)throw Error('Required capacity is no longer available.');
      i.hospitalId=h.id;i.proposedHospitalId=null;i.status=i.ambulanceId?'en_route':'accepted';
      i.events.push({at:iso(),text:`Staff accepted at ${h.name}. Provisional capacity committed.`});detail=i.id;break;
    }
    case 'hospital.capacity': {
      allow(role,['hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      const beds=integer(p.beds,0,1000,'Staffed beds'),occupied=integer(p.occupied,0,1000,'Occupied beds');
      if(occupied>beds)throw Error('Occupied beds cannot exceed staffed beds.');
      h.beds=beds;h.occupied=occupied;h.updatedAt=iso();detail=`${h.name}: ${occupied}/${beds}`;break;
    }
    case 'hospital.walkin': {
      allow(role,['hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      if(h.occupied>=h.beds)throw Error('No physical capacity. Escalate to clinical staff.');
      h.occupied++;h.updatedAt=iso();detail=`Walk-in at ${h.name}; review any affected commitments.`;break;
    }
    case 'incident.reroute': {
      allow(role,['hospital','dispatch']);const i=find(s.incidents,p.id,'Incident');
      if(!['accepted','en_route'].includes(i.status))throw Error('Only an accepted incoming patient can be rerouted.');
      const options=candidates(s,i);const h=p.hospitalId?options.find(h=>h.id===p.hospitalId):options[0];
      if(!h)throw Error('No suitable alternative. Escalate to dispatcher; current destination retained.');
      i.proposedHospitalId=h.id;i.status='reroute_pending';i.events.push({at:iso(),text:`Alternative proposed: ${h.name}. Current destination retained until acceptance.`});detail=i.id;break;
    }
    case 'dispatch.assign': {
      allow(role,['dispatch']);const i=find(s.incidents,p.id,'Incident'),a=find(s.ambulances,p.ambulanceId,'Ambulance');
      if(!['reported','requested','accepted'].includes(i.status))throw Error('Incident cannot be assigned in its current state.');
      if(a.status!=='available'||i.ambulanceId)throw Error('Ambulance or incident is already assigned.');
      a.status='assigned';a.incidentId=i.id;i.ambulanceId=a.id;if(i.status==='accepted')i.status='en_route';
      i.events.push({at:iso(),text:`${a.id} assigned in simulation. No real ambulance dispatched.`});detail=i.id;break;
    }
    case 'incident.arrive': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');
      if(!['accepted','en_route'].includes(i.status))throw Error('Hospital must accept before arrival is recorded.');
      const h=find(s.hospitals,i.hospitalId,'Hospital');if(h.occupied>=h.beds)throw Error('Capacity changed. Clinical escalation required.');
      h.occupied++;h.updatedAt=iso();i.status='arrived';i.receivedBy=required(p.receivedBy,'Receiving staff');i.events.push({at:iso(),text:`Handover received by ${i.receivedBy}.`});
      if(i.ambulanceId){const a=find(s.ambulances,i.ambulanceId,'Ambulance');a.status='available';a.incidentId=null;}detail=i.id;break;
    }
    case 'incident.discharge': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');if(i.status!=='arrived')throw Error('Only an admitted patient can be discharged.');
      const h=find(s.hospitals,i.hospitalId,'Hospital');h.occupied=Math.max(0,h.occupied-1);h.updatedAt=iso();i.status='discharged';i.events.push({at:iso(),text:'Discharge recorded in prototype.'});detail=i.id;break;
    }
    case 'appointment.create': {
      allow(role,['patient','hospital']);const h=find(s.hospitals,p.hospitalId,'Hospital');
      const when=required(p.when,'Appointment time');if(!Number.isFinite(Date.parse(when))||Date.parse(when)<Date.now())throw Error('Choose a future appointment time.');
      if(s.appointments.some(a=>a.hospitalId===h.id&&a.when===when&&a.status!=='cancelled'))throw Error('That demo slot is already requested. Choose another time.');
      const a={id:uid('OPD'),name:required(p.name||'Demo patient','Patient label'),hospitalId:h.id,when,department:required(p.department,'Department'),status:'requested'};
      s.appointments.unshift(a);result=a.id;detail=a.id;break;
    }
    case 'appointment.confirm': {
      allow(role,['hospital']);const a=find(s.appointments,p.id,'Appointment');if(a.status!=='requested')throw Error('No pending appointment.');a.status='confirmed';detail=a.id;break;
    }
    case 'family.share': {
      allow(role,['patient']);const i=find(s.incidents,p.id,'Incident');if(!p.consent)throw Error('Permission is required to prepare a family update.');
      const h=s.hospitals.find(h=>h.id===i.hospitalId);const n={id:uid('NOTE'),incidentId:i.id,createdAt:iso(),text:`Prototype update for ${i.id}: ${i.status.replaceAll('_',' ')}. ${h?'Receiving demo facility: '+h.name+'.':'Hospital acceptance pending.'} No real emergency service has been contacted.`,status:'prepared_not_sent'};
      s.notifications.unshift(n);detail=n.id;result=n.text;break;
    }
    case 'hospital.decline': {
      allow(role,['hospital']);const i=find(s.incidents,p.id,'Incident');if(!['requested','reroute_pending'].includes(i.status))throw Error('No pending hospital request.');
      i.proposedHospitalId=null;i.status=i.hospitalId?(i.ambulanceId?'en_route':'accepted'):'reported';i.events.push({at:iso(),text:'Proposed receiving team declined. Existing accepted destination retained where present; dispatcher escalation required.'});detail=i.id;break;
    }
    case 'report.create': {
      allow(role,['patient','hospital','dispatch']);const i=find(s.incidents,p.id,'Incident');
      if(s.reports.some(r=>r.incidentId===i.id))throw Error('An incident notification already exists.');
      s.reports.unshift({id:uid('REP'),incidentId:i.id,status:'draft',summary:required(p.summary||i.notes||'Accident notification; details unverified.','Summary'),createdAt:iso(),officialReference:null});detail=i.id;break;
    }
    case 'report.submit': {
      allow(role,['government']);const r=find(s.reports,p.id,'Report');if(r.status!=='draft')throw Error('Report already submitted to simulator.');r.status='simulated_acknowledgement';r.officialReference=uid('DEMO-ACK');detail=`${r.id}; simulation only, not an FIR`;break;
    }
    case 'stock.dispense': {
      allow(role,['pharmacy']);const m=find(s.medicines,p.id,'Stock'),q=integer(p.quantity,1,10000,'Quantity');
      if(m.status!=='active'||m.expiry<iso().slice(0,10))throw Error('Expired or quarantined stock cannot be dispensed.');
      if(q>m.quantity)throw Error('Insufficient stock.');m.quantity-=q;detail=`${m.name}: ${q} dispensed (simulation)`;break;
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
      const certificate=required(p.certificate,'Disposal certificate reference');const m=find(s.medicines,c.medicineId,'Stock');m.quantity=0;m.status='disposed';c.status='disposed';c.certificate=certificate;detail=`${c.id}; simulated disposal certificate`;break;
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
  const base={title:'Contact emergency services',steps:['Call 112 or your local emergency number. Put the call on speaker and follow the dispatcher.'],level:'urgent'};
  if(!safe||!responsive||!breathing||!bleeding)return {...base,title:'Start with scene safety',steps:[...base.steps,'Answer only what you can observe. Stay clear of immediate hazards and follow the dispatcher.']};
  if(safe==='no')return {...base,title:'Keep yourself safe',steps:['Stay clear of traffic, fire, electricity, or other immediate hazards. Do not enter an unsafe scene.',...base.steps]};
  if(responsive==='no'||breathing==='no'||breathing==='unsure')return {...base,title:'Tell the dispatcher immediately',steps:[...base.steps,'Say whether the person responds and whether breathing appears normal. A camera cannot confirm breathing or circulation.','Follow dispatcher-led resuscitation instructions. This prototype does not assess whether CPR is needed.']};
  if(bleeding==='yes')return {...base,title:'Report heavy external bleeding',steps:[...base.steps,'If safe, use a clean dressing or cloth and apply firm direct pressure to external bleeding. Avoid direct contact with blood where possible.','Do not remove an embedded object. Follow the dispatcher for further instructions.']};
  return {...base,title:'Stay with the injured person',steps:[...base.steps,'Avoid unnecessary movement after an accident unless there is immediate danger.','Keep observing and tell the dispatcher about any change. Do not give food, drink, or medication on the basis of this app.']};
}
