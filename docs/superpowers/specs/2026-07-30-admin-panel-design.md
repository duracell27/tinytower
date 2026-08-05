# Admin Panel — Design Spec

**Date:** 2026-07-30
**Status:** Approved

## Overview

A standalone Vite + React SPA at `tinytower/admin/` that lets an administrator view, edit, and delete players, modify game parameters, and inspect command logs. It talks directly to the existing NestJS backend via new admin-only REST endpoints.

---

## Architecture

### Frontend: `tinytower/admin/`

Separate Vite project with its own `package.json`. Runs on `:5173` in dev; built to static files for prod.

**Tech stack:**
| What | Library |
|---|---|
| Bundler | Vite + React + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Data fetching | TanStack Query v5 |
| Routing | React Router v6 |
| Forms | React Hook Form + zod |

Shared types imported from `../../shared/` via Vite path alias — no duplication.

### Backend: `tinytower/server/src/admin/`

New NestJS module. All routes protected by `JwtAuthGuard` + existing `AdminGuard` (checks `isAdmin` on JWT payload).

Three files: `admin.module.ts`, `admin.controller.ts`, `admin.service.ts`.

---

## File Structure

```
tinytower/
├── admin/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── api/               ← typed fetch helpers (players, commands)
│       ├── components/        ← shared UI (DataTable, ConfirmDialog, etc.)
│       └── pages/
│           ├── LoginPage/
│           ├── PlayersPage/
│           ├── PlayerDetailPage/
│           └── CommandLogsPage/
└── server/src/admin/
    ├── admin.module.ts
    ├── admin.controller.ts
    └── admin.service.ts
```

---

## Backend — REST Endpoints

All under `/admin/*`, require `isAdmin: true`.

### Players

```
GET    /admin/players?page=1&limit=20&search=   Paginated list
GET    /admin/players/:id                        Full player profile
PATCH  /admin/players/:id/info                  playerName, email, isAdmin, playerLevel, playerXp
PATCH  /admin/players/:id/economy               balance, gems
PATCH  /admin/players/:id/materials             briks, glass, nails, screw
PATCH  /admin/players/:id/tokens                green, blue, yellow, purple, red
DELETE /admin/players/:id/workers/:workerId     Remove a worker
DELETE /admin/players/:id/floors/:floorId       Remove a floor
DELETE /admin/players/:id                       Delete player (cascades via Prisma)
```

### Command Logs

```
GET /admin/commands?page=1&limit=50&playerId=&type=   Paginated logs
```

### `GET /admin/players/:id` response shape

```ts
{
  id, email, playerName, playerLevel, playerXp, isAdmin, createdAt, lastSeenAt,
  balance, gems,
  tools: { briks, glass, nails, screw },
  tokens: { green, blue, yellow, purple, red },
  workers: [{ id, name, level, floorType, dreamJob, isSpecialist, assignedFloorId, assignedSlotIdx }],
  floors: [{ floorId, floorType, productions: [{ slotIdx, typeId, stage }] }],
  lobbyCapacity, hotelCapacity, elevatorLevel,
}
```

### `GET /admin/commands` response shape

```ts
{
  data: [{ id, playerId, playerName, type, floorId, slotIdx, typeId, workerId, timestamp, processedAt }],
  total: number,
  page: number,
  totalPages: number,
}
```

---

## Frontend — Pages

### Auth flow

1. `POST /auth/login` → `{ accessToken, refreshToken, player: { isAdmin } }`
2. If `isAdmin === false` → show "Access denied", do not store token
3. `accessToken` stored in `localStorage`, sent as `Authorization: Bearer ...` on every request
4. On 401 response → redirect to `/login`

### Routes

```
/login          LoginPage
/players        PlayersPage
/players/:id    PlayerDetailPage
/commands       CommandLogsPage
```

Unauthenticated users redirect to `/login`.

### LoginPage

Email + password form. On success stores token and redirects to `/players`.

### PlayersPage

shadcn `DataTable` with columns:
`playerName | email | level | balance | gems | isAdmin | lastSeenAt | actions`

- Debounced search input (name/email)
- Pagination at bottom
- "View" button → `/players/:id`
- "Delete" button → confirm dialog → `DELETE /admin/players/:id`

### PlayerDetailPage

Header: player name + "Delete player" button with confirm dialog.

shadcn `Tabs` with six tabs, each with its own form and "Save" button:

| Tab | Fields |
|---|---|
| Info | playerName, email, isAdmin toggle, playerLevel, playerXp |
| Economy | balance (coins), gems |
| Materials | briks, glass, nails, screw |
| Tokens | green, blue, yellow, purple, red |
| Workers | list with name/level/floorType/dreamJob/assignedFloor, Delete button per row |
| Floors | list with floorId/type/production count, Delete button per row |

Save success/error shown via shadcn `toast`.

### CommandLogsPage

shadcn `DataTable` with columns:
`playerName | type | floorId | timestamp | processedAt`

Filters above table:
- Searchable player select (loads from `/admin/players`)
- Command type select (all types from CommandSchema union)

Pagination at bottom (50 per page).

---

## Dev Setup

```bash
# terminal 1 — backend (already exists)
cd server && npm run start:dev

# terminal 2 — admin SPA
cd admin && npm run dev        # Vite on :5173
```

Vite proxy in `vite.config.ts` forwards `/api/*` → `http://localhost:3000` to avoid CORS.

## Prod Deploy

`npm run build` in `admin/` produces static files. Can be served via nginx or NestJS `ServeStaticModule`.
