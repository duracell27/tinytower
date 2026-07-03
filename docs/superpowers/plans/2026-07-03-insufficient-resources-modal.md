# InsufficientResourcesModal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global popup modal that appears whenever the player tries to spend currency or items they cannot afford, showing the deficit and (for gems/tools) a "Go to Shop" button.

**Architecture:** A Zustand store field `insufficientResources` holds the popup payload; any component calls `showInsufficientResources(payload)` to trigger it. One `InsufficientResourcesModal` component mounted in `game.tsx` reads this field and renders the animated center-card modal. Every spending callsite is wired to call `showInsufficientResources` instead of silently failing.

**Tech Stack:** React Native, Zustand, expo-router, react-native-reanimated, expo-image, react-i18next

## Global Constraints

- Font families: Fredoka_400Regular / Fredoka_500Medium / Fredoka_600SemiBold / Fredoka_700Bold
- Coin color: `#F2B330`; coin text: `#C28A22`. Gem color: `#3FB8D6`; gem text: `#2592AB`
- All i18n keys live in `src/i18n/locales/en/common.json` under `insufficientResources.*`
- Modal animation: scale `0.5→1` + opacity `0→1` via `Easing.out(Easing.back(1.4))` — match DeliverAllModal
- Shop nav: `router.replace('/shop')` then call `clearInsufficientResources()`
- Tool images: `assets/img/tools/briks.png`, `glass.png`, `nails.png`, `screw.png`
- Tool labels (hardcoded, following WarehouseSheet pattern): briks→'Цегла', glass→'Скло', nails→'Цвяхи', screw→'Шурупи'

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/stores/gameStore.ts` | Modify | Add `InsufficientResourcesPayload` type, `UIState` interface, two store actions |
| `src/stores/__tests__/gameStore.test.ts` | Modify | Tests for show/clear actions |
| `src/i18n/locales/en/common.json` | Modify | Add `insufficientResources.*` keys |
| `src/components/InsufficientResourcesModal.tsx` | Create | Animated modal UI |
| `app/(tabs)/game.tsx` | Modify | Mount modal; wire BuyFloorBanner onPress |
| `src/components/ProductionCard.tsx` | Modify | Show popup on insufficient coins (IDLE/EMPTY stages) |
| `src/components/LobbyPanel.tsx` | Modify | Show popup on insufficient gems (deliver all, upgrade elevator, upgrade lobby) |

---

### Task 1: Store — payload type, state field, two actions

**Files:**
- Modify: `src/stores/gameStore.ts`
- Test: `src/stores/__tests__/gameStore.test.ts`

**Interfaces:**
- Produces: exported type `InsufficientResourcesPayload`, store actions `showInsufficientResources(payload)` / `clearInsufficientResources()`, state field `insufficientResources: InsufficientResourcesPayload | null`

- [ ] **Step 1: Write failing tests** — append to `src/stores/__tests__/gameStore.test.ts`

```typescript
import { useGameStore } from '../gameStore';
import type { InsufficientResourcesPayload } from '../gameStore';

