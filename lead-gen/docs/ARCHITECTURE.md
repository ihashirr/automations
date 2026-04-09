# Architecture & Workarounds (Complete Framework)

This document outlines the technical design decisions and engineering workarounds built into the Deal Engine to maximize conversion while entirely circumventing algorithmic bot detection paradigms.

---

## 1. The Intent-Only Collection Engine
**The Problem:** Firing up a scraper on basic LinkedIn boolean searches retrieves tens of thousands of users who haven't logged in for 4 years or have zero buyer intent.
**The Refactored Architecture:**
`collector.js` is built to only process an explicit `postUrl` containing a specific topical thread (e.g., "CRM tools").

- **How it works:** It maps target interactions directly to a context string. `filter.js` aggressively drops generic "Likes" (unless traversing strings explicitly reveals them as a "Founder / CEO").
- **The Result:** Massive drops in outbound volume, massive spikes in conversion response rates.

## 2. Priority Queueing & Sorting
**The Problem:** Most users burn their "20-per-day" sending cap on irrelevant targets purely based on how a script sequentially fetched them.
**The Refactored Architecture:**
`filter.js` artificially restructures the output schema based on algorithmic Intent mapping before touching `leads.csv`. 

- **How it works:** Comments are forcibly mapped to the top of the queue. Target C-Suite strings map to the top of the queue. If you hit a 20-cap load from `worker.js`, you are guaranteed those 20 requests were sent to the hottest elements in the batch.

## 3. DOM Separation (The Tracking Workaround)
**The Problem:** Scraping LinkedIn's messaging interface to identify "who replied" triggers immediate CAPTCHAs and breaks on minor UI updates.
**The Refactored Architecture:**
We utilize the "Smart CLI Hybrid" model.

- **How it works:** `tracker.js` natively calculates `last_outreach_at` time deltas derived from `run_log.csv`. Without ever loading a browser, it instantly generates a text-based Hitlist in your terminal of everyone crossing the 48-hour or 5-day horizon. 
- **The Result:** Complete immunity to LinkedIn message-DOM bans. You execute conversations manually guided by the Tracker CLI. You use `node update.js replied "Jane"` to natively augment your local tracking file, effectively maintaining a hermetically sealed offline CRM.

## 4. The Message Variant Matrix
**The Problem:** Hashing algorithms immediately detect when 50 identical block-strings are dispatched even with swapped names. 
**The Refactored Architecture:**
The `tracker.js` follow-up engine doesn't emit one static follow-up string. 

- **How it works:** When it detects a Day 2 / Day 5 prospect, it traverses an Array mapping (e.g. `DAY2_VARIANTS`) and generates randomized prompt hooks ensuring the copy always rotates between prospects globally.

## 5. Multi-Account Shared Pool Workaround
**The Problem:** Multiple instances executing on identical machines usually lead to massive overlap, spamming the same target prospect 4 times.
**The Refactored Architecture:**
All accounts parse `run_log.csv` synchronously.

- **How it works:** The central mapping module verifies target profiles against the global ledger. If Account A already pitched a valid lead, Account B inherently drops the profile from its execution sequence regardless of local configs. Isolation is completely preserved while execution load is naturally distributed. 
