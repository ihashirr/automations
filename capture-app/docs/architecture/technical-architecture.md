# Technical Architecture

## 1. System Overview

Capture App is an Expo React Native application backed by Convex.

The architecture is split into:
- UI layer (screens + components)
- State orchestration layer (React contexts)
- Device/service adapters (lib utilities)
- Backend data layer (Convex schema + functions)

## 2. Frontend Architecture

### 2.1 Navigation

- Root stack:
  - Home (tab navigator)
  - ShopDetail (detail route)
- Home tabs:
  - Missions
  - Capture
  - Map

Design goals:
- Consistent custom tab bar shell.
- Center floating capture action.
- Header remains visible across tab screens.
- Tab press routes to the tab main page.

### 2.2 Screen Responsibilities

- ShopsListScreen:
  - Mission dashboard and folder browsing.
  - Search/filter/sort feed.
  - Pending queue visibility and retry.
- CaptureScreen:
  - High-speed lead capture.
  - Folder picker in add flow.
  - Location pinning.
  - Camera/gallery attachment.
  - Save action with validation and feedback.
- MapScreen:
  - Mission-linked geographic overview.
- ShopDetailScreen:
  - Per-lead details and follow-up actions.

### 2.3 Shared UI Components

- ShopCard: list card for remote/pending lead display.
- PhotoStrip: compact image thumbnail strip + remove controls.
- PostSaveActionsCard and other utility elements for follow-up UX.

### 2.4 Styling System

- Theme tokens in src/constants/theme.
- Shared spacing/radii/typography/palette primitives.
- Composition-first styling via React Native StyleSheet.

## 3. State & Data Flow

### 3.1 MissionControlContext

Purpose:
- Holds active mission and folder (category) state globally.

Capabilities:
- Read active mission/category ids and labels.
- Switch mission.
- Start mission in a chosen category.

### 3.2 CaptureQueueContext

Purpose:
- Offline-first save pipeline and retry orchestration.

Pipeline:
1. Normalize draft input.
2. If online, attempt sync to Convex.
3. If offline/failure, enqueue locally.
4. Flush queue automatically when app is active and online.

Queue behavior:
- Persists pending captures to local storage.
- Tracks sync issue message for UX visibility.
- Deletes local media after successful sync.

## 4. Service/Lib Layer

- location.ts:
  - Coordinate formatting, reverse geocode resolution, distance helper.
- upload.ts:
  - Uploads image assets (URI -> blob body path on web/native-safe flow).
- queue-storage.ts:
  - Creates and persists pending captures and local media references.
- format.ts:
  - Normalization/search formatting and sync error humanization.
- haptics.ts:
  - Centralized tactile feedback patterns.

## 5. Convex Backend

### 5.1 Schema

Main table: shops

Field groups:
- Core identity: name, category, mission, neighborhood
- Contact: phone, contactPerson, role, nextStep, referredBy
- Media:
  - images (current URLs and legacy storage ids for compatibility)
  - imageUrls (legacy string array)
- Location:
  - location object: lat, lng, formattedAddress
  - legacy flat: latitude, longitude, address
- Metadata: searchText, createdAt, updatedAt

Indexes:
- by_createdAt
- by_category_and_createdAt
- by_mission_and_createdAt
- by_neighborhood_and_createdAt

### 5.2 Backend Functionality

- create/update/read operations for shops.
- Mission feed query support.
- Category/move actions for lead reclassification.

## 6. Reliability & Compatibility Decisions

- Legacy schema compatibility maintained with optional/deprecated fields.
- Offline queue guarantees no data loss during network interruption.
- Cross-platform file handling avoids web/runtime path API pitfalls.
- Type-safe route params and Convex generated types used end-to-end.

## 7. Runtime & Build

Scripts:
- npm run start
- npm run web
- npm run typecheck
- npm run convex:codegen

Expected deployment model:
- Expo client (native/web)
- Convex hosted backend deployment

## 8. Future Hardening Recommendations

- Add end-to-end smoke tests for capture -> queue -> flush.
- Add migration plan to fully remove deprecated schema fields after backfill.
- Add analytics around queue retry rates and save latency.
- Add role/auth boundaries if multi-user governance expands.
