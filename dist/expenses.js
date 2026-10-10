import {EXPENSE_COLORS,periodRange,shiftPeriod,localDay,displayMoney} from './ui-metrics.js?v=1';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Summaries never mutate the ledger or manufacture transactions.
export function expenseMetrics(transactions,{period='year',anchor,currency='EUR',timeZone='Africa/Cairo',now=new Date()}={}) {
  const range=periodRange({period,anchor,timeZone,now});period=range.period;anchor=range.anchor;
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
  const series=keys.map(key=>({key,value:byDate.get(key)||0,label:period==='week'?new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(key+'T12:00:00Z')):period==='month'?String(Number(key.slice(-2))):new Intl.DateTimeFormat('en-GB',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'))}));
  return {total,categories,series,transactions:spending,period,anchor,currency,rangeLabel:range.rangeLabel,caption:range.caption,canNext:range.canNext};
}
export const shiftExpensePeriod=shiftPeriod;

function donutSVG(metrics) {
  const radius=144,point=angle=>[160+radius*Math.cos(angle),160+radius*Math.sin(angle)].map(n=>n.toFixed(3)).join(' ');
  let angle=-Math.PI/2;
  const segments=metrics.categories.map(c=>{
    const sweep=c.share*2*Math.PI,gap=Math.min(.034,sweep*.18),start=angle+gap,end=angle+sweep-gap;angle+=sweep;
    if(metrics.categories.length===1)return `<circle cx="160" cy="160" r="${radius}" stroke="${c.color}"/>`;
    return `<path d="M ${point(start)} A ${radius} ${radius} 0 ${end-start>Math.PI?1:0} 1 ${point(end)}" stroke="${c.color}"/>`;
  }).join('');
  return `<svg class="expenses-donut" viewBox="0 0 320 320" aria-hidden="true" fill="none" stroke-width="14" stroke-linecap="round">${metrics.total?segments:`<circle cx="160" cy="160" r="${radius}" stroke="#30333a"/>`}</svg>`;
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
  return `<svg class="expenses-timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${mode==='bars'?'Dépenses par période':'Dépenses cumulées sur la période'}"><path d="M14 12H306M14 72H306M14 132H306" stroke="#30333a" stroke-dasharray="2 5"/>${graph}<g fill="#8a8c95" font-size="10">${labels}</g></svg>`;
}

export function renderExpenseSummary(metrics,{mode='donut',category='',hidden=false,money,icon,metadata,backLabel='Retour à l’analyse'}={}) {
  const esc=escapeHTML,format=amount=>hidden?'••••':money(amount,metrics.currency);
  const heroAmount=hidden?'••••':displayMoney(metrics.total,metrics.currency,{digits:0});
  const chartIcons={line:'<path d="m3 16 5-6 4 4 4-10 3 5 2-3"/>',bars:'<rect x="3" y="13" width="4" height="8" rx="1" fill="currentColor" stroke="none"/><rect x="10" y="3" width="4" height="18" rx="1" fill="currentColor" stroke="none"/><rect x="17" y="9" width="4" height="12" rx="1" fill="currentColor" stroke="none"/>',donut:'<path d="M12 3a9 9 0 0 1 9 9M21 16a9 9 0 0 1-13 4M4 17a9 9 0 0 1 4-13"/>'};
  const toggle=Object.entries(chartIcons).map(([id,svg])=>`<button data-act="expenses-mode" data-id="${id}" class="${mode===id?'is-active':''}" aria-pressed="${mode===id}" aria-label="${{line:'Courbe cumulée',bars:'Histogramme',donut:'Répartition par catégorie'}[id]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg></button>`).join('');
  const summary=`<div class="expenses-total"><p>Spent · Personal</p><strong>${esc(heroAmount)}</strong><span>${esc(metrics.caption)}</span></div>`;
  const labels={transfer:'Transfers',restaurant:'Restaurants',shopping:'Shopping',groceries:'Groceries',transport:'Transport',coffee:'Coffee',subscription:'Subscriptions'};
  return `<header class="expenses-toolbar"><button class="expenses-back" data-act="expenses-back" aria-label="${esc(backLabel)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7"/></svg></button><div class="expenses-chart-toggle" role="group" aria-label="Présentation des dépenses">${toggle}</div></header>
  <h1 class="expenses-sr-only">Dépenses</h1>
  <div class="expenses-visual ${mode==='donut'?'is-donut':'is-timeline'}">${mode==='donut'?donutSVG(metrics)+summary:summary+(hidden?'<p class="expenses-chart-hidden">Montants masqués</p>':timelineSVG(metrics,mode,format))}</div>
  <div class="expenses-period-row"><div class="expenses-period-tabs" role="group" aria-label="Période des dépenses">${[['week','1W'],['month','1M'],['halfyear','6M'],['year','1Y']].map(([id,label])=>`<button data-act="expenses-period" data-id="${id}" class="${metrics.period===id?'is-active':''}" aria-pressed="${metrics.period===id}">${label}</button>`).join('')}</div><button class="expenses-period-more" data-act="expenses-period-menu" aria-label="Choisir une autre période">${icon('more')}</button></div>
  <div class="expenses-section-heading"><button class="expenses-grouping" data-act="expenses-grouping"><span>By Category</span>${icon('down')}</button><button class="expenses-manage" data-act="budget">Manage</button><span class="expenses-sr-only">Par catégorie</span></div>
  <div class="expenses-categories">${metrics.categories.length?metrics.categories.map(c=>{const meta=metadata[c.id]||{label:'Autres',icon:'cards'};return `<button class="expenses-category ${category===c.id?'is-selected':''}" data-act="expenses-category" data-id="${esc(c.id)}" aria-pressed="${category===c.id}"><span class="expenses-category-icon" style="--category-color:${c.color}">${icon(meta.icon)}</span><span class="expenses-category-name"><strong>${esc(labels[c.id]||meta.label)}</strong><small>${c.count} transaction${c.count>1?'s':''}</small></span><span class="expenses-category-value"><strong>${esc(hidden?'••••':displayMoney(-c.value,metrics.currency,{digits:0}))}</strong><small>${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(c.share*100)}%</small></span></button>`;}).join(''):'<p class="expenses-empty">Aucune dépense sur cette période.</p>'}</div><p class="expenses-demo">Données de démonstration</p>`;
}
