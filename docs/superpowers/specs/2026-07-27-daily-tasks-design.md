# Daily Tasks Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Daily Tasks system — 11 fixed tasks that reset every midnight, tracked automatically via player actions, manually claimed for rewards. Includes colored tokens (new currency), level-scaled coin/material rewards, and a double-reward bonus for completing 7+ tasks in a day.

**Tech Stack:** React Native (Expo), Zustand, NestJS + Prisma (PostgreSQL), shared command-sourcing engine.

---

## Architecture

**Approach:** Extend the existing command-sourcing pattern. All daily task progress lives in `GameState.dailyTasks` (resets nightly via `checkDailyReset()`). Tokens accumulate in `GameState.tokens` and are persisted server-side in `PlayerState`. Claiming is a new command `claim_daily_task`.

---

## Data Model

### GameState additions (`shared/schemas/gameState.ts`)

```ts
// Accumulated tokens — NOT reset on daily reset
tokens: {
  green:  number;
  blue:   number;
  yellow: number;
  purple: number;
  red:    number;
}

// Daily task state — reset every midnight
dailyTasks: {
  progress: {
    visitorsLifted:   number;  // Transporter
    vipsLifted:       number;  // VIP-Transporter (placeholder, always 0 until VIPs implemented)
    goodsBought:      number;  // Wholesale purchase
    residentsAdded:   number;  // New residents
    gemsPurchased:    number;  // Investor / Major investor (IAP)
    goodsCollected:   number;  // Money Collector
    floorsBuilt:      number;  // Higher and higher!
    residentsEvicted: number;  // Hasta la vista
    goodsListed:      number;  // Goods to sell
  };
  claimed: string[];           // task keys already claimed today
  doubleRewardActive: boolean; // true if yesterday ≥7 tasks completed → rewards ×2 today
}
```

Note: "Easy money" uses the existing `GameState.dailyGemsCollected` field (gems received via elevator) — no new counter needed.

### PlayerState additions (`server/prisma/schema.prisma`)

```prisma
tokenGreen  Int @default(0)
tokenBlue   Int @default(0)
tokenYellow Int @default(0)
tokenPurple Int @default(0)
tokenRed    Int @default(0)
```

Tokens are persisted in `PlayerState` and synced into `GameState.tokens` on every sync response.

---

## Task Definitions (`shared/config/dailyTasksConfig.ts`)

### Task list

| Key | Title | Progress source | Threshold |
|-----|-------|-----------------|-----------|
| `transporter` | Transporter | `dailyTasks.progress.visitorsLifted` | 100 |
| `vip_transporter` | VIP-Transporter | `dailyTasks.progress.vipsLifted` | 10 |
| `wholesale` | Wholesale purchase | `dailyTasks.progress.goodsBought` | 50 |
| `new_residents` | New residents | `dailyTasks.progress.residentsAdded` | 25 |
| `easy_money` | Easy money | `dailyGemsCollected` (external field) | 10 |
| `investor` | Investor | `dailyTasks.progress.gemsPurchased` | 200 |
| `money_collector` | Money Collector | `dailyTasks.progress.goodsCollected` | 150 |
| `build_floor` | Higher and higher! | `dailyTasks.progress.floorsBuilt` | 1 |
| `major_investor` | Major investor | `dailyTasks.progress.gemsPurchased` | 1000 |
| `hasta_la_vista` | Hasta la vista, Baby! | `dailyTasks.progress.residentsEvicted` | 15 |
| `goods_to_sell` | Goods to sell | `dailyTasks.progress.goodsListed` | 100 |

### Reward structure

**Coins** scale by level bracket (×multiplier applied to base coin value):

| Level range | Multiplier |
|-------------|-----------|
| 1–10 | ×1 |
| 11–20 | ×3 |
| 21–30 | ×6 |
| 31–40 | ×12 |
| 41–50 | ×20 |
| 51+ | ×35 |

**Gems** — fixed, no scaling.
**Materials** — only for `build_floor`, quantity scales by level:

| Level range | Materials |
|-------------|-----------|
| 1–10 | 2 |
| 11–20 | 3 |
| 21–30 | 4 |
| 31–40 | 5 |
| 41–50 | 6 |
| 51–60 | 7 |
| 61+ | 8 |

**Tokens** — every task: 1–5 random count, random color (green/blue/yellow/purple/red). Randomised at claim time on the client.

**Full reward table (base values, coins at ×1):**

