# Premium Floor Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the 3 built production floors (Bakery/`green`, Laundry/`teal`, Coffee Shop/`amber`) with a premium 5-color brand palette (Green/Blue/Yellow now; Purple/Red reserved for two unbuilt floor types), larger corner radii, and softer shadows — without moving, adding, or removing any UI element.

**Architecture:** Pure styling change across 3 files. `gameConfig.ts` holds the per-`floorType` `shirtColor`/`accent` used by `WorkerAvatar` and `JobPickerSheet`. `FloorCard.tsx`'s `FLOOR_SCHEMES` map holds the per-floor header/body/card/name colors and gains a new `accent` field. `ProductionCard.tsx` receives that `accent` as a new prop and uses it to recolor the primary action button, the hire "+" badge, and the worker multiplier bubble — replacing the currently-hardcoded amber bubble (`bonusBubbleAmber`), which is a bug (it's amber on every floor today, not just Coffee Shop).

**Tech Stack:** React Native, Expo, `expo-linear-gradient`, existing `shadeColor` util (`src/utils/color.ts`).

## Global Constraints

- Do not change element positions, add/remove UI components, or alter interaction/gameplay logic — colors, corner radii, shadows, and spacing values only. (Spec: `docs/superpowers/specs/2026-07-03-premium-floor-restyle-design.md`)
- Hotel/Lobby (`TechnicalFloor.tsx`) are out of scope for this plan — do not touch that file.
- `DELIVERING` and `SELLING` action-button colors stay exactly as they are today (`#52A6E2`/`#3B8BCB` and `#9A72D6`/`#8455C2`) — only the primary-CTA states (`EMPTY`, `IDLE`, `READY_TO_LIST`, `READY_TO_COLLECT`) become floor-accent-colored.
- `purple`/`blue` entries in `gameConfig.ts floorTypes` are untouched — reserved for future floors.
- No automated test covers visual styling in this codebase; verification is manual (run the app, view all 3 floors).

---

## File Structure

- Modify `shared/config/gameConfig.ts` — update `shirtColor`/`accent` for `green`/`teal`/`amber`.
- Modify `src/components/FloorCard.tsx` — update `FLOOR_SCHEMES` (add `accent` field), bump corner radius/spacing.
- Modify `src/components/ProductionCard.tsx` — accept new `accentColor` prop, recolor primary buttons/badges, bump corner radii.

---

### Task 1: Recolor `gameConfig.floorTypes` (green/teal/amber)

**Files:**
- Modify: `shared/config/gameConfig.ts:6-8`

**Interfaces:**
- Produces: no signature change — same `shirtColor: string, accent: string` fields, new hex values only. `WorkerAvatar.tsx` and `JobPickerSheet.tsx` already consume `gameConfig.floorTypes[key].shirtColor`/`.accent` and need no code change.

- [ ] **Step 1: Update the three lines**

In `shared/config/gameConfig.ts`, replace lines 6-8 (inside `floorTypes`):

```ts
    green:  { shirtColor: '#62B23F', accent: '#4E9A2E', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { shirtColor: '#36AE9C', accent: '#1F8979', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { shirtColor: '#E7A21E', accent: '#B07F12', dreamJobs: ['coffee', 'pancake', 'dessert'] },
```

with:

```ts
    green:  { shirtColor: '#49AA38', accent: '#20810F', dreamJobs: ['bulky', 'cupcake', 'cake'] },
    teal:   { shirtColor: '#3376E5', accent: '#0A4DBC', dreamJobs: ['wash', 'dry', 'bleach'] },
    amber:  { shirtColor: '#E5A72E', accent: '#BC7E05', dreamJobs: ['coffee', 'pancake', 'dessert'] },
```

