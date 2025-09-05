// contentScript.js - Beautified UI for Reddit Summaries
(function init(){
  if (window.hasRedditSummarizer) return; window.hasRedditSummarizer = true;
  const btn = document.createElement('button'); btn.id = 'rs-summarize-btn'; btn.textContent = 'Summarize Thread'; document.documentElement.appendChild(btn);
  const panel = document.createElement('div'); panel.id = 'rs-summary-panel'; panel.innerHTML = `<div class="rs-card"><div class="rs-header">Reddit Summarizer</div><div class="rs-body"><div class="rs-empty">Click <strong>Summarize Thread</strong> to generate a summary.</div></div></div>`; document.documentElement.appendChild(panel);
  btn.addEventListener('click', async ()=>{ setBody('<div class="rs-loading">Summarizing…</div>'); try{ const url=location.href; const res = await chrome.runtime.sendMessage({type:'SUMMARIZE_REDDIT', url}); if(!res?.ok) throw new Error(res?.error||'Unknown error'); setBody(renderSummaryHTML(res.summary, res.postInfo)); }catch(e){ setBody(`<div class="rs-error">${escapeHtml(e.message)}</div>`); } });
  function setBody(html){ panel.querySelector('.rs-body').innerHTML = html; }
  function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function formatText(s){ let out = s||''; out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); out = out.replace(/(^|\n)\s*[-*]\s+(.*)/g, '$1<li>$2</li>'); if(out.indexOf('<li>')!==-1) out = '<ul class="rs-list">'+ out.replace(/\n/g,'') + '</ul>'; out = '<p>'+ out.replace(/\n{2,}/g,'</p><p>') +'</p>'; out = out.replace(/\n/g,'<br>'); return out; }
  function renderSummaryHTML(text, postInfo){ const safe = formatText(escapeHtml(text)); return `
    <div class="rs-meta">
      <a class="rs-title" href="${postInfo.url}" target="_blank">${escapeHtml(postInfo.title)}</a>
      <div class="rs-sub">r/${escapeHtml(postInfo.subreddit)} • ${postInfo.num_comments} comments</div>
    </div>
    <div class="rs-text">${safe}</div>
    <div class="rs-actions">
      <button id="rs-copy">📋 Copy</button>
      <button id="rs-close">✖ Close</button>
    </div>
  `; }
  document.addEventListener('click',(e)=>{ if(e.target && e.target.id==='rs-copy'){ const txt = panel.querySelector('.rs-text')?.innerText||''; navigator.clipboard.writeText(txt); e.target.textContent='Copied!'; setTimeout(()=> e.target.textContent='📋 Copy',1200); } else if(e.target && e.target.id==='rs-close'){ panel.querySelector('.rs-body').innerHTML = '<div class="rs-empty">Click <strong>Summarize Thread</strong> to generate a summary.</div>'; } });
})();
