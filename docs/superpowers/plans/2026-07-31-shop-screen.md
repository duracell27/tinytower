# Shop Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional Shop screen with four sections (Diamonds, Bundles, Builder, Materials), a 3-second mock purchase flow, and a success popup that credits rewards to the player.

**Architecture:** New `shop_purchase` command carries all reward types (gems/tools/tokens) through the existing command-sourcing pipeline. UI lives in `app/(tabs)/shop.tsx` backed by static pack data in `src/data/shopPacks.ts`. A `PurchaseSuccessModal` added to `GlobalOverlay` reads `pendingPurchaseSuccess` from the game store, matching the existing modal pattern.

**Tech Stack:** React Native, Expo Image, expo-linear-gradient, react-native-reanimated, Zustand, Zod, i18next

## Global Constraints

- All state mutations MUST go through `executeCommand` — never call `set()` directly with game state
- New modals MUST be added to `GlobalOverlay` in `app/_layout.tsx`, never rendered locally
- Font: `Fredoka_700Bold` for headings, `Fredoka_500Medium` for body
- Images: use `expo-image` `<Image>` component, not React Native `<Image>`
- All text shown to the user must have a key in `src/i18n/locales/en/tabs.json` (and `uk/tabs.json` if it exists)
- Shop tab color: `#9A6FD0`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `shared/schemas/command.ts` | Modify | Add `ShopPurchaseCommandSchema` |
| `shared/engine/processCommand.ts` | Modify | Handle `shop_purchase` case |
| `src/data/shopPacks.ts` | Create | All pack definitions (data layer) |
| `src/stores/gameStore.ts` | Modify | `pendingPurchaseSuccess` state + `shopPurchase` action |
| `src/components/PurchaseSuccessModal.tsx` | Create | Success popup after purchase |
| `src/components/GlobalOverlay.tsx` | Modify | Mount `PurchaseSuccessModal` |
| `app/(tabs)/shop.tsx` | Rewrite | Full shop UI (4 sections, cards, spinner) |
| `src/i18n/locales/en/tabs.json` | Modify | Shop translation keys |
| `src/i18n/locales/uk/tabs.json` | Modify | Ukrainian shop keys (if file exists) |

---

## Task 1: Add `shop_purchase` command

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/engine/processCommand.ts`

**Interfaces:**
- Produces: `ShopPurchaseCommand` type used by all later tasks

- [ ] **Step 1: Add schema to `shared/schemas/command.ts`**

After the `DevAddGemsCommandSchema` block, add:

```ts
export const ShopPurchaseCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('shop_purchase'),
  gems:   z.number().int().nonnegative().default(0),
  tools: z.object({
    briks:  z.number().int().nonnegative().default(0),
    glass:  z.number().int().nonnegative().default(0),
    nails:  z.number().int().nonnegative().default(0),
    screw:  z.number().int().nonnegative().default(0),
    wood:   z.number().int().nonnegative().default(0),
    cement: z.number().int().nonnegative().default(0),
  }).default({}),
  tokens: z.object({
    green:  z.number().int().nonnegative().default(0),
    blue:   z.number().int().nonnegative().default(0),
    yellow: z.number().int().nonnegative().default(0),
    purple: z.number().int().nonnegative().default(0),
    red:    z.number().int().nonnegative().default(0),
  }).default({}),
});
```

- [ ] **Step 2: Add to `CommandSchema` discriminated union**

In the `CommandSchema = z.discriminatedUnion('type', [...])` array, add `ShopPurchaseCommandSchema` alongside the other schemas. Also add the export to the union list.

- [ ] **Step 3: Handle in `shared/engine/processCommand.ts`**

In the `switch (command.type)` block, after the `dev_add_gems` case, add:

```ts
case 'shop_purchase':
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems + command.gems,
      tools: {
        briks:  (state.tools.briks  ?? 0) + (command.tools.briks  ?? 0),
        glass:  (state.tools.glass  ?? 0) + (command.tools.glass  ?? 0),
        nails:  (state.tools.nails  ?? 0) + (command.tools.nails  ?? 0),
        screw:  (state.tools.screw  ?? 0) + (command.tools.screw  ?? 0),
        wood:   (state.tools.wood   ?? 0) + (command.tools.wood   ?? 0),
        cement: (state.tools.cement ?? 0) + (command.tools.cement ?? 0),
      },
      tokens: {
        green:  (state.tokens.green  ?? 0) + (command.tokens.green  ?? 0),
        blue:   (state.tokens.blue   ?? 0) + (command.tokens.blue   ?? 0),
        yellow: (state.tokens.yellow ?? 0) + (command.tokens.yellow ?? 0),
        purple: (state.tokens.purple ?? 0) + (command.tokens.purple ?? 0),
        red:    (state.tokens.red    ?? 0) + (command.tokens.red    ?? 0),
      },
    },
  };
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/command.ts shared/engine/processCommand.ts
git commit -m "feat(shop): add shop_purchase command to schema and engine"
```

---

## Task 2: Pack data and store wiring

**Files:**
- Create: `src/data/shopPacks.ts`
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Produces:
  - `ShopPack` type (used by shop UI and success modal)
  - `PurchaseSuccessPayload` type (used by success modal)
  - `useGameStore(s => s.pendingPurchaseSuccess)` — read by `PurchaseSuccessModal`
  - `useGameStore(s => s.shopPurchase)` — called by shop UI

- [ ] **Step 1: Create `src/data/shopPacks.ts`**

```ts
export type ToolKey   = 'briks' | 'glass' | 'nails' | 'screw' | 'wood' | 'cement';
export type TokenColor = 'green' | 'blue' | 'yellow' | 'purple' | 'red';

