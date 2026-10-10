// Application interaction checks with an in-memory DOM adapter.
// These validate rendering and event paths, not Safari layout or browser APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {STORAGE_KEY,FLOOR,assertState} from '../dist/core.js';
import {scenarioDefaults} from '../dist/scenario.js';

class Element {
  constructor(id=''){this.id=id;this.innerHTML='';this.textContent='';this.style={};this.dataset={};this.disabled=false;this.isConnected=true;this.content='';}
  classList={add(){},remove(){},toggle(){},contains(){return false;}};
  focus(){} scrollIntoView(){} select(){} remove(){}
  querySelector(){return null;}
  querySelectorAll(){return [];}
  append(){}
}
const elements=new Map(['app','sheet-root','toast','form-error','pin-error'].map(id=>[id,new Element(id)]));
const meta=new Element(),body=new Element(),events=new Map(),values=new Map(),download=[];
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,clipboard:{async writeText(text){values.set('clipboard',text);}}},configurable:true});
globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
globalThis.document={
  body,hidden:false,activeElement:null,
  getElementById:id=>elements.get(id)||null,
  querySelector:selector=>selector.startsWith('meta')?meta:null,
  addEventListener:(name,callback)=>events.set(name,callback),
  createElement:()=>{const el=new Element();el.click=()=>download.push(el.download);return el;},
  execCommand:()=>true
};
globalThis.window={scrollTo(){},addEventListener(){}};
globalThis.setInterval=()=>0;
globalThis.setTimeout=callback=>{callback();return 0;};
globalThis.clearTimeout=()=>{};
globalThis.FormData=class{constructor(form){this.fields=form.fields;}get(name){return this.fields[name]??null;}};
await import('../dist/app.js');
const app=()=>elements.get('app').innerHTML;
const sheet=()=>elements.get('sheet-root').innerHTML;
const saved=()=>JSON.parse(values.get(STORAGE_KEY));
async function click(act,id,extra={}){
  const button={dataset:{act,id,...extra},disabled:false};
  const target={classList:{contains:()=>false},closest:()=>button};
  await events.get('click')({target});
}
function submit(id,fields,dataset={}){
  events.get('submit')({target:{id,fields,dataset},preventDefault(){}});
}
function editorFields(state=saved()) {
  const {config,balances}=scenarioDefaults(state);
  const fields=Object.fromEntries(Object.entries(balances).map(([currency,cents])=>['wallet-'+currency,String(cents/100)]));
  Object.assign(fields,{'wallet-EUR':'65000',income:'2500',spending:'900','income-kind':'freelance','income-day':'25'});
  config.stops.forEach((stop,i)=>{fields['stop-date-'+i]=stop.date;fields['stop-region-'+i]=stop.regionId;});
  return {fields,config};
}
test('écran verrouillé, code incorrect puis accès par 2589',async()=>{
  assert.match(app(),/Bonjour, Lucas/);
  assert.doesNotMatch(app(),/Vos transactions/);
  for(const n of '0000')await click('pin',n);
  assert.match(elements.get('pin-error').textContent,/incorrect/);
  for(const n of '2589')await click('pin',n);
  assert.match(app(),/Solde/);
  assert.match(app(),/Lucas Jouvençon/);
  assert.ok(assertState(saved()));
});
test('les raccourcis de l’accueil et les comptes restent accessibles sans changer le registre',async()=>{
  const before=saved();
  assert.match(app(),/class="header-search"/);assert.match(app(),/class="accounts-pill"/);
  assert.match(app(),/class="transactions recent-transactions"/);assert.match(app(),/class="home-widgets"/);
  await click('accounts');assert.match(sheet(),/Vos comptes/);await click('close-sheet');
  for(const currency of ['USD','GBP','EGP','THB','EUR']){
    await click('select-account',currency);assert.match(app(),new RegExp('Personal · '+currency));
  }
  assert.deepEqual(saved(),before);
  await click('expenses',undefined,{period:'month'});assert.match(app(),/expenses-screen/);
  assert.match(app(),/data-id="month" class="is-active"/);
  await click('expenses-back');await click('tab','home');
  await click('search');assert.match(app(),/Transactions/);await click('tab','home');
  assert.deepEqual(saved(),before);
});
test('le masquage retire les chiffres et la courbe du nouvel accueil',async()=>{
  const before=saved();assert.match(app(),/class="widget-line"/);
  await click('hide');assert.equal(saved().hideBalance,true);
  assert.doesNotMatch(app(),/class="widget-line"/);
  assert.match(app(),/Afficher les montants/);
  assert.match(app(),/<strong>••••<\/strong>/);
  await click('hide');assert.deepEqual(saved(),before);assert.match(app(),/class="widget-line"/);
});
test('les six onglets et les parcours existants restent accessibles',async()=>{
  for(const [id,expected] of [['home','Vos transactions'],['cards','Vos cartes'],['payments','Paiements'],['savings','Vos poches'],['analytics','Votre argent'],['credit','A plan that fits'],['invest','Brokerage account'],['crypto','No holdings'],['points','FlexPoints']]){
    await click('tab',id);assert.match(app(),new RegExp(expected));
  }
  for(const act of ['accounts','topup','send','exchange','request','more','account-details','profile','location','card-details','card-limit','new-card','new-pocket','new-contact','budget','notifications','install']){
    await click(act);assert.match(sheet(),/role="dialog"/);await click('close-sheet');
  }
});
test('la page dépenses filtre les opérations, change de vue et revient à l’analyse sans modifier les données',async()=>{
  await click('tab','analytics');
  assert.match(app(),/Explorer les dépenses/);
  const before=saved();
  await click('expenses');
  assert.match(app(),/expenses-screen/);
  assert.match(app(),/Données de démonstration/);
  assert.match(app(),/expenses-donut/);
  await click('expenses-mode','bars');assert.match(app(),/expenses-timeline/);
  await click('expenses-mode','line');assert.match(app(),/Dépenses cumulées/);
  await click('expenses-period','month');assert.match(app(),/Par catégorie/);
  await click('expenses-period-menu');assert.match(sheet(),/expenses-period-nav/);await click('expenses-shift','-1');assert.match(sheet(),/expenses-period-nav/);await click('close-sheet');
  await click('expenses-period','all');
  await click('expenses-category','restaurant');assert.match(app(),/<h2>Restaurants<\/h2>/);
  await click('expenses-more');
  await click('expenses-category','');assert.match(app(),/Toutes les dépenses/);
  await click('expenses-back');assert.match(app(),/Votre argent/);
  assert.deepEqual(saved(),before);
});
test('les analyses et dépenses sont des pages complètes, leurs périodes et devise restent cohérentes',async()=>{
 const before=saved();await click('tab','analytics');assert.doesNotMatch(app(),/<nav class="nav"/);
 await click('analytics-period');assert.match(sheet(),/This week/);await click('analytics-select-period','month');assert.match(app(),/This month/);
 await click('expenses',undefined,{period:'month'});assert.doesNotMatch(app(),/<nav class="nav"/);
 for(const period of ['week','halfyear','year']){await click('expenses-period',period);assert.match(app(),new RegExp('data-id="'+period+'" class="is-active"'));}
 await click('expenses-back');await click('back-main');assert.match(app(),/<nav class="nav"/);
 for(const id of ['home','credit','invest','payments','crypto','points'])assert.match(app().slice(app().indexOf('<nav')),new RegExp('data-id="'+id+'"'));
 assert.deepEqual(saved(),before);
});
test('cartes promotionnelles et menus ne modifient pas le registre',async()=>{
 const before=saved();await click('tab','home');await click('promo-slide','1');assert.match(app(),/Make it yours/);
 await click('promo-slide','2');assert.match(app(),/Room for your plans/);await click('promo-slide','0');
 await click('move');assert.match(sheet(),/Changer de devise/);await click('close-sheet');
 await click('more');assert.match(sheet(),/Vos cartes/);assert.match(sheet(),/Vos poches/);await click('close-sheet');
 await click('promo-dismiss');assert.doesNotMatch(app(),/promo-carousel/);assert.deepEqual(saved(),before);
});
test('portefeuille et liste de suivi sont fictifs et indépendants des soldes bancaires',async()=>{
 const before=saved();await click('tab','invest');assert.match(app(),/Cash balance/);
 await click('invest-deposit');assert.match(sheet(),/Le solde des comptes et le registre bancaire ne sont pas modifiés/);
 submit('invest-cash-form',{amount:'100'},{withdraw:'false'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,10000);
 await click('invest-withdraw');submit('invest-cash-form',{amount:'101'},{withdraw:'true'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,10000);assert.match(elements.get('form-error').textContent,/dépasse/);
 submit('invest-cash-form',{amount:'25'},{withdraw:'true'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,7500);
 await click('brokerage-toggle');assert.doesNotMatch(app(),/Cash balance/);await click('brokerage-toggle');
 await click('invest-market');assert.match(sheet(),/sans cotations/);await click('instrument','global');await click('watchlist-toggle','global');assert.deepEqual(JSON.parse(values.get('flex-preview-v1')).watchlist,['global']);
 await click('watchlist-toggle','global');assert.deepEqual(JSON.parse(values.get('flex-preview-v1')).watchlist,[]);await click('close-sheet');
 await click('crypto-market');assert.match(sheet(),/Bitcoin/);assert.doesNotMatch(sheet(),/Global Equity/);await click('close-sheet');
 assert.deepEqual(saved(),before);await click('tab','home');
});
test('calculateur crédit : calcul et erreur affichés sans modifier les comptes',async()=>{
 const before=saved();await click('tab','credit');elements.set('credit-result',new Element('credit-result'));
 submit('credit-form',{amount:'1200',months:'12',rate:'0'});assert.match(elements.get('credit-result').innerHTML,/€100,00/);
 submit('credit-form',{amount:'1200',months:'0',rate:'0'});assert.match(elements.get('form-error').textContent,/durée/);
 assert.deepEqual(saved(),before);await click('tab','home');
});
test('mode édition : étapes, validation, régénération, sortie et annulation complète',async()=>{
  const before=saved();await click('profile');assert.match(sheet(),/Mode édition/);await click('editor');
  assert.match(app(),/Mode édition · Démonstration/);assert.match(sheet(),/Pays et déplacements/);
  const {fields,config}=editorFields();const form=new Element('scenario-form');form.fields=fields;elements.set('scenario-form',form);
  await click('editor-add-stop');assert.match(sheet(),new RegExp('editor-stop-date-'+config.stops.length));
  await click('editor-remove-stop',String(config.stops.length));assert.doesNotMatch(sheet(),new RegExp('editor-stop-date-'+config.stops.length));
  submit('scenario-form',{...fields,'wallet-EUR':'1000'},{operation:'balances'});
  assert.match(elements.get('form-error').textContent,/23 000/);assert.deepEqual(saved(),before);
  submit('scenario-form',{...fields,'stop-region-0':'paris'});
  assert.equal(saved().wallets.EUR,6500000);assert.equal(saved().scenario.stops[0].regionId,'paris');assert.ok(saved().transactions.filter(t=>t.automatic).every(t=>t.demo));
  assert.match(sheet(),/Historique de démonstration régénéré/);assert.ok(assertState(saved()));
  await click('editor-exit');assert.match(app(),/Scénario de démonstration/);assert.doesNotMatch(app(),/Mode édition · Démonstration/);
  await click('editor');await click('editor-undo');assert.deepEqual(saved(),before);assert.match(sheet(),/dernier changement a été annulé/);
  await click('editor-exit');
});
test('ajout, virement et change enregistrés depuis leurs formulaires',async()=>{
  await click('tab','home');
  const before=saved().wallets.EUR;
  await click('topup');submit('topup-form',{amount:'123,45',method:'Carte'});
  assert.equal(saved().wallets.EUR,before+12345);
  await click('send');submit('send-form',{recipient:'Paul',amount:'23,45',currency:'EUR',date:new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}),note:'Test'});
  assert.equal(saved().wallets.EUR,before+10000);
  await click('exchange');const beforeUSD=saved().wallets.USD;
  submit('exchange-form',{amount:'10',from:'EUR',to:'USD'});
  assert.equal(saved().wallets.USD,beforeUSD+1120);
  assert.ok(assertState(saved()));
});
test('réserve protégée dans le parcours utilisateur',async()=>{
  const before=saved().wallets.EUR;
  await click('send');
  submit('send-form',{recipient:'Paul',amount:String((before-FLOOR+1)/100),currency:'EUR',date:new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}),note:''});
  assert.equal(saved().wallets.EUR,before);
  assert.match(elements.get('form-error').textContent,/réserve/);
});
test('création de poche et transferts de valeur cohérents',async()=>{
  await click('tab','savings');
  submit('new-pocket-form',{name:'Voyage Tokyo',target:'3000',icon:'plane'},{pocket:''});
  const p=saved().pockets.at(-1),before=saved().wallets.EUR;
  submit('pocket-form',{amount:'100',direction:'deposit'},{pocket:p.id});
  assert.equal(saved().wallets.EUR,before-10000);
  assert.equal(saved().pockets.find(x=>x.id===p.id).balance,10000);
  submit('pocket-form',{amount:'40',direction:'withdraw'},{pocket:p.id});
  assert.equal(saved().wallets.EUR,before-6000);
});
test('contact, carte, gel, région, mode sombre et recherche',async()=>{
  submit('contact-form',{name:'Test Ami'});
  assert.equal(saved().contacts.at(-1).name,'Test Ami');
  submit('new-card-form',{type:'disposable'});
  const c=saved().cards.extra.at(-1);
  await click('freeze-extra',c.id);assert.equal(saved().cards.extra.at(-1).frozen,true);
  await click('freeze');assert.equal(saved().cards.frozen,true);
  await click('select-location','bangkok');assert.equal(saved().location.regionId,'bangkok');
  assert.equal(saved().theme,'dark');
  await click('toggle-setting','theme');assert.equal(saved().theme,'light');
  await click('search');assert.match(app(),/Rechercher un lieu/);
  await click('filter','out');assert.match(app(),/Transactions/);
});
test('demande de paiement, réception idempotente et copie',async()=>{
  submit('request-form',{name:'Camille',amount:'19,20',currency:'EUR'});
  const r=saved().requests.at(-1),before=saved().wallets.EUR;
  await click('receive-request',r.id);
  assert.equal(saved().wallets.EUR,before+1920);
  await click('receive-request',r.id);
  assert.equal(saved().wallets.EUR,before+1920);
  await click('share-request',r.id);
  assert.match(values.get('clipboard'),/DÉMO FLEX — Demande fictive/);
  
});
test('l’annulation d’une édition préserve les opérations personnelles ajoutées ensuite',async()=>{
  await click('editor');const {fields}=editorFields();submit('scenario-form',fields,{operation:'balances'});
  const count=saved().transactions.length;assert.equal(saved().wallets.EUR,6500000);
  await click('close-sheet');submit('topup-form',{amount:'10',method:'Carte'});
  assert.equal(saved().transactions.length,count+1);assert.equal(saved().wallets.EUR,6501000);
  await click('editor');await click('editor-undo');
  assert.match(elements.get('form-error').textContent,/activité a changé/);assert.equal(saved().wallets.EUR,6501000);assert.equal(saved().transactions.length,count+1);
  await click('editor-exit');
});
test('export CSV, données valides et verrouillage final',async()=>{
  await click('export');
  assert.match(download.at(-1),/^Flex-DEMO-transactions-/);
  assert.ok(assertState(saved()));
  await click('lock');
  assert.match(app(),/Saisissez votre code/);
  assert.doesNotMatch(app(),/Solde/);
});
