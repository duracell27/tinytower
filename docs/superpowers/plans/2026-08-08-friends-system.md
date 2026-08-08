# Friends System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a friends system — send/cancel/accept/reject friend requests and view a friends list.

**Architecture:** REST API in a new NestJS `FriendsModule`; single `FriendRequest` Prisma model (status `PENDING` → `ACCEPTED` = friends); Zustand `useFriendStore` on the client with optimistic updates; badge refreshed `useFocusEffect` on the Profile tab.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Zustand, Expo Router (React Native), TypeScript, Jest (server tests), Zod (validation in controller).

## Global Constraints

- All server endpoints require `JwtAuthGuard` — no public routes.
- Follow `forum/` module structure exactly: `module.ts`, `service.ts`, `controller.ts`, tests in `__tests__/`.
- Client store follows `chatStore.ts` pattern: `create<State & Actions>()`, silent catch on reads, throw on writes.
- No new navigation libraries — use `router.push` / `router.back()` from `expo-router`.
- `api` object in `src/services/api.ts` grows named methods; never call `request()` directly from stores.
- Prisma enum values are SCREAMING_SNAKE_CASE (`PENDING`, `ACCEPTED`, `REJECTED`).
- Run `npx prisma generate` after every schema change before writing service code.

---

### Task 1: Prisma Schema — FriendRequest model

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `FriendRequest` Prisma model with fields `id`, `fromId`, `toId`, `status`, `createdAt`, `updatedAt`; enum `FriendRequestStatus`; two relations on `Player`.

- [ ] **Step 1: Add enum and model to schema.prisma**

Open `server/prisma/schema.prisma`. Add the enum **before** the `Player` model, and the model **after** `ForumPostRead`. Also add two relation fields to the `Player` model.

Add after `model ForumPostRead { ... }`:

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

Add inside the `Player` model (after the last existing relation line, before the closing `}`):

```prisma
  sentRequests     FriendRequest[] @relation("SentRequests")
  receivedRequests FriendRequest[] @relation("ReceivedRequests")
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/Apple/IT/tinytower/server
npx prisma migrate dev --name add_friend_request
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client".

- [ ] **Step 4: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(db): add FriendRequest model and FriendRequestStatus enum"
```

---

### Task 2: FriendsService with tests

**Files:**
- Create: `server/src/friends/__tests__/friends.service.spec.ts`
- Create: `server/src/friends/friends.service.ts`

**Interfaces:**
- Consumes: `PrismaService` (injected), `FriendRequestStatus` enum from `@prisma/client`
- Produces:
  - `FriendsService.getStatus(myId, otherId): Promise<FriendStatusDto>`
  - `FriendsService.sendRequest(fromId, toId): Promise<{ requestId: string }>`
  - `FriendsService.cancelRequest(requestId, myId): Promise<void>`
  - `FriendsService.acceptRequest(requestId, myId): Promise<void>`
  - `FriendsService.rejectRequest(requestId, myId): Promise<void>`
  - `FriendsService.removeFriend(requestId, myId): Promise<void>`
  - `FriendsService.getFriends(myId): Promise<FriendEntryDto[]>`
  - `FriendsService.getIncomingRequests(myId): Promise<IncomingRequestDto[]>`

- [ ] **Step 1: Write the failing tests**