export interface ShopRewards {
  gems?:   number;
  tools?:  Partial<Record<ToolKey, number>>;
  tokens?: Partial<Record<TokenColor, number>>;
}

export interface ShopPack {
  id:          string;
  section:     'diamonds' | 'bundles' | 'builder' | 'materials';
  name:        string;
  price:       string;
  image:       ReturnType<typeof require>;
  bonusLabel?: string;   // e.g. "+5% bonus"
  badge?:      'best' | 'popular';
  rewards:     ShopRewards;
}

const ALL_TOOLS = (n: number): Partial<Record<ToolKey, number>> =>
  ({ briks: n, glass: n, nails: n, screw: n, wood: n, cement: n });

const ALL_TOKENS = (n: number): Partial<Record<TokenColor, number>> =>
  ({ green: n, blue: n, yellow: n, purple: n, red: n });

export const DIAMOND_PACKS: ShopPack[] = [
  {
    id: 'diamonds_1', section: 'diamonds', name: 'Handful', price: '$0.99',
    image: require('../../assets/img/shop/purchase1.png'),
    rewards: { gems: 200 },
  },
  {
    id: 'diamonds_2', section: 'diamonds', name: 'Pouch', price: '$1.99',
    image: require('../../assets/img/shop/purchase2.png'),
    bonusLabel: '+5%',
    rewards: { gems: 420 },
  },
  {
    id: 'diamonds_3', section: 'diamonds', name: 'Box', price: '$4.99',
    image: require('../../assets/img/shop/purchase3.png'),
    bonusLabel: '+10%',
    rewards: { gems: 1100 },
  },
  {
    id: 'diamonds_4', section: 'diamonds', name: 'Chest', price: '$9.99',
    image: require('../../assets/img/shop/purchase4.png'),
    bonusLabel: '+15%',
    badge: 'popular',
    rewards: { gems: 2300 },
  },
  {
    id: 'diamonds_5', section: 'diamonds', name: 'Vault', price: '$19.99',
    image: require('../../assets/img/shop/purchase5.png'),
    bonusLabel: '+20%',
    badge: 'best',
    rewards: { gems: 4800 },
  },
  {
    id: 'diamonds_6', section: 'diamonds', name: 'Treasure', price: '$49.99',
    image: require('../../assets/img/shop/purchase6.png'),
    bonusLabel: '+25%',
    rewards: { gems: 12500 },
  },
];

