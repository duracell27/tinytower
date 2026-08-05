# VIP Visitors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VIP variants of all 5 elevator visitor types, each spawning with a 2% chance and producing amplified effects.

**Architecture:** `isVip: boolean` flag on `Visitor` schema propagates from spawn command through state; `applyVisitorEffect` branches on `isVip` per role; store pre-generates all randomness (workers, tools) before dispatching commands.

**Tech Stack:** TypeScript, Zod, Zustand, React Native (Expo), Jest

## Global Constraints

- Never roll dice in the engine — all randomness is pre-computed in the store and embedded in the command
- All new schema fields are optional (`z.boolean().optional()`) for backward compat with persisted commands
- `applyVisitorEffect` is pure — same inputs always produce same output
- VIP businessman gives the same number of gems as regular (just tip × 10 as fallback when at limit)
- VIP builder: if `state.underConstruction` has entry for `targetFloor` → complete construction (set `startedAt = now - durationMs`); otherwise → award 2 tools
- VIP seller: complete the SELLING slot with the longest remaining time (`typeConfig.sellDuration - (now - p.stageStartedAt)`)
- VIP deliverer: fully complete the active DELIVERING slot on `targetFloor`
- VIP guest at floor 1: fill hotel to `hotelCapacity` with pre-generated workers

---

## File Map

| File | Change |
|------|--------|
| `shared/schemas/visitor.ts` | Add `isVip?: boolean` |
| `shared/schemas/command.ts` | Add `isVip?` to `SpawnVisitorCommandSchema`; add `newWorkers?` + `builderTools?` to `CollectTipCommandSchema`; add `vipGuestWorkerBatches?` to `DeliverAllCommandSchema`; add `isVip?` to `FillLobbyCommandSchema` visitor objects |
| `shared/engine/lobbyUtils.ts` | `generateRandomVisitorRole` returns `isVip: boolean` |
| `shared/engine/lobbyCommands.ts` | `applyVisitorEffect` VIP logic; `handleCollectTip` + `handleDeliverAll` track `vipsLifted`; `handleSpawnVisitor` + `handleFillLobby` propagate `isVip` |
| `src/stores/gameStore.ts` | `spawnVisitor` + `fillLobby` propagate `isVip`; `collectTip` + `deliverAll` pre-generate VIP data |
| `src/components/LobbyPanel.tsx` | Golden background on VIP icon; "VIP Guest" etc. label |
| `src/i18n/locales/en/lobby.json` | Add VIP role label keys |
| `shared/engine/__tests__/lobbyCommands.test.ts` | Tests for VIP effects + stats |
| `shared/engine/__tests__/lobbyUtils.test.ts` | Test `isVip` in `generateRandomVisitorRole` |

---

### Task 1: Schema — add `isVip` to Visitor and relevant commands

**Files:**
- Modify: `shared/schemas/visitor.ts`
- Modify: `shared/schemas/command.ts`

**Interfaces:**
- Produces: `Visitor.isVip?: boolean`; `SpawnVisitorCommand.isVip?: boolean`; `CollectTipCommand.newWorkers?`, `CollectTipCommand.builderTools?`; `DeliverAllCommand.vipGuestWorkerBatches?`; `FillLobbyCommand` visitor objects with `isVip?`

- [ ] **Step 1: Add `isVip` to VisitorSchema**

In `shared/schemas/visitor.ts`, add one field:

```ts
export const VisitorSchema = z.object({
  id: z.string(),
  role: VisitorRoleSchema.optional(),
  isVip: z.boolean().optional(),          // NEW
  targetFloor: z.number().int().positive().optional(),
  hairColor: z.string(),
  female: z.boolean(),
  pendingFloorType: z.string().optional(),
});
```

- [ ] **Step 2: Add `isVip` to SpawnVisitorCommandSchema**

In `shared/schemas/command.ts`, `SpawnVisitorCommandSchema`:

```ts
export const SpawnVisitorCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('spawn_visitor'),
  visitorId: z.string(),
  role: VisitorRoleSchema,
  isVip: z.boolean().optional(),           // NEW
  targetFloor: z.number().int().positive(),
  hairColor: z.string(),
  female: z.boolean(),
  pendingFloorType: z.string().optional(),
});
```

- [ ] **Step 3: Add `newWorkers` and `builderTools` to CollectTipCommandSchema**

Keep existing `newWorker` and `builderTool` for backward compat. Add new optional fields:

```ts
const WorkerDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  female: z.boolean(),
  floorType: z.string(),
  dreamJob: z.string(),
  level: z.number().int().min(1).max(9),
  hairColor: z.string(),
});

export const CollectTipCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('collect_tip'),
  newWorker: WorkerDataSchema.optional(),       // kept for backward compat
  newWorkers: z.array(WorkerDataSchema).optional(),  // NEW — VIP guest hotel fill
  builderTool: ToolKeySchema.optional(),        // kept for backward compat
  builderTools: z.array(ToolKeySchema).optional(),   // NEW — VIP builder tools (0 = complete construction, 2 = give tools)
});
```

Note: `WorkerDataSchema` is the same shape as the existing inline object in `CollectTipCommandSchema`. Extract it as a named const above `CollectTipCommandSchema`.

- [ ] **Step 4: Add `vipGuestWorkerBatches` to DeliverAllCommandSchema**

```ts
export const DeliverAllCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('deliver_all'),
  builderTools: z.array(ToolKeySchema).optional(),
  preGeneratedWorkers: z.array(WorkerDataSchema).optional(),
  vipGuestWorkerBatches: z.array(z.array(WorkerDataSchema)).optional(),  // NEW — one batch per VIP guest heading to floor 1
});
```

