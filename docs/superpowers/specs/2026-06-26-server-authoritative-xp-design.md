# Server-Authoritative XP & Level System

**Date:** 2026-06-26  
**Status:** Approved

## Problem

Currently `playerLevel` and `playerXp` are:
1. Computed exclusively on the client (`gameStore.ts:executeCommand`)
2. Sent to the server as trusted payload on every sync request
3. Stored inside the `lobbyState Json?` blob — no dedicated DB columns
4. Used by the server in `processCommand` as the *client-reported* value (gem limits, lobby capacity)

A malicious client can send `playerLevel: 9999` and the server persists it without question. The existing `commandLog` table provides auditability of commands, but the XP/level derived from those commands is never computed server-side.

## Goal

- XP and level are computed server-side from accepted commands
- `playerLevel` and `playerXp` live in dedicated typed DB columns
- Client keeps optimistic local computation for instant ring animation UX
- Server value is authoritative and overrides client on reconcile

## Design

### 1. Prisma schema — new columns

```prisma
model Player {
  // existing fields...
  playerLevel  Int  @default(1)
  playerXp     Int  @default(0)
}
```

Migration copies existing values from `lobbyState->>'playerLevel'` and `lobbyState->>'playerXp'` to the new columns for existing rows, then the server stops reading/writing those fields from the JSON blob.

### 2. Shared XP engine — `shared/engine/xp.ts`

Move `xpForLevel` from `gameStore.ts` to shared so both client and server use the identical formula.

```ts
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export interface LevelUpEvent {
  newLevel: number;
  coinReward: number;
  gemReward: number;
}

export interface XpResult {
  playerLevel: number;
  playerXp: number;
  levelUpEvents: LevelUpEvent[];
  bonusCoins: number;
  bonusGems: number;
}

export function applyXpGain(
  playerLevel: number,
  playerXp: number,
  xpGained: number,
): XpResult { ... }

export function xpForCommand(
  command: Command,
  prevState: GameState,
  nextState: GameState,
): number {
  const coinDelta = Math.abs(nextState.balance - prevState.balance);
  const listBonus = command.type === 'list' ? 10 : 0;
  return coinDelta + listBonus;
}
```

### 3. Server — `sync.service.ts`

**Removed:** `playerLevel?` and `playerXp?` parameters from `processSync()`.

**Changed:** `player.playerLevel` and `player.playerXp` are read from DB and passed to `processCommand` — the server never trusts the client's reported level.

**Added:** After the accepted-commands loop, the server:
1. Accumulates `xpGained` per command using `xpForCommand(cmd, prevState, nextState)`
2. Calls `applyXpGain(player.playerLevel, player.playerXp, totalXp)` to get new level/XP and any level-up rewards
3. Adds `bonusCoins` and `bonusGems` to `gameState.balance` / `gameState.gems`
4. Stores `playerLevel` and `playerXp` as dedicated columns in the `$transaction` `player.update` — **not** inside `lobbyState`

**SyncResult** returns `playerLevel: number` and `playerXp: number` (unchanged interface).

### 4. Server — `sync.controller.ts`

Removes `playerLevel` and `playerXp` from `SyncRequestSchema`. The Zod schema no longer accepts these fields from the client.

### 5. Client — `sync.ts`

Removes `playerLevel` and `playerXp` from the POST body.

### 6. Client — `gameStore.ts`

- Imports `xpForLevel` and `applyXpGain` from `shared/engine/xp.ts` (no longer defined locally)
- `executeCommand` keeps optimistic XP computation for instant ring animation
- `reconcile` and `clearAckedCommands` apply server-returned `playerLevel`/`playerXp` as before

### 7. Client — `persistence.ts`

No functional change. `playerLevel`/`playerXp` continue to be saved locally for offline play.

## Data Flow

```
Client taps → executeCommand() → optimistic XP update (ring animates instantly)
                                ↓
                          commandQueue.push(cmd)
                                ↓
            [5s sync] POST /sync { commands, lastAckCursor }
                                ↓
                    server reads player.playerLevel from DB
                    processCommand(state, cmd, config, ts, DB_playerLevel)
                    xpForCommand(cmd, prevState, nextState) per accepted cmd
                    applyXpGain(dbLevel, dbXp, totalXp) → new level + rewards
                    UPDATE player SET playerLevel=N, playerXp=X (typed columns)
                                ↓
                    response: { state, playerLevel, playerXp, ... }
                                ↓
            reconcile() → override client playerLevel/playerXp with server values
```

## Auditability

Every accepted command is recorded in `commandLog` with `playerId`, `type`, `timestamp`, `serverTime`. The XP gained per command is derivable from this log using `xpForCommand`. No separate XP ledger table is needed — the command log is the audit trail.

## What Does NOT Change

- `LevelUpEvent` type and `levelUpQueue` in the store — level-up modal still works
- `commandLog` schema — no changes
- Optimistic client UX — ring animation remains instant
- `SyncResult` interface shape — still returns `playerLevel`/`playerXp`
- `lobbyState` JSON blob — still used for all other lobby fields (visitors, elevator, etc.)

## Out of Scope

- Anti-cheat beyond server-side computation (rate limiting, velocity checks)
- XP from sources other than commands (future: achievements, etc.)
- Leaderboard queries (enabled by new columns but not built here)
