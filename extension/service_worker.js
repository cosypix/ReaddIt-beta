// service_worker.js (async backend + Groq)
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

async function callGroq(prompt) {
  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: "You are a concise Reddit thread summarizer that outputs: (1) 5-7 crisp bullet points; (2) a TL;DR line; (3) a final line exactly like: SENTIMENT: <Positive|Negative|Mixed|Neutral>. Do not add anything else after that last line." },
        { role: "user", content: prompt }
      ],
      max_tokens: 900,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error("Groq API error " + res.status + ": " + await res.text());
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

async function fetchRecommendations(summary, subreddit) {
  try {
    const r = await fetch("http://127.0.0.1:8000/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary, subreddit, global_search: true })
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.recommendations || [];
  } catch (e) {
    console.error("Recommendation fetch failed:", e);
    return [];
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SUMMARIZE_REDDIT") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url || !tab.url.includes("reddit.com")) {
          sendResponse({ ok:false, error:"Open a Reddit thread first." });
          return;
        }
        const jsonUrl = tab.url.replace(/\/?$/, "") + ".json";
        const resp = await fetch(jsonUrl);
        if (!resp.ok) throw new Error("Failed to fetch Reddit JSON: " + resp.status);
        const data = await resp.json();
        const post = data?.[0]?.data?.children?.[0]?.data || {};
        const subreddit = post.subreddit || "";
        const comments = (data?.[1]?.data?.children || []).filter(c=>c.kind==="t1").map(c=>c.data.body).slice(0,40);
        const threadText = "Title: " + (post.title||"") + "\nSubreddit: " + subreddit + "\nAuthor: u/" + (post.author||"") + "\n\nTop comments:\n" + (comments.join("\n\n") || "(none)");
        const prompt = "Summarize the Reddit thread below in 5-7 concise bullets capturing key viewpoints, then add a TL;DR line. Finally append a line 'SENTIMENT: <Positive|Negative|Mixed|Neutral>'.\n\n" + threadText;
        const summaryText = await callGroq(prompt);
        let sentiment = "Neutral";
        const m = summaryText.match(/SENTIMENT:\s*(Positive|Negative|Mixed|Neutral)/i);
        if (m) sentiment = m[1];
        const recommendations = await fetchRecommendations(summaryText, subreddit);
        await chrome.storage.local.set({ latestSummary: { summary: summaryText, sentiment, title: post.title||"Untitled", subreddit: subreddit||"", url: tab.url, recommendations } });
        await chrome.tabs.create({ url: chrome.runtime.getURL("summary.html") });
        sendResponse({ ok:true });
      } catch (err) {
        console.error(err);
        sendResponse({ ok:false, error: err.message || String(err) });
      }
    })();
    return true;
  }
});