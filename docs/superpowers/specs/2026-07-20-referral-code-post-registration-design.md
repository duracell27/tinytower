# Referral Code Entry — Post-Registration

**Date:** 2026-07-20  
**Status:** Approved

## Summary

Move referral code entry from the registration form to the Referrals screen. After creating an account, a player can open the Referrals section and enter a referral code there. Deep links that carry a code pre-fill the field automatically.

## Data Flow

**Before:**
`Deep link → MMKV pendingCode → pre-fill in registration form → POST /auth/register { referralCode } → referral record`

**After:**
`Deep link → MMKV pendingCode → persists → ReferralScreen reads pendingCode → pre-fills input → POST /referrals/apply-code { code } → referral record`

## Rules

- A player can apply at most one referral code (enforced server-side by unique `referredId` on the referral table).
- A player cannot apply their own code.
- No time limit after registration — code can be entered at any time.
- If a player followed a deep link before registering, `pendingCode` is kept in MMKV after registration and auto-fills the input on the Referrals screen. It is cleared only after a successful apply.

## Server Changes

### `GET /player/referral` — add `hasUsedCode`
`ReferralService.getPlayerReferral()` checks whether a `referral` record exists with `referredId = playerId` and returns `hasUsedCode: boolean` in the response.

### New endpoint: `POST /referrals/apply-code`
- JWT-protected, body: `{ code: string }`
- New method `ReferralService.applyReferralCode(playerId, code)`:
  1. Find referrer by code → 400 if code does not exist
  2. `referrer.id !== playerId` → 400 if player tries to use their own code
  3. No existing `referral { referredId: playerId }` → 400 if code already used
  4. Create `referral` record (same shape as the current `auth.service.ts:39-50` block)
  5. Return `{ ok: true }`

### `auth.service.ts` — remove referral logic from registration
- Delete the `if (dto.referralCode)` block (lines 39–50).
- Remove `referralCode` field from `register.dto.ts`.

## Client Changes

### `LoginScreen.tsx`
- Remove `referralCode` state (line 58).
- Remove `useEffect` that reads `pendingCode` from MMKV (lines 62–67).
- Remove the referral code `TextInput` field (lines 203–214).
- Remove `referralCode` from the `register()` call (line 98).

### `authStore.ts`
- Remove `referralCode` parameter from `register()` signature and request body.
- Remove `getStorage().remove('referral.pendingCode')` (line 86) — the code must persist past registration so the Referrals screen can use it.

### `referralStore.ts`
- Add `hasUsedCode: boolean | null` to state (`null` = not yet loaded).
- `fetchReferral()` stores the new field from the API response.
- New action `applyReferralCode(code: string)`:
  - POST `/referrals/apply-code`
  - On success: set `hasUsedCode = true`, clear `referral.pendingCode` from MMKV.
  - On error: surface error message to UI.

### `ReferralScreen.tsx` — new "Enter a referral code" section
Shown only when `hasUsedCode === false`. Placed above the "Your code" card.

Contents:
- Label: «У вас є реферальний код?»
- `TextInput` (6 chars, uppercase, autoCapitalize="characters") — on mount reads `referral.pendingCode` from MMKV and pre-fills if present.
- «Застосувати» button → calls `applyReferralCode()`.
- Inline error display (bad code, already used, own code).
- On success the section disappears (driven by `hasUsedCode` becoming `true`).

## Out of Scope

- Reward for the referred player (only the referrer earns rewards — unchanged).
- Time-window restriction on code entry (can be added later as a single server-side condition).
