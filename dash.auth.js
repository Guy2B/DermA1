
(function(){
  const cfg = window.DASH_CONFIG || { pass:'lune', remember:'session' };
  const KEY = 'lb_dash_auth';
  const store = cfg.remember === 'local' ? localStorage : sessionStorage;

  const gate = document.getElementById('gate');
  const input = document.getElementById('gateInput');
  const btn = document.getElementById('gateBtn');
  const msg = document.getElementById('gateMsg');
  const remember = document.getElementById('gateRemember');

  function unlocked(){ return (store.getItem(KEY)==='ok') || (localStorage.getItem(KEY)==='ok' && cfg.remember==='local'); }
  function unlock(){ (remember && remember.checked && cfg.remember==='local') ? localStorage.setItem(KEY,'ok') : store.setItem(KEY,'ok'); }

  function openGate(){ gate.classList.remove('hidden'); input && input.focus(); }
  function closeGate(){ gate.classList.add('hidden'); }

  function tryOpen(){
    const val = (input.value||'').trim();
    if(val === cfg.pass){ msg.classList.add('hidden'); unlock(); closeGate(); }
    else { msg.classList.remove('hidden'); const c = gate.querySelector('.gate-card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
  }

  if(!unlocked()) openGate(); else closeGate();
  btn.addEventListener('click', tryOpen);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') tryOpen(); });
})();