- [ ] **Step 5: Add `isVip` to FillLobbyCommandSchema visitor objects**

```ts
export const FillLobbyCommandSchema = TimestampedBaseSchema.extend({
  type: z.literal('fill_lobby'),
  visitors: z.array(z.object({
    visitorId: z.string(),
    role: VisitorRoleSchema,
    isVip: z.boolean().optional(),    // NEW
    targetFloor: z.number().int().positive(),
    hairColor: z.string(),
    female: z.boolean(),
    pendingFloorType: z.string().optional(),
  })),
});
```

- [ ] **Step 6: Run tests to verify schemas compile**

```bash
npx jest --testPathPattern="schemas" --passWithNoTests
```

Expected: PASS (or no schema-specific tests — that is fine)

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/visitor.ts shared/schemas/command.ts
git commit -m "feat(vip): add isVip to Visitor schema and command schemas"
```

---

### Task 2: Spawning — `generateRandomVisitorRole` returns `isVip`

**Files:**
- Modify: `shared/engine/lobbyUtils.ts`
- Test: `shared/engine/__tests__/lobbyUtils.test.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `generateRandomVisitorRole` return type includes `isVip: boolean`

- [ ] **Step 1: Write failing test**

Add to `shared/engine/__tests__/lobbyUtils.test.ts`:

```ts
describe('generateRandomVisitorRole — VIP', () => {
  it('returns isVip: false when Math.random is above 0.02', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = makeState();
    const result = generateRandomVisitorRole(state, testConfig, Date.now(), 1);
    expect(result.isVip).toBe(false);
    jest.restoreAllMocks();
  });

  it('returns isVip: true when Math.random first call is below 0.02', () => {
    // First Math.random call in generateRandomVisitorRole is the builderChance check,
    // second is the vip roll. We need to control the sequence.
    const values = [0.5, 0.01, 0.5, 0.5]; // builderChance=miss, vip=hit, role=guest, floor=...
    let idx = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => values[idx++] ?? 0.5);
    const state = makeState();
    const result = generateRandomVisitorRole(state, testConfig, Date.now(), 1);
    expect(result.isVip).toBe(true);
    jest.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest --testPathPattern="lobbyUtils" -t "VIP"
```

Expected: FAIL — `isVip` property does not exist on return value

- [ ] **Step 3: Add `isVip` to `generateRandomVisitorRole`**

In `shared/engine/lobbyUtils.ts`, change the return of `generateRandomVisitorRole`:

```ts
export function generateRandomVisitorRole(
  state: GameState,
  config: GameConfig,
  now: number,
  playerLevel = 1,
): { role: VisitorRole; targetFloor: number; isVip: boolean } {  // updated return type
  // ... existing logic unchanged until the final return ...

  // Add VIP roll after targetFloor is determined (before the return statement):
  const isVip = Math.random() < 0.02;

  return { role, targetFloor, isVip };
}
```

Also update the deprecated `generateRandomVisitor` to propagate `isVip`:

```ts
export function generateRandomVisitor(state: GameState, config: GameConfig, now = Date.now()): Visitor {
  const { role, targetFloor, isVip } = generateRandomVisitorRole(state, config, now, 1);
  return {
    ...generateVisitorAppearance(),
    role,
    isVip,
    targetFloor,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="lobbyUtils"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/engine/lobbyUtils.ts shared/engine/__tests__/lobbyUtils.test.ts
git commit -m "feat(vip): generateRandomVisitorRole returns isVip flag (2% chance)"
```

---

### Task 3: Engine — VIP effects in `applyVisitorEffect`

**Files:**
- Modify: `shared/engine/lobbyCommands.ts`
- Test: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Consumes: `Visitor.isVip?`, `now: number` (new param), `preGeneratedWorkerBatch?: WorkerData[]`, `preGeneratedTools?: string[]`
- Produces: updated `applyVisitorEffect` signature; updated `handleCollectTip`; updated `handleDeliverAll` tool/worker indexing

- [ ] **Step 1: Write failing tests for VIP effects**

Add to `shared/engine/__tests__/lobbyCommands.test.ts`:

```ts
describe('VIP visitor effects — collect_tip', () => {
  function makeVipVisitor(role: string, targetFloor: number): Visitor {
    return { id: 'vip1', role: role as any, isVip: true, targetFloor, hairColor: '#000', female: false };
  }

  it('VIP guest at floor 1 fills hotel to capacity', () => {
    const workers = [{ id: 'w1', name: 'A', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000', assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }];
    const state = makeState({ hotelCapacity: 3, workers, lobbyVisitors: [makeVipVisitor('guest', 1)] });
    // Pre-generate 2 workers (3 - 1 occupied)
    const w2 = { id: 'w2', name: 'B', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000' };
    const w3 = { id: 'w3', name: 'C', female: false, floorType: 'green', dreamJob: 'coffee', level: 1, hairColor: '#000' };
    const cmd: Command = {
      id: 'c1', type: 'collect_tip', timestamp: 1000,
      newWorkers: [w2, w3],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.success).toBe(true);
    // Hotel should have 3 unassigned workers
    const unassigned = result.state.workers.filter(w => w.assignedFloorId === null);
    expect(unassigned).toHaveLength(3);
  });

  it('VIP guest at floor 1 gets tip × 10', () => {
    const state = makeState({ hotelCapacity: 0, lobbyVisitors: [makeVipVisitor('guest', 3)] });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const before = state.balance;
    const result = processCommand(state, cmd, testConfig, 1000);
    // Regular tip = guestTipBase(10) * elevatorLevel(1) * floor(3) = 30; VIP = 300
    expect(result.state.balance - before).toBe(300);
  });

  it('VIP businessman fallback tip is × 10', () => {
    const gemLimit = testConfig.lobbyConfig.dailyGemLimitBase + 1;
    const state = makeState({ dailyGemsCollected: gemLimit, lobbyVisitors: [makeVipVisitor('businessman', 3)] });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const before = state.balance;
    const result = processCommand(state, cmd, testConfig, 1000);
    // Regular fallback = businessmanFallbackBase(100) * elevatorLevel(1) * floor(3) = 300; VIP = 3000
    expect(result.state.balance - before).toBe(3000);
  });

  it('VIP businessman still gives only 1 gem', () => {
    const state = makeState({ gems: 5, dailyGemsCollected: 0, lobbyVisitors: [makeVipVisitor('businessman', 2)] });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.gems - state.gems).toBe(1);
    expect(result.state.dailyGemsCollected).toBe(1);
  });

  it('VIP builder gives 2 tools when no construction on target floor', () => {
    const state = makeState({ lobbyVisitors: [makeVipVisitor('builder', 3)], underConstruction: [] });
    const cmd: Command = {
      id: 'c1', type: 'collect_tip', timestamp: 1000,
      builderTools: ['wood', 'cement'],
    };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.tools?.wood).toBe(1);
    expect(result.state.tools?.cement).toBe(1);
  });

  it('VIP builder completes construction when target floor is under construction', () => {
    const now = 5000;
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('builder', 2)],
      underConstruction: [{ floorId: 2, startedAt: 0, durationMs: 60_000, requiredTools: [], selectedFloorType: null }],
    });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now, builderTools: [] };
    const result = processCommand(state, cmd, testConfig, now);
    const uc = result.state.underConstruction.find(u => u.floorId === 2)!;
    // startedAt should be set so now - startedAt >= durationMs
    expect(now - uc.startedAt).toBeGreaterThanOrEqual(60_000);
  });

  it('VIP deliverer fully completes DELIVERING slot', () => {
    const now = 1000;
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('deliverer', 2)],
      floors: [{
        id: 2, floorType: 'green', productions: [
          { typeId: 'coffee', stage: 'DELIVERING', stageStartedAt: 0 },
        ],
      }],
    });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now };
    const result = processCommand(state, cmd, testConfig, now);
    const prod = result.state.floors.find(f => f.id === 2)!.productions[0];
    // deliveryDuration = 5000; stageStartedAt should be now - 5000 = -4000
    expect(now - prod.stageStartedAt).toBeGreaterThanOrEqual(5000);
  });

  it('VIP seller completes the SELLING slot with longest remaining time', () => {
    const now = 1000;
    // Two selling slots: one started at 500 (remaining 9500), one at 0 (remaining 9000)
    // Should complete slot started at 500 (longest remaining)
    const state = makeState({
      lobbyVisitors: [makeVipVisitor('seller', 2)],
      floors: [{
        id: 2, floorType: 'green', productions: [
          { typeId: 'coffee', stage: 'SELLING', stageStartedAt: 500 },  // remaining = 10000 - 500 = 9500
          { typeId: 'coffee', stage: 'SELLING', stageStartedAt: 0 },    // remaining = 10000 - 1000 = 9000
        ],
      }],
    });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: now };
    const result = processCommand(state, cmd, testConfig, now);
    const prods = result.state.floors.find(f => f.id === 2)!.productions;
    // The slot with stageStartedAt=500 should be completed (now - stageStartedAt >= sellDuration)
    expect(now - prods[0].stageStartedAt).toBeGreaterThanOrEqual(10000);
    // The other slot should be unchanged
    expect(prods[1].stageStartedAt).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern="lobbyCommands" -t "VIP visitor effects"
```

Expected: FAIL — various assertions fail because VIP logic not yet implemented

- [ ] **Step 3: Update `applyVisitorEffect` signature**

Change `applyVisitorEffect` in `shared/engine/lobbyCommands.ts`:

```ts
function applyVisitorEffect(
  state: GameState,
  visitor: Visitor,
  config: GameConfig,
  playerLevel: number,
  now: number,                                    // NEW
  preGeneratedWorkerBatch?: { id: string; name: string; female: boolean; floorType: string; dreamJob: string; level: number; hairColor: string }[],  // changed from single to array
  preGeneratedTools?: string[],                   // changed from single string to array
): GameState {
```

- [ ] **Step 4: Implement VIP effects in `applyVisitorEffect`**

Replace the body of `applyVisitorEffect` with VIP-aware logic:

```ts
  const role = visitor.role ?? 'guest';
  const isVip = visitor.isVip ?? false;
  const targetFloor = visitor.targetFloor ?? 1;
  const tip = calculateTip(role, targetFloor, state.elevatorLevel, config);
  const vipMultiplier = isVip ? 10 : 1;
  let { balance, gems, dailyTips, dailyGemsCollected, workers, floors } = state;
  let tools = state.tools ?? { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 };
  let underConstruction = state.underConstruction;
  const workersBefore = workers.length;

  if (role === 'businessman') {
    const gemLimit = config.lobbyConfig.dailyGemLimitBase + playerLevel;
    if (dailyGemsCollected < gemLimit) {
      gems += 1;
      dailyGemsCollected += 1;
    } else {
      balance += tip * vipMultiplier;
      dailyTips += tip * vipMultiplier;
    }
  } else if (role === 'builder') {
    if (isVip) {
      const ucEntry = underConstruction.find((uc) => uc.floorId === targetFloor);
      if (ucEntry) {
        // Complete construction: set startedAt so timer is expired
        underConstruction = underConstruction.map((uc) =>
          uc.floorId === targetFloor ? { ...uc, startedAt: now - uc.durationMs } : uc,
        );
      } else {
        // Give 2 tools
        for (const key of preGeneratedTools ?? []) {
          if (key in tools) {
            tools = { ...tools, [key]: tools[key as keyof typeof tools] + 1 };
          }
        }
      }
    } else {
      const key = preGeneratedTools?.[0];
      if (key && key in tools) {
        tools = { ...tools, [key]: tools[key as keyof typeof tools] + 1 };
      }
    }
  } else {
    balance += tip * vipMultiplier;
    dailyTips += tip * vipMultiplier;
  }

  if (role === 'guest' && targetFloor === 1) {
    const hotelOccupied = workers.filter((w) => w.assignedFloorId === null).length;
    if (isVip) {
      // Fill hotel to capacity
      for (const workerData of preGeneratedWorkerBatch ?? []) {
        if (workers.filter((w) => w.assignedFloorId === null).length < state.hotelCapacity) {
          workers = [...workers, { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }];
        }
      }
    } else if (hotelOccupied < state.hotelCapacity) {
      const workerData = preGeneratedWorkerBatch?.[0] ?? generateRandomWorkers(1, config)[0];
      workers = [...workers, { ...workerData, assignedFloorId: null, assignedSlotIdx: null, isSpecialist: false }];
    }
  }

  const residentsGained = workers.length - workersBefore;

  if (role === 'deliverer') {
    const floorIdx = floors.findIndex((f) => f.id === targetFloor);
    if (floorIdx !== -1) {
      const slotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'DELIVERING');
      if (slotIdx !== -1) {
        const typeId = floors[floorIdx].productions[slotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          const newStageStartedAt = isVip
            ? now - typeConfig.deliveryDuration           // fully complete
            : p.stageStartedAt - Math.floor(typeConfig.deliveryDuration * config.lobbyConfig.deliverySpeedBonus);  // reduce
          // Note: use the slot's existing stageStartedAt for reduction; reference it inline:
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== slotIdx) return p;
                const updated = isVip
                  ? now - typeConfig.deliveryDuration
                  : p.stageStartedAt - Math.floor(typeConfig.deliveryDuration * config.lobbyConfig.deliverySpeedBonus);
                return { ...p, stageStartedAt: updated };
              }),
            };
          });
        }
      }
    }
  }

  if (role === 'seller') {
    const floorIdx = floors.findIndex((f) => f.id === targetFloor);
    if (floorIdx !== -1) {
      let targetSlotIdx: number;
      if (isVip) {
        // Find SELLING slot with longest remaining time
        let longestRemaining = -1;
        targetSlotIdx = -1;
        floors[floorIdx].productions.forEach((p, si) => {
          if (p.stage !== 'SELLING') return;
          const typeId = p.typeId;
          const typeConfig = typeId ? config.productionTypes[typeId] : null;
          if (!typeConfig) return;
          const remaining = typeConfig.sellDuration - (now - p.stageStartedAt);
          if (remaining > longestRemaining) {
            longestRemaining = remaining;
            targetSlotIdx = si;
          }
        });
      } else {
        targetSlotIdx = floors[floorIdx].productions.findIndex((p) => p.stage === 'SELLING');
      }

      if (targetSlotIdx !== -1) {
        const typeId = floors[floorIdx].productions[targetSlotIdx].typeId;
        const typeConfig = typeId ? config.productionTypes[typeId] : null;
        if (typeConfig) {
          floors = floors.map((f, fi) => {
            if (fi !== floorIdx) return f;
            return {
              ...f,
              productions: f.productions.map((p, si) => {
                if (si !== targetSlotIdx) return p;
                const updated = isVip
                  ? now - typeConfig.sellDuration               // fully complete
                  : p.stageStartedAt - Math.floor(typeConfig.sellDuration * config.lobbyConfig.sellSpeedBonus);
                return { ...p, stageStartedAt: updated };
              }),
            };
          });
        }
      }
    }
  }

  return {
    ...state,
    balance, gems, dailyTips, dailyGemsCollected, workers, floors, tools,
    underConstruction,
    dailyTasks: residentsGained > 0 ? {
      ...state.dailyTasks,
      progress: {
        ...state.dailyTasks.progress,
        residentsAdded: state.dailyTasks.progress.residentsAdded + residentsGained,
      },
    } : state.dailyTasks,
  };
```

- [ ] **Step 5: Update `handleCollectTip` to pass `now` and batches to `applyVisitorEffect`**

```ts
function handleCollectTip(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'collect_tip' }>,
): ProcessResult {
  // ... existing guards unchanged ...

  const workerBatch = command.newWorkers
    ?? (command.newWorker ? [command.newWorker] : undefined);
  const toolBatch = command.builderTools
    ?? (command.builderTool ? [command.builderTool] : undefined);

  let newState = applyVisitorEffect(state, active, config, playerLevel, now, workerBatch, toolBatch);
  // ... rest of function unchanged ...
}
```

- [ ] **Step 6: Update `handleDeliverAll` to pass `now` and VIP batches**

