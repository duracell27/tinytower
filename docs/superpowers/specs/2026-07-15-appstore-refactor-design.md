# App Store Compliance + Code Quality Refactor

**Date:** 2026-07-15  
**Scope:** Apple App Store blockers + code quality cleanup (Option B)

---

## 1. Apple App Store Compliance

### 1a. App Transport Security (`app.json`)
- **Remove** `NSAllowsArbitraryLoads: true` — disables ATS; Apple will reject without justification
- **Keep** `NSAllowsLocalNetworking: true` — needed for dev builds
- **Add** `buildNumber: "1"` under `expo.ios` — required for Xcode release build

### 1b. Privacy / Terms links (`WelcomeScreen.tsx`)
- Current: Terms and Privacy appear as plain `Text` — not tappable
- Fix: Wrap each `termsUnderline` span in a `Pressable` with `Linking.openURL('https://TODO/...')`
- Placeholder URLs to be replaced before App Store submission

---

## 2. devAddGems Production Gate (`game.tsx`)

- Current: `onDevAddGems={() => devAddGems(100)}` is always passed to `TopBar` — long-press on gem badge gives +100 gems in production
- Fix: `onDevAddGems={__DEV__ ? () => devAddGems(100) : undefined}` — Metro strips the `__DEV__` branch in release builds

---

## 3. Number Formatting Consolidation

- **Remove** local `formatCoins` from `game.tsx`
- **Remove** local `formatNumber` from `WelcomeScreen.tsx`
- **Import** `formatNum` from `src/utils/format.ts` in both files
- Result: consistent apostrophe format (`1'234`) everywhere — profile, QA bar, top bar, welcome screen all show the same balance the same way

---

## 4. Dead Styles Cleanup (`TopBar.tsx`)

- Remove `coinIcon` and `gemIcon` entries from `StyleSheet.create` — both were left over from before `CoinIcon`/`GemIcon` components were introduced and are never referenced

---

## 5. i18n Cleanup (`profile.tsx` + `tabs.json`)

### New keys to add to `tabs.json` under `profile`:
```json
"achievements": "Achievements ({{count}})",
"sync": {
  "pendingDetail_one": "Pending sync · {{count}} command",
  "pendingDetail_other": "Pending sync · {{count}} commands",
  "failedCount_one": "Failed commands · {{count}}",
  "failedCount_other": "Failed commands · {{count}}",
  "copy": "Copy",
  "copied": "Copied!",
  "clear": "Clear"
}
```

### `profile.tsx` changes:
- `'Achievements ({totalEarnedLevels})'` → `t('profile.achievements', { count: totalEarnedLevels })`
- Pending sync header → `t('profile.sync.pendingDetail', { count: commandQueueLength })`
- Failed commands header → `t('profile.sync.failedCount', { count: failedCommandLog.length })`
- `copied ? 'Copied!' : 'Copy'` → `copied ? t('profile.sync.copied') : t('profile.sync.copy')`
- `'Clear'` → `t('profile.sync.clear')`
- **Merge** `formatAgo` into `formatSyncTime`: both do relative-time formatting; `formatAgo` uses hardcoded strings that duplicate `common:relativeTime.*` keys already in `common.json`. Unified function: use `i18n.t('common:relativeTime.*')` for both "last sync" and "command timestamp" displays

---

## 6. Type Safety (`gameStore.ts`)

- Extend `hydrate` parameter type to include optional legacy/UI fields:
  ```ts
  achievementQueue?: NewAchievementGrant[]
  coinBonusPercent?: number
  xpBonusPercent?: number
  categoryProgress?: Record<string, CategoryProgressState>
  dailyTipsRewardClaimed?: boolean  // old field name — backwards compat
  ```
- Remove all `(state as any)` casts in `hydrate()` body

---

## Files Changed

| File | Change |
|---|---|
| `app.json` | ATS fix, buildNumber |
| `src/screens/WelcomeScreen.tsx` | Tappable links, remove formatNumber |
| `app/(tabs)/game.tsx` | __DEV__ gate, remove formatCoins |
| `src/components/TopBar.tsx` | Remove dead styles |
| `src/i18n/locales/en/tabs.json` | New keys for profile sync section |
| `app/(tabs)/profile.tsx` | i18n replacements, formatAgo merge |
| `src/stores/gameStore.ts` | hydrate type, remove (state as any) |

---

## Out of Scope

- Bundle ID change (`com.duracell27.tinytower-init` → production name) — requires Expo prebuild re-run; noted for manual action before App Store submission
- Real Terms/Privacy URLs — placeholders only
- Leaderboard avatar for non-level tabs — by design (other players' levels are not in the API response)
