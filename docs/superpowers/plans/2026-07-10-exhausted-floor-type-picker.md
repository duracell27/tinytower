# Exhausted Floor Type Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gray out and disable floor types in `BusinessTypePickerSheet` when all their businesses have already been built.

**Architecture:** Extract a pure utility `getExhaustedFloorTypes` to `shared/engine/floorTypeUtils.ts`; test it there. Wire it into `game.tsx` via `useMemo` and pass the result as a new `exhaustedTypes` prop to `BusinessTypePickerSheet`.

**Tech Stack:** React Native, TypeScript, Jest, Expo

## Global Constraints

- No new dependencies
- Hardcoded strings (no i18n) — existing strings in `BusinessTypePickerSheet` are hardcoded too
- Follow existing code style: `Fredoka_*` fonts, `#9BA3B0` for hint text, `StyleSheet.create`
- Run tests with: `npx jest` from `/Users/Apple/IT/tinytower`

---

### Task 1: Pure utility — `getExhaustedFloorTypes`

**Files:**
- Create: `shared/engine/floorTypeUtils.ts`
- Create: `shared/engine/__tests__/floorTypeUtils.test.ts`

**Interfaces:**
- Produces: `getExhaustedFloorTypes(ucFloorId, floors, openedFloorTypes, underConstruction, config): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `shared/engine/__tests__/floorTypeUtils.test.ts`:

```ts
import { getExhaustedFloorTypes } from '../floorTypeUtils';

const config = {
  floors: [
    { id: 2, floorType: 'green' },
    { id: 3, floorType: 'blue' },
  ],
  floorTypes: {
    green:  { businesses: [{}, {}, {}] },
    blue:   { businesses: [{}, {}, {}] },
    yellow: { businesses: [{}, {}, {}] },
  },
};

