# Desktop Stability and Usability Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Windows local-mode desktop client from a usable internal build into a more customer-ready product by adding single-instance behavior, automatic reconnect, connection diagnostics, import preview/deduplication, stronger preflight validation, a split settings surface, and richer tray utilities.

**Architecture:** Keep Electron main as the authority for runtime behavior that must stay alive outside the renderer: single-instance locking, reconnect orchestration, tunnel diagnostics, tray menus, and preflight checks. Keep renderer responsibilities focused on guided user flows and state presentation: diagnostics/log pages, import preview UI, validation messaging, and the reorganized settings pages. Reuse the existing local-profile model and tunnel bridge rather than adding cloud state, master-password gates, or grouping/favorites concepts.

**Tech Stack:** Electron main/preload IPC, React renderer, existing local profile persistence and backup crypto, Node timers/net/process helpers, Node test runner, Vite, tsup, electron-builder.

---

## Scope Guardrails

- **Do implement:** single-instance startup, automatic reconnect, connection log/diagnostics page, import preview with duplicate handling, stronger connect-time validation, settings page split, richer tray shortcuts.
- **Do not implement:** master password / unlock flow, server grouping, favorites, recent-usage feature work, cloud account flows.
- **Do not regress:** local-only mode, encrypted local persistence, encrypted import/export, tray-close behavior, frameless shell, current installer packaging.

## File Map

- Modify: `apps/desktop/electron/main.ts`
  - Add single-instance lock
  - Add reconnect scheduling lifecycle
  - Add diagnostics event logging and richer tray actions
  - Add settings/log page navigation bridge endpoints if needed
- Modify: `apps/desktop/electron/tunnelManager.ts`
  - Expose reconnect-safe health/preflight helpers
  - Return richer diagnostics snapshots for logs and validation
- Modify: `apps/desktop/electron/preload.ts`
  - Expose new bridge methods for diagnostics, import preview, and settings navigation/validation
- Modify: `apps/desktop/src/types/bridge.ts`
  - Type diagnostics records, import preview contracts, preflight results, and settings APIs
- Modify: `apps/desktop/src/App.tsx`
  - Orchestrate new pages and shared app state
  - Handle reconnect/user notifications and page routing
- Modify: `apps/desktop/src/lib/tunnelClient.ts`
  - Add wrappers for preflight validation and diagnostics queries if exposed through bridge
- Modify: `apps/desktop/src/lib/localProfileClient.ts`
  - Add import-preview specific bridge wrappers
- Modify: `apps/desktop/src/lib/localProfileService.ts`
  - Add duplicate analysis helper without changing append-import semantics
- Modify: `apps/desktop/src/lib/serverConfigValidation.ts`
  - Expand static validation rules and messages
- Modify: `apps/desktop/src/state/authStore.ts`
  - Persist last-opened settings subsection or diagnostics preferences only if truly needed
- Modify: `apps/desktop/src/pages/AboutPage.tsx`
  - Shrink into one subsection of the new settings shell
- Create: `apps/desktop/src/pages/SettingsPage.tsx`
  - New split settings shell with tabs/sections
- Create: `apps/desktop/src/pages/DiagnosticsPage.tsx`
  - Connection logs and diagnostic details UI
- Create: `apps/desktop/src/components/ImportPreviewDialog.tsx`
  - Preview duplicate/new/skipped servers before import confirm
- Create: `apps/desktop/src/components/SettingsNav.tsx`
  - Shared settings subsection navigation if needed
- Modify: `apps/desktop/src/pages/LocalWorkspacePage.tsx`
  - Route to diagnostics/settings and new import preview flow
- Modify: `apps/desktop/src/styles/index.css`
  - Add diagnostics/settings/import-preview layouts while preserving current product styling
- Test: `apps/desktop/test/runtime-regression.test.mjs`
  - Cover single-instance lock, reconnect, diagnostics logging, tray menu expansion
- Test: `apps/desktop/test/api-regression.test.mjs`
  - Cover diagnostics/settings/import preview UI and bridge contracts

## Task 1: Add RED regression coverage for the new customer-ready behaviors

**Files:**
- Modify: `apps/desktop/test/runtime-regression.test.mjs`
- Modify: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Add runtime assertions for single-instance, reconnect, diagnostics, and tray expansion**

Add failing assertions that `electron/main.ts` contains:
- `app.requestSingleInstanceLock()` handling
- reconnect scheduling state such as `scheduleReconnectAttempt` / retry counters
- diagnostics log append helpers
- tray items for diagnostics/settings entry points

