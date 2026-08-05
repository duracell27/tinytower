# Referral Code Post-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move referral code entry from the registration form to the Referrals screen, with a new server endpoint and a new UI input section.

**Architecture:** Remove `referralCode` from the `POST /auth/register` flow entirely. Add `POST /referrals/apply-code` (JWT-protected) that creates the referral record. The `GET /player/referral` response gains `hasUsedCode: boolean` so the client knows whether to show the entry UI.

**Tech Stack:** NestJS + Prisma (server), React Native + Zustand + MMKV (client), Jest (tests).

## Global Constraints

- Server tests run from `server/` directory: `npx jest --no-coverage`
- No time limit on applying a code — any authenticated player who hasn't used one may apply
- `referral.pendingCode` MMKV key persists through registration; cleared only after successful apply
- All new UI strings in Ukrainian (matching existing pattern in codebase)
- Referral code is always 6 uppercase alphanumeric characters (`/^[A-Z0-9]{6}$/`)

---

### Task 1: Remove referral code from registration (server)

**Files:**
- Modify: `server/src/auth/dto/register.dto.ts`
- Modify: `server/src/auth/auth.service.ts:39-50`
- Verify: `server/src/auth/__tests__/auth.service.spec.ts` (no changes needed — existing tests already omit `referralCode`)

**Interfaces:**
- Produces: `RegisterDto` without `referralCode`; `AuthService.register()` no longer accepts or uses it

- [ ] **Step 1: Update `register.dto.ts` — remove `referralCode` field**

Replace the entire file with:

```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  playerName: z.string().min(1).max(30),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

- [ ] **Step 2: Update `auth.service.ts` — delete the referral block from `register()`**

Delete lines 39–50 (the `if (dto.referralCode) { ... }` block). The `register()` method should look like:

```typescript
async register(dto: RegisterDto) {
  const email = dto.email.toLowerCase().trim();
  const existing = await this.playerService.findByEmail(email);
  if (existing) throw new ConflictException('Email already registered');

  const passwordHash = await bcrypt.hash(dto.password, 10);
  const player = await this.playerService.createWithInitialState(
    email, passwordHash, dto.playerName,
  );

  const tokens = await this.generateTokens(player.id, player.email);
  return {
    ...tokens,
    player: { id: player.id, email: player.email, playerName: player.playerName },
  };
}
```

- [ ] **Step 3: Run existing auth service tests to confirm they still pass**

```bash
cd server && npx jest --testPathPattern=auth.service.spec --no-coverage
```

Expected: all tests pass (the register tests already call without `referralCode`).

- [ ] **Step 4: Commit**

```bash
git add server/src/auth/dto/register.dto.ts server/src/auth/auth.service.ts
git commit -m "feat: remove referral code from registration flow"
```

---

### Task 2: Add `hasUsedCode` to `GET /player/referral` and new `applyReferralCode` (server)

**Files:**
- Modify: `server/src/referral/referral.service.ts`
- Modify: `server/src/referral/referral.controller.ts`
- Modify: `server/src/referral/__tests__/referral.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` — `prisma.referral.findUnique({ where: { referredId } })`, `prisma.referral.create()`
- Produces:
  - `ReferralService.getPlayerReferral(playerId)` → adds `hasUsedCode: boolean` to return value
  - `ReferralService.applyReferralCode(playerId: string, code: string)` → `Promise<{ ok: true }>`
  - `POST /referrals/apply-code` endpoint

- [ ] **Step 1: Write failing tests for `hasUsedCode` in `getPlayerReferral` and for `applyReferralCode`**

Add the following `describe` blocks at the end of `server/src/referral/__tests__/referral.service.spec.ts`, and update `beforeEach` to add `referral.findUnique` and `referral.create` to the prisma mock:

```typescript
// In beforeEach, update the prisma mock to add findUnique and create on referral:
prisma = {
  player: { findUnique: jest.fn(), update: jest.fn() },
  referral: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
};
```

Then add these describe blocks:

```typescript
describe('getPlayerReferral hasUsedCode', () => {
  it('returns hasUsedCode: true when referral with referredId exists', async () => {
    prisma.player.findUnique.mockResolvedValue({ referralCode: 'ABC123' });
    prisma.referral.findUnique.mockResolvedValue({ id: 'some-ref' });
    prisma.referral.findMany.mockResolvedValue([]);

    const result = await service.getPlayerReferral(PLAYER_ID);

    expect(result.hasUsedCode).toBe(true);
  });

  it('returns hasUsedCode: false when no referral with referredId', async () => {
    prisma.player.findUnique.mockResolvedValue({ referralCode: 'ABC123' });
    prisma.referral.findUnique.mockResolvedValue(null);
    prisma.referral.findMany.mockResolvedValue([]);

    const result = await service.getPlayerReferral(PLAYER_ID);

    expect(result.hasUsedCode).toBe(false);
  });
});

