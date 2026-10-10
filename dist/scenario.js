import {FLOOR,RATES,CURRENCIES,REGIONS,HISTORY_REVISION,dateKey,shiftDay,threeMonthsAgo,historyRegion,regionById,dailyCandidates,validScenario,scenarioRegion,formatMoney} from './core.js?v=7';

const clone=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const SCENARIO_FIELDS=['wallets','transactions','scenario','scenarioOpening','scenarioSummary','historyStart','historyRevision','lastGeneratedDate','simulationResumedAt','location'];
export const scenarioFingerprint=state=>JSON.stringify(SCENARIO_FIELDS.map(key=>state[key]));

export function scenarioDefaults(state,now=new Date()) {
  if(state.scenario&&validScenario(state.scenario))return {balances:{...state.wallets},config:clone(state.scenario)};
  const today=dateKey(now,regionById(state.location.regionId).tz),start=threeMonthsAgo(today),stops=[];
  for(let day=start;day<=today;day=shiftDay(day,1)){
    const regionId=day===today?state.location.regionId:historyRegion(day,today);
    if(!stops.length||stops.at(-1).regionId!==regionId)stops.push({date:day,regionId});
  }
  const incomes=state.transactions.filter(t=>t.automatic&&t.category==='income'&&t.amount>0),months=new Set(incomes.map(t=>t.timestamp.slice(0,7)));
  const monthlyIncome=incomes.length?Math.min(100000000,Math.round(incomes.reduce((sum,t)=>sum+t.amount,0)/months.size)):330000;
  return {balances:{...state.wallets},config:{version:1,seed:'editor-initial',monthlyIncome,monthlyExpenses:Math.min(100000000,state.budget),incomeKind:'salary',incomeDay:25,stops}};
}

function validateBalances(balances) {
  for(const currency of Object.keys(RATES))if(!Number.isSafeInteger(balances?.[currency])||balances[currency]<0||balances[currency]>100000000000)throw Error('Indique un solde valide pour '+currency+', entre 0 et 1 milliard.');
  if(balances.EUR<FLOOR)throw Error('Le solde EUR doit rester supérieur à 23 000 € (minimum 23 000,01 €).');
}

// Resolve the opening balance from the requested closing balance and the ledger.
// Refuse impossible scenarios instead of adding an unexplained compensating credit.
function reconcileLedger(state,transactions,balances) {
  validateBalances(balances);
  const sorted=transactions.map(t=>({...t})).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
  const sums=Object.fromEntries(Object.keys(RATES).map(c=>[c,0])),minimums={...sums};
  for(const tx of sorted){
    sums[tx.currency]+=tx.amount;
    if(!Number.isSafeInteger(sums[tx.currency]))throw Error('Les montants de ce scénario sont trop élevés.');
    minimums[tx.currency]=Math.min(minimums[tx.currency],sums[tx.currency]);
  }
  const opening={};
  for(const currency of Object.keys(RATES)){
    const floor=currency==='EUR'?FLOOR:0,minClosing=floor+sums[currency]-minimums[currency];
    if(balances[currency]<minClosing)throw Error('Pour cet historique, le solde '+currency+' doit être au moins '+formatMoney(minClosing,currency)+'. Augmente le solde ou réduis les revenus du scénario.');
    opening[currency]=balances[currency]-sums[currency];
  }
  const running={...opening};
  for(const tx of sorted){running[tx.currency]+=tx.amount;tx.balanceAfter=running[tx.currency];}
  const result=clone(state);result.wallets={...balances};result.transactions=sorted;result.scenarioOpening=opening;
  return result;
}

export function regenerateScenario(state,config,balances,now=new Date()) {
  if(!validScenario(config))throw Error('Vérifie les revenus, les dépenses et les dates du voyage (étapes distinctes, dans l’ordre).');
  const lastRegion=regionById(config.stops.at(-1).regionId),today=dateKey(now,lastRegion.tz),start=threeMonthsAgo(today);
  if(config.stops[0].date>start)throw Error('La première étape doit couvrir le début de l’historique : '+start+'.');
  if(config.stops.some(stop=>stop.date>today))throw Error('Les étapes de l’historique doivent être datées d’aujourd’hui ou avant.');
  const generated=[];
  for(let day=start;day<=today;day=shiftDay(day,1))for(const tx of dailyCandidates(day,scenarioRegion(config,day),config))if(Date.parse(tx.timestamp)<=now.getTime())generated.push(tx);
  const retained=state.transactions.filter(t=>!t.automatic);
  const result=reconcileLedger(state,[...retained,...generated],balances);
  result.scenario=clone(config);result.historyStart=start;result.historyRevision=HISTORY_REVISION;
  result.lastGeneratedDate=today;result.simulationResumedAt=now.toISOString();
  result.location={regionId:lastRegion.id,source:'scenario',updatedAt:now.toISOString()};
  result.scenarioSummary={start,end:today,generatedAt:now.toISOString(),count:generated.length,expenses:generated.filter(t=>t.amount<0).reduce((sum,t)=>sum-t.amount,0),income:generated.filter(t=>t.amount>0).reduce((sum,t)=>sum+t.amount,0)};
  return result;
}

