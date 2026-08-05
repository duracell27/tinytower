# Production Detail Popup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Long-pressing (2 s) a `ProductionCard` that has a worker opens a GlobalOverlay modal with a full revenue breakdown and worker bonus details.

**Architecture:** New `ProductionDetailModal` component reads `{ floorId, slotIdx }` from gameStore and derives all display data from store state + gameConfig. A shared `productImages.ts` utility serves both FloorCard and the new modal. The existing `onLongPress` / `Pressable` primitive in `ProductionCard` is extended with a new prop; `FloorCard` wires the store action.

**Tech Stack:** React Native, Expo Image, Reanimated (none needed for this modal — use RN `Modal`), Zustand (gameStore), i18next.

## Global Constraints

- All new notification-modals go through `GlobalOverlay` in `_layout.tsx` — never render locally inside a tab/screen.
- Do NOT open the popup when the slot has no worker.
- Popup is read-only — no navigation, no game actions inside it.
- `delayLongPress` must be exactly `2000` ms.
- Use `Fredoka_600SemiBold` / `Fredoka_500Medium` fonts, consistent with surrounding components.
- Revenue breakdown rows that have no effect (0% bonus, ×1.0 multiplier row if it would be the only one, etc.) should be omitted — see Task 3 details.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/utils/productImages.ts` | **Create** | Shared `PRODUCT_IMAGES` map (moved from FloorCard) |
| `src/components/FloorCard.tsx` | **Modify** | Remove inline `PRODUCT_IMAGES`, import from util; pass `onLongPress` to `ProductionCard` |
| `src/stores/gameStore.ts` | **Modify** | Add `productionDetailModal` state + open/close actions |
| `src/stores/__tests__/gameStore.test.ts` | **Modify** | Test open/close actions |
| `src/components/ProductionDetailModal.tsx` | **Create** | Full detail modal component |
| `src/i18n/locales/en/hotel.json` | **Modify** | Add `productionDetail` translation keys |
| `src/components/GlobalOverlay.tsx` | **Modify** | Register `ProductionDetailModal` |
| `src/components/ProductionCard.tsx` | **Modify** | Add `onLongPress?: () => void` prop |

---

### Task 1: Extract PRODUCT_IMAGES to shared utility

**Files:**
- Create: `src/utils/productImages.ts`
- Modify: `src/components/FloorCard.tsx` (lines 74–166, the `PRODUCT_IMAGES` const block)

**Interfaces:**
- Produces: `PRODUCT_IMAGES: Record<string, ImageSource>` exported from `src/utils/productImages.ts`

- [ ] **Step 1: Create `src/utils/productImages.ts`**

Cut the entire `PRODUCT_IMAGES` object from `FloorCard.tsx` lines 74–~166 and paste it here:

```ts
import type { ImageSource } from 'expo-image';