export const BUNDLE_PACKS: ShopPack[] = [
  {
    id: 'bundle_1', section: 'bundles', name: 'Starter Pack', price: '$1.99',
    image: require('../../assets/img/shop/bundle_starter.png'),
    rewards: { gems: 150, tools: ALL_TOOLS(3), tokens: ALL_TOKENS(3) },
  },
  {
    id: 'bundle_2', section: 'bundles', name: 'Resource Bundle', price: '$4.99',
    image: require('../../assets/img/shop/bundle_resource.png'),
    rewards: { gems: 500, tools: ALL_TOOLS(8), tokens: ALL_TOKENS(8) },
  },
  {
    id: 'bundle_3', section: 'bundles', name: 'Growth Bundle', price: '$9.99',
    image: require('../../assets/img/shop/bundle_growth.png'),
    badge: 'popular',
    rewards: { gems: 1100, tools: ALL_TOOLS(15), tokens: ALL_TOKENS(20) },
  },
  {
    id: 'bundle_4', section: 'bundles', name: 'VIP Bundle', price: '$24.99',
    image: require('../../assets/img/shop/bundle_vip.png'),
    badge: 'best',
    rewards: { gems: 3000, tools: ALL_TOOLS(30), tokens: ALL_TOKENS(50) },
  },
];

export const BUILDER_PACKS: ShopPack[] = [
  {
    id: 'builder_1', section: 'builder', name: 'Mini Kit', price: '$1.99',
    image: require('../../assets/img/shop/builder_mini.png'),
    rewards: { gems: 100, tools: ALL_TOOLS(5) },
  },
  {
    id: 'builder_2', section: 'builder', name: 'Starter Builder', price: '$3.99',
    image: require('../../assets/img/shop/builder_starter.png'),
    rewards: { gems: 250, tools: ALL_TOOLS(12) },
  },
  {
    id: 'builder_3', section: 'builder', name: 'Pro Builder', price: '$7.99',
    image: require('../../assets/img/shop/builder_pro.png'),
    badge: 'popular',
    rewards: { gems: 600, tools: ALL_TOOLS(25) },
  },
  {
    id: 'builder_4', section: 'builder', name: 'Master Builder', price: '$14.99',
    image: require('../../assets/img/shop/builder_master.png'),
    badge: 'best',
    rewards: { gems: 1200, tools: ALL_TOOLS(50) },
  },
];

export const MATERIAL_PACKS: ShopPack[] = [
  { id: 'mat_briks',  section: 'materials', name: 'Bricks',  price: '50',
    image: require('../../assets/img/tools/briks.png'),  rewards: { tools: { briks:  5 } } },
  { id: 'mat_glass',  section: 'materials', name: 'Glass',   price: '50',
    image: require('../../assets/img/tools/glass.png'),  rewards: { tools: { glass:  5 } } },
  { id: 'mat_nails',  section: 'materials', name: 'Nails',   price: '50',
    image: require('../../assets/img/tools/nails.png'),  rewards: { tools: { nails:  5 } } },
  { id: 'mat_screw',  section: 'materials', name: 'Screws',  price: '50',
    image: require('../../assets/img/tools/screw.png'),  rewards: { tools: { screw:  5 } } },
  { id: 'mat_wood',   section: 'materials', name: 'Wood',    price: '50',
    image: require('../../assets/img/tools/wood.png'),   rewards: { tools: { wood:   5 } } },
  { id: 'mat_cement', section: 'materials', name: 'Cement',  price: '50',
    image: require('../../assets/img/tools/cement.png'), rewards: { tools: { cement: 5 } } },
];
```

**Note on bundle/builder images:** These files don't exist yet — use placeholder `require('../../assets/img/diamond.png')` for all bundle/builder images until the user provides the real assets. The data file will be updated when icons are ready. Material packs use the existing tool icons.

- [ ] **Step 2: Add `PurchaseSuccessPayload` type and store state to `src/stores/gameStore.ts`**

Near the other `Pending*` type definitions at the top of the file, add:

```ts
export type PurchaseSuccessPayload = {
  packName: string;
  price: string;
  rewards: import('../data/shopPacks').ShopRewards;
};
```

In the store state interface, add:
```ts
pendingPurchaseSuccess: PurchaseSuccessPayload | null;
shopPurchase: (pack: import('../data/shopPacks').ShopPack) => void;
clearPurchaseSuccess: () => void;
```

In the initial state object, add:
```ts
pendingPurchaseSuccess: null,
```

In the store actions, add:

```ts
clearPurchaseSuccess: () => set({ pendingPurchaseSuccess: null }),

