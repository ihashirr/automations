# Convex Bandwidth Rules

These rules are specific to this app's Convex setup and exist to keep network usage under control.

## Hard Rules

- Never scan the `shops` table and then filter mission or category in JavaScript. Use indexes first.
- Never use `.collect()` on user-facing list queries. Every list must be bounded with `.take(...)` or pagination.
- Never return full shop payloads to list or map screens when they only need summary fields.
- Never keep `useQuery()` subscriptions active on hidden tabs or screens. Use `"skip"` when a screen is unfocused.
- Never run remote duplicate checks on every keystroke. Only query when the input is meaningful.
- Never patch a shop if the mission/category values are unchanged. Skip no-op writes.
- Never serve heavy images through Convex. Store image URLs only and let Cloudinary handle image delivery.

## Approved Read Patterns

- Mission list feeds must read through `by_mission_and_createdAt`.
- Map pins must use a dedicated lightweight query shape.
- Shop detail can read the full document because it is a single-record view.
- Duplicate detection can query small indexed candidate sets only.

## Current Enforced Paths

- `convex/shops.ts:listMissionFeed`
  Uses `by_mission_and_createdAt` and returns a trimmed summary payload.
- `convex/shops.ts:listMissionMapPins`
  Returns only the fields needed by the map.
- `src/screens/ShopsListScreen.tsx`
  Skips the live feed subscription when the screen is not focused.
- `src/screens/MapScreen.native.tsx`
  Uses the lighter map query and skips it when unfocused.
- `src/screens/CaptureScreen.tsx`
  Defers and gates duplicate lookups to avoid noisy reactive traffic.

## Review Checklist

- Does this query read more than the UI actually renders?
- If one record changes, how many subscribed bytes get resent?
- Is this screen still subscribed while hidden behind another tab or route?
- Can this read be reduced to a summary shape or point-in-time fetch?
- Is this mutation writing anything if no real value changed?

## Notes

- `ShopDetailScreen` still uses a live `useQuery()`. That is acceptable for now because it is a single-record screen, but convert it to a point-in-time fetch if bandwidth remains high.
- If category-specific feeds become a hot path at larger scale, add a migration-safe index for that exact access pattern instead of reintroducing scan-and-filter logic.
