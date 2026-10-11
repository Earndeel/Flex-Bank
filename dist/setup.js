import {FLOOR,RATES,REGIONS,initialState,assertState,migrateState,parseMoney,dateKey,shiftDay,threeMonthsAgo,regionById} from './core.js?v=10';
import {regenerateScenario} from './scenario.js?v=4';
import {tr} from './i18n.js?v=2';

const copy=value=>JSON.parse(JSON.stringify(value));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validRegion=id=>REGIONS.some(region=>region.id===id);
export function setupRange(regionId='paris',now=new Date()) {
  const today=dateKey(now,regionById(regionId).tz);
  return {today,start:threeMonthsAgo(today)};
}
export function setupDefaults(now=new Date()) {
  return {firstName:'',lastName:'',balance:'28000',annualSpending:'12000',stops:[{date:setupRange('paris',now).start,regionId:'paris'}]};
}
// An existing valid ledger is the completion marker. No history is generated
// or saved for a new browser until its owner submits the setup form.
export function restoreProfile(raw,now=new Date()) {
  if(!raw)return null;
  try {const saved=JSON.parse(raw);if(!assertState(saved))return null;const state=migrateState(saved,now);state.theme='dark';return state;}catch{return null;}
}
export function profileIdentity(state) {
  const profile=state?.profile||{},name=String(profile.name||'Lucas Jouvençon');
  const parts=name.trim().split(/\s+/),firstName=String(profile.firstName||parts[0]);
  const lastName=String(profile.lastName||parts.slice(1).join(' '));
  const initials=[firstName,lastName].filter(Boolean).map(part=>Array.from(part.trim())[0]||'').join('').toLocaleUpperCase().slice(0,4);
  return {name,firstName,lastName,initials,handle:String(profile.handle||'flex')};
}
export function readSetupDraft(fields,draft,now=new Date()) {
  const result={firstName:String(fields.get('first-name')??''),lastName:String(fields.get('last-name')??''),balance:String(fields.get('balance')??''),annualSpending:String(fields.get('annual-spending')??''),stops:draft.stops.map((_,i)=>({date:String(fields.get('setup-date-'+i)??''),regionId:String(fields.get('setup-region-'+i)??'')}))};
  if(result.stops.length&&validRegion(result.stops.at(-1).regionId))result.stops[0].date=setupRange(result.stops.at(-1).regionId,now).start;
  return result;
}
export function addSetupStop(draft,now=new Date()) {
  if(draft.stops.length>=12)throw Error('Le scénario permet jusqu’à 12 étapes.');
  const last=draft.stops.at(-1),{today}=setupRange(last.regionId,now);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(last.date)||!Number.isFinite(Date.parse(last.date+'T12:00:00Z')))throw Error('Choisissez des dates de séjour distinctes, dans l’ordre et dans les trois derniers mois.');
  if(last.date>=today)throw Error('Avance la date de la dernière étape avant d’en ajouter une autre.');
  const days=Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(last.date+'T12:00:00Z'))/86400000);
  return {...draft,stops:[...draft.stops,{date:shiftDay(last.date,Math.max(1,Math.floor(days/2))),regionId:last.regionId}]};
}
function cleanName(value) {return String(value??'').trim().replace(/\s+/g,' ');}
export function validateSetup(draft,now=new Date()) {
  const firstName=cleanName(draft.firstName),lastName=cleanName(draft.lastName);
  if([firstName,lastName].some(name=>!name||Array.from(name).length>50||/[\u0000-\u001f\u007f]/.test(name)))throw Error('Renseignez un prénom et un nom, de 1 à 50 caractères chacun.');
  const balance=parseMoney(draft.balance),annualSpending=parseMoney(draft.annualSpending);
  if(!Number.isSafeInteger(balance)||balance<FLOOR||balance>100000000000)throw Error('Le solde EUR doit rester supérieur à 23 000 € (minimum 23 000,01 €).');
  if(!Number.isSafeInteger(annualSpending)||annualSpending<0||annualSpending>1000000000)throw Error('Indiquez des dépenses annuelles entre 0 et 10 000 000 €.');
  if(!Array.isArray(draft.stops)||!draft.stops.length||draft.stops.length>12||draft.stops.some(stop=>!validRegion(stop.regionId)))throw Error('Choisissez au moins un lieu valide.');
  const {today,start}=setupRange(draft.stops.at(-1).regionId,now),stops=copy(draft.stops);stops[0].date=start;
  if(stops.some((stop,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(stop.date)||!Number.isFinite(Date.parse(stop.date+'T12:00:00Z'))||new Date(stop.date+'T12:00:00Z').toISOString().slice(0,10)!==stop.date||stop.date<start||stop.date>today||(i>0&&stops[i-1].date>=stop.date)))throw Error('Choisissez des dates de séjour distinctes, dans l’ordre et dans les trois derniers mois.');
  return {firstName,lastName,balance,annualSpending,stops,today,start};
}
export function createSetupState(draft,now=new Date(),seed=globalThis.crypto.randomUUID()) {
  const setup=validateSetup(draft,now),base=initialState(now,{generateHistory:false});
  const balances=Object.fromEntries(Object.keys(RATES).map(code=>[code,code==='EUR'?setup.balance:0]));
  base.pockets.forEach(pocket=>{pocket.balance=0;});
  const eligibleStart=setup.start>setup.today.slice(0,4)+'-01-01'?setup.start:setup.today.slice(0,4)+'-01-01';
  const days=Math.max(1,Math.round((Date.parse(setup.today+'T12:00:00Z')-Date.parse(eligibleStart+'T12:00:00Z'))/86400000)+1);
  const referenceMonthly=Math.round(setup.annualSpending*30/days);
  const monthlyExpenses=setup.annualSpending?Math.min(100000000,Math.max(1000,referenceMonthly)):0;
  const config={version:1,seed,monthlyIncome:setup.annualSpending?1:0,monthlyExpenses,incomeKind:'salary',incomeDay:25,stops:setup.stops};
  const options={annualSpending:setup.annualSpending};
  // Choose regular income within the reserve constraint, without adding an
  // unexplained adjustment credit. The opening balance is derived by the ledger.
  const preview=regenerateScenario(base,config,{...balances,EUR:100000000000},now,options);
  let monthlyIncome=Math.min(100000000,Math.round(referenceMonthly*1.12)),suffixExpenses=0,suffixIncomeCount=0;
  for(const tx of [...preview.transactions].reverse()) {
    if(tx.amount<0)suffixExpenses-=tx.amount;
    if(tx.category==='income'&&tx.amount>0)suffixIncomeCount++;
    if(suffixIncomeCount)monthlyIncome=Math.min(monthlyIncome,Math.floor((setup.balance-FLOOR+suffixExpenses)/suffixIncomeCount));
  }
  config.monthlyIncome=setup.annualSpending?Math.max(0,Math.floor(monthlyIncome/1000)*1000):0;
  const state=regenerateScenario(base,config,balances,now,options);
  const handle=(setup.firstName+'.'+setup.lastName).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9.]/g,'').slice(0,50)||'flex';
  state.profile={...base.profile,firstName:setup.firstName,lastName:setup.lastName,name:setup.firstName+' '+setup.lastName,handle};
  state.profile.initials=profileIdentity(state).initials;
  state.setup={version:1,completedAt:now.toISOString(),annualSpending:setup.annualSpending};
  state.budget=Math.max(1,monthlyExpenses);state.theme='dark';
  if(!assertState(state))throw Error('Le scénario n’a pas pu être validé. Aucune donnée n’a été modifiée.');
  return state;
}

