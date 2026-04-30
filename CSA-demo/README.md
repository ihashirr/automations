# WhatsApp AI Customer Service Demo

Welcome to the rendering engine for our WhatsApp AI automation demo. This isn't just a UI mockup — it's a scalable, programmatic video pipeline built with [Remotion](https://www.remotion.dev/), designed to create hyper-realistic system demonstrations that close deals.

## The Mental Model

We treat this video like a high-performance rendering engine, separating concerns strictly:

*   **Timeline = Backend** (`core/timeline.ts`)
*   **Orchestrator = API** (`core/orchestrator.ts`)
*   **Modules = Services** (`modules/`)
*   **Layers = Rendering Engine** (`layers/`)
*   **Scenes = Views/Pages** (`scenes/`)

This architecture allows us to swap an entire WhatsApp demo flow out for an Email or SMS flow in minutes without touching the core rendering physics.

## Governance (Strict)

All contributors must follow the project rules in docs/VIBECODING_RULES.md.
Treat that file as the mandatory standard for timeline logic, scene boundaries, scalability, and documentation discipline.

---

## 🏗️ Architecture Breakdown

### 1. The Core (`/src/core`)
*   `timeline.ts`: The absolute source of truth. **Never hardcode raw frame numbers in your UI.** All event triggers (when an animation starts, when the system "thinks", when the response triggers) are configured here in a simple, centralized JSON-style object.
*   `orchestrator.ts`: The brain. Contains the `useSceneOrchestrator` hook that translates raw Remotion frames against the `timeline.ts` configuration, exporting clean React boolean flags (e.g., `isTyping`, `showResponse`).

### 2. Layers (`/src/layers`)
Distinct Z-index visual planes that stack to create cinematic depth.
*   `background/CinematicBackground.tsx`: Deep ambient background (L1).
*   `ui/Icons.tsx`: Raw vector graphics.

### 3. Modules (`/src/modules`)
Isolated, reusable functional components containing embedded spring physics and visual logic.
*   `chat/WhatsAppUI.tsx`: The heart of the demo. Contains the hyper-realistic WhatsApp device outer shell, the exact Android app top/bottom bars, and the central `useMessageAnimation` hook that calculates realistic messaging tactile overshoot, delays, and shadows universally.
*   `system/SystemActivity.tsx`: Visual feedback layers (Data Lines, Backend Overlays) representing invisible back-end automation processes.

### 4. Scenes (`/src/scenes`)
Pure compositions. These files contain **zero conditional logic**. They only mount `<Modules/>` and `<Layers/>` based on instructions passed down from the Orchestrator hook. 

---

## 🎨 Theme System

Want to switch from Dark Mode to the polished Light Theme? 
Edit `src/constants.ts`. The generic UI elements in the structural layer point strictly to the tokens defined here (e.g., `COLORS.bubbleSent`, `COLORS.bgCard`).

---

## 🚀 Running Locally

Start the video dev server to preview your scenes frame-by-frame:

```bash
npm install
npm run dev
```

Render the final MP4 video output for production:

```bash
npm run build
```

---

## 🔧 Adding a New Scene

1. Add your timestamps into the `timeline.ts` object.
2. If necessary, define the boolean extraction for your new configuration in `orchestrator.ts`.
3. Create your composition in `src/scenes/NewScene.tsx`.
4. Register the new scene's `<Sequence>` in the root `src/Composition.tsx`.
