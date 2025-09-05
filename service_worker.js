const GROQ_API_KEY = "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";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(prompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  // Extract text from Groq's OpenAI-compatible response
  return data.choices?.[0]?.message?.content || "";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SUMMARIZE_REDDIT") {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (!tab || !tab.url.includes("reddit.com")) {
          sendResponse({ ok: false, error: "Not a Reddit thread." });
          return;
        }

        const jsonUrl = tab.url.replace(/\/?$/, "") + ".json";
        const resp = await fetch(jsonUrl);
        const data = await resp.json();

        const post = data?.[0]?.data?.children?.[0]?.data || {};
        const comments = (data?.[1]?.data?.children || [])
          .filter(c => c.kind === "t1")
          .map(c => c.data.body)
          .slice(0, 30);

        const threadText = `Title: ${post.title}\nSubreddit: ${post.subreddit}\nAuthor: u/${post.author}\n\nTop comments:\n${comments.join("\n\n")}`;

        const prompt = `Summarize the Reddit thread below and include a short sentiment (Positive, Negative, Mixed, Neutral):\n\n${threadText}`;
        const summaryText = await callGroq(prompt);

        let sentiment = "Neutral";
        const sentiMatch = summaryText.match(/SENTIMENT:\s*(Positive|Negative|Mixed|Neutral)/i);
        if (sentiMatch) sentiment = sentiMatch[1];

        await chrome.storage.local.set({
          latestSummary: {
            summary: summaryText,
            sentiment,
            title: post.title || "Untitled",
            subreddit: post.subreddit || "",
            url: tab.url
          }
        });

        // Open summary page
        await chrome.tabs.create({ url: chrome.runtime.getURL("summary.html") });

        sendResponse({ ok: true });
      } catch (err) {
        console.error(err);
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // Keep port open for async response
  }
});