shopPurchase: (pack) => {
  executeCommand(get, set, {
    id: uuid(),
    type: 'shop_purchase',
    gems:   pack.rewards.gems ?? 0,
    tools:  {
      briks:  pack.rewards.tools?.briks  ?? 0,
      glass:  pack.rewards.tools?.glass  ?? 0,
      nails:  pack.rewards.tools?.nails  ?? 0,
      screw:  pack.rewards.tools?.screw  ?? 0,
      wood:   pack.rewards.tools?.wood   ?? 0,
      cement: pack.rewards.tools?.cement ?? 0,
    },
    tokens: {
      green:  pack.rewards.tokens?.green  ?? 0,
      blue:   pack.rewards.tokens?.blue   ?? 0,
      yellow: pack.rewards.tokens?.yellow ?? 0,
      purple: pack.rewards.tokens?.purple ?? 0,
      red:    pack.rewards.tokens?.red    ?? 0,
    },
    timestamp: clock.now(),
  });
  set({
    pendingPurchaseSuccess: {
      packName: pack.name,
      price:    pack.price,
      rewards:  pack.rewards,
    },
  });
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/shopPacks.ts src/stores/gameStore.ts
git commit -m "feat(shop): add pack definitions and shopPurchase store action"
```

---

## Task 3: PurchaseSuccessModal + GlobalOverlay

**Files:**
- Create: `src/components/PurchaseSuccessModal.tsx`
- Modify: `src/components/GlobalOverlay.tsx`

**Interfaces:**
- Consumes: `useGameStore(s => s.pendingPurchaseSuccess)`, `useGameStore(s => s.clearPurchaseSuccess)`
- Consumes: `PurchaseSuccessPayload` from Task 2

- [ ] **Step 1: Create `src/components/PurchaseSuccessModal.tsx`**

Model the animation on `TaskRewardModal.tsx` (spring scale-in, delayed rewards fade-up).

```tsx
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming, Easing,
} from 'react-native-reanimated';
import { useGameStore } from '../stores/gameStore';

const { width: SCREEN_W } = Dimensions.get('window');