describe('applyReferralCode', () => {
  const REFERRER_ID = 'referrer-uuid';
  const CODE = 'ABC123';

  it('creates a referral record and returns { ok: true }', async () => {
    prisma.player.findUnique
      .mockResolvedValueOnce({ id: REFERRER_ID }) // referrer by code
      .mockResolvedValueOnce({ playerName: 'TestPlayer' }); // current player
    prisma.referral.findUnique.mockResolvedValue(null);

    const result = await service.applyReferralCode(PLAYER_ID, CODE);

    expect(result).toEqual({ ok: true });
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: {
        referrerId: REFERRER_ID,
        referredId: PLAYER_ID,
        referredName: 'TestPlayer',
      },
    });
  });

  it('throws BadRequestException if code does not exist', async () => {
    prisma.player.findUnique.mockResolvedValue(null);

    await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if player uses their own code', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: PLAYER_ID });

    await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException if referral code already used', async () => {
    prisma.player.findUnique.mockResolvedValue({ id: REFERRER_ID });
    prisma.referral.findUnique.mockResolvedValue(makeReferral());

    await expect(service.applyReferralCode(PLAYER_ID, CODE)).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd server && npx jest --testPathPattern=referral.service.spec --no-coverage
```

Expected: `hasUsedCode` tests and `applyReferralCode` tests fail.

- [ ] **Step 3: Update `getPlayerReferral` in `referral.service.ts` to return `hasUsedCode`**

Add a `prisma.referral.findUnique` call alongside `findMany`, and include `hasUsedCode` in the return:

```typescript
async getPlayerReferral(playerId: string) {
  const player = await this.prisma.player.findUnique({
    where: { id: playerId },
    select: { referralCode: true },
  });
  if (!player) throw new NotFoundException('Player not found');

  let referralCode = player.referralCode;
  if (!referralCode) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generateReferralCode();
      const existing = await this.prisma.player.findUnique({ where: { referralCode: candidate } });
      if (!existing) { referralCode = candidate; break; }
    }
    if (referralCode) {
      await this.prisma.player.update({
        where: { id: playerId },
        data: { referralCode },
      });
    }
  }

  const [referrals, usedReferral] = await Promise.all([
    this.prisma.referral.findMany({
      where: { referrerId: playerId },
      include: { referred: { select: { playerLevel: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    this.prisma.referral.findUnique({ where: { referredId: playerId } }),
  ]);

  return {
    code: referralCode ?? null,
    hasUsedCode: usedReferral !== null,
    referrals: referrals.map((r) => ({
      id: r.id,
      referredName: r.referredName,
      referredLevel: r.referred.playerLevel,
      milestones: {
        registered: { claimedAt: r.registeredClaimedAt?.toISOString() ?? null },
        level10: {
          reachedAt: r.level10ReachedAt?.toISOString() ?? null,
          claimedAt: r.level10ClaimedAt?.toISOString() ?? null,
        },
        level30: {
          reachedAt: r.level30ReachedAt?.toISOString() ?? null,
          claimedAt: r.level30ClaimedAt?.toISOString() ?? null,
        },
      },
      gemBonusEarned: r.gemBonusEarned,
    })),
  };
}
```

- [ ] **Step 4: Add `applyReferralCode` method to `referral.service.ts`**

Add after `claimMilestone`:

```typescript
async applyReferralCode(playerId: string, code: string) {
  const referrer = await this.prisma.player.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });
  if (!referrer) throw new BadRequestException('Invalid referral code');
  if (referrer.id === playerId) throw new BadRequestException('Cannot use your own referral code');

  const existing = await this.prisma.referral.findUnique({ where: { referredId: playerId } });
  if (existing) throw new BadRequestException('Referral code already used');

  const player = await this.prisma.player.findUnique({
    where: { id: playerId },
    select: { playerName: true },
  });
  if (!player) throw new NotFoundException('Player not found');

  await this.prisma.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: playerId,
      referredName: player.playerName,
    },
  });

  return { ok: true as const };
}
```

- [ ] **Step 5: Add `POST /referrals/apply-code` to `referral.controller.ts`**

Add the schema and route handler. The full updated controller:

```typescript
import {
  Controller, Get, Post, Body, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferralService } from './referral.service';