describe('insufficientResources UI state', () => {
  beforeEach(() => {
    useGameStore.setState({ insufficientResources: null });
  });

  it('starts as null', () => {
    expect(useGameStore.getState().insufficientResources).toBeNull();
  });

  it('showInsufficientResources sets the payload', () => {
    const payload: InsufficientResourcesPayload = { currency: 'gems', need: 5, have: 2 };
    useGameStore.getState().showInsufficientResources(payload);
    expect(useGameStore.getState().insufficientResources).toEqual(payload);
  });

  it('clearInsufficientResources resets to null', () => {
    useGameStore.getState().showInsufficientResources({ currency: 'coins', need: 100, have: 30 });
    useGameStore.getState().clearInsufficientResources();
    expect(useGameStore.getState().insufficientResources).toBeNull();
  });

  it('showInsufficientResources supports missingTools payload', () => {
    const payload: InsufficientResourcesPayload = {
      missingTools: [{ key: 'briks', need: 3, have: 0 }],
      need: 3,
      have: 0,
    };
    useGameStore.getState().showInsufficientResources(payload);
    expect(useGameStore.getState().insufficientResources?.missingTools).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/stores/__tests__/gameStore.test.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `InsufficientResourcesPayload` not exported, `insufficientResources` not on store.

- [ ] **Step 3: Add exported type + UIState interface + extend GameActions**

In `src/stores/gameStore.ts`, after the closing `}` of `interface ToolInventory` (after line 31), add:

```typescript
export interface InsufficientResourcesPayload {
  currency?: 'coins' | 'gems';
  need: number;
  have: number;
  missingTools?: {
    key: 'briks' | 'glass' | 'nails' | 'screw';
    need: number;
    have: number;
  }[];
}

interface UIState {
  insufficientResources: InsufficientResourcesPayload | null;
}
```

In `interface GameActions` (around line 39), add two methods before the closing `}`:

```typescript
  showInsufficientResources: (payload: InsufficientResourcesPayload) => void;
  clearInsufficientResources: () => void;
```

Change the `GameStore` type (line 61) to include `UIState`:

```typescript
type GameStore = GameState & PlayerStats & SyncState & ToolInventory & UIState & GameActions;
```

- [ ] **Step 4: Initialize and implement in the store body**

In `create<GameStore>((set, get) => ({`, after `screw: 1,` (around line 125), add:

```typescript
  insufficientResources: null,

  showInsufficientResources: (payload) => set({ insufficientResources: payload }),
  clearInsufficientResources: () => set({ insufficientResources: null }),
```

- [ ] **Step 5: Run tests — confirm they pass**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/stores/__tests__/gameStore.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS all 4 new tests + all pre-existing tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add src/stores/gameStore.ts src/stores/__tests__/gameStore.test.ts
git commit -m "feat: add insufficientResources UI state + show/clear actions to gameStore"
```

---

### Task 2: i18n keys

**Files:**
- Modify: `src/i18n/locales/en/common.json`

**Interfaces:**
- Produces: keys `common:insufficientResources.notEnoughCoins`, `.notEnoughGems`, `.missingMaterials`, `.have`, `.need`, `.missing`, `.goToShop`, `.close`

- [ ] **Step 1: Add keys to common.json**

Replace the entire content of `src/i18n/locales/en/common.json` with:

```json
{
  "actions": {
    "login": "Log In",
    "register": "Register",
    "cancel": "Cancel",
    "or": "or"
  },
  "relativeTime": {
    "never": "never",
    "justNow": "just now",
    "minutesAgo": "{{count}}m ago",
    "hoursAgo": "{{count}}h ago",
    "daysAgo": "{{count}}d ago"
  },
  "insufficientResources": {
    "notEnoughCoins": "Not enough coins",
    "notEnoughGems": "Not enough gems",
    "missingMaterials": "Missing materials",
    "have": "Have",
    "need": "Need",
    "missing": "Missing",
    "goToShop": "Go to Shop",
    "close": "Close"
  }
}
```

- [ ] **Step 2: Run i18n key coverage test**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS (no new component uses the keys yet — test passes by not finding any t() calls to validate).

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add src/i18n/locales/en/common.json
git commit -m "feat: add insufficientResources i18n keys to common.json"
```

---

### Task 3: InsufficientResourcesModal component

**Files:**
- Create: `src/components/InsufficientResourcesModal.tsx`

**Interfaces:**
- Consumes: `InsufficientResourcesPayload` from `../stores/gameStore`; `useGameStore` selector for `insufficientResources` and `clearInsufficientResources`
- Produces: `export default function InsufficientResourcesModal()` — zero props, mounts anywhere

- [ ] **Step 1: Create the component**

Create `src/components/InsufficientResourcesModal.tsx`:

```tsx
import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

const TOOL_META: Record<
  'briks' | 'glass' | 'nails' | 'screw',
  { label: string; image: ReturnType<typeof require> }
> = {
  briks: { label: 'Цегла',  image: require('../../assets/img/tools/briks.png') },
  glass: { label: 'Скло',   image: require('../../assets/img/tools/glass.png') },
  nails: { label: 'Цвяхи',  image: require('../../assets/img/tools/nails.png') },
  screw: { label: 'Шурупи', image: require('../../assets/img/tools/screw.png') },
};

function CoinIcon() {
  return (
    <View style={icons.coin} />
  );
}

function GemIcon() {
  return (
    <View style={icons.gem} />
  );
}

export default function InsufficientResourcesModal() {
  const { t } = useTranslation('common');
  const payload = useGameStore((s) => s.insufficientResources);
  const clearInsufficientResources = useGameStore((s) => s.clearInsufficientResources);

  const visible = payload !== null;
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.back(1.4)) });
    } else {
      opacity.value = 0;
      scale.value = 0.5;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible || !payload) return null;

  const isGems = payload.currency === 'gems';
  const isCoins = payload.currency === 'coins';
  const isTools = !payload.currency && !!payload.missingTools?.length;
  const canBuy = isGems || isTools;

  const title = isCoins
    ? t('insufficientResources.notEnoughCoins')
    : isGems
      ? t('insufficientResources.notEnoughGems')
      : t('insufficientResources.missingMaterials');

  const deficit = payload.need - payload.have;

  const handleShop = () => {
    clearInsufficientResources();
    router.replace('/shop');
  };

  return (
    <Modal transparent animationType="none" onRequestClose={clearInsufficientResources}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clearInsufficientResources} />

        <Animated.View style={[styles.card, cardStyle]}>
          <LinearGradient colors={['#F0F4FA', '#E4EAF2']} style={styles.cardGradient}>

            {/* Icon */}
            <View style={styles.iconWrap}>
              {isCoins && <View style={styles.coinLarge} />}
              {isGems && <View style={styles.gemLarge} />}
              {isTools && (
                <View style={styles.toolRow}>
                  {payload.missingTools!.slice(0, 3).map((t) => (
                    <Image
                      key={t.key}
                      source={TOOL_META[t.key].image}
                      style={styles.toolIcon}
                      contentFit="contain"
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Title */}
            <Text style={styles.title}>{title}</Text>

            {/* Currency deficit row */}
            {(isCoins || isGems) && (
              <View style={styles.deficitCard}>
                <View style={styles.deficitRow}>
                  <View style={styles.deficitCell}>
                    <Text style={styles.deficitLabel}>{t('insufficientResources.have')}</Text>
                    <View style={styles.deficitValueRow}>
                      {isCoins ? <CoinIcon /> : <GemIcon />}
                      <Text style={[styles.deficitValue, isCoins ? styles.coinText : styles.gemText]}>
                        {payload.have}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                  <View style={styles.deficitCell}>
                    <Text style={styles.deficitLabel}>{t('insufficientResources.need')}</Text>
                    <View style={styles.deficitValueRow}>
                      {isCoins ? <CoinIcon /> : <GemIcon />}
                      <Text style={[styles.deficitValue, isCoins ? styles.coinText : styles.gemText]}>
                        {payload.need}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.missingRow}>
                  <Text style={styles.missingLabel}>{t('insufficientResources.missing')}:</Text>
                  <View style={styles.deficitValueRow}>
                    {isCoins ? <CoinIcon /> : <GemIcon />}
                    <Text style={[styles.missingValue, isCoins ? styles.coinText : styles.gemText]}>
                      {deficit}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Tools list */}
            {isTools && (
              <View style={styles.toolsCard}>
                {payload.missingTools!.map((tool) => (
                  <View key={tool.key} style={styles.toolItemRow}>
                    <Image
                      source={TOOL_META[tool.key].image}
                      style={styles.toolItemIcon}
                      contentFit="contain"
                    />
                    <Text style={styles.toolItemLabel}>{TOOL_META[tool.key].label}</Text>
                    <View style={styles.toolItemCounts}>
                      <Text style={styles.toolHave}>{tool.have}</Text>
                      <Text style={styles.toolSlash}>/</Text>
                      <Text style={styles.toolNeed}>{tool.need}</Text>
                    </View>
                    <Text style={styles.toolMissing}>-{tool.need - tool.have}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Shop button */}
            {canBuy && (
              <Pressable
                onPress={handleShop}
                style={({ pressed }) => [styles.shopBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={['#52A6E2', '#3B8BCB']}
                  style={styles.shopBtnGradient}
                >
                  <Text style={styles.shopBtnText}>{t('insufficientResources.goToShop')}</Text>
                </LinearGradient>
                <View style={styles.shopBtnShadow} />
              </Pressable>
            )}

            {/* Close */}
            <Pressable onPress={clearInsufficientResources} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>{t('insufficientResources.close')}</Text>
            </Pressable>

          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const icons = StyleSheet.create({
  coin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F2B330',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  gem: {
    width: 16,
    height: 16,
    backgroundColor: '#3FB8D6',
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SCREEN_W * 0.82,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: 'rgba(30,50,80,1)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 12,
  },
  cardGradient: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 22,
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  coinLarge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2B330',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(180,130,30,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  gemLarge: {
    width: 32,
    height: 32,
    backgroundColor: '#3FB8D6',
    borderRadius: 7,
    transform: [{ rotate: '45deg' }],
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  toolRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  toolIcon: {
    width: 22,
    height: 22,
  },
  title: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 22,
    color: '#2A3344',
    textAlign: 'center',
  },
  deficitCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  deficitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deficitCell: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  deficitLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#9BA3B0',
  },
  deficitValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deficitValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 18,
  },
  arrow: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 18,
    color: '#C5CAD4',
    marginHorizontal: 4,
  },
  missingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3F2',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  missingLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13,
    color: '#D9534F',
  },
  missingValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#D9534F',
  },
  coinText: {
    color: '#C28A22',
  },
  gemText: {
    color: '#2592AB',
  },
  toolsCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: 'rgba(40,60,90,1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  toolItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolItemIcon: {
    width: 28,
    height: 28,
  },
  toolItemLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
    flex: 1,
  },
  toolItemCounts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  toolHave: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#9BA3B0',
  },
  toolSlash: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: '#C5CAD4',
  },
  toolNeed: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#5A6478',
  },
  toolMissing: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 13,
    color: '#D9534F',
    minWidth: 26,
    textAlign: 'right',
  },
  shopBtn: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  shopBtnGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    zIndex: 1,
  },
  shopBtnText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 16,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  shopBtnShadow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#2E72A8',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  closeBtn: {
    paddingVertical: 6,
  },
  closeBtnText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 14,
    color: '#9BA3B0',
  },
});
```

- [ ] **Step 2: Run i18n key coverage test**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage 2>&1 | tail -20
```

Expected: PASS — the test confirms every `t('common:insufficientResources.*')` key used in the new component exists in `common.json`.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add src/components/InsufficientResourcesModal.tsx
git commit -m "feat: add InsufficientResourcesModal component"
```

---

### Task 4: Mount modal in game.tsx + wire BuyFloorBanner

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `InsufficientResourcesModal` (no props); `balance` via `useBalance()` (already line 54); `gems` via `useGameStore` (already line 58); `showInsufficientResources` from store
- The floor's `currency` and `price` are extracted as module-level constants so the `onPress` handler stays generic — supporting both `'coins'` and `'gems'` without hardcoding

- [ ] **Step 1: Add import for the modal**

In `app/(tabs)/game.tsx`, after the existing import of `LevelUpModal` (around line 12), add:

```typescript
import InsufficientResourcesModal from '../../src/components/InsufficientResourcesModal';
```

- [ ] **Step 2: Extract floor-buy constants + add showInsufficientResources selector**

Replace the existing module-level constant (around line 26):

```typescript
const NEXT_FLOOR_NUMBER = gameConfig.floors[gameConfig.floors.length - 1].id + 1;
```

With:

```typescript
const NEXT_FLOOR_NUMBER = gameConfig.floors[gameConfig.floors.length - 1].id + 1;
const FLOOR_BUY_PRICE = 250;
const FLOOR_BUY_CURRENCY: 'coins' | 'gems' = 'gems';
```

After line 58 (`const gems = useGameStore((s) => s.gems);`), add:

```typescript
const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
```

- [ ] **Step 3: Wire BuyFloorBanner with a currency-aware onPress**

The `BuyFloorBanner` currently has no `onPress` wired (around line 100). Replace:

```tsx
<BuyFloorBanner
  nextFloorNumber={NEXT_FLOOR_NUMBER}
  price={250}
  currency="gems"
/>
```

With:

```tsx
<BuyFloorBanner
  nextFloorNumber={NEXT_FLOOR_NUMBER}
  price={FLOOR_BUY_PRICE}
  currency={FLOOR_BUY_CURRENCY}
  onPress={() => {
    const currentAmount = FLOOR_BUY_CURRENCY === 'gems' ? gems : balance;
    if (currentAmount < FLOOR_BUY_PRICE) {
      showInsufficientResources({
        currency: FLOOR_BUY_CURRENCY,
        need: FLOOR_BUY_PRICE,
        have: currentAmount,
      });
      return;
    }
    // TODO: actual floor purchase logic
  }}
/>
```

- [ ] **Step 4: Mount the modal**

After `<LevelUpModal suppressWhileOpen={lobbyOpen || hotelOpen} />` (around line 178), add:

```tsx
<InsufficientResourcesModal />
```

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add app/(tabs)/game.tsx
git commit -m "feat: mount InsufficientResourcesModal in game screen, wire BuyFloorBanner for coins or gems"
```

---

### Task 5: Wire ProductionCard (insufficient coins)

**Files:**
- Modify: `src/components/ProductionCard.tsx`

**Interfaces:**
- Consumes: `showInsufficientResources` from `useGameStore`; `effectiveCost` (already computed at component level); `balance` prop

The goal: in `handleAction`, before calling `store.buy(...)` for IDLE and EMPTY stages, check balance and show the popup if insufficient.

- [ ] **Step 1: Modify handleAction**

In `src/components/ProductionCard.tsx`, replace the existing `handleAction` useCallback (lines ~183–206) with:

```typescript
const handleAction = useCallback(() => {
  const store = useGameStore.getState();
  switch (effectiveStage) {
    case 'EMPTY': {
      const typeId = floorAvailableTypes[0];
      if (typeId) {
        const firstConfig = gameConfig.productionTypes[typeId];
        const firstCost = firstConfig
          ? Math.floor(firstConfig.buyCost * (1 - (floorDiscount ?? 0)))
          : 0;
        if (store.balance < firstCost) {
          store.showInsufficientResources({ currency: 'coins', need: firstCost, have: store.balance });
          return;
        }
        store.buy(floorId, slotIdx, typeId);
      }
      break;
    }
    case 'IDLE':
      if (production.typeId) {
        if (store.balance < effectiveCost) {
          store.showInsufficientResources({ currency: 'coins', need: effectiveCost, have: store.balance });
          return;
        }
        store.buy(floorId, slotIdx, production.typeId);
      }
      break;
    case 'READY_TO_LIST':
      store.list(floorId, slotIdx);
      break;
    case 'READY_TO_COLLECT':
      store.collect(floorId, slotIdx);
      break;
  }
}, [effectiveStage, floorId, slotIdx, floorAvailableTypes, production.typeId, effectiveCost, floorDiscount]);
```

Note: `store.balance` is read fresh from the store snapshot, avoiding stale closure issues with the `balance` prop. `effectiveCost` and `floorDiscount` are added to the dependency array.

- [ ] **Step 2: Run i18n coverage test to confirm no regressions**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/i18n/__tests__/keysExist.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add src/components/ProductionCard.tsx
git commit -m "feat: show insufficient coins popup in ProductionCard before buy"
```

---

### Task 6: Wire LobbyPanel (insufficient gems)

**Files:**
- Modify: `src/components/LobbyPanel.tsx`

Three spending sites: **deliver all** (1 gem), **upgrade elevator**, **upgrade lobby**.

- [ ] **Step 1: Add showInsufficientResources selector**

In `src/components/LobbyPanel.tsx`, alongside the existing action selectors (around lines 451–455), add:

```typescript
const showInsufficientResources = useGameStore((s) => s.showInsufficientResources);
```

- [ ] **Step 2: Fix deliver all handler**

Find the deliver all `onPress` handler (around line 798). Replace the silent guard:

```typescript
// Before:
if (gems < 1) return;
```

With:

```typescript
if (gems < 1) {
  showInsufficientResources({ currency: 'gems', need: 1, have: gems });
  return;
}
```

- [ ] **Step 3: Fix upgrade elevator button**

Find the elevator upgrade `Pressable` (around line 937). Replace:

```typescript
onPress={gems >= elevatorUpgradeCost ? upgradeElevator : undefined}
```

With:

```typescript
onPress={() => {
  if (gems < elevatorUpgradeCost) {
    showInsufficientResources({ currency: 'gems', need: elevatorUpgradeCost, have: gems });
  } else {
    upgradeElevator();
  }
}}
```

- [ ] **Step 4: Fix upgrade lobby button**

Find the lobby upgrade `Pressable` (around line 994). Replace:

```typescript
onPress={gems >= lobbyUpgradeCost ? upgradeLobby : undefined}
```

With:

```typescript
onPress={() => {
  if (gems < lobbyUpgradeCost) {
    showInsufficientResources({ currency: 'gems', need: lobbyUpgradeCost, have: gems });
  } else {
    upgradeLobby();
  }
}}
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage 2>&1 | tail -20
```

Expected: PASS all tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower && git add src/components/LobbyPanel.tsx
git commit -m "feat: show insufficient gems popup in LobbyPanel (deliver all, elevator upgrade, lobby upgrade)"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Popup shows when not enough coins (ProductionCard Task 5, BuyFloorBanner when `FLOOR_BUY_CURRENCY='coins'` Task 4)
- ✅ Popup shows when not enough gems (LobbyPanel Task 6, BuyFloorBanner when `FLOOR_BUY_CURRENCY='gems'` Task 4)
- ✅ BuyFloorBanner handles both currencies dynamically via `FLOOR_BUY_CURRENCY` constant
- ✅ Popup shows what's missing (deficit row in modal)
- ✅ For gems: "Buy" button → /shop
- ✅ Tools case: list of missing tools + "Buy" button → /shop
- ✅ Coins: no "Buy" button (earned in-game, not purchasable)
- ✅ All spending sites covered: ProductionCard, LobbyPanel (×3), BuyFloorBanner

**Placeholder scan:** No TBDs, all steps have complete code.

**Type consistency:**
- `InsufficientResourcesPayload` defined in Task 1, exported, used identically in Tasks 3, 4, 5, 6
- `showInsufficientResources(payload: InsufficientResourcesPayload)` — same signature throughout
- `clearInsufficientResources()` — used in modal via selector, consistent name everywhere
