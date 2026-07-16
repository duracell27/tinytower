# App Store Compliance + Code Quality Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all Apple App Store blockers and eliminate code duplication / hardcoded strings across 7 files.

**Architecture:** Pure edits — no new files, no new dependencies. Each task is self-contained and can be committed independently. Tasks 1–4 are independent of each other and of tasks 5–6. Task 5 (i18n) must come before its call-site changes in profile.tsx (both are in Task 5). Task 6 (gameStore types) is independent.

**Tech Stack:** Expo 56, React Native 0.85, TypeScript, i18next, Zustand 5

## Global Constraints

- Do NOT add new npm packages
- Do NOT restructure files; edit only the listed locations
- Thousands separator in `formatNum` is apostrophe `'` — do not change it
- Placeholder URLs in WelcomeScreen are `https://TODO/terms` and `https://TODO/privacy` — leave exactly as written
- `__DEV__` is a Metro/React Native global — no import needed

---

### Task 1: app.json — Remove ATS bypass, add buildNumber

**Files:**
- Modify: `app.json`

**Interfaces:**
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Apply the change**

Open `app.json`. Find the `"ios"` object. Make two edits:

1. Add `"buildNumber": "1"` right after `"bundleIdentifier"`:
```json
"bundleIdentifier": "com.duracell27.tinytower-init",
"buildNumber": "1",
```

2. Inside `"infoPlist" > "NSAppTransportSecurity"`, remove the `"NSAllowsArbitraryLoads": true` line entirely. The result should be:
```json
"NSAppTransportSecurity": {
  "NSAllowsLocalNetworking": true
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "require('./app.json'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "fix(ios): remove NSAllowsArbitraryLoads, add buildNumber"
```

---

### Task 2: WelcomeScreen — tappable links + remove formatNumber

**Files:**
- Modify: `src/screens/WelcomeScreen.tsx`

**Interfaces:**
- Consumes: `formatNum` from `src/utils/format.ts` (already exists, no change needed)
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Remove the local `formatNumber` function and replace with import**

At the top of the file, after the existing imports, add:
```tsx
import { formatNum } from '../utils/format';
```

Then delete the entire `formatNumber` function (lines 29–39 in the current file):
```tsx
// DELETE THIS:
function formatNumber(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}
```

- [ ] **Step 2: Replace all `formatNumber(...)` call sites**

In the JSX there are 3 usages — `{formatNumber(balance)}`, `{gems}` (already number), and `{floorCount}`. Only `balance` uses `formatNumber`. Replace:

```tsx
// Before:
<Text style={styles.chipValue}>{formatNumber(balance)}</Text>
// (there's one of these for the coin chip)

// After:
<Text style={styles.chipValue}>{formatNum(balance)}</Text>
```

- [ ] **Step 3: Make Terms and Privacy links tappable**

`Linking` is already imported. Find the `termsText` block and replace the two inner `Text` spans that show Terms and Privacy:

```tsx
// Before:
<Text style={styles.termsText}>
  {t('welcome.terms.continuingText')}
  <Text style={styles.termsUnderline}>{t('welcome.terms.terms')}</Text>
  {t('welcome.terms.and')}
  <Text style={styles.termsUnderline}>{t('welcome.terms.policy')}</Text>
</Text>

// After:
<Text style={styles.termsText}>
  {t('welcome.terms.continuingText')}
  <Text
    style={styles.termsUnderline}
    onPress={() => Linking.openURL('https://TODO/terms')}
  >
    {t('welcome.terms.terms')}
  </Text>
  {t('welcome.terms.and')}
  <Text
    style={styles.termsUnderline}
    onPress={() => Linking.openURL('https://TODO/privacy')}
  >
    {t('welcome.terms.policy')}
  </Text>
</Text>
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep WelcomeScreen
```
Expected: no output (no errors in this file)

- [ ] **Step 5: Commit**

```bash
git add src/screens/WelcomeScreen.tsx
git commit -m "fix(welcome): tappable terms/privacy links, use shared formatNum"
```

---

### Task 3: game.tsx — devAddGems gate + remove formatCoins

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `formatNum` from `src/utils/format.ts`
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Add `formatNum` import**

At the top of `app/(tabs)/game.tsx`, add:
```tsx
import { formatNum } from '../../src/utils/format';
```

- [ ] **Step 2: Delete the local `formatCoins` function**

Find and delete (approximately lines 51–61):
```tsx
// DELETE THIS:
function formatCoins(n: number): string {
  if (n >= 1000) {
    const str = String(n);
    const parts: string[] = [];
    for (let i = str.length; i > 0; i -= 3) {
      parts.unshift(str.slice(Math.max(0, i - 3), i));
    }
    return parts.join(' ');
  }
  return String(n);
}
```