Create `server/src/friends/__tests__/friends.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendsService } from '../friends.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: Record<string, any>;

  const baseRequest = {
    id: 'req-1', fromId: 'p1', toId: 'p2',
    status: 'PENDING', createdAt: new Date(), updatedAt: new Date(),
  };
  const player1 = { id: 'p1', playerName: 'Alice', playerLevel: 5, city: null, lastSeenAt: new Date() };
  const player2 = { id: 'p2', playerName: 'Bob', playerLevel: 7, city: 'Kyiv', lastSeenAt: new Date() };

  beforeEach(async () => {
    prisma = {
      friendRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(baseRequest),
        update: jest.fn().mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' }),
        delete: jest.fn().mockResolvedValue(baseRequest),
      },
      player: {
        findMany: jest.fn().mockResolvedValue([player1, player2]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FriendsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<FriendsService>(FriendsService);
  });

  describe('getStatus', () => {
    it('returns none when no request exists', async () => {
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('none');
      expect(result.requestId).toBeUndefined();
    });

    it('returns none when same player', async () => {
      const result = await service.getStatus('p1', 'p1');
      expect(result.status).toBe('none');
    });

    it('returns pending_sent when I sent the request', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'PENDING' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('pending_sent');
      expect(result.requestId).toBe('req-1');
    });

    it('returns pending_received when other player sent the request to me', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p2', toId: 'p1', status: 'PENDING' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('pending_received');
      expect(result.requestId).toBe('req-1');
    });

    it('returns friends when request is ACCEPTED', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('friends');
      expect(result.requestId).toBe('req-1');
    });

    it('returns none when request is REJECTED', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'REJECTED' });
      const result = await service.getStatus('p1', 'p2');
      expect(result.status).toBe('none');
    });
  });

  describe('sendRequest', () => {
    it('creates a new pending request', async () => {
      const result = await service.sendRequest('p1', 'p2');
      expect(prisma.friendRequest.create).toHaveBeenCalledWith({
        data: { fromId: 'p1', toId: 'p2', status: 'PENDING' },
      });
      expect(result.requestId).toBe('req-1');
    });

    it('throws when sending to yourself', async () => {
      await expect(service.sendRequest('p1', 'p1')).rejects.toThrow(BadRequestException);
    });

    it('throws when already friends', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'ACCEPTED' });
      await expect(service.sendRequest('p1', 'p2')).rejects.toThrow(BadRequestException);
    });

    it('throws when pending request already exists', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, status: 'PENDING' });
      await expect(service.sendRequest('p1', 'p2')).rejects.toThrow(BadRequestException);
    });

    it('resets REJECTED request to PENDING for same direction', async () => {
      prisma.friendRequest.findFirst.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'REJECTED' });
      prisma.friendRequest.update.mockResolvedValue({ ...baseRequest, status: 'PENDING' });
      const result = await service.sendRequest('p1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'PENDING' },
      });
      expect(result.requestId).toBe('req-1');
    });
  });

  describe('cancelRequest', () => {
    it('deletes a pending request owned by caller', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', status: 'PENDING' });
      await service.cancelRequest('req-1', 'p1');
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });

    it('throws NotFoundException when request not found', async () => {
      await expect(service.cancelRequest('bad-id', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the sender', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p2', status: 'PENDING' });
      await expect(service.cancelRequest('req-1', 'p1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('acceptRequest', () => {
    it('sets status to ACCEPTED when caller is recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await service.acceptRequest('req-1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'ACCEPTED' },
      });
    });

    it('throws ForbiddenException when caller is not the recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await expect(service.acceptRequest('req-1', 'p1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectRequest', () => {
    it('sets status to REJECTED when caller is recipient', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, toId: 'p2', status: 'PENDING' });
      await service.rejectRequest('req-1', 'p2');
      expect(prisma.friendRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REJECTED' },
      });
    });
  });

  describe('removeFriend', () => {
    it('deletes an ACCEPTED request when caller is a participant', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'ACCEPTED' });
      await service.removeFriend('req-1', 'p1');
      expect(prisma.friendRequest.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });

    it('throws ForbiddenException when caller is not a participant', async () => {
      prisma.friendRequest.findUnique.mockResolvedValue({ ...baseRequest, fromId: 'p1', toId: 'p2', status: 'ACCEPTED' });
      await expect(service.removeFriend('req-1', 'p3')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFriends', () => {
    it('returns friends with requestId and player data', async () => {
      prisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-1', fromId: 'p1', toId: 'p2', status: 'ACCEPTED' },
      ]);
      prisma.player.findMany.mockResolvedValue([player2]);
      const result = await service.getFriends('p1');
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].playerId).toBe('p2');
      expect(result[0].playerName).toBe('Bob');
    });
  });

  describe('getIncomingRequests', () => {
    it('returns incoming pending requests with sender details', async () => {
      prisma.friendRequest.findMany.mockResolvedValue([
        { id: 'req-1', fromId: 'p1', toId: 'p2', status: 'PENDING', createdAt: new Date(),
          from: { id: 'p1', playerName: 'Alice', playerLevel: 5, city: null } },
      ]);
      const result = await service.getIncomingRequests('p2');
      expect(result).toHaveLength(1);
      expect(result[0].requestId).toBe('req-1');
      expect(result[0].fromId).toBe('p1');
      expect(result[0].playerName).toBe('Alice');
    });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest friends.service.spec --no-coverage
```

Expected: FAIL — `Cannot find module '../friends.service'`

- [ ] **Step 3: Create friends.service.ts**

Create `server/src/friends/friends.service.ts`:

```typescript
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FriendRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface FriendStatusDto {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  requestId?: string;
}

export interface FriendEntryDto {
  requestId: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  lastSeenAt: string;
}

export interface IncomingRequestDto {
  requestId: string;
  fromId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  createdAt: string;
}

@Injectable()
export class FriendsService {
  constructor(private prisma: PrismaService) {}

  private async findAnyRequest(playerAId: string, playerBId: string) {
    return this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromId: playerAId, toId: playerBId },
          { fromId: playerBId, toId: playerAId },
        ],
      },
    });
  }

  async getStatus(myId: string, otherId: string): Promise<FriendStatusDto> {
    if (myId === otherId) return { status: 'none' };
    const req = await this.findAnyRequest(myId, otherId);
    if (!req) return { status: 'none' };
    if (req.status === FriendRequestStatus.ACCEPTED) return { status: 'friends', requestId: req.id };
    if (req.status === FriendRequestStatus.PENDING) {
      return req.fromId === myId
        ? { status: 'pending_sent', requestId: req.id }
        : { status: 'pending_received', requestId: req.id };
    }
    return { status: 'none' };
  }

  async sendRequest(fromId: string, toId: string): Promise<{ requestId: string }> {
    if (fromId === toId) throw new BadRequestException('Cannot send request to yourself');
    const existing = await this.findAnyRequest(fromId, toId);
    if (existing) {
      if (existing.status === FriendRequestStatus.ACCEPTED) throw new BadRequestException('Already friends');
      if (existing.status === FriendRequestStatus.PENDING) throw new BadRequestException('Request already pending');
      if (existing.fromId === fromId && existing.status === FriendRequestStatus.REJECTED) {
        const updated = await this.prisma.friendRequest.update({
          where: { id: existing.id },
          data: { status: FriendRequestStatus.PENDING },
        });
        return { requestId: updated.id };
      }
      throw new BadRequestException('already_exists');
    }
    const req = await this.prisma.friendRequest.create({
      data: { fromId, toId, status: FriendRequestStatus.PENDING },
    });
    return { requestId: req.id };
  }

  async cancelRequest(requestId: string, myId: string): Promise<void> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.fromId !== myId) throw new ForbiddenException('Not your request');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
  }

  async acceptRequest(requestId: string, myId: string): Promise<void> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.toId !== myId) throw new ForbiddenException('Not your request to accept');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.update({ where: { id: requestId }, data: { status: FriendRequestStatus.ACCEPTED } });
  }

  async rejectRequest(requestId: string, myId: string): Promise<void> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.toId !== myId) throw new ForbiddenException('Not your request to reject');
    if (req.status !== FriendRequestStatus.PENDING) throw new BadRequestException('Request is not pending');
    await this.prisma.friendRequest.update({ where: { id: requestId }, data: { status: FriendRequestStatus.REJECTED } });
  }

  async removeFriend(requestId: string, myId: string): Promise<void> {
    const req = await this.prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Friendship not found');
    if (req.fromId !== myId && req.toId !== myId) throw new ForbiddenException('Not your friendship');
    if (req.status !== FriendRequestStatus.ACCEPTED) throw new BadRequestException('Not friends');
    await this.prisma.friendRequest.delete({ where: { id: requestId } });
  }

  async getFriends(myId: string): Promise<FriendEntryDto[]> {
    const requests = await this.prisma.friendRequest.findMany({
      where: { status: FriendRequestStatus.ACCEPTED, OR: [{ fromId: myId }, { toId: myId }] },
    });
    const friendIds = requests.map(r => (r.fromId === myId ? r.toId : r.fromId));
    const requestIdMap = new Map(requests.map(r => [r.fromId === myId ? r.toId : r.fromId, r.id]));
    const players = await this.prisma.player.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, playerName: true, playerLevel: true, city: true, lastSeenAt: true },
    });
    return players.map(p => ({
      requestId: requestIdMap.get(p.id)!,
      playerId: p.id,
      playerName: p.playerName,
      playerLevel: p.playerLevel,
      city: p.city,
      lastSeenAt: p.lastSeenAt.toISOString(),
    }));
  }

  async getIncomingRequests(myId: string): Promise<IncomingRequestDto[]> {
    const requests = await this.prisma.friendRequest.findMany({
      where: { toId: myId, status: FriendRequestStatus.PENDING },
      include: {
        from: { select: { id: true, playerName: true, playerLevel: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map(r => ({
      requestId: r.id,
      fromId: r.fromId,
      playerName: r.from.playerName,
      playerLevel: r.from.playerLevel,
      city: r.from.city,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd /Users/Apple/IT/tinytower/server
npx jest friends.service.spec --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/src/friends/
git commit -m "feat(friends): add FriendsService with full test coverage"
```

---

### Task 3: FriendsController + Module + AppModule registration

