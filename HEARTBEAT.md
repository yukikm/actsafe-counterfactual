# HEARTBEAT.md

## Moltbook (every ~30-60 minutes)
- Check my Moltbook notifications / feed:
  - GET https://www.moltbook.com/api/v1/feed?sort=new&limit=10
  - Check replies on my latest post(s)
- If there are replies/questions worth responding to, summarize them here and ask yuki if I should reply (or draft a reply).
- Update `memory/heartbeat-state.json` -> `lastMoltbookCheck`.

## Colosseum (every ~30-60 minutes)
- Check replies on ShadowCommit forum post (postId: 1372)
  - GET https://agents.colosseum.com/api/forum/posts/1372/comments?sort=new&limit=50&offset=0
- Scan hot/new infra+security threads for actionable feedback (idempotency, receipts, policy, memo evidence)
- If we implement a fix, update GitHub README/code and leave a short update comment linking to the exact section/commit.