export const PRODUCT_IMAGES: Record<string, ImageSource> = {
  // Green / Food — tiers 1-3
  buns:              require('../../assets/products/buns.png'),
  pastries:          require('../../assets/products/pastries.png'),
  cakes:             require('../../assets/products/cakes.png'),
  burgers:           require('../../assets/products/burgers.png'),
  fries:             require('../../assets/products/fries.png'),
  drinks:            require('../../assets/products/drinks.png'),
  milk:              require('../../assets/products/milk.png'),
  cheese:            require('../../assets/products/cheese.png'),
  yogurt:            require('../../assets/products/yogurt.png'),
  // Blue / Service — tiers 1-3
  cards:             require('../../assets/products/cards.png'),
  loans:             require('../../assets/products/loans.png'),
  accounts:          require('../../assets/products/accounts.png'),
  scooters:          require('../../assets/products/scooters.png'),
  consoles:          require('../../assets/products/consoles.png'),
  tools:             require('../../assets/products/tools.png'),
  fillings:          require('../../assets/products/fillings.png'),
  cleaning:          require('../../assets/products/cleaning.png'),
  braces:            require('../../assets/products/braces.png'),
  // Yellow / Rest — tiers 1-3
  paintings:         require('../../assets/products/paintings.png'),
  sculptures:        require('../../assets/products/sculptures.png'),
  gallery:           require('../../assets/products/gallery.png'),
  karts:             require('../../assets/products/karts.png'),
  helmets:           require('../../assets/products/helmets.png'),
  track:             require('../../assets/products/track.png'),
  cocktails:         require('../../assets/products/cocktails.png'),
  hookahs:           require('../../assets/products/hookahs.png'),
  pizza:             require('../../assets/products/pizza.png'),
  // Purple / Fashion — tiers 1-3
  canvas_shoes:      require('../../assets/products/canvasShoes.png'),
  sneakers:          require('../../assets/products/sneakers.png'),
  custom_sneakers:   require('../../assets/products/customSneakers.png'),
  tshirts:           require('../../assets/products/tshirts.png'),
  pants:             require('../../assets/products/pants.png'),
  jackets:           require('../../assets/products/jackets.png'),
  hoodies:           require('../../assets/products/hoodies.png'),
  sweatshirts:       require('../../assets/products/sweatshirts.png'),
  caps:              require('../../assets/products/caps.png'),
  // Red / Electronics — tiers 1-3
  phones:            require('../../assets/products/phones.png'),
  cases:             require('../../assets/products/cases.png'),
  screen_protectors: require('../../assets/products/screenProtectors.png'),
  pcs:               require('../../assets/products/pcs.png'),
  laptops:           require('../../assets/products/laptops.png'),
  monitors:          require('../../assets/products/monitors.png'),
  robots:            require('../../assets/products/robots.png'),
  drones:            require('../../assets/products/drones.png'),
  spare_parts:       require('../../assets/products/spareParts.png'),
  // Green / Products — tiers 4-12
  greens:            require('../../assets/products/greens.png'),
  tomatoes:          require('../../assets/products/tomatoes.png'),
  fruits:            require('../../assets/products/fruits.png'),
  salt:              require('../../assets/products/salt.png'),
  pepper:            require('../../assets/products/pepper.png'),
  cinnamon:          require('../../assets/products/cinnamon.png'),
  shrimp:            require('../../assets/products/shrimp.png'),
  salmon:            require('../../assets/products/salmon.png'),
  caviar:            require('../../assets/products/caviar.png'),
  honeycomb:         require('../../assets/products/honeycomb.png'),
  honey:             require('../../assets/products/honey.png'),
  royal_jelly:       require('../../assets/products/royaljelly.png'),
  cocoa:             require('../../assets/products/cocoa.png'),
  chocolate_bars:    require('../../assets/products/chocolatebars.png'),
  truffles:          require('../../assets/products/truffles.png'),
  sugar:             require('../../assets/products/sugar.png'),
  spaghetti:         require('../../assets/products/spaghetti.png'),
  cereal:            require('../../assets/products/cereal.png'),
  popsicles:         require('../../assets/products/popsicles.png'),
  sundaes:           require('../../assets/products/sundaes.png'),
  gelato:            require('../../assets/products/gelato.png'),
  lemonade:          require('../../assets/products/lemonade.png'),
  apple_juice:       require('../../assets/products/applejuice.png'),
  smoothies:         require('../../assets/products/smoothies.png'),
  grapes:            require('../../assets/products/grapes.png'),
  table_wine:        require('../../assets/products/tablewine.png'),
  vintage_wine:      require('../../assets/products/vintagewine.png'),
  // Blue / Service — tiers 4-12
  stamps:            require('../../assets/products/stamps.png'),
  parcels:           require('../../assets/products/parcels.png'),
  express_delivery:  require('../../assets/products/expressdelivery.png'),
  passport_photos:   require('../../assets/products/passportphotos.png'),
  portraits:         require('../../assets/products/portraits.png'),
  wedding_shoots:    require('../../assets/products/weddingshoots.png'),
  websites:          require('../../assets/products/websites.png'),
  apps:              require('../../assets/products/apps.png'),
  design:            require('../../assets/products/design.png'),
  exterior_wash:     require('../../assets/products/exteriorwash.png'),
  interior_cleaning: require('../../assets/products/interiorcleaning.png'),
  polishing:         require('../../assets/products/polishing.png'),
  scanning:          require('../../assets/products/scanning.png'),
  printing:          require('../../assets/products/printing.png'),
  copying:           require('../../assets/products/copying.png'),
  checkups:          require('../../assets/products/checkups.png'),
  vaccinations:      require('../../assets/products/vaccinations.png'),
  surgeries:         require('../../assets/products/surgeries.png'),
  day_passes:        require('../../assets/products/daypasses.png'),
  personal_training: require('../../assets/products/personaltraining.png'),
  memberships:       require('../../assets/products/memberships.png'),
  manicures:         require('../../assets/products/manicures.png'),
  facials:           require('../../assets/products/facials.png'),
  makeup:            require('../../assets/products/makeup.png'),
  travel_insurance:  require('../../assets/products/travelinsurance.png'),
  car_insurance:     require('../../assets/products/carinsurance.png'),
  life_insurance:    require('../../assets/products/lifeinsurance.png'),
  // Yellow / Rest — tiers 4-12
  tickets:           require('../../assets/products/tickets.png'),
  popcorn:           require('../../assets/products/popcorn.png'),
  cola:              require('../../assets/products/cola.png'),
  bowling_shoes:     require('../../assets/products/bowlingshoes.png'),
  bowling_balls:     require('../../assets/products/bowlingballs.png'),
  tournaments:       require('../../assets/products/tournaments.png'),
  inflatable_rings:  require('../../assets/products/inflatablerings.png'),
  water_slides:      require('../../assets/products/waterslides.png'),
  cabanas:           require('../../assets/products/cabanas.png'),
  pepperoni:         require('../../assets/products/pepperoni.png'),
  margherita:        require('../../assets/products/margherita.png'),
  four_cheese:       require('../../assets/products/fourcheese.png'),
  tokens:            require('../../assets/products/tokens.png'),
  air_hockey:        require('../../assets/products/airhockey.png'),
  racing_simulators: require('../../assets/products/racingsimulators.png'),
  posters:           require('../../assets/products/posters.png'),
  front_row_seats:   require('../../assets/products/frontrowseats.png'),
  backstage_passes:  require('../../assets/products/backstagepasses.png'),
  carousels:         require('../../assets/products/carousels.png'),
  ferris_wheel:      require('../../assets/products/ferriswheel.png'),
  roller_coasters:   require('../../assets/products/rollercoasters.png'),
  slot_machines:     require('../../assets/products/slotmachines.png'),
  roulette:          require('../../assets/products/roulette.png'),
  poker_tables:      require('../../assets/products/pokertables.png'),
  playbills:         require('../../assets/products/playbills.png'),
  evening_shows:     require('../../assets/products/eveningshows.png'),
  private_boxes:     require('../../assets/products/privateboxes.png'),
  // Purple / Fashion — tiers 4-12
  belts:             require('../../assets/products/belts.png'),
  scarves:           require('../../assets/products/scarves.png'),
  handbags:          require('../../assets/products/handbags.png'),
  robes:             require('../../assets/products/robes.png'),
  kigurumi:          require('../../assets/products/kigurumi.png'),
  socks:             require('../../assets/products/socks.png'),
  bow_ties:          require('../../assets/products/bowties.png'),
  suits:             require('../../assets/products/suits.png'),
  evening_gowns:     require('../../assets/products/eveninggowns.png'),
  leggings:          require('../../assets/products/leggings.png'),
  tracksuits:        require('../../assets/products/tracksuits.png'),
  running_shoes:     require('../../assets/products/runningshoes.png'),
  vests:             require('../../assets/products/vests.png'),
  raincoats:         require('../../assets/products/raincoats.png'),
  fur_coats:         require('../../assets/products/furcoats.png'),
  veils:             require('../../assets/products/veils.png'),
  tuxedos:           require('../../assets/products/tuxedos.png'),
  bridal_gowns:      require('../../assets/products/bridalgowns.png'),
  denim_shorts:      require('../../assets/products/denimshorts.png'),
  jeans:             require('../../assets/products/jeans.png'),
  denim_jackets:     require('../../assets/products/denimjackets.png'),
  rings:             require('../../assets/products/rings.png'),
  necklaces:         require('../../assets/products/necklaces.png'),
  diamonds:          require('../../assets/products/diamonds.png'),
  body_sprays:       require('../../assets/products/bodysprays.png'),
  perfumes:          require('../../assets/products/perfumes.png'),
  luxury_fragrances: require('../../assets/products/luxuryfragrances.png'),
  // Red / Electronics — tiers 4-12
  gamepads:          require('../../assets/products/gamepads.png'),
  keyboards:         require('../../assets/products/keyboards.png'),
  gaming_chairs:     require('../../assets/products/gamingchairs.png'),
  smartwatches:      require('../../assets/products/smartwatches.png'),
  fitness_bands:     require('../../assets/products/fitnessbands.png'),
  straps:            require('../../assets/products/straps.png'),
  tripods:           require('../../assets/products/tripods.png'),
  cameras:           require('../../assets/products/cameras.png'),
  lenses:            require('../../assets/products/lenses.png'),
  cable:             require('../../assets/products/cable.png'),
  twisted_pair:      require('../../assets/products/twistedpair.png'),
  optical_fiber:     require('../../assets/products/opticalfiber.png'),
  smart_bulbs:       require('../../assets/products/smartbulbs.png'),
  smart_locks:       require('../../assets/products/smartlocks.png'),
  home_assistants:   require('../../assets/products/homeassistants.png'),
  hard_drives:       require('../../assets/products/harddrives.png'),
  servers:           require('../../assets/products/servers.png'),
  supercomputers:    require('../../assets/products/supercomputers.png'),
  led_tvs:           require('../../assets/products/ledtvs.png'),
  oled_tvs:          require('../../assets/products/oledtvs.png'),
  home_theaters:     require('../../assets/products/hometheaters.png'),
  earbuds:           require('../../assets/products/earbuds.png'),
  headphones:        require('../../assets/products/headphones.png'),
  speakers:          require('../../assets/products/speakers.png'),
  telescopes:        require('../../assets/products/telescopes.png'),
  satellites:        require('../../assets/products/satellites.png'),
  rockets:           require('../../assets/products/rockets.png'),
};
```

- [ ] **Step 2: Update `FloorCard.tsx`**

Replace the `const PRODUCT_IMAGES` block (and its `ImageSource` import if not used elsewhere) with:

```ts
import { PRODUCT_IMAGES } from '../utils/productImages';
```

Remove `import type { ImageSource } from 'expo-image';` from FloorCard only if `ImageSource` is no longer referenced there — check the `ProductionCard` import block first.

- [ ] **Step 3: Verify app still compiles**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/productImages.ts src/components/FloorCard.tsx
git commit -m "refactor: extract PRODUCT_IMAGES to src/utils/productImages.ts"
```

