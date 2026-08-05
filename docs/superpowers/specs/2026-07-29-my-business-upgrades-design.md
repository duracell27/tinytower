# My Business Upgrades — Design Spec

**Date:** 2026-07-29  
**Status:** Approved

---

## Overview

A new "My Business" section in the Profile tab that lets players upgrade 5 business categories, each tied to a specific floor type (color). Every upgrade level adds +5% profit to all floors of that type, up to a maximum of +200% (40 levels per category).

---

## Category → Floor Type Mapping

| Category | Floor type | Businesses |
|---|---|---|
| Quality | green | Food |
| Service | blue | Services |
| Entertainment | yellow | Recreation |
| Exclusiveness | purple | Fashion |
| Warranty | red | Electronics |

---

## Data Model

### GameState addition

```ts
businessUpgrades: {
  green:  number,  // 0–40
  blue:   number,
  yellow: number,
  purple: number,
  red:    number,
}
```

Default: `{ green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }`. Added to `GameStateSchema` in `shared/schemas/gameState.ts`.

The profit bonus for a given floor type = `businessUpgrades[floorType] * 5` percent.

### Existing `tokens` field (already in GameState)

```ts
tokens: { green: number, blue: number, yellow: number, purple: number, red: number }
```

Token balances are already tracked — no schema change needed here.

---

## New Command

```ts
{ type: 'upgrade_business_category', floorType: 'green' | 'blue' | 'yellow' | 'purple' | 'red' }
```

Added to `CommandSchema` in `shared/schemas/command.ts`.

### processCommand logic

Handler in `shared/engine/processCommand.ts`:

1. Resolve current level `L = state.businessUpgrades[floorType]`
2. If `L >= 40` → `{ success: false, error: 'Max level reached' }`
3. Look up cost for level `L + 1` from the cost table (see below)
4. Check sufficient balance (coins or gems) and tokens
5. Deduct costs, return `{ ...state, businessUpgrades: { ...state.businessUpgrades, [floorType]: L + 1 } }`

---

## Upgrade Cost Table

Level = target level after upgrade (1–40). Every 5th level is a gem milestone (no tokens).

| Level | % | Cost |
|---|---|---|
| 1 | 5% | 1 000 coins + 3 tokens |
| 2 | 10% | 2 500 coins + 3 tokens |
| 3 | 15% | 5 000 coins + 4 tokens |
| 4 | 20% | 10 000 coins + 5 tokens |
| 5 | 25% | 50 gems |
| 6 | 30% | 15 000 coins + 5 tokens |
| 7 | 35% | 30 000 coins + 6 tokens |
| 8 | 40% | 50 000 coins + 7 tokens |
| 9 | 45% | 100 gems |
| 10 | 50% | 50 000 coins + 8 tokens |
| 11 | 55% | 100 000 coins + 9 tokens |
| 12 | 60% | 200 000 coins + 10 tokens |
| 13 | 65% | 200 gems |
| 14 | 70% | 200 000 coins + 12 tokens |
| 15 | 75% | 350 000 coins + 14 tokens |
| 16 | 80% | 500 000 coins + 16 tokens |
| 17 | 85% | 400 gems |
| 18 | 90% | 500 000 coins + 18 tokens |
| 19 | 95% | 750 000 coins + 20 tokens |
| 20 | 100% | 1 000 000 coins + 25 tokens |
| 21 | 105% | 1 000 gems |
| 22 | 110% | 1 500 000 coins + 28 tokens |
| 23 | 115% | 2 000 000 coins + 30 tokens |
| 24 | 120% | 3 000 000 coins + 35 tokens |
| 25 | 125% | 2 000 gems |
| 26 | 130% | 3 000 000 coins + 40 tokens |
| 27 | 135% | 5 000 000 coins + 50 tokens |
| 28 | 140% | 7 000 000 coins + 55 tokens |
| 29 | 145% | 5 000 gems |
| 30 | 150% | 10 000 000 coins + 60 tokens |
| 31 | 155% | 25 000 000 coins + 70 tokens |
| 32 | 160% | 50 000 000 coins + 80 tokens |
| 33 | 165% | 8 000 gems |
| 34 | 170% | 100 000 000 coins + 100 tokens |
| 35 | 175% | 250 000 000 coins + 110 tokens |
| 36 | 180% | 500 000 000 coins + 125 tokens |
| 37 | 185% | 10 000 gems |
| 38 | 190% | 1 000 000 000 coins + 145 tokens |
| 39 | 195% | 2 500 000 000 coins + 165 tokens |
| 40 | 200% | 5 000 000 000 coins + 200 tokens |