- [ ] **Step 3: Replace `formatCoins` call site**

In the `TopBar` usage (near bottom of JSX), change:
```tsx
// Before:
coins={formatCoins(balance)}

// After:
coins={formatNum(balance)}
```

- [ ] **Step 4: Gate devAddGems behind `__DEV__`**

In the same `TopBar` usage, change:
```tsx
// Before:
onDevAddGems={() => devAddGems(100)}

// After:
onDevAddGems={__DEV__ ? () => devAddGems(100) : undefined}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep "tabs/game"
```
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/game.tsx"
git commit -m "fix(game): gate devAddGems behind __DEV__, use shared formatNum"
```

---

### Task 4: TopBar — remove dead styles

**Files:**
- Modify: `src/components/TopBar.tsx`

**Interfaces:**
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Delete the `coinIcon` style block**

In the `StyleSheet.create({...})` at the bottom, find and delete:
```ts
// DELETE THIS:
coinIcon: {
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#F2B330',
  borderWidth: 2,
  borderColor: 'rgba(255,255,255,0.55)',
  shadowColor: 'rgba(180,130,30,1)',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.3,
  shadowRadius: 2,
},
```

- [ ] **Step 2: Delete the `gemIcon` style block**

In the same `StyleSheet.create({...})`, find and delete:
```ts
// DELETE THIS:
gemIcon: {
  width: 14,
  height: 14,
  backgroundColor: '#3FB8D6',
  borderRadius: 3,
  transform: [{ rotate: '45deg' }],
  borderWidth: 1.5,
  borderColor: 'rgba(255,255,255,0.6)',
},
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep TopBar
```
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "refactor(topbar): remove dead coinIcon and gemIcon styles"
```

---

### Task 5: i18n + profile.tsx — add translation keys, merge formatAgo

**Files:**
- Modify: `src/i18n/locales/en/tabs.json`
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Add new keys to `tabs.json`**

Open `src/i18n/locales/en/tabs.json`. Inside the `"profile"` object, add `"achievements"` and extend the `"sync"` sub-object:

```json
"profile": {
  "title": "Profile",
  "guestFallbackName": "Player",
  "achievements": "Achievements ({{count}})",
  "stats": {
    "level": "Level",
    "xp": "XP"
  },
  "sync": {
    "online": "You're online",
    "pending_one": "{{count}} command not synced",
    "pending_other": "{{count}} commands not synced",
    "critical": "{{count}} commands not synced · possible data loss",
    "pendingDetail_one": "Pending sync · {{count}} command",
    "pendingDetail_other": "Pending sync · {{count}} commands",
    "failedCount_one": "Failed commands · {{count}}",
    "failedCount_other": "Failed commands · {{count}}",
    "copy": "Copy",
    "copied": "Copied!",
    "clear": "Clear"
  },
  "logout": "Log Out"
},
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "require('./src/i18n/locales/en/tabs.json'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Delete `formatAgo` from `profile.tsx` and replace call sites**

In `app/(tabs)/profile.tsx`, find and delete the `formatAgo` function (approximately lines 96–102):
```tsx
// DELETE THIS:
function formatAgo(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}
```

Then replace every call to `formatAgo(...)` with `formatSyncTime(...)` — both functions take `(ts: number, now: number)` so the swap is a direct replacement. There are two call sites: one in `buildCopyText` and one in the JSX where failed log entries display their timestamp.

In `buildCopyText`:
```tsx
// Before:
lines.push(`  - ${commandLabel(entry.type)} → ${friendlyError(entry.error)} (${formatAgo(entry.timestamp, now)})`);

// After:
lines.push(`  - ${commandLabel(entry.type)} → ${friendlyError(entry.error)} (${formatSyncTime(entry.timestamp, now)})`);
```

In the JSX (failed log entry row):
```tsx
// Before:
<Text style={styles.dropRowTime}>{formatAgo(entry.timestamp, now)}</Text>

// After:
<Text style={styles.dropRowTime}>{formatSyncTime(entry.timestamp, now)}</Text>
```

- [ ] **Step 4: Replace hardcoded strings in profile.tsx with `t()` calls**

The `t` function is already imported via `useTranslation('tabs')` at the top of `ProfileScreen`.

**4a — Achievements button:**
```tsx
// Before:
<Text style={styles.achievementsButtonText}>
  Achievements ({totalEarnedLevels})
</Text>

// After:
<Text style={styles.achievementsButtonText}>
  {t('profile.achievements', { count: totalEarnedLevels })}