---

### Task 2: gameStore — productionDetailModal state + actions

**Files:**
- Modify: `src/stores/gameStore.ts`
- Modify: `src/stores/__tests__/gameStore.test.ts`

**Interfaces:**
- Produces:
  - `productionDetailModal: { floorId: number; slotIdx: number } | null` on `UIState`
  - `openProductionDetailModal(floorId: number, slotIdx: number): void` on `GameActions`
  - `closeProductionDetailModal(): void` on `GameActions`

- [ ] **Step 1: Add field to `UIState` interface**

In `gameStore.ts`, find the `UIState` interface (around line 140–175). After the `floorUpgradeModal` line add:

```ts
productionDetailModal: { floorId: number; slotIdx: number } | null;
```

- [ ] **Step 2: Add action signatures to `GameActions` interface**

In the `GameActions` interface, after `closeFloorUpgradeModal`:

```ts
openProductionDetailModal: (floorId: number, slotIdx: number) => void;
closeProductionDetailModal: () => void;
```

- [ ] **Step 3: Add initial state**

In the `create(...)` call (the large object literal, around line 420–430), after `floorUpgradeModal: null,`:

```ts
productionDetailModal: null,
```

- [ ] **Step 4: Implement actions**

After the `closeFloorUpgradeModal` implementation (around line 472):

