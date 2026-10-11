import {RATES,CURRENCIES,REGIONS,CATEGORY_META,validateAmount} from './core.js?v=11';
import {reconcileLedger} from './scenario.js?v=5';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const EXPENSE_CATEGORIES=Object.keys(CATEGORY_META).filter(key=>!['income','topup','exchange','savings'].includes(key));
export const isEditableExpense=tx=>!!tx&&tx.amount<0&&tx.status!=='declined'&&!['exchange','savings'].includes(tx.category);
export const formatIban=value=>String(value??'').replace(/\s/g,'').toUpperCase().match(/.{1,4}/g)?.join(' ')||'';
export function normalizeIban(value) {
  const iban=String(value??'').replace(/\s/g,'').toUpperCase();
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban))throw Error('Indiquez un IBAN de 15 à 34 caractères, avec deux lettres de pays et deux chiffres au début.');
  return iban;
}
export function changeAccountIban(state,value) {
  const accountIban=normalizeIban(value);
  return {...state,accountIban};
}
export function localDateTime(timestamp=new Date().toISOString()) {
  const date=new Date(timestamp);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);
}

// Historical edits keep the selected closing balances. Reconcile the opening
// balance and every running balance rather than recording a compensating entry.
export function saveExpense(state,input,{id,now=new Date()}={}) {
  const previous=id?state.transactions.find(tx=>tx.id===id):null;
  if(id&&!isEditableExpense(previous))throw Error('Cette opération ne peut pas être modifiée comme une dépense.');
  const name=String(input.name??'').trim(),note=String(input.note??'').trim();
  if(!name||name.length>80||note.length>160)throw Error('Indiquez un nom de dépense de 1 à 80 caractères et une note de 160 caractères maximum.');
  if(!validateAmount(input.amount))throw Error('Indiquez un montant entre 0,01 et 1 000 000.');
  if(!Object.hasOwn(RATES,input.currency))throw Error('Choisissez une devise valide.');
  if(!EXPENSE_CATEGORIES.includes(input.category))throw Error('Choisissez une catégorie de dépense valide.');
  const region=REGIONS.find(region=>region.id===input.region);
  if(!region)throw Error('Choisissez un lieu valide.');
  const stamp=new Date(input.timestamp);
  if(!Number.isFinite(stamp.getTime())||stamp>now||stamp.getUTCFullYear()<2000)throw Error('Choisissez une date valide, antérieure ou égale à maintenant.');
  const transactionId=id||input.id;
  if(typeof transactionId!=='string'||!transactionId||(!id&&state.transactions.some(tx=>tx.id===transactionId)))throw Error('La référence de cette dépense existe déjà ou est invalide.');
  const originalCurrency=previous?.region===region.id&&previous?.currency===input.currency?previous.originalCurrency||region.currency:region.currency;
  const tx={...previous,id:transactionId,name,amount:-input.amount,currency:input.currency,category:input.category,
    timestamp:stamp.toISOString(),region:region.id,city:region.city,note,method:previous?.method||'Carte',
    originalCurrency,originalAmount:Math.round(input.amount*RATES[originalCurrency]/RATES[input.currency]),
    automatic:false,edited:true,demo:true,status:'completed'};
  const transactions=state.transactions.filter(item=>item.id!==id);
  transactions.push(tx);
  return reconcileLedger(state,transactions,state.wallets);
}
export function deleteExpense(state,id) {
  const tx=state.transactions.find(item=>item.id===id);
  if(!isEditableExpense(tx))throw Error('Cette dépense est introuvable ou ne peut pas être supprimée.');
  const result=reconcileLedger(state,state.transactions.filter(item=>item.id!==id),state.wallets);
  // Suppress the original generated ID so opening the app cannot restore it.
  result.deletedExpenseIds=[...new Set([...(state.deletedExpenseIds||[]),id])];
  return result;
}

