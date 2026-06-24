# Auth + Sync Server — Design Spec

> Sub-project 2 of Skyscraper Tycoon.
> Scope: NestJS server with email auth (JWT), command log sync with reconciliation,
> Docker infrastructure (Postgres + Redis), client integration. No social features.

---

## 1. Goal

Add an authoritative server so the player's progress is saved remotely and validated.
The player registers/logs in with email+password, plays locally with zero-latency taps,
and their command log syncs to the server periodically. The server replays commands by
its own clock, stores authoritative state, and returns it for reconciliation.

### Success criteria

- Player can register, log in, and log out. Tokens persist across app restarts.
- Game state syncs to the server every ~5 seconds and on app background.
- After sync, the client's local state matches the server's authoritative state (99% of the time — deterministic replay).
- When there's a discrepancy, the client snaps to the server state (reconciliation).
- Offline play works: commands queue locally and sync when connectivity returns.
- The command queue is not cleared until the server acknowledges receipt.
- Manipulating device clock gives no advantage (server timestamps only).
- `docker compose up` starts Postgres + Redis; `npm run start:dev` starts the server.

### What is NOT in scope

- Google/Apple OAuth (future sub-project).
- Guest/anonymous login.
- Leaderboards, guilds, chat, mail, quests, referrals.
- BullMQ background jobs.
- PgBouncer, read replicas, horizontal scaling.
- Email verification, password reset.
- Rate limiting beyond NestJS built-in throttle.
- Push notifications.

---

## 2. Project Structure

```
tinytower/
├── shared/                         # Pure TS — Zod schemas, engine, types, config
│   ├── schemas/
│   │   ├── production.ts
│   │   ├── command.ts
│   │   ├── gameConfig.ts
│   │   └── gameState.ts
│   ├── engine/
│   │   ├── processCommand.ts
│   │   └── productionStatus.ts
│   ├── config/
│   │   └── gameConfig.ts
│   ├── types/
│   │   └── index.ts
│   └── tsconfig.json
├── server/                         # NestJS backend
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── auth/                   # AuthModule
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── dto/
│   │   ├── sync/                   # SyncModule
│   │   │   ├── sync.module.ts
│   │   │   ├── sync.controller.ts
│   │   │   └── sync.service.ts
│   │   ├── player/                 # PlayerModule
│   │   │   ├── player.module.ts
│   │   │   └── player.service.ts
│   │   └── prisma/                 # PrismaModule
│   │       ├── prisma.module.ts
│   │       └── prisma.service.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── test/                       # e2e tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── .env.example
├── docker-compose.yml              # Postgres + Redis
├── app/                            # Expo screens (existing)
├── src/                            # Client code (existing, imports from shared/)
│   ├── services/
│   │   ├── api.ts                  # HTTP client with auto-refresh
│   │   ├── sync.ts                 # Sync service (debounced upload)
│   │   ├── clock.ts                # GameClock → ServerClock
│   │   └── persistence.ts          # MMKV (existing)
│   ├── stores/
│   │   ├── gameStore.ts            # Updated with sync integration
│   │   └── authStore.ts            # New: auth state (tokens, user)
│   └── ...
├── shared -> shared/               # (same directory, path alias)
└── package.json                    # Client package.json
```

### Shared package migration

Files currently in `src/schemas/`, `src/engine/`, `src/config/`, `src/types/` move to
`shared/`. Client imports change from `../schemas/foo` to `@shared/schemas/foo`. Server
imports use the same alias. Both tsconfigs define:

