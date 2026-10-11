import {EXPENSE_COLORS,periodRange,shiftPeriod,localDay,displayMoney,dashboardMetrics} from './ui-metrics.js?v=2';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Summaries never mutate the ledger or manufacture transactions.
export function expenseMetrics(transactions,{period='year',anchor,currency='EUR',timeZone='Africa/Cairo',now=new Date(),locale='en-GB'}={}) {
  const range=periodRange({period,anchor,timeZone,now,locale});period=range.period;anchor=range.anchor;
  const spending=transactions.filter(t=>{
    const stamp=new Date(t.timestamp);
    if(t.currency!==currency||!Number.isSafeInteger(t.amount)||t.amount>=0||t.status==='declined'||['exchange','savings'].includes(t.category)||!Number.isFinite(stamp.getTime())||stamp>now)return false;
    const date=localDay(stamp,timeZone);
    return date>=range.start&&date<=range.end;
  }).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const byCategory=new Map(),byDate=new Map();let total=0;
  for(const t of spending){
    const value=-t.amount,key=localDay(new Date(t.timestamp),timeZone).slice(0,['week','month'].includes(period)?10:7);
    total+=value;
    const id=t.category||'other',entry=byCategory.get(id)||{id,value:0,count:0};entry.value+=value;entry.count++;byCategory.set(id,entry);
    byDate.set(key,(byDate.get(key)||0)+value);
  }
  const categories=[...byCategory.values()].sort((a,b)=>b.value-a.value).map(c=>({...c,share:total?c.value/total:0,color:EXPENSE_COLORS[c.id]||'#787878'}));
  let keys=range.keys;
  if(period==='all'){
    keys=[];const first=[...byDate.keys()].sort()[0]||range.today.slice(0,7),last=range.today.slice(0,7),cursor=new Date(first+'-01T12:00:00Z');
    while(cursor.toISOString().slice(0,7)<=last){keys.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
  }
  const series=keys.map(key=>({key,value:byDate.get(key)||0,label:period==='week'?new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z')):period==='month'?String(Number(key.slice(-2))):new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'))}));
  return {total,categories,series,transactions:spending,period,anchor,currency,rangeLabel:range.rangeLabel,caption:range.caption,canNext:range.canNext};
}
export const shiftExpensePeriod=shiftPeriod;

// The four Analytics cards share one read-only breakdown page.
// Positive income is mirrored only while computing its chart, then restored.
export function analyticsBreakdownMetrics(state,{scope='spending',rates={EUR:1},...options}={}) {
  const spent=expenseMetrics(state.transactions,options);
  if(scope==='spending')return {...spent,scope,title:'Spent · Personal'};
  if(scope==='assets'){
    const stats=dashboardMetrics(state,{...options,rates}),currency=spent.currency,rate=rates[currency]||1;
    const palette=['#6fa0ff','#8654ff','#ff50a4','#ff7a40','#5ad024'];
    const categories=Object.entries(state.wallets).map(([code,value],i)=>({id:'wallet-'+code,value:Math.round(Math.round(value/(rates[code]||1))*rate),count:1,label:code,color:palette[i%palette.length],positive:true,subtitle:'Current balance'}));
    const pocketValue=Math.round(state.pockets.reduce((sum,p)=>sum+p.balance,0)*rate);
    if(pocketValue)categories.push({id:'pockets',value:pocketValue,count:state.pockets.length,label:'Savings',color:'#ba54ec',positive:true,subtitle:'Current balance'});
    const total=stats.assets,allocated=categories.reduce((sum,c)=>sum+c.value,0),largest=categories.reduce((a,c)=>!a||c.value>a.value?c:a,null);
    if(largest)largest.value+=total-allocated;
    const sorted=categories.filter(c=>c.value>0).sort((a,b)=>b.value-a.value).map(c=>({...c,share:total?c.value/total:0}));
    return {...spent,scope,total,displayTotal:total,title:'Total assets · Personal',caption:'Current balances',hidePeriods:true,grouping:'By Account',transactions:[],series:sorted.map(c=>({key:c.id,label:c.label,value:c.value})),categories:sorted};
  }
  const original=new Map(state.transactions.map(t=>[t.id,t]));
  const income=expenseMetrics(state.transactions.filter(t=>t.amount>0).map(t=>({...t,amount:-t.amount})),options);
  income.transactions=income.transactions.map(t=>original.get(t.id));
  income.categories=income.categories.map(c=>({...c,positive:true,color:'#6fa0ff'}));
  if(scope==='income')return {...income,scope,title:'Income · Personal',positive:true};
  const total=spent.total+income.total,transactions=[...spent.transactions,...income.transactions].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const categories=[{id:'income',value:income.total,count:income.transactions.length,color:'#0dbc96',positive:true},{id:'spending',value:spent.total,count:spent.transactions.length,color:'#ff4c68'}].filter(c=>c.value>0).map(c=>({...c,share:c.value/total}));
  return {...spent,scope,total,displayTotal:income.total-spent.total,title:'Net cashflow · Personal',transactions,categories,series:[...new Set([...spent.series.map(s=>s.key),...income.series.map(s=>s.key)])].sort().map(key=>{const a=spent.series.find(s=>s.key===key),b=income.series.find(s=>s.key===key);return {...(a||b),value:(a?.value||0)+(b?.value||0)};})};
}

