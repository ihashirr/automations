# Capture App

Mission-driven lead capture app built with Expo + React Native and Convex.

This app is designed for fast field execution:
- Capture a lead in seconds.
- Pin exact location.
- Attach photos.
- Save online immediately or queue offline and auto-sync later.

## Tech Stack

- Frontend: Expo (React Native + React Native Web), TypeScript
- Navigation: React Navigation (bottom tabs + native stack)
- Backend: Convex (queries, mutations, actions)
- Device APIs: expo-location, expo-image-picker, expo-file-system, expo-haptics
- UI icons: lucide-react-native

## Core Product Flows

1. Mission + Folder selection
- User works inside a mission/category context.
- Folder can be selected from the Missions dashboard or directly inside Capture.

2. Rapid Capture
- Enter shop details.
- Pin location.
- Add camera/gallery photos.
- Save lead.

3. Offline-first queue
- If offline (or sync fails), capture is queued locally.
- Queue flushes automatically when connection returns and app is active.

4. Mission Dashboard
- Browse mission feed.
- Filter by neighborhood.
- Search and sort (latest / nearest).
- Reclassify pending leads.

## Navigation Behavior

- Bottom tabs: Missions, Capture, Map.
- Tapping a tab always routes to that tab main page.
- Shared header is visible across tab screens.

## Project Structure

```text
src/
	components/      Reusable UI blocks (cards, strips, action panels)
	constants/       Theme tokens and mission/catalog definitions
	contexts/        Mission state and offline queue orchestration
	lib/             Queue storage, upload, formatting, location, haptics utilities
	navigation/      Typed route params
	root/            App-level navigation container and tab shell
	screens/         Missions list, Capture, Map, Detail screens
convex/
	schema.ts        Data model and indexes
	shops.ts         Lead write/read/query logic
```

## Data Model (Summary)

Primary table: `shops`

Fields include:
- Identity and classification: `name`, `category`, `mission`, `neighborhood`
- Contact: `phone`, `contactPerson`, `referredBy`
- Media: `images` (supports current URLs and legacy storage IDs), `imageUrls` (legacy)
- Location: nested `location` + legacy flat fields (`latitude`, `longitude`, `address`)
- Search and timestamps: `searchText`, `createdAt`, `updatedAt`

Indexes:
- by created time
- by category + created time
- by mission + created time
- by neighborhood + created time

See full technical details in `docs/TECHNICAL_ARCHITECTURE.md`.

## Setup

Prerequisites:
- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Run app:

```bash
npm run start
```

Run web:

```bash
npm run web
```

Typecheck:

```bash
npm run typecheck
```

## Convex

Generate Convex types/code:

```bash
npm run convex:codegen
```

Set up Convex project/deployment (if not already connected):

```bash
npx convex dev
```

## Notes

- Schema is currently compatibility-friendly for legacy records.
- Web upload and queue paths are implemented with cross-platform-safe file handling.
- Haptics are wired across key actions for tactile feedback.
