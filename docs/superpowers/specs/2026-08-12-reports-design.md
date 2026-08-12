# Reports System Design

**Date:** 2026-08-12  
**Status:** Approved

## Overview

A moderation system that lets players report chat messages, forum posts, and forum comments. Reports accumulate per content item; after 5 reports the content is auto-hidden. Admins review reported content in a dedicated admin panel page, sorted by report count, and can delete or dismiss each item.

---

## 1. Database (Prisma)

### New model: `Report`

```prisma
model Report {
  id         String           @id @default(uuid())
  reporterId String
  targetType ReportTargetType
  targetId   String
  category   ReportCategory
  createdAt  DateTime         @default(now())
  reporter   Player           @relation(fields: [reporterId], references: [id], onDelete: Cascade)

  @@unique([reporterId, targetType, targetId])
  @@index([targetType, targetId])
  @@index([createdAt])
}

enum ReportTargetType { CHAT_MESSAGE FORUM_POST FORUM_COMMENT }
enum ReportCategory   { SPAM INSULT ADVERTISEMENT PROFANITY THREAT OTHER }
```

### Changes to existing models

Add two fields to `ChatMessage`, `ForumPost`, `ForumComment`:

```prisma
reportCount Int     @default(0)
isHidden    Boolean @default(false)
```

### Auto-hide logic

On each new report the server atomically increments `reportCount`. If `reportCount >= 5`, it sets `isHidden = true`. Hidden content is excluded from all normal fetch queries (`where: { isHidden: false }`). A player can still see their own hidden content (`OR playerId = currentUser`).

### Duplicate prevention

The `@@unique([reporterId, targetType, targetId])` constraint blocks a player from reporting the same content twice. The server returns 409 if the constraint is violated.

---

## 2. Backend API (NestJS)

### New module: `server/src/report/`

Files: `report.module.ts`, `report.controller.ts`, `report.service.ts`.

### Player endpoints (JWT required)

```
POST /report
Body: { targetType: ReportTargetType, targetId: string, category: ReportCategory }
```
- Validates target exists and is not soft-deleted
- Increments `reportCount`, sets `isHidden = true` if count reaches 5
- Returns `{ ok: true }` on success
- Returns 409 if the player already reported this item
- Returns 404 if the target does not exist

### Admin endpoints (AdminGuard required)

```
GET    /admin/reports?page=1&limit=50
GET    /admin/reports/:targetType/:targetId
DELETE /admin/reports/:targetType/:targetId/content
POST   /admin/reports/:targetType/:targetId/dismiss
```

- `GET /admin/reports` — paginated list sorted by `reportCount DESC`, only items with `reportCount > 0`; each row includes: `targetType`, `targetId`, `reportCount`, content preview (80 chars), category breakdown (`{SPAM: 3, INSULT: 2, …}`)
- `GET /admin/reports/:targetType/:targetId` — full content + all individual reports with reporter name, category, date
- `DELETE …/content` — soft-deletes the content (`deletedAt = now()`), resets `reportCount = 0`, `isHidden = false`
- `POST …/dismiss` — keeps the content, resets `reportCount = 0`, `isHidden = false` (removes from queue)

### Changes to existing services

- `ChatService.fetchMessages` — add `where: { isHidden: false }` (already has `deletedAt: null`)
- `ForumService.fetchPosts` — add `where: { isHidden: false }`
- `ForumService.fetchComments` — add `where: { isHidden: false }`

---

## 3. Mobile UI (React Native / Expo)

### Report categories (displayed in UI)

| Key | Label (UA) |
|-----|-----------|
| SPAM | Спам |
| INSULT | Образа |
| ADVERTISEMENT | Реклама |
| PROFANITY | Нецензурна лексика |
| THREAT | Загроза |
| OTHER | Інше |

### Entry points

- **Chat** (`src/components/ChatMessage.tsx`) — long-press context menu on messages that are not the current player's; add "Поскаржитись" option
- **Forum post** (`src/components/ForumPostRow.tsx`) — `⋯` button on posts not owned by current player; add "Поскаржитись" option
- **Forum comment** (`src/components/ForumComment.tsx`) — `⋯` button on comments not owned by current player; add "Поскаржитись" option

### Report flow

1. Tap "Поскаржитись" → bottom sheet with 6 radio options (categories)
2. Tap "Надіслати скаргу" → `POST /report` → toast "Скаргу надіслано"
3. On 409 → toast "Ви вже скаржились на це повідомлення"
4. On error → toast "Помилка. Спробуйте ще раз"

### Client state

New `useReportStore` (Zustand) holds a `Set<string>` of already-reported `targetId` values (keyed as `${targetType}:${targetId}`). The "Поскаржитись" option is disabled for items already in this set, avoiding a round-trip.

### Hidden content

Hidden content is filtered server-side. The client receives nothing extra — no placeholder or "hidden" indicator needed.

---

## 4. Admin Panel (React/Vite)

### New page: `ReportsPage`

- Route: `/reports` added to `admin/src/App.tsx`
- Nav link added to `admin/src/components/Layout.tsx`

### Reports table

Uses existing `DataTable` component. Columns:

| Column | Details |
|--------|---------|
| Type | Badge: `CHAT` / `POST` / `COMMENT` |
| Author | `playerName` |
| Content preview | First 80 chars of `body` (or `title + body` for posts) |
| Report count | Bold red number |
| Categories | Compact: `spam×3 insult×2 …` |
| Actions | "Видалити" / "Залишити" buttons |

Sorted by `reportCount DESC`. Pagination: 50 per page.

### Detail view

Clicking a row expands it (or opens a modal) showing: full content text, list of individual reports (reporter name, category, date).

### Actions

Both actions use the existing `ConfirmDialog` before executing:
- **Видалити** → `DELETE /admin/reports/:type/:id/content` → row removed, toast "Видалено"
- **Залишити** → `POST /admin/reports/:type/:id/dismiss` → row removed, toast "Скарги знято"

---

## 5. i18n

Add keys to `src/i18n/locales/*/` for:
- Report sheet title
- Each category label
- Submit button
- Toast messages (success, duplicate, error)

---

## Out of scope

- Notifying content authors after moderation action
- Auto-banning players with many reported content items
- Appeal mechanism for authors
