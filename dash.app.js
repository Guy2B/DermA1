
(function(){
  const $ = (q)=>document.querySelector(q);
  const $$ = (q)=>document.querySelectorAll(q);

  /* Sidebar nav */
  const buttons = $$('.navbtn');
  const panels = {
    prompt: $('#panel-prompt'),
    results: $('#panel-results'),
    table: $('#panel-table')
  };
  buttons.forEach(b=>{
    b.addEventListener('click', ()=>{
      buttons.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const id = b.dataset.panel;
      Object.values(panels).forEach(p=>p.classList.remove('active'));
      panels[id].classList.add('active');
    });
  });

  /* Prompt autosave */
  const PKEY='lb_dash_prompt';
  const promptText = $('#promptText');
  const promptOut = $('#promptOut');
  promptText.value = localStorage.getItem(PKEY) || '';
  promptText.addEventListener('input', ()=> localStorage.setItem(PKEY, promptText.value));
  $('#btnPromptClear').addEventListener('click', ()=>{ promptText.value=''; localStorage.removeItem(PKEY); promptOut.textContent=''; });
  $('#btnGenerate').addEventListener('click', ()=>{ promptOut.textContent = promptText.value ? '> '+promptText.value : ''; });

  /* Results JSON autosave */
  const RKEY='lb_dash_results';
  const resultsJson = $('#resultsJson');
  resultsJson.value = localStorage.getItem(RKEY) || '';
  resultsJson.addEventListener('input', ()=> localStorage.setItem(RKEY, resultsJson.value));
  $('#btnResultsFormat').addEventListener('click', ()=>{
    try{ const formatted = JSON.stringify(JSON.parse(resultsJson.value||'{}'), null, 2); resultsJson.value = formatted; localStorage.setItem(RKEY, formatted); }
    catch(e){ alert('Kein gültiges JSON.'); }
  });
  $('#btnResultsRestore').addEventListener('click', ()=>{ resultsJson.value = localStorage.getItem(RKEY)||''; });

  /* Table autosave */
  const TKEY='lb_dash_table';
  const body = $('#dashTable tbody');
  function addRow(data={date:'',name:'',email:'',plan:'',score:''}){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><input value="${data.date||''}"></td>
                  <td><input value="${data.name||''}"></td>
                  <td><input value="${data.email||''}"></td>
                  <td><input value="${data.plan||''}"></td>
                  <td><input value="${data.score||''}"></td>
                  <td><button class='btn subtle btnDel'>Löschen</button></td>`;
    body.appendChild(tr);
  }
  function toRows(){
    return Array.from(body.querySelectorAll('tr')).map(tr=>{
      const c=tr.querySelectorAll('td input');
      return {date:c[0].value,name:c[1].value,email:c[2].value,plan:c[3].value,score:c[4].value};
    });
  }
  function save(){ localStorage.setItem(TKEY, JSON.stringify(toRows())); }

  try{
    const saved = JSON.parse(localStorage.getItem(TKEY)||'[]');
    if(saved.length){ saved.forEach(addRow); }
    else { addRow({date:new Date().toISOString().slice(0,10), plan:'standard'}); }
  }catch{ addRow(); }

  body.addEventListener('input', save);
  body.addEventListener('click', (e)=>{ if(e.target.classList.contains('btnDel')){ e.target.closest('tr').remove(); save(); } });
  $('#btnRowAdd').addEventListener('click', ()=>{ addRow(); save(); });

  /* CSV export */
  function toCsv(rows){
    const head=['Datum','Name','Email','Plan','Score'];
    const lines=[head.join(',')].concat(rows.map(r=>[r.date,r.name,r.email,r.plan,r.score].map(v=>`"${String(v||'').replaceAll('"','""')}"`).join(',')));
    return lines.join('
');
  }
  $('#btnExportCsv').addEventListener('click', ()=>{
    const a=document.createElement('a');
    a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(toCsv(toRows()));
    a.download='dashboard_table.csv'; a.click();
  });
})();