```ts
function handleDeliverAll(
  state: GameState,
  config: GameConfig,
  playerLevel: number,
  now: number,
  command: Extract<Command, { type: 'deliver_all' }>,
): ProcessResult {
  // ... existing guards unchanged ...

  const builderTools = command.builderTools ?? [];
  const preGeneratedWorkers = command.preGeneratedWorkers ?? [];
  const vipGuestWorkerBatches = command.vipGuestWorkerBatches ?? [];
  let builderIdx = 0;
  let workerIdx = 0;
  let vipGuestIdx = 0;
  let newState = { ...state, gems: state.gems - 1 };

  for (const visitor of state.lobbyVisitors) {
    const role = visitor.role ?? 'guest';
    const isBuilder = role === 'builder';
    const isVipBuilder = isBuilder && (visitor.isVip ?? false);
    const toolCount = isVipBuilder ? 2 : isBuilder ? 1 : 0;
    const toolBatch = toolCount > 0 ? builderTools.slice(builderIdx, builderIdx + toolCount) : undefined;
    builderIdx += toolCount;

    const isGuestAtFloor1 = role === 'guest' && visitor.targetFloor === 1;
    let preWorkerBatch: typeof preGeneratedWorkers | undefined;
    if (isGuestAtFloor1 && (visitor.isVip ?? false)) {
      preWorkerBatch = vipGuestWorkerBatches[vipGuestIdx++] ?? [];
    } else if (isGuestAtFloor1) {
      const w = preGeneratedWorkers[workerIdx++];
      preWorkerBatch = w ? [w] : undefined;
    }

    newState = applyVisitorEffect(newState, visitor, config, playerLevel, now, preWorkerBatch, toolBatch);
  }

  // ... rest of function (nextVisitorAt, lobbyVisitors clear, stats) unchanged ...
}
```

- [ ] **Step 7: Run tests**

```bash
npx jest --testPathPattern="lobbyCommands" -t "VIP visitor effects"
```

Expected: PASS

- [ ] **Step 8: Run full test suite**

```bash
npx jest
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add shared/engine/lobbyCommands.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(vip): implement VIP effects in applyVisitorEffect"
```

---

### Task 4: Engine — track `vipsLifted` in `handleCollectTip` and `handleDeliverAll`

**Files:**
- Modify: `shared/engine/lobbyCommands.ts`
- Test: `shared/engine/__tests__/lobbyCommands.test.ts`

**Interfaces:**
- Consumes: `Visitor.isVip?`
- Produces: `state.dailyTasks.progress.vipsLifted` incremented when VIP visitor delivered

- [ ] **Step 1: Write failing tests**

Add to `shared/engine/__tests__/lobbyCommands.test.ts`:

```ts
describe('vipsLifted stat tracking', () => {
  it('increments vipsLifted on collect_tip for VIP visitor', () => {
    const visitor = { id: 'v1', role: 'guest' as const, isVip: true, targetFloor: 3, hairColor: '#000', female: false };
    const state = makeState({ lobbyVisitors: [visitor], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.dailyTasks.progress.vipsLifted).toBe(1);
    expect(result.state.dailyTasks.progress.visitorsLifted).toBe(1);
  });

  it('does NOT increment vipsLifted for regular visitor', () => {
    const visitor = { id: 'v1', role: 'guest' as const, isVip: false, targetFloor: 3, hairColor: '#000', female: false };
    const state = makeState({ lobbyVisitors: [visitor], elevatorFloor: 3 });
    const cmd: Command = { id: 'c1', type: 'collect_tip', timestamp: 1000 };
    const result = processCommand(state, cmd, testConfig, 1000);
    expect(result.state.dailyTasks.progress.vipsLifted).toBe(0);
    expect(result.state.dailyTasks.progress.visitorsLifted).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest --testPathPattern="lobbyCommands" -t "vipsLifted"
```

Expected: FAIL

- [ ] **Step 3: Add `vipsLifted` increment in `handleCollectTip`**

In `handleCollectTip`, after the `applyVisitorEffect` call, update the dailyTasks merge:

```ts
const isVip = active.isVip ?? false;
// ...
newState = {
  ...newState,
  lobbyVisitors: newState.lobbyVisitors.slice(1),
  elevatorFloor: 0,
  nextVisitorAt,
  stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + 1 },
  dailyTasks: {
    ...newState.dailyTasks,
    progress: {
      ...newState.dailyTasks.progress,
      visitorsLifted: newState.dailyTasks.progress.visitorsLifted + 1,
      vipsLifted: newState.dailyTasks.progress.vipsLifted + (isVip ? 1 : 0),  // NEW
    },
  },
};
```

- [ ] **Step 4: Add `vipsLifted` increment in `handleDeliverAll`**

In `handleDeliverAll`, after the visitor loop, count VIP passengers:

```ts
const vipsDelivered = state.lobbyVisitors.filter((v) => v.isVip ?? false).length;
// ...
newState = {
  ...newState,
  lobbyVisitors: [],
  elevatorFloor: 0,
  nextVisitorAt,
  stats: { ...newState.stats, totalPassengersLifted: newState.stats.totalPassengersLifted + passengersDelivered },
  dailyTasks: {
    ...newState.dailyTasks,
    progress: {
      ...newState.dailyTasks.progress,
      visitorsLifted: newState.dailyTasks.progress.visitorsLifted + passengersDelivered,
      vipsLifted: newState.dailyTasks.progress.vipsLifted + vipsDelivered,  // NEW
    },
  },
};
```

- [ ] **Step 5: Run tests**

```bash
npx jest --testPathPattern="lobbyCommands" -t "vipsLifted"
```

