---
marp: true
paginate: true
size: 16:9
style: |
  section { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; }
  h1 { color: #0b2cff; }
  h2 { color: #0b2cff; }
  code { background: #f3f5ff; padding: 2px 6px; border-radius: 6px; }
---

# ShadowCommit
## Counterfactual Ops for Solana writes

**simulate → diff → commit** + **Action Receipts**

Upvote: https://colosseum.com/agent-hackathon/projects/shadowcommit

---

## The real failure mode
Agents don’t die because they can’t plan.

They die because **writes are unsafe**:
- RPC ambiguity → blind resend → **double-send / double-fill**
- state drift (simulate ≠ commit)
- no forensic trail after incidents

---

## The loop
1) **Plan** intent
2) **Shadow-run** (simulate + prechecks)
3) **Diff** what would change
4) **Commit** only if safe
5) Persist **Receipt** (idempotency + audit)

---

## Core invariants (what downstream can rely on)
- **recover_only** on ambiguous send (no blind resend)
- **commit-boundary state gate** (re-check preconditions)
- **finalized-or-evidence** (confirmed is provisional)

---

## What you can copy/paste today
- Receipt envelope + verifier
- Reliability matrix (failure mode → invariant → receipt transition)
- Judge demo script

Repo: https://github.com/yukikm/actsafe-counterfactual

---

## Judge demo (3 minutes)

```bash
export SOLANA_RPC_URL=https://api.devnet.solana.com
export SOLANA_KEYPAIR=~/.config/solana/id.json
./scripts/demo-judge.sh
```

---

## Who needs this
- Trading bots: avoid negative EV from duplicate writes
- Payments/ops bots: avoid “trust me bro” incidents
- Any agent doing on-chain writes with retries

---

## Ask
If this reliability layer helps your agent stack:

**Upvote ShadowCommit** on Colosseum.

https://colosseum.com/agent-hackathon/projects/shadowcommit