- [ ] **Step 2: Run runtime regression test to verify RED**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL because those runtime behaviors are not implemented yet.

- [ ] **Step 3: Add API assertions for diagnostics page, settings split, import preview, and stronger validation**

Add failing assertions that:
- `bridge.ts` types diagnostics/import-preview/preflight APIs
- `preload.ts` exposes them
- renderer source references `DiagnosticsPage`, `SettingsPage`, and `ImportPreviewDialog`

- [ ] **Step 4: Run API regression test to verify RED**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL because the new bridge/UI contracts are not implemented yet.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs
git commit -m "test: cover phase2 desktop readiness features"
```

## Task 2: Implement single-instance behavior in Electron main

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Extend runtime test to assert second-instance focus behavior if not already covered**

Keep the test source-level and verify expected hooks exist for:
- lock acquisition
- `second-instance` event
- showing/focusing the main window

- [ ] **Step 2: Run runtime regression test and confirm it still fails for missing implementation**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL on single-instance assertions.

- [ ] **Step 3: Implement the single-instance lock in `main.ts`**

Add:
- `const gotLock = app.requestSingleInstanceLock()`
- quit immediately when lock is unavailable
- `app.on('second-instance', ...)` that restores/shows/focuses the existing window

- [ ] **Step 4: Run runtime regression test to verify the single-instance assertions pass**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: single-instance assertions PASS; later feature assertions may still fail.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: enforce single desktop app instance"
```

## Task 3: Add reconnect-capable tunnel diagnostics and event logging primitives

**Files:**
- Modify: `apps/desktop/electron/tunnelManager.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Test: `apps/desktop/test/runtime-regression.test.mjs`
- Test: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Write/extend failing tests for diagnostics records and reconnect helper contracts**

Cover source expectations for:
- a diagnostics record type
- log query bridge methods
- reconnect scheduling helpers in main

- [ ] **Step 2: Run both regression suites to verify RED**

Run:
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL on diagnostics/reconnect assertions.

- [ ] **Step 3: Add types for diagnostics/preflight/reconnect state in `bridge.ts`**

Define contracts such as:
- `DiagnosticsLogEntry`
- `TunnelPreflightResult`
- `ImportPreviewResult`
- bridge methods like `listDiagnostics`, `clearDiagnostics`, `previewImport`, `runPreflightChecks`

- [ ] **Step 4: Expose preload bridge methods for diagnostics and import preview**

Keep preload thin; all heavy logic stays in main/local service.

- [ ] **Step 5: Add in-memory diagnostics/event recording in main process**

Record events for:
- connect requested
- connect success/failure
- disconnect requested/success/failure
- health-check failure
- reconnect scheduled/attempted/succeeded/exhausted

- [ ] **Step 6: Add main-process IPC handlers to list/clear diagnostics**

Return the latest diagnostics entries in reverse chronological order and allow clearing.

- [ ] **Step 7: Run regression tests to verify diagnostics bridge/runtime assertions pass**

Run:
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: diagnostics assertions PASS; reconnect/UI assertions may still fail.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/electron/tunnelManager.ts apps/desktop/electron/preload.ts apps/desktop/src/types/bridge.ts apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs
git commit -m "feat: add desktop diagnostics runtime primitives"
```

## Task 4: Implement automatic reconnect for unexpected disconnects

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/electron/tunnelManager.ts`
- Modify: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Add failing runtime assertions for reconnect policy**

Assert source contains:
- retry attempt counter/state
- retry delay schedule of 3s / 5s / 10s
- guard to skip reconnect on user-requested disconnects

- [ ] **Step 2: Run runtime regression test to verify RED**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL on reconnect assertions.

- [ ] **Step 3: Implement reconnect orchestration in `main.ts`**

Behavior:
- only trigger on unexpected tunnel failure
- reuse last successful config
- retry 3 times with delays 3000 / 5000 / 10000 ms
- log every scheduled attempt and final exhaustion

- [ ] **Step 4: Ensure reconnect status is broadcast to renderer/tray**

Use existing status broadcast path plus diagnostics entries so UI stays consistent.

- [ ] **Step 5: Update renderer messaging in `App.tsx`**

Show concise user-facing notices like:
- `????????????1/3?`
- `????????????`
Avoid duplicate toasts on every poll tick.

- [ ] **Step 6: Run runtime regression and targeted desktop tests**

Run:
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: reconnect-related assertions PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/electron/tunnelManager.ts apps/desktop/src/App.tsx apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: auto reconnect unexpected tunnel drops"
```

## Task 5: Build the diagnostics page and connect it to runtime logs

