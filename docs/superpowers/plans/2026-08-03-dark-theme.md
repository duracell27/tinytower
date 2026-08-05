# Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the game's UI to the system dark mode — muting floor card colors via overlay and applying a semantic theme palette to the profile screen and TopBar.

**Architecture:** A central `useAppTheme()` hook reads `useColorScheme()` and returns semantic tokens (`surface`, `text`, `textMuted`, `divider`, etc.). FloorCard gets a semi-transparent dark overlay (`pointerEvents="none"`) that mutes pastel body colors without changing their hue. TopBar and ProfileScreen consume the hook tokens.

**Tech Stack:** React Native, `useColorScheme` (RN built-in), no new dependencies.

## Global Constraints

- No new npm packages
- Dark mode activates on system dark mode only (`useColorScheme() === 'dark'`)
- Hues of floor card colors must not change — only brightness/saturation is reduced via overlay
- Existing `AppBackground` already handles background image switching — do not modify it
- `StyleSheet.create` stays — no inline style objects for static values; theme tokens are passed as dynamic style props where needed

---

### Task 1: Create `useAppTheme` hook

**Files:**
- Create: `src/hooks/useAppTheme.ts`

**Interfaces:**
- Produces:
```ts
export interface AppTheme {
  isDark: boolean;
  surface: string;        // main card/button background
  surfaceSub: string;     // secondary surface (dropdown areas)
  surfaceDanger: string;  // red-tinted dropdown danger area
  text: string;           // primary text
  textMuted: string;      // secondary/label text
  divider: string;        // dividers and horizontal rules
  topBarBg: string;       // TopBar glass panel background
  topBarBorder: string;   // TopBar glass panel border
}
export function useAppTheme(): AppTheme
```

- [ ] **Step 1: Create the hook file**

```ts
// src/hooks/useAppTheme.ts
import { useColorScheme } from 'react-native';

export interface AppTheme {
  isDark: boolean;
  surface: string;
  surfaceSub: string;
  surfaceDanger: string;
  text: string;
  textMuted: string;
  divider: string;
  topBarBg: string;
  topBarBorder: string;
}

const LIGHT: AppTheme = {
  isDark: false,
  surface: '#ffffff',
  surfaceSub: '#F5F3EC',
  surfaceDanger: '#FEF1EE',
  text: '#27331F',
  textMuted: '#7C8A6E',
  divider: '#E4E1D3',
  topBarBg: 'rgba(238,248,230,0.80)',
  topBarBorder: 'rgba(255,255,255,0.70)',
};

const DARK: AppTheme = {
  isDark: true,
  surface: 'rgba(28,34,24,0.93)',
  surfaceSub: 'rgba(255,255,255,0.07)',
  surfaceDanger: 'rgba(220,50,30,0.15)',
  text: '#DDE8D8',
  textMuted: '#8A9A80',
  divider: 'rgba(255,255,255,0.10)',
  topBarBg: 'rgba(18,24,16,0.88)',
  topBarBorder: 'rgba(255,255,255,0.12)',
};

export function useAppTheme(): AppTheme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAppTheme.ts
git commit -m "feat(theme): add useAppTheme hook with semantic dark/light tokens"
```

---

### Task 2: Dark overlay on FloorCard

**Files:**
- Modify: `src/components/FloorCard.tsx`

**Interfaces:**
- Consumes: `useColorScheme` from `react-native`