```ts
openProductionDetailModal: (floorId, slotIdx) =>
  set({ productionDetailModal: { floorId, slotIdx } }),
closeProductionDetailModal: () => set({ productionDetailModal: null }),
```

- [ ] **Step 5: Add to resetState**

Find the `resetState` object (around line 610–620). After `floorUpgradeModal: null,`:

```ts
productionDetailModal: null,
```

- [ ] **Step 6: Write tests**

Open `src/stores/__tests__/gameStore.test.ts`. Find an existing test for a similar modal (search for `floorUpgradeModal` or `openFloorUpgrade`). Add after it:

```ts
describe('productionDetailModal', () => {
  it('opens with floorId and slotIdx', () => {
    const store = useGameStore.getState();
    store.openProductionDetailModal(5, 1);
    expect(useGameStore.getState().productionDetailModal).toEqual({ floorId: 5, slotIdx: 1 });
  });

  it('closes by setting to null', () => {
    const store = useGameStore.getState();
    store.openProductionDetailModal(5, 1);
    store.closeProductionDetailModal();
    expect(useGameStore.getState().productionDetailModal).toBeNull();
  });
});
```

- [ ] **Step 7: Run tests**

```bash
cd /Users/Apple/IT/tinytower && npx jest src/stores/__tests__/gameStore.test.ts --no-coverage
```