describe('getExhaustedFloorTypes', () => {
  it('returns empty set when nothing is built', () => {
    const result = getExhaustedFloorTypes(
      10,
      [{ id: 2 }, { id: 3 }],
      {},
      [],
      config,
    );
    expect(result.size).toBe(0);
  });

  it('marks a type exhausted when static floors fill all tiers', () => {
    // green has 3 businesses; 1 is in config.floors (id:2), 2 more in openedFloorTypes
    const result = getExhaustedFloorTypes(
      10,
      [{ id: 2 }],
      { '5': 'green', '6': 'green' },
      [],
      config,
    );
    expect(result.has('green')).toBe(true);
    expect(result.has('blue')).toBe(false);
  });

  it('counts pending UC floors (excluding current floor)', () => {
    // yellow: 2 opened + 1 pending other UC = exhausted
    const result = getExhaustedFloorTypes(
      10,
      [],
      { '4': 'yellow', '5': 'yellow' },
      [
        { floorId: 7,  selectedFloorType: 'yellow' },  // other UC — counts
        { floorId: 10, selectedFloorType: 'yellow' },  // current — excluded
      ],
      config,
    );
    expect(result.has('yellow')).toBe(true);
  });

  it('does not count current floor UC in the tally', () => {
    // yellow: 2 opened + current floor (excluded) = 2, not exhausted
    const result = getExhaustedFloorTypes(
      10,
      [],
      { '4': 'yellow', '5': 'yellow' },
      [{ floorId: 10, selectedFloorType: 'yellow' }],
      config,
    );
    expect(result.has('yellow')).toBe(false);
  });

  it('counts static config floors only when they appear in built floors list', () => {
    // config has floor 2 as green, but if floor 2 is not in built floors[] it shouldn't count
    const result = getExhaustedFloorTypes(
      10,
      [],  // no built floors
      { '5': 'green', '6': 'green' },
      [],
      config,
    );
    // 0 static + 2 opened = 2, not exhausted (max 3)
    expect(result.has('green')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/floorTypeUtils.test.ts --no-coverage
```

Expected: Cannot find module `'../floorTypeUtils'`

- [ ] **Step 3: Create `shared/engine/floorTypeUtils.ts`**

```ts
import type { GameConfig } from '../types';

export function getExhaustedFloorTypes(
  ucFloorId: number,
  floors: { id: number }[],
  openedFloorTypes: Record<string, string>,
  underConstruction: { floorId: number; selectedFloorType: string | null }[],
  config: Pick<GameConfig, 'floors' | 'floorTypes'>,
): Set<string> {
  const exhausted = new Set<string>();
  for (const [ft, ftConfig] of Object.entries(config.floorTypes)) {
    const staticCount = config.floors
      .filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id))
      .length;
    const openedCount = Object.values(openedFloorTypes)
      .filter((t) => t === ft).length;
    const pendingCount = underConstruction
      .filter((u) => u.floorId !== ucFloorId && u.selectedFloorType === ft)
      .length;
    if (staticCount + openedCount + pendingCount >= ftConfig.businesses.length) {
      exhausted.add(ft);
    }
  }
  return exhausted;
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
cd /Users/Apple/IT/tinytower && npx jest shared/engine/__tests__/floorTypeUtils.test.ts --no-coverage
```

Expected: 5 passing tests, 0 failures.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add shared/engine/floorTypeUtils.ts shared/engine/__tests__/floorTypeUtils.test.ts
git commit -m "feat: add getExhaustedFloorTypes utility"
```

---

### Task 2: Update `BusinessTypePickerSheet` — accept and render exhausted state

**Files:**
- Modify: `src/components/BusinessTypePickerSheet.tsx`

**Interfaces:**
- Consumes: `exhaustedTypes?: Set<string>` prop (defaults to empty `Set`)
- No changes to `onSelectType` signature

- [ ] **Step 1: Read the current file**

Read `src/components/BusinessTypePickerSheet.tsx` (already done in exploration — reproduced here for reference).

Key section to change — the `ScrollView` content (lines 99–114):

```tsx
<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
  {floorTypes.map((ft) => (
    <Pressable
      key={ft}
      onPress={() => onSelectType(ft)}
      style={({ pressed }) => [styles.typeRow, pressed && { opacity: 0.82 }]}
    >
      <Image
        source={FLOOR_TYPE_ICONS[ft]}
        style={styles.iconSwatch}
        contentFit="contain"
      />
      <Text style={styles.typeName}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
    </Pressable>
  ))}
</ScrollView>
```

- [ ] **Step 2: Update the component**

Replace the interface and component in `src/components/BusinessTypePickerSheet.tsx`:

**Interface** (replace lines 35–40):
```tsx
interface BusinessTypePickerSheetProps {
  visible: boolean;
  underConstruction: UnderConstructionState;
  onClose: () => void;
  onSelectType: (floorType: string) => void;
  exhaustedTypes?: Set<string>;
}
```

**Destructuring** (replace lines 42–47):
```tsx
export default function BusinessTypePickerSheet({
  visible,
  underConstruction,
  onClose,
  onSelectType,
  exhaustedTypes = new Set(),
}: BusinessTypePickerSheetProps) {
```

**ScrollView content** (replace lines 99–114):
```tsx
<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
  {floorTypes.map((ft) => {
    const isExhausted = exhaustedTypes.has(ft);
    return (
      <Pressable
        key={ft}
        onPress={isExhausted ? undefined : () => onSelectType(ft)}
        style={({ pressed }) => [
          styles.typeRow,
          isExhausted && styles.typeRowExhausted,
          !isExhausted && pressed && { opacity: 0.82 },
        ]}
      >
        <Image
          source={FLOOR_TYPE_ICONS[ft]}
          style={styles.iconSwatch}
          contentFit="contain"
        />
        <View style={styles.typeTextCol}>
          <Text style={styles.typeName}>{FLOOR_TYPE_NAMES[ft] ?? ft}</Text>
          {isExhausted && (
            <Text style={styles.typeExhaustedHint}>
              All floors of this category already built
            </Text>
          )}
        </View>
      </Pressable>
    );
  })}
</ScrollView>
```

**Styles** — add to `StyleSheet.create({...})` (after `typeName`):
```tsx
typeTextCol: {
  flex: 1,
},
typeRowExhausted: {
  opacity: 0.4,
},
typeExhaustedHint: {
  fontFamily: 'Fredoka_400Regular',
  fontSize: 12,
  color: '#9BA3B0',
  marginTop: 1,
},
```

Also update `typeName` — remove `flex: 1` since the parent `typeTextCol` now carries it:
```tsx
typeName: {
  fontFamily: 'Fredoka_600SemiBold',
  fontSize: 16,
  color: '#2A3344',
},
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage
```

Expected: all tests pass (no component tests exist; verifying no type errors via tsc).

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add src/components/BusinessTypePickerSheet.tsx
git commit -m "feat: gray out exhausted floor types in picker"
```

---

### Task 3: Wire up in `game.tsx`

**Files:**
- Modify: `app/(tabs)/game.tsx`

**Interfaces:**
- Consumes: `getExhaustedFloorTypes` from `shared/engine/floorTypeUtils`
- Consumes: `exhaustedTypes?: Set<string>` prop on `BusinessTypePickerSheet`

- [ ] **Step 1: Add import**

At the top of `app/(tabs)/game.tsx`, after the existing `gameConfig` import (line 20):

```tsx
import { getExhaustedFloorTypes } from '../../shared/engine/floorTypeUtils';
```

- [ ] **Step 2: Add `useMemo` for exhausted types map**

After the `openedFloorTypes` selector (line 80 area), add:

```tsx
const exhaustedByFloor = React.useMemo(() => {
  const map = new Map<number, Set<string>>();
  for (const uc of underConstruction) {
    map.set(
      uc.floorId,
      getExhaustedFloorTypes(
        uc.floorId,
        floors,
        openedFloorTypes ?? {},
        underConstruction,
        gameConfig,
      ),
    );
  }
  return map;
}, [underConstruction, floors, openedFloorTypes]);
```

- [ ] **Step 3: Pass `exhaustedTypes` to each `BusinessTypePickerSheet`**

Find the `underConstruction.map(...)` block (lines 272–283). Update it:

```tsx
{underConstruction.map((uc) => (
  <BusinessTypePickerSheet
    key={uc.floorId}
    visible={pickerOpenFor === uc.floorId}
    underConstruction={uc}
    onClose={() => setPickerOpenFor(null)}
    onSelectType={(floorType) => {
      selectFloorType(uc.floorId, floorType);
      setPickerOpenFor(null);
    }}
    exhaustedTypes={exhaustedByFloor.get(uc.floorId)}
  />
))}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/Apple/IT/tinytower && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 6: Manual verification**

Start the app and build enough floors so that one floor type reaches its limit (3 floors of the same type). Open a new under-construction floor's "Choose business" picker. Confirm:
- Exhausted type row is visibly grayed out (opacity ~0.4)
- Subtext "All floors of this category already built" appears under the name
- Tapping the grayed row does nothing
- Non-exhausted types still open normally

- [ ] **Step 7: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add app/(tabs)/game.tsx
git commit -m "feat: wire exhausted floor types into BusinessTypePickerSheet"
```
