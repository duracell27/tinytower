# Hotel: Evict Low-Level Workers Button + Dream Job Floor Name Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-tap "evict all workers below level 9 for 1 gem" button to the hotel panel, and fix the dream job display to always show the business/floor name first in both collapsed and expanded WorkerCard views.

**Architecture:** A new `evict_low_level_workers` engine command handles the gem deduction and bulk worker removal atomically inside `lobbyCommands.ts`, matching the pattern used by `expand_hotel`. The store exposes `evictLowLevelWorkers()` which guards against insufficient gems. The UI conditionally renders an `EvictLowLevelCard` item just before the expand-hotel card. The dream job fix is a purely presentational change in `WorkerCard.tsx`.

**Tech Stack:** TypeScript, React Native, Zod (schema validation), Zustand (store), i18next (i18n), Jest (tests).

## Global Constraints

- No confirmation dialog for bulk evict — immediate action on tap.
- Button hidden (not disabled) when no unassigned workers with `level < 9` exist in hotel.
- Workers with `assignedFloorId !== null` are never evicted by this command.
- Workers with `level === 9` are never evicted by this command.
- Insufficient gems → show `InsufficientResourcesModal` via `showInsufficientResources({ currency: 'gems', need: 1, have: state.gems })`.
- No localisation files other than `src/i18n/locales/en/hotel.json` touched.
- No changes to WorkersPanel, JobPickerSheet, or any panel other than HotelPanel.

---

### Task 1: Engine command — schema, handler, dispatch, tests

**Files:**
- Modify: `shared/schemas/command.ts`
- Modify: `shared/types/index.ts`
- Modify: `shared/engine/lobbyCommands.ts`
- Modify: `shared/engine/processCommand.ts`
- Modify: `shared/engine/__tests__/processCommand.test.ts`

**Interfaces:**
- Produces: `evict_low_level_workers` command type available in the `Command` union; `EvictLowLevelWorkersCommand` exported from `shared/types`; `processCommand` routes it through `processLobbyCommand`.

---

- [ ] **Step 1: Write the failing tests**

Append to `shared/engine/__tests__/processCommand.test.ts` (after the `evict_worker` describe block, around line 408):

```ts
function evictLowLevelCmd(): Command {
  return { id: 'cmd-ell', type: 'evict_low_level_workers', timestamp: 1000 } as Command;
}

describe('evict_low_level_workers command', () => {
  it('removes all unassigned workers with level < 9 and deducts 1 gem', () => {
    const state = makeState({
      gems: 3,
      workers: [
        makeWorker({ id: 'w1', level: 5, assignedFloorId: null }),
        makeWorker({ id: 'w2', level: 8, assignedFloorId: null }),
        makeWorker({ id: 'w3', level: 9, assignedFloorId: null }),
      ],
    });
    const result = processCommand(state, evictLowLevelCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(2);
    expect(result.state.workers.map(w => w.id)).toEqual(['w3']);
  });

  it('keeps assigned workers even if level < 9', () => {
    const state = makeState({
      gems: 1,
      workers: [
        makeWorker({ id: 'w1', level: 3, assignedFloorId: 1, assignedSlotIdx: 0 }),
        makeWorker({ id: 'w2', level: 2, assignedFloorId: null }),
      ],
    });
    const result = processCommand(state, evictLowLevelCmd(), testConfig, 1000);
    expect(result.success).toBe(true);
    expect(result.state.workers.map(w => w.id)).toEqual(['w1']);
  });

  it('fails when gems < 1', () => {
    const state = makeState({
      gems: 0,
      workers: [makeWorker({ id: 'w1', level: 5, assignedFloorId: null })],
    });
    const result = processCommand(state, evictLowLevelCmd(), testConfig, 1000);
    expect(result.success).toBe(false);
    expect(result.state.workers).toHaveLength(1);
    expect(result.state.gems).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern="processCommand" --no-coverage
```

Expected: 3 new tests FAIL with `"Argument of type ... is not assignable"` or `"Type ... has no property 'evict_low_level_workers'"`.

- [ ] **Step 3: Add schema to `shared/schemas/command.ts`**

After the `ExpandHotelCommandSchema` block (around line 119), add:

```ts
export const EvictLowLevelWorkersCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('evict_low_level_workers'),
});
```

Then add it to the `CommandSchema` discriminated union (after `DevAddGemsCommandSchema`):

```ts
export const CommandSchema = z.discriminatedUnion('type', [
  // ... existing entries ...
  DevAddGemsCommandSchema,
  EvictLowLevelWorkersCommandSchema,
]);
```

- [ ] **Step 4: Export type from `shared/types/index.ts`**

