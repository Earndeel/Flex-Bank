import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOOR,STORAGE_KEY,initialState,assertState,rollForward,RATES} from '../dist/core.js';
import {expenseMetrics} from '../dist/expenses.js';
import {setupDefaults,setupRange,restoreProfile,profileIdentity,validateSetup,createSetupState,readSetupDraft,addSetupStop,renderSetup} from '../dist/setup.js';
import {localizeHTML} from '../dist/i18n.js';

const now=new Date('2026-10-10T12:00:00Z');
const draft=(changes={})=>({...setupDefaults(now),firstName:'Emma',lastName:'Durand',annualSpending:'15234.12',...changes});
const yearSpent=(state,at=now)=>expenseMetrics(state.transactions,{period:'year',currency:'EUR',timeZone:state.location.regionId==='aswan'?'Africa/Cairo':'Europe/Paris',now:at}).total;

test('nouveau navigateur : aucun historique initial et aucun profil restauré avant validation',()=>{
  assert.equal(restoreProfile(null,now),null);assert.equal(restoreProfile('invalid',now),null);assert.equal(restoreProfile('{}',now),null);
  const skeleton=initialState(now,{generateHistory:false});assert.deepEqual(skeleton.transactions,[]);assert.ok(assertState(skeleton));
  assert.equal(STORAGE_KEY,'luma-demo-v1');assert.equal(setupDefaults(now).firstName,'');
});
test('setup : identité, solde exact, Spent annuel exact et trois mois de transactions cohérentes',()=>{
  const input=draft({stops:[{date:'2026-07-10',regionId:'bangkok'},{date:'2026-09-01',regionId:'paris'},{date:'2026-10-01',regionId:'aswan'}]}),before=structuredClone(input);
  const state=createSetupState(input,now,'setup-ledger');
  assert.ok(assertState(state));assert.deepEqual(input,before);assert.equal(state.wallets.EUR,2800000);
  assert.equal(state.profile.name,'Emma Durand');assert.equal(state.profile.initials,'ED');assert.equal(state.profile.handle,'emma.durand');
  assert.equal(state.theme,'dark');assert.equal(state.setup.annualSpending,1523412);assert.equal(yearSpent(state),1523412);
  assert.equal(state.historyStart,'2026-07-10');assert.equal(state.lastGeneratedDate,'2026-10-10');
  assert.ok(state.transactions.length>150);assert.ok(state.transactions.every(t=>t.automatic&&t.demo&&t.id.startsWith('scenario-')));
  assert.ok(state.transactions.every(t=>Date.parse(t.timestamp)<=now.getTime()));assert.ok(state.transactions.some(t=>t.category==='income'));
  for(const [region,code] of [['bangkok','THB'],['paris','EUR'],['aswan','EGP']])assert.ok(state.transactions.some(t=>t.region===region&&t.originalCurrency===code&&t.amount<0));
  const running={...state.scenarioOpening};
  for(const tx of state.transactions){running[tx.currency]+=tx.amount;assert.equal(tx.balanceAfter,running[tx.currency]);assert.ok(tx.balanceAfter>=FLOOR);if(tx.originalAmount!==undefined)assert.equal(tx.originalAmount,Math.round(-tx.amount*RATES[tx.originalCurrency]));}
  assert.deepEqual(running,state.wallets);assert.ok(Object.entries(state.wallets).every(([code,value])=>code==='EUR'||value===0));assert.ok(state.pockets.every(p=>p.balance===0));
  const saved=structuredClone(state);assert.equal(rollForward(state,now),0);assert.deepEqual(state,saved);
});
test('la réserve de 23 000,01 € reste respectée, même juste après le salaire',()=>{
  const at=new Date('2026-10-25T12:00:00Z'),input={...setupDefaults(at),firstName:'Lucas',lastName:'Jouvençon',balance:'23000,01'};
  const state=createSetupState(input,at,'minimum-reserve');
  assert.equal(state.wallets.EUR,FLOOR);assert.equal(yearSpent(state,at),1200000);
  assert.ok(state.scenarioOpening.EUR>=FLOOR);assert.ok(state.transactions.every(t=>t.balanceAfter>=FLOOR));
  assert.ok(state.transactions.filter(t=>t.amount>0).every(t=>t.category==='income'));
});
test('le montant annuel respecte les centimes, zéro et la borne haute',()=>{
  for(const [value,target] of [['0',0],['0.01',1],['12345.67',1234567],['10000000',1000000000]]){
    const state=createSetupState(draft({annualSpending:value}),now,'exact-'+target);assert.equal(yearSpent(state),target);assert.ok(assertState(state));
    assert.ok(state.transactions.every(t=>t.amount!==0&&Number.isSafeInteger(t.amount)&&t.balanceAfter>=FLOOR));
    if(!target){assert.deepEqual(state.transactions,[]);assert.equal(state.scenario.monthlyIncome,0);}
  }
});
test('Spent annuel cible l’année actuelle quand les trois mois traversent janvier',()=>{
  const at=new Date('2027-01-10T12:00:00Z'),input={...setupDefaults(at),firstName:'Nora',lastName:'Martin',annualSpending:'2000.01'};
  const state=createSetupState(input,at,'new-year');assert.equal(state.historyStart,'2026-10-10');assert.equal(yearSpent(state,at),200001);
  assert.ok(state.transactions.some(t=>t.timestamp.startsWith('2026-')));assert.ok(state.transactions.some(t=>t.timestamp.startsWith('2027-')));
});
test('les profils déjà enregistrés sont conservés, avec leurs écritures et leurs montants',()=>{
  const existing=createSetupState(draft(),now,'returning');delete existing.setup;existing.theme='light';existing.hideBalance=true;
  const loaded=restoreProfile(JSON.stringify(existing),now);assert.equal(loaded.theme,'dark');
  assert.deepEqual(loaded,{...existing,theme:'dark'});assert.equal(loaded.profile.name,'Emma Durand');assert.equal(loaded.hideBalance,true);
  const legacy=initialState(now);assert.equal(profileIdentity(restoreProfile(JSON.stringify(legacy),now)).initials,'LJ');
});
test('chaque profil a sa propre génération, sans changer le formulaire initial',()=>{
  const input=draft(),a=createSetupState(input,now,'person-a'),b=createSetupState(input,now,'person-b');
  assert.notDeepEqual(a.transactions,b.transactions);assert.deepEqual(a.wallets,b.wallets);assert.equal(yearSpent(a),yearSpent(b));
  assert.deepEqual(createSetupState(input,now,'person-a'),a);
});
test('les noms, montants et séjours invalides sont refusés avant de créer un registre',()=>{
  for(const changes of [{firstName:''},{lastName:'x'.repeat(51)},{balance:'23000'},{balance:'not-money'},{annualSpending:'-1'},{annualSpending:'10000000.01'},{stops:[]},{stops:[{date:'2026-07-10',regionId:'invalid'}]},{stops:[{date:'2026-07-10',regionId:'paris'},{date:'2026-10-11',regionId:'aswan'}]},{stops:[{date:'2026-07-10',regionId:'paris'},{date:'2026-02-30',regionId:'aswan'}]},{stops:[{date:'2026-07-10',regionId:'paris'},{date:'2026-07-10',regionId:'aswan'}]}])assert.throws(()=>createSetupState(draft(changes),now,'invalid'));
  const clean=validateSetup(draft({firstName:'  Élodie ',lastName:' O’Neill  '}),now);assert.equal(clean.firstName,'Élodie');assert.equal(clean.lastName,'O’Neill');
});
test('ajout de séjours, lecture du formulaire et date initiale selon la ville finale',()=>{
  const original=draft(),next=addSetupStop(original,now);assert.equal(original.stops.length,1);assert.equal(next.stops.length,2);assert.ok(next.stops[1].date>next.stops[0].date);
  const fields=new Map([['first-name','Emma'],['last-name','Durand'],['balance','35000'],['annual-spending','8000'],['setup-date-0','2020-01-01'],['setup-region-0','paris'],['setup-date-1','2026-09-01'],['setup-region-1','aswan']]);
  const loaded=readSetupDraft(fields,next,now);assert.equal(loaded.stops[0].date,setupRange('aswan',now).start);assert.equal(loaded.stops[1].regionId,'aswan');assert.equal(loaded.balance,'35000');
  assert.throws(()=>addSetupStop(draft({stops:[{date:'2026-10-10',regionId:'paris'}]}),now),/date/);
});
test('initiales Unicode, contenu échappé et setup traduisible sans modifier les valeurs',()=>{
  assert.equal(profileIdentity({profile:{name:'Élodie O’Neill'}}).initials,'ÉO');assert.equal(profileIdentity({profile:{firstName:'李',lastName:'伟',name:'李 伟'}}).initials,'李伟');
  const input=draft({firstName:'<script>',lastName:'Home'}),html=renderSetup(input,{now});assert.ok(html.includes('value="&lt;script&gt;"'));assert.ok(!html.includes('value="<script>"'));
  const english=localizeHTML(html,'en');assert.match(english,/Annual spending · EUR/);assert.match(english,/Create my space/);assert.match(english,/Stay 1/);assert.ok(english.includes('value="Home"'));assert.ok(english.includes('name="annual-spending"'));
  assert.match(renderSetup(input,{busy:true,now}),/aria-busy="true"/);assert.match(renderSetup(input,{busy:true,now}),/setup-spinner/);
});
