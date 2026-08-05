# Animation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two animation problems: (1) QuickActionBar slides in but instantly vanishes on exit; (2) floor list jitters on app launch while scrolling to lobby.

**Architecture:** QuickActionBar gets a `visible` prop and Reanimated enter/exit spring/timing. game.tsx gains a `qaBarVisible` boolean state to keep the bar mounted through the exit animation. The tower column is wrapped in a Reanimated `Animated.View` that starts at opacity 0 and fades in after the first scroll-to-end on launch.

**Tech Stack:** `react-native-reanimated` v4.3.1 (already installed), `@shopify/flash-list` v2.0.2 (already installed), Expo SDK

## Global Constraints

- Do NOT add new npm dependencies — `react-native-reanimated` is already installed.
- All Reanimated values must use `useSharedValue` / `useAnimatedStyle` — never `Animated.Value` from `react-native` for new code.
- `runOnJS` is required to call React state setters from Reanimated callbacks.
- `Easing` must be imported from `react-native-reanimated`, not `react-native`.
- Do not change game logic, store, or any file other than the two listed below.

---

## File Map

| File | What changes |
|------|-------------|
| `src/components/QuickActionBar.tsx` | Remove old `Animated` API; add Reanimated enter/exit; add `visible` + `onHidden` props |
| `app/(tabs)/game.tsx` | Add `qaBarVisible` state + two-step exit flow; add tower fade-in; remove `mountAnimRef` |

---

### Task 1: Migrate QuickActionBar to Reanimated with exit animation

**Files:**
- Modify: `src/components/QuickActionBar.tsx`

**Interfaces:**
- Produces:
  ```ts
  // New props added to QuickActionBar
  visible: boolean       // controls enter (true) / exit (false) animation
  onHidden: () => void   // called after exit animation fully completes
  // Existing props unchanged: mode, info, onPress, onExit
  ```

---

- [ ] **Step 1: Replace the entire content of `src/components/QuickActionBar.tsx`**

The new file uses Reanimated. `slideY` starts at 120 (below screen). A `useEffect` on `visible` plays the spring-in when `true`, or a timed slide-out when `false` — calling `onHidden` via `runOnJS` when finished.

```tsx
import React, { useEffect } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { formatNum } from '../utils/format';
import type { QuickActionMode, FloorActionInfo } from '../utils/quickAction';

interface Props {
  mode: QuickActionMode;
  info: FloorActionInfo | null;
  visible: boolean;
  onHidden: () => void;
  onPress: () => void;
  onExit: () => void;
}

const MODE_COLORS: Record<QuickActionMode, { colors: [string, string] }> = {
  collect: { colors: ['#72C24F', '#4A8A2E'] },
  list:    { colors: ['#F2AC40', '#C9760F'] },
  buy:     { colors: ['#4A90D9', '#2563EB'] },
  hire:    { colors: ['#D96E8A', '#B84E6A'] },
};

export default function QuickActionBar({ mode, info, visible, onHidden, onPress, onExit }: Props) {
  const { t: tContent } = useTranslation('gameContent');
  const { colors } = MODE_COLORS[mode];

  const slideY = useSharedValue(120);

  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    } else {
      slideY.value = withTiming(
        120,
        { duration: 280, easing: Easing.in(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }
  // onHidden identity is stable (wrapped in useCallback in parent)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const label = (() => {
    if (!info) return '…';
    switch (info.mode) {
      case 'collect':
        return `Зібрати монети ($${formatNum(info.totalCoins)})`;
      case 'list':
        return info.count === 1 ? 'Викласти товар' : `Викласти товар (${info.count} шт)`;
      case 'buy': {
        const productName = tContent(`productionTypes.${info.typeId}.displayName`, {
          defaultValue: info.typeId,
        });
        return `Закупити ${productName} ($${formatNum(info.buyCost)})`;
      }
      case 'hire':
        return 'Знайти робітника';
    }
  })();

  return (
    <Animated.View style={[styles.wrapper, animatedStyle]}>
      <Pressable
        onPress={onExit}
        style={({ pressed }) => [styles.exitBtn, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.exitIcon}>✕</Text>
      </Pressable>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={colors} style={styles.btnGradient}>
          <Text style={styles.btnLabel} numberOfLines={1}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 90,
    paddingTop: 8,
  },
  exitBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  exitIcon: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 20,
    color: '#6A7585',
  },
  actionBtn: {
    flex: 1,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 8,
  },
  btnGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
  },
  btnLabel: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 17,
    color: '#fff',
    letterSpacing: 0.3,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `src/components/QuickActionBar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/QuickActionBar.tsx
