# Token Tournament Design

**Date:** 2026-10-15

---

## Overview

Weekly token tournament — players compete by collecting tokens via daily tasks Mon–Fri. On Saturday the game admin publishes results via the admin panel. Top 10 players receive gems + bonus tokens + coins; all other participants receive coins. Rewards are delivered via in-game mail.

---

## Tournament Rules

- **Period:** Monday 00:00 UTC – Friday 23:59 UTC (inclusive)
- **Metric:** total tokens collected from daily task claims during the week (all 5 colors summed)
- **All players** participate automatically — no opt-in required
- Saturday–Sunday: tournament is closed, results pending admin publish

---

## Reward Structure

### Top 10 players

| Rank | Gems | Bonus tokens | Coins |
|------|------|--------------|-------|
| 1 | 1,000 | 100 | tokenCount × levelBracket × 1,000 |
| 2 | 900 | 90 | tokenCount × levelBracket × 1,000 |
| 3 | 800 | 80 | tokenCount × levelBracket × 1,000 |
| 4 | 700 | 70 | tokenCount × levelBracket × 1,000 |
| 5 | 600 | 60 | tokenCount × levelBracket × 1,000 |
| 6 | 500 | 50 | tokenCount × levelBracket × 1,000 |
| 7 | 400 | 40 | tokenCount × levelBracket × 1,000 |
| 8 | 300 | 30 | tokenCount × levelBracket × 1,000 |
| 9 | 200 | 20 | tokenCount × levelBracket × 1,000 |
| 10 | 100 | 10 | tokenCount × levelBracket × 1,000 |

Formula: `gemsReward = (11 - rank) * 100`, `bonusTokens = (11 - rank) * 10`

Bonus tokens are random color, awarded at publish time.

### All other participants (rank 11+)

- Coins only: `tokenCount × levelBracket × 1,000`
- No gems, no bonus tokens

### Level bracket multiplier (coins)

| Player level | Multiplier |
|--------------|-----------|
| 1–10 | ×1 |
| 11–20 | ×2 |
| 21–30 | ×3 |
| 31–40 | ×4 |
| … | … |

Formula: `levelBracket = Math.floor((playerLevel - 1) / 10) + 1`

Players with `tokenCount = 0` receive nothing and are excluded from mail.

---

## Data Model

### New Prisma models

```prisma
model PlayerWeeklyTokens {
  id        String   @id @default(cuid())
  playerId  String
  weekStart DateTime
  count     Int      @default(0)

  player    Player   @relation(fields: [playerId], references: [id])

  @@unique([playerId, weekStart])
}

model PlayerTokenTournament {
  id        String   @id @default(cuid())
  weekStart DateTime @unique
  createdBy String
  createdAt DateTime @default(now())

  entries   PlayerTokenTournamentEntry[]
}

model PlayerTokenTournamentEntry {
  id           String  @id @default(cuid())
  tournamentId String
  playerId     String
  rank         Int?    // 1–10 for top players, null otherwise
  tokenCount   Int
  gemsReward   Int
  bonusTokens  Int
  coinsReward  Int

  tournament   PlayerTokenTournament @relation(fields: [tournamentId], references: [id])
  player       Player                @relation(fields: [playerId], references: [id])

  @@unique([tournamentId, playerId])
}
```

`weekStart` is always Monday 00:00 UTC, using the existing `currentWeekStart()` helper from city-task.constants.ts.

---

## Server

### Module structure

New module `server/src/tournament/`:
- `tournament.module.ts`
- `tournament.controller.ts`
- `tournament.service.ts`
- `tournament.constants.ts` — reward formula helpers

Registered in `AppModule`.

### Token tracking

Hooked into the `claim_daily_task` handler in `sync.service.ts`. When the server validates a claim and awards tokens, it increments `PlayerWeeklyTokens` in the same transaction:

```ts
const weekStart = currentWeekStart();
if (isWeekdayUTC() && tokenAmount > 0) {
  await tx.playerWeeklyTokens.upsert({
    where: { playerId_weekStart: { playerId, weekStart } },
    create: { playerId, weekStart, count: tokenAmount },
    update: { count: { increment: tokenAmount } },
  });
}
```

`isWeekdayUTC()` — new helper (Mon=1 to Fri=5), returns false on Sat/Sun. Lives in `tournament.constants.ts`.

### Sync payload addition

`sync.service.ts` adds to every sync response:

```ts
weeklyTokenCount: number  // current week count for this player, 0 if none
```

Queried via `PlayerWeeklyTokens` for `playerId` + `currentWeekStart()`.

### Admin endpoints

Both require admin authentication (existing admin guard).

**`GET /admin/tournament/tokens/leaderboard?weekStart=YYYY-MM-DD`**

Returns players sorted by `count DESC`, calculates preview rewards:

```ts
{
  weekStart: string;
  alreadyPublished: boolean;
  totalParticipants: number;
  entries: {
    rank: number;
    playerId: string;
    playerName: string;
    tokenCount: number;
    gemsReward: number;
    bonusTokens: number;
    coinsReward: number;
  }[];
}
```

**`POST /admin/tournament/tokens/result`**

Body: `{ weekStart: string }`

Transactional steps:
1. Guard: `PlayerTokenTournament` for this `weekStart` must not exist yet
2. Fetch all `PlayerWeeklyTokens` for `weekStart`, sort by `count DESC`
3. Calculate rewards for each player
4. Create `PlayerTokenTournament` + all `PlayerTokenTournamentEntry` records
5. For each player with `count > 0`:
   - Increment `PlayerState.gems` (top 10 only)
   - Increment token color fields in `PlayerState` (top 10 only, random color distribution)
   - Increment `Player.balance` (all participants)
   - Send in-game mail via existing `MailService`

---

## Admin Panel

New page `admin/src/pages/TokenTournamentPage.tsx`, mirroring `CityTaskRankingsPage.tsx`.

**UI elements:**
1. **Week selector** — dropdown of recent Mondays, current week default
2. **Leaderboard table** — columns: Rank | Player | Tokens | Gems | Bonus Tokens | Coins
3. **Summary** — "Total participants: N"
4. **Publish button** — enabled only when `alreadyPublished: false`; shows confirmation dialog: _"Publish results for Mon DD.MM – Fri DD.MM? Send rewards to N players?"_
5. **Published badge** — when `alreadyPublished: true`, shows "✓ Published DD.MM at HH:MM" instead of the button

Route: `/tournament/tokens` added to admin router.

---

## Client UI

New collapsible section at the bottom of the `/daily-tasks` screen, below the task list.

**Active state (Mon–Fri):**
```
🏆 Weekly Tournament   Mon – Fri
Your score:   🔑 47 tokens
Reward:   47,000 coins
```

**Closed state (Sat–Sun):**
```
🏆 Weekly Tournament
Tournament finished — results coming soon
```

`weeklyTokenCount` comes from the sync payload addition. Stored in `useGameStore` (no new store needed). Coins preview is computed client-side using the player's current level.

---

## In-game Mail

Sent to every participant with `count > 0` when admin publishes results. Rewards are already credited at publish time — the mail is informational.

**Top 10 template:**
```
Subject: 🏆 Token Tournament Results

Congratulations! You placed #N in this week's tournament.

Tokens collected: 47
Rewards:
  • 600 💎 gems
  • 60 🔑 random tokens
  • 47,000 🪙 coins

Rewards have been added to your account.
```

**Rank 11+ template:**
```
Subject: Token Tournament Results

Thanks for participating in this week's tournament!

Tokens collected: 12
Rewards:
  • 12,000 🪙 coins

Rewards have been added to your account.
```

Mail uses existing `MailService.sendSystemMail(playerId, subject, body)`.

---

## Out of Scope

- In-app live leaderboard (real-time ranking visible to players during the week) — deferred
- Historical tournament archive screen for players — deferred
- i18n for tournament mail and UI — follow-up task