Expected: new tests PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/stores/gameStore.ts src/stores/__tests__/gameStore.test.ts
git commit -m "feat(production-detail): add productionDetailModal state to gameStore"
```

---

### Task 3: ProductionDetailModal component + i18n keys

**Files:**
- Create: `src/components/ProductionDetailModal.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes:
  - `productionDetailModal` from gameStore (Task 2)
  - `closeProductionDetailModal` from gameStore (Task 2)
  - `PRODUCT_IMAGES` from `src/utils/productImages` (Task 1)
  - `FLOOR_TYPE_SCHEMES` exported from `src/components/FloorCard`
  - `getWorkerMood`, `getRevenueMultiplier`, `getWorkerForSlot`, `getFloorDiscount`, `getFloorSpecialistBonus` from `shared/engine/workerUtils`
  - `FLOOR_STAR_MULTIPLIERS` from `shared/config/floorUpgradeConfig`

- [ ] **Step 1: Add i18n keys to `hotel.json`**

Open `src/i18n/locales/en/hotel.json`. Add a new top-level key `productionDetail` (next to `productionCard`):

```json
"productionDetail": {
  "title": "Production Details",
  "worker": "Worker",
  "noWorker": "No worker assigned",
  "mood": {
    "good": "Dream job",
    "mid": "Same category",
    "bad": "Wrong floor"
  },
  "revenue": {
    "section": "Revenue per batch",
    "base": "Base",
    "stars": "Floor stars",
    "worker": "Worker",
    "specialist": "Specialist",
    "category": "Category upgrade",
    "global": "Global bonus",
    "total": "Total",
    "perMin": "/min"
  },
  "timing": {
    "delivery": "Delivery",
    "sell": "Sell time"
  },
  "cost": {
    "buy": "Buy cost",
    "discount": "-{{percent}}%"
  },
  "status": {
    "IDLE": "Idle",
    "DELIVERING": "Delivering",
    "READY_TO_LIST": "Ready to list",
    "SELLING": "Selling",
    "READY_TO_COLLECT": "Ready to collect",
    "EMPTY": "Empty"
  }
}
```

- [ ] **Step 2: Create `src/components/ProductionDetailModal.tsx`**

