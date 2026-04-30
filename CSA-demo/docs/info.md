# Project Info (Simple Words)

This file explains the technical words in this project in very simple terms.

## 1) What this project is

This is a video app made with Remotion.

Think of it like this:
- You do not shoot video with a camera.
- You build video using code.
- Each frame is drawn by React components.

## 2) Where it starts (entrypoint)

Start point is `src/index.ts`.

Simple meaning:
- It tells Remotion: "Use our root app from Root.tsx."

Code idea:
- `registerRoot(RemotionRoot)`

## 3) What Root.tsx means

`src/Root.tsx` is the composition registry.

Simple meaning:
- It is the menu of videos you can render.
- Here you define settings like size, fps, and duration.

In this project, one composition is registered:
- id: Main
- component: MainComposition

## 4) Composition (technical word)

Composition = one full video definition.

Simple meaning:
- A composition is a complete video track with fixed settings.
- It has: width, height, fps, duration, and a React component.

## 5) MainComposition (technical word)

`src/compositions/Main.tsx`

Simple meaning:
- This is the main video body currently.
- Right now it simply returns Scene1.

So:
- Root registers the composition.
- MainComposition chooses what scene/component to show.

## 6) Scene (technical word)

Scene = one visual part of the story.

Simple meaning:
- Like a shot in a film.
- Scene1 is the active shot right now.
- Scene2 exists as placeholder.

## 7) Timeline (technical word)

`src/core/timeline.ts`

Simple meaning:
- This is the schedule of when events happen.
- It stores frame numbers for key moments.

Examples:
- messageIn at frame 30
- typingStart at frame 70
- response at frame 150

Important:
- Keep timing here only (single source of truth).

## 8) Orchestrator (technical word)

`src/core/orchestrator.ts`

Simple meaning:
- This is the translator from frame number to easy flags.
- It reads timeline and returns booleans like:
  - showMessage
  - isTyping
  - isThinking
  - showResponse

Why useful:
- UI components can read simple true/false values.
- They do not need to understand raw frame math.

## 9) Module (technical word)

Modules are feature components inside `src/modules/`.

Simple meaning:
- Reusable building blocks for business visuals.

In this project:
- WhatsAppUI: chat screen content
- SystemActivity: system status text
- PerceptionLayer: small intelligence indicator

## 10) Layer (technical word)

Layers are visual planes inside `src/layers/`.

Simple meaning:
- Like stacked transparent sheets:
  1. background
  2. camera wrapper
  3. UI and overlays

Why useful:
- Keeps visuals clean and organized.

## 11) Frame and FPS

Frame = one image in the video.
FPS = frames per second.

In this project:
- fps = 30
- 30 frames = 1 second

Example:
- frame 150 is about 5 seconds.

## 12) Render

Render = export final video file from code.

Simple meaning:
- Remotion runs all frames one by one and produces video output.

## 13) Build vs Dev

- Dev (`npm run dev`): open Remotion Studio to preview and scrub frames.
- Build (`npm run build`): bundle/output for production render pipeline.

## 14) End-to-end flow in one line

index.ts -> Root.tsx -> MainComposition -> Scene1 -> orchestrator + timeline -> modules/layers -> rendered frames.

## 15) Quick mental model (non-geek)

You can think of this app like a movie factory:
- Timeline = schedule board
- Orchestrator = manager giving instructions
- Scenes = camera shots
- Modules = actors doing tasks
- Layers = stage setup
- Composition = full movie setup
- Render = final exported movie