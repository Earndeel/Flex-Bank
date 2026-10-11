import {REFERENCE_ICONS} from './reference-icons.js?v=2';
import {getLanguage,getLocale,setLanguage,tr,localizeHTML} from './i18n.js?v=5';
import {
  FLOOR,STORAGE_KEY,PIN_HASH,RATES,CURRENCIES,REGIONS,CATEGORY_META,
  initialState,assertState,rollForward,dateKey,shiftDay,regionById,regionFromCoordinates,
  sendMoney,topUp,exchange,pocketMove,monthMetrics,formatMoney,parseMoney,applyTransaction
} from './core.js?v=11';
import {expenseMetrics,analyticsBreakdownMetrics,renderExpenseSummary,shiftExpensePeriod} from './expenses.js?v=4';
import {isEditableExpense,formatIban,localDateTime,saveExpense,deleteExpense,changeAccountIban,renderEditorTools,renderExpenseList,renderExpenseForm,renderIbanForm} from './expense-editor.js?v=2';
import {SCENARIO_FIELDS,scenarioDefaults,scenarioFingerprint,regenerateScenario,changeScenarioBalances,renderScenarioEditor} from './scenario.js?v=5';

import {displayMoney,dashboardMetrics,periodRange,creditProjection,EXPENSE_COLORS} from './ui-metrics.js?v=2';
import {setupDefaults,restoreProfile,profileIdentity,readSetupDraft,addSetupStop,createSetupState,renderSetup} from './setup.js?v=4';

