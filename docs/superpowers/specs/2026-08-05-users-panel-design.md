# Users Panel & Player Profile — Design Spec
Date: 2026-08-05

## Overview

Add a "Users" entry to the menu tab. Tapping it opens a bottom sheet with three tabs (Online, No City, Search). Each user card navigates to a read-only profile screen for that player.

---

## 1. Menu Item

**File:** `app/(tabs)/menu.tsx`

- New `Pressable` at the bottom of the menu list.
- Left side: green circle (8px, `#52B847`) + label "Users".
- Right side: chip showing online count (e.g. "3 online"), fetched when `UsersSheet` opens.
- Opens `UsersSheet` bottom sheet (state: `usersOpen`).

---

## 2. UsersSheet

**File:** `src/components/UsersSheet.tsx`

Pattern mirrors `LeaderboardSheet`: slide-up Modal with animated scrim, gradient header, tabs, FlatList content.

### Header
- Gradient: `['#3FA535', '#2E7D28']` (green, distinct from leaderboard blue)
- Title: "Users"
- Close button (✕)

### Tabs
| Key | Label | Data source |
|-----|-------|-------------|
| `online` | Online | `GET /players/online?page=` |
| `no-city` | Без міста | `GET /players/no-city?page=` |
| `search` | Пошук | `GET /players/search?q=&page=` |

### Player Card (all tabs)
- Avatar: `getUserIcon(playerLevel)` — 36×36, circular
- Player name (Fredoka_600SemiBold)
- Level badge
- City (or "—" if absent)
- Green dot (6px, `#52B847`) if online (lastSeenAt within 5 min)
- Full card is `Pressable` → `router.push('/user-profile/' + id)` then close sheet

### Search Tab specifics
- `TextInput` at top of content area (debounced 400ms)
- Results appear below; empty state if query < 2 chars
- No pagination needed (max 20 results)

### Pagination (Online / No-city tabs)
- Prev / Next page buttons at bottom (same pattern as LeaderboardSheet)
- 20 items per page

### Online count badge on menu item
- Fetched from `GET /players/online?page=1` `total` field when MenuScreen mounts (useEffect on mount)
- Stored in local state in `menu.tsx`, shown on menu item label
- Refreshes each time the menu tab is focused (useFocusEffect)

---

## 3. User Profile Screen

**File:** `app/user-profile/[id].tsx`

Full-screen `ScrollView` with `AppBackground`. Data fetched from `GET /players/:id` on mount.

### Block 1 — Header Card
- `FloorStarsRow` (avgStars from fetched data)
- Avatar: `getUserIcon(playerLevel)` 72×72
- `playerName` (no email)
- Level number + XP progress bar (no XP amounts, just visual bar showing progress to next level)
- Floor count (replaces coins/gems row): e.g. "12 floors"
- Divider
- Happy workers / Specialists row (icons + `happyCount/totalWorkers`, `specialistCount/totalWorkers`)

### Block 2 — Actions
Two full-width buttons (same visual style as `achievementsButton`):
- "Написати повідомлення" — `onPress` is no-op, grayed slightly or normal style
- "Додати до друзів" / "Видалити з друзів" — no-op; toggle state is local only for now (defaults to "Додати")

### Block 3 — Achievements
- Row styled like `achievementsButton` in `profile.tsx`
- Icon: `assets/img/profile/achivProfileIcon.png`
- Label: "Achievements (N)" where N = sum of all categoryProgress levels
- Tapping toggles inline dropdown
- Dropdown shows ACHIEVEMENT_CATEGORIES list: category icon, category name, current level (e.g. "L3")
- If level is 0, show grayed out row

### Block 4 — Бізнес
- Section header: "Бізнес"
- 5 rows for floor types: green, blue, yellow, purple, red
- Each row: floor type color dot or icon + business name + upgrade progress % (businessUpgradeLevel / 40 * 100)
- If upgrade level is 0, show "0%"

### Block 5 — Виручка
- Section header: "Виручка"
- Row: поточна виручка/хв → `revenuePerMin` value
- Row: бонус до монет → `coinBonusPct`% (show even if 0)
- Row: бонус до досвіду → `xpBonusPct`% (show even if 0)
- Row: рекорд виручки/хв → `maxRevenuePerMin`

### Block 6 — Статус
- Section header: "Статус"
- Online status: green dot + "Онлайн" if `lastSeenAt > now - 5min`, else "Був N хв/год/днів тому"
- Days in game: `Math.floor((now - createdAt) / 86400000)` days

---

## 4. Backend — New Endpoints

**Module:** `server/src/player/` (new controller + service methods)

All endpoints are authenticated (`JwtAuthGuard`).

### `GET /players/online?page=1`
- Filter: `lastSeenAt > new Date(Date.now() - 5 * 60 * 1000)`
- Returns: `{ entries: PlayerEntry[], total: number }`
- `PlayerEntry`: `{ id, playerName, playerLevel, city, lastSeenAt }`
- Ordered by `lastSeenAt DESC`, 20/page

### `GET /players/no-city?page=1`
- Filter: `city IS NULL OR city = ''`
- Same shape as online response
- Ordered by `playerLevel DESC`, 20/page

### `GET /players/search?q=&page=1`
- Filter: `playerName ILIKE '%q%'` (min q length: 2 chars enforced client-side)
- Same shape, 20/page, ordered by `playerLevel DESC`

### `GET /players/:id`
Returns full profile object:
```ts
{
  id: string
  playerName: string
  playerLevel: number
  playerXp: number
  openedFloorsCount: number
  lastSeenAt: string  // ISO
  createdAt: string   // ISO
  avgStars: number    // avg of floorStars across all floors
  maxRevenuePerMin: number
  revenuePerMin: number       // calculated server-side: sum of all active floor productions' revenue/min
  coinBonusPct: number        // calculated from categoryProgress (same logic as client achievement bonuses)
  xpBonusPct: number          // calculated from categoryProgress (same logic as client achievement bonuses)
  happyWorkers: number
  specialistWorkers: number
  totalWorkers: number
  businessUpgrades: Record<string, number>  // floorType → level (0-40)
  categoryProgress: Record<string, number>  // categoryKey → level
}
```

---

## 5. API Client

**File:** `src/services/api.ts`

New methods added to `api` object:
```ts
getOnlinePlayers: (page: number) => request<UsersResponse>('GET', `/players/online?page=${page}`)
getNoCityPlayers: (page: number) => request<UsersResponse>('GET', `/players/no-city?page=${page}`)
searchPlayers: (q: string, page: number) => request<UsersResponse>('GET', `/players/search?q=${encodeURIComponent(q)}&page=${page}`)
getPlayerProfile: (id: string) => request<PlayerProfile>('GET', `/players/${id}`)
```

New interfaces: `UserEntry`, `UsersResponse`, `PlayerProfile`.

---

## 6. Routing

Add `app/user-profile/[id].tsx` — Expo Router dynamic route, accessible via `router.push('/user-profile/' + id)`.

---

## Out of Scope (placeholder only)
- "Написати повідомлення" — no functionality
- "Додати / Видалити з друзів" — no backend, local UI state only
- Push notifications for friend activity