const ClaimSchema = z.object({
  referralId: z.string().uuid(),
  milestone: z.enum(['registered', 'level10', 'level30']),
});

const ApplyCodeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{6}$/),
});

@Controller()
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Get('player/referral')
  @UseGuards(JwtAuthGuard)
  async getPlayerReferral(@Req() req: { user: { playerId: string } }) {
    return this.referralService.getPlayerReferral(req.user.playerId);
  }

  @Post('referrals/claim')
  @UseGuards(JwtAuthGuard)
  async claimMilestone(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ) {
    const result = ClaimSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.referralService.claimMilestone(
      req.user.playerId,
      result.data.referralId,
      result.data.milestone,
    );
  }

  @Post('referrals/apply-code')
  @UseGuards(JwtAuthGuard)
  async applyReferralCode(
    @Req() req: { user: { playerId: string } },
    @Body() body: unknown,
  ) {
    const result = ApplyCodeSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.issues);
    return this.referralService.applyReferralCode(req.user.playerId, result.data.code);
  }
}
```

- [ ] **Step 6: Run all referral service tests to confirm they pass**

```bash
cd server && npx jest --testPathPattern=referral.service.spec --no-coverage
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/referral/referral.service.ts \
        server/src/referral/referral.controller.ts \
        server/src/referral/__tests__/referral.service.spec.ts
git commit -m "feat: add applyReferralCode endpoint, hasUsedCode to referral profile"
```

---

### Task 3: Clean up registration on the client (authStore + LoginScreen)

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/screens/LoginScreen.tsx`

**Interfaces:**
- Produces: `useAuthStore.register(email, password, playerName)` — no `referralCode` param
- `referral.pendingCode` in MMKV is NOT cleared on registration (removed from authStore)

- [ ] **Step 1: Update `authStore.ts` — remove `referralCode` from `register()`**

Remove the `referralCode` parameter and the `...(referralCode ? { referralCode } : {})` spread from the request body. Also remove `getStorage().remove('referral.pendingCode')` (line 86). The updated `register` action:

```typescript
register: async (email, password, playerName) => {
  set({ isLoading: true });
  try {
    const data = await api.post<{
      accessToken: string;
      refreshToken: string;
      player: PlayerInfo;
    }>('/auth/register', { email, password, playerName });

    api.setTokens(data.accessToken, data.refreshToken);
    getStorage().set('player', JSON.stringify(data.player));
    saveLastPlayer(data.player);
    set({ player: data.player, lastPlayer: data.player, isAuthenticated: true, isLoading: false });
    setupUserPersistence(data.player.id);
  } catch (e) {
    set({ isLoading: false });
    throw e;
  }
},
```

