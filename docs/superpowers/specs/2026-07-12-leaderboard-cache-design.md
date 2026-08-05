# Leaderboard Redis Cache

**Date:** 2026-07-12
**Status:** Approved

## Problem

The leaderboard endpoint hits PostgreSQL on every client request (tab switch, page change, sheet open). As the player base grows this becomes a significant DB load for data that changes rarely.

## Goal

Cache the expensive, shared parts of the leaderboard response in Redis for 5 minutes. Keep the per-player portion live. Display a note in the UI that the leaderboard refreshes every 5 minutes.

## Architecture

The leaderboard response has two parts:

- **Shared** — `entries` (the page of 20 ranked players) and `total` (count of all players). These are identical for every user requesting the same tab + page.
- **Personal** — `currentPlayer.rank` and `currentPlayer.value`. Unique per player; computed with two cheap `COUNT` queries.

Only the shared part is cached. The personal part is always computed live.

## Backend

### Cache key

```
lb:{tab}:{page}
```

Examples: `lb:level:1`, `lb:floors:3`, `lb:revenue:1`

### TTL

300 seconds (5 minutes).

### Flow

```
request arrives
  → check Redis for key lb:{tab}:{page}
  → HIT:  return cached { entries, total } + freshly computed currentPlayer
  → MISS: query DB for entries + total
           store { entries, total } in Redis with TTL 300s
           return full response
```

### Changes

- `LeaderboardService` receives `Redis` via injection (reuses the existing Redis provider from `auth` module — `REDIS_CLIENT` token).
- `getLeaderboard` is refactored to split the shared query from the personal query as described above.
- `LeaderboardModule` imports `AuthModule` (or a shared `RedisModule` if one is extracted later) to get the Redis client.

No cache invalidation logic needed — TTL expiry is sufficient given the 5-minute freshness requirement.

## Frontend

A single line of small text added inside the gradient header of `LeaderboardSheet`, between the tabs row and the list. Text: localised via `tabs` namespace, key `leaderboard.cacheNotice`.

Translations:
- `en`: `"Updates every 5 minutes"`
- `uk`: `"Оновлюється кожні 5 хвилин"`

## Out of scope

- Cache invalidation on player stat change
- Redis Sorted Sets or background snapshot approaches
- Leaderboard websocket / push updates
