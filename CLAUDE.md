# Vibe Tower — Claude Code Guide

## Project Overview
React Native (Expo) mobile game + NestJS backend + `shared/` engine (command schemas, game logic).
App name: **Vibe Tower** | Bundle ID: `com.shmidt.vibetower` | Deep-link scheme: `vibetower://`

## Feature Docs
All feature knowledge lives in `docs/features/`. Read the relevant doc before working on a module:
- sync → `docs/features/sync.md`
- auth → `docs/features/auth.md`
- game-core → `docs/features/game-core.md`
- cities → `docs/features/cities.md`
- payments → `docs/features/payments.md`
- tournament → `docs/features/tournament.md`
- chat → `docs/features/chat.md`
- achievements → `docs/features/achievements.md`
- leaderboard → `docs/features/leaderboard.md`
- referral → `docs/features/referral.md`
- friends → `docs/features/friends.md`
- infra/env → `docs/features/infra.md`
- API endpoints → `docs/features/api-endpoints.md`
- dev workflow → `docs/features/dev-workflow.md`

## Key Conventions
- **Command pattern**: all game state mutations go through `executeCommand()` in `src/stores/gameStore.ts` — never `set()` directly (wiped by reconcile)
- **Modals**: new notification modals go through `GlobalOverlay` in `src/components/GlobalOverlay.tsx`, never rendered locally in tabs/screens
- **Gem color**: `#2592AB` everywhere gems are shown
- **i18n**: all user-facing strings via i18n keys; Cyrillic text via `LocaleText` wrapper
- **Random side-effects** (drops, rewards): generate values BEFORE `executeCommand`, embed in command, handle in shared engine

## Critical Constraints
- Never trigger a GlobalOverlay modal inside an async action while a local `<Modal>` is still open — defer via `setTimeout(fn, 450)` after closing the local modal (iOS UI freeze)
- `useGameClock(1000)` lags up to ~1s after store mutations — split measurement effects: one on step change (clear state), one gated on `isReady`
- `GestureHandlerRootView` inside `visible=false` Modal blocks all touches on Fabric+RNGH v2 — use `{visible && <GestureHandlerRootView>}`

## Dev Commands
**Client (Expo):**
```bash
npm start          # expo start (Metro bundler)
npm run ios        # expo run:ios
npm run android    # expo run:android
npm test           # jest
```

**Server (NestJS, run from `server/`):**
```bash
npm run start:dev       # watch mode
npm run start:prod      # production (node dist/main)
npm run build           # nest build
npm run prisma:migrate  # prisma migrate dev
npm run prisma:generate # regenerate prisma client
npm run test            # jest
```

**Infrastructure:**
```bash
docker compose up -d    # start Postgres (port 5435) + Redis (port 6379)
```

## Architecture
- **Client**: Zustand stores → `executeCommand` → optimistic update → 30s polling `/sync` → reconcile (full overwrite) or prune queue
- **Server**: NestJS modules, Prisma ORM, PostgreSQL, Redis (refresh tokens + password reset tokens)
- **Shared**: `shared/engine/processCommand.ts` is the deterministic game engine run on both client and server
