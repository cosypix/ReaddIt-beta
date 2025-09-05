# backend/main.py (Async PRAW, top-5, search r/all, fallback to hot)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import asyncpraw

from config import CLIENT_ID, CLIENT_SECRET, USER_AGENT

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

reddit = asyncpraw.Reddit(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    user_agent=USER_AGENT
)

class Req(BaseModel):
    summary: str
    subreddit: str | None = None
    global_search: bool = True

@app.post("/recommend")
async def recommend(req: Req):
    query = (req.summary or "").strip()
    if not query:
        return {"recommendations": []}

    # Choose scope
    sub_name = "all" if req.global_search or not req.subreddit else req.subreddit

    recommendations = []

    try:
        subreddit = await reddit.subreddit(sub_name)
        # primary: search
        async for s in subreddit.search(query, sort="relevance", limit=50):
            if (s.selftext or "").strip() in ("[removed]", "[deleted]"):
                continue
            recommendations.append({
                "title": s.title,
                "url": f"https://reddit.com{s.permalink}",
                "subreddit": s.subreddit.display_name,
                "score": s.score,
                "num_comments": s.num_comments
            })
            if len(recommendations) >= 5:
                break
    except Exception:
        recommendations = []

    # fallback: hot posts
    if not recommendations:
        try:
            subreddit = await reddit.subreddit(sub_name if sub_name != "all" else "popular")
            async for s in subreddit.hot(limit=10):
                if (s.selftext or "").strip() in ("[removed]", "[deleted]"):
                    continue
                recommendations.append({
                    "title": s.title,
                    "url": f"https://reddit.com{s.permalink}",
                    "subreddit": s.subreddit.display_name,
                    "score": s.score,
                    "num_comments": s.num_comments
                })
                if len(recommendations) >= 5:
                    break
        except Exception:
            pass

    return {"recommendations": recommendations[:5]}
