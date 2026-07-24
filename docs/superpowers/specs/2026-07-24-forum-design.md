# Forum Feature — Design Spec

**Date:** 2026-07-24  
**Status:** Approved

---

## 1. Overview

A persistent community forum built into the TinyTower mobile app. Players can create posts and comment in five topic categories. Forum content is stored indefinitely and only accessible to authenticated users.

---

## 2. Categories

| Key | Display Name (UA) | Who can post |
|-----|-------------------|--------------|
| `NEWS` | Новини | Admins only |
| `HELP` | Допомога по грі | Any auth user |
| `GENERAL` | Загальний | Any auth user |
| `CITIES` | Міста | Any auth user |
| `PURCHASES` | Покупки | Any auth user |

---

## 3. Post States & Icons

Each post in the list displays one icon (left side). Priority order (highest first):

| Priority | Condition | Icon file |
|----------|-----------|-----------|
| 1 | `isClosed = true` | `assets/img/forum/closed.png` |
| 2 | `isPinned = true` | `assets/img/forum/pinned.png` |
| 3 | `isUnread = true` | `assets/img/forum/new.png` |
| 4 | visited, no new comments | `assets/img/forum/viewed.png` |
| 5 | fallback | `assets/img/forum/document.png` |

`folderwithdocs.png` is used exclusively for category cards on the forum home screen.

**Title weight:** Bold (`Fredoka_700Bold`) only for pinned posts. All others use regular weight (`Fredoka_600SemiBold`).

A closed post can still be read and browsed; the comment input is replaced by a "Topic closed" banner.

---

## 4. Read / Unread Tracking

Tracked server-side via `ForumPostRead { playerId, postId, lastSeenCommentCount }`.

- `isUnread = (commentCount > lastSeenCommentCount) || no read record exists`
- When a user opens a post → client calls `POST /forum/posts/:id/read` → server upserts `lastSeenCommentCount = post.commentCount`
- When a new comment is added → `commentCount` increments → all other users' read records become stale → their `isUnread` becomes `true`

---

## 5. Data Model (Prisma)

```prisma
enum ForumCategory {
  NEWS
  HELP
  GENERAL
  CITIES
  PURCHASES
}

model ForumPost {
  id           String          @id @default(uuid())
  playerId     String
  playerName   String
  playerLevel  Int
  category     ForumCategory
  title        String          @db.VarChar(200)
  body         String          @db.VarChar(5000)
  isPinned     Boolean         @default(false)
  isClosed     Boolean         @default(false)
  commentCount Int             @default(0)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  deletedAt    DateTime?
  player       Player          @relation(fields: [playerId], references: [id], onDelete: Cascade)
  comments     ForumComment[]
  reads        ForumPostRead[]

  @@index([category, isPinned, createdAt])
  @@index([deletedAt])
}

model ForumComment {
  id          String    @id @default(uuid())
  postId      String
  playerId    String
  playerName  String
  playerLevel Int
  body        String    @db.VarChar(1000)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?
  post        ForumPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  player      Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([postId, createdAt])
}

model ForumPostRead {
  playerId             String
  postId               String
  lastSeenCommentCount Int       @default(0)
  post                 ForumPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  player               Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, postId])
}
```

**Design notes:**
- `commentCount` is denormalized — incremented/decremented in the same transaction as comment create/delete. Avoids `COUNT(*)` on every post-list query.
- `playerName` / `playerLevel` are denormalized at post/comment creation time — they do not change if the player renames.
- Soft delete (`deletedAt`) for both posts and comments, consistent with `ChatMessage`.

---

## 6. Backend API (NestJS — `ForumModule`)

Module structure: `forum.controller.ts`, `forum.service.ts`, `forum.module.ts` — mirrors `ChatModule`.

### Endpoints

```
# Unread counts (home screen)
GET    /forum/unread                         (JwtAuthGuard)
# → { "NEWS": 0, "HELP": 3, "GENERAL": 1, "CITIES": 0, "PURCHASES": 2 }
# One query: LEFT JOIN ForumPostRead, GROUP BY category
# Called on forum-screen focus to populate category badge counts

# Posts
GET    /forum/posts?category=NEWS&page=1&limit=20
POST   /forum/posts                          (JwtAuthGuard)
GET    /forum/posts/:id
PATCH  /forum/posts/:id                      (JwtAuthGuard — author or admin)
DELETE /forum/posts/:id                      (JwtAuthGuard — author or admin)
PATCH  /forum/posts/:id/pin                  (JwtAuthGuard + AdminGuard)
PATCH  /forum/posts/:id/close                (JwtAuthGuard + AdminGuard)
POST   /forum/posts/:id/read                 (JwtAuthGuard)

# Comments
GET    /forum/posts/:id/comments?page=1&limit=50
POST   /forum/posts/:id/comments             (JwtAuthGuard, rejected if isClosed)
PATCH  /forum/comments/:id                   (JwtAuthGuard — author or admin)
DELETE /forum/comments/:id                   (JwtAuthGuard — author or admin)
```