</Text>
```

**4b — Pending sync section header:**
```tsx
// Before:
<Text style={styles.dropSectionTitle}>
  Pending sync · {commandQueueLength} command{commandQueueLength !== 1 ? 's' : ''}
</Text>

// After:
<Text style={styles.dropSectionTitle}>
  {t('profile.sync.pendingDetail', { count: commandQueueLength })}
</Text>
```

**4c — Failed commands section header:**
```tsx
// Before:
<Text style={styles.dropSectionTitle}>
  Failed commands · {failedCommandLog.length}
</Text>

// After:
<Text style={styles.dropSectionTitle}>
  {t('profile.sync.failedCount', { count: failedCommandLog.length })}
</Text>
```

**4d — Copy button:**
```tsx
// Before:
<Text style={styles.dropActionText}>{copied ? 'Copied!' : 'Copy'}</Text>

// After:
<Text style={styles.dropActionText}>{copied ? t('profile.sync.copied') : t('profile.sync.copy')}</Text>
```

**4e — Clear button:**
```tsx
// Before:
<Text style={[styles.dropActionText, styles.dropActionTextDanger]}>Clear</Text>

// After:
<Text style={[styles.dropActionText, styles.dropActionTextDanger]}>{t('profile.sync.clear')}</Text>
```

- [ ] **Step 5: Run i18n key tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/i18n/__tests__ --no-coverage
```
Expected: all pass

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep -E "profile|tabs"
```
Expected: no output

- [ ] **Step 7: Commit**

```bash
git add src/i18n/locales/en/tabs.json "app/(tabs)/profile.tsx"
git commit -m "fix(profile): i18n all hardcoded strings, merge formatAgo into formatSyncTime"
```

---

### Task 6: gameStore — remove `(state as any)` casts

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces: nothing consumed by other tasks

- [ ] **Step 1: Extend the `hydrate` parameter type in `GameActions`**

In `src/stores/gameStore.ts`, find the `GameActions` interface and update the `hydrate` signature. Replace:

```ts
hydrate: (state: GameState & Partial<SyncState> & { playerLevel?: number; playerXp?: number }) => void;
```

With:
```ts
hydrate: (state: GameState & Partial<SyncState> & {
  playerLevel?: number;
  playerXp?: number;
  achievementQueue?: NewAchievementGrant[];
  coinBonusPercent?: number;
  xpBonusPercent?: number;
  categoryProgress?: Record<string, CategoryProgressState>;
  dailyTipsRewardClaimed?: boolean;
}) => void;
```

- [ ] **Step 2: Remove `(state as any)` casts in the `hydrate` implementation**

In the `hydrate` implementation body inside `create<GameStore>((set, get) => ({...}))`, replace each `(state as any)` cast:

```ts
// Before:
dailyTipsStage1Claimed: (state as any).dailyTipsStage1Claimed ?? (state as any).dailyTipsRewardClaimed ?? false,
dailyTipsStage2Claimed: (state as any).dailyTipsStage2Claimed ?? false,

// After:
dailyTipsStage1Claimed: state.dailyTipsStage1Claimed ?? state.dailyTipsRewardClaimed ?? false,
dailyTipsStage2Claimed: state.dailyTipsStage2Claimed ?? false,
```

```ts
// Before:
achievementQueue: (state as any).achievementQueue ?? [],
coinBonusPercent: (state as any).coinBonusPercent ?? 0,
xpBonusPercent: (state as any).xpBonusPercent ?? 0,
categoryProgress: (state as any).categoryProgress ?? {},

// After:
achievementQueue: state.achievementQueue ?? [],
coinBonusPercent: state.coinBonusPercent ?? 0,
xpBonusPercent: state.xpBonusPercent ?? 0,
categoryProgress: state.categoryProgress ?? {},
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | grep gameStore
```
Expected: no output

- [ ] **Step 4: Run store tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/stores/__tests__ --no-coverage
```
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "refactor(store): type hydrate params explicitly, remove (state as any) casts"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| Remove NSAllowsArbitraryLoads | Task 1 |
| Add buildNumber | Task 1 |
| Tappable Terms/Privacy links | Task 2 |
| Remove formatNumber (WelcomeScreen) | Task 2 |
| __DEV__ gate for devAddGems | Task 3 |
| Remove formatCoins (game.tsx) | Task 3 |
| Remove dead coinIcon/gemIcon styles | Task 4 |
| New i18n keys in tabs.json | Task 5 |
| profile.tsx hardcoded strings → t() | Task 5 |
| Merge formatAgo → formatSyncTime | Task 5 |
| hydrate type extension | Task 6 |
| Remove (state as any) casts | Task 6 |