export function changeScenarioBalances(state,balances,now=new Date()) {
  const result=reconcileLedger(state,state.transactions,balances);
  if(!result.scenario){
    result.scenario=scenarioDefaults(state,now).config;
    result.simulationResumedAt=now.toISOString();
    result.lastGeneratedDate=dateKey(now,regionById(state.location.regionId).tz);
  }
  return result;
}

export function renderScenarioEditor(draft,{canUndo=false,errorHTML='',now=new Date()}={}) {
  const {config,balances}=draft,today=dateKey(now,regionById(config.stops.at(-1).regionId).tz),start=threeMonthsAgo(today);
  const countries=new Map();REGIONS.forEach(r=>{if(!countries.has(r.country))countries.set(r.country,[]);countries.get(r.country).push(r);});
  const regionsHTML=selected=>[...countries].map(([country,regions])=>`<optgroup label="${esc(country)}">${regions.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${esc(r.city)} · ${r.currency}</option>`).join('')}</optgroup>`).join('');
  return `<p class="editor-description">Éditez un scénario de démonstration. Les soldes et les opérations sont fictifs et restent dans ce navigateur.</p>
  <form id="scenario-form">
    <fieldset class="editor-fieldset"><legend>Soldes affichés</legend><div class="editor-wallets">${Object.keys(RATES).map(currency=>`<div class="form-field"><label for="editor-${currency}">${esc(CURRENCIES[currency].name)} · ${currency}</label><input id="editor-${currency}" name="wallet-${currency}" inputmode="decimal" maxlength="16" value="${balances[currency]/100}" required></div>`).join('')}</div><p class="editor-hint">EUR : au moins 23 000,01 €. Le solde initial est recalculé pour conserver un historique cohérent.</p></fieldset>
    <fieldset class="editor-fieldset"><legend>Activité mensuelle · EUR</legend><div class="field-pair"><div class="form-field"><label for="editor-income">Revenus / mois</label><input id="editor-income" name="income" inputmode="decimal" maxlength="13" value="${config.monthlyIncome/100}" required></div><div class="form-field"><label for="editor-spending">Dépenses de référence / mois</label><input id="editor-spending" name="spending" inputmode="decimal" maxlength="13" value="${config.monthlyExpenses/100}" required></div></div>
    <div class="field-pair"><div class="form-field"><label for="editor-income-kind">Type de revenu</label><select id="editor-income-kind" name="income-kind"><option value="salary" ${config.incomeKind==='salary'?'selected':''}>Salaire mensuel</option><option value="freelance" ${config.incomeKind==='freelance'?'selected':''}>Missions indépendantes</option></select></div><div class="form-field"><label for="editor-income-day">Jour de versement final</label><input id="editor-income-day" name="income-day" type="number" min="1" max="28" value="${config.incomeDay}" required></div></div>
    <p class="editor-hint">Dépenses ajustées au coût local, avec variation quotidienne et abonnements. Missions : deux versements par mois. Les revenus tombent un jour ouvré. Zéro désactive les revenus ou dépenses concernés.</p></fieldset>
    <fieldset class="editor-fieldset"><legend>Pays et déplacements</legend><p class="editor-hint">Chaque étape s’applique à partir de sa date, jusqu’à la suivante. Historique des trois derniers mois.</p>
    <div class="editor-stops">${config.stops.map((stop,i)=>`<div class="editor-stop"><span class="editor-stop-number">${i+1}</span><div class="editor-stop-fields"><label for="editor-stop-date-${i}">À partir du</label><input id="editor-stop-date-${i}" name="stop-date-${i}" type="date" value="${esc(stop.date)}" max="${today}" ${i?`min="${start}"`:'readonly'} required><label for="editor-stop-region-${i}">Pays · Ville</label><select id="editor-stop-region-${i}" name="stop-region-${i}">${regionsHTML(stop.regionId)}</select></div><button type="button" class="editor-remove-stop" data-act="editor-remove-stop" data-id="${i}" aria-label="Supprimer l’étape ${i+1}" ${i?'':'disabled'}>×</button></div>`).join('')}</div>
    <button type="button" class="editor-add-stop" data-act="editor-add-stop" ${config.stops.length>=12?'disabled':''}>+ Ajouter une étape</button></fieldset>
    <div class="info-box neutral">La régénération remplace les opérations automatiques. Les opérations manuelles, contacts, cartes et poches sont conservés. Les opérations générées portent une indication de démonstration.</div>
    ${errorHTML}<button type="submit" class="primary-button" data-operation="regenerate">Régénérer dépenses et revenus</button><button type="submit" class="secondary-button" data-operation="balances">Enregistrer les soldes uniquement</button>
  </form>${canUndo?'<button class="secondary-button" data-act="editor-undo">Annuler le dernier changement</button>':''}<button class="secondary-button" data-act="editor-exit">Quitter le mode édition</button>`;
}