**Files:**
- Create: `server/src/friends/friends.controller.ts`
- Create: `server/src/friends/friends.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `FriendsService` (all 8 methods from Task 2)
- Produces: HTTP routes at `/friends/*`

- [ ] **Step 1: Create friends.controller.ts**

```typescript
import { Controller, Get, Post, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';

type AuthReq = { user: { playerId: string } };

@Controller('friends')
export class FriendsController {
  constructor(private friendsService: FriendsService) {}

  @Get('status/:playerId')
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: AuthReq, @Param('playerId') playerId: string) {
    return this.friendsService.getStatus(req.user.playerId, playerId);
  }

  @Get('requests/incoming')
  @UseGuards(JwtAuthGuard)
  getIncoming(@Req() req: AuthReq) {
    return this.friendsService.getIncomingRequests(req.user.playerId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  getFriends(@Req() req: AuthReq) {
    return this.friendsService.getFriends(req.user.playerId);
  }

  @Post('request/:toId')
  @UseGuards(JwtAuthGuard)
  sendRequest(@Req() req: AuthReq, @Param('toId') toId: string) {
    return this.friendsService.sendRequest(req.user.playerId, toId);
  }

  @Delete('request/:requestId')
  @UseGuards(JwtAuthGuard)
  cancelRequest(@Req() req: AuthReq, @Param('requestId') requestId: string) {
    return this.friendsService.cancelRequest(requestId, req.user.playerId);
  }

  @Post('request/:requestId/accept')
  @UseGuards(JwtAuthGuard)
  acceptRequest(@Req() req: AuthReq, @Param('requestId') requestId: string) {
    return this.friendsService.acceptRequest(requestId, req.user.playerId);
  }

  @Post('request/:requestId/reject')
  @UseGuards(JwtAuthGuard)
  rejectRequest(@Req() req: AuthReq, @Param('requestId') requestId: string) {
    return this.friendsService.rejectRequest(requestId, req.user.playerId);
  }

  @Delete(':requestId')
  @UseGuards(JwtAuthGuard)
  removeFriend(@Req() req: AuthReq, @Param('requestId') requestId: string) {
    return this.friendsService.removeFriend(requestId, req.user.playerId);
  }
}
```

- [ ] **Step 2: Create friends.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
```

- [ ] **Step 3: Register in app.module.ts**

In `server/src/app.module.ts`, add the import and add it to the `imports` array:

```typescript
import { FriendsModule } from './friends/friends.module';
// ... existing imports

@Module({
  imports: [
    // ... existing modules
    FriendsModule,   // add this line
  ],
})
export class AppModule {}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/Apple/IT/tinytower/server
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/Apple/IT/tinytower
git add server/src/friends/friends.controller.ts server/src/friends/friends.module.ts server/src/app.module.ts
git commit -m "feat(friends): add FriendsController and register FriendsModule"
```

---

### Task 4: API client — types and methods

**Files:**
- Modify: `src/services/api.ts`

**Interfaces:**
- Produces (types exported from `api.ts`):
  - `FriendEntry`: `{ requestId, playerId, playerName, playerLevel, city, lastSeenAt }`
  - `IncomingRequest`: `{ requestId, fromId, playerName, playerLevel, city, createdAt }`
  - `FriendStatusResponse`: `{ status: 'none'|'pending_sent'|'pending_received'|'friends'; requestId?: string }`
- Produces (methods on `api` object):
  - `api.getFriendStatus(playerId)`
  - `api.getFriends()`
  - `api.getIncomingFriendRequests()`
  - `api.sendFriendRequest(toId)`
  - `api.cancelFriendRequest(requestId)`
  - `api.acceptFriendRequest(requestId)`
  - `api.rejectFriendRequest(requestId)`
  - `api.removeFriend(requestId)`

- [ ] **Step 1: Add types after the `PlayerProfile` interface**

In `src/services/api.ts`, after the closing `}` of the `PlayerProfile` interface (line ~49), add:

```typescript
export interface FriendEntry {
  requestId: string;
  playerId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  lastSeenAt: string;
}

export interface IncomingRequest {
  requestId: string;
  fromId: string;
  playerName: string;
  playerLevel: number;
  city: string | null;
  createdAt: string;
}

export interface FriendStatusResponse {
  status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  requestId?: string;
}
```

- [ ] **Step 2: Add methods to the `api` object**

In `src/services/api.ts`, inside the `export const api = { ... }` object, add the following methods after `getPlayerProfile`:

```typescript
  getFriendStatus: (playerId: string) =>
    request<FriendStatusResponse>('GET', `/friends/status/${playerId}`),
  getFriends: () =>
    request<FriendEntry[]>('GET', '/friends'),
  getIncomingFriendRequests: () =>
    request<IncomingRequest[]>('GET', '/friends/requests/incoming'),
  sendFriendRequest: (toId: string) =>
    request<{ requestId: string }>('POST', `/friends/request/${toId}`),
  cancelFriendRequest: (requestId: string) =>
    request<void>('DELETE', `/friends/request/${requestId}`),
  acceptFriendRequest: (requestId: string) =>
    request<void>('POST', `/friends/request/${requestId}/accept`),
  rejectFriendRequest: (requestId: string) =>
    request<void>('POST', `/friends/request/${requestId}/reject`),
  removeFriend: (requestId: string) =>
    request<void>('DELETE', `/friends/${requestId}`),
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(friends): add client API types and methods"
```

---

### Task 5: friendStore — Zustand store

**Files:**
- Create: `src/stores/friendStore.ts`

**Interfaces:**
- Consumes: `api.getFriendStatus`, `api.getFriends`, `api.getIncomingFriendRequests`, `api.sendFriendRequest`, `api.cancelFriendRequest`, `api.acceptFriendRequest`, `api.rejectFriendRequest`, `api.removeFriend`; types `FriendEntry`, `IncomingRequest`, `FriendStatusResponse` from `../services/api`
- Produces: `useFriendStore` Zustand hook with state `{ statusCache, friends, incomingRequests, pendingCount }` and actions as below

- [ ] **Step 1: Create src/stores/friendStore.ts**

```typescript
import { create } from 'zustand';
import { api, type FriendEntry, type IncomingRequest, type FriendStatusResponse } from '../services/api';

interface FriendState {
  statusCache: Record<string, FriendStatusResponse>;
  friends: FriendEntry[];
  incomingRequests: IncomingRequest[];
  pendingCount: number;
}

interface FriendActions {
  fetchStatus: (playerId: string) => Promise<void>;
  fetchFriends: () => Promise<void>;
  fetchIncoming: () => Promise<void>;
  sendRequest: (toId: string) => Promise<void>;
  cancelRequest: (requestId: string, toId: string) => Promise<void>;
  acceptRequest: (requestId: string, fromId: string) => Promise<void>;
  rejectRequest: (requestId: string, fromId: string) => Promise<void>;
  removeFriend: (requestId: string, friendId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState & FriendActions>((set, get) => ({
  statusCache: {},
  friends: [],
  incomingRequests: [],
  pendingCount: 0,

  fetchStatus: async (playerId: string) => {
    try {
      const status = await api.getFriendStatus(playerId);
      set(s => ({ statusCache: { ...s.statusCache, [playerId]: status } }));
    } catch {
      // silent — keep last known state
    }
  },

  fetchFriends: async () => {
    try {
      const friends = await api.getFriends();
      set({ friends });
    } catch {
      // silent
    }
  },

  fetchIncoming: async () => {
    try {
      const incomingRequests = await api.getIncomingFriendRequests();
      set({ incomingRequests, pendingCount: incomingRequests.length });
    } catch {
      // silent
    }
  },

  sendRequest: async (toId: string) => {
    set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'pending_sent' } } }));
    try {
      const { requestId } = await api.sendFriendRequest(toId);
      set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'pending_sent', requestId } } }));
    } catch (e) {
      set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'none' } } }));
      throw e;
    }
  },

  cancelRequest: async (requestId: string, toId: string) => {
    const prev = get().statusCache[toId];
    set(s => ({ statusCache: { ...s.statusCache, [toId]: { status: 'none' } } }));
    try {
      await api.cancelFriendRequest(requestId);
    } catch (e) {
      if (prev) set(s => ({ statusCache: { ...s.statusCache, [toId]: prev } }));
      throw e;
    }
  },

  acceptRequest: async (requestId: string, fromId: string) => {
    set(s => ({
      incomingRequests: s.incomingRequests.filter(r => r.requestId !== requestId),
      pendingCount: Math.max(0, s.pendingCount - 1),
      statusCache: { ...s.statusCache, [fromId]: { status: 'friends', requestId } },
    }));
    try {
      await api.acceptFriendRequest(requestId);
      await get().fetchFriends();
    } catch (e) {
      await get().fetchIncoming();
      throw e;
    }
  },

  rejectRequest: async (requestId: string, fromId: string) => {
    set(s => ({
      incomingRequests: s.incomingRequests.filter(r => r.requestId !== requestId),
      pendingCount: Math.max(0, s.pendingCount - 1),
      statusCache: { ...s.statusCache, [fromId]: { status: 'none' } },
    }));
    try {
      await api.rejectFriendRequest(requestId);
    } catch (e) {
      await get().fetchIncoming();
      throw e;
    }
  },

  removeFriend: async (requestId: string, friendId: string) => {
    const prev = get().statusCache[friendId];
    set(s => ({
      friends: s.friends.filter(f => f.requestId !== requestId),
      statusCache: { ...s.statusCache, [friendId]: { status: 'none' } },
    }));
    try {
      await api.removeFriend(requestId);
    } catch (e) {
      if (prev) set(s => ({ statusCache: { ...s.statusCache, [friendId]: prev } }));
      await get().fetchFriends();
      throw e;
    }
  },
}));
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/friendStore.ts
git commit -m "feat(friends): add useFriendStore Zustand store"
```

---

### Task 6: profile.tsx — My Friends button with badge

**Files:**
- Modify: `app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useFriendStore` (`pendingCount`, `fetchIncoming`); `router.push('/my-friends')`
- Produces: "My Friends" button navigates to `/my-friends`; badge shows `pendingCount` when > 0

- [ ] **Step 1: Add friendStore import**

In `app/(tabs)/profile.tsx`, add this import after the existing `import { api, type PlayerProfile }` line:

```typescript
import { useFriendStore } from '../../src/stores/friendStore';
```

- [ ] **Step 2: Add store selectors inside ProfileScreen component**

Inside the `ProfileScreen` function body, after the existing `const now = useGameClock(10_000);` line, add:

```typescript
  const pendingCount = useFriendStore(s => s.pendingCount);
  const fetchIncoming = useFriendStore(s => s.fetchIncoming);
```

- [ ] **Step 3: Add useFocusEffect for fetchIncoming**

In `app/(tabs)/profile.tsx`, inside the component, after the existing `useFocusEffect` block that fetches `myProfile`, add a new `useFocusEffect`:

```typescript
  useFocusEffect(useCallback(() => {
    fetchIncoming();
  }, [fetchIncoming]));
```

- [ ] **Step 4: Replace the static "My Friends" Pressable**

Find the existing "My Friends" button (around line 546–551):

```tsx
        <Pressable
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/users.png')} style={styles.achievementsIcon} />
          <Text style={[styles.achievementsButtonText, { color: theme.text }]}>My Friends</Text>
        </Pressable>
```

Replace it with:

```tsx
        <Pressable
          onPress={() => router.push('/my-friends')}
          style={({ pressed }) => [styles.achievementsButton, { backgroundColor: theme.surface }, pressed && styles.achievementsButtonPressed]}
        >
          <Image source={require('../../assets/img/users.png')} style={styles.achievementsIcon} />
          <Text style={[styles.achievementsButtonText, { flex: 1, color: theme.text }]}>My Friends</Text>
          {pendingCount > 0 && (
            <View style={styles.friendsBadge}>
              <Text style={styles.friendsBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </Pressable>
```

- [ ] **Step 5: Add badge styles**

In `app/(tabs)/profile.tsx`, inside the `StyleSheet.create({})` block, add:

```typescript
  friendsBadge: {
    backgroundColor: '#E05A4A',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  friendsBadgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 12,
    color: '#fff',
  },
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat(friends): add friends badge and navigation to profile tab"
```

---

### Task 7: user-profile/[id].tsx — FriendActionRow

**Files:**
- Modify: `app/user-profile/[id].tsx`

**Interfaces:**
- Consumes: `useFriendStore` (`statusCache`, `fetchStatus`, `sendRequest`, `cancelRequest`, `acceptRequest`, `rejectRequest`); player `id` from route params; `useAuthStore` for current player id
- Produces: Friend action row that renders 4 states based on `statusCache[id].status`

- [ ] **Step 1: Add imports**

In `app/user-profile/[id].tsx`, add after the existing imports:

```typescript
import { useAuthStore } from '../../src/stores/authStore';
import { useFriendStore } from '../../src/stores/friendStore';
```

- [ ] **Step 2: Add store state inside UserProfileScreen**

Inside `UserProfileScreen`, after `const [achievementsOpen, setAchievementsOpen] = useState(false);`, add:

```typescript
  const currentPlayerId = useAuthStore(s => s.player?.id);
  const statusCache = useFriendStore(s => s.statusCache);
  const fetchStatus = useFriendStore(s => s.fetchStatus);
  const sendRequest = useFriendStore(s => s.sendRequest);
  const cancelRequest = useFriendStore(s => s.cancelRequest);
  const acceptRequest = useFriendStore(s => s.acceptRequest);
  const rejectRequest = useFriendStore(s => s.rejectRequest);
  const removeFriend = useFriendStore(s => s.removeFriend);

  const friendStatus = id ? statusCache[id] : undefined;
  const [friendActionLoading, setFriendActionLoading] = useState(false);
```

- [ ] **Step 3: Fetch friend status on mount**

In `UserProfileScreen`, extend the existing `useEffect` (the one that calls `api.getPlayerProfile`) to also fetch the friend status. Add inside the effect body, after `setLoading(true)`:

```typescript
    if (id && currentPlayerId && id !== currentPlayerId) {
      fetchStatus(id);
    }
```

Full modified `useEffect`:

```typescript
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getPlayerProfile(id)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { if (!cancelled) setError('Failed to load profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    if (id && currentPlayerId && id !== currentPlayerId) {
      fetchStatus(id);
    }
    return () => { cancelled = true; };
  }, [id, currentPlayerId, fetchStatus]);
```

- [ ] **Step 4: Replace static "Add Friend" Pressable with FriendActionRow**

Find in `app/user-profile/[id].tsx` the static "Add Friend" block (around lines 223–226):

```tsx
          <Pressable style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
            <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
            <Text style={[pStyles.actionBtnText, { color: theme.text }]}>Add Friend</Text>
          </Pressable>
```

Replace it entirely with:

```tsx
          {/* Friend action — only shown if viewing someone else's profile */}
          {currentPlayerId && id !== currentPlayerId && (
            <>
              {(!friendStatus || friendStatus.status === 'none') && (
                <Pressable
                  style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}
                  onPress={async () => {
                    setFriendActionLoading(true);
                    try { await sendRequest(id); } catch { /* silent */ }
                    setFriendActionLoading(false);
                  }}
                  disabled={friendActionLoading}
                >
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { color: theme.text }]}>Add Friend</Text>
                </Pressable>
              )}

              {friendStatus?.status === 'pending_sent' && (
                <View style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { flex: 1, color: theme.textMuted }]}>Request Sent</Text>
                  <Pressable
                    style={pStyles.cancelBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await cancelRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              )}

              {friendStatus?.status === 'pending_received' && (
                <View style={[pStyles.actionBtn, { backgroundColor: theme.surface, gap: 8 }]}>
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Pressable
                    style={pStyles.acceptBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await acceptRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.acceptBtnText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={pStyles.rejectBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await rejectRequest(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.rejectBtnText}>Reject</Text>
                  </Pressable>
                </View>
              )}

              {friendStatus?.status === 'friends' && (
                <View style={[pStyles.actionBtn, { backgroundColor: theme.surface }]}>
                  <Image source={FRIEND_ICON} style={pStyles.actionIcon} contentFit="contain" />
                  <Text style={[pStyles.actionBtnText, { flex: 1, color: '#3FA535' }]}>Friends</Text>
                  <Pressable
                    style={pStyles.removeFriendBtn}
                    onPress={async () => {
                      if (!friendStatus.requestId) return;
                      setFriendActionLoading(true);
                      try { await removeFriend(friendStatus.requestId, id); } catch { /* silent */ }
                      setFriendActionLoading(false);
                    }}
                    disabled={friendActionLoading}
                  >
                    <Text style={pStyles.removeFriendBtnText}>Remove</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
```

**Note:** The `removeFriend` case uses `useFriendStore.getState()` to avoid capturing a stale reference — this is idiomatic Zustand for one-off calls inside event handlers. Import `useFriendStore` at the top (already done in Step 1).

- [ ] **Step 5: Add new styles to pStyles**

In `app/user-profile/[id].tsx`, inside the `pStyles` StyleSheet, add:

```typescript
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0EDE5',
  },
  cancelBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#7C8A6E',
  },
  acceptBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#3FA535',
    alignItems: 'center',
  },
  acceptBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },
  rejectBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E05A4A',
    alignItems: 'center',
  },
  rejectBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 14,
    color: '#E05A4A',
  },
  removeFriendBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E05A4A',
  },
  removeFriendBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 13,
    color: '#E05A4A',
  },
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/user-profile/[id].tsx
git commit -m "feat(friends): add FriendActionRow with 4 states to user profile screen"
```

---

### Task 8: app/my-friends.tsx — Friends list screen

**Files:**
- Create: `app/my-friends.tsx`

**Interfaces:**
- Consumes: `useFriendStore` (`friends`, `incomingRequests`, `pendingCount`, `fetchFriends`, `fetchIncoming`, `acceptRequest`, `rejectRequest`, `removeFriend`); `getUserIcon` from `src/utils/userIcon`; `useAppTheme`; `AppBackground`; `router` from `expo-router`

- [ ] **Step 1: Create app/my-friends.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import AppBackground from '../src/components/AppBackground';
import { useAppTheme } from '../src/hooks/useAppTheme';
import { useFriendStore } from '../src/stores/friendStore';
import { getUserIcon } from '../src/utils/userIcon';
import type { FriendEntry, IncomingRequest } from '../src/services/api';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

function OnlineDot({ lastSeenAt }: { lastSeenAt: string }) {
  const isOnline = Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
  return (
    <View style={[dotStyles.dot, { backgroundColor: isOnline ? '#52B847' : '#A6ACB8' }]} />
  );
}

const dotStyles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
});

function FriendRow({ entry, onRemove, theme }: {
  entry: FriendEntry;
  onRemove: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [fStyles.row, { borderBottomColor: theme.divider }, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/user-profile/${entry.playerId}` as any)}
    >
      <Image source={getUserIcon(entry.playerLevel)} style={fStyles.avatar} contentFit="cover" />
      <View style={fStyles.info}>
        <Text style={[fStyles.name, { color: theme.text }]}>{entry.playerName}</Text>
        <View style={fStyles.subRow}>
          <OnlineDot lastSeenAt={entry.lastSeenAt} />
          <Text style={[fStyles.level, { color: theme.textMuted }]}>Lv {entry.playerLevel}</Text>
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [fStyles.removeBtn, pressed && { opacity: 0.7 }]}
        onPress={onRemove}
        hitSlop={8}
      >
        <Text style={fStyles.removeBtnText}>Remove</Text>
      </Pressable>
    </Pressable>
  );
}

const fStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  info: { flex: 1, marginLeft: 12, gap: 3 },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  level: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  removeBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#E05A4A',
  },
  removeBtnText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 12, color: '#E05A4A' },
});

function RequestRow({ entry, onAccept, onReject, theme }: {
  entry: IncomingRequest;
  onAccept: () => void;
  onReject: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[rStyles.row, { borderBottomColor: theme.divider }]}>
      <Pressable
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', flex: 1 }, pressed && { opacity: 0.75 }]}
        onPress={() => router.push(`/user-profile/${entry.fromId}` as any)}
      >
        <Image source={getUserIcon(entry.playerLevel)} style={rStyles.avatar} contentFit="cover" />
        <View style={rStyles.info}>
          <Text style={[rStyles.name, { color: theme.text }]}>{entry.playerName}</Text>
          <Text style={[rStyles.level, { color: theme.textMuted }]}>Lv {entry.playerLevel}</Text>
        </View>
      </Pressable>
      <View style={rStyles.actions}>
        <Pressable
          style={({ pressed }) => [rStyles.acceptBtn, pressed && { opacity: 0.8 }]}
          onPress={onAccept}
        >
          <Text style={rStyles.acceptText}>Accept</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [rStyles.rejectBtn, pressed && { opacity: 0.8 }]}
          onPress={onReject}
        >
          <Text style={rStyles.rejectText}>Reject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  info: { flex: 1, marginLeft: 12, gap: 2 },
  name: { fontFamily: 'Fredoka_600SemiBold', fontSize: 15 },
  level: { fontFamily: 'Fredoka_400Regular', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#3FA535',
  },
  acceptText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#fff' },
  rejectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E05A4A',
  },
  rejectText: { fontFamily: 'Fredoka_600SemiBold', fontSize: 13, color: '#E05A4A' },
});

