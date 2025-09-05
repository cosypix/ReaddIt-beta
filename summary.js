// summary.js
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get('latestSummary', (res) => {
    const data = res.latestSummary || {};
    document.getElementById('title').textContent = data.title || 'Untitled post';
    document.getElementById('meta').textContent = data.subreddit ? `r/${data.subreddit}` : '';
    const sentiEl = document.getElementById('sentiment');
    const label = (data.sentiment || 'Neutral').toLowerCase();
    let cls = 'neutral', emoji = '😶';
    if (label.includes('positive')) { cls = 'positive'; emoji = '😀'; }
    else if (label.includes('negative')) { cls = 'negative'; emoji = '😞'; }
    else if (label.includes('mixed')) { cls = 'mixed'; emoji = '😐'; }
    sentiEl.innerHTML = `<span class="badge ${cls}">${emoji} ${data.sentiment || 'Neutral'}</span>`;
    document.getElementById('summary').textContent = data.summary || 'No summary available.';
  });
});
