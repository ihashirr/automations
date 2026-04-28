# Leadit

Leadit is a mission-driven lead capture app built with Expo + React Native and Convex.

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
.agents/          Codex-local agent assets and mirrored project skills
assets/           App icons and static image assets
docs/             Architecture and operational project documentation
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
- Contact: `phone`, `contactPerson`, `role`, `nextStep`, `referredBy`
- Media: `images` (supports current URLs and legacy storage IDs), `imageUrls` (legacy)
- Location: nested `location` + legacy flat fields (`latitude`, `longitude`, `address`)
- Search and timestamps: `searchText`, `createdAt`, `updatedAt`

Indexes:
- by created time
- by category + created time
- by mission + created time
- by neighborhood + created time

See the docs index in `docs/README.md`.
Architecture details live in `docs/architecture/technical-architecture.md`.
Navigation and UX baseline lives in `docs/architecture/navigation-experience.md`.
Operational Convex rules live in `docs/operations/convex-bandwidth-rules.md`.

## Setup

Prerequisites:
- Node.js 20+
- npm

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env.local
```

Set `EXPO_PUBLIC_CONVEX_URL` to the Convex deployment URL. If you attach photos, also set `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`; otherwise photo leads are kept in the local queue until upload config is available.

Run app:

```bash
npm run start
```

## Launch Instructions

### Android Phone With Expo Go

Use this when a physical Android phone is connected over USB.

1. Confirm the phone is visible:

```bash
adb devices
```

2. Start Metro from this project folder and keep it running:

```bash
npm run start
```

3. Forward the Metro port to the phone:

```bash
adb reverse tcp:8081 tcp:8081
```

4. Open the app in Expo Go:

```bash
adb shell am start -W -a android.intent.action.VIEW -d "exp://127.0.0.1:8081"
```

If Metro starts on a different port, replace `8081` in both commands with that port.

## Android Studio and `android/`

This project uses Expo, so you usually do **not** recreate the `android/` folder every time you change app source code.

What normally updates without regenerating `android/`:
- Changes in `src/`, `App.tsx`, screens, components, and other JavaScript/TypeScript files.
- UI, business logic, and most app behavior changes.

What requires regenerating or updating the native Android project:
- Changes in `app.config.ts` or other Expo config that affect native settings.
- Adding or removing native plugins or dependencies.
- Android permissions, package name, icons, splash screen, or other native build settings.

### What `expo prebuild` means

`expo prebuild` generates the native Android and iOS projects from your Expo config and installed plugins. In this app, it is the command to use when you need to recreate `android/` from the current Expo setup.

Typical workflow:
1. Change normal app code in `src/`.
2. Rebuild or rerun the app. You do not need to regenerate `android/`.
3. If you change native config, run `npx expo prebuild` to regenerate the native project.
4. Open the `android/` folder in Android Studio after prebuild if you want to work in the native project directly.

If you want to start from a fresh native project, use:

```bash
npx expo prebuild --clean
```

Use that only when you intentionally want Expo to regenerate the native folders from scratch.

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
