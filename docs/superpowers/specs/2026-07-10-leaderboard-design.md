# Leaderboard Feature Design

**Date:** 2026-07-10

## Overview

A leaderboard screen accessible from the menu with 3 tabs: by player level, by number of open business floors, and by max revenue per minute ever achieved.

## Database Changes

Two new fields added to the `Player` model:

```prisma
maxRevenuePerMin  Int  @default(0)
openedFloorsCount Int  @default(0)
```

- `maxRevenuePerMin` — all-time peak revenue/min, updated during sync if current value exceeds stored value
- `openedFloorsCount` — count of floors with an opened business type (rows in `PlayerFloorType`), updated during sync

Both are denormalized for fast leaderboard `ORDER BY` queries without subqueries.

## Sync Changes (`sync.service.ts`)

After all commands are processed and `gameState` is final:

1. Compute `currentRevenue = calcRevenuePerMin(gameState.floors, gameState.workers, gameState.openedFloorTypes, gameConfig, serverNow)`
2. Compute `currentOpenedFloors = Object.keys(gameState.openedFloorTypes).length`
3. In the same transaction, update `Player`:
   - `maxRevenuePerMin: { max of current DB value and currentRevenue }` — use conditional update
   - `openedFloorsCount: currentOpenedFloors`

## API

**New module:** `server/src/leaderboard/`

**Endpoint:** `GET /leaderboard?tab=level|floors|revenue&page=1` (JWT-protected)

**Page size:** 20 entries

**Response shape:**
```ts
{
  entries: {
    rank: number;
    playerId: string;
    playerName: string;
    value: number;       // playerLevel | openedFloorsCount | maxRevenuePerMin
  }[];
  total: number;
  currentPlayer: {
    rank: number;
    value: number;
  };
}
```

**Query logic per tab:**
- `level` → `ORDER BY playerLevel DESC, createdAt ASC`
- `floors` → `ORDER BY openedFloorsCount DESC, createdAt ASC`
- `revenue` → `ORDER BY maxRevenuePerMin DESC, createdAt ASC`

`currentPlayer` rank is derived as `COUNT(*) WHERE value > currentPlayerValue + 1` (players strictly above → dense rank). Ties share the same rank number.

## UI

**Menu entry:** new `Pressable` item "Рейтинг" with trophy icon, opens `LeaderboardSheet`.

**`src/components/LeaderboardSheet.tsx`** — bottom sheet following the same pattern as `WarehouseSheet` and `WorkersPanel`:

- 3 tab buttons at top: "Рівень" / "Поверхи" / "Виручка/хв"
- List of 20 rows: `#rank  playerName  value`
- Current player row highlighted (gold background tint)
- If current player is not on the visible page: pinned row at the bottom showing their rank and value
- Pagination buttons: "◀" / "▶", disabled at boundaries
- `ActivityIndicator` while loading; error state with retry button
- Data fetches on sheet open, tab change, and page change

## File Checklist

| File | Change |
|------|--------|
| `server/prisma/schema.prisma` | Add `maxRevenuePerMin`, `openedFloorsCount` to `Player` |
| `server/prisma/migrations/...` | Migration file |
| `server/src/leaderboard/leaderboard.module.ts` | New module |
| `server/src/leaderboard/leaderboard.controller.ts` | `GET /leaderboard` |
| `server/src/leaderboard/leaderboard.service.ts` | Query logic |
| `server/src/app.module.ts` | Register `LeaderboardModule` |
| `server/src/sync/sync.service.ts` | Update `maxRevenuePerMin` and `openedFloorsCount` during sync |
| `src/components/LeaderboardSheet.tsx` | New bottom sheet component |
| `app/(tabs)/menu.tsx` | Add "Рейтинг" menu item |
| `src/services/api.ts` | Add `leaderboard` API call |
