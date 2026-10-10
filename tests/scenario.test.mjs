import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOOR,RATES,initialState,assertState,rollForward,dailyCandidates,validScenario,topUp,pocketMove} from '../dist/core.js';
import {scenarioDefaults,regenerateScenario,changeScenarioBalances,renderScenarioEditor,scenarioFingerprint} from '../dist/scenario.js';

const now=new Date('2026-10-10T12:00:00Z');
const config={version:1,seed:'scenario-test',monthlyIncome:300000,monthlyExpenses:120000,incomeKind:'salary',incomeDay:25,stops:[{date:'2026-07-10',regionId:'bangkok'},{date:'2026-09-01',regionId:'paris'},{date:'2026-10-01',regionId:'aswan'}]};
const targets=state=>({...state.wallets,EUR:8000000});
test('régénération : clôture exacte, tous les soldes intermédiaires cohérents et opérations manuelles conservées',()=>{
  const state=initialState(now);topUp(state,5000,'USD','Carte',new Date('2026-10-09T12:00:00Z'));pocketMove(state,'p1',1200,'deposit',new Date('2026-10-09T13:00:00Z'));
  const original=structuredClone(state),wallets=targets(state),next=regenerateScenario(state,config,wallets,now);
  assert.deepEqual(state,original);assert.deepEqual(next.wallets,wallets);assert.ok(assertState(next));
  for(const key of ['contacts','cards','pockets','schedules','requests'])assert.deepEqual(next[key],state[key]);
  for(const tx of state.transactions.filter(t=>!t.automatic)){
    const kept=next.transactions.find(t=>t.id===tx.id);assert.ok(kept);assert.equal(kept.amount,tx.amount);assert.equal(kept.timestamp,tx.timestamp);
  }
  const running={...next.scenarioOpening};
  for(const tx of next.transactions){running[tx.currency]+=tx.amount;assert.equal(tx.balanceAfter,running[tx.currency]);assert.ok(running[tx.currency]>=(tx.currency==='EUR'?FLOOR:0));}
  assert.deepEqual(running,wallets);
  assert.ok(next.transactions.filter(t=>t.automatic).every(t=>t.demo===true));
});
test('l’itinéraire commande les enseignes, les lieux et les montants locaux sans événements futurs',()=>{
  const state=initialState(now),next=regenerateScenario(state,config,targets(state),now),generated=next.transactions.filter(t=>t.automatic);
  assert.equal(new Set(generated.map(t=>t.id)).size,generated.length);
  assert.ok(generated.every(t=>Date.parse(t.timestamp)<=now.getTime()));
  assert.ok(generated.some(t=>t.region==='bangkok'&&t.originalCurrency==='THB'));
  assert.ok(generated.some(t=>t.region==='paris'&&t.originalCurrency==='EUR'));
  assert.ok(generated.some(t=>t.region==='aswan'&&t.originalCurrency==='EGP'));
  for(const tx of generated.filter(t=>t.originalAmount))assert.equal(tx.originalAmount,Math.round(-tx.amount*RATES[tx.originalCurrency]));
  assert.deepEqual(regenerateScenario(state,config,targets(state),now),next);
  assert.notDeepEqual(regenerateScenario(state,{...config,seed:'another-seed'},targets(state),now).transactions,next.transactions);
});
test('un solde incompatible ou des réglages invalides sont refusés sans changement des données',()=>{
  const state=initialState(now),original=structuredClone(state);
  assert.throws(()=>regenerateScenario(state,{...config,monthlyIncome:100000000},{...state.wallets,EUR:FLOOR},now),/doit être au moins/);
  assert.throws(()=>changeScenarioBalances(state,{...state.wallets,EUR:2300000},now),/23 000/);
  assert.throws(()=>regenerateScenario(state,{...config,monthlyExpenses:-1},targets(state),now),/Vérifie/);
  assert.throws(()=>regenerateScenario(state,{...config,stops:[{date:'2026-07-10',regionId:'paris'},{date:'2026-11-01',regionId:'aswan'}]},targets(state),now),/aujourd’hui/);
  assert.equal(validScenario({...config,stops:[{date:'2026-02-30',regionId:'aswan'}]}),false);
  assert.equal(validScenario({...config,stops:[config.stops[0],config.stops[0]]}),false);
  assert.deepEqual(state,original);
});
test('modifier les soldes conserve les opérations et recalcule uniquement leurs soldes intermédiaires',()=>{
  const state=initialState(now),wallets={...state.wallets,EUR:5500000,USD:230000,THB:152500};
  const next=changeScenarioBalances(state,wallets,now);
  assert.deepEqual(next.wallets,wallets);assert.ok(next.scenario);assert.ok(assertState(next));
  assert.equal(next.transactions.length,state.transactions.length);
  for(let i=0;i<next.transactions.length;i++){
    const old=state.transactions.find(t=>t.id===next.transactions[i].id);const {balanceAfter,...rest}=next.transactions[i];const {balanceAfter:oldAfter,...oldRest}=old;assert.deepEqual(rest,oldRest);
  }
});
test('l’activité quotidienne reprend le scénario sans doublon et garde les limites de carte',()=>{
  const state=initialState(now),next=regenerateScenario(state,config,targets(state),now);
  const later=new Date('2026-10-13T20:00:00Z'),before=next.transactions.length;
  assert.ok(rollForward(next,later)>0);assert.ok(next.transactions.length>before);
  const count=next.transactions.length,wallets={...next.wallets};assert.equal(rollForward(next,later),0);assert.equal(next.transactions.length,count);assert.deepEqual(next.wallets,wallets);
  assert.equal(new Set(next.transactions.map(t=>t.id)).size,next.transactions.length);
  assert.ok(next.transactions.filter(t=>Date.parse(t.timestamp)>now.getTime()).every(t=>t.demo&&t.scenarioSeed===config.seed));
  next.cards.frozen=true;rollForward(next,new Date('2026-10-14T20:00:00Z'));
  assert.ok(next.transactions.some(t=>t.status==='declined'&&t.demo));assert.ok(assertState(next));
});
test('les revenus indépendants totalisent le réglage mensuel et sont datés les jours ouvrés',()=>{
  const freelance={...config,incomeKind:'freelance',monthlyIncome:123457,incomeDay:25};
  const income=[];for(let day=1;day<=31;day++)income.push(...dailyCandidates('2026-08-'+String(day).padStart(2,'0'),'paris',freelance).filter(t=>t.category==='income'));
  assert.equal(income.length,2);assert.equal(income.reduce((sum,t)=>sum+t.amount,0),freelance.monthlyIncome);
  for(const tx of income){const localDay=new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'Europe/Paris'}).format(new Date(tx.timestamp));assert.ok(!['Sat','Sun'].includes(localDay));}
  const firstDay=[];for(let day=1;day<=31;day++)firstDay.push(...dailyCandidates('2026-08-'+String(day).padStart(2,'0'),'paris',{...freelance,incomeDay:1}).filter(t=>t.category==='income'));
  assert.equal(firstDay.length,2);assert.equal(firstDay.reduce((sum,t)=>sum+t.amount,0),freelance.monthlyIncome);
});
test('zéro revenu et zéro dépense génèrent un historique vide tout en conservant le solde choisi',()=>{
  const state=initialState(now),next=regenerateScenario(state,{...config,monthlyIncome:0,monthlyExpenses:0},targets(state),now);
  assert.equal(next.transactions.length,0);assert.equal(next.scenarioSummary.count,0);assert.deepEqual(next.wallets,targets(state));assert.ok(assertState(next));
});
test('le formulaire et l’état sauvegardé restent explicitement des scénarios de démonstration',()=>{
  const state=initialState(now),draft=scenarioDefaults(state,now),html=renderScenarioEditor(draft,{canUndo:true,now});
  assert.match(html,/scénario de démonstration/);assert.match(html,/wallet-EUR/);assert.match(html,/Régénérer dépenses et revenus/);assert.match(html,/Annuler le dernier changement/);
  const next=regenerateScenario(state,config,targets(state),now);assert.ok(assertState(JSON.parse(JSON.stringify(next))));
  const fingerprint=scenarioFingerprint(next);next.contacts.push({id:'new',name:'Contact'});assert.equal(scenarioFingerprint(next),fingerprint);next.wallets.EUR++;assert.notEqual(scenarioFingerprint(next),fingerprint);
});