const ICONS = {
  brandHome:'<path d="M7 21V4h12M7 11h9" stroke-width="3.5"/>',
  chartSolid:'<rect x="3" y="11" width="4" height="10" rx="1.5" fill="currentColor" stroke="none"/><rect x="10" y="3" width="4" height="18" rx="1.5" fill="currentColor" stroke="none"/><rect x="17" y="7" width="4" height="14" rx="1.5" fill="currentColor" stroke="none"/>',
  building:'<path d="m3 8 9-5 9 5v2H3zM3 21h18M5 10v9m7-9v9m7-9v9" stroke-width="2.8"/>',
  move:'<path d="M3 6h3c6 0 6 12 12 12h3m-4-4 4 4-4 4M3 18h3C12 18 12 6 18 6h3m-4-4 4 4-4 4" stroke-width="2.6"/>',
  trend:'<path d="m3 17 6-6 4 4 8-10M15 5h6v6" stroke-width="3"/>',
  coins:'<ellipse cx="8" cy="5" rx="5" ry="3" fill="currentColor" stroke="none"/><path d="M3 10c2 3 8 3 10 0M3 15c2 3 7 3 9 1" stroke-width="3"/><ellipse cx="17" cy="13" rx="5" ry="3" fill="currentColor" stroke="none"/><path d="M12 18c2 3 8 3 10 0" stroke-width="3"/>',
  bitcoin:'<path d="M8 4v16M6 5h8c7 0 7 7 0 7H8m6 0c7 0 7 7 0 7H6M11 2v3m4-3v3m-4 14v3m4-3v3" stroke-width="2.8"/>',
  rewards:'<path d="m12 2 9 5v10l-9 5-9-5V7z" fill="currentColor" stroke="none"/><path d="m12 6 1.5 4.5L18 12l-4.5 1.5L12 18l-1.5-4.5L6 12l4.5-1.5z" fill="var(--nav)" stroke="none"/>',
  cash:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 8h1m10 8h1"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  cards:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
  arrows:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  chart:'<path d="M4 20h16M6 16v-5m6 5V5m6 11V8"/>',
  pocket:'<path d="M4 5h16v9a8 8 0 0 1-16 0z"/><path d="m8 12 4 4 4-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrowUp:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
  arrowDown:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
  exchange:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  back:'<path d="m14 5-7 7 7 7"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="m3 3 18 18M10 5a12 12 0 0 1 12 7c-1 2-3 4-5 5M6 6c-2 1-3 3-4 6 3 5 7 7 10 7 1 0 2 0 3-1M10 10a3 3 0 0 0 4 4"/>',
  coffee:'<path d="M4 3h13v11a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 5h2a3 3 0 0 1 0 6h-2M3 22h15"/>',
  utensils:'<path d="M5 3v6a3 3 0 0 0 6 0V3M8 3v18M19 3c-4 3-4 8 0 9v9M19 3v9"/>',
  basket:'<path d="m3 9 2 11h14l2-11zM2 9h20M8 9l4-6 4 6M9 13v4m6-4v4"/>',
  car:'<path d="m5 4-3 8v6h20v-6l-3-8zM2 12h20M5 18v3m14-3v3M6 15h1m10 0h1"/>',
  bag:'<path d="M4 7h16l1 14H3zM8 8V6a4 4 0 0 1 8 0v2"/>',
  repeat:'<path d="M20 7H5l3-3M4 17h15l-3 3M20 7l-3 3M4 17l3-3M4 7v4m16 2v4"/>',
  plane:'<path d="m21 3-7 18-3-8-8-3zM11 13 21 3"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  spark:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z"/>',
  location:'<path d="M19 9c0 6-7 12-7 12S5 15 5 9a7 7 0 0 1 14 0z"/><circle cx="12" cy="9" r="2"/>',
  snow:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M8 4l4 3 4-3M8 20l4-3 4 3M3 11l4-1-1-4m15 7-4 1 1 4M3 13l4 1-1 4m15-7-4-1 1-4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="9" cy="18" r="2" fill="currentColor"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18z"/>',
  moon:'<path d="M20 14a9 9 0 0 1-10-10 9 9 0 1 0 10 10z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H4v13h4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  share:'<path d="M12 15V3m-4 4 4-4 4 4M7 10H4v11h16V10h-3"/>',
  delete:'<path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  backspace:'<path d="M9 5h12v14H9l-7-7zM12 9l5 6m0-6-5 6"/>',
  wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01"/>',
  ...REFERENCE_ICONS
};
const icon = (name,extra='') => `<svg class="icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.cards}</svg>`;
const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null,storageAvailable=true;
try { state=restoreProfile(localStorage.getItem(STORAGE_KEY)); }
catch { storageAvailable=false; }
let needsSetup=!state,setupDraft=setupDefaults(),setupError='',setupBusy=false;
const identity=()=>profileIdentity(state);
function captureSetupDraft() {
  const form=document.getElementById('setup-form');
  if(form)setupDraft=readSetupDraft(new FormData(form),setupDraft);
  return setupDraft;
}
let unlocked=false,tab='home',view='main',filter='all',search='',pin='',pinChecking=false,attempts=0,blockedUntil=0;
let activeMonth=dateKey(new Date()).slice(0,7),showCard=false,hiddenAt=0,lastActive=Date.now(),toastTimer,previousFocus;
let expensesScope='spending';
let expensesPeriod='year',expensesAnchor='',expensesMode='donut',expensesCategory='',expensesLimit=20;
let editMode=false,editorDraft=null,editorUndo=null,editorNotice='';
let editorExpenseCurrency='EUR',editorExpenseLimit=30,directExpenseId=null;
const root=document.getElementById('app'),sheetRoot=document.getElementById('sheet-root');
const localizedMoney=(amount,currency='EUR')=>displayMoney(amount,currency,{locale:getLocale()});
const money=(amount,currency='EUR')=>state.hideBalance?'••••':localizedMoney(amount,currency);
const roundedMoney=(amount,currency='EUR')=>state.hideBalance?'••••':displayMoney(amount,currency,{digits:0,locale:getLocale()});
let analyticsPeriod='week',promoIndex=0,promoDismissed=false,brokerageExpanded=true;
let preview={cash:0,watchlist:[]};
try{const savedPreview=JSON.parse(localStorage.getItem('flex-preview-v1')||'null');if(savedPreview&&Number.isSafeInteger(savedPreview.cash)&&savedPreview.cash>=0&&Array.isArray(savedPreview.watchlist))preview={cash:savedPreview.cash,watchlist:savedPreview.watchlist.filter(x=>typeof x==='string')};}catch{}
const savePreview=()=>{try{localStorage.setItem('flex-preview-v1',JSON.stringify(preview));}catch{toast('Les réglages du portefeuille restent disponibles pendant cette session.');}};
const ACCOUNT_REF='FR76 3000 6060 1234 5678 9012 345';
const eurAccountIban=()=>formatIban(state.accountIban||ACCOUNT_REF);
const accountReference=()=>state.currency==='EUR'?eurAccountIban():'FR76 3000 6060 1234 5678 9012 345';
const currentRegion=()=>regionById(state.location.regionId);
const nowDay=()=>dateKey(new Date(),currentRegion().tz);
const ordered=()=>[...state.transactions].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
function persist() {
  if(!state)return;
  try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageAvailable=true; }
  catch { storageAvailable=false; toast('La sauvegarde locale est indisponible. Cette session reste utilisable.'); }
}
function applyLanguage() {
  if(document.documentElement)document.documentElement.lang=getLanguage();
  document.title='Flex';
  for(const selector of ['.desktop-note h1','.desktop-note p','.desktop-caption','#splash-caption']){const element=document.querySelector(selector);if(element)element.innerHTML=localizeHTML(element.innerHTML);}
  const disclosure=document.querySelector('.global-disclosure');
  if(disclosure){disclosure.textContent='';disclosure.setAttribute?.('aria-label','');}
}
function currencyFlag(currency) {
  if(currency!=='EUR')return CURRENCIES[currency].flag;
  const star='<path d="M0-.78 .175-.24 .74-.24 .28 .1 .455 .64 0 .3-.455 .64-.28 .1-.74-.24-.175-.24Z" fill="#ffcc00"/>';
  return `<svg class="euro-flag" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#003399"/>${Array.from({length:12},(_,i)=>{const angle=i*Math.PI/6;return `<g transform="translate(${8+5.2*Math.sin(angle)} ${8-5.2*Math.cos(angle)})">${star}</g>`;}).join('')}</svg>`;
}
function theme() {
  applyLanguage();
  document.body.classList.toggle('dark',true);
  document.querySelector('meta[name="theme-color"]').content='#000000';
}
function toast(message) {
  const el=document.getElementById('toast');el.textContent=tr(message);el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3700);
}
function topbar(invest=false) {
  return `<header class="topbar"><button class="profile-button" data-act="profile" aria-label="${esc(tr('Profil')+' '+identity().name)}" data-i18n-skip><span class="avatar">${esc(identity().initials)}</span></button><button class="header-search" data-act="${invest?'invest-search':'search'}" aria-label="${invest?'Explorer les instruments':'Rechercher une transaction'}">${icon('search')}<span>Search</span></button><div class="top-tools"><button class="icon-button" data-act="tab" data-id="analytics" aria-label="Analyse des dépenses">${icon('chartSolid')}</button><button class="icon-button" data-act="${invest?'invest-market':'tab'}" ${invest?'':'data-id="cards"'} aria-label="${invest?'Explorer les marchés':'Vos cartes'}">${icon(invest?'globe':'cards')}</button></div></header>`;
}
function nav() {
  const tabs=[['home','brandHome','Home'],['credit','coins','Credit'],['invest','trend','Invest'],['payments','arrows','Payments'],['crypto','bitcoin','Crypto'],['points','rewards','FlexPoints']];
  const active=['cards','savings'].includes(tab)?'home':tab;
  return `<nav class="nav" aria-label="Navigation principale">${tabs.map(([id,i,label])=>`<button class="nav-item ${active===id?'active':''}" data-act="tab" data-id="${id}" ${active===id?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;
}

function categoryMeta(t) {return CATEGORY_META[t.category]||CATEGORY_META.transfer;}
function txRow(t) {
  const c=categoryMeta(t),shown=t.status==='declined'?t.attemptedAmount:t.amount;
  const stamp=new Intl.DateTimeFormat(getLocale(),{timeZone:regionById(t.region).tz,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t.timestamp));
  const original=t.originalAmount&&t.originalCurrency!==t.currency?money(-Math.abs(t.originalAmount),t.originalCurrency):'';
  const initials=t.name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const color=EXPENSE_COLORS[t.category]||'#353535';
  return `<button class="tx-row" data-act="transaction" data-id="${esc(t.id)}"><span class="tx-icon merchant-avatar" style="--merchant-color:${color}">${t.category==='income'||t.category==='transfer'?esc(initials):icon(c.icon)}${shown>0?`<span class="merchant-direction">${icon('arrowDown')}</span>`:''}</span><span class="tx-body"><span class="tx-name" data-i18n-skip style="display:block">${esc(t.name)}</span><span class="tx-sub" style="display:block">${esc(stamp)}${t.status==='declined'?' · Refusé':''}</span></span><span class="tx-values"><span class="tx-amount ${shown>0?'positive':''} ${t.status==='declined'?'declined':''}" style="display:block">${shown>0?'+':''}${esc(money(shown,t.currency))}</span>${original?`<span class="tx-original" style="display:block">${esc(original)}</span>`:''}</span></button>`;
}

function txGroups(transactions,limit=null) {
  const list=limit?transactions.slice(0,limit):transactions;
  if (!list.length) return `<div class="panel empty">${icon('arrows')}Aucune transaction pour ce compte.<br>Ajoute de l’argent pour commencer.</div>`;
  const groups=new Map();
  list.forEach(t=>{const key=dateKey(new Date(t.timestamp),currentRegion().tz);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);});
  return [...groups].map(([key,items])=>{
    const label=key===nowDay()?'Aujourd’hui':key===shiftDay(nowDay(),-1)?'Hier':new Intl.DateTimeFormat(getLocale(),{day:'numeric',month:'long'}).format(new Date(key+'T12:00:00Z'));
    return `<div class="date-group">${label}</div><div class="transactions">${items.map(txRow).join('')}</div>`;
  }).join('');
}
function balanceHTML() {
  const symbol=CURRENCIES[state.currency].symbol;
  if(state.hideBalance)return esc(symbol)+'•• •••<span class="decimals">,••</span>';
  const parts=new Intl.NumberFormat(getLocale(),{minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(state.wallets[state.currency]/100);
  const integer=parts.filter(p=>['integer','group'].includes(p.type)).map(p=>p.value).join('');
  const decimal=parts.filter(p=>['decimal','fraction'].includes(p.type)).map(p=>p.value).join('');
  return esc(symbol+integer)+'<span class="decimals">'+esc(decimal)+'</span>';
}

function widgetSpendingChart(metrics) {
  if(state.hideBalance)return '';
  const days=Math.max(Number(nowDay().slice(-2)),...metrics.spending.map(t=>Number(dateKey(new Date(t.timestamp),regionById(t.region).tz).slice(-2)))),daily=Array(days+1).fill(0);
  metrics.spending.forEach(t=>{
    const day=Number(dateKey(new Date(t.timestamp),regionById(t.region).tz).slice(-2));
    if(day<=days)daily[day]-=t.amount;
  });
  let total=0;
  const cumulative=daily.map(value=>(total+=value)),max=Math.max(...cumulative,1);
  const points=cumulative.map((value,i)=>`${(i/days*150).toFixed(1)},${(48-value/max*41).toFixed(1)}`);
  return `<svg class="widget-line" viewBox="0 0 150 54" preserveAspectRatio="none" role="img" aria-label="Dépenses cumulées du mois"><title>${esc(localizedMoney(metrics.expense))} de dépenses ce mois-ci</title><defs><linearGradient id="widget-spend-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="currentColor" stop-opacity=".25"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path d="M${points.join(' L')} L150,54 L0,54Z" fill="url(#widget-spend-fill)"/><polyline points="${points.join(' ')}" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function promo(invest=false) {
  if(promoDismissed&&!invest)return '';
  const slides=invest?[
    ['Explore your portfolio','Discover instruments and build a watchlist.','invest-market','assets']
  ]:[
    ['Your world, with Flex','Choose your countries and plan your next chapter.','location','travel'],
    ['Make it yours','Adjust your balances and your daily activity.','editor','card'],
    ['Room for your plans','Set a goal and organise your savings.','savings-open','card']
  ];
  const [title,text,act,art]=slides[invest?0:promoIndex];
  return `<section class="promo-carousel" aria-label="${invest?'Découvrir Invest':'À découvrir'}"><div class="reference-promo"><button class="promo-content" data-act="${act}"><strong>${title}</strong><span>${text}</span><img src="./promo-${art}.svg?v=1" alt="" width="150" height="110"></button>${invest?'':`<button class="promo-close" data-act="promo-dismiss" aria-label="Masquer cette carte">${icon('close')}</button>`}</div>${invest?'':`<div class="carousel-dots" role="group" aria-label="Cartes à découvrir">${slides.map((_,i)=>`<button class="${i===promoIndex?'is-active':''}" data-act="promo-slide" data-id="${i}" aria-label="Carte ${i+1}" aria-pressed="${i===promoIndex}"></button>`).join('')}</div>`}</section>`;
}
function home() {
  const metrics=monthMetrics(state,nowDay().slice(0,7));
  const recent=ordered().filter(t=>t.currency===state.currency).slice(0,4),pockets=state.pockets.reduce((n,p)=>n+p.balance,0);
  const digits=String(Math.trunc(state.wallets[state.currency]/100)).length,balanceSize=digits>8?32:digits>6?38:44;
  return `${topbar()}<section class="hero" aria-label="Solde du compte ${state.currency}"><button class="account-select" data-act="accounts"><span class="account-flag" aria-hidden="true">${currencyFlag(state.currency)}</span>Personal · ${state.currency}</button><div class="hero-balance"><h1 class="balance" style="--balance-size:${balanceSize}px"><button data-act="hide" aria-label="${state.hideBalance?'Afficher les montants':'Masquer les montants'}">${balanceHTML()}</button></h1></div><div class="account-reference-group"><button class="account-reference" data-act="account-details" aria-describedby="account-reference-note">${icon('building')}<span>${esc(accountReference())}</span></button>${state.currency==='EUR'?'<p id="account-reference-note" class="account-reference-note"></p>':'<span id="account-reference-note" class="sr-only"></span>'}</div><button class="accounts-pill" data-act="accounts">Accounts</button></section>
  <div class="quick-actions">${[['topup','plus','Add money'],['move','move','Move'],['account-details','building','Details'],['more','more','More']].map(([act,i,label])=>`<button class="quick-action" data-act="${act}"><span class="quick-icon">${icon(i)}</span><span>${label}</span></button>`).join('')}</div>
  ${promo()}<h2 class="sr-only">Vos transactions</h2><div class="transactions recent-transactions">${recent.length?recent.map(txRow).join(''):'<div class="empty">Aucune transaction pour ce compte.</div>'}<button class="recent-more" data-act="all-transactions">See all</button></div>
  <div class="section-title"><h2>Widgets</h2><button data-act="notifications" aria-label="Afficher les notifications">${icon('bell')}</button></div><div class="home-widgets"><button class="home-widget" data-act="expenses" data-period="month"><p>Spent this month</p><strong>${esc(money(metrics.expense))}</strong><small>Personal · EUR</small>${widgetSpendingChart(metrics)}</button><button class="home-widget" data-act="tab" data-id="savings"><p>Savings</p><strong>${esc(money(pockets))}</strong><small>${state.pockets.length} pockets</small><span class="widget-icons" aria-hidden="true"><span>${icon('pocket')}</span><span>${icon('plane')}</span><span>${icon('shield')}</span></span></button></div>`;
}

function cardVisual(extra=null) {
  const frozen=extra?extra.frozen:state.cards.frozen,last4=extra?extra.last4:state.cards.last4;
  return `<div class="card-visual ${frozen?'frozen':''}"><div class="card-top"><span class="card-brand">flex</span></div><div class="card-chip" aria-hidden="true">${Array.from({length:6},()=>'<i></i>').join('')}</div><div class="card-number">${showCard?'0000 0000':'•••• •••• ••••'} ${esc(last4)}</div><div class="card-bottom"><span class="card-holder"><span data-i18n-skip>${esc(identity().name)}</span><br><span style="display:block;margin-top:6px;font-size:8px;color:#8b9ab0">CARTE ${extra?.type==='disposable'?'ÉPHÉMÈRE':'VIRTUELLE'}</span></span><span class="card-mark" aria-hidden="true"></span></div></div>`;
}
function toggleRow(label,description,key,enabled,i) {
  return `<div class="setting-row"><div class="setting-left">${icon(i)}<div><div class="setting-name">${label}</div><div class="setting-description">${description}</div></div></div><button class="toggle ${enabled?'on':''}" data-act="toggle-setting" data-id="${key}" role="switch" aria-checked="${enabled}" aria-label="${label}"></button></div>`;
}
function cards() {
  return `${topbar()}<p class="page-eyebrow">À portée de main</p><h1 class="page-heading">Vos cartes.</h1>${cardVisual()}<div class="card-status ${state.cards.frozen?'frozen':''}"><span class="dot"></span>${state.cards.frozen?'Carte gelée':'Carte active'} · Virtuelle</div>
  <div class="three-actions"><button class="tile-action" data-act="card-details">${icon('eye')}Détails</button><button class="tile-action" data-act="freeze">${icon('snow')}${state.cards.frozen?'Dégeler':'Geler'}</button><button class="tile-action" data-act="card-limit">${icon('settings')}Limite</button></div>
  <div class="panel">${toggleRow('Paiements en ligne','Abonnements et achats','online',state.cards.online,'globe')}${toggleRow('À l’étranger','Transactions en devise locale','international',state.cards.international,'plane')}<button class="setting-row" style="width:100%;text-align:left" data-act="card-limit"><span class="setting-left">${icon('chart')}<span><span class="setting-name" style="display:block">Plafond quotidien</span><span class="setting-description" style="display:block">${esc(money(state.cards.dailyLimit))} / jour</span></span></span>${icon('chevron')}</button></div>
  ${(state.cards.extra||[]).map(c=>`<button class="pocket" data-act="extra-card" data-id="${esc(c.id)}"><span class="pocket-top"><span class="pocket-icon" style="background:var(--soft)">${icon('cards')}</span><span><span class="pocket-name" style="display:block">Carte ${c.type==='disposable'?'éphémère':'virtuelle'}</span><span class="setting-description" style="display:block">•••• ${esc(c.last4)} · ${c.frozen?'Gelée':'Active'}</span></span>${icon('chevron')}</span></button>`).join('')}
  <button class="outline-button" data-act="new-card">${icon('plus')}Créer une carte</button>`;
}
function contactsHTML() {
  return `<div class="contact-list">${state.contacts.map(c=>`<button class="contact" data-act="send" data-id="${esc(c.id)}"><span class="contact-circle" style="background:${esc(c.color)}">${esc(c.initials)}</span><span data-i18n-skip>${esc(c.name.split(' ')[0])}</span></button>`).join('')}<button class="contact contact-add" data-act="new-contact"><span class="contact-circle">${icon('plus')}</span><span>Ajouter</span></button></div>`;
}
function payments() {
  const pending=state.schedules.filter(s=>s.status==='pending');
  return `${topbar()}<p class="page-eyebrow">Un geste, et c’est envoyé</p><h1 class="page-heading">Paiements.</h1>${contactsHTML()}<div class="payment-grid"><button class="payment-tile" data-act="send">${icon('arrowUp')}<h3>Envoyer</h3><p>Un virement à un contact<br>ou à un bénéficiaire.</p></button><button class="payment-tile" data-act="request">${icon('arrowDown')}<h3>Demander</h3><p>Préparez une demande<br>de paiement.</p></button><button class="payment-tile" data-act="exchange">${icon('exchange')}<h3>Changer de devise</h3><p>Cinq devises,<br>un même espace.</p></button><button class="payment-tile" data-act="send" data-schedule="1">${icon('clock')}<h3>Programmer</h3><p>Choisissez une date<br>pour un envoi.</p></button></div>
  <div class="section-title"><h2>À venir</h2><span style="font-size:11px;color:var(--sub)">${pending.length} programmé${pending.length>1?'s':''}</span></div>
  <div class="transactions">${pending.length?pending.map(s=>`<button class="tx-row" data-act="schedule-details" data-id="${esc(s.id)}"><span class="tx-icon" style="background:var(--accent-soft);color:var(--accent)">${icon('clock')}</span><span class="tx-body"><span class="tx-name" style="display:block">${esc(s.recipient)}</span><span class="tx-sub" style="display:block">${esc(s.date)} · Virement</span></span><span class="tx-amount">${esc(money(s.cents,s.currency))}</span></button>`).join(''):`<div class="empty">${icon('clock')}Rien de prévu pour le moment.<br>Vos prochains virements apparaîtront ici.</div>`}</div>
  ${state.requests.length?`<div class="section-title"><h2>Vos demandes</h2></div><div class="transactions">${[...state.requests].reverse().map(r=>`<button class="tx-row" data-act="request-details" data-id="${esc(r.id)}"><span class="tx-icon" style="background:#e4f2ed;color:#329477">${icon('arrowDown')}</span><span class="tx-body"><span class="tx-name" data-i18n-skip style="display:block">${esc(r.name)}</span><span class="tx-sub" style="display:block">${r.status==='received'?'Réception':'En attente'}</span></span><span class="tx-amount">${esc(money(r.cents,r.currency))}</span></button>`).join('')}</div>`:''}
  `;
}
function savings() {
  const total=state.pockets.reduce((n,p)=>n+p.balance,0);
  return `${topbar()}<p class="page-eyebrow">Faire de la place à vos projets</p><h1 class="page-heading">Vos poches.</h1><div class="savings-total"><p>Épargne totale</p><h2>${esc(money(total))}</h2>${icon('pocket')}</div>
  ${state.pockets.map(p=>{const pct=Math.min(100,Math.round(p.balance/p.target*100));return `<button class="pocket" data-act="pocket" data-id="${esc(p.id)}"><span class="pocket-top"><span class="pocket-icon" style="background:${esc(p.color)}">${icon(p.icon)}</span><span class="pocket-name" data-i18n-skip>${esc(p.name)}</span><span style="margin-left:auto;color:var(--sub)">${icon('chevron')}</span></span><div class="pocket-amount">${esc(money(p.balance))}</div><div class="pocket-progress"><span style="width:${pct}%"></span></div><div class="pocket-meta"><span>Objectif ${esc(money(p.target))}</span><span>${pct} %</span></div></button>`;}).join('')}
  <button class="outline-button" data-act="new-pocket">${icon('plus')}Créer une poche</button><p class="pocket-footnote">Organisez vos projets avec des poches et des objectifs.</p>`;
}
function chartSVG(metrics) {
  const weeks=[0,0,0,0,0];
  metrics.spending.forEach(t=>{const day=+dateKey(new Date(t.timestamp),regionById(t.region).tz).slice(-2);weeks[Math.min(4,Math.floor((day-1)/7))]-=t.amount;});
  const max=Math.max(...weeks,1);
  return `<svg class="bar-chart" viewBox="0 0 350 145" role="img" aria-label="Dépenses par semaine"><path d="M0 108H350M0 60H350M0 12H350" stroke="var(--line)" stroke-dasharray="3 4"/>${weeks.map((v,i)=>{const height=Math.max(3,88*v/max),x=18+i*68;return `<rect x="${x}" y="${108-height}" width="38" height="${height}" rx="8" fill="${i===3?'#667ff1':'#c2cef3'}"/><text x="${x+19}" y="135" text-anchor="middle" font-size="10" fill="var(--sub)">S${i+1}</text><title>Semaine ${i+1} : ${esc(localizedMoney(v))}</title>`;}).join('')}</svg>`;
}
function distribution(items,otherLabel='Others') {
  const total=items.reduce((sum,c)=>sum+c.value,0),leading=items[0],other=total-(leading?.value||0);
  if(!leading)return '<div class="distribution-empty">No activity yet</div>';
  const label={transfer:'Transfers',restaurant:'Restaurants',shopping:'Shopping',groceries:'Groceries',transport:'Transport',coffee:'Coffee',subscription:'Subscriptions',cash:'Cash',pockets:'Savings'};
  return `<div class="distribution"><div class="distribution-track" aria-hidden="true"><span style="flex:${leading.value};background:${leading.color}"></span>${other?`<span style="flex:${other};background:#bcbcbc"></span>`:''}</div><div class="distribution-legend"><span><i style="background:${leading.color}"></i>${label[leading.id]||'Other'}</span>${other?`<span><i style="background:#bcbcbc"></i>${otherLabel}</span>`:''}</div></div>`;
}
function analyticsOverview() {
  const currency=state.currency,stats=dashboardMetrics(state,{period:analyticsPeriod,currency,timeZone:currentRegion().tz,rates:RATES,locale:getLocale()});
  const monthly=monthMetrics(state,nowDay().slice(0,7)),pct=Math.min(100,monthly.expense/state.budget*100);
  let daily=stats.daily.length?stats.daily:Array.from({length:7},(_,i)=>({key:String(i),income:0,expense:0}));
  if(daily.length>7){const groups=Array.from({length:7},()=>({key:'',income:0,expense:0}));daily.forEach((day,i)=>{const group=groups[Math.floor(i*7/daily.length)];group.key=group.key?group.key.split(' – ')[0]+' – '+day.key:day.key;group.income+=day.income;group.expense+=day.expense;});daily=groups;}
  const maxIncome=Math.max(...daily.map(d=>d.income),1),maxFlow=Math.max(stats.income,stats.spent,1);
  return `<header class="detail-toolbar"><button class="icon-button" data-act="back-main" aria-label="Retour à l’accueil">${icon('close')}</button></header><h1 class="analytics-title">Analytics</h1><span class="sr-only">Votre argent</span>
  <div class="analytics-scope"><button data-act="accounts">Personal ${icon('down')}</button><button data-act="analytics-period">${stats.range.caption}</button></div>
  <button class="insight-card spent-card" data-act="expenses" data-period="${analyticsPeriod}" aria-label="Explorer les dépenses"><span class="insight-label">Spent</span><strong>${esc(roundedMoney(stats.spent,currency))}</strong>${state.hideBalance?'<span class="insight-hidden">Montants masqués</span>':distribution(stats.categories)}<span class="sr-only">Explorer les dépenses</span></button>
  <div class="insight-grid"><button class="insight-card income-card" data-act="income-history"><span class="insight-label">Income</span><strong>${esc(roundedMoney(stats.income,currency))}</strong><span class="insight-change ${stats.incomeChange<0?'negative':'positive'}">${stats.incomeChange<0?'▾':'▴'} ${esc(roundedMoney(Math.abs(stats.incomeChange),currency))}</span>${state.hideBalance?'':`<div class="income-bars" aria-label="Entrées par période">${daily.map(d=>`<span class="${d.income?'has-income':''}" style="--bar-height:${Math.max(6,Math.round(d.income/maxIncome*100))}%" title="${esc(d.key)} : ${esc(money(d.income,currency))}"></span>`).join('')}</div>`}</button>
  <button class="insight-card cashflow-card" data-act="cashflow-history"><span class="insight-label">Net cashflow</span><strong>${esc(roundedMoney(stats.net,currency))}</strong><span class="insight-change ${stats.net<0?'negative':'positive'}">${stats.net<0?'⊖ Negative':'⊕ Positive'}</span>${state.hideBalance?'':`<div class="cashflow-bars" aria-label="Entrées et dépenses"><div><span style="width:${stats.income/maxFlow*100}%"></span></div><div><span style="width:${stats.spent/maxFlow*100}%"></span></div></div>`}</button></div>
  <div class="analytics-dots" aria-hidden="true"><i class="is-small"></i><i></i><i></i><i></i><i class="is-active"></i></div><h2 class="overview-title">Overview</h2>
  <button class="insight-card assets-card" data-act="assets"><span class="insight-label">Total assets</span><strong>${esc(roundedMoney(stats.assets,currency))}</strong>${state.hideBalance?'<span class="insight-hidden">Montants masqués</span>':distribution([{id:'cash',value:stats.cash,color:'#6498ff'},{id:'pockets',value:stats.pockets,color:'#ba54ec'}],'Savings')}</button>
  <div class="panel analytics-budget"><div class="chart-header"><span>Monthly budget · EUR</span><button data-act="budget">Manage</button></div><strong>${esc(money(Math.max(0,state.budget-monthly.expense)))}</strong><p>${monthly.expense>state.budget?'Budget dépassé':'Remaining this month'}</p><div class="budget-track"><span style="width:${pct}%"></span></div><div class="budget-figures"><span>${esc(money(monthly.expense))} spent</span><span>${esc(money(state.budget))}</span></div></div><button class="outline-button" data-act="export">${icon('download')}Exporter les données</button><p class="pocket-footnote">Le change et les mouvements d’épargne sont exclus des dépenses.</p>`;
}
function invest() {
  return `${topbar(true)}<section class="invest-hero"><p>Capital at risk</p><div class="invest-balance"><h1>${esc(roundedMoney(preview.cash,'USD'))}</h1><button data-act="invest-info" aria-label="À propos du portefeuille">${icon('info')}</button></div><span>${esc(roundedMoney(0,'USD'))} <span>0,00 %</span></span></section>
  <div class="quick-actions">${[['invest-market','trend','Trade'],['invest-deposit','plus','Add money'],['invest-withdraw','arrowDown','Withdraw'],['invest-more','more','More']].map(([act,i,label])=>`<button class="quick-action" data-act="${act}"><span class="quick-icon">${icon(i)}</span><span>${label}</span></button>`).join('')}</div>${promo(true)}
  <section class="brokerage"><button class="brokerage-heading" data-act="brokerage-toggle" aria-expanded="${brokerageExpanded}"><span class="brokerage-icon">${icon('trend')}</span><span><strong>Brokerage account</strong><small>${esc(roundedMoney(preview.cash,'USD'))}</small></span>${icon(brokerageExpanded?'down':'chevron',brokerageExpanded?'rotated':'')}</button>${brokerageExpanded?`<button class="brokerage-cash" data-act="invest-deposit"><span class="brokerage-icon">${icon('cash')}</span><strong>Cash balance</strong><span>${esc(roundedMoney(preview.cash,'USD'))}</span></button>`:''}</section>
  ${preview.watchlist.length?`<div class="section-title"><h2>Watchlist</h2><button data-act="invest-market">Manage</button></div><div class="transactions">${preview.watchlist.map(id=>instrumentRow(id)).join('')}</div>`:''}<p class="pocket-footnote">Portefeuille. Aucune cotation ni opération de marché réelle.</p>`;
}
const instruments=[{id:'global',name:'Global Equity',symbol:'EQTY',description:'Panier d’actions internationales',icon:'globe'},{id:'tech',name:'Technology',symbol:'TECH',description:'Technologies de croissance',icon:'spark'},{id:'bonds',name:'Short-term bonds',symbol:'BOND',description:'Obligations à court terme',icon:'shield'},{id:'bitcoin',name:'Bitcoin',symbol:'BTC',description:'Actif numérique',icon:'bitcoin'},{id:'ethereum',name:'Ethereum',symbol:'ETH',description:'Actif numérique',icon:'spark'}];
function instrumentRow(id) {
  const item=instruments.find(i=>i.id===id);if(!item)return '';
  return `<button class="tx-row" data-act="instrument" data-id="${id}"><span class="tx-icon" style="background:var(--soft)">${icon(item.icon)}</span><span class="tx-body"><span class="tx-name">${item.name}</span><span class="tx-sub" style="display:block">${item.symbol}</span></span>${icon('chevron')}</button>`;
}
function credit() {
  return `${topbar()}<h1 class="page-heading explorer-heading">Credit</h1><div class="explorer-hero"><span class="explorer-emblem">${icon('coins')}</span><h2>A plan that fits</h2><p>Simulez une mensualité en quelques secondes.</p></div><div class="panel"><form id="credit-form"><div class="form-field"><label for="credit-amount">Montant en euros</label><input id="credit-amount" name="amount" inputmode="decimal" value="5000" required></div><div class="field-pair"><div class="form-field"><label for="credit-months">Durée (mois)</label><select id="credit-months" name="months"><option>12</option><option selected>24</option><option>36</option><option>48</option></select></div><div class="form-field"><label for="credit-rate">Taux annuel (%)</label><input id="credit-rate" name="rate" inputmode="decimal" value="5" required></div></div><button class="primary-button">Calculer</button>${errorHTML()}</form><div id="credit-result" class="credit-result" role="status"></div></div><p class="pocket-footnote">Calcul indicatif, hors frais.</p>`;
}
function cryptoView() {
  return `${topbar(true)}<section class="crypto-hero"><p>Crypto</p><h1>${esc(roundedMoney(0))}</h1><span>No holdings</span></section><div class="quick-actions">${[['crypto-market','search','Explore'],['invest-market','plus','Watchlist'],['expenses','chart','Activity'],['invest-info','more','More']].map(([act,i,l])=>`<button class="quick-action" data-act="${act}"><span class="quick-icon">${icon(i)}</span><span>${l}</span></button>`).join('')}</div><div class="reference-promo crypto-promo"><button class="promo-content" data-act="crypto-market"><strong>Explore digital assets</strong><span>Build a watchlist, at your own pace.</span><img src="./promo-assets.svg?v=1" alt="" width="150" height="110"></button></div><div class="section-title"><h2>Discover</h2></div><div class="transactions">${['bitcoin','ethereum'].map(instrumentRow).join('')}</div><p class="pocket-footnote">Explorez les actifs numériques disponibles.</p>`;
}
function points() {
  const metrics=expenseMetrics(state.transactions,{period:'all',timeZone:currentRegion().tz,locale:getLocale()});
  const points=Math.floor(metrics.total/100);
  return `${topbar()}<section class="points-hero"><span class="points-symbol">${icon('rewards')}</span><p>FlexPoints</p><h1>${state.hideBalance?'••••':new Intl.NumberFormat(getLocale()).format(points)}</h1><span>Points de fidélité</span></section><div class="panel"><h2>Your everyday activity</h2><p class="sheet-sub" style="margin-top:12px">Un point par euro de dépenses cumulées. Utilisables avec les partenaires Flex.</p><button class="primary-button" data-act="expenses" data-period="all">Voir les dépenses</button></div><button class="outline-button" data-act="savings-open">${icon('pocket')}Vos projets d’épargne</button>`;
}

function analytics() {return analyticsOverview();}
function expenses() {
  const metrics=analyticsBreakdownMetrics(state,{scope:expensesScope,period:expensesPeriod,anchor:expensesAnchor,currency:state.currency,timeZone:currentRegion().tz,locale:getLocale(),rates:RATES});
  const transactions=expensesCategory?metrics.transactions.filter(t=>expensesScope==='cashflow'?(expensesCategory==='income'?t.amount>0:t.amount<0):t.category===expensesCategory):metrics.transactions;
  const metadata={...CATEGORY_META,spending:{label:'Spent',icon:'arrowUp'},income:{label:'Income',icon:'arrowDown'},pockets:{label:'Savings',icon:'pocket'}};
  for(const currency of Object.keys(CURRENCIES))metadata['wallet-'+currency]={label:currency,icon:'cash'};
  const label=expensesCategory?(metadata[expensesCategory]?.label||'Autres'):expensesScope==='income'?'All income':expensesScope==='cashflow'?'All activity':'Toutes les dépenses';
  return `${renderExpenseSummary(metrics,{mode:expensesMode,category:expensesCategory,hidden:state.hideBalance,money,icon,metadata,locale:getLocale(),backLabel:'Retour à l’analyse'})}${expensesScope==='assets'?'':`
    <div class="expenses-section-heading" id="expenses-transactions"><h2>${esc(label)}</h2>${expensesCategory?'<button class="expenses-clear" data-act="expenses-category" data-id="">Tout voir</button>':`<span>${transactions.length} opération${transactions.length>1?'s':''}</span>`}</div>
    ${transactions.length?txGroups(transactions.slice(0,expensesLimit)):'<div class="expenses-empty">Aucune opération à afficher.</div>'}
    ${transactions.length>expensesLimit?'<button class="expenses-more" data-act="expenses-more">Afficher plus d’opérations</button>':''}
    <p class="expenses-note">Le change et les mouvements d’épargne sont exclus des dépenses.</p>`}`;
}
function openAnalyticsBreakdown(scope,period=analyticsPeriod) {
  expensesScope=scope;view='expenses';expensesPeriod=['week','month','halfyear','year','all'].includes(period)?period:'year';
  expensesAnchor=periodRange({period:expensesPeriod,timeZone:currentRegion().tz,locale:getLocale()}).anchor;
  expensesMode='donut';expensesCategory='';expensesLimit=20;closeSheet();render();window.scrollTo({top:0});
}
function allTransactions() {
  let txs=ordered().filter(t=>t.currency===state.currency);
  if(filter==='out')txs=txs.filter(t=>t.amount<0);
  if(filter==='in')txs=txs.filter(t=>t.amount>0);
  if(filter==='card')txs=txs.filter(t=>t.automatic);
  if(search)txs=txs.filter(t=>(t.name+' '+t.city+' '+(t.note||'')+' '+categoryMeta(t).label).toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')));
  return `<div class="back-heading"><button class="icon-button" data-act="back-main" aria-label="Retour">${icon('back')}</button><h1>Transactions</h1><span style="margin-left:auto"></span></div><div class="search-field">${icon('search')}<input id="tx-search" type="search" placeholder="Rechercher un lieu, un paiement…" aria-label="Rechercher" value="${esc(search)}"></div><div class="chips">${[['all','Tout'],['out','Dépenses'],['in','Entrées'],['card','Carte']].map(([id,l])=>`<button class="chip ${filter===id?'active':''}" data-act="filter" data-id="${id}">${l}</button>`).join('')}</div><div style="display:flex;justify-content:space-between;color:var(--sub);font-size:10px"><span>${txs.length} transaction${txs.length>1?'s':''} · ${state.currency}</span><button data-act="accounts">Changer de compte</button></div><div id="tx-results">${txs.length?txGroups(txs):'<div class="panel empty">Aucun résultat pour cette recherche.</div>'}</div>`;
}
function lockHTML() {
  const cooldown=blockedUntil>Date.now();
  return `<section class="lock-screen"><div class="lock-top"><span class="lock-brand">flex</span></div><div class="lock-center"><div class="lock-avatar" data-i18n-skip>${esc(identity().initials)}</div><h1 data-i18n-skip>${esc((getLanguage()==='fr'?'Bonjour, ':'Hi, ')+identity().firstName+'.')}</h1><p>Votre espace personnel vous attend.<br>Saisissez votre code à 4 chiffres.</p><div class="pin-dots" aria-label="${pin.length} chiffres saisis">${[0,1,2,3].map(i=>`<span class="pin-dot ${i<pin.length?'filled':''}"></span>`).join('')}</div><div id="pin-error" class="pin-error" role="status">${cooldown?'Réessayez dans '+Math.ceil((blockedUntil-Date.now())/1000)+' s':''}</div></div><div class="keypad">${[['1',''],['2','ABC'],['3','DEF'],['4','GHI'],['5','JKL'],['6','MNO'],['7','PQRS'],['8','TUV'],['9','WXYZ']].map(([n,l])=>`<button class="key" data-act="pin" data-id="${n}" aria-label="${n}" ${cooldown?'disabled':''}>${n}<small>${l}</small></button>`).join('')}<button class="key subtle" data-act="pin-help">Aide</button><button class="key" data-act="pin" data-id="0" aria-label="0" ${cooldown?'disabled':''}>0</button><button class="key subtle" data-act="pin-delete" aria-label="Effacer le dernier chiffre">${icon('backspace')}</button></div></section>`;
}
function render() {
  theme();
  if(needsSetup){root.innerHTML=localizeHTML(renderSetup(setupDraft,{error:setupError,busy:setupBusy,language:getLanguage()}));return;}
  const disclosure=state.scenario?'':'';
  if(!unlocked){root.innerHTML=localizeHTML(lockHTML());return;}
  const content=view==='expenses'?expenses():view==='analytics-overview'?analyticsOverview():view==='transactions'?allTransactions():({home,cards,payments,savings,analytics,invest,credit,crypto:cryptoView,points}[tab]||home)();
  const editorBanner=editMode?'<div class="editor-banner"><span>Mode édition</span><div class="editor-banner-actions"><button data-act="editor-expenses">Dépenses</button><button data-act="editor">Régler le scénario</button><button class="editor-exit-button" data-act="editor-exit" aria-label="Quitter le mode édition">×</button></div></div>':disclosure;
  const screenName=view==='analytics-overview'?'analytics':view==='main'?tab:view;
  root.innerHTML=localizeHTML(`<section class="screen ${screenName}-screen">${editMode?editorBanner:''}${content}${editMode?'':disclosure}${!storageAvailable?'<div class="info-box neutral">Les données ne peuvent pas être sauvegardées dans ce navigateur.</div>':''}</section>${view==='main'&&tab!=='analytics'?nav():''}`);
}
function openSheet(title,content,headerActions='') {
  directExpenseId=null;
  previousFocus=document.activeElement;
  const closeButton=`<button class="icon-button" data-act="close-sheet" aria-label="Fermer">${icon('close')}</button>`;
  const headerControls=headerActions?`<div class="sheet-header-actions">${headerActions}${closeButton}</div>`:closeButton;
  sheetRoot.innerHTML=localizeHTML(`<div class="sheet-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1"><div class="sheet-handle"></div><div class="sheet-header"><h2 id="sheet-title">${esc(title)}</h2>${headerControls}</div>${content}</section></div>`);
  document.body.style.overflow='hidden';
  setTimeout(()=>sheetRoot.querySelector('input:not([type=range]),select,button,.sheet')?.focus(),60);
}
function closeSheet() {directExpenseId=null;sheetRoot.innerHTML='';document.body.style.overflow='';if(previousFocus?.isConnected)previousFocus.focus();}
function error(message) {const el=document.getElementById('form-error');if(el){el.textContent=tr(message);el.scrollIntoView({block:'nearest'});}else toast(message);}
const errorHTML=()=>'<p id="form-error" class="form-error" role="alert"></p>';
const currencyOptions=(selected)=>Object.keys(CURRENCIES).map(c=>`<option value="${c}" ${selected===c?'selected':''}>${CURRENCIES[c].flag} ${c}</option>`).join('');
function success(title,copy) {
  persist();render();
  openSheet(title,`<div class="success-mark">${icon('check')}</div><h3 class="success-title">${esc(title)}</h3><p class="success-copy">${esc(copy)}</p><div class="info-box neutral">Opération enregistrée dans votre espace.</div><button class="primary-button" data-act="close-sheet">Terminé</button>`);
}
function detailsRow(label,value){
  if(label==='Méthode')value=String(value).replace(/ · (?:simulé|simulation|démo)/g,'').replace(/ simulée?s?/g,'').replace(/ de démo/g,'');
  return `<div class="detail-row"><span>${esc(label)}</span><span data-i18n-skip>${esc(value)}</span></div>`;
}
function accountSheet() {
  openSheet('Vos comptes',`<p class="sheet-sub">Cinq devises pour vos déplacements.</p><div class="transactions">${Object.entries(CURRENCIES).map(([c,meta])=>`<button class="tx-row" data-act="select-account" data-id="${c}"><span class="contact-circle" style="height:42px;width:42px;background:var(--soft);font-size:22px">${currencyFlag(c)}</span><span class="tx-body"><span class="tx-name" style="display:block">${meta.name}</span><span class="tx-sub" style="display:block">${c} · Compte</span></span><span class="tx-amount">${esc(money(state.wallets[c],c))}</span>${state.currency===c?icon('check'):''}</button>`).join('')}</div>`);
}
function topupSheet() {
  openSheet('Ajouter de l’argent',`<p class="sheet-sub">Alimentez votre compte ${state.currency} avec de l’argent.</p><form id="topup-form"><div class="form-field"><label for="amount">Montant · ${state.currency}</label><input id="amount" name="amount" class="amount-input" inputmode="decimal" placeholder="0,00" required autocomplete="off" maxlength="13"></div><div class="chips">${[50,100,250,500].map(n=>`<button type="button" class="chip" data-act="set-amount" data-id="${n}">+ ${n} ${CURRENCIES[state.currency].symbol}</button>`).join('')}</div><div class="form-field"><label for="method">Méthode</label><select id="method" name="method"><option>Carte</option><option>Virement</option></select></div>${errorHTML()}<button class="primary-button" type="submit">Ajouter l’argent</button></form>`);
}
function sendSheet(contactId=null,scheduled=false) {
  const contact=state.contacts.find(c=>c.id===contactId),today=nowDay();
  openSheet(scheduled?'Programmer un virement':'Envoyer de l’argent',`<p class="sheet-sub">Un envoi conservé dans votre historique.</p><form id="send-form"><div class="form-field"><label for="recipient">Destinataire</label><input id="recipient" name="recipient" placeholder="Nom du bénéficiaire" value="${esc(contact?.name||'')}" required maxlength="60" autocomplete="off" list="contacts"><datalist id="contacts">${state.contacts.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist></div><div class="field-pair"><div class="form-field"><label for="amount">Montant</label><input id="amount" name="amount" inputmode="decimal" placeholder="0,00" required maxlength="13"></div><div class="form-field"><label for="currency">Devise</label><select id="currency" name="currency">${currencyOptions(state.currency)}</select></div></div><div class="form-field"><label for="send-date">Date d’envoi</label><input id="send-date" name="date" type="date" min="${today}" max="${shiftDay(today,365)}" value="${scheduled?shiftDay(today,1):today}" required></div><div class="form-field"><label for="note">Message (facultatif)</label><input id="note" name="note" placeholder="Restaurant, cadeau…" maxlength="100"></div><div class="info-box neutral">Disponible sur le compte ${state.currency} : ${esc(money(state.wallets[state.currency],state.currency))}. Le compte EUR conserve une réserve du compte supérieure à 23 000 €.</div>${errorHTML()}<button class="primary-button" type="submit">Confirmer le virement</button></form>`);
}
function exchangeSheet() {
  const from=state.currency,to=from==='EUR'?'USD':'EUR';
  openSheet('Changer de devise',`<p class="sheet-sub">Passez d’un compte à l’autre avec les taux fixes de l’app.</p><form id="exchange-form"><div class="field-pair"><div class="form-field"><label for="from">Depuis</label><select id="from" name="from">${currencyOptions(from)}</select></div><div class="form-field"><label for="to">Vers</label><select id="to" name="to">${currencyOptions(to)}</select></div></div><div class="form-field"><label for="amount">Montant à changer</label><input id="amount" name="amount" class="amount-input" inputmode="decimal" placeholder="0,00" required maxlength="13"></div><div id="exchange-preview" class="info-box">Renseignez un montant pour afficher la conversion.</div>${errorHTML()}<button class="primary-button" type="submit">Confirmer le change</button></form>`);
}
function requestSheet() {
  openSheet('Demander un paiement',`<p class="sheet-sub">Préparez une demande. Rien n’est envoyé à vos contacts.</p><form id="request-form"><div class="form-field"><label for="name">À qui ?</label><input id="name" name="name" placeholder="Nom du contact" maxlength="60" required></div><div class="field-pair"><div class="form-field"><label for="amount">Montant</label><input id="amount" name="amount" inputmode="decimal" placeholder="0,00" maxlength="13" required></div><div class="form-field"><label for="currency">Devise</label><select id="currency" name="currency">${currencyOptions(state.currency)}</select></div></div>${errorHTML()}<button class="primary-button" type="submit">Créer la demande</button></form>`);
}
function transactionSheet(id) {
  const t=state.transactions.find(t=>t.id===id);if(!t)return;
  const c=categoryMeta(t),amount=t.status==='declined'?t.attemptedAmount:t.amount;
  const stamp=new Intl.DateTimeFormat(getLocale(),{timeZone:regionById(t.region).tz,dateStyle:'long',timeStyle:'short'}).format(new Date(t.timestamp));
  const actions=isEditableExpense(t)?`<details class="expense-detail-menu"><summary class="icon-button" aria-label="Options de la dépense">${icon('more')}</summary><div class="expense-detail-dropdown" role="group" aria-label="Actions de la dépense"><button data-act="editor-expense-edit" data-id="${esc(t.id)}">Modifier la dépense</button><button class="expense-menu-danger" data-act="editor-expense-delete" data-id="${esc(t.id)}">Supprimer cette dépense</button>${!editMode&&editorUndo?.expenseId===t.id?'<button data-act="editor-undo">Annuler le dernier changement</button>':''}</div></details>`:'';
  openSheet('Détails de la transaction',`<div class="detail-hero"><div class="tx-icon" style="background:${c.color}17;color:${c.color}">${icon(c.icon)}</div><p data-i18n-skip>${esc(t.name)}</p><h3 class="${amount>0?'positive':''}">${amount>0?'+':''}${esc(money(amount,t.currency))}</h3><p>${t.status==='declined'?'Paiement refusé':'Transaction · Terminée'}</p></div><div class="details-list">${detailsRow('Date',stamp)}${detailsRow('Lieu',t.city||'En ligne')}${detailsRow('Catégorie',c.label)}${detailsRow('Méthode',t.method||'—')}${t.originalAmount&&t.originalCurrency!==t.currency?detailsRow('Montant local',state.hideBalance?'••••':localizedMoney(t.originalAmount,t.originalCurrency)):''}${detailsRow('Solde après opération',money(t.balanceAfter,t.currency))}${t.note?detailsRow('Message',t.note):''}${detailsRow('Référence','FLEX-'+t.id.slice(-12).toUpperCase())}</div><button class="primary-button" data-act="close-sheet">Fermer</button>`,actions);
}
function accountDetailsSheet() {
  const isEUR=state.currency==='EUR';
  openSheet('Coordonnées du compte',`<p class="sheet-sub">Coordonnées pour recevoir un virement.</p><div class="details-list">${detailsRow('Titulaire',identity().name)}${detailsRow('Compte',state.currency+' · Flex')}${detailsRow(isEUR?'IBAN':'Référence du compte',accountReference())}${detailsRow('Établissement','Flex')}</div><button class="primary-button" data-act="copy-account">${icon('copy')}Copier ${isEUR?'l’IBAN':'la référence'}</button>${editMode&&isEUR?'<button class="secondary-button" data-act="editor-iban">Modifier l’IBAN</button>':''}`);
}

function profileSheet() {
  openSheet('Votre espace',`<div class="profile-button" style="margin:0 0 20px"><span class="avatar" style="width:57px;height:57px;border-radius:50%" data-i18n-skip>${esc(identity().initials)}</span><span><span style="display:block;font-size:17px;font-weight:600" data-i18n-skip>${esc(identity().name)}</span><span class="profile-caption" style="display:block" data-i18n-skip>@${esc(identity().handle)} · Plus</span></span></div><div class="panel">
  <button class="setting-row language-setting" data-act="language"><span class="setting-left">${icon('globe')}<span><span class="setting-name">Langue</span><span class="setting-description" data-i18n-skip>${getLanguage()==='fr'?'Français':'English'}</span></span></span>${icon('chevron')}</button>
  ${toggleRow('Activité quotidienne','Ajouts automatiques à l’ouverture de l’app','autoSimulation',state.autoSimulation,'repeat')}
  ${toggleRow('Notifications dans l’app','Informer des nouvelles opérations','notify',state.notify,'bell')}
  <button class="editor-launch" data-act="editor"><span class="setting-left">${icon('settings')}<span><span class="setting-name" style="display:block">Mode édition</span><span class="setting-description" style="display:block">Soldes, voyages et historique</span></span></span>${icon('chevron')}</button>
  <button class="setting-row" style="width:100%;text-align:left" data-act="location"><span class="setting-left">${icon('location')}<span><span class="setting-name" style="display:block">Localisation</span><span class="setting-description" style="display:block">${esc(currentRegion().city)} · ${state.location.source==='gps'?'Position du navigateur':'Choix manuel'}</span></span></span>${icon('chevron')}</button>
  <button class="setting-row" style="width:100%;text-align:left" data-act="install"><span class="setting-left">${icon('plus')}<span class="setting-name">Installer sur l’iPhone</span></span>${icon('chevron')}</button></div>
  <div class="info-box neutral">Réserve du compte EUR : 23 000,01 € minimum.<br>Code local à 4 chiffres · Verrouillage après 5 minutes d’inactivité ou 1 minute en arrière-plan.<br>Les données restent dans ce navigateur.</div>
  <button class="primary-button" data-act="lock">${icon('lock')}Verrouiller l’app</button><button class="secondary-button" data-act="export">Exporter les données</button><button class="secondary-button danger-button" data-act="reset">Réinitialiser les données</button>`);
}
function languageSheet() {
  openSheet('Langue',`<p class="sheet-sub">Choisissez la langue de l’interface.</p><div class="language-options" role="radiogroup" aria-label="Langue de l’app">${[['en','English'],['fr','Français']].map(([id,label])=>`<button class="language-option" role="radio" aria-checked="${getLanguage()===id}" data-act="select-language" data-id="${id}"><span data-i18n-skip>${label}</span>${getLanguage()===id?icon('check'):''}</button>`).join('')}</div>`);
}
function editorSheet() {
  if(!editorDraft)editorDraft=scenarioDefaults(state);
  openSheet('Mode édition',`${editorNotice?`<div class="editor-result" role="status"><strong>${esc(editorNotice)}</strong>${state.scenarioSummary?`${state.scenarioSummary.count} opérations lors de la dernière régénération.<br>${esc(localizedMoney(state.scenarioSummary.expenses))} de dépenses · ${esc(localizedMoney(state.scenarioSummary.income))} de revenus.`:''}</div>`:''}${renderEditorTools(eurAccountIban())}${renderScenarioEditor(editorDraft,{canUndo:!!editorUndo,errorHTML:errorHTML()})}`);
}
function readEditorDraft(form=document.getElementById('scenario-form')) {
  if(!form||!editorDraft)throw new Error('Ouvre le mode édition pour modifier le scénario.');
  const f=new FormData(form),balances=Object.fromEntries(Object.keys(RATES).map(currency=>[currency,parseMoney(f.get('wallet-'+currency))]));
  const config={...editorDraft.config,monthlyIncome:parseMoney(f.get('income')),monthlyExpenses:parseMoney(f.get('spending')),incomeKind:String(f.get('income-kind')),incomeDay:Number(f.get('income-day')),stops:editorDraft.config.stops.map((_,i)=>({date:String(f.get('stop-date-'+i)),regionId:String(f.get('stop-region-'+i))}))};
  editorDraft={balances,config};return editorDraft;
}
function captureEditorUndo() {
  return SCENARIO_FIELDS.map(key=>({key,present:Object.hasOwn(state,key),value:state[key]===undefined?undefined:JSON.parse(JSON.stringify(state[key]))}));
}
function requireEditMode() {
  if(!editMode)throw new Error('Active le mode édition avant d’enregistrer un scénario.');
}
function requireExpenseEdit(id) {
  if(editMode)return;
  if(!id||directExpenseId!==id)throw new Error('Active le mode édition avant d’enregistrer un scénario.');
}
function commitEditorChange(candidate,notice,expenseId) {
  if(expenseId)requireExpenseEdit(expenseId);else requireEditMode();
  if(!assertState(candidate))throw new Error('Le scénario n’a pas pu être validé. Aucune donnée n’a été modifiée.');
  const fields=captureEditorUndo();
  state=candidate;editorUndo={fields,fingerprint:scenarioFingerprint(state),expenseId:!editMode?expenseId:null};editorNotice=notice;
  editorDraft=scenarioDefaults(state);persist();render();
}
function preserveEditorDraft() {
  if(sheetRoot.querySelector('#scenario-form'))readEditorDraft();
}
function editorExpensesSheet() {
  requireEditMode();
  openSheet('Gérer les dépenses',renderExpenseList(state,{currency:editorExpenseCurrency,limit:editorExpenseLimit,locale:getLocale(),notice:editorNotice,canUndo:!!editorUndo}));
}
function expenseEditorSheet(id) {
  const direct=!editMode;
  if(direct&&!isEditableExpense(state.transactions.find(tx=>tx.id===id)))throw new Error('Cette dépense est introuvable ou ne peut pas être modifiée.');
  if(!id)requireEditMode();
  openSheet(id?'Modifier la dépense':'Nouvelle dépense',renderExpenseForm(state,{id,currency:editorExpenseCurrency,errorHTML:errorHTML(),returnToExpense:direct}));
  if(direct)directExpenseId=id;
}
function ibanEditorSheet() {
  requireEditMode();openSheet('Modifier l’IBAN',renderIbanForm(eurAccountIban(),{errorHTML:errorHTML()}));
}
function deleteExpenseSheet(id) {
  const direct=!editMode,tx=state.transactions.find(tx=>tx.id===id);
  if(!isEditableExpense(tx))throw new Error('Cette dépense est introuvable ou ne peut pas être supprimée.');
  openSheet('Supprimer cette dépense',`<p class="sheet-sub">Cette dépense sera retirée de l’historique et des totaux d’Analytics. Le solde affiché reste inchangé.</p><div class="editor-delete-summary"><strong data-i18n-skip>${esc(tx.name)}</strong><span data-i18n-skip>${esc(localizedMoney(tx.amount,tx.currency))}</span></div>${errorHTML()}<button class="primary-button editor-delete-confirm" data-act="editor-expense-delete-confirm" data-id="${esc(id)}">Supprimer la dépense</button><button class="secondary-button" data-act="${direct?'transaction':'editor-expenses'}" ${direct?`data-id="${esc(id)}"`:''}>Annuler</button>`);
  if(direct)directExpenseId=id;
}
function locationSheet() {
  openSheet('Votre localisation',`<p class="sheet-sub">La région détermine les nouveaux libellés de commerces, la devise locale et les horaires. Les anciens paiements conservent leur lieu.</p><button class="primary-button" data-act="geolocate">${icon('location')}Utiliser ma position</button><p style="font-size:11px;color:var(--sub);margin:22px 0 12px">OU CHOISIR UNE VILLE</p><div class="transactions">${REGIONS.map(r=>`<button class="tx-row" data-act="select-location" data-id="${r.id}"><span style="font-size:24px;width:33px">${r.flag}</span><span class="tx-body"><span class="tx-name" style="display:block">${r.city}</span><span class="tx-sub" style="display:block">${r.country} · ${r.currency}</span></span>${currentRegion().id===r.id?icon('check'):icon('chevron')}</button>`).join('')}</div><p class="pocket-footnote">La position sert uniquement à choisir une région.<br>Les coordonnées exactes ne sont ni stockées ni envoyées par Flex.</p>`);
}
function cardDetailsSheet() {
  openSheet('Votre carte virtuelle',`<div class="details-list">${detailsRow('Titulaire',identity().name)}${detailsRow('Numéro',showCard?'0000 0000 0428':'•••• •••• 0428')}${detailsRow('Expiration','09/29')}${detailsRow('Code de sécurité','•••')}${detailsRow('État',state.cards.frozen?'Gelée':'Active')}</div><div class="info-box neutral">Carte virtuelle de votre compte.</div><button class="primary-button" data-act="reveal-card">${icon(showCard?'eyeOff':'eye')}${showCard?'Masquer les détails':'Afficher les détails'}</button>`);
}
function pocketSheet(id) {
  const p=state.pockets.find(p=>p.id===id);if(!p)return;
  openSheet(p.name,`<div class="detail-hero"><div class="tx-icon" style="background:${esc(p.color)};color:#768aaa">${icon(p.icon)}</div><h3>${esc(money(p.balance))}</h3><p>Objectif ${esc(money(p.target))}</p></div><form id="pocket-form" data-pocket="${esc(id)}"><div class="form-field"><label for="direction">Mouvement</label><select id="direction" name="direction"><option value="deposit">Ajouter à la poche</option><option value="withdraw">Retirer vers le compte EUR</option></select></div><div class="form-field"><label for="amount">Montant · EUR</label><input id="amount" name="amount" class="amount-input" inputmode="decimal" placeholder="0,00" maxlength="13" required></div>${errorHTML()}<button class="primary-button" type="submit">Confirmer le transfert</button></form><button class="secondary-button" data-act="edit-pocket" data-id="${esc(id)}">Modifier le nom et l’objectif</button>`);
}
function pocketEditor(id=null) {
  const p=state.pockets.find(p=>p.id===id);
  openSheet(p?'Modifier la poche':'Nouvelle poche',`<form id="new-pocket-form" data-pocket="${esc(id||'')}"><div class="form-field"><label for="pocket-name">Nom de votre projet</label><input id="pocket-name" name="name" maxlength="45" placeholder="Un voyage, un projet…" value="${esc(p?.name||'')}" required></div><div class="form-field"><label for="target">Objectif · EUR</label><input id="target" name="target" inputmode="decimal" placeholder="2 000" value="${p?p.target/100:''}" maxlength="13" required></div><div class="form-field"><label for="pocket-icon">Icône</label><select id="pocket-icon" name="icon">${[['plane','Voyage'],['shield','Sécurité'],['spark','Projet'],['home','Maison'],['bag','Achat']].map(([i,l])=>`<option value="${i}" ${p?.icon===i?'selected':''}>${l}</option>`).join('')}</select></div>${errorHTML()}<button class="primary-button" type="submit">${p?'Enregistrer':'Créer la poche'}</button></form>`);
}
function requestDetailsSheet(id) {
  const r=state.requests.find(r=>r.id===id);if(!r)return;
  openSheet('Demande',`<div class="detail-hero"><p>Demande à ${esc(r.name)}</p><h3>${esc(money(r.cents,r.currency))}</h3><p>${r.status==='received'?'Réception enregistrée':'En attente · Aucune notification envoyée'}</p></div><div class="info-box neutral">Ajoutez une réception pour explorer le parcours.</div>${r.status!=='received'?`<button class="primary-button" data-act="receive-request" data-id="${esc(id)}">Créer la réception</button>`:''}<button class="secondary-button" data-act="share-request" data-id="${esc(id)}">${icon('share')}Copier ou partager le texte</button>`);
}
function notificationsSheet() {
  const latest=ordered().slice(0,5),failed=state.schedules.filter(s=>s.status==='failed');
  openSheet('Vos notifications',`<p class="sheet-sub">L’activité récente de votre espace.</p>${failed.length?`<div class="info-box neutral">${failed.length} virement${failed.length>1?'s':''} programmé${failed.length>1?'s':''} non exécuté${failed.length>1?'s':''} : solde disponible insuffisant.</div>`:''}<div class="transactions">${latest.length?latest.map(t=>`<button class="tx-row" data-act="transaction" data-id="${esc(t.id)}"><span class="tx-icon" style="background:var(--soft);color:var(--sub)">${icon(t.status==='declined'?'info':t.amount>0?'arrowDown':'check')}</span><span class="tx-body"><span class="tx-name" style="display:block">${t.status==='declined'?'Paiement refusé':t.amount>0?'Argent reçu':'Opération enregistrée'}</span><span class="tx-sub" style="display:block">${esc(t.name)} · ${esc(money(t.amount,t.currency))}</span></span></button>`).join(''):'<div class="empty">Aucune notification.</div>'}</div>`);
}
function scheduleSheet(id) {
  const s=state.schedules.find(s=>s.id===id);if(!s)return;
  openSheet('Virement programmé',`<div class="details-list">${detailsRow('Destinataire',s.recipient)}${detailsRow('Montant',money(s.cents,s.currency))}${detailsRow('Date',s.date)}${detailsRow('État','En attente') }${s.note?detailsRow('Message',s.note):''}</div><div class="info-box neutral">Le virement sera enregistré à la prochaine ouverture après la date choisie, si le solde disponible le permet.</div><button class="secondary-button danger-button" data-act="cancel-schedule" data-id="${esc(id)}">Annuler le virement</button>`);
}
function setLocation(regionId,source='manual') {
  state.location={regionId,source,updatedAt:new Date().toISOString()};
  state.lastGeneratedDate=nowDay();persist();render();closeSheet();
  toast('Région : '+currentRegion().city);
}
async function geolocate(button) {
  if(!navigator.geolocation){toast('La géolocalisation est indisponible. Choisis une ville.');return;}
  button.disabled=true;button.textContent=tr('Localisation en cours…');
  navigator.geolocation.getCurrentPosition(p=>{
    const r=regionFromCoordinates(p.coords.latitude,p.coords.longitude);setLocation(r.id,'gps');
    if(r.id==='world')toast('Position détectée. Commerces de proximité génériques activés.');
  },err=>{
    button.disabled=false;button.innerHTML=icon('location')+tr('Réessayer');
    toast(err.code===1?'Accès à la position refusé. Le choix manuel reste disponible.':'Position indisponible. Choisis une ville.');
  },{enableHighAccuracy:false,timeout:12000,maximumAge:300000});
}
async function copy(text,message='Copié') {
  try {await navigator.clipboard.writeText(text);toast(message);}
  catch {
    const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();
    const copied=document.execCommand('copy');area.remove();
    toast(copied?message:'La copie est indisponible dans ce navigateur.');
  }
}
function exportCSV() {
  const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
  const rows=[['TYPE','DATE','LIBELLE','MONTANT','DEVISE','VILLE','CATEGORIE','STATUT'],...ordered().map(t=>['RELEVE',t.timestamp,t.name,(t.amount/100).toFixed(2),t.currency,t.city,categoryMeta(t).label,t.status])];
  const csv='\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='Flex-transactions-'+nowDay()+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  toast('Export préparé.');
}
function lock() {unlocked=false;pin='';showCard=false;editMode=false;editorDraft=null;editorUndo=null;editorNotice='';closeSheet();render();window.scrollTo({top:0});}
async function pinInput(n) {
  if(pinChecking||blockedUntil>Date.now()||pin.length>=4)return;
  pin+=n;render();
  if(pin.length!==4)return;
  pinChecking=true;
  try {
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pin));
    const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
    if(hash===PIN_HASH){unlocked=true;pin='';attempts=0;lastActive=Date.now();const added=rollForward(state);persist();render();if(added&&state.notify)toast(added+' nouvelle'+(added>1?'s opérations.':' opération.'));}
    else {pin='';attempts++;if(attempts>=5){blockedUntil=Date.now()+30000;attempts=0;}render();const el=document.getElementById('pin-error');if(el)el.textContent=tr(blockedUntil>Date.now()?'Trop de tentatives. Réessayez dans 30 s.':'Code incorrect. Réessayez.');document.querySelector('.pin-dots')?.classList.add('shake');}
  } catch {pin='';render();toast('Ouvre cette app via son lien HTTPS pour utiliser le code d’accès.');}
  finally {pinChecking=false;}
}
function refreshExchangePreview() {
  const form=document.getElementById('exchange-form');if(!form)return;
  const f=new FormData(form),cents=parseMoney(f.get('amount')),from=f.get('from'),to=f.get('to');
  const el=document.getElementById('exchange-preview');
  el.textContent=Number.isFinite(cents)&&cents>0?localizedMoney(cents,from)+' → '+localizedMoney(Math.round(cents/RATES[from]*RATES[to]),to)+' · taux fixe':'Renseignez un montant pour afficher la conversion.';
}
function contactEditor() {
  openSheet('Ajouter un contact',`<p class="sheet-sub">Ajoutez un bénéficiaire à votre espace.</p><form id="contact-form"><div class="form-field"><label for="contact-name">Nom</label><input id="contact-name" name="name" maxlength="60" placeholder="Prénom ou nom" required></div>${errorHTML()}<button class="primary-button" type="submit">Ajouter le contact</button></form>`);
}
function newCardSheet() {
  openSheet('Nouvelle carte',`<p class="sheet-sub">Choisissez votre nouvelle carte.</p><form id="new-card-form"><div class="form-field"><label for="card-type">Type de carte</label><select id="card-type" name="type"><option value="virtual">Carte virtuelle</option><option value="disposable">Carte éphémère</option></select></div>${errorHTML()}<button class="primary-button" type="submit">Créer la carte</button></form>`);
}
function extraCardSheet(id) {
  const c=(state.cards.extra||[]).find(c=>c.id===id);if(!c)return;
  openSheet('Carte '+(c.type==='disposable'?'éphémère':'virtuelle'),`${cardVisual(c)}<button class="primary-button" data-act="freeze-extra" data-id="${esc(id)}">${icon('snow')}${c.frozen?'Dégeler':'Geler'} cette carte</button><button class="secondary-button danger-button" data-act="delete-extra" data-id="${esc(id)}">Supprimer cette carte</button>`);
}
function budgetSheet() {
  openSheet('Votre budget mensuel',`<p class="sheet-sub">Un repère pour les statistiques de dépenses en euros.</p><form id="budget-form"><div class="form-field"><label for="amount">Budget · EUR</label><input id="amount" name="amount" class="amount-input" inputmode="decimal" value="${state.budget/100}" maxlength="13" required></div>${errorHTML()}<button class="primary-button" type="submit">Enregistrer le budget</button></form>`);
}
function limitSheet() {
  openSheet('Plafond quotidien',`<p class="sheet-sub">Les nouveaux paiements automatiques par carte respectent ce plafond.</p><form id="limit-form"><p id="limit-value" class="range-value">${esc(localizedMoney(state.cards.dailyLimit))}</p><input type="range" id="limit" name="limit" min="0" max="2000" step="25" value="${state.cards.dailyLimit/100}" aria-label="Plafond quotidien en euros"><div class="budget-figures"><span>0 €</span><span>2 000 €</span></div>${errorHTML()}<button class="primary-button" type="submit">Enregistrer la limite</button></form>`);
}
function installSheet() {
  openSheet('Flex sur votre iPhone',`<div class="panel"><div class="setting-row"><span class="avatar">1</span><div><p class="setting-name">Ouvrez le lien dans Safari</p><p class="setting-description">Connectez-vous à votre compte ChatGPT si demandé.</p></div></div><div class="setting-row"><span class="avatar">2</span><div><p class="setting-name">Touchez le bouton Partager</p><p class="setting-description">L’icône avec une flèche vers le haut.</p></div></div><div class="setting-row"><span class="avatar">3</span><div><p class="setting-name">Sur l’écran d’accueil</p><p class="setting-description">Puis touchez Ajouter. Flex s’ouvrira en plein écran.</p></div></div></div><div class="info-box neutral">Le code choisi reste nécessaire à chaque ouverture. Les données sont sauvegardées sur cet appareil et ne se synchronisent pas entre navigateurs.</div><button class="primary-button" data-act="close-sheet">Compris</button>`);
}
function menuSheet(title,items) {
  openSheet(title,`<div class="transactions">${items.map(([act,i,label,id])=>`<button class="tx-row" data-act="${act}" ${id?`data-id="${id}"`:''}><span class="tx-icon" style="background:var(--soft);color:var(--ink)">${icon(i)}</span><span class="tx-body"><span class="tx-name">${label}</span></span>${icon('chevron')}</button>`).join('')}</div>`);
}
function moreSheet() {
  menuSheet('Tout votre espace', [['tab','cards','Vos cartes','cards'],['tab','pocket','Vos poches','savings'],['request','arrowDown','Demander un paiement'],['account-details','building','Coordonnées'],['location','location','Choisir la localisation'],['install','plus','Installer sur l’iPhone'],['profile','settings','Réglages et profil']]);
}
function marketSheet(cryptoOnly=false) {
  const items=cryptoOnly?instruments.filter(i=>['bitcoin','ethereum'].includes(i.id)):instruments;
  openSheet(cryptoOnly?'Crypto · Explorer':'Invest · Explorer',`<p class="sheet-sub">Marchés disponibles. Ajoutez des instruments à votre liste de suivi.</p><div class="transactions">${items.map(i=>instrumentRow(i.id)).join('')}</div>`);
}
function instrumentSheet(id) {
  const item=instruments.find(i=>i.id===id);if(!item)return;
  const watching=preview.watchlist.includes(id);
  openSheet(item.name,`<div class="explorer-hero compact"><span class="explorer-emblem">${icon(item.icon)}</span><h3>${item.symbol}</h3><p>${esc(item.description)}</p></div><button class="primary-button" data-act="watchlist-toggle" data-id="${id}" aria-pressed="${watching}">${icon(watching?'check':'plus')}${watching?'Retirer de la liste':'Ajouter à la liste de suivi'}</button>`);
}
function investCashSheet(withdraw=false) {
  openSheet(withdraw?'Withdraw':'Add money',`<p class="sheet-sub">Réglez la trésorerie du portefeuille.</p><p class="range-value">${esc(money(preview.cash,'USD'))}</p><form id="invest-cash-form" data-withdraw="${withdraw}"><div class="form-field"><label for="invest-amount">Montant · USD</label><input id="invest-amount" name="amount" inputmode="decimal" placeholder="0,00" maxlength="13" required></div>${errorHTML()}<button class="primary-button">${withdraw?'Retirer des fonds':'Ajouter les fonds'}</button></form>`);
}
function analyticsPeriodSheet() {
  openSheet('Période des analyses',`<div class="transactions">${[['week','This week'],['month','This month'],['halfyear','Last 6 months'],['year','This year']].map(([id,label])=>`<button class="tx-row" data-act="analytics-select-period" data-id="${id}"><span class="tx-body"><span class="tx-name">${label}</span></span>${icon(analyticsPeriod===id?'check':'chevron')}</button>`).join('')}</div>`);
}
function expensePeriodSheet() {
  const metrics=expenseMetrics(state.transactions,{period:expensesPeriod,anchor:expensesAnchor,currency:state.currency,timeZone:currentRegion().tz,locale:getLocale()});
  openSheet('Période des dépenses',`<div class="expenses-period-nav"><button data-act="expenses-shift" data-id="-1" aria-label="Période précédente" ${expensesPeriod==='all'?'disabled':''}>${icon('back')}</button><span>${esc(metrics.rangeLabel)}</span><button data-act="expenses-shift" data-id="1" aria-label="Période suivante" ${metrics.canNext?'':'disabled'}>${icon('chevron')}</button></div><button class="primary-button" data-act="expenses-period" data-id="all">Tout l’historique</button><button class="secondary-button" data-act="analytics-overview">Vue d’ensemble</button>`);
}
document.addEventListener('click',async event=>{
  lastActive=Date.now();
  for(const menu of sheetRoot.querySelectorAll('.expense-detail-menu[open]'))if(!menu.contains(event.target))menu.open=false;
  if(event.target.classList.contains('sheet-backdrop')){closeSheet();return;}
  const b=event.target.closest('[data-act]');if(!b||b.disabled)return;
  const act=b.dataset.act,id=b.dataset.id;
  if(act==='close-sheet'){closeSheet();return;}
  if(needsSetup){
    if(setupBusy)return;
    try{
      captureSetupDraft();setupError='';
      if(act==='setup-language')setLanguage(id);
      else if(act==='setup-add-stop')setupDraft=addSetupStop(setupDraft);
      else if(act==='setup-remove-stop'){const index=Number(id);if(Number.isInteger(index)&&index>0&&index<setupDraft.stops.length)setupDraft.stops.splice(index,1);}
      else return;
    }catch(e){setupError=e.message||'Vérifie les informations saisies.';}
    render();return;
  }
  if(!unlocked){
    if(act==='pin')await pinInput(id);
    else if(act==='pin-delete'){pin=pin.slice(0,-1);render();}
    else if(act==='pin-help')toast('Utilise le code à 4 chiffres choisi lors de la création de l’app.');
    return;
  }
  try{
    switch(act){
      case'tab':tab=id;view='main';closeSheet();render();window.scrollTo({top:0});break;
      case'expenses':openAnalyticsBreakdown('spending',b.dataset.period||'year');break;
      case'expenses-back':closeSheet();tab='analytics';view='main';render();window.scrollTo({top:0});break;
      case'expenses-mode':if(['line','bars','donut'].includes(id)){expensesMode=id;render();}break;
      case'expenses-period':{
        if(!['week','month','halfyear','year','all'].includes(id))break;
        expensesPeriod=id;expensesAnchor=periodRange({period:id,timeZone:currentRegion().tz}).anchor;expensesCategory='';expensesLimit=20;closeSheet();render();break;
      }
      case'expenses-shift':{
        const delta=Number(id),metrics=expenseMetrics(state.transactions,{period:expensesPeriod,anchor:expensesAnchor,currency:state.currency,timeZone:currentRegion().tz,locale:getLocale()});
        if(expensesPeriod!=='all'&&(delta===-1||(delta===1&&metrics.canNext))){expensesAnchor=shiftExpensePeriod(metrics.anchor,expensesPeriod,delta);expensesCategory='';expensesLimit=20;render();expensePeriodSheet();}break;
      }
      case'expenses-category':closeSheet();expensesCategory=expensesCategory===id?'':id;expensesLimit=20;render();document.getElementById('expenses-transactions')?.scrollIntoView({block:'start',behavior:'smooth'});break;
      case'expenses-more':expensesLimit+=20;render();break;
      case'promo-slide':if([0,1,2].includes(Number(id))){promoIndex=Number(id);render();}break;
      case'promo-dismiss':promoDismissed=true;render();break;
      case'move':menuSheet('Move',[['send','arrowUp','Envoyer'],['exchange','exchange','Changer de devise'],['tab','pocket','Vers une poche','savings']]);break;
      case'savings-open':tab='savings';view='main';closeSheet();render();window.scrollTo({top:0});break;
      case'analytics-overview':view='analytics-overview';tab='analytics';closeSheet();render();window.scrollTo({top:0});break;
      case'analytics-main':view='main';tab='analytics';closeSheet();render();window.scrollTo({top:0});break;
      case'analytics-period':analyticsPeriodSheet();break;
      case'analytics-select-period':if(['week','month','halfyear','year'].includes(id)){analyticsPeriod=id;closeSheet();render();}break;
      case'income-history':openAnalyticsBreakdown('income');break;
      case'cashflow-history':openAnalyticsBreakdown('cashflow');break;
      case'assets':openAnalyticsBreakdown('assets');break;
      case'expenses-period-menu':expensePeriodSheet();break;
      case'expenses-grouping':menuSheet('By Category',[['expenses-category','chart','Toutes les dépenses']]);break;
      case'brokerage-toggle':brokerageExpanded=!brokerageExpanded;render();break;
      case'invest-search':case'invest-market':marketSheet();break;
      case'crypto-market':marketSheet(true);break;
      case'instrument':instrumentSheet(id);break;
      case'watchlist-toggle':if(instruments.some(i=>i.id===id)){preview.watchlist=preview.watchlist.includes(id)?preview.watchlist.filter(x=>x!==id):[...preview.watchlist,id];savePreview();render();instrumentSheet(id);}break;
      case'invest-deposit':investCashSheet();break;
      case'invest-withdraw':investCashSheet(true);break;
      case'invest-more':menuSheet('Invest',[['invest-market','search','Explorer les instruments'],['invest-info','info','À propos du portefeuille']]);break;
      case'invest-info':openSheet('Portefeuille',`<p class="sheet-sub">Vue d’ensemble de votre portefeuille.</p><button class="primary-button" data-act="invest-market">Explorer les instruments</button>`);break;
      case'accounts':accountSheet();break;
      case'select-account':state.currency=id;persist();closeSheet();render();break;
      case'hide':state.hideBalance=!state.hideBalance;persist();render();break;
      case'profile':profileSheet();break;
      case'language':languageSheet();break;
      case'select-language':if(setLanguage(id)){render();languageSheet();}break;
      case'editor':editMode=true;closeSheet();render();editorSheet();break;
      case'editor-expenses':preserveEditorDraft();editorExpenseLimit=30;editorExpensesSheet();break;
      case'editor-expense-new':expenseEditorSheet();break;
      case'editor-expense-edit':expenseEditorSheet(id);break;
      case'editor-expense-delete':deleteExpenseSheet(id);break;
      case'editor-expense-delete-confirm':{
        requireExpenseEdit(id);const direct=!editMode;
        commitEditorChange(deleteExpense(state,id),'Dépense supprimée.',id);
        if(direct)openSheet('Dépense supprimée.',`<p class="sheet-sub">${esc(editorNotice)}</p><button class="primary-button" data-act="editor-undo">Annuler le dernier changement</button><button class="secondary-button" data-act="close-sheet">Fermer</button>`);else editorExpensesSheet();break;
      }
      case'editor-expense-currency':requireEditMode();if(Object.hasOwn(RATES,id)){editorExpenseCurrency=id;editorExpenseLimit=30;editorExpensesSheet();}break;
      case'editor-expense-more':requireEditMode();editorExpenseLimit+=30;editorExpensesSheet();break;
      case'editor-iban':preserveEditorDraft();ibanEditorSheet();break;
      case'editor-exit':editMode=false;editorDraft=null;editorNotice='';closeSheet();render();toast('Mode édition désactivé.');break;
      case'editor-add-stop':{
        const draft=readEditorDraft();if(draft.config.stops.length>=12)throw new Error('Le scénario permet jusqu’à 12 étapes.');
        const last=draft.config.stops.at(-1),today=dateKey(new Date(),regionById(last.regionId).tz);
        if(last.date>=today)throw new Error('Avance la date de la dernière étape avant d’en ajouter une autre.');
        draft.config.stops.push({date:shiftDay(last.date,1),regionId:last.regionId});editorSheet();break;
      }
      case'editor-remove-stop':{
        const draft=readEditorDraft(),index=Number(id);if(Number.isInteger(index)&&index>0&&index<draft.config.stops.length){draft.config.stops.splice(index,1);editorSheet();}break;
      }
      case'editor-undo':{
        if(!editorUndo)break;
        if(scenarioFingerprint(state)!==editorUndo.fingerprint)throw new Error('L’activité a changé depuis cette édition. Annulation indisponible pour préserver les nouvelles opérations.');
        const returnExpenseId=editorUndo.expenseId;
        for(const field of editorUndo.fields){if(field.present)state[field.key]=JSON.parse(JSON.stringify(field.value));else delete state[field.key];}
        editorUndo=null;editorNotice='Le dernier changement a été annulé.';editorDraft=scenarioDefaults(state);persist();render();if(!editMode&&returnExpenseId){transactionSheet(returnExpenseId);toast(editorNotice);}else editorSheet();break;
      }
      case'topup':topupSheet();break;
      case'set-amount':{const input=document.querySelector('#sheet-root #amount');if(input){input.value=id;input.dispatchEvent(new Event('input',{bubbles:true}));}break;}
      case'send':sendSheet(id,b.dataset.schedule==='1');break;
      case'exchange':exchangeSheet();break;
      case'request':requestSheet();break;
      case'more':moreSheet();break;
      case'account-details':accountDetailsSheet();break;
      case'copy-account':await copy(identity().name+' — '+accountReference()+(state.currency==='EUR'?'':''),'Coordonnées copiées.');break;
      case'all-transactions':case'search':view='transactions';search='';filter='all';closeSheet();render();window.scrollTo({top:0});if(act==='search')document.getElementById('tx-search')?.focus();break;
      case'back-main':view='main';tab='home';closeSheet();render();window.scrollTo({top:0});break;
      case'filter':filter=id;render();break;
      case'transaction':transactionSheet(id);break;
      case'notifications':notificationsSheet();break;
      case'location':locationSheet();break;
      case'select-location':setLocation(id);break;
      case'geolocate':await geolocate(b);break;
      case'freeze':state.cards.frozen=!state.cards.frozen;persist();render();toast(state.cards.frozen?'Carte gelée.':'Carte dégelée.');break;
      case'card-details':cardDetailsSheet();break;
      case'reveal-card':showCard=!showCard;render();cardDetailsSheet();break;
      case'card-limit':limitSheet();break;
      case'toggle-setting':
        if(id==='theme'){state.theme='dark';}
        else if(['online','international'].includes(id)){state.cards[id]=!state.cards[id];}
        else if(['autoSimulation','notify'].includes(id)){
          state[id]=!state[id];
          if(id==='autoSimulation'){state.lastGeneratedDate=nowDay();state.simulationResumedAt=new Date().toISOString();}
        }
        persist();render();if(['theme','autoSimulation','notify'].includes(id))profileSheet();break;
      case'pocket':pocketSheet(id);break;
      case'new-pocket':pocketEditor();break;
      case'edit-pocket':pocketEditor(id);break;
      case'new-contact':contactEditor();break;
      case'new-card':newCardSheet();break;
      case'extra-card':extraCardSheet(id);break;
      case'freeze-extra':{const c=(state.cards.extra||[]).find(c=>c.id===id);if(c)c.frozen=!c.frozen;persist();render();extraCardSheet(id);break;}
      case'delete-extra':state.cards.extra=(state.cards.extra||[]).filter(c=>c.id!==id);persist();closeSheet();render();toast('Carte supprimée.');break;
      case'request-details':requestDetailsSheet(id);break;
      case'receive-request':{
        const r=state.requests.find(r=>r.id===id);if(!r||r.status==='received')break;
        const tx={id:'request-'+r.id,name:r.name,amount:r.cents,currency:r.currency,category:'income',timestamp:new Date().toISOString(),city:currentRegion().city,region:currentRegion().id,method:'Demande reçue'};
        if(!applyTransaction(state,tx))throw new Error('Impossible d’enregistrer la réception.');
        r.status='received';success('Réception',localizedMoney(r.cents,r.currency)+' reçus de '+r.name+'.');break;
      }
      case'share-request':{
        const r=state.requests.find(r=>r.id===id);if(!r)break;
        const text='Flex — Demande à '+r.name+' : '+localizedMoney(r.cents,r.currency)+'.';
        if(navigator.share){try{await navigator.share({title:'Flex — demande',text});}catch(e){if(e.name!=='AbortError')await copy(text,'Texte copié.');}}
        else await copy(text,'Texte copié.');break;
      }
      case'schedule-details':scheduleSheet(id);break;
      case'cancel-schedule':{const s=state.schedules.find(s=>s.id===id);if(s)s.status='cancelled';persist();closeSheet();render();toast('Virement annulé.');break;}
      case'month':{const d=new Date(activeMonth+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(id));activeMonth=d.toISOString().slice(0,7);render();break;}
      case'budget':budgetSheet();break;
      case'export':exportCSV();break;
      case'install':installSheet();break;
      case'lock':lock();break;
      case'reset':openSheet('Réinitialiser les données ?',`<p class="sheet-sub">L’historique local, vos poches, contacts et cartes supplémentaires seront remplacés par l’historique de départ.</p><button class="primary-button" data-act="confirm-reset">Réinitialiser les données</button><button class="secondary-button" data-act="close-sheet">Conserver mes données</button>`);break;
      case'confirm-reset':{const oldProfile={...state.profile};state=initialState();state.profile=oldProfile;state.theme='dark';tab='home';view='main';activeMonth=nowDay().slice(0,7);persist();closeSheet();render();toast('Nouvel historique créé.');break;}
    }
  }catch(e){error(e.message||'Cette action est indisponible.');}
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.id.endsWith('-form'))return;
  event.preventDefault();
  if(form.id==='setup-form'&&needsSetup){
    if(setupBusy)return;
    setupDraft=readSetupDraft(new FormData(form),setupDraft);setupError='';setupBusy=true;render();
    try{
      await new Promise(resolve=>setTimeout(resolve,80));
      const candidate=createSetupState(setupDraft);
      state=candidate;needsSetup=false;persist();window.scrollTo({top:0});
    }catch(e){setupError=e.message||'Vérifie les informations saisies.';}
    finally{setupBusy=false;render();}
    return;
  }
  if(!unlocked||needsSetup)return;
  const f=new FormData(form),cents=parseMoney(f.get('amount'));lastActive=Date.now();
  try{
    switch(form.id){
      case'credit-form':{
        const amount=Number(String(f.get('amount')).replace(',','.')),months=Number(f.get('months')),rate=Number(String(f.get('rate')).replace(',','.'));
        if(amount>1000000||months>600||rate>100)throw new Error('Utilisez un montant jusqu’à 1 000 000 €, une durée jusqu’à 600 mois et un taux jusqu’à 100 %.');
        const result=creditProjection(amount,months,rate),el=document.getElementById('credit-result');
        if(el)el.innerHTML=localizeHTML(`<p>Mensualité estimée</p><strong>${esc(localizedMoney(result.monthly))}</strong><small>${getLanguage()==='fr'?'Total':'Total'} : ${esc(localizedMoney(result.total))} · ${getLanguage()==='fr'?'Intérêts':'Interest'} : ${esc(localizedMoney(result.interest))}</small>`);
        break;
      }
      case'invest-cash-form':{
        if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)throw new Error('Saisissez un montant entre 0,01 et 1 000 000 $.');
        const withdraw=form.dataset.withdraw==='true';
        if(withdraw&&cents>preview.cash)throw new Error('Le montant dépasse la trésorerie.');
        const next=preview.cash+(withdraw?-cents:cents);if(!Number.isSafeInteger(next)||next>1000000000)throw new Error('La trésorerie ne peut pas dépasser 10 000 000 $.');
        preview.cash=next;savePreview();closeSheet();render();toast('Trésorerie mise à jour.');break;
      }
      case'editor-expense-form':{
        const id=form.dataset.expense||undefined;requireExpenseEdit(id);const direct=!editMode,previous=id?state.transactions.find(tx=>tx.id===id):null;
        const stamp=String(f.get('timestamp'));
        const timestamp=previous&&stamp===localDateTime(previous.timestamp)?previous.timestamp:stamp;
        const candidate=saveExpense(state,{id:'manual-editor-'+crypto.randomUUID(),name:f.get('name'),amount:cents,currency:String(f.get('currency')),category:String(f.get('category')),region:String(f.get('region')),timestamp,note:f.get('note')},{id});
        editorExpenseCurrency=String(f.get('currency'));commitEditorChange(candidate,id?'Dépense modifiée.':'Dépense créée.',id);if(direct){transactionSheet(id);toast(editorNotice);}else editorExpensesSheet();break;
      }
      case'editor-iban-form':requireEditMode();commitEditorChange(changeAccountIban(state,f.get('iban')),'IBAN enregistré.');editorSheet();break;
      case'scenario-form':{
        if(!editMode)throw new Error('Active le mode édition avant d’enregistrer un scénario.');
        const draft=readEditorDraft(form),operation=event.submitter?.dataset.operation||form.dataset.operation||'regenerate',fields=captureEditorUndo();
        const config={...draft.config,seed:crypto.randomUUID()};
        const candidate=operation==='balances'?changeScenarioBalances(state,draft.balances):regenerateScenario(state,config,draft.balances);
        if(!assertState(candidate))throw new Error('Le scénario n’a pas pu être validé. Aucune donnée n’a été modifiée.');
        state=candidate;editorUndo={fields,fingerprint:scenarioFingerprint(state)};editorNotice=operation==='balances'?'Soldes enregistrés.':'Historique mis à jour.';editorDraft=scenarioDefaults(state);persist();render();editorSheet();break;
      }
      case'topup-form':topUp(state,cents,state.currency,f.get('method'));success('Solde mis à jour',localizedMoney(cents,state.currency)+' ajoutés à votre compte.');break;
      case'send-form':{
        const recipient=String(f.get('recipient')).trim(),date=String(f.get('date'));
        if(!recipient)throw new Error('Indique un destinataire.');
        if(date<nowDay()||date>shiftDay(nowDay(),365))throw new Error('Choisis une date entre aujourd’hui et dans un an.');
        const result=sendMoney(state,{recipient,cents,currency:f.get('currency'),note:String(f.get('note')).trim(),date});
        success(result.status==='pending'?'Virement programmé':'Virement',localizedMoney(cents,f.get('currency'))+' pour '+recipient+(result.status==='pending'?' le '+date:'.'));break;
      }
      case'exchange-form':{const from=f.get('from'),to=f.get('to'),received=exchange(state,cents,from,to);success('Change effectué',localizedMoney(cents,from)+' échangés contre '+localizedMoney(received,to)+' au taux.');break;}
      case'request-form':{
        const name=String(f.get('name')).trim();if(!name||!Number.isSafeInteger(cents)||cents<=0||cents>100000000)throw new Error('Renseigne un nom et un montant valide.');
        const r={id:crypto.randomUUID(),name,cents,currency:f.get('currency'),status:'pending',timestamp:new Date().toISOString()};
        state.requests.push(r);persist();render();requestDetailsSheet(r.id);break;
      }
      case'pocket-form':pocketMove(state,form.dataset.pocket,cents,f.get('direction'));success('Poche mise à jour',localizedMoney(cents)+' déplacés dans votre espace.');break;
      case'new-pocket-form':{
        const name=String(f.get('name')).trim(),target=parseMoney(f.get('target'));if(!name||!Number.isSafeInteger(target)||target<=0||target>100000000)throw new Error('Indique un nom et un objectif valide.');
        const p=state.pockets.find(p=>p.id===form.dataset.pocket);
        if(p){p.name=name;p.target=target;p.icon=f.get('icon');}
        else{if(state.pockets.length>=20)throw new Error('Votre espace permet jusqu’à 20 poches.');state.pockets.push({id:crypto.randomUUID(),name,target,balance:0,icon:f.get('icon'),color:'#e7edf9'});}
        persist();closeSheet();render();toast(p?'Poche modifiée.':'Nouvelle poche créée.');break;
      }
      case'contact-form':{
        const name=String(f.get('name')).trim();if(!name)throw new Error('Entre le nom du contact.');
        if(state.contacts.length>=40)throw new Error('Votre espace permet jusqu’à 40 contacts.');
        if(state.contacts.some(c=>c.name.toLowerCase()===name.toLowerCase()))throw new Error('Ce contact existe déjà.');
        state.contacts.push({id:crypto.randomUUID(),name,initials:name.split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(),color:'#e2eaf7',handle:'contact.demo'});
        persist();closeSheet();render();toast('Contact ajouté.');break;
      }
      case'new-card-form':{
        if((state.cards.extra||[]).length>=5)throw new Error('Votre espace permet cinq cartes supplémentaires.');
        state.cards.extra=state.cards.extra||[];state.cards.extra.push({id:crypto.randomUUID(),type:f.get('type'),frozen:false,last4:String(1100+Math.floor(Math.random()*8800))});
        persist();closeSheet();render();toast('Carte créée.');break;
      }
      case'budget-form':if(!Number.isSafeInteger(cents)||cents<=0||cents>100000000)throw new Error('Choisis un budget valide.');state.budget=cents;persist();closeSheet();render();toast('Budget mis à jour.');break;
      case'limit-form':state.cards.dailyLimit=Math.round(Number(f.get('limit'))*100);persist();closeSheet();render();toast('Plafond quotidien enregistré.');break;
    }
  }catch(e){error(e.message||'Vérifie les informations saisies.');}
});
document.addEventListener('input',event=>{
  lastActive=Date.now();
  if(event.target.id==='tx-search'){
    search=event.target.value;const pos=event.target.selectionStart;render();
    const input=document.getElementById('tx-search');input?.focus();if(input&&input.type!=='search')input.setSelectionRange(pos,pos);
  }
  if(event.target.closest('#exchange-form'))refreshExchangePreview();
  if(event.target.id==='limit')document.getElementById('limit-value').textContent=localizedMoney(Math.round(Number(event.target.value)*100));
});
document.addEventListener('change',event=>{if(event.target.closest('#exchange-form'))refreshExchangePreview();if(needsSetup&&event.target.name?.startsWith('setup-region-')){captureSetupDraft();render();}});
document.addEventListener('keydown',event=>{
  if(!needsSetup&&!unlocked&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
    if(/^\d$/.test(event.key)){event.preventDefault();pinInput(event.key);}
    else if(event.key==='Backspace'){event.preventDefault();pin=pin.slice(0,-1);render();}
  }
  if(event.key==='Escape'){
    const menu=sheetRoot.querySelector('.expense-detail-menu[open]');
    if(menu){menu.open=false;event.preventDefault();menu.querySelector('summary')?.focus();return;}
    if(sheetRoot.firstChild){closeSheet();return;}
  }
  if(event.key==='Tab'&&sheetRoot.firstChild){
    const focusable=[...sheetRoot.querySelectorAll('button:not([disabled]),summary,input:not([disabled]),select,textarea,[tabindex="0"]')],first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();document.querySelector('.phone-shell')?.classList.add('privacy-covered');}
  else{
    document.querySelector('.phone-shell')?.classList.remove('privacy-covered');
    if(unlocked&&hiddenAt&&Date.now()-hiddenAt>=60000)lock();
    else if(unlocked){const added=rollForward(state);persist();render();if(added&&state.notify)toast('L’activité a été mise à jour.');}
    hiddenAt=0;
  }
});
setInterval(()=>{
  if(!unlocked&&blockedUntil){if(Date.now()>=blockedUntil){blockedUntil=0;render();}else render();return;}
  if(unlocked&&Date.now()-lastActive>300000){lock();return;}
},1000);
setInterval(()=>{
  if(unlocked&&!document.hidden){const count=rollForward(state);persist();if(count){render();if(state.notify)toast(count+' nouvelle'+(count>1?'s opérations.':' opération.'));}}
},60000);
window.addEventListener('offline',()=>toast('Mode hors ligne · votre espace reste disponible.'));
window.addEventListener('online',()=>toast('Connexion rétablie.'));
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js?v=23').catch(()=>{});}
theme();persist();render();
window.__flexReady=true;
if(window.visualViewport){
  const viewport=window.visualViewport;
  const keepFooterVisible=()=>{
    const gap=Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop));
    document.documentElement.style.setProperty('--keyboard-gap',gap+'px');
  };
  viewport.addEventListener('resize',keepFooterVisible,{passive:true});
  viewport.addEventListener('scroll',keepFooterVisible,{passive:true});
  keepFooterVisible();
}
window.dispatchEvent?.(new Event('flex:ready'));
const splash=document.getElementById('app-splash');
if(splash){
  const delay=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?0:800;
  setTimeout(()=>{
    splash.classList.add('splash-done');
    splash.setAttribute('aria-hidden','true');
    setTimeout(()=>splash.remove(),400);
  },delay);
}