Tokens are always of the same color as the floor type being upgraded.

---

## Profit Integration

In `shared/engine/processCommand.ts` → `handleCollect`:

```ts
const floorType = resolveFloorType(state, config, floorId);
const categoryBonus = (state.businessUpgrades?.[floorType] ?? 0) * 5;
const coinMultiplier = 1 + (bonuses.coinPercent + specialistBonusPercent + categoryBonus) / 100;
```

The category bonus stacks additively with `coinBonusPercent` (achievements/referrals) and the specialist bonus.

---

## Navigation

### Profile screen (`app/(tabs)/profile.tsx`)

New button added above Achievements:

```tsx
<Pressable onPress={() => router.push('/my-business')} ...>
  My Business
</Pressable>
```

### `app/my-business.tsx` — Category list screen

**Header:**
- Title: "My Business"
- Subtitle: "Upgrade categories to increase profit on floors"
- Current balance row: 🪙 coins · 💎 gems

**5 category cards**, one per floor type, each showing:
- Category name (Quality / Service / Entertainment / Exclusiveness / Warranty)
- Floor type color accent
- Current bonus: `+X% Profit` (or `MAX` if level 40)
- Level progress bar: `level / 40`
- Token balance for this color: e.g. `🟢 124 tokens`
- Number of built floors of this type: `6 floors`
- Tap → navigate to `/my-business/green` (etc.)

### `app/my-business/[category].tsx` — Category detail screen

**Header:**
- Category name + color
- Current level and bonus: `Level 12 · +60% Profit`
- Progress bar

**Balance row:**
- 🪙 coins · 💎 gems · [color] tokens (balance of the relevant color)

**Upgrade button:**
- Shows cost of next level: `1 000 coins + 3 tokens` or `50 gems`
- Disabled + "Max level reached" if level = 40
- Disabled + grayed cost if insufficient balance

**Floor statistics section:**
- List of all built floors of this type with their names

---

## i18n (`src/i18n/locales/en/hotel.json`)

```json
"myBusiness": {
  "title": "My Business",
  "subtitle": "Upgrade categories to increase profit on floors",
  "upgrade": "Upgrade",
  "maxLevel": "Max level reached",
  "profitBonus": "+{{percent}}% Profit",
  "floorCount_one": "{{count}} floor",
  "floorCount_other": "{{count}} floors",
  "level": "Level {{level}}",
  "categories": {
    "green": "Quality",
    "blue": "Service",
    "yellow": "Entertainment",
    "purple": "Exclusiveness",
    "red": "Warranty"
  },
  "tokens": {
    "green": "Food tokens",
    "blue": "Service tokens",
    "yellow": "Entertainment tokens",
    "purple": "Fashion tokens",
    "red": "Tech tokens"
  }
}
```

---

## Files to Create / Modify

| File | Action |
|---|---|
| `shared/schemas/gameState.ts` | Add `businessUpgrades` field |
| `shared/schemas/command.ts` | Add `upgrade_business_category` command |
| `shared/engine/processCommand.ts` | Add handler + wire category bonus into `handleCollect` |
| `src/stores/gameStore.ts` | Add `businessUpgrades` to store state + `upgradeBusinessCategory` action |
| `app/(tabs)/profile.tsx` | Add "My Business" nav button |
| `app/my-business.tsx` | New screen — category list |
| `app/my-business/[category].tsx` | New screen — category detail + upgrade |
| `src/i18n/locales/en/hotel.json` | Add `myBusiness` keys |
