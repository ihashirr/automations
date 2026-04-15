# Navigation Experience Baseline

Last updated: 2026-04-15

This document logs the current user navigation experience of the app from launch to completion. It is intended as the baseline reference before major UX or information-architecture changes.

The routing and behavior described here reflect the current code in:

- `src/root/AppRoot.tsx`
- `src/screens/MissionHubScreen.tsx`
- `src/screens/ShopsListScreen.tsx`
- `src/screens/CaptureScreen.tsx`
- `src/screens/MapScreen.native.tsx`
- `src/screens/ShopDetailScreen.tsx`

## Route Map

Root stack:

- `Home`
- `ShopDetail`

Inside `Home`, the app uses a bottom-tab shell with 3 main destinations:

- `Missions`
- `Capture`
- `Map`

Inside `Missions`, there is a nested stack:

- `MissionHub`
- `MissionsList`
- `MissionDetail`

## Start State

When the app opens, the default visible tab is:

- `Capture`

This means the first experience is not a dashboard or mission browser. The user lands directly inside the lead-entry flow.

## Primary User Journeys

### 1. Quick capture from app launch

This is the fastest end-to-end path in the current product.

1. User launches the app.
2. App opens on the `Capture` tab.
3. User sees the live or offline queue chip at the top.
4. User confirms or changes the destination mission/category using the destination selector.
5. User enters `Shop name`.
6. User adds location in one of 2 ways:
   - `Use Current`
   - `Pin on Map`
7. If `Pin on Map` is used:
   - full-screen map picker opens
   - user moves the map until the center pin is on the exact spot
   - user taps `Confirm Location`
8. User optionally fills:
   - decision maker
   - role
   - phone
   - next step
9. User selects a visit outcome.
10. User optionally adds photos from:
   - camera
   - gallery
11. User taps `Save Visit`.
12. If online and save succeeds:
   - capture is saved to Convex
   - form resets
   - success flash is shown
13. If offline or upload/save fails in the queue path:
   - capture is stored locally
   - warning or queued feedback is shown

### 2. Mission-first browsing flow

This is the “browse first, then drill in” path.

1. User taps `Missions` in the bottom tab bar.
2. `MissionHub` opens.
3. User sees the module cards from `missionCatalog`.
4. User taps one mission/module card.
5. App navigates to `MissionsList`.
6. In `MissionsList`, if no category is active yet, the user sees:
   - live and pending summary
   - recent activity
   - mission folder grid
7. User taps a folder card.
8. App navigates to `MissionDetail`.
9. Inside the folder detail state, user can:
   - search within the folder
   - sort by latest
   - sort by nearest
   - filter by area/neighborhood
   - open a live lead
   - long-press a lead to move it
10. If the user taps a live lead card:
    - app pushes `ShopDetail` on the root stack
11. If the user long-presses a lead:
    - move sheet opens
    - user can move the lead to another folder or mission

### 3. Map-first browsing flow

This is the “browse spatially, then act” path.

1. User taps `Map` in the bottom tab bar.
2. Native build opens `MapScreen.native.tsx`.
3. The screen fetches mission pins for the active mission/category.
4. The map centers on:
   - current location if available
   - otherwise the first available pin
   - otherwise the Abu Dhabi default center
5. User can tap the location button to refresh current GPS position.
6. User can tap a map marker.
7. A bottom quick-info card opens for the selected lead.
8. From that card, the user can:
   - call the number
   - route to the location in the platform maps app

Important current implementation detail:

- The native map is currently a `WebView`-hosted Leaflet map using a no-key public basemap.
- It is not a native Google Maps surface.

### 4. Lead detail flow

This is the deep detail path for saved live records.

1. User opens a live lead from the mission folder list.
2. App pushes `ShopDetail`.
3. User sees:
   - hero image or placeholder
   - name and contact summary
   - outcome
   - capture timestamp
   - actions for call and WhatsApp
   - locked location
   - photo grid
   - notes/details section
4. From `ShopDetail`, user can:
   - call the lead
   - open WhatsApp
   - open the pinned location in maps
5. User returns using the native stack back button.

## Current Bottom Navigation Behavior

The bottom nav is a 3-tab shell:

- `Missions`
- center `Capture` action
- `Map`

Behavior notes:

- The app launches into `Capture`.
- Tapping `Missions` when already focused resets back toward `MissionHub`.
- The center button is treated like the primary CTA.
- `ShopDetail` is outside the tab navigator, so it overlays the tabs as a pushed detail page.

## Secondary Overlays And Temporary States

### Capture tab overlays

- Destination picker bottom sheet
- Full-screen map picker
- Duplicate warning alert
- Save feedback toast

### Missions list overlays

- Lead move bottom sheet
- Empty state CTA to start capture

### Map tab overlays

- top mission/count pill
- current-location button
- bottom selected-lead action sheet

## Current Screen-by-Screen Experience

### `MissionHub`

Purpose:

- choose which mission/module to work inside

User decision:

- pick the operational module before browsing folders

Output:

- sets active mission context and moves to `MissionsList`

### `MissionsList`

Purpose:

- show the selected mission at two levels:
  - folder overview
  - folder detail

Overview state:

- recent activity
- folder cards
- mission switch action

Detail state:

- searchable/filterable list of leads
- sort controls
- area chips
- long-press move flow

### `Capture`

Purpose:

- create the fastest possible lead record in the field

Required to save:

- shop name
- location
- outcome

Optional:

- mission/category change
- contact details
- notes
- photos

### `Map`

Purpose:

- visualize the active mission geographically
- jump directly to route/call actions

Current limitation:

- visual language depends on the no-key WebView map fallback

### `ShopDetail`

Purpose:

- review the full saved record and act on contact/location data

## Back Behavior

There are a few custom back rules in the mission folder experience:

Inside `ShopsListScreen`, Android hardware back will clear in this order:

1. selected lead sheet
2. search text
3. active neighborhood filter
4. active category
5. normal system back after those are cleared

This means the folder experience behaves like a layered state machine, not just a simple page.

## Current Experience Strengths

- Fastest path is clear: app opens on capture.
- Location capture is strongly emphasized.
- Offline queue is visible and central to the workflow.
- Missions, capture, and map are separated cleanly as top-level intents.
- Live lead detail is one tap away from folder lists.

## Current Experience Friction

- App opens straight into form entry, which is fast for repeat operators but can feel abrupt for new users.
- `MissionsList` combines dashboard behavior and folder-detail behavior in one screen component, which makes the mental model heavier.
- The map is functionally useful, but its visual language does not yet match the rest of the product.
- `MissionHub`, `MissionsList`, and `Capture` each have different UI emphasis, so the product can feel like separate surfaces rather than one unified system.
- Several important flows rely on temporary overlays or local state, which is workable now but should be mapped carefully before any large redesign.

## Recommended Redesign Questions

Before major changes, decide these first:

1. Should the default app entry remain `Capture`, or should the app land on a home/dashboard screen first?
2. Should `MissionsList` stay dual-purpose, or should mission overview and folder detail become separate screens?
3. Should the center capture button remain a tab, or become a global action over a more traditional nav shell?
4. Should `Map` remain a browsing surface, or become a secondary utility opened from other screens?
5. Should `ShopDetail` remain read-mostly, or become an editable record screen?

## Redesign Guardrails

If the app is redesigned later, preserve these product truths unless the business flow changes:

- The app is field-first, not report-first.
- Location is core, not optional.
- Offline queueing is part of the product identity.
- Mission/category context is essential to how leads are organized.
- The save path must remain fast under poor connectivity and one-hand use.

