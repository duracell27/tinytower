# GlobalOverlay Design

**Date:** 2026-07-29  
**Status:** Approved

## Problem

`NativeTabs` keeps all tab screens mounted simultaneously. When a `<Modal visible={true}>` lives in a tab that is not in the foreground, React Native still processes its `visible` state — meaning the modal can block all touch input without being visible on screen. This caused the AchievementModal to block the UI silently when the user navigated away mid-trigger.

Additionally, 8 modal definitions are scattered across 7 different files, making every new screen a risk of missing coverage.

## Solution

A single `GlobalOverlay` component rendered in `app/_layout.tsx` directly after `<Stack>`, above all navigation. All notification modals are moved here so they are always rendered in exactly one place, guaranteed to appear above all screens.

## Architecture

```
GestureHandlerRootView
├── <Stack>              ← all screens and tabs
└── <GlobalOverlay>      ← always above everything
      ├── AchievementModal
      ├── LevelUpModal
      ├── ReferralNotificationModal
      ├── DailyLoginRewardModal
      ├── InsufficientResourcesModal
      ├── TokenInsufficientModal
      ├── TaskRewardModal
      └── DeliverAllModal
```

`GlobalOverlay` uses `StyleSheet.absoluteFill` with `pointerEvents="box-none"` so it does not intercept touches when no modal is visible. Each child modal renders its own scrim + card and manages its own animation.

## New Files

| File | Purpose |
|---|---|
| `src/components/GlobalOverlay.tsx` | Thin host — renders all 8 modals together |
| `src/components/TokenInsufficientModal.tsx` | Extracted from `my-business/[category].tsx`; reads from store |
| `src/components/TaskRewardModal.tsx` | Extracted from `daily-tasks.tsx`; reads from store |

`DeliverAllModal` already exists as a standalone component — no new file needed, just connect to store.

## Store Changes (gameStore.ts)

Three new pieces of `UIState`:

```ts
tokenInsufficient: { floorType: 'green'|'blue'|'yellow'|'purple'|'red'; have: number; need: number } | null
pendingTaskReward: {
  taskTitle: string; coins: number; gems: number;
  tokenCount: number; tokenColor: string;
  matCount?: number; materialType?: string;
} | null
pendingDeliverAll: DeliverAllSummary | null
```

New actions:
- `showTokenInsufficient(payload)` / `clearTokenInsufficient()`
- `setTaskReward(payload)` / `clearTaskReward()`
- `setPendingDeliverAll(summary)` / `clearPendingDeliverAll()`

### Behaviour changes

**`claimDailyTask`** — currently returns `{ coins, gems, ... }`. Change to return `void`; instead call `set({ pendingTaskReward: { taskTitle, coins, gems, tokenCount, tokenColor, matCount, materialType } })`. Callers in `daily-tasks.tsx` that do `const result = claimDailyTask(...)` and then `setReward(result)` are updated to just call `claimDailyTask(taskKey)`.

**`deliverAll`** — after executing the command, compute `DeliverAllSummary` using the state at the point of calling (same logic as current `computeDeliverAllSummary` in `LobbyPanel.tsx`), then call `set({ pendingDeliverAll: summary })`.

**`my-business/[category].tsx`** — replace `setTokenModal({ have, need })` with `showTokenInsufficient({ floorType: ft, have, need })`. The `floorType` is needed so the modal can show the correct token icon.

## Component Changes

### Components removed from existing files

| File | Removed |
|---|---|
| `app/(tabs)/game.tsx` | `<LevelUpModal>`, `<AchievementModal>`, `<ReferralNotificationModal>`, `<InsufficientResourcesModal>` and their imports |
| `src/components/WorkersPanel.tsx` | `<InsufficientResourcesModal asOverlay />` and its import |
| `src/components/HotelPanel.tsx` | `<InsufficientResourcesModal asOverlay />` and its import |
| `src/components/LobbyPanel.tsx` | `<DeliverAllModal>`, local state `deliverSummary`, `computeDeliverAllSummary` function and related imports |
| `app/my-business/[category].tsx` | inline token modal JSX + local state `tokenModal` + animations; `<InsufficientResourcesModal asOverlay />` |
| `app/daily-tasks.tsx` | `TaskRewardModal` component definition, local state `reward`, `setReward` call |
| `app/_layout.tsx` | `<DailyLoginRewardModal />` and its import |

### Prop removals

- `LevelUpModal`: remove `suppressWhileOpen` prop entirely (GlobalOverlay always renders above all screens, so no suppression is needed)
- `InsufficientResourcesModal`: remove `asOverlay` prop entirely (same reason)

## TokenInsufficientModal (new component)

Reads `tokenInsufficient` from store. Shows which floor-type token is short, with `have` / `need` values. Uses the same animation pattern (spring scale + opacity) as the current inline version in `[category].tsx`. Dismiss calls `clearTokenInsufficient()`.

## TaskRewardModal (moved component)

Reads `pendingTaskReward` from store. Same animation as the current version in `daily-tasks.tsx` (spring card scale + delayed rewards fade-in). Dismiss calls `clearTaskReward()`. The `taskTitle` field is required so the modal can display it without needing access to `DAILY_TASKS` config.

## DeliverAllModal (wired to store)

No JSX changes. Add `visible={pendingDeliverAll !== null}` and `summary={pendingDeliverAll}` using store selectors, and `onDismiss={() => clearPendingDeliverAll()}`.

## DailyLoginRewardModal

No changes to the component itself — just moved from `_layout.tsx` into `GlobalOverlay.tsx`.

## Error Handling / Edge Cases

- If `deliverAll` is called with no visitors in lobby, `summary` will have all-zero counts. `DeliverAllModal` already handles this (it shows the divider and total row which will be empty). No special case needed.
- `claimDailyTask` now returns `void`; if `taskConfig` is not found it simply does nothing (already returned `null`, callers checked for null but never used it beyond setting local state).
- `tokenInsufficient.floorType` field: `TokenInsufficientModal` uses it to look up the correct icon from a local `TOKEN_ICONS` map — same map already exists in `[category].tsx`.

## Files NOT touched

- `src/components/AchievementModal.tsx` — no changes to the component; only its render location moves
- `src/components/LevelUpModal.tsx` — remove `suppressWhileOpen` prop, no other changes
- `src/components/ReferralNotificationModal.tsx` — no changes
- `src/components/DailyLoginRewardModal.tsx` — no changes
- All server files — no changes needed
