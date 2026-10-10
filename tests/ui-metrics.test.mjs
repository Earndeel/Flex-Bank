import test from 'node:test';
import assert from 'node:assert/strict';
import {displayMoney,periodRange,shiftPeriod,dashboardMetrics,creditProjection} from '../dist/ui-metrics.js';
import {expenseMetrics} from '../dist/expenses.js';
const now=new Date('2026-10-10T20:00:00Z');
const tx=(id,amount,timestamp,extra={})=>({id,amount,timestamp,currency:'EUR',category:amount>0?'income':'restaurant',status:'completed',...extra});
test('symboles préfixés, signe et centimes conservés',()=>{
 assert.equal(displayMoney(205360),'€2\u202f053,60');
 assert.equal(displayMoney(-1888),'-€18,88');
 assert.equal(displayMoney(0,'USD',{digits:0}),'$0');
 assert.equal(displayMoney(432123,'EUR',{digits:0}),'€4\u202f321');
});
test('semaines du lundi au dimanche avec bascule de fuseau',()=>{
 const utc=periodRange({period:'week',now:new Date('2026-10-11T23:30:00Z'),timeZone:'UTC'});
 const cairo=periodRange({period:'week',now:new Date('2026-10-11T23:30:00Z'),timeZone:'Africa/Cairo'});
 assert.equal(utc.start,'2026-10-05');assert.equal(utc.end,'2026-10-11');assert.equal(utc.keys.length,7);
 assert.equal(cairo.start,'2026-10-12');
 assert.equal(shiftPeriod('2026-10-05','week',-1),'2026-09-28');
});
test('six mois calendaires, années bissextiles et ancres invalides',()=>{
 const range=periodRange({period:'halfyear',now,timeZone:'UTC'});
 assert.equal(range.start,'2026-05-01');assert.equal(range.end,'2026-10-31');assert.equal(range.keys.length,6);
 assert.equal(shiftPeriod('2026-02','halfyear',-1),'2025-08');
 assert.equal(periodRange({period:'month',anchor:'2024-02',now}).keys.length,29);
 assert.equal(periodRange({period:'week',anchor:'2026-02-31',now}).anchor,'2026-10-05');
 assert.equal(periodRange({period:'month',anchor:'2026-13',now}).anchor,'2026-10');
});
test('tous les graphiques et catégories couvrent la même plage sans doublons',()=>{
 const ledger=[tx('old',-900,'2026-04-30T12:00:00Z'),tx('may',-1000,'2026-05-01T12:00:00Z'),tx('sep',-2000,'2026-09-30T12:00:00Z'),tx('mon',-3000,'2026-10-05T12:00:00Z'),tx('today',-4000,'2026-10-10T12:00:00Z'),tx('future',-5000,'2026-10-11T12:00:00Z')];
 const before=structuredClone(ledger);
 const week=expenseMetrics(ledger,{period:'week',now,timeZone:'UTC'});
 assert.equal(week.total,7000);assert.equal(week.series.length,7);
 const halfyear=expenseMetrics(ledger,{period:'halfyear',now,timeZone:'UTC'});
 assert.equal(halfyear.total,10000);assert.equal(halfyear.series.length,6);
 for(const metrics of [week,halfyear]){assert.equal(metrics.series.reduce((s,x)=>s+x.value,0),metrics.total);assert.equal(metrics.categories.reduce((s,x)=>s+x.value,0),metrics.total);}
 assert.deepEqual(ledger,before);
});
test('revenus, dépenses et cashflow sont cohérents avec les dépenses détaillées',()=>{
 const state={wallets:{EUR:100000,USD:11200},pockets:[{balance:12000}],transactions:[tx('prev',20000,'2026-10-01T12:00:00Z'),tx('income',35000,'2026-10-07T12:00:00Z'),tx('meal',-4900,'2026-10-08T12:00:00Z'),tx('transfer',-3000,'2026-10-09T12:00:00Z',{category:'transfer'}),tx('change',-2000,'2026-10-09T12:00:00Z',{category:'exchange'}),tx('pocket',-1000,'2026-10-09T12:00:00Z',{category:'savings'}),tx('declined',-4000,'2026-10-09T12:00:00Z',{status:'declined'}),tx('usd',-1000,'2026-10-09T12:00:00Z',{currency:'USD'}),tx('future',10000,'2026-10-12T12:00:00Z')]};
 const original=structuredClone(state),options={period:'week',now,timeZone:'UTC',rates:{EUR:1,USD:1.12}};
 const dashboard=dashboardMetrics(state,options),expenses=expenseMetrics(state.transactions,options);
 assert.equal(dashboard.spent,7900);assert.equal(dashboard.spent,expenses.total);assert.equal(dashboard.income,35000);assert.equal(dashboard.net,27100);
 assert.equal(dashboard.incomeChange,15000);assert.equal(dashboard.previousIncome,20000);
 assert.equal(dashboard.cash,110000);assert.equal(dashboard.assets,122000);
 assert.equal(dashboard.daily.reduce((s,d)=>s+d.income,0),dashboard.income);assert.equal(dashboard.daily.reduce((s,d)=>s+d.expense,0),dashboard.spent);
 assert.deepEqual(state,original);
});
test('les analyses suivent la devise sélectionnée et valorisent les poches une seule fois',()=>{
 const state={wallets:{EUR:100000,USD:11200},pockets:[{balance:12000}],transactions:[tx('usd',-1000,'2026-10-09T12:00:00Z',{currency:'USD'}),tx('eur',-5000,'2026-10-09T12:00:00Z')]};
 const metrics=dashboardMetrics(state,{period:'week',currency:'USD',now,timeZone:'UTC',rates:{EUR:1,USD:1.12}});
 assert.equal(metrics.spent,1000);assert.equal(metrics.assets,136640);
 assert.equal(expenseMetrics(state.transactions,{period:'week',currency:'USD',now,timeZone:'UTC'}).total,1000);
});
test('mensualités illustratives : taux nul, taux positif et saisies invalides',()=>{
 assert.deepEqual(creditProjection(1200,12,0),{monthly:10000,total:120000,interest:0});
 const p=creditProjection(5000,24,5);
 assert.equal(p.monthly,21936);assert.equal(p.total-p.interest,500000);
 for(const args of [[0,12,5],[1000,0,5],[1000,12,-1],[Infinity,12,5],[1000,12.5,5]])assert.throws(()=>creditProjection(...args));
});

test('les graphiques mensuels et annuels contiennent les revenus réels de la période',()=>{
 const state={wallets:{EUR:100000},pockets:[],transactions:[tx('jul',10000,'2026-07-05T12:00:00Z'),tx('oct',20000,'2026-10-07T12:00:00Z')]};
 for(const period of ['month','halfyear','year']){
  const metrics=dashboardMetrics(state,{period,now,timeZone:'UTC'});
  assert.equal(metrics.daily.reduce((sum,d)=>sum+d.income,0),metrics.income);
  assert.equal(metrics.income,period==='month'?20000:30000);
 }
});