git commit -m "feat(animation): migrate QuickActionBar to Reanimated with exit animation"
```

---

### Task 2: Two-step QA exit flow in game.tsx

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes from Task 1:
  ```ts
  <QuickActionBar
    visible={boolean}       // new prop
    onHidden={() => void}   // new prop
    mode={QuickActionMode}
    info={FloorActionInfo | null}
    onPress={() => void}
    onExit={() => void}
  />
  ```

---

- [ ] **Step 1: Update the import line at the top of `app/(tabs)/game.tsx`**

Replace:
```tsx
import { Animated, Easing, View, StyleSheet, ImageBackground } from 'react-native';
```
With:
```tsx
import { View, StyleSheet, ImageBackground } from 'react-native';
```

`Animated` and `Easing` from `react-native` are used only in the mount animation which Task 3 will remove. Removing them here avoids a stale-import lint warning. (Task 3 will add the Reanimated equivalents.)

- [ ] **Step 2: Add `qaBarVisible` state and remove `mountAnimRef`**

Find this block near line 162–167:
```tsx
const listRef = useRef<FlashList<FloorItem>>(null);
const savedScrollOffsetRef = useRef(Number.MAX_SAFE_INTEGER);
const qaEnteredRef = useRef(false);
const quickActionModeRef = useRef<QuickActionMode | null>(null);
const contentHeightRef = useRef(0);
const viewHeightRef = useRef(0);
const mountAnimRef = useRef<Animated.CompositeAnimation | null>(null);
```

Replace with:
```tsx
const listRef = useRef<FlashList<FloorItem>>(null);
const savedScrollOffsetRef = useRef(Number.MAX_SAFE_INTEGER);
const qaEnteredRef = useRef(false);
const quickActionModeRef = useRef<QuickActionMode | null>(null);
const contentHeightRef = useRef(0);
const viewHeightRef = useRef(0);
```

And after the `quickActionModeRef` line (near line 170), add:
```tsx
const [qaBarVisible, setQaBarVisible] = useState(false);
```

- [ ] **Step 3: Replace the mount animation useEffect**

Find and remove the entire `useEffect` block that starts around line 244:
```tsx
useEffect(() => {
  const id = setTimeout(() => {
    const maxOffset = Math.max(0, contentHeightRef.current - viewHeightRef.current);
    if (maxOffset <= 0) {
      listRef.current?.scrollToEnd({ animated: false });
      return;
    }
    const sv = new Animated.Value(0);
    const listenerId = sv.addListener(({ value }) => {
      listRef.current?.scrollToOffset({ offset: value, animated: false });
    });
    mountAnimRef.current = Animated.timing(sv, {
      toValue: maxOffset,
      duration: 1200,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    });
    mountAnimRef.current.start(({ finished }) => {
      sv.removeListener(listenerId);
      mountAnimRef.current = null;
      if (finished) listRef.current?.scrollToEnd({ animated: false });
    });
  }, 100);
  return () => clearTimeout(id);
}, []);
```

This block is deleted entirely. The fade-in logic (Task 3) replaces it.

- [ ] **Step 4: Update the QA mode useEffect to remove `mountAnimRef` references**

Find the QA mode useEffect (around line 270):
```tsx
useEffect(() => {
  if (quickActionMode !== null) {
    mountAnimRef.current?.stop();
    mountAnimRef.current = null;
    qaEnteredRef.current = true;
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(id);
  } else if (qaEnteredRef.current) {
    const target = savedScrollOffsetRef.current;
    const id = setTimeout(() => listRef.current?.scrollToOffset({ offset: target, animated: false }), 0);
    return () => clearTimeout(id);
  }
}, [quickActionMode]);
```

Replace with:
```tsx
useEffect(() => {
  if (quickActionMode !== null) {
    qaEnteredRef.current = true;
    const id = setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 0);
    return () => clearTimeout(id);
  } else if (qaEnteredRef.current) {
    const target = savedScrollOffsetRef.current;
    const id = setTimeout(() => listRef.current?.scrollToOffset({ offset: target, animated: false }), 0);
    return () => clearTimeout(id);
  }
}, [quickActionMode]);
```

- [ ] **Step 5: Add `qaBarVisible` sync effect and update exit handlers**

Add a new `useEffect` right after the auto-exit effect (which is around line 235–239):

```tsx
// Show bar when QA mode activates
useEffect(() => {
  if (quickActionMode !== null) {
    setQaBarVisible(true);
  }
}, [quickActionMode]);
```

Find the auto-exit effect:
```tsx
useEffect(() => {
  if (quickActionMode !== null && filteredFloors.length === 0) {
    setQuickActionMode(null);
  }
}, [quickActionMode, filteredFloors.length]);
```

Replace with:
```tsx
useEffect(() => {
  if (quickActionMode !== null && filteredFloors.length === 0) {
    setQaBarVisible(false);
  }
}, [quickActionMode, filteredFloors.length]);
```

- [ ] **Step 6: Add `handleQaExit` and `handleQaHidden` callbacks**

Add these two callbacks near the other handlers (after `handleQuickAction`):

```tsx
const handleQaExit = useCallback(() => {
  setQaBarVisible(false);
}, []);

