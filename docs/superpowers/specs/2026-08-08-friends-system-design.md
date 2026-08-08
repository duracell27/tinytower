# Friends System — Design Spec
Date: 2026-08-08

## Overview

A social friends system: players can send friend requests to each other, accept or reject them, and maintain a friends list. No gameplay bonuses in this iteration — purely a social contacts list.

## Data Model

One new Prisma model and one enum added to `server/prisma/schema.prisma`.

```prisma
enum FriendRequestStatus {
  PENDING
  ACCEPTED
  REJECTED
}

model FriendRequest {
  id        String              @id @default(uuid())
  fromId    String
  toId      String
  status    FriendRequestStatus @default(PENDING)
  createdAt DateTime            @default(now())
  updatedAt DateTime            @updatedAt
  from      Player              @relation("SentRequests", fields: [fromId], references: [id], onDelete: Cascade)
  to        Player              @relation("ReceivedRequests", fields: [toId], references: [id], onDelete: Cascade)

  @@unique([fromId, toId])
  @@index([toId, status])
  @@index([fromId, status])
}
```

`Player` model gets two new relations:
```prisma
sentRequests     FriendRequest[] @relation("SentRequests")
receivedRequests FriendRequest[] @relation("ReceivedRequests")
```

**Friendship = ACCEPTED FriendRequest.** To check "are we friends?": find a record where `(fromId=me AND toId=other) OR (fromId=other AND toId=me)` with `status=ACCEPTED`. Removing a friend = deleting that record.

---

## Server API

New NestJS module at `server/src/friends/` following the same structure as `forum/` and `chat/`.

Files:
- `friends.module.ts`
- `friends.controller.ts`
- `friends.service.ts`

All endpoints require JWT auth (`JwtAuthGuard`).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/friends/request/:toId` | Send a friend request to player `toId` |
| DELETE | `/friends/request/:requestId` | Cancel own pending outgoing request |
| POST | `/friends/request/:requestId/accept` | Accept an incoming pending request |
| POST | `/friends/request/:requestId/reject` | Reject an incoming pending request |
| DELETE | `/friends/:requestId` | Remove a friend (deletes the ACCEPTED record by requestId) |
| GET | `/friends` | List current player's friends |
| GET | `/friends/requests/incoming` | List incoming PENDING requests |
| GET | `/friends/status/:playerId` | Get relationship status with a specific player |

### Response shapes

**GET /friends**
```typescript
FriendEntry[] where FriendEntry = {
  requestId: string
  playerId: string
  playerName: string
  playerLevel: number
  city: string | null
  lastSeenAt: string
}
```

**GET /friends/requests/incoming**
```typescript
IncomingRequest[] where IncomingRequest = {
  requestId: string
  fromId: string
  playerName: string
  playerLevel: number
  city: string | null
  createdAt: string
}
```

**GET /friends/status/:playerId**
```typescript
{
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends'
  requestId?: string   // present for all statuses except 'none'
}
```

### Business rules
- Cannot send a request to yourself → 400
- Cannot send if a request already exists in any direction (even REJECTED) → 400 with `already_exists`; for REJECTED, the existing record is reused and reset to PENDING
- Only the sender can cancel (`fromId = me`)
- Only the recipient can accept/reject (`toId = me`)
- Only participants can remove a friendship

---

## Client

### API service additions (`src/services/api.ts`)

New methods on the `api` object:
```typescript
getFriendStatus(playerId: string): Promise<FriendStatusResponse>
getFriends(): Promise<FriendEntry[]>
getIncomingRequests(): Promise<IncomingRequest[]>
sendFriendRequest(toId: string): Promise<{ requestId: string }>
cancelFriendRequest(requestId: string): Promise<void>
acceptFriendRequest(requestId: string): Promise<void>
rejectFriendRequest(requestId: string): Promise<void>
removeFriend(requestId: string): Promise<void>
```

### Store (`src/stores/friendStore.ts`)

Zustand store following `chatStore` pattern:

```typescript
interface FriendStore {
  statusCache: Record<string, FriendStatusResponse>  // keyed by playerId
  friends: FriendEntry[]
  incomingRequests: IncomingRequest[]

  pendingCount: number  // kept in sync with incomingRequests.length; updated together with incomingRequests

  // actions
  fetchStatus(playerId: string): Promise<void>
  fetchFriends(): Promise<void>
  fetchIncoming(): Promise<void>
  sendRequest(toId: string): Promise<void>
  cancelRequest(requestId: string, toId: string): Promise<void>
  acceptRequest(requestId: string, fromId: string): Promise<void>
  rejectRequest(requestId: string, fromId: string): Promise<void>
  removeFriend(requestId: string, friendId: string): Promise<void>
}
```

After each mutating action the store optimistically updates `statusCache` and re-fetches affected lists. `pendingCount` is always set alongside `incomingRequests` (same `set()` call).

---

## UI

### 1. `profile.tsx` — "My Friends" button

- `useFocusEffect` calls `fetchIncoming()` when the Profile tab gains focus (same pattern as `myProfile` fetch).
- The existing placeholder button gets:
  - `onPress={() => router.push('/my-friends')}`
  - Badge pill on the right showing `pendingCount` when > 0 (red circle with white number, same style as notification badges elsewhere)

### 2. `app/user-profile/[id].tsx` — Friend action area

On mount, calls `fetchStatus(id)`. Replaces the static "Add Friend" `Pressable` with a `FriendActionRow` component that renders based on `statusCache[id]`:

| Status | Renders |
|--------|---------|
| loading | ActivityIndicator |
| `none` | Single "Add Friend" button (full width) |
| `pending_sent` | "Request Sent" label (left) + small "Cancel" button (right) |
| `pending_received` | "Accept" green button + "Reject" red button (equal width) |
| `friends` | "Remove Friend" button (danger style, full width) |

### 3. `app/my-friends.tsx` — New screen

Tab bar with two tabs:
- **"Friends"** — always visible
- **"Requests (N)"** — only rendered when `pendingCount > 0`; N = pendingCount

**Friends tab:**
Row per friend: avatar (getUserIcon) + name + level + online dot (green if lastSeenAt < 5min) + chevron right. Tap → `router.push('/user-profile/' + playerId)`. Empty state: "No friends yet" illustration text.

**Requests tab:**
Row per request: avatar + name + level + "Accept" (green) + "Reject" (ghost/outlined) buttons. Accept optimistically moves the request into the friends list. Empty state disappears when count hits 0 (tab hides itself).

Screen navigation: back arrow (or close button bottom-center matching user-profile style).

---

## Error handling

- All API errors show a brief toast / alert consistent with existing patterns (no new global error infra needed).
- Optimistic updates revert on failure.

---

## Out of scope

- Real-time push notifications for friend requests
- Gameplay bonuses from friendships
- Friends-only leaderboard tab
- Blocking users
