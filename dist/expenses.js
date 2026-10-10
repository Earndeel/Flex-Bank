const COLORS = {
  restaurant:'#70a9ff',groceries:'#ff783b',transport:'#27bdf3',shopping:'#8749f8',
  subscription:'#62646c',coffee:'#b990ff',transfer:'#b9becb'
};
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=(date,timeZone)=>Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const dateString=(date,timeZone)=>{const p=localDate(date,timeZone);return `${p.year}-${p.month}-${p.day}`;};

// Read-only summary of the existing ledger. No new payments or balances are created.
export function expenseMetrics(transactions,{period='year',anchor,currency='EUR',timeZone='Africa/Cairo',now=new Date()}={}) {
  period=['month','year','all'].includes(period)?period:'year';
  const today=dateString(now,timeZone),current=period==='year'?today.slice(0,4):today.slice(0,7);
  anchor=period==='year'&&/^\d{4}$/.test(anchor)?anchor:period==='month'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(anchor)?anchor:current;
  const spending=transactions.filter(t=>{
    const stamp=new Date(t.timestamp);
    if(t.currency!==currency||!Number.isSafeInteger(t.amount)||t.amount>=0||t.status==='declined'||['exchange','savings'].includes(t.category)||!Number.isFinite(stamp.getTime())||stamp>now)return false;
    const date=dateString(stamp,timeZone);
    return period==='all'||date.startsWith(anchor+'-');
  }).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const byCategory=new Map(),byDate=new Map();
  let total=0;
  for(const t of spending){
    const value=-t.amount,key=dateString(new Date(t.timestamp),timeZone).slice(0,period==='month'?10:7);
    total+=value;
    const category=t.category||'other',entry=byCategory.get(category)||{id:category,value:0,count:0};
    entry.value+=value;entry.count++;byCategory.set(category,entry);
    byDate.set(key,(byDate.get(key)||0)+value);
  }
  const categories=[...byCategory.values()].sort((a,b)=>b.value-a.value).map(c=>({...c,share:total?c.value/total:0,color:COLORS[c.id]||'#a0a5b1'}));
  let keys=[];
  if(period==='month'){
    const [year,month]=anchor.split('-').map(Number),days=new Date(Date.UTC(year,month,0)).getUTCDate();
    keys=Array.from({length:days},(_,i)=>anchor+'-'+String(i+1).padStart(2,'0'));
  }else if(period==='year')keys=Array.from({length:12},(_,i)=>anchor+'-'+String(i+1).padStart(2,'0'));
  else{
    const first=[...byDate.keys()].sort()[0]||today.slice(0,7),last=today.slice(0,7);
    const cursor=new Date(first+'-01T12:00:00Z');
    while(cursor.toISOString().slice(0,7)<=last){keys.push(cursor.toISOString().slice(0,7));cursor.setUTCMonth(cursor.getUTCMonth()+1);}
  }
  const series=keys.map(key=>({key,value:byDate.get(key)||0,label:period==='month'?String(Number(key.slice(-2))):new Intl.DateTimeFormat('fr-FR',{month:'short',timeZone:'UTC'}).format(new Date(key+'-01T12:00:00Z'))}));
  const rangeLabel=period==='all'?'Tout l’historique':period==='year'?anchor:new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(anchor+'-15T12:00:00Z'));
  const caption=period==='all'?'Depuis le début':anchor===current?(period==='year'?'Cette année':'Ce mois'):rangeLabel;
  return {total,categories,series,transactions:spending,period,anchor,currency,rangeLabel,caption,canNext:period!=='all'&&anchor<current};
}