```tsx
import React from 'react';
import {
  View, Text, Modal, Pressable, StyleSheet, ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { gameConfig } from '../../shared/config/gameConfig';
import { FLOOR_STAR_MULTIPLIERS } from '../../shared/config/floorUpgradeConfig';
import {
  getWorkerMood,
  getRevenueMultiplier,
  getWorkerForSlot,
  getFloorDiscount,
  getFloorSpecialistBonus,
} from '../../shared/engine/workerUtils';
import WorkerAvatar from './WorkerAvatar';
import { CoinIcon } from './CurrencyIcons';
import { PRODUCT_IMAGES } from '../utils/productImages';
import { FLOOR_TYPE_SCHEMES } from './FloorCard';
import { shadeColor } from '../utils/color';
import { formatNum } from '../utils/format';

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return i18n.t('hotel:productionCard.time.seconds', { count: totalSec });
  const min = Math.floor(totalSec / 60);
  if (min < 60) return i18n.t('hotel:productionCard.time.minutes', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return i18n.t('hotel:productionCard.time.hours', { count: hours });
  return i18n.t('hotel:productionCard.time.days', { count: Math.floor(hours / 24) });
}

export default function ProductionDetailModal() {
  const { t } = useTranslation('hotel');
  const { t: tContent } = useTranslation('gameContent');

  const modal = useGameStore((s) => s.productionDetailModal);
  const close = useGameStore((s) => s.closeProductionDetailModal);
  const workers = useGameStore((s) => s.workers);
  const floors = useGameStore((s) => s.floors);
  const floorStars = useGameStore((s) => s.floorStars);
  const businessUpgrades = useGameStore((s) => s.businessUpgrades);
  const coinBonusPercent = useGameStore((s) => s.coinBonusPercent);
  const openedFloorTypes = useGameStore((s) => s.openedFloorTypes);

  if (!modal) return null;

  const { floorId, slotIdx } = modal;

  const floor = floors.find((f) => f.id === floorId);
  if (!floor) return null;

  const production = floor.productions[slotIdx];
  if (!production) return null;

  const worker = getWorkerForSlot(workers, floorId, slotIdx);
  if (!worker) return null;

  const floorConfig = gameConfig.floors.find((f) => f.id === floorId);
  const floorType = floorConfig?.floorType ?? openedFloorTypes?.[String(floorId)] ?? null;
  const availableTypes = floorConfig?.availableTypes
    ?? floor.productions.map((p) => p.typeId).filter((id): id is string => id !== null);

  const typeId = production.typeId ?? availableTypes[slotIdx] ?? null;
  const typeConfig = typeId ? gameConfig.productionTypes[typeId] : null;

  const stars = floorStars?.[String(floorId)] ?? 0;
  const starMult = FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];

  const mood = floorType && typeId ? getWorkerMood(worker, floorType, typeId) : 'bad';
  const multiplier = floorType && typeId ? getRevenueMultiplier(worker, floorType, typeId) : 1;

  const discount = getFloorDiscount(workers, floorId);
  const specialistBonus = getFloorSpecialistBonus(workers, floorId);
  const specialistBonusPercent = Math.round(specialistBonus * 100);
  const categoryBonus = floorType
    ? (businessUpgrades?.[floorType as keyof typeof businessUpgrades] ?? 0) * 5
    : 0;

  const baseRevenue = typeConfig?.batchValue ?? 0;
  const starValueMult = starMult.value;
  const effectiveRevenue = typeConfig
    ? Math.floor(
        typeConfig.batchValue *
          starValueMult *
          (1 + (coinBonusPercent + specialistBonusPercent + categoryBonus) / 100) *
          multiplier,
      )
    : 0;

  const deliveryDuration = typeConfig?.deliveryDuration ?? 0;
  const effectiveSellDuration = typeConfig ? typeConfig.sellDuration * starMult.time : 0;
  const totalCycleDuration = deliveryDuration + effectiveSellDuration;
  const revenuePerMin =
    totalCycleDuration > 0
      ? Math.round((effectiveRevenue / totalCycleDuration) * 60_000)
      : 0;

  const effectiveCost = typeConfig
    ? Math.floor(typeConfig.buyCost * starMult.cost * (1 - discount))
    : 0;
  const discountPercent = Math.round(discount * 100);

  const productTitle = tContent(`productionTypes.${typeId}.displayName`, {
    defaultValue: typeId ?? '',
  });
  const productImage = typeId
    ? (PRODUCT_IMAGES[typeId] ?? PRODUCT_IMAGES[availableTypes[0]])
    : null;

  const scheme = (floorType ? FLOOR_TYPE_SCHEMES[floorType] : undefined) ?? FLOOR_TYPE_SCHEMES.green;
  const accentColor = scheme.color;
  const headerBg = shadeColor(accentColor, -10);

  const moodColor =
    mood === 'good' ? '#72C24F' : mood === 'mid' ? '#F2AC40' : '#9098A6';
  const moodLabel =
    mood === 'good'
      ? t('productionDetail.mood.good')
      : mood === 'mid'
      ? t('productionDetail.mood.mid')
      : t('productionDetail.mood.bad');

  const multiplierText =
    multiplier === 2.0 ? '×2.0' : multiplier === 1.3 ? '×1.3' : '×1.0';

  const statusKey = production.stage as keyof typeof statusLabels;
  const statusLabels: Record<string, string> = {
    IDLE: t('productionDetail.status.IDLE'),
    DELIVERING: t('productionDetail.status.DELIVERING'),
    READY_TO_LIST: t('productionDetail.status.READY_TO_LIST'),
    SELLING: t('productionDetail.status.SELLING'),
    READY_TO_COLLECT: t('productionDetail.status.READY_TO_COLLECT'),
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            {productImage && (
              <Image source={productImage} style={styles.productImage} contentFit="contain" />
            )}
            <View style={styles.headerText}>
              <Text style={styles.productName} numberOfLines={1}>
                {productTitle}
              </Text>
              <Text style={styles.statusLabel}>
                {statusLabels[production.stage] ?? production.stage}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Worker row */}
            <View style={styles.section}>
              <View style={styles.workerRow}>
                <View style={[styles.avatarWrap, worker.isSpecialist && { borderColor: '#F5C842' }]}>
                  <WorkerAvatar worker={worker} size={40} />
                </View>
                <View style={styles.workerInfo}>
                  <Text style={styles.workerName} numberOfLines={1}>
                    {worker.name}
                  </Text>
                  <Text style={styles.workerLevel}>Lv{worker.level}</Text>
                  {worker.isSpecialist && (
                    <View style={styles.specialistBadge}>
                      <Text style={styles.specialistBadgeText}>★</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.moodChip, { backgroundColor: moodColor }]}>
                  <Text style={styles.moodChipText}>
                    {moodLabel} {multiplierText}
                  </Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Revenue breakdown */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('productionDetail.revenue.section')}</Text>

              <BreakdownRow
                label={t('productionDetail.revenue.base')}
                value={<><Text style={styles.rowValue}>{formatNum(baseRevenue)}</Text><CoinIcon size={13} /></>}
              />

              {stars > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.stars')}
                  value={<Text style={styles.rowValue}>×{starValueMult.toFixed(1)}</Text>}
                />
              )}

              <BreakdownRow
                label={t('productionDetail.revenue.worker')}
                value={<Text style={[styles.rowValue, { color: moodColor }]}>{multiplierText}</Text>}
              />

              {specialistBonusPercent > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.specialist')}
                  value={<Text style={styles.rowValue}>+{specialistBonusPercent}%</Text>}
                />
              )}

              {categoryBonus > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.category')}
                  value={<Text style={styles.rowValue}>+{categoryBonus}%</Text>}
                />
              )}

              {coinBonusPercent > 0 && (
                <BreakdownRow
                  label={t('productionDetail.revenue.global')}
                  value={<Text style={styles.rowValue}>+{coinBonusPercent}%</Text>}
                />
              )}

              <View style={styles.rowDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('productionDetail.revenue.total')}</Text>
                <View style={styles.totalValueRow}>
                  <Text style={styles.totalValue}>{formatNum(effectiveRevenue)}</Text>
                  <CoinIcon size={14} />
                  {revenuePerMin > 0 && (
                    <Text style={styles.perMin}>
                      {' '}({formatNum(revenuePerMin)}{t('productionDetail.revenue.perMin')})
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Timings + cost */}
            <View style={styles.section}>
              {deliveryDuration > 0 && (
                <BreakdownRow
                  label={t('productionDetail.timing.delivery')}
                  value={<Text style={styles.rowValue}>{formatDuration(deliveryDuration)}</Text>}
                />
              )}
              {effectiveSellDuration > 0 && (
                <BreakdownRow
                  label={t('productionDetail.timing.sell')}
                  value={<Text style={styles.rowValue}>{formatDuration(effectiveSellDuration)}</Text>}
                />
              )}
              {effectiveCost > 0 && (
                <BreakdownRow
                  label={t('productionDetail.cost.buy')}
                  value={
                    <View style={styles.costValueRow}>
                      <Text style={styles.rowValue}>{formatNum(effectiveCost)}</Text>
                      <CoinIcon size={13} />
                      {discountPercent > 0 && (
                        <Text style={styles.discountLabel}>
                          {t('productionDetail.cost.discount', { percent: discountPercent })}
                        </Text>
                      )}
                    </View>
                  }
                />
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function BreakdownRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>{value}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  productImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 17,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    textTransform: 'capitalize',
  },
  statusLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  body: {
    flexShrink: 1,
  },
  bodyContent: {
    paddingBottom: 32,
  },
  section: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11,
    color: '#9098A6',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E7EBF1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  workerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workerName: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#2A3344',
    textTransform: 'capitalize',
    flexShrink: 1,
  },
  workerLevel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#9098A6',
  },
  specialistBadge: {
    backgroundColor: '#F5C842',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  specialistBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 10,
    color: '#fff',
  },
  moodChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moodChipText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 12,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 18,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 13.5,
    color: '#6A7284',
  },
  rowValue: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13.5,
    color: '#2A3344',
  },
  rowValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#2A3344',
  },
  totalValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  totalValue: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 15,
    color: '#2A3344',
  },
  perMin: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 11.5,
    color: '#9098A6',
  },
  costValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountLabel: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 11.5,
    color: '#72C24F',
  },
});
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProductionDetailModal.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(production-detail): add ProductionDetailModal component"
```

