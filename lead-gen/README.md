# Lead Gen Engine v2.1

## Overview
This pipeline is an end-to-end, multi-account automated LinkedIn outreach engine. It is designed to autonomously turn basic keyword inputs into sales-ready conversations by executing a complete prospecting lifecycle: it discovers high-engagement content, harvests interacting profiles, rigorously filters and scores leads, and executes human-like, rate-limited outreach sequences. All actions are tracked centrally into unified deal flows, fully abstracting away manual prospecting.
## Project Structure
A professional CLI architecture with all logic isolated in the `src/` directory.

```
lead-gen/
├── main.js              # Single CLI entry point (the ONLY JS file in root)
│
├── src/                 # All code resides here
│   ├── index.js         # Centralized command registry
│   ├── commands/        # Primary task modules (refactored as functions)
│   │   ├── auth.js, collector.js, filter.js, worker.js, tracker.js, update.js, post_finder.js
│   └── lib/             # Shared logic modules
│       ├── config.js, csv.js, utils.js, logger.js, state.js, message.js, behavior.js
│
├── data/                # Persistent CSV data (gitignored)
├── state/               # Per-account browser sessions (gitignored)
├── ARCHITECTURE.md
└── package.json
```

## The Pipeline (6 Steps)

### Step 0 — Discover posts
```powershell
node main.js find <account> "search query" [max_posts]
```

### Step 1 — Harvest commenters
```powershell
node main.js collect <account> "<post_url>" "intent_tag"
```

### Step 2 — Filter & score
```powershell
node main.js filter
```

### Step 3 — Outreach
```powershell
node main.js outreach <account>
```

### Step 4 — Daily tracker
```powershell
node main.js track
```

### Step 5 — Update deals
```powershell
node main.js update <action> "<name>" [reply_type]
```

## Setup & Multi-Account
Run auth once per account to save its session:
```powershell
node main.js auth alpha
node main.js outreach alpha
```
All accounts share the centralized `data/leads.csv` — deduplication is automatic across the entire pool.
