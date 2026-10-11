import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,assertState,FLOOR,RATES,rollForward} from '../dist/core.js';
import {reconcileLedger,regenerateScenario,scenarioFingerprint} from '../dist/scenario.js';
import {expenseMetrics} from '../dist/expenses.js';
import {restoreProfile} from '../dist/setup.js';
import {isEditableExpense,saveExpense,deleteExpense,normalizeIban,formatIban,changeAccountIban,renderExpenseList,renderExpenseForm,renderIbanForm,localDateTime} from '../dist/expense-editor.js';

const now=new Date('2026-10-11T20:00:00Z');
const input={id:'manual-editor-test',name:'Monoprix · Paris',amount:4399,currency:'EUR',category:'groceries',region:'paris',timestamp:'2026-10-01T14:12:00Z',note:'Courses du jeudi'};
function fixture() {
  const state=initialState(now,{generateHistory:false});state.wallets.EUR=6500000;
  return reconcileLedger(state,[
    {id:'coffee',name:'Café des Arts',amount:-420,currency:'EUR',category:'coffee',region:'paris',timestamp:'2026-09-02T08:00:00Z',originalCurrency:'EUR',originalAmount:420,automatic:true,status:'completed'},
    {id:'salary',name:'Salaire',amount:250000,currency:'EUR',category:'income',region:'paris',timestamp:'2026-09-25T09:00:00Z',automatic:true,status:'completed'},
    {id:'shop',name:'Siam Paragon',amount:-9999,currency:'EUR',category:'shopping',region:'bangkok',timestamp:'2026-09-28T16:00:00Z',originalCurrency:'THB',originalAmount:381962,automatic:true,status:'completed'}
  ],state.wallets);
}
function verifyLedger(state) {
  assert.ok(assertState(state));const running={...state.scenarioOpening};
  assert.equal(new Set(state.transactions.map(tx=>tx.id)).size,state.transactions.length);
  for(const tx of state.transactions){running[tx.currency]+=tx.amount;assert.equal(tx.balanceAfter,running[tx.currency]);assert.ok(tx.balanceAfter>=(tx.currency==='EUR'?FLOOR:0));}
  assert.deepEqual(running,state.wallets);
}
test('ajout manuel : centimes exacts, aucun crédit compensatoire et soldes conservés',()=>{
  const state=fixture(),snapshot=JSON.stringify(state),next=saveExpense(state,input,{now});
  assert.equal(JSON.stringify(state),snapshot);assert.deepEqual(next.wallets,state.wallets);
  assert.equal(next.transactions.length,state.transactions.length+1);const tx=next.transactions.find(tx=>tx.id===input.id);
  assert.equal(tx.amount,-4399);assert.equal(tx.name,input.name);assert.equal(tx.city,'Paris');assert.equal(tx.automatic,false);assert.equal(tx.demo,true);
  assert.equal(next.transactions.filter(tx=>tx.amount>0).length,1);verifyLedger(next);
  assert.equal(expenseMetrics(next.transactions,{period:'year',now,timeZone:'Europe/Paris'}).total,expenseMetrics(state.transactions,{period:'year',now,timeZone:'Europe/Paris'}).total+4399);
});
test('modification : Analytics, montant local, date, catégorie et devise restent cohérents',()=>{
  const state=fixture(),next=saveExpense(state,{...input,amount:12501,region:'bangkok',category:'restaurant',name:'Sukhumvit Kitchen'},{id:'shop',now});
  const tx=next.transactions.find(tx=>tx.id==='shop');assert.equal(tx.amount,-12501);assert.equal(tx.originalAmount,Math.round(12501*RATES.THB));assert.equal(tx.category,'restaurant');assert.equal(tx.automatic,false);verifyLedger(next);
  const changed=saveExpense(next,{...input,amount:799,region:'london',currency:'GBP',category:'transport'},{id:'shop',now});
  const updated=changed.transactions.find(tx=>tx.id==='shop');assert.equal(updated.currency,'GBP');assert.equal(updated.city,'Londres');assert.equal(updated.originalCurrency,'GBP');assert.equal(updated.originalAmount,799);verifyLedger(changed);
});
test('suppression : l’opération quitte les totaux et le registre reste réconcilié',()=>{
  const state=fixture(),next=deleteExpense(state,'coffee');assert.equal(next.transactions.some(tx=>tx.id==='coffee'),false);assert.deepEqual(next.deletedExpenseIds,['coffee']);assert.deepEqual(next.wallets,state.wallets);verifyLedger(next);
  assert.equal(expenseMetrics(next.transactions,{period:'year',now}).total,expenseMetrics(state.transactions,{period:'year',now}).total-420);
  assert.throws(()=>deleteExpense(next,'coffee'));assert.throws(()=>deleteExpense(state,'salary'));
});
test('régénération : modifications manuelles conservées, dépenses supprimées exclues et aucun doublon',()=>{
  const state=fixture(),config={version:1,seed:'expense-editor-test',monthlyIncome:100000,monthlyExpenses:90000,incomeKind:'salary',incomeDay:25,stops:[{date:'2026-07-01',regionId:'paris'}]};
  const generated=regenerateScenario(state,config,state.wallets,now);
  const expenses=generated.transactions.filter(tx=>isEditableExpense(tx)&&tx.automatic);
  const editedId=expenses[0].id,deletedId=expenses[1].id;
  const edited=saveExpense(generated,{...input,amount:8123},{id:editedId,now}),removed=deleteExpense(edited,deletedId);
  const regenerated=regenerateScenario(removed,config,removed.wallets,now);
  assert.equal(regenerated.transactions.filter(tx=>tx.id===editedId).length,1);assert.equal(regenerated.transactions.find(tx=>tx.id===editedId).amount,-8123);assert.equal(regenerated.transactions.some(tx=>tx.id===deletedId),false);verifyLedger(regenerated);
  const newSeed=regenerateScenario(removed,{...config,seed:'next-expense-editor-test'},removed.wallets,now);
  assert.equal(newSeed.transactions.find(tx=>tx.id===editedId).amount,-8123);verifyLedger(newSeed);
});
test('réouverture : une dépense générée supprimée aujourd’hui ne réapparaît pas',()=>{
  const state=fixture(),config={version:1,seed:'today-delete-test',monthlyIncome:0,monthlyExpenses:80000,incomeKind:'salary',incomeDay:25,stops:[{date:'2026-07-01',regionId:'paris'}]};
  const generated=regenerateScenario(state,config,state.wallets,now),tx=generated.transactions.find(tx=>tx.timestamp.startsWith('2026-10-11')&&isEditableExpense(tx));assert.ok(tx);
  const removed=deleteExpense(generated,tx.id);removed.simulationResumedAt='2026-07-01T00:00:00Z';removed.location.updatedAt=removed.simulationResumedAt;
  const reopened=restoreProfile(JSON.stringify(removed),now);assert.ok(reopened);rollForward(reopened,now);assert.equal(reopened.transactions.some(item=>item.id===tx.id),false);assert.deepEqual(reopened.deletedExpenseIds,[tx.id]);verifyLedger(reopened);
});
test('saisies invalides : aucune mutation du compte ou des opérations',()=>{
  const state=fixture(),snapshot=JSON.stringify(state);
  for(const invalid of [{amount:0},{amount:-1},{amount:12.5},{amount:100000001},{name:''},{name:'a'.repeat(81)},{currency:'XYZ'},{category:'exchange'},{region:'missing'},{timestamp:'invalid'},{timestamp:'2026-10-12T00:00:00Z'},{id:'coffee'}]){
    assert.throws(()=>saveExpense(state,{...input,...invalid},{now}));assert.equal(JSON.stringify(state),snapshot);
  }
  assert.throws(()=>saveExpense(state,input,{id:'salary',now}));assert.throws(()=>saveExpense(state,input,{id:'missing',now}));
});
test('IBAN : normalisation, affichage, restauration et annulation contrôlée par l’empreinte',()=>{
  const state=fixture(),snapshot=JSON.stringify(state),iban='fr76 3000 4028 3798 7654 3210 943';
  assert.equal(normalizeIban(iban),'FR7630004028379876543210943');assert.equal(formatIban(normalizeIban(iban)),iban.toUpperCase());
  const next=changeAccountIban(state,iban);assert.equal(JSON.stringify(state),snapshot);assert.deepEqual(next.transactions,state.transactions);assert.deepEqual(next.wallets,state.wallets);
  assert.notEqual(scenarioFingerprint(next),scenarioFingerprint(state));assert.equal(restoreProfile(JSON.stringify(next),now).accountIban,next.accountIban);assert.ok(assertState(next));
  for(const invalid of ['', 'FR-76 1234567890123','123456789012345','FR76<script>123456789012345','FR76'+'1'.repeat(31)])assert.throws(()=>normalizeIban(invalid));
  assert.equal(assertState({...state,accountIban:'not-an-iban'}),false);assert.equal(assertState({...state,deletedExpenseIds:'coffee'}),false);
});
test('éditeur : libellés échappés, formulaire complet et pagination des dépenses',()=>{
  const state=fixture();state.transactions[0].name='<img src=x onerror=alert(1)>';state.transactions[2].name=state.transactions[0].name;
  const list=renderExpenseList(state,{limit:1,notice:'Enregistré'});assert.match(list,/&lt;img/);assert.doesNotMatch(list,/<img src=x/);assert.match(list,/Voir plus de dépenses/);assert.match(list,/role="status"/);
  const form=renderExpenseForm(state,{id:'coffee',now});assert.match(form,/name="amount"/);assert.match(form,/name="timestamp"/);assert.match(form,/name="region"/);assert.match(form,/name="category"/);assert.match(form,/data-expense="coffee"/);assert.ok(localDateTime(now.toISOString()).startsWith('2026-10-'));
  assert.match(renderIbanForm('FR7630004028379876543210943'),/name="iban"/);assert.equal(isEditableExpense(state.transactions[1]),false);assert.equal(isEditableExpense({...state.transactions[0],status:'declined'}),false);
});