Expected: PASS

- [ ] **Step 6: Run full test suite**

```bash
npx jest
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add shared/engine/lobbyCommands.ts shared/engine/__tests__/lobbyCommands.test.ts
git commit -m "feat(vip): track vipsLifted in handleCollectTip and handleDeliverAll"
```

---

### Task 5: Engine — propagate `isVip` in `handleSpawnVisitor` and `handleFillLobby`

**Files:**
- Modify: `shared/engine/lobbyCommands.ts`

**Interfaces:**
- Consumes: `SpawnVisitorCommand.isVip?`, `FillLobbyCommand.visitors[].isVip?`
- Produces: spawned `Visitor` objects have `isVip` set from command

- [ ] **Step 1: Update `handleSpawnVisitor`**

```ts
function handleSpawnVisitor(
  state: GameState,
  command: Extract<Command, { type: 'spawn_visitor' }>,
  config: GameConfig,
): ProcessResult {
  if (state.lobbyVisitors.length >= state.lobbyCapacity) {
    return { success: false, state, error: 'Lobby is full' };
  }
  const visitor: Visitor = {
    id: command.visitorId,
    role: command.role,
    isVip: command.isVip,        // NEW
    targetFloor: command.targetFloor,
    hairColor: command.hairColor,
    female: command.female,
    pendingFloorType: command.pendingFloorType,
  };
  // ... rest unchanged ...
}
```

- [ ] **Step 2: Update `handleFillLobby`**

In `handleFillLobby`, the `.map((v) => ({ ... }))` that creates visitors:

```ts
const newVisitors: Visitor[] = command.visitors.slice(0, slots).map((v) => ({
  id: v.visitorId,
  role: v.role,
  isVip: v.isVip,            // NEW
  targetFloor: v.targetFloor,
  hairColor: v.hairColor,
  female: v.female,
  pendingFloorType: v.pendingFloorType,
}));
```

- [ ] **Step 3: Run full test suite**

```bash
npx jest
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add shared/engine/lobbyCommands.ts
git commit -m "feat(vip): propagate isVip in handleSpawnVisitor and handleFillLobby"
```

---

### Task 6: Store — propagate and pre-generate VIP data

**Files:**
- Modify: `src/stores/gameStore.ts`

**Interfaces:**
- Consumes: `generateRandomVisitorRole` now returns `isVip`
- Produces: all store actions pass `isVip` in commands; `collectTip` sends `newWorkers`/`builderTools`; `deliverAll` sends `vipGuestWorkerBatches` and updated `builderTools`

- [ ] **Step 1: Update `spawnVisitor` to pass `isVip`**

In `gameStore.ts`, `spawnVisitor` action:

```ts
const { role, targetFloor, isVip } = generateRandomVisitorRole({ ...state }, gameConfig, timestamp, state.playerLevel);
// ...
executeCommand(get, set, {
  id: uuid(),
  type: 'spawn_visitor',
  visitorId: id,
  role,
  isVip,             // NEW
  targetFloor,
  hairColor,
  female,
  pendingFloorType,
  timestamp,
});
```

- [ ] **Step 2: Update `fillLobby` to pass `isVip`**

In `fillLobby` action, the `visitors` array construction:

```ts
const visitors = Array.from({ length: slotsToFill }, () => {
  const { role, targetFloor, isVip } = generateRandomVisitorRole({ ...state }, gameConfig, now, state.playerLevel);
  const { id, hairColor, female } = generateVisitorAppearance();
  const pendingFloorType = (role === 'guest' && targetFloor === 1)
    ? Object.keys(gameConfig.floorTypes)[Math.floor(Math.random() * Object.keys(gameConfig.floorTypes).length)]
    : undefined;
  return { visitorId: id, role, isVip, targetFloor, hairColor, female, pendingFloorType };  // added isVip
});
```

- [ ] **Step 3: Update `collectTip` to handle VIP guests and VIP builders**

Replace the `newWorker` and `builderTool` generation in `collectTip`:

```ts
collectTip: () => {
  const state = get();
  const active = state.lobbyVisitors[0];
  const role = active?.role ?? 'guest';
  const targetFloor = active?.targetFloor ?? 1;
  const isVip = active?.isVip ?? false;
  const prevVisitorCount = state.lobbyVisitors.length;

  const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'];

  // Worker pre-generation
  let newWorker: ReturnType<typeof generateRandomWorkers>[0] | undefined;
  let newWorkers: ReturnType<typeof generateRandomWorkers>[0][] | undefined;

  if (role === 'guest' && targetFloor === 1) {
    const hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
    if (isVip) {
      const spotsLeft = state.hotelCapacity - hotelOccupied;
      if (spotsLeft > 0) {
        const pendingFloorType = active?.pendingFloorType;
        newWorkers = Array.from({ length: spotsLeft }, () => {
          let maxBizIdx: number | undefined;
          if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
            const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
            maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
          }
          return generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0];
        });
      }
    } else if (hotelOccupied < state.hotelCapacity) {
      const pendingFloorType = active?.pendingFloorType;
      let maxBizIdx: number | undefined;
      if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
        const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
        maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
      }
      newWorker = generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0];
    }
  }

  // Builder tool pre-generation
  let builderTool: ToolKey | undefined;
  let builderTools: ToolKey[] | undefined;

  if (role === 'builder') {
    if (isVip) {
      const isUnderConstruction = state.underConstruction.some((uc) => uc.floorId === targetFloor);
      builderTools = isUnderConstruction
        ? []   // completing construction — no tools
        : [TOOLS[Math.floor(Math.random() * TOOLS.length)], TOOLS[Math.floor(Math.random() * TOOLS.length)]];
    } else {
      builderTool = TOOLS[Math.floor(Math.random() * TOOLS.length)];
    }
  }

  executeCommand(get, set, {
    id: uuid(),
    type: 'collect_tip',
    timestamp: clock.now(),
    newWorker,
    newWorkers,
    builderTool,
    builderTools,
  });

  // Builder tool drop popup (show first tool for VIP non-construction builders)
  const droppedTool = builderTools?.[0] ?? (builderTool && get().lobbyVisitors.length < prevVisitorCount ? builderTool : undefined);
  if (droppedTool && get().lobbyVisitors.length < prevVisitorCount) {
    set({ builderToolDrop: droppedTool });
  }
},
```

