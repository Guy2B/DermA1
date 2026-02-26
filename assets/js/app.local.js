
import { getImageData, computeStatsLab, localVarianceL, laplaceMagnitude, spotIndex, buildOvalMask } from './imgproc.js';

const state = { imgReady:false, blob:null };
const qs = (q)=>document.querySelector(q);
const qsa = (q)=>document.querySelectorAll(q);

// Basic UI helpers
function setStep(n){ qsa('.step').forEach((s,i)=> s.classList.toggle('active', i===n-1)); qsa('.steps li').forEach((s,i)=> s.classList.toggle('active', i< n)); }
function enable(el, ok){ el.disabled = !ok; }

// Camera handling
let currentFacing='user'; let stream=null;
async function startCamera(){
  try{
    stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode: currentFacing, width:1280, height:720 }, audio:false });
    const v=qs('#video'); v.srcObject=stream; await v.play(); enable(qs('#btnCapture'),true); qs('#permMsg').classList.add('hidden');
  }catch(e){ console.warn(e); qs('#permMsg').classList.remove('hidden'); }
}
async function flipCamera(){ currentFacing = (currentFacing==='user')?'environment':'user'; await startCamera(); }
function stopCamera(){ if(stream){ stream.getTracks().forEach(t=>t.stop()); stream=null; } enable(qs('#btnCapture'),false); }

function drawVideoToCanvas(){ const v=qs('#video'); const c=qs('#canvas'); const ctx=c.getContext('2d'); const ar=v.videoWidth/v.videoHeight; const cw=c.width,ch=c.height; let dw=cw,dh=cw/ar; if(dh<ch){ dh=ch; dw=dh*ar; } const dx=(cw-dw)/2, dy=(ch-dh)/2; ctx.drawImage(v,dx,dy,dw,dh); }

function capture(){ drawVideoToCanvas(); const prev=qs('#previewModal'); prev.classList.remove('hidden'); const can=qs('#canvas'); const prevCan=qs('#previewCan'); const pcx=prevCan.getContext('2d'); pcx.drawImage(can,0,0,prevCan.width,prevCan.height); }
function usePhoto(){ const can=qs('#canvas'); can.toBlob(b=>{ state.blob=b; state.imgReady=true; localStorage.setItem('lb_client_photo','1'); qs('#previewModal').classList.add('hidden'); stopCamera(); enable(qs('#btnAnalyze'),true); setStep(2); },'image/jpeg',0.92); }
function retake(){ qs('#previewModal').classList.add('hidden'); }

// Upload
qs('#fileInput').addEventListener('change', e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const img=new Image(); img.onload=()=>{ const c=qs('#canvas'); const ctx=c.getContext('2d'); const ar=img.width/img.height; const cw=c.width,ch=c.height; let dw=cw,dh=cw/ar; if(dh<ch){ dh=ch; dw=dh*ar; } const dx=(cw-dw)/2, dy=(ch-dh)/2; ctx.drawImage(img,dx,dy,dw,dh); c.toBlob(b=>{ state.blob=b; state.imgReady=true; localStorage.setItem('lb_client_photo','1'); enable(qs('#btnAnalyze'),true); setStep(2); },'image/jpeg',0.92); }; img.src=r.result; }; r.readAsDataURL(f); });

// Local analyze (no network)
function scale01(v, a, b){ return Math.max(0, Math.min(1, (v-a)/(b-a) )); }
function pct(x){ return Math.round(x*100); }

function deriveInsights({tex, pore, spot, red}){
  const diags=[]; const act=[]; const avoid=[]; let summary='Ausgewogenes Hautbild.';
  if(tex>0.55){ diags.push('Hohe Textur (Rauigkeit)'); act.push('PHA','Niacinamide'); }
  if(pore>0.55){ diags.push('Betontere Poren'); act.push('BHA','Retinal'); }
  if(spot>0.45){ diags.push('Flecken / Unregelmäßigkeiten'); act.push('Azelaic Acid','Vitamin C'); }
  if(red>0.50){ diags.push('Rötungstendenz'); act.push('Panthenol','Centella'); avoid.push('starke Duftstoffe'); }
  if(!diags.length){ diags.push('Keine markanten Auffälligkeiten'); }
  if(tex>0.6 && pore>0.6) summary='Unruhige Textur mit betonten Poren.';
  if(red>0.6) summary='Rötung im Zentrum sichtbar.';
  return { diagnostics: Array.from(new Set(diags)), actives: Array.from(new Set(act)), avoid: Array.from(new Set(avoid)), summary };
}