export default function MyFriendsScreen() {
  const theme = useAppTheme();
  const friends = useFriendStore(s => s.friends);
  const incomingRequests = useFriendStore(s => s.incomingRequests);
  const pendingCount = useFriendStore(s => s.pendingCount);
  const fetchFriends = useFriendStore(s => s.fetchFriends);
  const fetchIncoming = useFriendStore(s => s.fetchIncoming);
  const acceptRequest = useFriendStore(s => s.acceptRequest);
  const rejectRequest = useFriendStore(s => s.rejectRequest);
  const removeFriend = useFriendStore(s => s.removeFriend);

  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchFriends(), fetchIncoming()]).finally(() => setLoading(false));
  }, [fetchFriends, fetchIncoming]);

  // Switch to requests tab automatically if no friends but requests exist
  useEffect(() => {
    if (friends.length === 0 && pendingCount > 0) setActiveTab('requests');
  }, [friends.length, pendingCount]);

  return (
    <AppBackground style={{ flex: 1 }}>

      {/* Tab bar */}
      <View style={[tabStyles.bar, { borderBottomColor: theme.divider }]}>
        <Pressable
          style={[tabStyles.tab, activeTab === 'friends' && tabStyles.tabActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[tabStyles.tabText, { color: activeTab === 'friends' ? '#3FA535' : theme.textMuted }]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>
          {activeTab === 'friends' && <View style={tabStyles.indicator} />}
        </Pressable>

        {pendingCount > 0 && (
          <Pressable
            style={[tabStyles.tab, activeTab === 'requests' && tabStyles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <View style={tabStyles.tabWithBadge}>
              <Text style={[tabStyles.tabText, { color: activeTab === 'requests' ? '#3FA535' : theme.textMuted }]}>
                Requests
              </Text>
              <View style={tabStyles.badge}>
                <Text style={tabStyles.badgeText}>{pendingCount}</Text>
              </View>
            </View>
            {activeTab === 'requests' && <View style={tabStyles.indicator} />}
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>

          {activeTab === 'friends' && (
            <View style={[listStyles.card, { backgroundColor: theme.surface }]}>
              {friends.length === 0 ? (
                <Text style={[listStyles.emptyText, { color: theme.textMuted }]}>No friends yet</Text>
              ) : (
                friends.map((entry, idx) => (
                  <FriendRow
                    key={entry.requestId}
                    entry={entry}
                    theme={theme}
                    onRemove={async () => {
                      await removeFriend(entry.requestId, entry.playerId);
                    }}
                  />
                ))
              )}
            </View>
          )}

          {activeTab === 'requests' && (
            <View style={[listStyles.card, { backgroundColor: theme.surface }]}>
              {incomingRequests.length === 0 ? (
                <Text style={[listStyles.emptyText, { color: theme.textMuted }]}>No pending requests</Text>
              ) : (
                incomingRequests.map((entry) => (
                  <RequestRow
                    key={entry.requestId}
                    entry={entry}
                    theme={theme}
                    onAccept={async () => { await acceptRequest(entry.requestId, entry.fromId); }}
                    onReject={async () => { await rejectRequest(entry.requestId, entry.fromId); }}
                  />
                ))
              )}
            </View>
          )}

        </ScrollView>
      )}

      {/* Close button — same style as user-profile */}
      <View style={closeStyles.wrap} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} style={closeStyles.btn} hitSlop={8}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

    </AppBackground>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 56,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 4,
    position: 'relative',
  },
  tabActive: {},
  tabText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    backgroundColor: '#E05A4A',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 11,
    color: '#fff',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2.5,
    backgroundColor: '#3FA535',
    borderRadius: 2,
  },
});

const listStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyText: {
    fontFamily: 'Fredoka_500Medium',
    fontSize: 15,
    textAlign: 'center',
    padding: 30,
  },
});

const closeStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 36, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  btn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1A2030',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
});
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/Apple/IT/tinytower
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/my-friends.tsx
git commit -m "feat(friends): add MyFriendsScreen with friends list and requests tabs"
```