| Key | Base coins | Gems (fixed) | Materials |
|-----|-----------|--------------|-----------|
| `transporter` | 1,300 | 1 | — |
| `vip_transporter` | 1,600 | 2 | — |
| `wholesale` | 1,100 | 1 | — |
| `new_residents` | 1,600 | 1 | — |
| `easy_money` | 1,300 | 1 | — |
| `investor` | 1,300 | 100 | — |
| `money_collector` | 1,100 | 1 | — |
| `build_floor` | 1,600 | 5 | see table above (random type: briks/glass/nails/screw) |
| `major_investor` | 3,200 | 200 | — |
| `hasta_la_vista` | 1,300 | 1 | — |
| `goods_to_sell` | 1,100 | 1 | — |

**Double reward (`doubleRewardActive`):** coins and materials ×2. Gems and tokens unchanged.

---

## Progress Tracking

Counters are incremented in `shared/engine/processCommand.ts` inside the relevant command handlers:

| Command | Counter incremented |
|---------|-------------------|
| `buy_product` | `dailyTasks.progress.goodsBought += 1` |
| `list_production` | `dailyTasks.progress.goodsListed += 1` |
| `collect_production` | `dailyTasks.progress.goodsCollected += 1` |
| `hire_worker` (to hotel) | `dailyTasks.progress.residentsAdded += 1` |
| `evict_worker` | `dailyTasks.progress.residentsEvicted += 1` |
| Visitor reaches floor (elevator) | `dailyTasks.progress.visitorsLifted += 1` |
| Floor construction completes | `dailyTasks.progress.floorsBuilt += 1` |
| IAP gem purchase | `dailyTasks.progress.gemsPurchased += amount` (server-side, via sync response — not processCommand) |

`easy_money` uses existing `dailyGemsCollected` — already incremented wherever gems are granted via elevator.

---

## Claim Flow

**New command:** `claim_daily_task` — `{ taskKey: string }`

**Client (processCommand / executeCommand):**
1. Guard: task not in `claimed`, progress meets threshold
2. Compute scaled coins (`baseCoins × bracket multiplier × (doubleRewardActive ? 2 : 1)`)
3. Compute materials if `build_floor` (`bracketMaterials × (doubleRewardActive ? 2 : 1)`)
4. Gems: fixed value (no doubling)
5. Randomise tokens: `Math.floor(Math.random() * 5) + 1`, color from random pick of 5
6. Apply all rewards to GameState (balance, gems, tools, tokens)
7. Push taskKey to `dailyTasks.claimed`

**Server:** validates on sync — confirms threshold was met before accepting the reward delta.

---

## Daily Reset (`checkDailyReset()`)

Updated logic in `shared/engine/lobbyUtils.ts`:

```
Before resetting:
  completedCount = count of tasks where progress meets threshold
  nextDoubleReward = completedCount >= 7

Reset:
  dailyTasks.progress → all zeros
  dailyTasks.claimed → []
  dailyTasks.doubleRewardActive → nextDoubleReward
  (tokens are NOT reset)
```

---

## IAP Gems Tracking

`gemsPurchased` is incremented server-side after a successful IAP transaction — similar to `dailyLoginReward`, returned in the sync response so the client can update `dailyTasks.progress.gemsPurchased`. This keeps IAP tracking outside the shared game engine.

---

## UI

### Profile screen

New button below Achievements button — icon: `assets/img/dayliQuests.png`, label: "Daily Tasks".

### `/daily-tasks` screen

Structure (top to bottom):
1. **Token balance row** — 5 colored icons with counts (e.g. 🟢12 🔵7 🟡3 🟣0 🔴5)
2. **Reset timer** — "Resets in 14h 22m"
3. **Double reward banner** — shown when `doubleRewardActive`: "⚡ Double rewards active today!"
4. **Task cards** — one per task, containing:
   - Task icon + title
   - Progress bar + count ("33 of 100")
   - Reward preview (coins, gems, tokens, materials if applicable)
   - "Collect" button (active only when threshold met and not yet claimed)
5. **Card states:**
   - In progress: grey progress bar, no button
   - Completed & unclaimed: green progress bar, active "Collect" button
   - Claimed: greyed out, ✓ checkmark

### FAB indicator (game screen)

When unclaimed completed tasks exist:
- **Quick actions available:** badge with count shown above the existing QuickActionFAB
- **No quick actions:** `dayliQuests.png` icon replaces the FAB position (same size, green glow)
- Tap → navigate to `/daily-tasks`

---

## Future Work

- **VIP-Transporter** task: `vipsLifted` counter is wired but always 0 until VIP visitor entity is implemented
- **Token spending:** upgrade business productivity by floor category — separate feature, not in scope here
