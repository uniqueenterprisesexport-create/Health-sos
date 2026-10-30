// Runnable without credentials or external services: npm run demo
import {initialState,transition,freeBeds} from '../public/model.js';
let state=initialState();
function run(role,action,payload={}){const out=transition(state,action,payload,role);state=out.state;console.log(`${role.padEnd(11)} ${action.padEnd(22)} revision ${state.revision}`);return out.result;}
const id=run('patient','incident.create',{name:'Fictional competition patient',lat:28.61,lon:77.2,notes:'Demo accident. Requires clinician assessment.',consent:true});
run('patient','incident.request',{id,hospitalId:'demo-north'});
run('hospital','hospital.accept',{id});
run('dispatch','dispatch.assign',{id,ambulanceId:'AMB-01'});
run('hospital','incident.reroute',{id});
console.log('Original destination retained:',state.incidents[0].hospitalId);
run('hospital','hospital.accept',{id});
run('hospital','incident.arrive',{id,receivedBy:'Demo receiving nurse'});
run('hospital','claim.create',{incidentId:id,tariffId:'TAR-01'});
run('government','claim.approve',{id:state.claims[0].id});
run('government','settlement.run');
run('pharmacy','stock.scan');
console.log('\nResult:',JSON.stringify({incident:id,status:state.incidents[0].status,destination:state.incidents[0].hospitalId,settlement:state.settlements[0].amount,supplyRequests:state.orders.length,expiredCollections:state.collections.length},null,2));
console.log('\nAll institutions and actions are simulated. No money moved or services contacted.');