export function renderEditorTools(iban) {
  return `<div class="editor-tools"><button type="button" class="editor-tool" data-act="editor-expenses"><span><strong>Gérer les dépenses</strong><small>Montants, ajout et suppression</small></span><span aria-hidden="true">›</span></button><button type="button" class="editor-tool" data-act="editor-iban"><span><strong>Modifier l’IBAN</strong><small data-i18n-skip>${esc(formatIban(iban))}</small></span><span aria-hidden="true">›</span></button></div>`;
}
export function renderExpenseList(state,{currency='EUR',limit=30,locale='fr-FR',notice='',canUndo=false}={}) {
  const expenses=state.transactions.filter(tx=>isEditableExpense(tx)&&tx.currency===currency).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
  const money=amount=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(amount/100);
  const date=stamp=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric'}).format(new Date(stamp));
  return `${notice?`<div class="editor-result" role="status">${esc(notice)}</div>`:''}<p class="sheet-sub">Modifiez une dépense ou ajoutez la vôtre. Les totaux d’Analytics sont recalculés et vos soldes affichés sont conservés.</p><button class="primary-button" data-act="editor-expense-new">+ Ajouter une dépense</button><div class="editor-currency-tabs" role="group" aria-label="Compte des dépenses">${Object.keys(RATES).map(code=>`<button data-act="editor-expense-currency" data-id="${code}" aria-pressed="${currency===code}">${code}</button>`).join('')}</div><p class="editor-list-count">${expenses.length} ${expenses.length===1?'opération':'opérations'}</p><div class="editor-expense-list">${expenses.slice(0,limit).map(tx=>`<div class="editor-expense-row"><button class="editor-expense-open" data-act="editor-expense-edit" data-id="${esc(tx.id)}"><span class="editor-expense-name"><strong data-i18n-skip>${esc(tx.name)}</strong><small data-i18n-skip>${esc(date(tx.timestamp))} · ${esc(tx.city||'')}</small></span><strong class="editor-expense-amount" data-i18n-skip>${esc(money(tx.amount))}</strong></button><button class="editor-expense-delete" data-act="editor-expense-delete" data-id="${esc(tx.id)}" aria-label="Supprimer la dépense">×</button></div>`).join('')||'<div class="empty">Aucune dépense sur ce compte.</div>'}</div>${expenses.length>limit?'<button class="secondary-button" data-act="editor-expense-more">Voir plus de dépenses</button>':''}${canUndo?'<button class="secondary-button" data-act="editor-undo">Annuler le dernier changement</button>':''}<button class="secondary-button" data-act="editor">Retour au mode édition</button>`;
}
export function renderExpenseForm(state,{id,currency='EUR',now=new Date(),errorHTML='',returnToExpense=false}={}) {
  const tx=id?state.transactions.find(tx=>tx.id===id):null;
  if(id&&!isEditableExpense(tx))throw Error('Cette dépense est introuvable ou ne peut pas être modifiée.');
  const region=tx?.region||state.location.regionId;
  return `<p class="sheet-sub">Cette modification est enregistrée dans votre historique. Le solde affiché reste inchangé.</p><form id="editor-expense-form" data-expense="${esc(id||'')}"><div class="form-field"><label for="expense-name">Nom de la dépense</label><input id="expense-name" name="name" value="${esc(tx?.name||'')}" maxlength="80" placeholder="Nom du commerce" required></div><div class="field-pair"><div class="form-field"><label for="expense-amount">Montant de la dépense</label><input id="expense-amount" name="amount" inputmode="decimal" value="${tx?-tx.amount/100:''}" placeholder="0,00" maxlength="13" required></div><div class="form-field"><label for="expense-currency">Devise</label><select id="expense-currency" name="currency">${Object.keys(RATES).map(code=>`<option value="${code}" ${(tx?.currency||currency)===code?'selected':''}>${code} · ${esc(CURRENCIES[code].name)}</option>`).join('')}</select></div></div><div class="form-field"><label for="expense-category">Catégorie</label><select id="expense-category" name="category">${EXPENSE_CATEGORIES.map(key=>`<option value="${key}" ${(tx?.category||'shopping')===key?'selected':''}>${esc(CATEGORY_META[key].label)}</option>`).join('')}</select></div><div class="form-field"><label for="expense-date">Date et heure · appareil</label><input id="expense-date" name="timestamp" type="datetime-local" step="1" max="${localDateTime(now.toISOString())}" value="${localDateTime(tx?.timestamp||now.toISOString())}" required></div><div class="form-field"><label for="expense-region">Lieu de la dépense</label><select id="expense-region" name="region">${REGIONS.map(item=>`<option value="${item.id}" ${region===item.id?'selected':''}>${esc(item.country)} · ${esc(item.city)}</option>`).join('')}</select></div><div class="form-field"><label for="expense-note">Note · facultative</label><input id="expense-note" name="note" maxlength="160" value="${esc(tx?.note||'')}"></div>${errorHTML}<button type="submit" class="primary-button">${tx?'Enregistrer la dépense':'Créer la dépense'}</button></form>${tx?`<button class="secondary-button danger-button" data-act="editor-expense-delete" data-id="${esc(id)}">Supprimer cette dépense</button>`:''}<button class="secondary-button" data-act="${returnToExpense?'transaction':'editor-expenses'}" ${returnToExpense?`data-id="${esc(id)}"`:''}>${returnToExpense?'Retour à la dépense':'Retour aux dépenses'}</button>`;
}
export function renderIbanForm(iban,{errorHTML=''}={}) {
  return `<p class="sheet-sub">L’IBAN affiché dans les coordonnées du compte EUR sera mis à jour sur cet appareil.</p><form id="editor-iban-form"><div class="form-field"><label for="editor-iban">IBAN affiché</label><input id="editor-iban" class="editor-iban-input" name="iban" value="${esc(formatIban(iban))}" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="42" required></div>${errorHTML}<button class="primary-button" type="submit">Enregistrer l’IBAN</button></form><button class="secondary-button" data-act="editor">Retour au mode édition</button>`;
}