**What to change:**
The `floorContainer` View wraps both `header` and `cardsContainer`. In dark mode, place an absolutely-positioned `View` with `pointerEvents="none"` as the last child of `floorContainer`. This darkens the whole card (header stays the same visually since it's already a saturated color, but the pastel body area gets muted).

- [ ] **Step 1: Add `useColorScheme` import and dark overlay**

In `FloorCardInner`, add the scheme check and overlay as the last child of `<View style={styles.floorContainer}>`:

```tsx
// At the top of FloorCardInner, after existing hooks:
const colorScheme = useColorScheme();
const isDark = colorScheme === 'dark';
```

Then in JSX, add inside `<View style={styles.floorContainer}>` after `cardsContainer`:

```tsx
{isDark && (
  <View style={styles.darkOverlay} pointerEvents="none" />
)}
```

Add to `StyleSheet.create`:

```ts
darkOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: 'rgba(0,0,0,0.30)',
  borderRadius: 24,
},
```

Also update `floorContainer` shadow for dark mode — wrap the shadow values conditionally in the JSX (since StyleSheet is static, pass as inline style):

In the JSX, change:
```tsx
<View style={styles.floorContainer}>
```
to:
```tsx
<View style={[styles.floorContainer, isDark && styles.floorContainerDark]}>
```

Add to StyleSheet:
```ts
floorContainerDark: {
  shadowColor: 'rgba(0,0,0,0.8)',
  shadowOpacity: 0.45,
},
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/FloorCard.tsx
git commit -m "feat(theme): dark overlay on FloorCard to mute pastel colors in dark mode"
```

---

### Task 3: Dark mode in TopBar

**Files:**
- Modify: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `useAppTheme()` from `src/hooks/useAppTheme`

**What to change:** `glassPanel` and `androidPanel` both have a light greenish background. In dark mode they should be dark/near-black glass.

- [ ] **Step 1: Read the TopBar file to find the exact glassPanel/androidPanel structure**

Read `src/components/TopBar.tsx` in full before editing.

- [ ] **Step 2: Apply theme tokens**

Import `useAppTheme` and call it in the `TopBar` component function. Then replace the static `styles.glassPanel` and `styles.androidPanel` background with dynamic values:

```tsx
import { useAppTheme } from '../hooks/useAppTheme';
// inside TopBar component:
const theme = useAppTheme();
const isDark = theme.isDark;
```

Change the `<View style={[styles.glassPanel, Platform.OS === 'android' && styles.androidPanel]}>` to:

```tsx
<View
  style={[
    styles.glassPanel,
    { backgroundColor: theme.topBarBg, borderColor: theme.topBarBorder },
    Platform.OS === 'android' && styles.androidPanel,
    Platform.OS === 'android' && isDark && { backgroundColor: theme.topBarBg },
  ]}
>
```

Also update text colors inside TopBar that are currently `#27331F` to use `theme.text`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat(theme): apply dark theme tokens to TopBar glass panel"
```

---

### Task 4: Dark mode in Profile screen

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useAppTheme()` from `src/hooks/useAppTheme`

**Elements to retheme** (by style key → token):
- `card.backgroundColor: '#fff'` → `theme.surface`
- `achievementsButton.backgroundColor: '#fff'` → `theme.surface`
- `syncCard.backgroundColor` (line ~790) → `theme.surface`
- `logoutButton` (line ~819) → `theme.surface`
- `name.color: '#27331F'` → `theme.text`
- `statValue.color: '#27331F'` → `theme.text`
- `levelValue.color: '#27331F'` → `theme.text`
- `achievementsButtonText.color: '#27331F'` (line ~809) → `theme.text`
- `dropRowText` (line ~774) → `theme.text`
- `email.color: '#7C8A6E'` → `theme.textMuted`
- `statLabel.color: '#7C8A6E'` → `theme.textMuted`
- `workerStatLabel` → `theme.textMuted`
- `syncTime.color: '#9BA3B0'` → `theme.textMuted`
- `dropRowTime.color: '#9BA3B0'` → `theme.textMuted`
- `statDivider.backgroundColor: '#E4E1D3'` → `theme.divider`
- `workerStatsDivider.backgroundColor: '#E4E1D3'` → `theme.divider`
- `dropSection.backgroundColor: '#F5F3EC'` (line ~736) → `theme.surfaceSub`
- `dropActionBtnDanger.backgroundColor: '#FEF1EE'` (line ~739) → `theme.surfaceDanger`

Since `StyleSheet.create` is static, pass all theme-dependent values as inline style overrides (the pattern already used in this codebase for dynamic colors):

- [ ] **Step 1: Read the full profile.tsx StyleSheet section before editing**

Read `app/(tabs)/profile.tsx` from line 482 to end to see all style keys.

- [ ] **Step 2: Add useAppTheme import and hook call**

```tsx
import { useAppTheme } from '../../src/hooks/useAppTheme';
// inside ProfileScreen():
const theme = useAppTheme();
```

- [ ] **Step 3: Apply theme tokens to JSX**

For each affected element, change from static `styles.X` to `[styles.X, { backgroundColor: theme.surface }]` (or text color equivalent). Keep the static StyleSheet entries as light-mode defaults — they never render on dark because the dynamic override wins.

Key changes:
```tsx
// profile card
<View style={[styles.card, { backgroundColor: theme.surface }]}>

// name text
<Text style={[styles.name, { color: theme.text }]}>

// email
<Text style={[styles.email, { color: theme.textMuted }]}>

// stat values
<Text style={[styles.statValue, { color: theme.text }]}>
<Text style={[styles.levelValue, { color: theme.text }]}>

// divider
<View style={[styles.statDivider, { backgroundColor: theme.divider }]} />
<View style={[styles.workerStatsDivider, { backgroundColor: theme.divider }]} />

// button rows
<Pressable style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}>
<Text style={[styles.achievementsButtonText, { color: theme.text }]}>

// sync card
<Pressable style={({ pressed }) => [styles.syncCard, { backgroundColor: theme.surface }, ...]}>

// logout
<Pressable style={({ pressed }) => [styles.logoutButton, { backgroundColor: theme.surface }, ...]}>

// sync dropdown sub-areas
<View style={[styles.dropSection, { backgroundColor: theme.surfaceSub }]}>
<Pressable style={[styles.dropActionBtn, styles.dropActionBtnDanger, { backgroundColor: theme.surfaceDanger }]}>

// drop row text
<Text style={[styles.dropRowText, { color: theme.text }]}>
<Text style={[styles.dropRowTime, { color: theme.textMuted }]}>
<Text style={[styles.dropSectionTitle, { color: theme.textMuted }]}>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(theme): apply dark theme to Profile screen"
```

---

## Rollback

If the result doesn't look good, all changes are in 4 clean commits. Revert all at once:

```bash
git revert HEAD~3..HEAD --no-commit && git commit -m "revert: dark theme experiment"
```
Or per-commit with `git revert <hash>`.
