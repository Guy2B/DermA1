
// Lune Beauty Skin AI — App Controller (ESM)
// Configure endpoints & PayPal Client ID here:
window.LB_ENDPOINT = window.LB_ENDPOINT || ''; // e.g. 'https://your-cloud-function/analyze'
window.LB_NONPROSPECT = window.LB_NONPROSPECT || ''; // e.g. 'https://your-cloud-function/nonprospect'
window.PAYPAL_CLIENT_ID = window.PAYPAL_CLIENT_ID || ''; // e.g. 'test'

const qs = (q)=>document.querySelector(q);
const qsa = (q)=>document.querySelectorAll(q);

/* GDPR session gate */
(function gdprGate(){
  const seen = sessionStorage.getItem('gdpr');
  const modal = qs('#gdpr');
  if(!seen){ modal.classList.remove('hidden'); }
  qs('#gdprAccept').addEventListener('click',()=>{ sessionStorage.setItem('gdpr','1'); modal.classList.add('hidden'); });
})();

/* Step state */
let currentFacing = 'user';
let stream = null;
let capturedBlob = null; // final image blob
const client = { photo:null, analysis:null, wizard:null, plan:null };

function setStep(n){
  qsa('.step').forEach((s,i)=> s.classList.toggle('active', i===n-1));
  qsa('.steps li').forEach((s,i)=> s.classList.toggle('active', i< n));
}

function enable(el, ok){ el.disabled = !ok; }

/* Camera helpers */
async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: currentFacing, width:1280, height:720 }, audio:false });
    const v = qs('#video'); v.srcObject = stream; await v.play();
    enable(qs('#btnCapture'), true);
    qs('#permMsg').classList.add('hidden');
  }catch(e){
    console.warn('Camera error', e);
    qs('#permMsg').classList.remove('hidden');
  }
}
function stopCamera(){ if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } enable(qs('#btnCapture'), false); }
async function flipCamera(){ currentFacing = (currentFacing==='user')?'environment':'user'; await startCamera(); }

function drawVideoToCanvas(){
  const v = qs('#video'); const c = qs('#canvas'); const ctx=c.getContext('2d');
  const ar = v.videoWidth / v.videoHeight;
  const cw = c.width, ch = c.height; let dw=cw, dh=cw/ar; if(dh<ch){ dh=ch; dw=dh*ar; }
  const dx=(cw-dw)/2, dy=(ch-dh)/2; ctx.drawImage(v, dx, dy, dw, dh);
}

async function capture(){
  drawVideoToCanvas();
  // show preview modal
  const prev = qs('#previewModal'); prev.classList.remove('hidden');
  const can = qs('#canvas'); const prevCan = qs('#previewCan');
  const pcx = prevCan.getContext('2d'); pcx.drawImage(can,0,0,prevCan.width,prevCan.height);
}

function usePhoto(){
  const can = qs('#canvas');
  can.toBlob(blob=>{ capturedBlob = blob; client.photo = true; localStorage.setItem('lb_client_photo', '1');
    qs('#previewModal').classList.add('hidden'); stopCamera();
    enable(qs('#btnAnalyze'), true); setStep(2);
  }, 'image/jpeg', 0.92);
}

function retake(){ qs('#previewModal').classList.add('hidden'); }

/* Upload handler */
qs('#fileInput').addEventListener('change', e=>{
  const f=e.target.files?.[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{
      const c=qs('#canvas'); const ctx=c.getContext('2d');
      // cover fit
      const ar=img.width/img.height; const cw=c.width,ch=c.height; let dw=cw, dh=cw/ar; if(dh<ch){ dh=ch; dw=dh*ar; }
      const dx=(cw-dw)/2, dy=(ch-dh)/2; ctx.drawImage(img,dx,dy,dw,dh);
      c.toBlob(b=>{capturedBlob=b; client.photo=true; localStorage.setItem('lb_client_photo','1'); enable(qs('#btnAnalyze'),true); setStep(2);}, 'image/jpeg', 0.92);
    }; img.src=r.result; }; r.readAsDataURL(f);
});

/* Analysis */
async function analyze(){
  if(!capturedBlob){ alert('Bitte zuerst ein Foto aufnehmen oder hochladen.'); return; }
  if(!window.LB_ENDPOINT){ alert('Bitte setze window.LB_ENDPOINT in assets/js/app.js'); return; }
  qs('#analysisWrap').classList.remove('hidden');

  // upload via FormData
  const fd=new FormData(); fd.append('photo', capturedBlob, 'photo.jpg');
  try{
    const res = await fetch(window.LB_ENDPOINT, { method:'POST', body: fd });
    if(!res.ok) throw new Error('Serverless-Fehler: '+res.status);
    const data = await res.json();
    client.analysis=data; localStorage.setItem('lb_client_analysis', JSON.stringify(data));
    renderAnalysis(data);
  }catch(err){
    console.error(err);
    alert('Analyse fehlgeschlagen. Bitte Endpoint prüfen.');
  }
}