async function analyze(){
  if(!state.imgReady){ alert('Bitte zuerst ein Foto aufnehmen oder hochladen.'); return; }
  qs('#analysisWrap').classList.remove('hidden');
  const can=qs('#canvas'); const imgData=getImageData(can);
  const w=can.width, h=can.height; const mask=buildOvalMask(w,h);
  const stats=computeStatsLab(imgData, mask);
  const texVar=localVarianceL(imgData, mask, 4); // texture proxy
  const poreMag=laplaceMagnitude(imgData, mask); // pore proxy
  const spotIdx=spotIndex(imgData, mask); // spot proxy
  // Normalize empirically (ranges chosen from typical values)
  const tex=scale01(texVar, 5, 18);
  const pore=scale01(poreMag, 2.5, 10);
  const spot=scale01(spotIdx, 0.05, 0.22);
  const red=scale01((stats.meanA+10)/40, 0.35, 0.85); // a* centered
  // Aggregate score (lower issues -> higher score)
  const health = 1 - (0.30*tex + 0.30*pore + 0.25*spot + 0.15*red);
  const score = Math.max(0, Math.min(100, Math.round(health*100)));
  const {summary, diagnostics, actives, avoid} = deriveInsights({tex,pore,spot,red});

  // Render gauge & lists
  qs('#score').textContent = String(score);
  const len=157, off = len - (score/100)*len; qs('#gArc').style.strokeDashoffset = String(off);
  qs('#summary').textContent = summary;
  const fill = (sel, arr)=>{ const ul=qs(sel); ul.innerHTML=''; (arr||[]).forEach(t=>{ const li=document.createElement('li'); li.textContent=t; ul.appendChild(li); }); };
  fill('#diagnostics', diagnostics); fill('#actives', actives); fill('#avoid', avoid);

  const photoSummary = (stats.meanL>65? 'hell ausgeleuchtet' : stats.meanL<35? 'eher dunkel' : 'ausreichend Licht');
  const premiumUpsell = score<75? 'Premium Facial mit PHA/BHA und LED empfohlen.' : 'Optional: Premium Pflege zur Erhaltung.';

  const json = { score, summary, diagnostics, actives, avoid, photoSummary, premiumUpsell };
  localStorage.setItem('lb_client_analysis', JSON.stringify(json));
}

// Wizard & Payment (kept minimal)
let wizIndex=1; const wizTotal=6; function showWiz(i){ qsa('.wiz-step').forEach(el=> el.classList.toggle('active', Number(el.dataset.step)===i)); }
function nextWiz(){ if(wizIndex<wizTotal){ wizIndex++; showWiz(wizIndex);} else { setStep(4); loadPayPal(); } }
function prevWiz(){ if(wizIndex>1){ wizIndex--; showWiz(wizIndex);} }
function collectWizard(){ const f=new FormData(qs('#wizForm')); const allergies=Array.from(qs('#wizForm').querySelectorAll('input[name="allergies"]:checked')).map(i=>i.value); const obj=Object.fromEntries(f.entries()); obj.allergies=allergies; localStorage.setItem('lb_client_wizard', JSON.stringify(obj)); }

function loadPayPal(){ if(!window.PAYPAL_CLIENT_ID){ console.warn('Missing PAYPAL_CLIENT_ID'); return;} if(document.getElementById('paypal-sdk')) return; const s=document.createElement('script'); s.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(window.PAYPAL_CLIENT_ID)}&currency=EUR`; s.id='paypal-sdk'; s.onload=renderPayPalButtons; document.body.appendChild(s); }
function renderPayPalButtons(){ if(!window.paypal){ console.warn('PayPal SDK not loaded'); return; } const common={ style:{layout:'vertical',color:'gold',shape:'pill',label:'paypal'}, createOrder:(d,a)=>a.order.create({purchase_units:[{amount:{value:'29.00'}}]}), onApprove:async(d,a)=>{ const det=await a.order.capture(); const purchase={plan:window.__plan||'standard', orderId:det.id, time:new Date().toISOString()}; localStorage.setItem('lb_purchase', JSON.stringify(purchase)); setStep(5);} }; window.paypal.Buttons({ ...common, onClick:()=>window.__plan='standard' }).render('#ppStd'); window.paypal.Buttons({ ...common, onClick:()=>window.__plan='premium', createOrder:(d,a)=>a.order.create({purchase_units:[{amount:{value:'59.00'}}]}) }).render('#ppPrem'); }

// GDPR Gate (session only)
(function gdpr(){ const seen=sessionStorage.getItem('gdpr'); const m=qs('#gdpr'); if(!seen){ m.classList.remove('hidden'); qs('#gdprAccept').addEventListener('click',()=>{ sessionStorage.setItem('gdpr','1'); m.classList.add('hidden');}); }})();

// Wireup
function ready(){
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
}

document.addEventListener('DOMContentLoaded', ready);

// Public config (optional)
window.PAYPAL_CLIENT_ID = window.PAYPAL_CLIENT_ID || '';