Add the import and export alongside the other command imports (find the `EvictWorkerCommandSchema` import line):

```ts
import {
  // ... existing imports ...
  EvictLowLevelWorkersCommandSchema,
} from '../schemas/command';

// ... and add near the other command type exports:
export type EvictLowLevelWorkersCommand = z.infer<typeof EvictLowLevelWorkersCommandSchema>;
```

- [ ] **Step 5: Add handler in `shared/engine/lobbyCommands.ts`**

Update the `LobbyCommand` type at the top of the file (line 16–19):

```ts
type LobbyCommand = Extract<Command, { type:
  'spawn_visitor' | 'lift_visitor' | 'collect_tip' |
  'deliver_all' | 'upgrade_elevator' | 'upgrade_lobby' | 'claim_daily_reward' | 'expand_hotel' | 'fill_lobby' |
  'evict_low_level_workers'
}>;
```

Add the case to `processLobbyCommand` (after the `'expand_hotel'` case):

```ts
case 'evict_low_level_workers':
  return handleEvictLowLevelWorkers(state);
```

Add the handler function (after the `handleExpandHotel` function):

```ts
function handleEvictLowLevelWorkers(state: GameState): ProcessResult {
  if (state.gems < 1) {
    return { success: false, state, error: 'Not enough gems' };
  }
  return {
    success: true,
    state: {
      ...state,
      gems: state.gems - 1,
      workers: state.workers.filter(w => w.level === 9 || w.assignedFloorId !== null),
    },
  };
}
```

- [ ] **Step 6: Add dispatch in `shared/engine/processCommand.ts`**

In `processCommand`, update the lobby command case list (around line 45–54) to add `'evict_low_level_workers'`:

```ts
case 'spawn_visitor':
case 'lift_visitor':
case 'collect_tip':
case 'deliver_all':
case 'upgrade_elevator':
case 'upgrade_lobby':
case 'claim_daily_reward':
case 'expand_hotel':
case 'fill_lobby':
case 'evict_low_level_workers':
  return processLobbyCommand(state, command, config, playerLevel);
```