export function shiftExpensePeriod(anchor,period,delta) {
  if(period==='year')return String(Number(anchor)+delta);
  if(period==='month'){
    const date=new Date(anchor+'-15T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);
    return date.toISOString().slice(0,7);
  }
  return anchor;
}

function donutSVG(metrics) {
  const radius=144,point=angle=>[160+radius*Math.cos(angle),160+radius*Math.sin(angle)].map(n=>n.toFixed(3)).join(' ');
  let angle=-Math.PI/2;
  const segments=metrics.categories.map(c=>{
    const sweep=c.share*2*Math.PI,gap=Math.min(.06,sweep*.18),start=angle+gap,end=angle+sweep-gap;angle+=sweep;
    if(metrics.categories.length===1)return `<circle cx="160" cy="160" r="${radius}" stroke="${c.color}"/>`;
    return `<path d="M ${point(start)} A ${radius} ${radius} 0 ${end-start>Math.PI?1:0} 1 ${point(end)}" stroke="${c.color}"/>`;
  }).join('');
  return `<svg class="expenses-donut" viewBox="0 0 320 320" aria-hidden="true" fill="none" stroke-width="14" stroke-linecap="butt">${metrics.total?segments:`<circle cx="160" cy="160" r="${radius}" stroke="#30333a"/>`}</svg>`;
}

function timelineSVG(metrics,mode,money) {
  const width=320,height=166,left=14,right=306,bottom=132,top=12,series=metrics.series;
  const n=Math.max(1,series.length),step=(right-left)/n,max=Math.max(1,...series.map(s=>s.value));
  const ticks=[...new Set([0,Math.floor((n-1)/2),n-1])];
  const labels=ticks.map(i=>`<text x="${left+step*(i+.5)}" y="159" text-anchor="middle">${escapeHTML(series[i]?.label||'')}</text>`).join('');
  let graph='';
  if(mode==='bars')graph=series.map((s,i)=>{
    const h=(bottom-top)*s.value/max,w=Math.min(22,step*.6),x=left+step*(i+.5)-w/2;
    return `<rect x="${x.toFixed(2)}" y="${(bottom-h).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${Math.min(4,w/2)}" fill="#70a9ff"><title>${escapeHTML(s.key)} : ${escapeHTML(money(s.value))}</title></rect>`;
  }).join('');
  else{
    let cumulative=0;
    const points=series.map((s,i)=>{cumulative+=s.value;return `${(left+step*(i+.5)).toFixed(2)},${(bottom-(bottom-top)*cumulative/Math.max(1,metrics.total)).toFixed(2)}`;});
    const firstX=left+step*.5,lastX=left+step*(n-.5);
    graph=`<polygon points="${firstX},${bottom} ${points.join(' ')} ${lastX},${bottom}" fill="#70a9ff" opacity=".09"/><polyline points="${points.join(' ')}" fill="none" stroke="#70a9ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return `<svg class="expenses-timeline" viewBox="0 0 ${width} ${height}" role="img" aria-label="${mode==='bars'?'Dépenses par période':'Dépenses cumulées sur la période'}"><path d="M14 12H306M14 72H306M14 132H306" stroke="#30333a" stroke-dasharray="2 5"/>${graph}<g fill="#8a8c95" font-size="10">${labels}</g></svg>`;
}

export function renderExpenseSummary(metrics,{mode='donut',category='',hidden=false,money,icon,metadata}={}) {
  const esc=escapeHTML,format=amount=>hidden?'••••':money(amount,metrics.currency);
  const heroAmount=hidden?'••••':new Intl.NumberFormat('fr-FR',{style:'currency',currency:metrics.currency,minimumFractionDigits:0,maximumFractionDigits:0}).format(metrics.total/100);
  const chartIcons={line:'<path d="m3 16 5-6 4 4 4-10 3 5 2-3"/>',bars:'<path d="M5 20v-7M12 20V4M19 20V9"/>',donut:'<path d="M12 3a9 9 0 0 1 9 9M21 16a9 9 0 0 1-13 4M4 17a9 9 0 0 1 4-13"/>'};
  const toggle=Object.entries(chartIcons).map(([id,svg])=>`<button data-act="expenses-mode" data-id="${id}" class="${mode===id?'is-active':''}" aria-pressed="${mode===id}" aria-label="${{line:'Courbe cumulée',bars:'Histogramme',donut:'Répartition par catégorie'}[id]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg}</svg></button>`).join('');
  const summary=`<div class="expenses-total"><p>Dépensé · Personnel</p><strong>${esc(heroAmount)}</strong><span>${esc(metrics.caption)}</span></div>`;
  return `<header class="expenses-toolbar"><button class="expenses-back" data-act="expenses-back" aria-label="Retour à l’analyse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4m7-7-7 7 7 7"/></svg></button><div class="expenses-chart-toggle" role="group" aria-label="Présentation des dépenses">${toggle}</div></header>
  <h1 class="expenses-sr-only">Dépenses</h1><p class="expenses-demo">Données de démonstration</p>
  <div class="expenses-visual ${mode==='donut'?'is-donut':'is-timeline'}">${mode==='donut'?donutSVG(metrics)+summary:summary+(hidden?'<p class="expenses-chart-hidden">Montants masqués</p>':timelineSVG(metrics,mode,format))}</div>
  <div class="expenses-period-tabs" role="group" aria-label="Période des dépenses">${[['month','Mois'],['year','Année'],['all','Tout']].map(([id,label])=>`<button data-act="expenses-period" data-id="${id}" class="${metrics.period===id?'is-active':''}" aria-pressed="${metrics.period===id}">${label}</button>`).join('')}</div>
  <div class="expenses-period-nav"><button data-act="expenses-shift" data-id="-1" aria-label="Période précédente" ${metrics.period==='all'?'disabled':''}>${icon('back')}</button><span>${esc(metrics.rangeLabel)}</span><button data-act="expenses-shift" data-id="1" aria-label="Période suivante" ${metrics.canNext?'':'disabled'}>${icon('chevron')}</button></div>
  <div class="expenses-section-heading"><h2>Par catégorie</h2><span>${metrics.currency}</span></div>
  <div class="expenses-categories">${metrics.categories.length?metrics.categories.map(c=>{const meta=metadata[c.id]||{label:'Autres',icon:'cards'};return `<button class="expenses-category ${category===c.id?'is-selected':''}" data-act="expenses-category" data-id="${esc(c.id)}" aria-pressed="${category===c.id}"><span class="expenses-category-icon" style="--category-color:${c.color}">${icon(meta.icon)}</span><span class="expenses-category-name"><strong>${esc(meta.label)}</strong><small>${c.count} opération${c.count>1?'s':''}</small></span><span class="expenses-category-value"><strong>${esc(format(c.value))}</strong><small>${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(c.share*100)} %</small></span>${icon('chevron')}</button>`;}).join(''):'<p class="expenses-empty">Aucune dépense sur cette période.</p>'}</div>`;
}
