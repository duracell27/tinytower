# Global Chat — Design Spec

**Date:** 2026-07-21  
**Status:** Approved

## Summary

Add a global real-time-like chat tab to TinyTower. All authenticated players share one chat room. Messages live for 24 hours. Polling every 5 seconds keeps the feed fresh. Admins can delete any message.

---

## Scope

- New `Chat` tab in BottomNav (5th item, route `/chat`)
- New `chatStore.ts` (Zustand) — isolated from `gameStore`
- New `ChatModule` on the NestJS backend
- Polling-based delivery (no WebSocket)
- 300-character message limit; 3-second cooldown per player (server-enforced)
- Admin delete; guest read-only

---

## Architecture

### Frontend

| File | Purpose |
|------|---------|
| `src/stores/chatStore.ts` | Zustand store — messages, polling, send, delete |
| `src/app/chat.tsx` | Chat screen — FlatList + input bar |
| `src/components/ChatMessage.tsx` | Single message row (avatar, name, body, time, admin delete btn) |
| `src/components/BottomNav.tsx` | Add 5th Chat tab with bubble icon |

### Backend

| Layer | Detail |
|-------|--------|
| Module | `ChatModule` (`chat.module.ts`) |
| Controller | `ChatController` (`chat.controller.ts`) |
| Service | `ChatService` (`chat.service.ts`) |
| Entity | `ChatMessage` (`chat-message.entity.ts`) |
| Cleanup | `@Cron` job every 15 min — hard-delete rows older than 24 h |

---

## Data Model

### `chat_messages` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `player_id` | uuid FK → players | |
| `player_name` | varchar(50) | denormalized for display speed |
| `body` | varchar(300) | |
| `created_at` | timestamptz | indexed for TTL queries |
| `deleted_at` | timestamptz | nullable — soft delete by admin |

### `ChatMessage` TypeScript type (shared contract)

```ts
interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  body: string;
  createdAt: string; // ISO 8601
}
```

---

## API Contract

### `GET /chat/messages`
- Auth: none required (guests can fetch)
- Returns: last 100 active messages ordered by `created_at ASC`
- Response: `{ messages: ChatMessage[] }`

### `POST /chat/messages`
- Auth: JWT required (guests blocked)
- Body: `{ body: string }` — max 300 chars
- Server checks cooldown: rejects with 429 if player posted within last 3 seconds
- Response: `{ message: ChatMessage }`

### `DELETE /chat/messages/:id`
- Auth: JWT required + `isAdmin` claim
- Soft-deletes the row (`deleted_at = now()`)
- Response: `204 No Content`

---

## `chatStore` Interface

```ts
interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;   // true only on first fetch
  isSending: boolean;
  error: string | null;
}

interface ChatActions {
  fetchMessages: () => Promise<void>;
  sendMessage: (body: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}
```

Polling: `setInterval(fetchMessages, 5000)` — started via `useFocusEffect` on the Chat screen, stopped on blur/unmount.

---

## UI Details

**Chat screen (`/chat`):**
- `FlatList` with `inverted={true}` — newest messages at the bottom
- Own messages aligned right (bubble style); others aligned left
- Each row: avatar initial circle, player name, body text, relative time (e.g. "2хв")
- Admin sees 🗑 button on every message that is not their own
- Character counter `0/300` in input; send button disabled when empty or `isSending`

**Guest state:**
- Feed visible (read-only)
- Input area replaced by banner: "Увійдіть, щоб писати в чат" with a login button

**BottomNav:**
- 5th item: bubble/speech icon, label from `tabs.json` key `labels.chat`
- Active state follows same green highlight pattern as existing tabs

---

## Admin Role

- Backend: `isAdmin` boolean column on `players` table (or JWT claim `role: 'admin'`)
- Frontend: `authStore.player.isAdmin` — if `true`, render delete button on `ChatMessage` rows
- Delete is immediate (no confirmation dialog) — soft delete on server, message removed from local `messages` array optimistically

---

## Error Handling

| Scenario | Behavior |
|----------|---------|
| `fetchMessages` network error | Silent — keep showing last known messages, polling continues |
| `sendMessage` failure | Toast "Не вдалося надіслати", input not cleared |
| `sendMessage` 429 cooldown | Toast "Зачекайте перед наступним повідомленням" |
| `sendMessage` 400 (> 300 chars) | Blocked by UI counter before request; 400 shows generic error toast |
| `deleteMessage` failure | Toast "Не вдалося видалити", message stays in list |

---

## Testing

- **`chatStore` unit tests** — mock `api`; assert `fetchMessages` populates `messages`; assert `sendMessage` sets `isSending` correctly; assert `deleteMessage` removes message from array optimistically
- **Cooldown test** — second `POST` within 3 s returns 429
- **Character limit test** — body > 300 chars → 400 from server
- **Admin gate test** — `DELETE` without `isAdmin` claim → 403

---

## Out of Scope (MVP)

- WebSocket / real-time push
- Message reactions or replies
- Direct / private messages
- Push notifications for new chat messages
- Full moderation dashboard
- Message search