const handleQaHidden = useCallback(() => {
  setQuickActionMode(null);
}, []);
```

- [ ] **Step 7: Update the QuickActionBar render in the JSX**

Find:
```tsx
{quickActionMode !== null && (
  <QuickActionBar
    mode={quickActionMode}
    info={bottomFloorInfo}
    onPress={handleQuickAction}
    onExit={() => setQuickActionMode(null)}
  />
)}
```

Replace with:
```tsx
{(quickActionMode !== null || qaBarVisible) && (
  <QuickActionBar
    mode={quickActionMode ?? 'collect'}
    info={bottomFloorInfo}
    visible={qaBarVisible}
    onHidden={handleQaHidden}
    onPress={handleQuickAction}
    onExit={handleQaExit}
  />
)}
```

Note: `quickActionMode ?? 'collect'` is a safe fallback — `quickActionMode` is always non-null while the bar is visible (it only becomes null after `onHidden` fires, at which point the render condition evaluates to false and the bar unmounts).

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Manual test — QA exit animation**

Run the app (`npx expo start`) and verify:
1. Tap the quick-action FAB (collect/list/buy/hire button)
2. The bar slides in from below ✓
3. Tap the ✕ button — bar slides **down** smoothly and disappears ✓
4. The floor list returns to its previous scroll position ✓
5. Also verify: tap a quick-action button until all floors are done — bar should slide out automatically ✓

- [ ] **Step 10: Commit**

```bash
git add app/(tabs)/game.tsx
git commit -m "feat(animation): two-step QA exit — bar slides out before unmount"
```

---

### Task 3: Tower fade-in on launch (eliminate jitter)

**Files:**
- Modify: `app/(tabs)/game.tsx`

This task is independent of Tasks 1–2 and can be done in any order, but the `Animated`/`Easing` import was already cleaned up in Task 2 Step 1.

---

- [ ] **Step 1: Add Reanimated import to `app/(tabs)/game.tsx`**

At the top of the file, add a new import line after the `react-native` imports:

```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as ReanimatedEasing,
} from 'react-native-reanimated';
```

- [ ] **Step 2: Add `towerOpacity` shared value and `hasRevealedRef`**

In the refs/state block (after the other `useRef` declarations, around line 162), add:

```tsx
const hasRevealedRef = useRef(false);
const towerOpacity = useSharedValue(0);
const towerStyle = useAnimatedStyle(() => ({ opacity: towerOpacity.value }));
```

- [ ] **Step 3: Update `onContentSizeChange` on FlashList**

Find:
```tsx
onContentSizeChange={(_w, h) => { contentHeightRef.current = h; }}
```

Replace with:
```tsx
onContentSizeChange={(_w, h) => {
  contentHeightRef.current = h;
  if (!hasRevealedRef.current && h > 0 && viewHeightRef.current > 0) {
    hasRevealedRef.current = true;
    listRef.current?.scrollToEnd({ animated: false });
    towerOpacity.value = withTiming(1, {
      duration: 350,
      easing: ReanimatedEasing.out(ReanimatedEasing.quad),
    });
  }
}}
```

- [ ] **Step 4: Wrap the tower column in `Animated.View`**

Find:
```tsx
<View style={styles.towerColumn}>
  <FlashList
```

Replace with:
```tsx
<Animated.View style={[styles.towerColumn, towerStyle]}>
  <FlashList
```

And the closing tag:
```tsx
          </View>
        </View>
        <View style={styles.sideRight} />
```

The inner `</View>` closing `towerColumn` becomes `</Animated.View>`:
```tsx
          </Animated.View>
        </View>
        <View style={styles.sideRight} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Manual test — launch scroll**

Kill and relaunch the app. Verify:
1. On first open: tower column is invisible, then fades in smoothly already positioned at lobby ✓
2. No floors visible jumping/scrolling ✓
3. The fade-in takes ~350ms and feels natural ✓
4. On tab switch back to game: tower stays visible (opacity is already 1, `hasRevealedRef` is true) ✓

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/game.tsx
git commit -m "feat(animation): fade-in tower column on launch, eliminate scroll jitter"
```