function renderAnalysis(data){
  // gauge: map 0..100 to arc dashoffset
  const score = Math.max(0, Math.min(100, Math.round(data.score||0)));
  qs('#score').textContent = score;
  const len=157; const offset=len - (score/100)*len; qs('#gArc').style.strokeDashoffset = String(offset);

  qs('#summary').textContent = data.summary || '–';
  fillList('#diagnostics', data.diagnostics);
  fillList('#actives', data.actives);
  fillList('#avoid', data.avoid);
}
function fillList(sel, arr){
  const ul = qs(sel); ul.innerHTML=''; if(!Array.isArray(arr)) return; arr.forEach(x=>{ const li=document.createElement('li'); li.textContent=String(x); ul.appendChild(li); });
}

/* Wizard */
let wizIndex=1; const wizTotal=6;
function showWiz(i){
  qsa('.wiz-step').forEach(el=> el.classList.toggle('active', Number(el.dataset.step)===i));
}
function nextWiz(){ if(wizIndex<wizTotal){ wizIndex++; showWiz(wizIndex);} else { setStep(4); loadPayPal(); } }
function prevWiz(){ if(wizIndex>1){ wizIndex--; showWiz(wizIndex);} }

function collectWizard(){
  const f = new FormData(qs('#wizForm'));
  const allergies = Array.from(qs('#wizForm').querySelectorAll('input[name="allergies"]:checked')).map(i=>i.value);
  const obj = Object.fromEntries(f.entries());
  obj.allergies = allergies;
  client.wizard = obj; localStorage.setItem('lb_client_wizard', JSON.stringify(obj));
}

/* PayPal step */
function loadPayPal(){
  if(!window.PAYPAL_CLIENT_ID){ console.warn('Missing PAYPAL_CLIENT_ID'); return; }
  if(document.getElementById('paypal-sdk')) return;
  const s=document.createElement('script');
  s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(window.PAYPAL_CLIENT_ID)}&currency=EUR`;
  s.id='paypal-sdk'; s.onload=renderPayPalButtons; document.body.appendChild(s);
}
function renderPayPalButtons(){
  if(!window.paypal){ console.warn('PayPal SDK not loaded'); return; }
  const commonCfg = {
    style:{ layout:'vertical', color:'gold', shape:'pill', label:'paypal' },
    createOrder: (data,actions)=> actions.order.create({ purchase_units:[{ amount:{ value:'29.00' }}]}),
    onApprove: async (data,actions)=>{
      const details = await actions.order.capture();
      client.plan = client.plan || 'standard';
      const purchase = { plan: client.plan, orderId: details.id, time: new Date().toISOString() };
      localStorage.setItem('lb_purchase', JSON.stringify(purchase));
      setStep(5);
    }
  };
  // Standard
  window.paypal.Buttons({ ...commonCfg, onClick:()=>{ client.plan='standard'; } }).render('#ppStd');
  // Premium
  window.paypal.Buttons({ ...commonCfg, onClick:()=>{ client.plan='premium'; },
    createOrder: (data,actions)=> actions.order.create({ purchase_units:[{ amount:{ value:'59.00' }}]})
  }).render('#ppPrem');
}

/* Non-prospect event on abandon */
window.addEventListener('beforeunload', ()=>{
  try{
    if(!client.plan && window.LB_NONPROSPECT){
      const payload = JSON.stringify({ ts: Date.now(), stage: currentStage(), email: (client.wizard?.email||null) });
      navigator.sendBeacon(window.LB_NONPROSPECT, payload);
    }
  }catch(e){}
});
function currentStage(){ if(qs('#step5').classList.contains('active')) return 5; if(qs('#step4').classList.contains('active')) return 4; if(qs('#step3').classList.contains('active')) return 3; if(qs('#step2').classList.contains('active')) return 2; return 1; }

/* Wire up UI */
document.addEventListener('DOMContentLoaded', ()=>{
  // Step buttons
  qs('#btnStartCam').addEventListener('click', startCamera);
  qs('#btnFlipCam').addEventListener('click', flipCamera);
  qs('#btnCapture').addEventListener('click', capture);
  qs('#btnUsePhoto').addEventListener('click', usePhoto);
  qs('#btnRetake').addEventListener('click', retake);

  qs('#btnAnalyze').addEventListener('click', analyze);
  qs('#btnToStep3').addEventListener('click', ()=>{ setStep(3); showWiz(1); });

  qs('#wizNext').addEventListener('click', ()=>{ collectWizard(); nextWiz(); });
  qs('#wizPrev').addEventListener('click', ()=>{ prevWiz(); });

  setStep(1);
});
