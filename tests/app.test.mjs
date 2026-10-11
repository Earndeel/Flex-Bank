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
const meta=new Element(),body=new Element(),disclosure=new Element(),events=new Map(),values=new Map([['flex-language-v1','fr']]),download=[];
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
Object.defineProperty(globalThis,'navigator',{value:{onLine:true,clipboard:{async writeText(text){values.set('clipboard',text);}}},configurable:true});
globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
globalThis.document={
  body,documentElement:{lang:'fr'},hidden:false,activeElement:null,
  getElementById:id=>elements.get(id)||null,
  querySelector:selector=>selector.startsWith('meta')?meta:selector==='.global-disclosure'?disclosure:null,
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
  return events.get('submit')({target:{id,fields,dataset},preventDefault(){}});
}
function editorFields(state=saved()) {
  const {config,balances}=scenarioDefaults(state);
  const fields=Object.fromEntries(Object.entries(balances).map(([currency,cents])=>['wallet-'+currency,String(cents/100)]));
  Object.assign(fields,{'wallet-EUR':'65000',income:'2500',spending:'900','income-kind':'freelance','income-day':'25'});
  config.stops.forEach((stop,i)=>{fields['stop-date-'+i]=stop.date;fields['stop-region-'+i]=stop.regionId;});
  return {fields,config};
}
test('première ouverture : setup bilingue, sans compte créé avant validation',async()=>{
  assert.match(app(),/setup-screen/);assert.match(app(),/Créer mon espace/);assert.equal(values.has(STORAGE_KEY),false);
  for(const n of '2589')await click('pin',n);assert.match(app(),/setup-screen/);assert.equal(values.has(STORAGE_KEY),false);
  let prevented=false;events.get('keydown')({key:'8',preventDefault(){prevented=true;}});assert.equal(prevented,false);
  await click('setup-language','en');assert.match(app(),/Create my space/);assert.match(app(),/Annual spending/);
  await click('setup-language','fr');await click('setup-add-stop');assert.match(app(),/Séjour 2/);
  await click('setup-remove-stop','1');assert.doesNotMatch(app(),/Séjour 2/);assert.equal(values.has(STORAGE_KEY),false);
});
test('setup : erreur sans sauvegarde, génération avec animation et identité personnalisée',async()=>{
  const fields={'first-name':'Emma','last-name':'Durand',balance:'22000','annual-spending':'15000','setup-region-0':'paris','setup-date-0':'2026-07-10'};
  await submit('setup-form',fields);assert.match(app(),/23 000/);assert.equal(values.has(STORAGE_KEY),false);assert.ok(app().includes('value="Emma"'));
  fields.balance='28000';const generation=submit('setup-form',fields);assert.match(app(),/aria-busy="true"/);assert.match(app(),/setup-spinner/);await generation;
  assert.doesNotMatch(app(),/setup-screen/);assert.match(app(),/Bonjour, Emma/);assert.match(app(),/>ED<\/div>/);
  assert.equal(saved().profile.name,'Emma Durand');assert.equal(saved().wallets.EUR,2800000);assert.equal(saved().setup.annualSpending,1500000);
});
test('écran verrouillé, code incorrect puis accès par 2589',async()=>{
  assert.match(app(),/Bonjour, Emma/);
  assert.doesNotMatch(app(),/Vos transactions/);
  for(const n of '0000')await click('pin',n);
  assert.match(elements.get('pin-error').textContent,/incorrect/);
  for(const n of '2589')await click('pin',n);
  assert.match(app(),/Solde/);
  assert.match(app(),/Emma Durand/);
  assert.ok(assertState(saved()));
});
test('initiales et nom du setup dans l’accueil, le profil, les cartes et les coordonnées',async()=>{
  await click('tab','home');assert.match(app(),/<span class="avatar">ED<\/span>/);assert.doesNotMatch(app(),/avatar-memoji/);
  await click('profile');assert.match(sheet(),/Emma Durand/);assert.match(sheet(),/@emma.durand/);assert.match(sheet(),/Toujours activé/);
  await click('tab','cards');assert.match(app(),/Emma Durand/);await click('card-details');assert.match(sheet(),/Emma Durand/);
  await click('tab','home');await click('account-details');assert.match(sheet(),/Emma Durand/);await click('copy-account');assert.match(values.get('clipboard'),/DÉMONSTRATION — Emma Durand/);await click('close-sheet');
});
test('les raccourcis de l’accueil et les comptes restent accessibles sans changer le registre',async()=>{
  const before=saved();
  assert.match(app(),/class="header-search"/);assert.match(app(),/class="accounts-pill"/);
  assert.match(app(),/class="transactions recent-transactions"/);assert.match(app(),/class="home-widgets"/);
  await click('accounts');assert.match(sheet(),/Vos comptes/);await click('close-sheet');
  for(const currency of ['USD','GBP','EGP','THB','EUR']){
    await click('select-account',currency);assert.match(app(),new RegExp('Personnel · '+currency));
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
  for(const [id,expected] of [['home','Vos transactions'],['cards','Vos cartes'],['payments','Paiements'],['savings','Vos poches'],['analytics','Votre argent'],['credit','Un plan adapté'],['invest','Compte d’investissement'],['crypto','Aucun actif'],['points','FlexPoints']]){
    await click('tab',id);assert.match(app(),new RegExp(expected));
  }
  for(const act of ['accounts','topup','send','exchange','request','more','account-details','profile','location','card-details','card-limit','new-card','new-pocket','new-contact','budget','notifications','install']){
    await click(act);assert.match(sheet(),/role="dialog"/);await click('close-sheet');
  }
});
test('la page dépenses filtre les opérations, change de vue et revient à l’analyse sans modifier les données',async()=>{
  await click('tab','analytics');
  assert.match(app(),/spent-card/);
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
  await click('expenses-back');assert.match(app(),/Votre argent/);assert.match(app(),/spent-card/);
  assert.deepEqual(saved(),before);
});
test('les analyses et dépenses sont des pages complètes, leurs périodes et devise restent cohérentes',async()=>{
 const before=saved();await click('tab','analytics');assert.doesNotMatch(app(),/<nav class="nav"/);
 assert.match(app(),/spent-card/);assert.match(app(),/income-card/);assert.match(app(),/cashflow-card/);
 await click('analytics-period');assert.match(sheet(),/Cette semaine/);await click('analytics-select-period','month');assert.match(app(),/Ce mois-ci/);
 await click('expenses',undefined,{period:'month'});assert.doesNotMatch(app(),/<nav class="nav"/);
 for(const period of ['week','halfyear','year']){await click('expenses-period',period);assert.match(app(),new RegExp('data-id="'+period+'" class="is-active"'));}
 await click('expenses-back');assert.match(app(),/spent-card/);await click('back-main');assert.match(app(),/<nav class="nav"/);
 for(const id of ['home','credit','invest','payments','crypto','points'])assert.match(app().slice(app().indexOf('<nav')),new RegExp('data-id="'+id+'"'));
 assert.deepEqual(saved(),before);
});
test('Analytics ouvre les cartes, la carte dépenses ouvre l’anneau et Retour retrouve les cartes',async()=>{
 const before=saved();await click('tab','home');
 assert.match(app(),/data-act="tab" data-id="analytics" aria-label="Analyse des dépenses"/);
 assert.match(app(),/class="euro-flag"/);assert.doesNotMatch(app(),/🇪🇺<\/span>Personnel/);
 await click('tab','analytics');assert.match(app(),/screen analytics-screen/);
 assert.match(app(),/spent-card/);assert.match(app(),/income-card/);assert.doesNotMatch(app(),/expenses-donut/);
 await click('analytics-select-period','year');assert.match(app(),/Cette année/);
 await click('expenses',undefined,{period:'year'});assert.match(app(),/expenses-donut/);
 assert.match(app(),/data-id="year" class="is-active"/);assert.match(app(),/Par catégorie/);
 assert.match(app(),/aria-label="Retour à l’analyse"/);assert.doesNotMatch(app(),/spent-card/);
 await click('expenses-mode','line');assert.match(app(),/Dépenses cumulées/);
 await click('expenses-period','month');assert.match(app(),/data-id="month" class="is-active"/);
 await click('expenses-back');assert.match(app(),/spent-card/);assert.match(app(),/Cette année/);
 await click('expenses',undefined,{period:'year'});assert.match(app(),/expenses-donut/);
 await click('expenses-back');await click('back-main');assert.match(app(),/Vos transactions/);
 assert.deepEqual(saved(),before);
});
test('chaque carte Analytics ouvre son anneau, avec des montants issus du même registre',async()=>{
 const before=saved();await click('tab','analytics');await click('analytics-select-period','year');
 for(const [action,title] of [['income-history','Revenus · Personnel'],['cashflow-history','Flux net · Personnel'],['assets','Actifs totaux · Personnel']]){
  await click(action);assert.match(app(),/expenses-donut/);assert.ok(app().includes(title));
  if(action==='assets'){assert.match(app(),/Soldes actuels/);assert.doesNotMatch(app(),/class="expenses-period-row"/);assert.match(app(),/Par compte/);}
  await click('expenses-back');assert.match(app(),/spent-card/);
 }
 await click('back-main');assert.deepEqual(saved(),before);
});
test('français et anglais se choisissent dans le profil, persistent et préservent les données',async()=>{
 const before=saved();await click('tab','home');await click('profile');assert.match(sheet(),/Langue/);
 await click('language');assert.match(sheet(),/English/);assert.match(sheet(),/Français/);
 await click('select-language','en');assert.equal(values.get('flex-language-v1'),'en');
 assert.equal(document.documentElement.lang,'en');assert.match(app(),/>Search<\/span>/);
 assert.match(app(),/>Accounts<\/button>/);assert.match(app(),/Mock IBAN — not usable/);
 assert.match(disclosure.textContent,/Demonstration — no real bank account/);
 assert.match(sheet(),/App language/);await click('close-sheet');await click('profile');assert.match(sheet(),/Dark mode/);
 await click('tab','analytics');assert.match(app(),/>Analytics<\/h1>/);assert.match(app(),/>Spent<\/span>/);
 await click('expenses',undefined,{period:'year'});assert.match(app(),/Spent · Personal/);assert.match(app(),/This year/);assert.match(app(),/By Category/);
 assert.match(app(),/Demonstration data/);await click('expenses-back');await click('back-main');await click('account-details');
 assert.match(sheet(),/Mock IBAN/);await click('copy-account');assert.match(values.get('clipboard'),/DEMONSTRATION.*Mock IBAN, not usable for a transfer/);
 await click('send');submit('send-form',{recipient:'Paul',amount:'0',currency:'EUR',date:new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}),note:''});assert.match(elements.get('form-error').textContent,/Enter a valid recipient and amount/);assert.deepEqual(saved(),before);
 await click('select-language','invalid');assert.equal(values.get('flex-language-v1'),'en');
 await click('profile');await click('language');await click('select-language','fr');
 assert.equal(document.documentElement.lang,'fr');assert.match(app(),/>Rechercher<\/span>/);
 assert.match(disclosure.textContent,/Démonstration — aucun compte réel/);assert.deepEqual(saved(),before);await click('close-sheet');
});
test('l’IBAN EUR fourni reste identifié comme fictif à l’affichage et lors de la copie',async()=>{
 const iban='FR76 3000 4028 3798 7654 3210 943';
 await click('tab','home');await click('select-account','EUR');const before=saved();
 assert.ok(app().includes(iban));assert.match(app(),/IBAN fictif — non utilisable/);
 await click('account-details');assert.ok(sheet().includes(iban));assert.match(sheet(),/IBAN fictif/);
 assert.match(sheet(),/Aucun compte bancaire réel/);await click('copy-account');
 assert.ok(values.get('clipboard').includes(iban));assert.match(values.get('clipboard'),/DÉMONSTRATION.*IBAN fictif, non utilisable pour un virement/);
 await click('close-sheet');await click('select-account','USD');
 assert.doesNotMatch(app(),/FR76/);assert.match(app(),/TEST-FLEX-USD-0428/);
 await click('account-details');assert.doesNotMatch(sheet(),/FR76/);await click('copy-account');
 assert.match(values.get('clipboard'),/DÉMONSTRATION.*TEST-FLEX-USD-0428.*Référence de test, non utilisable/);
 await click('close-sheet');await click('select-account','EUR');assert.deepEqual(saved(),before);
});
test('cartes promotionnelles et menus ne modifient pas le registre',async()=>{
 const before=saved();await click('tab','home');await click('promo-slide','1');assert.match(app(),/À votre image/);
 await click('promo-slide','2');assert.match(app(),/Place à vos projets/);await click('promo-slide','0');
 await click('move');assert.match(sheet(),/Changer de devise/);await click('close-sheet');
 await click('more');assert.match(sheet(),/Vos cartes/);assert.match(sheet(),/Vos poches/);await click('close-sheet');
 await click('promo-dismiss');assert.doesNotMatch(app(),/promo-carousel/);assert.deepEqual(saved(),before);
});
test('portefeuille et liste de suivi sont fictifs et indépendants des soldes bancaires',async()=>{
 const before=saved();await click('tab','invest');assert.match(app(),/Solde disponible/);
 await click('invest-deposit');assert.match(sheet(),/Le solde des comptes et le registre bancaire ne sont pas modifiés/);
 submit('invest-cash-form',{amount:'100'},{withdraw:'false'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,10000);
 await click('invest-withdraw');submit('invest-cash-form',{amount:'101'},{withdraw:'true'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,10000);assert.match(elements.get('form-error').textContent,/dépasse/);
 submit('invest-cash-form',{amount:'25'},{withdraw:'true'});assert.equal(JSON.parse(values.get('flex-preview-v1')).cash,7500);
 await click('brokerage-toggle');assert.doesNotMatch(app(),/Solde disponible/);await click('brokerage-toggle');
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
  await click('toggle-setting','theme');assert.equal(saved().theme,'dark');assert.match(sheet(),/Toujours activé/);assert.doesNotMatch(sheet(),/data-id="theme"/);
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
test('édition IBAN : validation, coordonnées copiées et annulation sans toucher aux dépenses',async()=>{
  await click('select-language','fr');const before=saved();await click('editor');assert.match(sheet(),/Gérer les dépenses/);assert.match(sheet(),/Modifier l’IBAN/);
  await click('editor-iban');assert.match(sheet(),/id="editor-iban-form"/);
  await submit('editor-iban-form',{iban:'invalid'});assert.deepEqual(saved(),before);assert.match(elements.get('form-error').textContent,/IBAN/);
  await submit('editor-iban-form',{iban:'fr76 3000 4028 3798 7654 3210 943'});
  assert.equal(saved().accountIban,'FR7630004028379876543210943');assert.deepEqual(saved().transactions,before.transactions);assert.deepEqual(saved().wallets,before.wallets);
  await click('account-details');assert.match(sheet(),/FR76 3000 4028 3798 7654 3210 943/);await click('copy-account');assert.match(values.get('clipboard'),/FR76 3000 4028 3798 7654 3210 943/);
  await click('editor');await click('editor-undo');assert.deepEqual(saved(),before);await click('editor-exit');
});
test('édition des dépenses : création, modification, suppression et annulation dans les événements de l’app',async()=>{
  await click('select-language','fr');await click('editor');await click('editor-expenses');assert.match(sheet(),/Ajouter une dépense/);await click('editor-expense-new');assert.match(sheet(),/id="editor-expense-form"/);
  const before=saved(),stamp=new Date(Date.now()-3600000).toISOString();
  const fields={name:'Carrefour City · Paris',amount:'34,57',currency:'EUR',category:'groceries',region:'paris',timestamp:stamp,note:'Courses manuelles'};
  await submit('editor-expense-form',{...fields,amount:'0'});assert.deepEqual(saved(),before);
  await submit('editor-expense-form',fields);const created=saved().transactions.find(tx=>tx.name===fields.name);
  assert.ok(created);assert.equal(created.amount,-3457);assert.equal(created.automatic,false);assert.deepEqual(saved().wallets,before.wallets);assert.match(sheet(),/Dépense créée/);
  await click('transaction',created.id);assert.match(sheet(),/Modifier la dépense/);await click('editor-expense-edit',created.id);assert.match(sheet(),/value="34.57"/);
  await submit('editor-expense-form',{...fields,name:'Carrefour Express · Paris',amount:'51,23',category:'shopping'},{expense:created.id});
  const modified=saved().transactions.find(tx=>tx.id===created.id);assert.equal(modified.amount,-5123);assert.equal(modified.category,'shopping');assert.equal(modified.name,'Carrefour Express · Paris');assert.equal(saved().transactions.length,before.transactions.length+1);assert.deepEqual(saved().wallets,before.wallets);
  const updated=saved();await click('editor-expense-delete',created.id);assert.match(sheet(),/Supprimer la dépense/);assert.deepEqual(saved(),updated);
  await click('editor-expense-delete-confirm',created.id);assert.equal(saved().transactions.some(tx=>tx.id===created.id),false);assert.ok(saved().deletedExpenseIds.includes(created.id));assert.match(sheet(),/Dépense supprimée/);
  await click('editor-undo');assert.deepEqual(saved(),updated);assert.match(sheet(),/dernier changement a été annulé/);
  await click('editor-expense-delete',created.id);await click('editor-expense-delete-confirm',created.id);await click('editor-exit');
  const exited=saved();await submit('editor-expense-form',fields);assert.deepEqual(saved(),exited);await submit('editor-iban-form',{iban:'FR7630004028379876543210943'});assert.deepEqual(saved(),exited);
});
test('les nouveaux formulaires d’édition suivent le choix anglais ou français',async()=>{
  await click('select-language','en');await click('editor');assert.match(sheet(),/Manage expenses/);assert.match(sheet(),/Edit IBAN/);
  await click('editor-expenses');assert.match(sheet(),/Add an expense/);await click('editor-expense-new');assert.match(sheet(),/Expense amount/);assert.match(sheet(),/Date and time/);
  await click('editor-iban');assert.match(sheet(),/Displayed IBAN/);assert.match(sheet(),/Save IBAN/);
  await click('select-language','fr');await click('editor');assert.match(sheet(),/Gérer les dépenses/);await click('editor-exit');
});

test('fiche dépense : modifier directement sans activer le mode édition, puis revenir et annuler',async()=>{
  await click('select-language','fr');await click('editor-exit');
  const before=saved(),tx=before.transactions.find(tx=>tx.amount<0&&tx.status==='completed'&&!['exchange','savings'].includes(tx.category));assert.ok(tx);
  await click('transaction',tx.id);assert.match(sheet(),/Modifier la dépense/);assert.match(sheet(),/Supprimer cette dépense/);assert.doesNotMatch(app(),/editor-banner/);assert.deepEqual(saved(),before);
  await click('editor-expense-edit',tx.id);assert.match(sheet(),/id="editor-expense-form"/);assert.match(sheet(),/Retour à la dépense/);assert.doesNotMatch(app(),/editor-banner/);
  const fields={name:tx.name,amount:'18,76',currency:tx.currency,category:tx.category,region:tx.region,timestamp:tx.timestamp,note:tx.note||''};
  await submit('editor-expense-form',{...fields,amount:'0'},{expense:tx.id});assert.deepEqual(saved(),before);
  await submit('editor-expense-form',fields,{expense:tx.id});assert.equal(saved().transactions.find(item=>item.id===tx.id).amount,-1876);assert.deepEqual(saved().wallets,before.wallets);assert.match(sheet(),/Détails de la transaction/);assert.match(sheet(),/Annuler le dernier changement/);assert.doesNotMatch(app(),/editor-banner/);
  await click('editor-undo');assert.deepEqual(saved(),before);assert.match(sheet(),/Modifier la dépense/);assert.doesNotMatch(app(),/editor-banner/);
  await click('editor-expense-edit',tx.id);await click('close-sheet');await submit('editor-expense-form',fields,{expense:tx.id});assert.deepEqual(saved(),before);
});
test('fiche dépense : suppression directe avec confirmation, annulation et restauration',async()=>{
  const before=saved(),tx=before.transactions.find(tx=>tx.amount<0&&tx.status==='completed'&&!['exchange','savings'].includes(tx.category));assert.ok(tx);
  await click('transaction',tx.id);await click('editor-expense-delete',tx.id);assert.match(sheet(),/Supprimer la dépense/);assert.deepEqual(saved(),before);assert.match(sheet(),new RegExp('data-act="transaction" data-id="'+tx.id+'"'));assert.doesNotMatch(app(),/editor-banner/);
  await click('transaction',tx.id);assert.deepEqual(saved(),before);await click('editor-expense-delete',tx.id);await click('editor-expense-delete-confirm',tx.id);
  assert.equal(saved().transactions.some(item=>item.id===tx.id),false);assert.ok(saved().deletedExpenseIds.includes(tx.id));assert.deepEqual(saved().wallets,before.wallets);assert.match(sheet(),/Dépense supprimée/);assert.match(sheet(),/Annuler le dernier changement/);assert.doesNotMatch(app(),/editor-banner/);
  await click('editor-undo');assert.deepEqual(saved(),before);assert.match(sheet(),/Détails de la transaction/);assert.doesNotMatch(app(),/editor-banner/);
  const income=saved().transactions.find(tx=>tx.amount>0);assert.ok(income);await click('transaction',income.id);assert.doesNotMatch(sheet(),/data-act="editor-expense-(edit|delete)"/);await click('editor-expense-edit',income.id);assert.deepEqual(saved(),before);
  await click('close-sheet');
});

test('fiche dépense : menu discret près de Fermer, fermeture extérieure et Échap sans changer les données',async()=>{
  await click('select-language','fr');
  const before=saved(),tx=before.transactions.find(tx=>tx.amount<0&&tx.status==='completed'&&!['exchange','savings'].includes(tx.category));
  await click('transaction',tx.id);
  const content=sheet(),header=content.slice(content.indexOf('<div class="sheet-header">'),content.indexOf('<div class="detail-hero">'));
  assert.match(header,/<details class="expense-detail-menu"><summary class="icon-button" aria-label="Options de la dépense">/);
  assert.doesNotMatch(header,/<details[^>]*\bopen\b/);
  assert.ok(header.indexOf('expense-detail-menu')<header.indexOf('data-act="close-sheet"'));
  assert.match(header,/data-act="editor-expense-edit"/);assert.match(header,/data-act="editor-expense-delete"/);
  assert.doesNotMatch(content,/expense-detail-actions/);
  const root=elements.get('sheet-root'),query=root.querySelector,queryAll=root.querySelectorAll;
  let focused=false,prevented=false;
  const menu={open:true,contains:target=>Boolean(target.insideMenu),querySelector:()=>({focus(){focused=true;}})};
  const selector='.expense-detail-menu[open]';
  try{
    root.querySelector=value=>value===selector&&menu.open?menu:query.call(root,value);
    root.querySelectorAll=value=>value===selector&&menu.open?[menu]:queryAll.call(root,value);
    const target=insideMenu=>({insideMenu,classList:{contains:()=>false},closest:()=>null});
    await events.get('click')({target:target(true)});assert.equal(menu.open,true);
    await events.get('click')({target:target(false)});assert.equal(menu.open,false);assert.equal(sheet(),content);
    menu.open=true;events.get('keydown')({key:'Escape',preventDefault(){prevented=true;}});
    assert.equal(menu.open,false);assert.equal(focused,true);assert.equal(prevented,true);assert.equal(sheet(),content);
  }finally{root.querySelector=query;root.querySelectorAll=queryAll;}
  assert.deepEqual(saved(),before);
  await click('select-language','en');await click('transaction',tx.id);assert.match(sheet(),/aria-label="Expense options"/);assert.match(sheet(),/aria-label="Expense actions"/);
  await click('select-language','fr');await click('close-sheet');
});

test('export CSV, données valides et verrouillage final',async()=>{
  await click('export');
  assert.match(download.at(-1),/^Flex-DEMO-transactions-/);
  assert.ok(assertState(saved()));
  await click('lock');
  assert.match(app(),/Saisissez votre code/);
  assert.doesNotMatch(app(),/Solde/);
});