function donutSVG(metrics) {
  const point=(angle,radius)=>[160+radius*Math.cos(angle),160+radius*Math.sin(angle)].map(n=>n.toFixed(3)).join(' ');
  let angle=-Math.PI/2;
  const segments=metrics.categories.map(c=>{
    const sweep=c.share*2*Math.PI,gap=Math.min(.052,sweep*.2),start=angle+gap,end=angle+sweep-gap;angle+=sweep;
    if(metrics.categories.length===1)return `<circle cx="160" cy="160" r="144" fill="none" stroke="${c.color}" stroke-width="14"/>`;
    return `<path d="M ${point(start,149)} A 149 149 0 ${end-start>Math.PI?1:0} 1 ${point(end,149)} L ${point(end,139)} A 139 139 0 ${end-start>Math.PI?1:0} 0 ${point(start,139)} Z" fill="${c.color}" stroke="${c.color}" stroke-width="4" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg class="expenses-donut" viewBox="0 0 320 320" aria-hidden="true">${metrics.total?segments:'<circle cx="160" cy="160" r="144" fill="none" stroke="#30333a" stroke-width="14"/>'}</svg>`;
}

function timelineSVG(metrics,mode,money) {
  const width=320,height=166,left=14,right=306,bottom=132,top=12,series=metrics.series;
  const n=Math.max(1,series.length),step=(right-left)/n,max=Math.max(1,...series.map(s=>s.value));
  const ticks=[...new Set([0,Math.floor((n-1)/2),n-1])];
  const labels=ticks.map(i=>`<text x="${left+step*(i+.5)}" y="159" text-anchor="middle">${escapeHTML(series[i]?.label||'')}</text>`).join('');
  let graph='';
  if(mode==='bars')graph=series.map((s,i)=>{
    const h=(bottom-top)*s.value/max,w=Math.min(22,step*.6),x=left+step*(i+.5)-w/2;
    return `<rect x="${x.toFixed(2)}" y="${(bottom-h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(4,w/2)}" fill="#6498ff"><title>${escapeHTML(s.key)} : ${escapeHTML(money(s.value))}</title></rect>`;
  }).join('');
  else{
    let cumulative=0;
    const points=series.map((s,i)=>{cumulative+=s.value;return `${(left+step*(i+.5)).toFixed(2)},${(bottom-(bottom-top)*cumulative/Math.max(1,metrics.total)).toFixed(2)}`;});
    const firstX=left+step*.5,lastX=left+step*(n-.5);
    graph=`<polygon points="${firstX},${bottom} ${points.join(' ')} ${lastX},${bottom}" fill="#6498ff" opacity=".09"/><polyline points="${points.join(' ')}" fill="none" stroke="#6498ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg class="expenses-timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${metrics.scope&&metrics.scope!=='spending'?(mode==='bars'?'Activity by period':'Cumulative activity during the period'):(mode==='bars'?'Dépenses par période':'Dépenses cumulées sur la période')}"><path d="M14 12H306M14 72H306M14 132H306" stroke="#30333a" stroke-dasharray="2 5"/>${graph}<g fill="#8a8c95" font-size="10">${labels}</g></svg>`;
}

export function renderExpenseSummary(metrics,{mode='donut',category='',hidden=false,money,icon,metadata,backLabel='Retour à l’analyse',locale='fr-FR'}={}) {
  const esc=escapeHTML,format=amount=>hidden?'••••':money(amount,metrics.currency);
  const heroAmount=hidden?'••••':displayMoney(metrics.displayTotal??metrics.total,metrics.currency,{digits:0,locale});
  const summarySize=heroAmount.length>11?32:heroAmount.length>9?38:44;
  const chartIcons={line:'chartLine',bars:'chartBars',donut:'chartDonut'};
  const toggle=Object.entries(chartIcons).map(([id,name])=>`<button data-act="expenses-mode" data-id="${id}" class="${mode===id?'is-active':''}" aria-pressed="${mode===id}" aria-label="${{line:'Courbe cumulée',bars:'Histogramme',donut:'Répartition par catégorie'}[id]}">${icon(name)}</button>`).join('');
  const summary=`<div class="expenses-total"><p>${esc(metrics.title||'Spent · Personal')}</p><strong style="--summary-size:${summarySize}px">${esc(heroAmount)}</strong><span>${esc(metrics.caption)}</span></div>`;
  const labels={transfer:'Transfers',restaurant:'Restaurants',shopping:'Shopping',groceries:'Groceries',transport:'Transport',coffee:'Coffee',subscription:'Subscriptions'};
  return `<header class="expenses-toolbar"><button class="expenses-back" data-act="expenses-back" aria-label="${esc(backLabel)}">${icon('backArrow')}</button><div class="expenses-chart-toggle" role="group" aria-label="Présentation des dépenses">${toggle}</div></header>
  <h1 class="expenses-sr-only">Dépenses</h1>
  <div class="expenses-visual ${mode==='donut'?'is-donut':'is-timeline'}">${mode==='donut'?donutSVG(metrics)+summary:summary+(hidden?'<p class="expenses-chart-hidden">Montants masqués</p>':timelineSVG(metrics,mode,format))}</div>
  ${metrics.hidePeriods?'':`<div class="expenses-period-row"><div class="expenses-period-tabs" role="group" aria-label="Période des dépenses">${[['week','1W'],['month','1M'],['halfyear','6M'],['year','1Y']].map(([id,label])=>`<button data-act="expenses-period" data-id="${id}" class="${metrics.period===id?'is-active':''}" aria-pressed="${metrics.period===id}">${label}</button>`).join('')}</div><button class="expenses-period-more" data-act="expenses-period-menu" aria-label="Choisir une autre période">${icon('more')}</button></div>`}
  <div class="expenses-section-heading"><button class="expenses-grouping" data-act="expenses-grouping"><span>${esc(metrics.grouping||'By Category')}</span>${icon('down')}</button><button class="expenses-manage" data-act="${metrics.scope==='assets'?'accounts':'budget'}">Manage</button><span class="expenses-sr-only">Par catégorie</span></div>
  <div class="expenses-categories">${metrics.categories.length?metrics.categories.map(c=>{const meta=metadata[c.id]||{label:'Autres',icon:'cards'};return `<button class="expenses-category ${category===c.id?'is-selected':''}" data-act="expenses-category" data-id="${esc(c.id)}" aria-pressed="${category===c.id}"><span class="expenses-category-icon" style="--category-color:${c.color}">${icon(meta.icon)}</span><span class="expenses-category-name"><strong>${esc(c.label||labels[c.id]||meta.label)}</strong><small>${c.subtitle?esc(c.subtitle):`${c.count} transaction${c.count>1?'s':''}`}</small></span><span class="expenses-category-value"><strong>${esc(hidden?'••••':displayMoney(c.positive?c.value:-c.value,metrics.currency,{digits:0,locale}))}</strong><small>${new Intl.NumberFormat(locale,{maximumFractionDigits:0}).format(c.share*100)}%</small></span></button>`;}).join(''):`<p class="expenses-empty">${metrics.scope==='income'?'No income in this period.':metrics.scope==='cashflow'?'No activity in this period.':'Aucune dépense sur cette période.'}</p>`}</div><p class="expenses-note">Données d’activité</p>`;
}