- [ ] **Step 7: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern="processCommand" --no-coverage
```

Expected: all tests PASS, including the 3 new `evict_low_level_workers` tests.

- [ ] **Step 8: Commit**

```bash
git add shared/schemas/command.ts shared/types/index.ts shared/engine/lobbyCommands.ts shared/engine/processCommand.ts shared/engine/__tests__/processCommand.test.ts
git commit -m "feat(engine): add evict_low_level_workers command"
```

---

### Task 2: Store action

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `evict_low_level_workers` command type from Task 1.
- Produces: `evictLowLevelWorkers: () => void` available on `useGameStore`.

---

- [ ] **Step 1: Add to `GameActions` interface**

In `src/stores/gameStore.ts`, inside the `GameActions` interface (around line 55–92), add after `expandHotel`:

```ts
evictLowLevelWorkers: () => void;
```

- [ ] **Step 2: Add implementation**

In the store implementation, after the `evictWorker` action (around line 296), add:

```ts
evictLowLevelWorkers: () => {
  const state = get();
  if (state.gems < 1) {
    state.showInsufficientResources({ currency: 'gems', need: 1, have: state.gems });
    return;
  }
  executeCommand(get, set, { id: uuid(), type: 'evict_low_level_workers', timestamp: clock.now() });
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(store): add evictLowLevelWorkers action"
```

---

### Task 3: HotelPanel UI + i18n

**Files:**
- Modify: `src/components/HotelPanel.tsx`
- Modify: `src/i18n/locales/en/hotel.json`

**Interfaces:**
- Consumes: `evictLowLevelWorkers()` from Task 2.
- Produces: `EvictLowLevelCard` component rendered in the hotel list when `hasLowLevelWorkers` is true.

---

- [ ] **Step 1: Add i18n keys**

In `src/i18n/locales/en/hotel.json`, inside the `"hotelPanel"` object (after `"expandCard"`), add:

```json
"evictLowLevelCard": {
  "title": "Evict all below level 9"
}
```

- [ ] **Step 2: Update `ListItem` type in `HotelPanel.tsx`**

Find the `ListItem` type (around line 43–47):

```ts
type ListItem =
  | { kind: 'worker'; worker: Worker }
  | { kind: 'empty'; index: number }
  | { kind: 'buy' };
```

Change to:

```ts
type ListItem =
  | { kind: 'worker'; worker: Worker }
  | { kind: 'empty'; index: number }
  | { kind: 'evict-low' }
  | { kind: 'buy' };
```

- [ ] **Step 3: Wire up store action and list data**

Add `evictLowLevelWorkers` to the store selectors (after the `expandHotel` line, around line 62):

```ts
const evictLowLevelWorkers = useGameStore((s) => s.evictLowLevelWorkers);
```

Add `hasLowLevelWorkers` computation (after the `freeSeats` line, around line 70):

```ts
const hasLowLevelWorkers = unemployedWorkers.some((w: Worker) => w.level < 9);
```

Update `listData` to insert `{ kind: 'evict-low' }` before `{ kind: 'buy' }` when applicable:

```ts
const listData: ListItem[] = [
  ...unemployedWorkers.map((w): ListItem => ({ kind: 'worker', worker: w })),
  ...Array.from({ length: freeSeats }, (_, i): ListItem => ({ kind: 'empty', index: i })),
  ...(hasLowLevelWorkers ? [{ kind: 'evict-low' } as ListItem] : []),
  { kind: 'buy' },
];
```

- [ ] **Step 4: Add `handleEvictLowLevel` callback**

Add after `handleExpandHotel` (around line 152):

```ts
const handleEvictLowLevel = useCallback(() => {
  evictLowLevelWorkers();
}, [evictLowLevelWorkers]);
```

Also add `evictLowLevelWorkers` and `handleEvictLowLevel` to the `renderItem` dependency array (the deps array of `useCallback` around line 196).

- [ ] **Step 5: Handle `'evict-low'` in `renderItem`**

In the `renderItem` function, add a case before the `roomNumber` line (item.kind === 'buy' already returns early). Add after the `if (item.kind === 'buy')` block:

```ts
if (item.kind === 'evict-low') {
  return <EvictLowLevelCard onPress={handleEvictLowLevel} t={t} />;
}
```

- [ ] **Step 6: Add `EvictLowLevelCard` component**

Add after the `BuySlotCard` function (around line 370):

```tsx
function EvictLowLevelCard({
  onPress,
  t,
}: {
  onPress: () => void;
  t: (key: string) => string;
}) {
  return (
    <View style={buyStyles.card}>
      <View style={buyStyles.left}>
        <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
            stroke="#C9637E"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M9 7l6 6M15 7l-6 6"
            stroke="#C9637E"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={5} r={3} stroke="#C9637E" strokeWidth={2} />
        </Svg>
        <Text style={buyStyles.title}>{t('hotelPanel.evictLowLevelCard.title')}</Text>
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [buyStyles.btn, pressed && { opacity: 0.82 }]}
      >
        <LinearGradient colors={['#D96E8A', '#B84E6A']} style={buyStyles.btnGradient}>
          <GemIcon size={16} />
          <Text style={buyStyles.btnCost}>1</Text>
        </LinearGradient>
        <View style={buyStyles.btnShadow} />
      </Pressable>
    </View>
  );
}
```

Note: `Circle` is already imported from `react-native-svg` at the top of the file.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/HotelPanel.tsx src/i18n/locales/en/hotel.json
git commit -m "feat(ui): add evict-low-level workers button to hotel panel"
```

---

### Task 4: WorkerCard dream job floor name fix

**Files:**
- Modify: `src/components/WorkerCard.tsx`

**Interfaces:**
- Consumes: `dreamFloorName?: string` prop (already exists from HotelPanel); `gameConfig` (already imported); `worker.floorType` and `worker.dreamJob`.

---

- [ ] **Step 1: Compute `dreamBusinessName` inside `WorkerCard`**

In `WorkerCard.tsx`, inside the component body (after the `const category = ...` line, around line 40), add:

```ts
const dreamBusiness = ft?.businesses.find((b) => b.dreamJobs.includes(worker.dreamJob));
const dreamBusinessName = dreamBusiness?.name;
```

(`ft` is already computed on line 38: `const ft = gameConfig.floorTypes[worker.floorType];`)

- [ ] **Step 2: Fix collapsed row**

Find the collapsed dream job text (around line 100–102):

```tsx
<Text style={[styles.dreamJobText, { color: accent }]}>
  {`${dreamFloorName ?? category} · ${dreamJobName}`}
</Text>
```

Change to:

```tsx
<Text style={[styles.dreamJobText, { color: accent }]}>
  {`${dreamFloorName ?? dreamBusinessName ?? category} · ${dreamJobName}`}
</Text>
```

- [ ] **Step 3: Fix expanded InfoRow**

Find the expanded Dream Job info row (around line 155):

```tsx
<InfoRow label={t('workerCard.info.dreamJob')} value={dreamJobName} />
```

Change to:

```tsx
<InfoRow label={t('workerCard.info.dreamJob')} value={`${dreamFloorName ?? dreamBusinessName ?? category} · ${dreamJobName}`} />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/WorkerCard.tsx
git commit -m "fix(ui): show floor/business name first in dream job display"
```