(`purple` and `blue` lines below are unchanged.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (this is a value-only change, types unaffected).

- [ ] **Step 3: Run the existing test suite to confirm nothing depends on the old hex values**

Run: `npx jest shared/engine/__tests__/lobbyCommands.test.ts shared/engine/__tests__/lobbyUtils.test.ts shared/engine/__tests__/processCommand.test.ts shared/schemas/__tests__/schemas.test.ts src/stores/__tests__/gameStore.test.ts`
Expected: PASS — these files each define their own mock `floorTypes` fixtures and don't import the real `gameConfig`, so they're unaffected.

- [ ] **Step 4: Commit**

```bash
git add shared/config/gameConfig.ts
git commit -m "style: recolor bakery/laundry/coffee floor types to premium palette"
```

---

### Task 2: Recolor `FloorCard.tsx` `FLOOR_SCHEMES` + corner radius/spacing

**Files:**
- Modify: `src/components/FloorCard.tsx:13-47` (interface + `FLOOR_SCHEMES`)
- Modify: `src/components/FloorCard.tsx:178-188` (`floorContainer` style)
- Modify: `src/components/FloorCard.tsx:249-253` (`cardsContainer` style)
- Modify: `src/components/FloorCard.tsx:149-166` (pass new `accent` prop to `ProductionCard`)

**Interfaces:**
- Produces: `FloorColorScheme` gains `accent: string`. `FloorCardInner` passes `accentColor={scheme.accent}` to every `<ProductionCard />` it renders — Task 3's `ProductionCard` must accept a prop of that exact name and type.

- [ ] **Step 1: Add `accent` to the `FloorColorScheme` interface**

In `src/components/FloorCard.tsx`, replace:

```ts
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  stars: number;
}
```

with:

```ts
export interface FloorColorScheme {
  headerColors: [string, string];
  headerShadowColor: string;
  bodyColor: string;
  cardBg: string;
  nameColor: string;
  accent: string;
  stars: number;
}
```

- [ ] **Step 2: Replace the 3 `FLOOR_SCHEMES` entries**

Replace the whole `FLOOR_SCHEMES` object body:

```ts
export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#74C44F', '#5DA83C'],
    headerShadowColor: 'rgba(40,70,25,0.4)',
    bodyColor: '#D2EAB4',
    cardBg: '#F2F8E9',
    nameColor: '#5B963A',
    stars: 0,
  },
  3: {
    headerColors: ['#43BCAA', '#2E9E8E'],
    headerShadowColor: 'rgba(20,70,60,0.4)',
    bodyColor: '#BEE6DD',
    cardBg: '#EBF7F3',
    nameColor: '#2E9384',
    stars: 0,
  },
  4: {
    headerColors: ['#F2B838', '#E09E10'],
    headerShadowColor: 'rgba(120,80,0,0.4)',
    bodyColor: '#F7E4AC',
    cardBg: '#FDF8E9',
    nameColor: '#B5871E',
    stars: 0,
  },
};
```

with:

```ts
export const FLOOR_SCHEMES: Record<number, FloorColorScheme> = {
  2: {
    headerColors: ['#72D361', '#349523'],
    headerShadowColor: 'rgba(0,83,0,0.4)',
    bodyColor: '#D0EBCB',
    cardBg: '#E8F5E5',
    nameColor: '#117200',
    accent: '#20810F',
    stars: 0,
  },
  3: {
    headerColors: ['#5C9FFF', '#1E61D0'],
    headerShadowColor: 'rgba(0,31,142,0.4)',
    bodyColor: '#CADDFC',
    cardBg: '#E5EEFD',
    nameColor: '#003EAD',
    accent: '#0A4DBC',
    stars: 0,
  },
  4: {
    headerColors: ['#FFD057', '#D09219'],
    headerShadowColor: 'rgba(142,80,0,0.4)',
    bodyColor: '#FCEBC9',
    cardBg: '#FDF5E4',
    nameColor: '#AD6F00',
    accent: '#BC7E05',
    stars: 0,
  },
};
```

- [ ] **Step 3: Pass `accentColor` down to `ProductionCard`**

In `FloorCardInner`, the `<ProductionCard ... />` call currently ends with:

```tsx
              worker={slotWorker}
              floorDiscount={discount}
              onHire={onHireSlot}
            />
```

Change to:

```tsx
              worker={slotWorker}
              floorDiscount={discount}
              accentColor={scheme.accent}
              onHire={onHireSlot}
            />
```

- [ ] **Step 4: Bump corner radius and spacing**

In the `styles` `StyleSheet.create` block, change `floorContainer.borderRadius` from `16` to `24`:

```ts
  floorContainer: {
    borderRadius: 24,
```

Change `cardsContainer` from:

```ts
  cardsContainer: {
    flexDirection: 'row',
    gap: 7,
    padding: 9,
  },
```

to:

```ts
  cardsContainer: {
    flexDirection: 'row',
    gap: 9,
    padding: 11,
  },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: error in `ProductionCard.tsx` about an unknown/missing `accentColor` prop — this is expected until Task 3 adds it. Confirm the *only* new error is that one (i.e. `FloorCard.tsx` itself has no errors).

- [ ] **Step 6: Commit**

```bash
git add src/components/FloorCard.tsx
git commit -m "style: recolor floor cards to premium palette, larger radius and spacing"
```

(This commit intentionally leaves the codebase mid-typecheck-error until Task 3 lands — that's fine since it's one linear plan executed in order. If you're running Task 1/2/3 as separate reviewed subagent tasks, note this in the task handoff so the reviewer doesn't flag the transient error as a regression.)

---

### Task 3: `ProductionCard.tsx` — accent-driven buttons/badges + corner radius

**Files:**
- Modify: `src/components/ProductionCard.tsx:18-25` (`BTN_COLORS` — no change to values, referenced for context)
- Modify: `src/components/ProductionCard.tsx:116-146` (`ProductionCardProps` interface + destructure)
- Modify: `src/components/ProductionCard.tsx:154` (`btnConfig` selection — becomes accent-aware for primary states)
- Modify: `src/components/ProductionCard.tsx:258-274` (locked/hire-only render — hire badge, hire button)
- Modify: `src/components/ProductionCard.tsx:297-322` (worker badge / multiplier bubble)
- Modify: `src/components/ProductionCard.tsx:326-339` (action button)
- Modify: `src/components/ProductionCard.tsx:368-558` (`styles` — radii, `bonusBubbleAmber` → `bonusBubble` with no static `backgroundColor`, `hirePlusBadge` no static `backgroundColor`)

**Interfaces:**
- Consumes: `accentColor: string` prop, set by `FloorCard.tsx` (Task 2) to `scheme.accent`.
- Produces: no new exports; internal behavior only.

- [ ] **Step 1: Add `accentColor` to props**

In `src/components/ProductionCard.tsx`, add to `ProductionCardProps`:

```ts
interface ProductionCardProps {
  production: Production;
  balance: number;
  now: number;
  floorId: number;
  slotIdx: number;
  floorAvailableTypes: string[];
  cardBg: string;
  nameColor: string;
  productTitle: string;
  productImage: ImageSource;
  worker?: Worker;
  floorDiscount?: number;
  accentColor: string;
  onHire?: (floorId: number, slotIdx: number) => void;
}
```

(insert `accentColor: string;` after `floorDiscount?: number;`)

And destructure it in the component signature — change:

```ts
export default function ProductionCard({
  production,
  balance,
  now,
  floorId,
  slotIdx,
  floorAvailableTypes,
  cardBg,
  nameColor,
  productTitle,
  productImage,
  worker,
  floorDiscount,
  onHire,
}: ProductionCardProps) {
```

to:

```ts
export default function ProductionCard({
  production,
  balance,
  now,
  floorId,
  slotIdx,
  floorAvailableTypes,
  cardBg,
  nameColor,
  productTitle,
  productImage,
  worker,
  floorDiscount,
  accentColor,
  onHire,
}: ProductionCardProps) {
```

- [ ] **Step 2: Compute accent-derived button colors for primary states**

Right after the existing `const btnConfig = BTN_COLORS[effectiveStage] || BTN_COLORS.IDLE;` line, add:

```ts
  // Primary (clickable) states use the floor's accent color; in-progress
  // timer states (DELIVERING/SELLING) keep their fixed BTN_COLORS above so
  // "processing" stays visually distinct from "your turn to tap".
  const PRIMARY_STAGES = new Set(['EMPTY', 'IDLE', 'READY_TO_LIST', 'READY_TO_COLLECT']);
  const isPrimaryStage = PRIMARY_STAGES.has(effectiveStage);
  const accentBtnConfig = {
    colors: [shadeColor(accentColor, 20), shadeColor(accentColor, -8)] as [string, string],
    shadowColor: shadeColor(accentColor, -28),
  };
  const resolvedBtnConfig = isPrimaryStage ? accentBtnConfig : btnConfig;
```

- [ ] **Step 3: Use `resolvedBtnConfig` for the main action button, and `accentColor` for the locked/hire button**

In the locked-card early return, change:

```tsx
          <LinearGradient
            colors={BTN_COLORS.EMPTY.colors}
            style={styles.actionButtonGradient}
          >
            <StageIcon stage={'EMPTY'} />
            <Text style={styles.actionLabel}>{t('productionCard.actions.hire')}</Text>
          </LinearGradient>
          <View style={[styles.actionButtonShadow, { backgroundColor: BTN_COLORS.EMPTY.shadowColor }]} />
```

to:

```tsx
          <LinearGradient
            colors={[shadeColor(accentColor, 20), shadeColor(accentColor, -8)]}
            style={styles.actionButtonGradient}
          >
            <StageIcon stage={'EMPTY'} />
            <Text style={styles.actionLabel}>{t('productionCard.actions.hire')}</Text>
          </LinearGradient>
          <View style={[styles.actionButtonShadow, { backgroundColor: shadeColor(accentColor, -28) }]} />
```

In the main render's action button, change:

```tsx
        <LinearGradient
          colors={btnConfig.colors}
          style={styles.actionButtonGradient}
        >
          <StageIcon stage={effectiveStage} />
          <Text style={styles.actionLabel}>{labelText}</Text>
        </LinearGradient>
        <View style={[styles.actionButtonShadow, { backgroundColor: btnConfig.shadowColor }]} />
```

to:

```tsx
        <LinearGradient
          colors={resolvedBtnConfig.colors}
          style={styles.actionButtonGradient}
        >
          <StageIcon stage={effectiveStage} />
          <Text style={styles.actionLabel}>{labelText}</Text>
        </LinearGradient>
        <View style={[styles.actionButtonShadow, { backgroundColor: resolvedBtnConfig.shadowColor }]} />
```

- [ ] **Step 4: Recolor the hire "+" badge and the worker multiplier bubble**

Both `hirePlusBadge` occurrences (locked card and unlocked/empty card) currently render:

```tsx
            <View style={styles.hirePlusBadge}>
```

Change both to:

```tsx
            <View style={[styles.hirePlusBadge, { backgroundColor: accentColor }]}>
```

The multiplier bubble currently is:

```tsx
            {hasMultiplier && (
              <View style={styles.bonusBubbleAmber}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
```

Change to:

```tsx
            {hasMultiplier && (
              <View style={[styles.bonusBubble, { backgroundColor: accentColor }]}>
                <Text style={styles.bonusBubbleText}>×{multiplier}</Text>
              </View>
            )}
```

- [ ] **Step 5: Update the stylesheet — radii and the renamed/emptied bubble styles**

Change `card.borderRadius` from `13` to `18`:

```ts
  card: {
    flex: 1,
    flexDirection: 'column',
    gap: 6,
    borderRadius: 18,
```

Change `hireSlot.borderRadius` from `13` to `16`:

```ts
  hireSlot: {
    width: 54,
    height: 54,
    borderRadius: 16,
```

Change `productImage.borderRadius` from `11` to `14`:

```ts
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
```

Change `actionButton.borderRadius` from `9` to `12`:

```ts
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
```

Remove the static `backgroundColor` from `hirePlusBadge` (it's now set inline per Step 4) — change:

```ts
  hirePlusBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#5BA63C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(40,90,25,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 3,
  },
```

to:

```ts
  hirePlusBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(40,90,25,1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 2,
    elevation: 3,
  },
```

Rename `bonusBubbleAmber` to `bonusBubble` and drop its static `backgroundColor` — change:

```ts
  bonusBubbleAmber: {
    backgroundColor: '#E89320',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#fff',
  },
```

to:

```ts
  bonusBubble: {
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#fff',
  },
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (this closes out the `accentColor` prop mismatch introduced by Task 2, and no leftover reference to `bonusBubbleAmber`/`styles.hirePlusBadge`'s removed `backgroundColor` exists).

- [ ] **Step 7: Confirm no other file references the renamed style**

Run: `grep -rn "bonusBubbleAmber" src/`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/components/ProductionCard.tsx
git commit -m "style: recolor production card buttons and badges to floor accent"
```

---

### Task 4: Manual visual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app**

Run: `npx expo start` (or the project's existing dev-run command — check `package.json` `scripts` if `expo start` isn't the convention used elsewhere in this repo) and open it in a simulator/device/web preview.

- [ ] **Step 2: Walk all 3 floors through every production stage**

For each of Floor 2 (Bakery, green), Floor 3 (Laundry, blue), Floor 4 (Coffee Shop, yellow):
- View the empty/hire state (no worker assigned) — confirm the hire "+" badge and Hire button are the floor's accent color, not the old fixed green/orange.
- Hire a worker, buy a batch (IDLE→bought), let it move through DELIVERING → READY_TO_LIST → SELLING → READY_TO_COLLECT. Confirm DELIVERING/SELLING button colors are unchanged (blue/purple), and IDLE/READY_TO_LIST/READY_TO_COLLECT/EMPTY buttons are accent-colored.
- If the worker has a multiplier (`×N` bubble visible), confirm the bubble color matches the floor's accent, not amber, on the blue and yellow floors specifically (this is the regression check for the hardcoded-amber bug).
- Confirm all 3 production cards per floor are still equal-width, nothing wraps or overlaps, and text isn't clipped differently than before.

- [ ] **Step 3: Compare against the reference screenshot**

Open `assets/example/Screenshot 2026-07-02 at 22.27.23.png` side by side with the running app and confirm the overall direction (rounded cards, soft shadows, bright header gradients) reads consistently, acknowledging the app's actual layout (SVG avatars, existing product art) differs in content from that reference.

- [ ] **Step 4: Report back**

Summarize what was checked and any visual issues found (if any) before considering this plan complete. If issues are found, fix them in the relevant task's file and re-commit (don't amend prior commits) before finishing.

---

## Self-Review Notes

- **Spec coverage:** Palette mapping (Task 1+2), corner radius/spacing (Task 2 header, Task 3 card), softer shadows (already largely done in a prior session per `git diff` — not re-touched here since the spec doesn't ask for further shadow tuning), multiplier-badge bug fix (Task 3 Step 4), button color treatment for primary vs. timer states (Task 3 Step 2-3), Hotel/Lobby explicitly untouched (no task references `TechnicalFloor.tsx`). No gaps found.
- **Placeholder scan:** none — every step has literal code/commands.
- **Type consistency:** `accentColor: string` prop name and type match between Task 2 (producer, `FloorCard.tsx`) and Task 3 (consumer, `ProductionCard.tsx`). `FloorColorScheme.accent` (Task 2) is the field read to produce it.
