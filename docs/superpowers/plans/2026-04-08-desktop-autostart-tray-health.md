# Desktop Autostart, Tray Shortcuts, and Tunnel Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer-facing autostart, richer tray shortcuts, and reliable connection health synchronization so the Windows desktop app behaves like a polished always-on connector.

**Architecture:** Extend the Electron main process to own three new responsibilities: app startup registration, richer tray command routing, and active tunnel health monitoring with renderer broadcasts. Keep renderer changes focused on preferences/state plumbing and lightweight UI entry points, reusing the existing bridge/event model added for tray disconnect synchronization.

**Tech Stack:** Electron main/preload IPC, React renderer, existing local profile persistence, Node timers/process inspection, Node test runner, Vite, tsup.

---

## File Map

- Modify: `apps/desktop/electron/main.ts`
  - Add startup registration IPC handlers
  - Add tray actions for connect current / reconnect / open OpenClaw
  - Add tunnel-health polling lifecycle + status broadcasts
- Modify: `apps/desktop/electron/tunnelManager.ts`
  - Expose lightweight health-check helpers for current tunnel/process state
- Modify: `apps/desktop/electron/preload.ts`
  - Bridge autostart getters/setters and extra tray-capable commands into renderer
- Modify: `apps/desktop/src/types/bridge.ts`
  - Type the new autostart/settings/tunnel command contracts
- Modify: `apps/desktop/src/lib/tunnelClient.ts`
  - Add wrappers for reconnect / connect-current support if exposed through bridge
- Modify: `apps/desktop/src/state/authStore.ts`
  - Persist local app preference for autostart toggle and last connected server metadata if needed
- Modify: `apps/desktop/src/App.tsx`
  - Load/store the autostart preference
  - React to new health states/reconnect-capable tray events if needed
- Modify: `apps/desktop/src/pages/AboutPage.tsx` or create `apps/desktop/src/pages/SettingsPage.tsx`
  - Surface the customer-facing autostart toggle in an existing lightweight settings surface
- Modify: `apps/desktop/test/runtime-regression.test.mjs`
  - Cover main-process autostart/tray/health-monitor behavior by source assertions
- Modify: `apps/desktop/test/api-regression.test.mjs`
  - Cover renderer bridge/types/UI exposure for the new preferences and commands

## Task 1: Add failing regression tests for autostart bridge and tray shortcuts

**Files:**
- Modify: `apps/desktop/test/runtime-regression.test.mjs`
- Modify: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Write the failing runtime test for autostart and tray shortcuts**

Add assertions that `main.ts` contains:
- an autostart getter/setter IPC pair
- tray entries for connect-current / reconnect / open OpenClaw
- tunnel health-monitor scheduling/broadcast hooks

- [ ] **Step 2: Run runtime regression test to verify it fails**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: FAIL because the new autostart/tray/health logic is not implemented yet.

- [ ] **Step 3: Write the failing API/UI test for preference exposure**

Add assertions that:
- `bridge.ts` types autostart preference APIs
- `preload.ts` exposes them
- renderer source references the autostart toggle UI/control

- [ ] **Step 4: Run API regression test to verify it fails**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL because the new bridge and UI are not implemented yet.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs
git commit -m "test: cover autostart tray health requirements"
```

## Task 2: Implement autostart preference and bridge contract

**Files:**
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/state/authStore.ts`

- [ ] **Step 1: Extend bridge types with autostart settings contract**

Add a typed contract for:
- `getAutostartEnabled(): Promise<boolean>`
- `setAutostartEnabled(enabled: boolean): Promise<{ enabled: boolean }>`

- [ ] **Step 2: Run API regression test to confirm the new type expectation still fails**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: FAIL because preload/main/UI are still missing.

- [ ] **Step 3: Implement preload bridge methods**

Expose the autostart IPC methods in `preload.ts` using the existing bridge structure.

- [ ] **Step 4: Implement main-process autostart handlers**

In `main.ts`:
- read the current setting via Electron app login-item API on Windows
- write updates via the same API
- return normalized enabled state to renderer

- [ ] **Step 5: Persist local preference for UI bootstrapping**

Add local preference storage for autostart toggle state only if the renderer needs cached startup UX; otherwise keep persistence source-of-truth in Electron and remove redundant caching.

- [ ] **Step 6: Run both regression suites**

Run:
- `node --test '.\apps\desktop\test\api-regression.test.mjs'`
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: autostart assertions pass; tray/health assertions still fail.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/types/bridge.ts apps/desktop/electron/preload.ts apps/desktop/electron/main.ts apps/desktop/src/state/authStore.ts apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs
git commit -m "feat: add desktop autostart bridge"
```

## Task 3: Add customer-facing autostart toggle UI

**Files:**
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/pages/AboutPage.tsx` or create `apps/desktop/src/pages/SettingsPage.tsx`
- Test: `apps/desktop/test/api-regression.test.mjs`

- [ ] **Step 1: Decide the smallest UI surface**