```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

The `shared/` directory has its own `tsconfig.json` (strict, no React, no RN — pure TS
with Zod as the only dependency).

---

## 3. Docker Infrastructure

`docker-compose.yml` at project root:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: tinytower
      POSTGRES_USER: tinytower
      POSTGRES_PASSWORD: tinytower
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

Server `.env`:
```
DATABASE_URL=postgresql://tinytower:tinytower@localhost:5432/tinytower
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-prod
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
```

---

## 4. Auth Module

### Endpoints

**POST /auth/register**
```ts
// Request
{ email: string, password: string, playerName: string }
// Response 201
{ accessToken: string, refreshToken: string, player: { id, email, playerName } }
```
- Validate email format and password length (min 6) with Zod.
- Hash password with bcrypt (10 rounds).
- Create Player row with initial game state (balance=100, 5 floors, all IDLE).
- Generate JWT pair.
- Store refresh token in Redis with key `refresh:{playerId}:{jti}`, TTL 30 days.

**POST /auth/login**
```ts
// Request
{ email: string, password: string }
// Response 200
{ accessToken: string, refreshToken: string, player: { id, email, playerName } }
```
- Find player by email, compare bcrypt hash.
- Return 401 on mismatch.
- Generate JWT pair, store refresh in Redis.

**POST /auth/refresh**
```ts
// Request
{ refreshToken: string }
// Response 200
{ accessToken: string, refreshToken: string }
```
- Verify refresh token signature and expiry.
- Check token exists in Redis (prevents reuse after rotation).
- Delete old refresh token from Redis.
- Issue new JWT pair, store new refresh in Redis.
- Return 401 if token invalid/missing from Redis.

**POST /auth/logout**
```ts
// Request (requires JWT)
// Response 200
{}
```
- Delete all refresh tokens for this player from Redis.

### JWT structure

Access token payload: `{ sub: playerId, email: string, iat, exp }`.
Refresh token payload: `{ sub: playerId, jti: string, iat, exp }`.

### Guard

`JwtAuthGuard` (Passport JWT strategy) — applied globally except on `/auth/*` routes.
Extracts `playerId` from token and attaches to request.

---

## 5. Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Player {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  playerName    String
  balance       Int       @default(100)
  stateVersion  Int       @default(0)
  lastSeenAt    DateTime  @default(now()) @updatedAt
  createdAt     DateTime  @default(now())
  floors        Floor[]
}

model Floor {
  id          Int          @id @default(autoincrement())
  playerId    String
  floorId     Int
  player      Player       @relation(fields: [playerId], references: [id], onDelete: Cascade)
  productions Production[]

  @@unique([playerId, floorId])
}

model Production {
  id             Int     @id @default(autoincrement())
  floorDbId      Int
  slotIdx        Int
  typeId         String?
  stage          String  @default("IDLE")
  stageStartedAt BigInt  @default(0)
  floor          Floor   @relation(fields: [floorDbId], references: [id], onDelete: Cascade)

  @@unique([floorDbId, slotIdx])
}

model CommandLog {
  id          String   @id
  playerId    String
  type        String
  floorId     Int
  slotIdx     Int
  typeId      String?
  timestamp   BigInt
  serverTime  BigInt
  cursor      Int      @default(autoincrement())
  processedAt DateTime @default(now())

  @@index([playerId, cursor])
}
```

### Initial state on registration

When a player registers, `PlayerService.createWithInitialState()` creates:
- 1 Player row (balance=100, stateVersion=0)
- 5 Floor rows (floorId 2–6, matching gameConfig)
- 15 Production rows (3 per floor, all IDLE, typeId null)

All in one Prisma transaction.

---

## 6. Sync Module

### Endpoint

**POST /sync** (requires JWT)

```ts
// Request
{
  commands: Command[],       // Zod-validated via shared schema
  lastAckCursor: number      // last cursor client received from server
}

// Response 200
{
  state: {
    balance: number,
    floors: { id: number, name: string, productions: Production[] }[]
  },
  stateVersion: number,
  ackCursor: number,         // cursor of last accepted command
  serverTime: number         // server's Date.now() — for clock sync
}
```

### Processing flow

1. **Load current state** from Postgres: Player (balance, stateVersion, lastSeenAt) +
   Floors + Productions. Reconstruct `GameState` object matching the shared type.

2. **Dedup**: skip any commands whose `id` already exists in `CommandLog`.

3. **Wall-clock cap**: calculate `wallBudget = serverNow - player.lastSeenAt` (ms).
   Track cumulative timer consumption across commands. If a command's timer implies
   more elapsed time than `wallBudget` allows, reject it and all subsequent commands.

4. **Replay**: for each new command in order, call `processCommand(state, command,
   gameConfig, serverNow)` from the shared engine. `serverNow` is the server's
   `Date.now()` at request start (single timestamp for the whole batch). This means
   a buy+list pair in the same batch will only both succeed if the delivery duration
   is 0 or the stageStartedAt from a previous sync is old enough — this is correct
   and intended (the server measures real elapsed time). If `processCommand` returns
   `success: false`, skip that command (log warning).

5. **Persist**: in one Postgres transaction:
   - Update Player: balance, stateVersion++, lastSeenAt = serverNow
   - Update affected Floor/Production rows
   - Insert accepted commands into CommandLog with `serverTime = serverNow`

6. **Return** authoritative state, new stateVersion, ackCursor (cursor of last
   inserted CommandLog row), and serverTime.

### Idempotency

Commands have unique `id` (UUID). Replaying the same command batch is safe — dupes
are skipped. The client retries failed syncs with the same commands until ack.

### Error handling

- Invalid JWT → 401
- Malformed body (Zod validation fails) → 400
- Player not found → 404
- Database error → 500, client retries later

---

## 7. Client Auth Integration

### Auth Store (`src/stores/authStore.ts`)

```ts
{
  accessToken: string | null,
  refreshToken: string | null,
  player: { id, email, playerName } | null,
  isAuthenticated: boolean,
  login: (email, password) => Promise<void>,
  register: (email, password, playerName) => Promise<void>,
  logout: () => void,
  loadTokens: () => void,    // hydrate from MMKV on app start
}
```

Tokens stored in MMKV (keys: `auth:accessToken`, `auth:refreshToken`, `auth:player`).

### API Service (`src/services/api.ts`)

Thin fetch wrapper:
- Base URL configurable (localhost for dev, production URL later).
- Attaches `Authorization: Bearer <accessToken>` to all requests.
- On 401: attempts refresh via `/auth/refresh`. If refresh fails → logout, navigate to welcome screen.
- Returns typed responses.

### Navigation changes

- Welcome screen: "Почати будувати" → if authenticated, go to game; if not, go to login.
- Login/Register: on success, save tokens, navigate to game.
- Game screen: on mount, trigger initial sync to load server state.

---

## 8. Client Sync Integration

### Sync Service (`src/services/sync.ts`)

Replaces the current "fire and forget" local-only approach:

- **Debounced sync**: subscribe to gameStore changes, sync at most every 5 seconds.
- **Immediate sync**: on `AppState` change to background.
- **Connectivity sync**: on return from offline (NetInfo listener).
- **Initial sync**: on game screen mount after login, fetch server state.

Sync flow:
1. Gather commands from `commandQueue` in store.
2. POST `/sync` with commands and `lastAckCursor`.
3. On success:
   - Remove acked commands from queue (commands with cursor ≤ ackCursor).
   - Compare `stateVersion` — if matches local expectation, do nothing.
   - If different → reconciliation: replace local state with server state.
   - Update `lastAckCursor` in store.
   - Update `ServerClock` offset from `serverTime`.
4. On network failure: do nothing, retry next cycle. Commands stay in queue.

### ServerClock (`src/services/clock.ts`)

Upgrade from `DeviceClock`:

```ts
class ServerClock implements GameClock {
  private offset: number = 0;

  updateOffset(serverTime: number): void {
    this.offset = serverTime - Date.now();
  }

  now(): number {
    return Date.now() + this.offset;
  }
}
```

Initial offset is 0 (same as DeviceClock). After first sync response, offset is
calibrated. Subsequent syncs refine it. Engine functions already accept `now` as a
parameter — no changes needed in the engine.

### Store changes (`src/stores/gameStore.ts`)

Add:
- `lastAckCursor: number` — tracks server cursor position
- `stateVersion: number` — tracks expected version
- `reconcile(serverState, stateVersion, ackCursor)` — replaces local state with server state
- `clearAckedCommands(ackCursor)` — removes commands up to cursor

### MMKV persistence update

Continue persisting game state + command queue to MMKV (crash safety). Also persist
`lastAckCursor` and `stateVersion` so they survive app restarts.

---

## 9. Error Handling

### Server
- Zod validation on all request bodies (nestjs-zod or manual pipe).
- bcrypt errors on auth → 500.
- Prisma unique constraint on email → 409 Conflict ("email already registered").
- Command replay failures are non-fatal: skip invalid command, continue with next.
- All errors return consistent JSON: `{ statusCode, message, error }`.

### Client
- Network errors: swallow silently, retry on next sync cycle. Game continues locally.
- Auth errors (401 after refresh failure): clear tokens, navigate to welcome.
- Sync response with different state: reconciliation (not an error, expected behavior).
- No error toasts for sync failures — the player shouldn't notice.

---

## 10. Testing Strategy

### Server
- **Unit tests**: AuthService (register, login, token generation), SyncService
  (command replay, wall-clock cap, idempotency).
- **e2e tests**: full HTTP flow — register → login → sync commands → verify state.
  Use Prisma with a test database.
- **Shared engine**: existing 57 unit tests continue to pass from shared/.

### Client
- **Existing engine tests**: still pass after migration to shared/.
- **Manual testing**: register on device → play → close → reopen → verify state
  persisted via sync. Kill server → play offline → restart server → sync recovers.