---

### Task 4: Wire up — GlobalOverlay + ProductionCard prop + FloorCard usage

**Files:**
- Modify: `src/components/GlobalOverlay.tsx`
- Modify: `src/components/ProductionCard.tsx`
- Modify: `src/components/FloorCard.tsx`

**Interfaces:**
- Consumes:
  - `ProductionDetailModal` from Task 3
  - `openProductionDetailModal(floorId, slotIdx)` from gameStore (Task 2)
  - `onLongPress?: () => void` prop on `ProductionCard` (added in this task)

- [ ] **Step 1: Register modal in GlobalOverlay**

In `src/components/GlobalOverlay.tsx`, add import and render:

```tsx
import ProductionDetailModal from './ProductionDetailModal';

// Inside the return's View:
<ProductionDetailModal />
```

Full file after edit:

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import AchievementModal from './AchievementModal';
import LevelUpModal from './LevelUpModal';
import ReferralNotificationModal from './ReferralNotificationModal';
import DailyLoginRewardModal from './DailyLoginRewardModal';
import InsufficientResourcesModal from './InsufficientResourcesModal';
import TokenInsufficientModal from './TokenInsufficientModal';
import TaskRewardModal from './TaskRewardModal';
import HotelFullNoticeModal from './HotelFullNoticeModal';
import PurchaseSuccessModal from './PurchaseSuccessModal';
import FloorUpgradeModal from './FloorUpgradeModal';
import ProductionDetailModal from './ProductionDetailModal';

