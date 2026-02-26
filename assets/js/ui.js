
(function(){
  const y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  const bar=document.getElementById('scrollProgress');
  const lf=document.getElementById('lensflare');
  function setProgress(){
    const h=document.documentElement.scrollHeight-window.innerHeight;
    bar.style.width=(window.scrollY/Math.max(1,h))*100+'%';
    if(lf) lf.style.opacity=Math.min(1, window.scrollY/600);
  }
  setProgress();
  window.addEventListener('scroll',setProgress,{passive:true});
  window.addEventListener('resize',setProgress);

  const reveals=document.querySelectorAll('.reveal-up');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((entries)=>{
      entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target);} });
    },{threshold:0.2});
    reveals.forEach(el=>io.observe(el));
  } else { reveals.forEach(el=>el.classList.add('visible')); }

  document.querySelectorAll('.service-card[data-target]').forEach(card=>{
    card.addEventListener('click',()=>{
      const id=card.getAttribute('data-target');
      const el=document.getElementById(id);
      if(!el) return;
      document.querySelectorAll('#pricing details').forEach(d=>{ if(d!==el) d.removeAttribute('open'); });
      el.setAttribute('open','');
      el.classList.add('highlight');
      setTimeout(()=>el.classList.remove('highlight'),1500);
      el.scrollIntoView({behavior:'smooth',block:'start'});
    });
  });
})();
const lf = document.getElementById("lensflare");
window.addEventListener("scroll", () => {
  if (!lf) return;
  lf.style.opacity = Math.min(1, window.scrollY / 600);
});