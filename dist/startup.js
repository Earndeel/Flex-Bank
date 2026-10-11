// Keep the loading screen recoverable when scripts cannot be downloaded.
(() => {
  // Older iOS exposes navigator.standalone; newer installations can also
  // report their display mode. Keep this workaround out of regular Safari.
  const nav=window.navigator||globalThis.navigator||{};
  const appleDevice=/iPhone|iPad|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
  const installed=nav.standalone===true||(appleDevice&&window.matchMedia?.('(display-mode: standalone)')?.matches);
  document.documentElement.classList.toggle('ios-standalone',Boolean(installed));
  // Frost only the background once content passes behind the pinned header.
  const updateHeader=()=>{
    const scrollTop=window.scrollY??document.scrollingElement?.scrollTop??0;
    document.documentElement.classList.toggle('header-scrolled',scrollTop>8);
  };
  window.addEventListener('scroll',updateHeader,{passive:true});
  window.addEventListener('pageshow',updateHeader);
  window.addEventListener('flex:ready',updateHeader);
  updateHeader();
  const splash=document.getElementById('app-splash');
  const caption=document.getElementById('splash-caption');
  const retry=document.getElementById('splash-retry');
  const french=()=>{try{return localStorage.getItem('flex-language-v1')==='fr';}catch{return false;}};
  if(caption)caption.textContent=french()?'Votre espace se prépare.':'Your space is loading.';
  if(retry)retry.textContent=french()?'Réessayer':'Retry';
  const fail=()=>{
    if(window.__flexReady||!splash)return;
    if(caption)caption.textContent=french()?'Le chargement prend plus de temps que prévu. Vérifiez votre connexion.':'Loading is taking longer than expected. Check your connection.';
    if(retry)retry.hidden=false;
  };
  const timeout=setTimeout(fail,15000);
  window.addEventListener('flex:ready',()=>clearTimeout(timeout),{once:true});
  window.addEventListener('error',fail,{once:true});
  retry?.addEventListener('click',()=>window.location.reload());
})();