- [ ] **Step 4: Update `deliverAll` to handle VIP guests and VIP builders**

Replace the worker/tool pre-generation in `deliverAll`:

```ts
deliverAll: () => {
  const state = get();
  const now = clock.now();
  const TOOLS: ToolKey[] = ['briks', 'glass', 'nails', 'screw', 'wood', 'cement'];

  // Builder tools: 1 per regular builder, 2 per VIP builder (engine ignores if completing construction)
  const builderTools: ToolKey[] = [];
  for (const visitor of state.lobbyVisitors) {
    const isBuilder = (visitor.role ?? 'guest') === 'builder';
    if (isBuilder) {
      const count = (visitor.isVip ?? false) ? 2 : 1;
      for (let i = 0; i < count; i++) {
        builderTools.push(TOOLS[Math.floor(Math.random() * TOOLS.length)]);
      }
    }
  }

  // Worker pre-generation
  let hotelOccupied = state.workers.filter((w) => w.assignedFloorId === null).length;
  const preGeneratedWorkers: ReturnType<typeof generateRandomWorkers>[0][] = [];
  const vipGuestWorkerBatches: ReturnType<typeof generateRandomWorkers>[0][][] = [];

  for (const visitor of state.lobbyVisitors) {
    const isGuestAtFloor1 = (visitor.role ?? 'guest') === 'guest' && visitor.targetFloor === 1;
    if (!isGuestAtFloor1) continue;

    const pendingFloorType = visitor.pendingFloorType;
    let maxBizIdx: number | undefined;
    if (pendingFloorType && gameConfig.floorTypes[pendingFloorType]) {
      const builtCount = getBuiltFloorCountForType(pendingFloorType, state.floors, state.openedFloorTypes ?? {}, gameConfig);
      maxBizIdx = Math.min(builtCount + WORKER_LOOKAHEAD - 1, gameConfig.floorTypes[pendingFloorType].businesses.length - 1);
    }

    if (visitor.isVip ?? false) {
      const spotsLeft = state.hotelCapacity - hotelOccupied;
      const batch: ReturnType<typeof generateRandomWorkers>[0][] = [];
      for (let i = 0; i < spotsLeft; i++) {
        batch.push(generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0]);
        hotelOccupied++;
      }
      vipGuestWorkerBatches.push(batch);
    } else if (hotelOccupied < state.hotelCapacity) {
      preGeneratedWorkers.push(generateRandomWorkers(1, gameConfig, undefined, pendingFloorType, maxBizIdx)[0]);
      hotelOccupied++;
    }
  }

  executeCommand(get, set, {
    id: uuid(),
    type: 'deliver_all',
    timestamp: now,
    builderTools,
    ...(preGeneratedWorkers.length > 0 && { preGeneratedWorkers }),
    ...(vipGuestWorkerBatches.length > 0 && { vipGuestWorkerBatches }),
  });

  const summary = computeDeliverAllSummary(
    state.lobbyVisitors,
    state.elevatorLevel,
    state.dailyGemsCollected,
    state.playerLevel,
  );
  set({ pendingDeliverAll: summary });
},
```

- [ ] **Step 5: Update `computeDeliverAllSummary` to account for VIP guests**

In `computeDeliverAllSummary`, the `guest` case currently assumes 1 new worker per floor-1 guest. For VIP, it can be `hotelCapacity - currentOccupied`. Since this is only a summary display, use a simple `hotelCapacity - occupied` approximation:

```ts
function computeDeliverAllSummary(
  visitors: Visitor[],
  elevatorLevel: number,
  dailyGemsCollected: number,
  playerLevel: number,
  hotelOccupied: number = 0,
  hotelCapacity: number = 999,
): DeliverAllSummary {
  // ... existing setup ...
  let occupied = hotelOccupied;

  for (const v of visitors) {
    const role = v.role ?? 'guest';
    const targetFloor = v.targetFloor ?? 1;
    const isVip = v.isVip ?? false;
    const tipMultiplier = isVip ? 10 : 1;
    switch (role) {
      case 'guest':
        guestCount++;
        totalCoins += calculateTip('guest', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        if (targetFloor === 1) {
          if (isVip) {
            const added = Math.max(0, hotelCapacity - occupied);
            newWorkers += added;
            occupied += added;
          } else if (occupied < hotelCapacity) {
            newWorkers++;
            occupied++;
          }
        }
        break;
      case 'businessman':
        businessmanCount++;
        if (gemsCollected < gemLimit) {
          totalGems++;
          gemsCollected++;
        } else {
          totalCoins += calculateTip('businessman', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        }
        break;
      case 'deliverer':
        delivererCount++;
        totalCoins += calculateTip('deliverer', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        break;
      case 'seller':
        sellerCount++;
        totalCoins += calculateTip('seller', targetFloor, elevatorLevel, gameConfig) * tipMultiplier;
        break;
      case 'builder':
        builderCount++;
        break;
    }
  }
  // ... return unchanged ...
}
```

