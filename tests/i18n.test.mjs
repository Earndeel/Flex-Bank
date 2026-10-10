import test from 'node:test';
import assert from 'node:assert/strict';
import {LANGUAGE_KEY,readLanguage,setLanguage,getLanguage,getLocale,tr,localizeHTML} from '../dist/i18n.js';
import {displayMoney,periodRange,dashboardMetrics} from '../dist/ui-metrics.js';
import {initialState} from '../dist/core.js';
test('préférence valide persistée, choix invalide refusé et stockage indisponible toléré',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(readLanguage(storage),'en');assert.ok(setLanguage('fr',storage));assert.equal(readLanguage(storage),'fr');
 assert.equal(getLocale(),'fr-FR');assert.equal(values.get(LANGUAGE_KEY),'fr');
 assert.equal(setLanguage('de',storage),false);assert.equal(getLanguage(),'fr');
 assert.equal(readLanguage({getItem(){throw Error('unavailable');}}),'en');assert.ok(setLanguage('en',{setItem(){throw Error('unavailable');}}));
 assert.equal(getLocale(),'en-GB');
});
test('libellés bidirectionnels, compte et pluriels sans modification des noms inconnus',()=>{
 assert.equal(tr('Search','fr'),'Rechercher');assert.equal(tr('Rechercher','en'),'Search');
 assert.equal(tr('Personal · EUR','fr'),'Personnel · EUR');assert.equal(tr('2 transactions','fr'),'2 opérations');
 assert.equal(tr('1 opération','en'),'1 transaction');assert.equal(tr('Lucas Jouvençon','en'),'Lucas Jouvençon');
});
test('la traduction HTML protège données, attributs techniques et tracés vectoriels',()=>{
 const source='<button data-act="Search" data-id="Dépenses" aria-label="Masquer les montants">Search</button><input value="Search" placeholder="Prénom ou nom"><span data-i18n-skip>Search</span><svg><title>Search</title><path d="M0 0L1 1"/></svg>';
 const html=localizeHTML(source,'fr');assert.match(html,/>Rechercher<\/button>/);assert.match(html,/data-act="Search" data-id="Dépenses"/);
 assert.match(html,/value="Search"/);assert.match(html,/<span data-i18n-skip>Search<\/span>/);
 assert.match(html,/<svg><title>Search<\/title><path d="M0 0L1 1"\/><\/svg>/);
 assert.match(localizeHTML('<span>À partir du</span>','en'),/>From date<\/span>/);
});
test('dates et montants suivent la langue sans changer la plage ou les métriques',()=>{
 assert.equal(displayMoney(123456,'EUR',{locale:'en-GB'}),'€1,234.56');assert.equal(displayMoney(123456,'EUR',{locale:'fr-FR'}),'€1\u202f234,56');
 const settings={period:'month',anchor:'2026-10',timeZone:'Africa/Cairo',now:new Date('2026-10-11T12:00:00Z')};
 const en=periodRange({...settings,locale:'en-GB'}),fr=periodRange({...settings,locale:'fr-FR'});
 assert.equal(en.start,fr.start);assert.equal(en.end,fr.end);assert.deepEqual(en.keys,fr.keys);
 assert.equal(en.caption,'This month');assert.equal(fr.caption,'Ce mois-ci');assert.equal(en.rangeLabel,'October 2026');assert.equal(fr.rangeLabel,'octobre 2026');
 const state=initialState(),a=dashboardMetrics(state,{...settings,locale:'en-GB'}),b=dashboardMetrics(state,{...settings,locale:'fr-FR'});
 for(const key of ['spent','income','net','assets'])assert.equal(a[key],b[key]);
 assert.deepEqual(a.daily,b.daily);
});
