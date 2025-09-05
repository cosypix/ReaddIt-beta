document.getElementById('summarize').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes('reddit.com')) {
    document.getElementById('status').textContent = 'Open a Reddit thread first.';
    return;
  }
  document.getElementById('status').textContent = 'Summarizing…';
  chrome.runtime.sendMessage({ type: 'SUMMARIZE_REDDIT', url: tab.url }, (res) => {
    document.getElementById('status').textContent = res?.ok ? 'Opening summary...' : ('Error: ' + (res?.error || 'unknown'));
  });
});