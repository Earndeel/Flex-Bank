// Keep the loading screen recoverable when scripts cannot be downloaded.
(() => {
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
