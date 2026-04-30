# Vibecoding Rules (Strict)

Purpose: keep this project fast to build, easy to scale, and consistent across contributors.

Status: mandatory. These rules are non-negotiable unless explicitly changed in this file.

## 1) Single Source of Truth

1. All frame/event timing must be defined in src/core/timeline.ts.
2. Hardcoded frame numbers in scene/module/layer files are forbidden.
3. State derivation from frame values must happen in src/core/orchestrator.ts.

## 2) Separation of Concerns

1. scenes/: composition only. Scenes assemble modules/layers and read orchestrator output.
2. core/: timing, orchestration, motion primitives, shared logic.
3. modules/: feature UI logic (chat, system, perception, flow).
4. layers/: visual planes (background, camera, effects) with minimal business logic.

## 3) Scene Contract

1. A scene must not contain direct business rules.
2. A scene may read frame and consume orchestrator state.
3. If scene-specific logic grows beyond simple wiring, move it to core/ or module-level hooks.

## 4) Styling and Theming

1. Repeated colors, spacing, radii, shadows, typography values must live in shared constants/tokens.
2. Inline styles are allowed only for one-off experimental values.
3. New reusable UI pieces should expose props instead of duplicating style blocks.

## 5) Data and Copy

1. User-facing copy that may change by client/demo should not be hardcoded across many files.
2. Keep scenario content centralized so channel/client variants can be swapped quickly.
3. Any CSV or external data source used in rendering must include a clear schema note in docs.

## 6) Naming and File Structure

1. Components: PascalCase filenames and exports.
2. Hooks/utilities: camelCase.
3. New feature areas belong in modules/<feature>/.
4. Avoid dumping shared logic into scenes/.

## 7) Performance and Render Safety

1. Keep per-frame calculations lightweight.
2. Memoize expensive derived data where helpful.
3. Avoid unnecessary re-renders caused by object recreation in deep trees.
4. Verify output in remotion studio before merge.

## 8) Documentation Integrity

1. If behavior or architecture changes, update docs in the same PR.
2. README, PRODUCT, and ARCHITECTURE must reflect actual code paths and names.
3. Do not reference files/hooks that do not exist.

## 9) Change Process (Required)

For every meaningful change, include:

1. What changed.
2. Why it changed.
3. Which rule(s) were touched.
4. Verification done (dev preview, lint/typecheck, render check).

## 10) Definition of Done

A task is done only when all are true:

1. No rule above is violated.
2. Code compiles/lints for touched areas.
3. Visual flow still matches PRODUCT intent.
4. Docs are updated where needed.

## 11) PR Review Checklist (Pass/Fail)

1. Timeline values only in core timeline file.
2. No business logic leakage into scenes.
3. Reuse over duplication in modules/layers.
4. Naming/folder conventions respected.
5. Docs and code are aligned.
6. Render validated at key frames.

## 12) Exception Policy

1. Exceptions must be written in the PR description with reason and rollback plan.
2. Temporary exceptions need a follow-up task with owner/date.
3. Repeated exceptions trigger a rule update in this file.

## 13) Ownership

1. This file is the governance source for vibecoding behavior in this repo.
2. If another doc conflicts with this file, this file wins until conflict is resolved.