**Files:**
- Create: `apps/desktop/src/pages/DiagnosticsPage.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/pages/LocalWorkspacePage.tsx`
- Modify: `apps/desktop/src/styles/index.css`
- Modify: `apps/desktop/src/types/app.ts`
- Test: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Add failing API assertions for `DiagnosticsPage` and diagnostics navigation**

Cover:
- new renderer page import/reference
- copy/clear actions
- diagnostics list rendering hooks

- [ ] **Step 2: Run API regression test to verify RED**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL on diagnostics page assertions.

- [ ] **Step 3: Add a new app view entry for diagnostics**

Update `src/types/app.ts` and route state in `App.tsx`.

- [ ] **Step 4: Implement `DiagnosticsPage.tsx`**

Include:
- status summary card
- recent events list
- clear log button
- copy diagnostics button
- back button to workspace

- [ ] **Step 5: Add entry points from workspace and tray-aware app flow**

Expose `????` from the workspace and allow the app shell to navigate there cleanly.

- [ ] **Step 6: Add diagnostics page styling**

Keep visual language aligned with current light glass desktop style.

- [ ] **Step 7: Run API regression and full desktop tests**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: diagnostics page assertions PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/pages/DiagnosticsPage.tsx apps/desktop/src/App.tsx apps/desktop/src/pages/LocalWorkspacePage.tsx apps/desktop/src/styles/index.css apps/desktop/src/types/app.ts apps/desktop/test/api-regression.test.mjs
git commit -m "feat: add diagnostics page for tunnel troubleshooting"
```

## Task 6: Add import preview and duplicate handling before append import

**Files:**
- Modify: `apps/desktop/src/lib/localProfileService.ts`
- Modify: `apps/desktop/electron/main.ts` or `apps/desktop/electron/ipc/localProfileHandlers.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/src/lib/localProfileClient.ts`
- Create: `apps/desktop/src/components/ImportPreviewDialog.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Add failing API assertions for import preview flow and duplicate summaries**

Assert that source contains an import preview dialog and duplicate-count/result handling.

- [ ] **Step 2: Run API regression test to verify RED**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL on import preview assertions.

- [ ] **Step 3: Add duplicate analysis helper in `localProfileService.ts`**

Compute preview stats using append-import semantics without mutating stored data.
Recommended duplicate key:
- `serverIp`
- `sshPort`
- `sshUsername`
- `openclawToken`

- [ ] **Step 4: Add IPC/bridge methods for import preview**

Expose preview first, import confirm second.
Do not remove the existing encrypted file selection flow.

- [ ] **Step 5: Build `ImportPreviewDialog.tsx`**

Show:
- total items in backup
- new items count
- duplicate/skipped count
- a compact list of duplicates to be skipped
- confirm/cancel actions

- [ ] **Step 6: Wire `App.tsx` import flow to preview before committing import**

Sequence:
- ask backup password
- parse file / preview entries
- show preview dialog
- only then execute append import

- [ ] **Step 7: Run API regression and full desktop tests**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: import preview assertions PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/lib/localProfileService.ts apps/desktop/electron/main.ts apps/desktop/electron/preload.ts apps/desktop/src/types/bridge.ts apps/desktop/src/lib/localProfileClient.ts apps/desktop/src/components/ImportPreviewDialog.tsx apps/desktop/src/App.tsx apps/desktop/test/api-regression.test.mjs
git commit -m "feat: preview backup imports and skip duplicates"
```

## Task 7: Strengthen connect-time validation and preflight checks

**Files:**
- Modify: `apps/desktop/src/lib/serverConfigValidation.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/electron/tunnelManager.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/src/lib/tunnelClient.ts`
- Modify: `apps/desktop/src/pages/ServerEditorPage.tsx`
- Test: `apps/desktop/test/api-regression.test.mjs`
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Add failing tests for stronger static and runtime validation**

Cover assertions for:
- token/url format checks
- local port occupancy checks
- SSH reachability/preflight APIs
- clearer editor validation feedback

- [ ] **Step 2: Run both regression suites to verify RED**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL on validation/preflight assertions.

- [ ] **Step 3: Expand static validation rules in `serverConfigValidation.ts`**

Add minimal, user-friendly validation for:
- required fields
- SSH port range
- server IP / host basic format
- token non-empty and rough pattern sanity

- [ ] **Step 4: Add main-process preflight checks**

Implement lightweight checks for:
- local `127.0.0.1:18789` occupancy
- SSH TCP reachability to configured host/port
Return structured reasons instead of opaque errors.

- [ ] **Step 5: Expose and use preflight bridge helpers from renderer**

Run preflight before real connect and surface clear messages in editor/connection flows.

- [ ] **Step 6: Update editor UI to show validation and preflight results cleanly**

Keep messages short and customer-friendly.

- [ ] **Step 7: Run both regression suites plus full desktop tests**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/src/lib/serverConfigValidation.ts apps/desktop/electron/main.ts apps/desktop/electron/tunnelManager.ts apps/desktop/electron/preload.ts apps/desktop/src/types/bridge.ts apps/desktop/src/lib/tunnelClient.ts apps/desktop/src/pages/ServerEditorPage.tsx apps/desktop/test/api-regression.test.mjs apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: add stronger connection validation and preflight checks"
```