### GET /forum/posts response shape

```json
{
  "posts": [
    {
      "id": "uuid",
      "category": "NEWS",
      "title": "Оновлення 2.0",
      "body": "...",
      "playerId": "uuid",
      "playerName": "Admin",
      "playerLevel": 50,
      "isPinned": true,
      "isClosed": false,
      "commentCount": 12,
      "isUnread": true,
      "createdAt": "2026-07-24T10:00:00Z",
      "updatedAt": "2026-07-24T15:30:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "hasMore": true
}
```

`isUnread` is computed server-side via LEFT JOIN on `ForumPostRead` for the requesting player.

### Sorting

```sql
ORDER BY isPinned DESC, createdAt DESC
```

Pinned posts always appear first within a category.

### Validation rules

| Rule | Value |
|------|-------|
| Title length | 1–200 chars |
| Post body length | 1–5000 chars |
| Comment body length | 1–1000 chars |
| POST to NEWS category | `isAdmin` required — 403 otherwise |
| Comment on closed post | 403 Forbidden |
| Post cooldown | 60 seconds between posts |
| Comment cooldown | 10 seconds between comments |
| Page size (posts) | 20 |
| Page size (comments) | 50 |

---

## 7. Frontend

### Navigation (expo-router)

```
app/forum-screen.tsx        ← replace "Coming soon" — category list home
app/forum-category.tsx      ← post list for one category (param: category)
app/forum-post.tsx          ← post detail + comments (param: postId)
```

### Zustand Store (`src/stores/forumStore.ts`)

**State shape:**

```ts
interface ForumState {
  posts: ForumPost[];
  postsPage: number;
  postsHasMore: boolean;
  postsLoading: boolean;

  activePost: ForumPost | null;
  comments: ForumComment[];
  commentsPage: number;
  commentsHasMore: boolean;
  commentsLoading: boolean;

  isSending: boolean;
  error: string | null;
}
```

**Actions:**

```ts
fetchPosts(category: ForumCategory, reset?: boolean): Promise<void>
loadMorePosts(category: ForumCategory): Promise<void>
createPost(category, title, body): Promise<void>
updatePost(id, title, body): Promise<void>
deletePost(id): Promise<void>
pinPost(id, isPinned): Promise<void>       // admin only
closePost(id, isClosed): Promise<void>     // admin only

fetchPost(id): Promise<void>
markRead(postId, commentCount): Promise<void>

fetchComments(postId, reset?: boolean): Promise<void>
loadMoreComments(postId): Promise<void>
createComment(postId, body): Promise<void>
updateComment(id, body): Promise<void>
deleteComment(id): Promise<void>
```

No polling — data is loaded on screen focus and refreshed via pull-to-refresh.

### Screens

**`forum-screen.tsx` — Forum Home**
- 5 category cards, each with `folderwithdocs.png`
- Card shows: category name + unread badge count (if > 0)
- On focus → calls `GET /forum/unread` to populate badge counts
- Tap → navigate to `forum-category` with `category` param

**`forum-category.tsx` — Post List**
- Header: category name + "New post" button (visible if auth AND (category ≠ NEWS OR isAdmin))
- FlatList of `ForumPostRow` items
- Pull-to-refresh → `fetchPosts(category, reset: true)`
- "Load more" button at bottom if `postsHasMore`
- On focus → `fetchPosts(category, reset: true)`

**`forum-post.tsx` — Post Detail**
- Header: post title + Edit / Delete buttons (author or admin)
- Post body (top, inside ScrollView)
- Divider
- FlatList of `ForumComment` items, paginated (load more)
- If `isClosed` → "Топік закрито" banner instead of input
- If auth + !isClosed → comment input bar (style mirrors chat input)
- On mount → `fetchPost(id)` + `markRead(id, commentCount)` + `fetchComments(id, reset: true)`

### Components

| File | Responsibility |
|------|----------------|
| `src/components/ForumCategoryCard.tsx` | Category card on home screen |
| `src/components/ForumPostRow.tsx` | Single row in post list: icon, title, meta |
| `src/components/ForumComment.tsx` | Single comment (mirrors `ChatMessage.tsx`) |

### Icon selection logic (ForumPostRow)

```ts
function getPostIcon(post: ForumPost) {
  if (post.isClosed) return require('assets/img/forum/closed.png');
  if (post.isPinned) return require('assets/img/forum/pinned.png');
  if (post.isUnread) return require('assets/img/forum/new.png');
  if (!post.isUnread) return require('assets/img/forum/viewed.png');
  return require('assets/img/forum/document.png');
}
```

Title font: `Fredoka_700Bold` for pinned, `Fredoka_600SemiBold` for all others.

---

## 8. Out of Scope (this iteration)

- Likes / upvotes on posts or comments
- Nested replies (comments are flat)
- Real-time push for new posts/comments (WebSocket / SSE)
- Guest read access (forum requires auth)
- Auto-expiry of posts
- Search across posts