export default function GlobalOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <AchievementModal />
      <LevelUpModal />
      <ReferralNotificationModal />
      <DailyLoginRewardModal />
      <InsufficientResourcesModal />
      <TokenInsufficientModal />
      <TaskRewardModal />
      <HotelFullNoticeModal />
      <PurchaseSuccessModal />
      <FloorUpgradeModal />
      <ProductionDetailModal />
    </View>
  );
}
```

- [ ] **Step 2: Add `onLongPress` prop to `ProductionCard`**

In `src/components/ProductionCard.tsx`:

2a. Add to `ProductionCardProps` interface (after `gems: number`):

```ts
onLongPress?: () => void;
```

2b. Destructure it in the function signature:

```ts
export default function ProductionCard({
  // ... existing props ...
  gems,
  onLongPress,
}: ProductionCardProps) {
```

2c. Wrap the outermost `<View style={[styles.card, ...]}>` with a `Pressable`. **Both branches** (the `isLocked` early return and the main return) need wrapping.

For the **locked** (no worker) branch — no long-press needed, keep as `View`:

```tsx
// isLocked branch — unchanged, already returns early without onLongPress
return (
  <View style={[styles.card, { backgroundColor: cardBg }]}>
    {/* ... unchanged ... */}
  </View>
);
```

For the **main** return, replace the outer `<View style={[styles.card, ...]}>` with:

```tsx
return (
  <Pressable
    style={[styles.card, { backgroundColor: cardBg }]}
    onLongPress={onLongPress}
    delayLongPress={2000}
  >
    {/* ... all existing content unchanged ... */}
  </Pressable>
);
```

`Pressable` accepts `style` the same way `View` does (no `({ pressed })` function needed here since we don't change appearance on long-press).

- [ ] **Step 3: Pass `onLongPress` from `FloorCard`**

In `src/components/FloorCard.tsx`, inside `FloorCardInner`:

3a. Read the store action (near the other `useGameStore` selectors):

```ts
const openProductionDetailModal = useGameStore((s) => s.openProductionDetailModal);
```

3b. In the `floor.productions.map(...)` block, add `onLongPress` to each `<ProductionCard>`:

```tsx
<ProductionCard
  // ... all existing props unchanged ...
  onLongPress={
    slotWorker
      ? () => openProductionDetailModal(floorId, idx)
      : undefined
  }
/>
```

The guard `slotWorker ? ... : undefined` ensures no popup when the slot has no worker (matching the spec).

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: zero new errors.

- [ ] **Step 5: Manual smoke test**

Start the app and navigate to the hotel floor list. Long-press (hold 2 s) on a production card that has a worker assigned. Verify:
- Popup opens with correct product name and image.
- Worker avatar, name, level, isSpecialist badge visible.
- Mood chip shows correct colour and multiplier (green ×2.0 for dream job, yellow ×1.3, grey ×1.0).
- Revenue breakdown rows appear only for active bonuses.
- Total revenue and /min values match what `ProductionCard` computes.
- Delivery and sell durations shown correctly.
- Buy cost and discount % shown when applicable.
- Tapping outside the sheet closes it.
- Long-pressing a card with no worker (hire slot) does nothing.

- [ ] **Step 6: Commit**

```bash
git add src/components/GlobalOverlay.tsx src/components/ProductionCard.tsx src/components/FloorCard.tsx
git commit -m "feat(production-detail): wire long-press popup end-to-end"
```