const DIAMOND_ICON = require('../../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};
const TOOL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

export default function PurchaseSuccessModal() {
  const payload = useGameStore((s) => s.pendingPurchaseSuccess);
  const clear   = useGameStore((s) => s.clearPurchaseSuccess);

  const scale   = useSharedValue(0.6);
  const bodyOp  = useSharedValue(0);
  const bodyY   = useSharedValue(16);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOp.value,
    transform: [{ translateY: bodyY.value }],
  }));

  const runIn = useCallback(() => {
    scale.value  = 0.6;
    bodyOp.value = 0;
    bodyY.value  = 16;
    scale.value  = withSpring(1, { damping: 14, stiffness: 180 });
    bodyOp.value = withDelay(220, withTiming(1, { duration: 260 }));
    bodyY.value  = withDelay(220, withTiming(0, { duration: 280, easing: Easing.out(Easing.back(1.2)) }));
  }, [scale, bodyOp, bodyY]);

  if (!payload) return null;

  const { packName, price, rewards } = payload;

  // Build chip list
  type Chip = { icon: ReturnType<typeof require>; label: string };
  const chips: Chip[] = [];
  if (rewards.gems)
    chips.push({ icon: DIAMOND_ICON, label: `+${rewards.gems}` });
  if (rewards.tools)
    Object.entries(rewards.tools).forEach(([k, v]) => {
      if (v) chips.push({ icon: TOOL_ICONS[k], label: `+${v}` });
    });
  if (rewards.tokens)
    Object.entries(rewards.tokens).forEach(([k, v]) => {
      if (v) chips.push({ icon: TOKEN_ICONS[k], label: `+${v}` });
    });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clear} onShow={runIn}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={clear} />
        <Animated.View style={[s.card, cardStyle]}>
          <LinearGradient colors={['#F5EEFF', '#E8D5FF']} style={s.cardInner}>

            <Image source={DIAMOND_ICON} style={s.bigIcon} contentFit="contain" />
            <Text style={s.title}>Purchase Complete!</Text>
            <Text style={s.packName}>{packName}</Text>

            <Animated.View style={[s.chips, bodyStyle]}>
              {chips.map((c, i) => (
                <View key={i} style={s.chip}>
                  <Image source={c.icon} style={s.chipIcon} contentFit="contain" />
                  <Text style={s.chipLabel}>{c.label}</Text>
                </View>
              ))}
            </Animated.View>

            <Pressable style={s.btn} onPress={clear}>
              <Text style={s.btnText}>Awesome!</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  card:     { width: SCREEN_W * 0.85, borderRadius: 24, overflow: 'hidden', elevation: 8 },
  cardInner:{ alignItems: 'center', padding: 24, paddingBottom: 20 },
  bigIcon:  { width: 72, height: 72, marginBottom: 12 },
  title:    { fontFamily: 'Fredoka_700Bold', fontSize: 22, color: '#2D1A4E', marginBottom: 4 },
  packName: { fontFamily: 'Fredoka_500Medium', fontSize: 15, color: '#7055A0', marginBottom: 16 },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  chip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)',
              borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 4 },
  chipIcon: { width: 20, height: 20 },
  chipLabel:{ fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#2D1A4E' },
  btn:      { backgroundColor: '#9A6FD0', borderRadius: 14, paddingHorizontal: 36, paddingVertical: 12 },
  btnText:  { fontFamily: 'Fredoka_700Bold', fontSize: 16, color: '#FFFFFF' },
});
```

- [ ] **Step 2: Add to `src/components/GlobalOverlay.tsx`**

Import `PurchaseSuccessModal` and add `<PurchaseSuccessModal />` as the last child inside the `<View>`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add src/components/PurchaseSuccessModal.tsx src/components/GlobalOverlay.tsx
git commit -m "feat(shop): add PurchaseSuccessModal to GlobalOverlay"
```

---

## Task 4: Shop screen UI

**Files:**
- Rewrite: `app/(tabs)/shop.tsx`
- Modify: `src/i18n/locales/en/tabs.json`
- Modify: `src/i18n/locales/uk/tabs.json` (if exists)

**Interfaces:**
- Consumes: `DIAMOND_PACKS`, `BUNDLE_PACKS`, `BUILDER_PACKS`, `MATERIAL_PACKS` from `src/data/shopPacks.ts`
- Consumes: `useGameStore(s => s.shopPurchase)` from Task 2
- Consumes: `ShopPack` type from Task 2

- [ ] **Step 1: Add i18n keys to `src/i18n/locales/en/tabs.json`**

In the `shop` object, replace the existing keys and add:

```json
"shop": {
  "title": "Shop",
  "sections": {
    "diamonds": "Diamonds",
    "bundles": "Bundles",
    "builder": "Builder",
    "materials": "Materials"
  },
  "badges": {
    "best": "Best Value",
    "popular": "Popular"
  },
  "purchasing": "Processing...",
  "each5": "5 pcs"
}
```