Use the current lightweight product shape:
- preferred: add a small ?????? section in `AboutPage.tsx`
- only create `SettingsPage.tsx` if About becomes overloaded

- [ ] **Step 2: Implement renderer loading/saving flow**

On app boot or when opening the page:
- fetch current autostart state from the bridge
- show loading-safe default
- save immediately on toggle change with success/error feedback toast

- [ ] **Step 3: Run API regression test**

Run: `node --test '.\apps\desktop\test\api-regression.test.mjs'`
Expected: PASS for autostart UI exposure.

- [ ] **Step 4: Smoke-check build**

Run: `npm run build -w @openclaw/desktop`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/App.tsx apps/desktop/src/pages/AboutPage.tsx apps/desktop/test/api-regression.test.mjs
git commit -m "feat: add autostart settings UI"
```

## Task 4: Add richer tray commands for zero-window workflows

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/electron/preload.ts` (only if renderer-triggered commands are needed)
- Modify: `apps/desktop/src/App.tsx` (only if state snapshots need extra metadata)
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Implement tray menu labels and enable/disable states**

Add tray items for:
- `???????`
- `????`
- `?? OpenClaw`
- existing `????`

Rules:
- connect-current enabled when a known default/last-selected server exists and tunnel is disconnected
- reconnect enabled when a previously connected server exists
- open OpenClaw enabled when tunnel is connected and token is known

- [ ] **Step 2: Decide source of ?current server? metadata**

Use the tunnel snapshot plus locally remembered last-selected/last-connected server info; do not introduce cloud/stateful complexity.

- [ ] **Step 3: Implement minimal action handlers**

In `main.ts`, wire tray actions to existing tunnel operations and `shell.openExternal` helpers without forcing renderer involvement where unnecessary.

- [ ] **Step 4: Broadcast resulting state changes**

After each tray-triggered action, call the shared status-broadcast path so renderer and tray stay consistent.

- [ ] **Step 5: Run runtime regression test**

Run: `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
Expected: tray shortcut assertions pass; health-monitor assertions may still fail.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/src/types/bridge.ts apps/desktop/electron/preload.ts apps/desktop/src/App.tsx apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: expand tray quick actions"
```

## Task 5: Add tunnel health monitoring and automatic status correction

**Files:**
- Modify: `apps/desktop/electron/tunnelManager.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/src/types/bridge.ts`
- Modify: `apps/desktop/src/App.tsx`
- Test: `apps/desktop/test/runtime-regression.test.mjs`

- [ ] **Step 1: Define a lightweight health contract**

Expose from `TunnelManager` a method such as:
- `checkHealth(): Promise<TunnelStateSnapshot>` or
- `isTunnelAlive(): Promise<boolean>` plus current snapshot access

The check should be cheap and based on the actual active adapter/process/port state.

- [ ] **Step 2: Implement health polling in main process**

In `main.ts`:
- start polling only when a tunnel becomes connected
- stop polling on disconnect/quit
- when health check fails, transition to disconnected/error and broadcast immediately

- [ ] **Step 3: Update renderer handling**

Ensure the existing `subscribeTunnelStatus` path updates:
- current status
- active/busy server ids
- user-facing toast only when appropriate (avoid noisy repeated alerts)

- [ ] **Step 4: Add one clear user-facing recovery behavior**

Minimal recommendation:
- if connection drops unexpectedly, show a single toast like ?????????????
- do not auto-reconnect in this task unless it becomes trivial and testable

- [ ] **Step 5: Run runtime regression and full desktop test suite**

Run:
- `node --test '.\apps\desktop\test\runtime-regression.test.mjs'`
- `npm test -w @openclaw/desktop`
Expected: PASS.

- [ ] **Step 6: Run desktop production build**

Run: `npm run build -w @openclaw/desktop`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/tunnelManager.ts apps/desktop/electron/main.ts apps/desktop/src/types/bridge.ts apps/desktop/src/App.tsx apps/desktop/test/runtime-regression.test.mjs
git commit -m "feat: monitor tunnel health and sync disconnect state"
```

## Task 6: Final packaging verification

**Files:**
- No new source files expected

- [ ] **Step 1: Run full desktop test suite again**

Run: `npm test -w @openclaw/desktop`
Expected: PASS with 0 failures.

- [ ] **Step 2: Build packaged app**

Run: `npm run dist -w @openclaw/desktop`
Expected: PASS and generate a new installer in `apps/desktop/release/`.

- [ ] **Step 3: Sanity-check the installer output path**

Verify the latest file exists, for example:
- `apps/desktop/release/OpenClaw Connector Setup 0.1.0.exe`

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/electron/tunnelManager.ts apps/desktop/electron/preload.ts apps/desktop/src/types/bridge.ts apps/desktop/src/App.tsx apps/desktop/src/pages/AboutPage.tsx apps/desktop/test/runtime-regression.test.mjs apps/desktop/test/api-regression.test.mjs docs/superpowers/plans/2026-04-08-desktop-autostart-tray-health.md
git commit -m "feat: add autostart tray shortcuts and health monitoring"
```
