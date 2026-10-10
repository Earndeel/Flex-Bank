// Read-only presentation helpers. Amounts stay in integer minor units.
const symbols={EUR:'€',USD:'$',GBP:'£',EGP:'E£',THB:'฿'};
export const EXPENSE_COLORS={transfer:'#6fa0ff',restaurant:'#ff7a40',shopping:'#ff50a4',groceries:'#5ad024',transport:'#8654ff',coffee:'#c39062',subscription:'#787878'};
export function displayMoney(cents,currency='EUR',{digits=2,locale='fr-FR'}={}) {
  const number=new Intl.NumberFormat(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Math.abs(cents)/100);
  return (cents<0?'-':'')+(symbols[currency]||currency+' ')+number;
}
export const localDay=(date,timeZone='UTC')=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const utcDay=key=>new Date(key+'T12:00:00Z');
const addDays=(key,n)=>{const d=utcDay(key);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const addMonths=(key,n)=>{const d=new Date(key.slice(0,7)+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7);};
const validDay=key=>/^\d{4}-\d{2}-\d{2}$/.test(key||'')&&Number.isFinite(utcDay(key).getTime())&&utcDay(key).toISOString().startsWith(key);
const validMonth=key=>/^\d{4}-(0[1-9]|1[0-2])$/.test(key||'');
const monday=key=>addDays(key,-((utcDay(key).getUTCDay()+6)%7));
export function periodRange({period='year',anchor,timeZone='UTC',now=new Date(),locale='en-GB'}={}) {
  if(!['week','month','halfyear','year','all'].includes(period))period='year';
  const today=localDay(now,timeZone);
  const current=period==='week'?monday(today):period==='year'?today.slice(0,4):today.slice(0,7);
  let start,end,keys=[];
  if(period==='week'){
    anchor=validDay(anchor)?monday(anchor):current;start=anchor;end=addDays(start,6);
    keys=Array.from({length:7},(_,i)=>addDays(start,i));
  }else if(period==='month'){
    anchor=validMonth(anchor)?anchor:current;start=anchor+'-01';end=addDays(addMonths(anchor,1)+'-01',-1);
    keys=Array.from({length:Number(end.slice(-2))},(_,i)=>anchor+'-'+String(i+1).padStart(2,'0'));
  }else if(period==='halfyear'){
    anchor=validMonth(anchor)?anchor:current;start=addMonths(anchor,-5)+'-01';end=addDays(addMonths(anchor,1)+'-01',-1);
    keys=Array.from({length:6},(_,i)=>addMonths(start,i));
  }else if(period==='year'){
    anchor=/^\d{4}$/.test(anchor||'')?anchor:current;start=anchor+'-01-01';end=anchor+'-12-31';
    keys=Array.from({length:12},(_,i)=>anchor+'-'+String(i+1).padStart(2,'0'));
  }else {anchor='';start='0000-01-01';end=today;}
  const dateLabel=key=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',timeZone:'UTC'}).format(utcDay(key));
  const monthLabel=key=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(utcDay(key+'-15'));
  const rangeLabel=period==='week'?dateLabel(start)+' – '+dateLabel(end):period==='month'?monthLabel(anchor):period==='halfyear'?dateLabel(start)+' – '+monthLabel(anchor):period==='year'?anchor:locale.startsWith('fr')?'Tout l’historique':'All history';
  const fr=locale.startsWith('fr');
  const caption=period==='all'?(fr?'Depuis le début':'Since the start'):anchor===current?(fr?{week:'Cette semaine',month:'Ce mois-ci',halfyear:'6 derniers mois',year:'Cette année'}:{week:'This week',month:'This month',halfyear:'Last 6 months',year:'This year'})[period]:rangeLabel;
  return {period,anchor,start,end,keys,today,current,rangeLabel,caption,canNext:period!=='all'&&anchor<current};
}
export function shiftPeriod(anchor,period,delta) {
  if(period==='week'&&validDay(anchor))return addDays(monday(anchor),delta*7);
  if(period==='month'&&validMonth(anchor))return addMonths(anchor,delta);
  if(period==='halfyear'&&validMonth(anchor))return addMonths(anchor,delta*6);
  if(period==='year'&&/^\d{4}$/.test(anchor||''))return String(Number(anchor)+delta);
  return anchor;
}
export function dashboardMetrics(state,{period='week',anchor,currency='EUR',timeZone='UTC',now=new Date(),rates={EUR:1},locale='en-GB'}={}) {
  const range=periodRange({period,anchor,timeZone,now,locale}),previousAnchor=shiftPeriod(range.anchor,range.period,-1);
  const previous=periodRange({period:range.period,anchor:previousAnchor,timeZone,now,locale});
  const daily=range.keys.map(key=>({key,income:0,expense:0})),categories=new Map();
  let income=0,spent=0,previousIncome=0;
  for(const t of state.transactions){
    const stamp=new Date(t.timestamp);
    if(t.currency!==currency||!Number.isSafeInteger(t.amount)||t.status==='declined'||['exchange','savings'].includes(t.category)||!Number.isFinite(stamp.getTime())||stamp>now)continue;
    const key=localDay(stamp,timeZone);
    if(key>=previous.start&&key<=previous.end&&t.amount>0)previousIncome+=t.amount;
    if(key<range.start||key>range.end)continue;
    const day=daily.find(d=>key.startsWith(d.key));
    if(t.amount>0){income+=t.amount;if(day)day.income+=t.amount;}
    else if(t.amount<0){spent-=t.amount;if(day)day.expense-=t.amount;categories.set(t.category,(categories.get(t.category)||0)-t.amount);}
  }
  const cashEUR=Object.entries(state.wallets).reduce((sum,[code,value])=>sum+Math.round(value/(rates[code]||1)),0);
  const pocketsEUR=state.pockets.reduce((sum,p)=>sum+p.balance,0),totalEUR=cashEUR+pocketsEUR;
  return {range,income,spent,net:income-spent,previousIncome,incomeChange:income-previousIncome,daily,
    categories:[...categories].sort((a,b)=>b[1]-a[1]).map(([id,value])=>({id,value,share:spent?value/spent:0,color:EXPENSE_COLORS[id]||'#787878'})),
    cash:Math.round(cashEUR*(rates[currency]||1)),pockets:Math.round(pocketsEUR*(rates[currency]||1)),assets:Math.round(totalEUR*(rates[currency]||1))};
}
export function creditProjection(amount,months,annualRate) {
  if(!Number.isFinite(amount)||amount<=0||!Number.isInteger(months)||months<1||!Number.isFinite(annualRate)||annualRate<0)throw new Error('Vérifiez le montant, la durée et le taux.');
  const rate=annualRate/1200,monthly=rate?amount*rate/(1-Math.pow(1+rate,-months)):amount/months;
  return {monthly:Math.round(monthly*100),total:Math.round(monthly*months*100),interest:Math.round((monthly*months-amount)*100)};
}