Update the call site to pass hotel state:

```ts
const summary = computeDeliverAllSummary(
  state.lobbyVisitors,
  state.elevatorLevel,
  state.dailyGemsCollected,
  state.playerLevel,
  state.workers.filter(w => w.assignedFloorId === null).length,
  state.hotelCapacity,
);
```

- [ ] **Step 6: Run full test suite**

```bash
npx jest
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/stores/gameStore.ts
git commit -m "feat(vip): store propagates isVip and pre-generates VIP worker batches"
```

---

### Task 7: UI — VIP visual treatment in LobbyPanel

**Files:**
- Modify: `src/components/LobbyPanel.tsx`
- Modify: `src/i18n/locales/en/lobby.json`

**Interfaces:**
- Consumes: `Visitor.isVip?`
- Produces: golden icon background when `isVip`; label shows "VIP Guest" etc.

- [ ] **Step 1: Add VIP role keys to `src/i18n/locales/en/lobby.json`**

In `lobby.json`, under `"roles"`:

```json
"roles": {
  "guest": "Guest",
  "businessman": "Businessman",
  "deliverer": "Deliverer",
  "seller": "Seller",
  "builder": "Builder",
  "vip_guest": "VIP Guest",
  "vip_businessman": "VIP Businessman",
  "vip_deliverer": "VIP Deliverer",
  "vip_seller": "VIP Seller",
  "vip_builder": "VIP Builder"
}
```

- [ ] **Step 2: Add VIP background style and update role label in `LobbyPanel.tsx`**

After the `ROLE_COLORS` const (line ~67), add:

```ts
const VIP_ICON_BACKGROUND = 'rgba(255, 200, 0, 0.30)';
```

Find the active visitor icon rendering area in `LobbyPanel` (around line ~710–730 where `VisitorAvatar` is rendered). The avatar is wrapped in a `<View style={styles.iconTile}>`. Add a conditional background overlay:

```tsx
<View style={[styles.iconTile, activeVisitor.isVip && { backgroundColor: VIP_ICON_BACKGROUND }]}>
  <VisitorAvatar
    role={activeVisitor.role ?? 'guest'}
    targetFloor={activeVisitor.targetFloor}
    pendingFloorType={activeVisitor.pendingFloorType}
    female={activeVisitor.female}
  />
</View>
```

- [ ] **Step 3: Update role label to show "VIP Guest" etc.**

The role label currently is (line ~728):

```tsx
{t(`roles.${activeVisitor.role ?? 'guest'}`)}
```

Change to:

```tsx
{t(`roles.${activeVisitor.isVip ? `vip_${activeVisitor.role ?? 'guest'}` : (activeVisitor.role ?? 'guest')}`)}
```

- [ ] **Step 4: Apply same VIP background to lobby queue visitor tiles**

Find the lobby queue rendering (where `lobbyVisitors` are mapped to tiles, around line ~814+). Each visitor tile has a background. Apply same golden tint for VIP visitors in the queue:

```tsx
{lobbyVisitors.map((v, idx) => (
  <View
    key={v.id}
    style={[
      styles.lobbyVisitorTile,
      v.isVip && { backgroundColor: VIP_ICON_BACKGROUND },
    ]}
  >
    {/* existing content */}
  </View>
))}
```

(Find the exact component/style name by reading that section of LobbyPanel.tsx and applying the pattern there.)

- [ ] **Step 5: Verify i18n key test passes**

```bash
npx jest --testPathPattern="keysExist"
```

Expected: PASS (dynamic `roles.` prefix is already in ALLOWED_DYNAMIC_CHROME_PREFIXES)

- [ ] **Step 6: Run full test suite**

```bash
npx jest
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/LobbyPanel.tsx src/i18n/locales/en/lobby.json
git commit -m "feat(vip): golden icon background and VIP label in LobbyPanel"
```

---

## Self-Review

**Spec coverage:**
- ✅ VIP guest: tip × 10 (Task 3), hotel fill (Task 3), store pre-gen (Task 6)
- ✅ VIP businessman: gem unchanged, fallback × 10 (Task 3)
- ✅ VIP builder: complete construction OR +2 tools (Task 3), store pre-gen (Task 6)
- ✅ VIP deliverer: fully complete delivery slot (Task 3)
- ✅ VIP seller: complete slot with longest remaining time (Task 3)
- ✅ 2% spawn probability (Task 2)
- ✅ `vipsLifted` stat tracking (Task 4)
- ✅ Golden background UI (Task 7)
- ✅ "VIP Guest" label UI (Task 7)
- ✅ `isVip` propagated through spawn, fill_lobby, lift_visitor (Tasks 5, 6)

**Type consistency:** `applyVisitorEffect` signature changes in Task 3 are used consistently in Tasks 4 and 5 callers. `WorkerDataSchema` extracted in Task 1 is the same shape used throughout.

**Edge cases covered:**
- VIP builder target floor NOT under construction → 2 tools (not crash)
- VIP guest hotel already full → `newWorkers` is empty array, no-op
- VIP seller with no SELLING slots on target floor → `targetSlotIdx = -1`, no-op
- Backward compat: old persisted `collect_tip` commands with `newWorker`/`builderTool` still work via fallback in `handleCollectTip`