Also add the same keys (translated) to `src/i18n/locales/uk/tabs.json` if that file exists:
```json
"shop": {
  "title": "Магазин",
  "sections": {
    "diamonds": "Діаманти",
    "bundles": "Бандли",
    "builder": "Будівельник",
    "materials": "Матеріали"
  },
  "badges": {
    "best": "Вигідніше",
    "popular": "Популярне"
  },
  "purchasing": "Обробляємо...",
  "each5": "5 шт"
}
```

- [ ] **Step 2: Rewrite `app/(tabs)/shop.tsx`**

```tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import TopBar from '../../src/components/TopBar';
import { useGameStore, useBalance } from '../../src/stores/gameStore';
import { useAuthStore } from '../../src/stores/authStore';
import { xpForLevel } from '../../shared/engine/xp';
import { formatNum } from '../../src/utils/format';
import {
  DIAMOND_PACKS, BUNDLE_PACKS, BUILDER_PACKS, MATERIAL_PACKS, ShopPack,
} from '../../src/data/shopPacks';

const DIAMOND_ICON = require('../../assets/img/diamond.png');
const TOKEN_ICONS: Record<string, ReturnType<typeof require>> = {
  green:  require('../../assets/img/tokens/tokenGreen.png'),
  blue:   require('../../assets/img/tokens/tokenBlue.png'),
  yellow: require('../../assets/img/tokens/tokenYellow.png'),
  purple: require('../../assets/img/tokens/tokenViolet.png'),
  red:    require('../../assets/img/tokens/tokenRed.png'),
};
const TOOL_ICONS: Record<string, ReturnType<typeof require>> = {
  briks:  require('../../assets/img/tools/briks.png'),
  glass:  require('../../assets/img/tools/glass.png'),
  nails:  require('../../assets/img/tools/nails.png'),
  screw:  require('../../assets/img/tools/screw.png'),
  wood:   require('../../assets/img/tools/wood.png'),
  cement: require('../../assets/img/tools/cement.png'),
};

// Small inline icon row showing reward types in a card
function RewardRow({ pack }: { pack: ShopPack }) {
  const items: { icon: ReturnType<typeof require>; count: number }[] = [];
  if (pack.rewards.gems)
    items.push({ icon: DIAMOND_ICON, count: pack.rewards.gems });
  if (pack.rewards.tools)
    Object.entries(pack.rewards.tools).forEach(([k, v]) => {
      if (v) items.push({ icon: TOOL_ICONS[k], count: v });
    });
  if (pack.rewards.tokens)
    Object.entries(pack.rewards.tokens).forEach(([k, v]) => {
      if (v) items.push({ icon: TOKEN_ICONS[k], count: v });
    });

  // Show first 5 items max to avoid overflow
  const visible = items.slice(0, 5);
  const more    = items.length - visible.length;

  return (
    <View style={rs.row}>
      {visible.map((it, i) => (
        <View key={i} style={rs.item}>
          <Image source={it.icon} style={rs.icon} contentFit="contain" />
          <Text style={rs.count}>+{it.count}</Text>
        </View>
      ))}
      {more > 0 && <Text style={rs.more}>+{more} more</Text>}
    </View>
  );
}
const rs = StyleSheet.create({
  row:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  item:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  icon:  { width: 16, height: 16 },
  count: { fontFamily: 'Fredoka_500Medium', fontSize: 13, color: '#3A2360' },
  more:  { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A6FD0' },
});

// Individual pack card
function PackCard({ pack, onBuy, buying }: {
  pack: ShopPack;
  onBuy: (pack: ShopPack) => void;
  buying: boolean;
}) {
  const { t } = useTranslation('tabs');
  const isMaterial = pack.section === 'materials';

  return (
    <View style={[pc.card, buying && pc.buying]}>
      {/* Badge */}
      {pack.badge && (
        <View style={[pc.badge, pack.badge === 'best' ? pc.badgeBest : pc.badgePop]}>
          <Text style={pc.badgeText}>
            {pack.badge === 'best' ? t('shop.badges.best') : t('shop.badges.popular')}
          </Text>
        </View>
      )}

      {/* Image */}
      <Image source={pack.image} style={isMaterial ? pc.imgMat : pc.img} contentFit="contain" />

      {/* Name */}
      <Text style={pc.name}>{pack.name}</Text>

      {/* Bonus label (diamonds only) */}
      {pack.bonusLabel && (
        <Text style={pc.bonus}>{pack.bonusLabel}</Text>
      )}

      {/* Reward row (non-diamond, non-material) */}
      {!isMaterial && pack.section !== 'diamonds' && <RewardRow pack={pack} />}

      {/* Material: "5 pcs" */}
      {isMaterial && (
        <Text style={pc.each5}>{t('shop.each5')}</Text>
      )}

      {/* Buy button */}
      <Pressable
        style={[pc.btn, buying && pc.btnDisabled]}
        onPress={() => !buying && onBuy(pack)}
        disabled={buying}
      >
        {buying
          ? <ActivityIndicator color="#FFF" size="small" />
          : (
            <View style={pc.btnInner}>
              {isMaterial && <Image source={DIAMOND_ICON} style={pc.gemInBtn} contentFit="contain" />}
              <Text style={pc.btnText}>{pack.price}</Text>
            </View>
          )
        }
      </Pressable>
    </View>
  );
}
const pc = StyleSheet.create({
  card:       { width: 160, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 18,
                padding: 12, alignItems: 'center', gap: 6, elevation: 3 },
  buying:     { opacity: 0.7 },
  badge:      { position: 'absolute', top: 8, right: 8, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeBest:  { backgroundColor: '#F2A227' },
  badgePop:   { backgroundColor: '#3FA535' },
  badgeText:  { fontFamily: 'Fredoka_700Bold', fontSize: 10, color: '#FFF' },
  img:        { width: 80, height: 80 },
  imgMat:     { width: 56, height: 56 },
  name:       { fontFamily: 'Fredoka_700Bold', fontSize: 15, color: '#2D1A4E', textAlign: 'center' },
  bonus:      { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#9A6FD0' },
  each5:      { fontFamily: 'Fredoka_500Medium', fontSize: 12, color: '#7055A0' },
  btn:        { backgroundColor: '#9A6FD0', borderRadius: 12, paddingHorizontal: 16,
                paddingVertical: 8, minWidth: 100, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ backgroundColor: '#BBA0E0' },
  btnInner:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gemInBtn:   { width: 14, height: 14 },
  btnText:    { fontFamily: 'Fredoka_700Bold', fontSize: 14, color: '#FFF' },
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={sh.wrap}>
      <Text style={sh.text}>{title}</Text>
      <View style={sh.line} />
    </View>
  );
}
const sh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, marginTop: 8 },
  text: { fontFamily: 'Fredoka_700Bold', fontSize: 18, color: '#2D1A4E', marginRight: 10 },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(154,111,208,0.3)' },
});

export default function ShopScreen() {
  const { t } = useTranslation('tabs');
  const balance    = useBalance();
  const playerLevel = useGameStore((s) => s.playerLevel);
  const playerXp   = useGameStore((s) => s.playerXp);
  const gems       = useGameStore((s) => s.gems);
  const player     = useAuthStore((s) => s.player);
  const shopPurchase = useGameStore((s) => s.shopPurchase);
  const playerName = player?.playerName ?? t('profile.guestFallbackName');

  const [buyingId, setBuyingId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleBuy = (pack: ShopPack) => {
    if (buyingId) return;
    setBuyingId(pack.id);
    timerRef.current = setTimeout(() => {
      shopPurchase(pack);
      setBuyingId(null);
    }, 3000);
  };

  const sections = [
    { key: 'diamonds', label: t('shop.sections.diamonds'), packs: DIAMOND_PACKS },
    { key: 'bundles',  label: t('shop.sections.bundles'),  packs: BUNDLE_PACKS  },
    { key: 'builder',  label: t('shop.sections.builder'),  packs: BUILDER_PACKS },
    { key: 'materials',label: t('shop.sections.materials'),packs: MATERIAL_PACKS },
  ];

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/img/backgroung/bg15.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

        <TopBar
          name={playerName}
          level={playerLevel}
          xp={playerXp}
          xpForNextLevel={xpForLevel(playerLevel)}
          coins={formatNum(balance)}
          gems={String(gems)}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {sections.map((sec) => (
            <View key={sec.key}>
              <SectionHeader title={sec.label} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
              >
                {sec.packs.map((pack) => (
                  <PackCard
                    key={pack.id}
                    pack={pack}
                    onBuy={handleBuy}
                    buying={buyingId === pack.id}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  background:    { flex: 1, backgroundColor: '#DCEFF6' },
  scroll:        { flex: 1 },
  scrollContent: { paddingTop: 8, paddingBottom: 20 },
  row:           { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
});
```