## Task 8: Split settings into a dedicated multi-section settings page

**Files:**
- Create: `apps/desktop/src/pages/SettingsPage.tsx`
- Modify: `apps/desktop/src/pages/AboutPage.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/types/app.ts`
- Modify: `apps/desktop/src/pages/LocalWorkspacePage.tsx`
- Modify: `apps/desktop/src/styles/index.css`
- Test: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Add failing API assertions for split settings sections**

Assert the presence of sections for:
- ????
- ????
- ????
- ????

- [ ] **Step 2: Run API regression test to verify RED**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL on settings split assertions.

- [ ] **Step 3: Create `SettingsPage.tsx` and move current about/autostart content into it**

Keep About as a subsection or fold it into the new settings page.

- [ ] **Step 4: Update app routing and workspace entry point**

Replace the current single ???? route/button with ???? that lands in the new settings shell.

- [ ] **Step 5: Add styling for settings navigation and subsections**

Use the same glass desktop look without introducing mobile/web-app patterns.

- [ ] **Step 6: Run API regression and full desktop tests**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: settings split assertions PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/pages/SettingsPage.tsx apps/desktop/src/pages/AboutPage.tsx apps/desktop/src/App.tsx apps/desktop/src/types/app.ts apps/desktop/src/pages/LocalWorkspacePage.tsx apps/desktop/src/styles/index.css apps/desktop/test/api-regression.test.mjs
git commit -m "feat: split desktop settings into dedicated sections"
```

## Task 9: Expand tray shortcuts for customer support workflows

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/App.tsx` (only if extra event routing is needed)
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Add failing runtime assertions for expanded tray menu content**

Assert tray menu includes:
- ?????
- ???? OpenClaw
- ????
- ????
- ????
- ????
- ????

- [ ] **Step 2: Run runtime regression test to verify RED**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL on the new tray assertions.

- [ ] **Step 3: Implement tray actions for diagnostics/settings navigation**

Reuse the main window and renderer routing; do not create extra windows.

- [ ] **Step 4: Keep tray labels centered on the active server name and current status**

Avoid exposing raw IPs unless server name is missing.

- [ ] **Step 5: Run runtime regression and full desktop tests**

Run:
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: tray assertions PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/src/App.tsx apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: expand tray actions for support workflows"
```

## Task 10: Full verification and packaged build

**Files:**
- No new feature files expected beyond prior tasks

- [ ] **Step 1: Run the full desktop test suite**

Run: `npm test -w @openclaw/desktop`
Expected: PASS with 0 failures.

- [ ] **Step 2: Run production build**

Run: `npm run build -w @openclaw/desktop`
Expected: PASS.

- [ ] **Step 3: Build the installer**

Run: `npm run dist -w @openclaw/desktop`
Expected: PASS and produce a fresh installer in `apps/desktop/release/`.

- [ ] **Step 4: Verify the installer output exists**

Check for a file like:
- `apps/desktop/release/OpenClaw Connector Setup 0.1.0.exe`

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/electron/tunnelManager.ts apps/desktop/electron/preload.ts apps/desktop/src/types/bridge.ts apps/desktop/src/App.tsx apps/desktop/src/pages/SettingsPage.tsx apps/desktop/src/pages/DiagnosticsPage.tsx apps/desktop/src/components/ImportPreviewDialog.tsx apps/desktop/src/pages/AboutPage.tsx apps/desktop/src/pages/LocalWorkspacePage.tsx apps/desktop/src/styles/index.css apps/desktop/src/lib/localProfileService.ts apps/desktop/src/lib/localProfileClient.ts apps/desktop/src/lib/tunnelClient.ts apps/desktop/src/lib/serverConfigValidation.ts apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs docs/superpowers/plans/2026-04-08-desktop-stability-usability-phase2.md
git commit -m "feat: deliver desktop stability and usability phase2"
```
