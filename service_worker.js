// service_worker.js - Groq Llama-3.1-70b build (API key embedded)

const DEFAULT_SETTINGS = {
  apiBase: "https://api.groq.com/openai/v1",
  apiKey: "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",
  model: "llama-3.3-70b-versatile",
  maxTokens: 1024,
  temperature: 0.2,
  style: "bullet",
  language: "auto",
  includeQuotes: true,
  commentLimit: 30,
  sortCommentsBy: "top"
};

async function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULT_SETTINGS, resolve));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SUMMARIZE_REDDIT") {
    (async () => {
      try {
        const settings = await getSettings();
        const json = await fetchRedditJSON(message.url, settings.sortCommentsBy, settings.commentLimit);
        const { postInfo, comments } = extractThread(json, settings.commentLimit);
        const prompt = buildPrompt(postInfo, comments, settings);
        const summary = await callGroq(prompt, settings);
        sendResponse({ ok: true, summary, postInfo });
      } catch (err) {
        console.error(err);
        sendResponse({ ok: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }
});

async function fetchRedditJSON(url, sort = "top", limit = 30) {
  const u = new URL(url);
  let jsonURL = url;
  if (!u.pathname.endsWith('.json')) jsonURL = url.replace(/\/?$/,'/') + '.json';
  const params = new URLSearchParams({ sort, limit: String(limit) });
  const finalURL = jsonURL + (jsonURL.includes('?') ? '&' : '?') + params.toString();
  const res = await fetch(finalURL, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Reddit JSON fetch failed: ${res.status}`);
  return res.json();
}

function extractThread(json, limit) {
  const postListing = json?.[0]?.data?.children?.[0]?.data || {};
  const commentsArr = (json?.[1]?.data?.children || []).filter(n => n.kind === 't1').slice(0, limit).map(n => n.data);
  const postInfo = {
    subreddit: postListing.subreddit,
    title: postListing.title,
    author: postListing.author,
    url: `https://www.reddit.com${postListing.permalink || ''}`,
    selftext: postListing.selftext || '',
    ups: postListing.ups || 0,
    num_comments: postListing.num_comments || commentsArr.length || 0
  };
  const comments = commentsArr.map(c => ({ author: c.author, body: c.body || '', ups: c.ups || 0 }));
  return { postInfo, comments };
}

function buildPrompt(post, comments, settings) {
  const lang = settings.language === 'auto' ? '' : ` in ${settings.language} language`;
  const styleHint = settings.style === 'bullet' ? 'Use concise bullet points.' : settings.style === 'abstract' ? 'Write a 4-6 sentence abstract.' : 'Write a short paragraph summary.';
  const quotesHint = settings.includeQuotes ? 'Include 1-3 short representative quotes if helpful.' : 'Do not include quotes.';
  const commentsText = comments.map((c,i) => `(${i+1}) u/${c.author} [${c.ups}↑]: ${c.body}`).join("\n\n");
  return [
    `Summarize the following Reddit thread${lang}.`,
    styleHint,
    quotesHint,
    'Preserve key viewpoints, disagreements, consensus, and any advice or steps mentioned.',
    'Include a TL;DR at the end (<= 2 lines).',
    '',
    `Title: ${post.title}`,
    `Subreddit: r/${post.subreddit}`,
    `OP (u/${post.author}) says: ${post.selftext || '(no text)'}`,
    '',
    'Top comments:',
    commentsText || '(no comments fetched)'
  ].join('\n');
}

async function callGroq(prompt, settings) {
  const url = `${settings.apiBase.replace(/\/$/,'')}/chat/completions`;
  const body = { model: settings.model, messages: [ { role: 'system', content: 'You are a concise Reddit thread summarizer. Be accurate and unbiased.' }, { role: 'user', content: prompt } ], max_tokens: settings.maxTokens, temperature: settings.temperature };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  // Groq follows OpenAI-compatible shape: choices[0].message.content
  const content = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.output?.[0]?.content;
  if (!content) throw new Error('Empty Groq response');
  return (typeof content === 'string') ? content.trim() : (content[0]?.text || '').trim();
}