- [ ] **Step 3: Check locale file for UK**

```bash
ls /Users/Apple/IT/tinytower/src/i18n/locales/uk/ 2>/dev/null && echo "exists" || echo "no uk locale"
```

If `uk/tabs.json` exists, add the Ukrainian keys from Step 1.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -40
```

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/shop.tsx src/i18n/locales/en/tabs.json
git commit -m "feat(shop): implement shop screen with 4 sections and mock purchase flow"
```

---

## Task 5: Icon description for missing assets

**Files:**
- No code changes — document the 8 missing icons for the designer

The following images are currently placeholder `diamond.png` in `shopPacks.ts`. Replace `require('../../assets/img/diamond.png')` references with the real assets once provided:

| File expected | Description for designer |
|--------------|--------------------------|
| `assets/img/shop/bundle_starter.png` | Small diamond in center, surrounded by 5 tiny colored circles (tokens: green/blue/yellow/purple/red) and 3 tiny tool icons. Soft pastel background, green-tinted. Approx 200×200px. |
| `assets/img/shop/bundle_resource.png` | Medium diamond, all 5 token circles and 6 tool icons arranged around it. Blue-tinted background. |
| `assets/img/shop/bundle_growth.png` | Diamond with a small upward green arrow overlay, tokens and tools clustered below. Warm golden background. |
| `assets/img/shop/bundle_vip.png` | Large diamond with a golden crown above it, tokens and tools around, dark purple premium gradient background. |
| `assets/img/shop/builder_mini.png` | 3 random tool icons (e.g. briks + wood + nails) stacked/arranged, small diamond badge in corner. Light background. |
| `assets/img/shop/builder_starter.png` | All 6 tool icons in a 2×3 grid, small diamond badge in top-right corner. |
| `assets/img/shop/builder_pro.png` | All 6 tool icons in a circle arrangement, medium diamond in center. Slightly warm background. |
| `assets/img/shop/builder_master.png` | All 6 tool icons arranged around a large diamond, golden star badge in top corner. Rich warm background. |

- [ ] **Step 1: Commit placeholder note**

```bash
git add src/data/shopPacks.ts
git commit -m "chore(shop): document missing bundle/builder icon paths (using diamond.png placeholder)"
```

---

## Self-Review

**Spec coverage:**
- ✅ 6 diamond packs ($0.99–$49.99, 0–25% bonus)
- ✅ 4 general bundles (gems + tokens + tools)
- ✅ 4 builder packs (tools + gems)
- ✅ 6 individual material packs
- ✅ Mock purchase: 3s spinner on button → `shopPurchase` → success modal
- ✅ Success modal shows credited items with icons (no emoji)
- ✅ All mutations via `shop_purchase` command
- ✅ Success modal in GlobalOverlay (not local tab render)
- ✅ Section order: diamonds → bundles → builder → materials

**Placeholder scan:** None found — all code is complete and explicit.

**Type consistency:**
- `ShopPack.rewards` → `ShopRewards` used in `shopPacks.ts`, `gameStore.ts`, `PurchaseSuccessModal.tsx`
- `shop_purchase` command field names match between schema, processCommand, and store action
- `pendingPurchaseSuccess` → `clearPurchaseSuccess` consistent across store interface and modal