Also update the `AuthActions` interface — change the `register` signature:

```typescript
interface AuthActions {
  register: (email: string, password: string, playerName: string) => Promise<void>;
  // ... rest unchanged
}
```

- [ ] **Step 2: Update `LoginScreen.tsx` — remove referral code field**

Remove:
- `const [referralCode, setReferralCode] = React.useState('');` (line 58)
- The entire `useEffect` that reads `pendingCode` (lines 62–67)
- The `<View style={styles.fieldGroup}>` block containing the referral code `TextInput` (lines 203–214)
- `referralCode.trim() || undefined` from the `register()` call (line 98)

The updated register call (inside `handleSubmit`):

```typescript
await useAuthStore.getState().register(
  email.trim(),
  password,
  playerName.trim(),
);
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `referralCode`.

- [ ] **Step 4: Commit**

```bash
git add src/stores/authStore.ts src/screens/LoginScreen.tsx
git commit -m "feat: remove referral code field from registration form"
```

---

### Task 4: Extend `referralStore` with `hasUsedCode` and `applyReferralCode`

**Files:**
- Modify: `src/stores/referralStore.ts`

**Interfaces:**
- Consumes: `api.post('/referrals/apply-code', { code })` → `{ ok: true }`
- Consumes: `api.get('/player/referral')` response now includes `hasUsedCode: boolean`
- Produces:
  - `useReferralStore` state: `hasUsedCode: boolean | null`, `isApplying: boolean`
  - `useReferralStore.applyReferralCode(code: string): Promise<void>`

- [ ] **Step 1: Rewrite `referralStore.ts`**

```typescript
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { api } from '../services/api';

const authStorage = createMMKV({ id: 'auth' });

export interface ReferralEntry {
  id: string;
  referredName: string;
  referredLevel: number;
  milestones: {
    registered: { claimedAt: string | null };
    level10: { reachedAt: string | null; claimedAt: string | null };
    level30: { reachedAt: string | null; claimedAt: string | null };
  };
  gemBonusEarned: number;
}

interface ReferralProfileResponse {
  code: string;
  referrals: ReferralEntry[];
  hasUsedCode: boolean;
}

interface ReferralState {
  code: string | null;
  referrals: ReferralEntry[];
  hasUsedCode: boolean | null;
  isLoading: boolean;
  isApplying: boolean;
  fetchReferral: () => Promise<void>;
  applyReferralCode: (code: string) => Promise<void>;
}

