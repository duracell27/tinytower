# Animation Improvements Design

**Date:** 2026-07-15  
**Status:** Approved

## Problems

1. **QuickActionBar exit** — the bar slides in on QA mode entry but vanishes instantly on exit (no slide-out animation). Scroll position restoration is also an instant snap.
2. **Launch scroll jank** — on app open, the floor list renders at the top then JS-thread-animates down to lobby over 1.2 s, causing visible floor jitter.

## Library

`react-native-reanimated` v4.3.1 is already installed. No new dependency needed.

---

## Solution 1: QuickActionBar enter/exit animation

### Changes to `QuickActionBar`

- Remove old `Animated` import; use Reanimated `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withTiming`.
- Add props:
  - `visible: boolean` — controls enter/exit
  - `onHidden: () => void` — called after exit animation completes
- `useSharedValue(120)` — starts off-screen (below).
- `useEffect` on `visible`:
  - `true` → `withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 })`
  - `false` → `withTiming(120, { duration: 280, easing: Easing.in(Easing.quad) })`, then `runOnJS(onHidden)()`

### Changes to `game.tsx`

Add `qaBarVisible: boolean` state alongside `quickActionMode`.

Lifecycle:
- `quickActionMode` set → also `setQaBarVisible(true)`
- Exit pressed → `setQaBarVisible(false)` (bar plays exit anim, stays in tree)
- `onHidden` fires → `setQuickActionMode(null)` (bar removed from tree)
- Auto-exit (filtered floors empty) → `setQaBarVisible(false)`, animation fires, `onHidden` → `setQuickActionMode(null)`; guard `quickActionMode !== null` prevents re-entry

Render:
```
{(quickActionMode !== null || qaBarVisible) && (
  <QuickActionBar
    visible={qaBarVisible}
    onHidden={() => setQuickActionMode(null)}
    ...
  />
)}
```

This keeps the bar mounted during the ~280 ms exit animation.

---

## Solution 2: Launch scroll fade-in

### Goal

Eliminate visible floor jitter on app open. The user should see the tower column fade in already positioned at lobby — no scrolling animation visible.

### Changes to `game.tsx`

- Add Reanimated `useSharedValue(0)` for `towerOpacity`.
- Wrap `towerColumn` in `Animated.View` with `useAnimatedStyle` → `{ opacity: towerOpacity.value }`.
- Remove the existing mount animation (`mountAnimRef`, `Animated.Value` listener approach).
- In `onContentSizeChange`: when `lastSyncAt > 0` and opacity is still 0 (first reveal only):
  1. `listRef.current?.scrollToEnd({ animated: false })`
  2. `towerOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) })`
- Guard with a `hasRevealedRef = useRef(false)` so it only fires once.
- `mountAnimRef` and its cleanup `useEffect` are removed entirely.

### Why `lastSyncAt > 0`

Prevents revealing an empty list before game state loads. Once sync delivers data, the floor list populates and `onContentSizeChange` fires → reveal.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/QuickActionBar.tsx` | Migrate to Reanimated, add `visible` + `onHidden` props |
| `app/(tabs)/game.tsx` | Add `qaBarVisible` state, two-step QA exit, tower fade-in logic |

## Out of Scope

- QA mode enter/exit scroll position (currently instant snap to bottom/saved offset) — not part of this change
- Other panels (HotelPanel, LobbyPanel) — already use Reanimated correctly
