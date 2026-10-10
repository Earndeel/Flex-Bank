import test from 'node:test';
import assert from 'node:assert/strict';
import {expenseMetrics,shiftExpensePeriod,renderExpenseSummary} from '../dist/expenses.js';

const tx=(id,amount,category='restaurant',extra={})=>({id,amount,category,currency:'EUR',status:'completed',timestamp:'2026-10-12T12:00:00Z',...extra});
const options={period:'month',anchor:'2026-10',timeZone:'UTC',now:new Date('2026-10-31T23:59:59Z')};
test('les totaux, catégories et séries représentent les mêmes dépenses sans modifier le registre',()=>{
  const ledger=[tx('meal',-3200),tx('food',-4500,'groceries'),tx('transfer',-1200,'transfer'),tx('income',100000,'income'),tx('change',-4000,'exchange'),tx('pocket',-2500,'savings'),tx('refused',-900,'coffee',{status:'declined'}),tx('dollars',-1000,'coffee',{currency:'USD'}),tx('future',-1500,'shopping',{timestamp:'2026-11-01T12:00:00Z'})];
  const original=structuredClone(ledger),metrics=expenseMetrics(ledger,options);
  assert.equal(metrics.total,8900);
  assert.equal(metrics.categories.reduce((n,c)=>n+c.value,0),metrics.total);
  assert.equal(metrics.series.reduce((n,s)=>n+s.value,0),metrics.total);
  assert.deepEqual(metrics.transactions.map(t=>t.id).sort(),['food','meal','transfer']);
  assert.deepEqual(ledger,original);
});
test('les limites de période suivent le fuseau choisi et les mois calendaires',()=>{
  const ledger=[tx('bangkok',-2500,'restaurant',{timestamp:'2026-10-31T18:00:00Z'}),tx('october',-700,'coffee',{timestamp:'2026-10-31T12:00:00Z'}),tx('last-year',-2000,'transport',{timestamp:'2025-12-31T18:00:00Z'})];
  const now=new Date('2026-11-05T12:00:00Z');
  assert.equal(expenseMetrics(ledger,{period:'month',anchor:'2026-11',timeZone:'Asia/Bangkok',now}).total,2500);
  assert.equal(expenseMetrics(ledger,{period:'year',anchor:'2026',timeZone:'Asia/Bangkok',now}).total,5200);
  assert.equal(expenseMetrics([],{...options,anchor:'2024-02'}).series.length,29);
  assert.equal(shiftExpensePeriod('2026-01','month',-1),'2025-12');
  assert.equal(shiftExpensePeriod('2025-12','month',1),'2026-01');
  assert.equal(shiftExpensePeriod('2026','year',-1),'2025');
});
test('une période vide et une catégorie unique rendent un anneau valide',()=>{
  const settings={money:n=>(n/100).toFixed(2)+' €',icon:()=>'',metadata:{restaurant:{label:'Restaurants',icon:'utensils'}}};
  const empty=expenseMetrics([],options);
  assert.equal(empty.total,0);
  assert.equal(empty.canNext,false);
  const html=renderExpenseSummary(empty,settings);
  assert.match(html,/Aucune dépense/);
  assert.doesNotMatch(html,/NaN|Infinity/);
  const one=renderExpenseSummary(expenseMetrics([tx('meal',-432123)],options),settings);
  assert.match(one,/<circle[^>]+stroke="#ff7635"/);
});
test('masquer les montants protège le total, les catégories et les graphiques accessibles',()=>{
  const metrics=expenseMetrics([tx('meal',-432123)],options);
  for(const mode of ['donut','bars','line']){
    const html=renderExpenseSummary(metrics,{mode,hidden:true,money:()=>{throw Error('Aucun montant ne doit être formaté');},icon:()=>'',metadata:{}});
    assert.match(html,/••••/);
    assert.doesNotMatch(html,/432123|4[\s\u202f\u00a0]?321/);
    if(mode!=='donut')assert.match(html,/Montants masqués/);
  }
});