export const useReferralStore = create<ReferralState>((set) => ({
  code: null,
  referrals: [],
  hasUsedCode: null,
  isLoading: false,
  isApplying: false,

  fetchReferral: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<ReferralProfileResponse>('/player/referral');
      set({ code: data.code, referrals: data.referrals, hasUsedCode: data.hasUsedCode });
    } finally {
      set({ isLoading: false });
    }
  },

  applyReferralCode: async (code) => {
    set({ isApplying: true });
    try {
      await api.post('/referrals/apply-code', { code });
      authStorage.remove('referral.pendingCode');
      set({ hasUsedCode: true, isApplying: false });
    } catch (e) {
      set({ isApplying: false });
      throw e;
    }
  },
}));
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/stores/referralStore.ts
git commit -m "feat: add hasUsedCode and applyReferralCode to referralStore"
```

---

### Task 5: Add referral code input section to `ReferralScreen`

**Files:**
- Modify: `src/screens/ReferralScreen.tsx`

**Interfaces:**
- Consumes: `useReferralStore` — `hasUsedCode`, `isApplying`, `applyReferralCode`
- Consumes: `authStorage.getString('referral.pendingCode')` to pre-fill the input on mount

- [ ] **Step 1: Add imports to `ReferralScreen.tsx`**

Add `ActivityIndicator`, `TextInput` to the react-native import list, and add a new import:

```typescript
import { createMMKV } from 'react-native-mmkv';
```

Full updated import block:

```typescript
import React, { useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, ScrollView,
  Share, ActivityIndicator, TextInput, ImageBackground,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import { useReferralStore, type ReferralEntry } from '../stores/referralStore';
import { getUserIcon } from '../utils/userIcon';
```

- [ ] **Step 2: Update the `ReferralScreen` component body**

Replace the existing `export default function ReferralScreen()` with:

```typescript
export default function ReferralScreen() {
  const { code, referrals, isLoading, hasUsedCode, isApplying, fetchReferral, applyReferralCode } = useReferralStore();
  const [copied, setCopied] = React.useState(false);
  const [inputCode, setInputCode] = React.useState('');
  const [applyError, setApplyError] = React.useState('');

  useEffect(() => {
    fetchReferral();
    const authStorage = createMMKV({ id: 'auth' });
    const pending = authStorage.getString('referral.pendingCode');
    if (pending) setInputCode(pending);
  }, []);

  const shareLink = code ? `${DEEP_LINK_BASE}${code}` : '';

  const handleCopy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!shareLink) return;
    Share.share({
      message: `Play TinyTower with me! My referral code: ${code}\n${shareLink}`,
    });
  };

  const handleApplyCode = async () => {
    setApplyError('');
    try {
      await applyReferralCode(inputCode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Невірний код або вже використаний';
      setApplyError(msg);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/welcome-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3FA535" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Referrals</Text>

          {hasUsedCode === false && (
            <View style={styles.applyCard}>
              <Text style={styles.applyLabel}>У вас є реферальний код?</Text>
              <View style={styles.applyRow}>
                <TextInput
                  style={styles.applyInput}
                  value={inputCode}
                  onChangeText={(t) => { setInputCode(t.toUpperCase()); setApplyError(''); }}
                  autoCapitalize="characters"
                  maxLength={6}
                  placeholder="XXXXXX"
                  placeholderTextColor="#B7B3A2"
                  editable={!isApplying}
                />
                <Pressable
                  onPress={handleApplyCode}
                  style={({ pressed }) => [
                    styles.applyBtn,
                    (isApplying || inputCode.length < 6) && styles.applyBtnDisabled,
                    pressed && { opacity: 0.75 },
                  ]}
                  disabled={isApplying || inputCode.length < 6}
                >
                  {isApplying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.applyBtnText}>Застосувати</Text>
                  )}
                </Pressable>
              </View>
              {applyError ? <Text style={styles.applyError}>{applyError}</Text> : null}
            </View>
          )}

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your code</Text>
            <View style={styles.codeRow}>
              <Text style={styles.codeText}>{code ?? '------'}</Text>
              <Pressable onPress={handleCopy} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.copyBtnText}>{copied ? 'Copied!' : 'Copy'}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleShare} style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.shareBtnText}>Share link</Text>
            </Pressable>
          </View>

          {referrals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No invited players yet.{'\n'}Share your link!</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Invited players</Text>
              {referrals.map((entry) => (
                <ReferralCard key={entry.id} entry={entry} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.back()}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
      >
        <Text style={styles.closeBtnText}>✕</Text>
      </Pressable>
    </ImageBackground>
  );
}
```

- [ ] **Step 3: Add new styles to `StyleSheet.create()`**

Add after `emptyText`:

```typescript
  applyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 10,
    shadowColor: 'rgba(60,80,45,1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  applyLabel: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 13,
    color: '#5A6650',
  },
  applyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  applyInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E4E1D3',
    backgroundColor: '#FBFAF5',
    paddingHorizontal: 14,
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 20,
    color: '#1A3D6B',
    letterSpacing: 3,
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#3FA535',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  applyBtnDisabled: {
    opacity: 0.45,
  },
  applyBtnText: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 15,
    color: '#fff',
  },
  applyError: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 12,
    color: '#C62828',
  },
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd /Users/Apple/IT/tinytower && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/ReferralScreen.tsx
git commit -m "feat: add referral code input section to ReferralScreen"
```