export function renderSetup(draft,{error='',busy=false,language='fr',now=new Date()}={}) {
  const {today,start}=setupRange(draft.stops.at(-1)?.regionId||'paris',now);
  const countries=new Map();REGIONS.forEach(region=>{if(!countries.has(region.country))countries.set(region.country,[]);countries.get(region.country).push(region);});
  const regionOptions=selected=>[...countries].map(([country,regions])=>`<optgroup label="${esc(tr(country,language))}">${regions.map(region=>`<option value="${region.id}" ${region.id===selected?'selected':''}>${esc(region.city)}</option>`).join('')}</optgroup>`).join('');
  return `<section class="setup-screen"><header class="setup-top"><span class="setup-brand">flex</span><div class="setup-language" role="group" aria-label="Langue de l’app"><button type="button" data-act="setup-language" data-id="fr" aria-pressed="${language==='fr'}" ${busy?'disabled':''}>FR</button><button type="button" data-act="setup-language" data-id="en" aria-pressed="${language==='en'}" ${busy?'disabled':''}>EN</button></div></header><div class="setup-intro"><span class="setup-kicker">BIENVENUE CHEZ FLEX</span><h1>Votre espace.<br>À votre image.</h1><p>Créez votre profil pour générer votre historique.</p></div>
  <form id="setup-form" aria-busy="${busy}"><fieldset ${busy?'disabled':''}><section class="setup-section"><h2><span>01</span> Votre profil</h2><div class="field-pair"><div class="form-field"><label for="setup-first-name">Prénom</label><input id="setup-first-name" name="first-name" autocomplete="given-name" maxlength="50" value="${esc(draft.firstName)}" placeholder="Votre prénom" required></div><div class="form-field"><label for="setup-last-name">Nom</label><input id="setup-last-name" name="last-name" autocomplete="family-name" maxlength="50" value="${esc(draft.lastName)}" placeholder="Votre nom" required></div></div></section>
  <section class="setup-section"><h2><span>02</span> Votre argent</h2><div class="form-field"><label for="setup-balance">Argent disponible · EUR</label><input id="setup-balance" name="balance" inputmode="decimal" maxlength="16" value="${esc(draft.balance)}" required><p class="setup-hint">Solde affiché, au moins 23 000,01 €.</p></div><div class="form-field"><label for="setup-spending">Spent annuel · EUR</label><input id="setup-spending" name="annual-spending" inputmode="decimal" maxlength="13" value="${esc(draft.annualSpending)}" required><p class="setup-hint">Total affiché dans « Cette année », réparti dans les dépenses des trois derniers mois. Les jours à venir s’ajouteront à ce total.</p></div></section>
  <section class="setup-section"><h2><span>03</span> Vos lieux de vie</h2><p class="setup-hint">Choisissez vos villes et dates de séjour. Les dépenses suivront votre itinéraire.</p><div class="setup-stops">${draft.stops.map((stop,i)=>`<div class="setup-stop"><div class="setup-stop-heading"><strong>Séjour ${i+1}</strong>${i?`<button type="button" data-act="setup-remove-stop" data-id="${i}" aria-label="Supprimer le séjour">×</button>`:''}</div><div class="field-pair"><div class="form-field"><label for="setup-region-${i}">Pays · Ville</label><select id="setup-region-${i}" name="setup-region-${i}">${regionOptions(stop.regionId)}</select></div><div class="form-field"><label for="setup-date-${i}">À partir du</label><input id="setup-date-${i}" name="setup-date-${i}" type="date" value="${esc(i?stop.date:start)}" min="${start}" max="${today}" ${i?'':'readonly'} required></div></div></div>`).join('')}</div><button type="button" class="setup-add-place" data-act="setup-add-stop" ${draft.stops.length>=12?'disabled':''}>+ Ajouter un lieu</button></section></fieldset>
  <p id="setup-error" class="setup-error" role="alert">${esc(error)}</p><button type="submit" class="primary-button setup-submit" ${busy?'disabled':''}>${busy?'<span class="setup-spinner" aria-hidden="true"></span><span>Votre historique se prépare…</span>':'Créer mon espace'}</button><p class="setup-local-note">Un profil indépendant dans ce navigateur. Code d’accès local : 2589.</p><p class="setup-note">Vos données restent sur cet appareil.</p></form></section>`;
}
