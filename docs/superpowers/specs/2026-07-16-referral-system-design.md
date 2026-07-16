# Referral System — Design Spec

**Date:** 2026-07-16  
**Status:** Approved

---

## Goals

- Attract new players (friend invites)
- Re-engage inactive players (share links externally)
- Monetization: passive gem bonus from referred players' purchases

---

## Reward Structure

| Trigger | Amount | Delivery |
|---|---|---|
| Referred player registers | 5 💎 | Claim modal — gems credited on tap |
| Referred player reaches level 30 | 50 💎 | Claim modal — gems credited on tap |
| Referred player makes a gem purchase | +10% of purchase amount 💎 | Auto-credited by server; info modal shown |

Reward amounts (5 / 50 gems) are placeholder values — adjust before launch.

No cap on number of referrals. The 10% purchase bonus is permanent.

---

## Data Model

### Server: `Referral` entity

```
Referral {
  id           UUID
  referrerId   → Player (who invited)
  referredId   → Player (who was invited)
  referredName string  (snapshot at registration time)
  createdAt    Date

  milestones {
    registered: { claimedAt: Date | null }
    level30:    { reachedAt: Date | null, claimedAt: Date | null }
  }

  gemBonusEarned  number  (cumulative 10% from all purchases, credited automatically)
}
```

---

## Sharing Mechanism

Two paths for entering a referral code:

1. **Deep link** — `tinytower://ref?code=AB12CD`  
   Opened before registration: code is parsed by `expo-linking` on app launch and stored in MMKV (`referral.pendingCode`). Auto-applied at registration.

2. **Manual entry** — optional text field on the registration screen labeled "Реферальний код (необов'язково)". Pre-filled if a pending deep-link code exists.

Referral code format: 6 uppercase alphanumeric characters (e.g. `AB12CD`), generated server-side at player registration.

---

## API

### Registration
```
POST /auth/register
Body: { email, password, playerName, referralCode?: string }
```
If `referralCode` is valid, server creates a `Referral` record and immediately fires the `registered` milestone reward as a pending claim for the referrer.

### Referral profile data
```
GET /player/referral
Response: {
  code: string,
  referrals: [
    {
      id: string,
      referredName: string,
      referredLevel: number,
      milestones: {
        registered: { claimedAt: string | null },
        level30:    { reachedAt: string | null, claimedAt: string | null }
      },
      gemBonusEarned: number
    }
  ]
}
```

### Claim milestone reward
```
POST /referrals/claim
Body: { referralId: string, milestone: "registered" | "level30" }
Response: { gems: number }
```
Server validates that milestone is reached and not yet claimed, then credits gems to referrer's balance.

---

## Sync Integration

The `POST /sync` response is extended with two fields:

```json
"pendingReferralClaims": [
  {
    "id": "referral-uuid",
    "referredName": "Vasyl",
    "milestone": "registered" | "level30",
    "gems": 5
  }
],
"referralPurchaseBonuses": [
  {
    "referredName": "Vasyl",
    "bonus": 10,
    "purchaseAmount": 100
  }
]
```

`gameStore` reads these after each sync and appends them to a `pendingReferralNotifications` queue. Modals are shown one at a time, in order.

**Purchase bonus acknowledgment:** `referralPurchaseBonuses` entries are delivered once — server marks them as "synced" when they appear in the sync response (not when the client dismisses the modal). This means if the app crashes before the modal is shown, the bonus is still credited but the info modal is lost — acceptable tradeoff.

**Batching:** if multiple `referralPurchaseBonuses` arrive in one sync (e.g. user was offline), they are merged into a single info modal: "Vasyl та ще 2 гравці поповнили баланс. Ти отримав +{total} 💎 бонус."

---

## Modal Flows

### Claim modal (registered / level30)
Triggered by `pendingReferralClaims` entries.

```
┌─────────────────────────────────────┐
│         🎉 Реферальна нагорода!     │
│                                     │
│   👤 {name} зареєструвався          │   ← "досяг 30 рівня" for level30
│      за твоїм посиланням            │
│                                     │
│           + {gems} 💎               │
│                                     │
│       [ Отримати {gems} 💎 ]        │
└─────────────────────────────────────┘
```

Tapping "Отримати" calls `POST /referrals/claim`. On success, gems are added to local balance via `executeCommand({ type: 'add_referral_gems', gems })`. Modal closes and next queued notification is shown. On network failure, button shows error state and remains tappable — modal does not close.

### Info modal (purchase bonus)
Triggered by `referralPurchaseBonuses` entries. Gems are already on balance (credited by server during purchase processing).

```
┌─────────────────────────────────────┐
│         💎 Бонус від реферала!      │
│                                     │
│   {name} поповнив баланс            │
│   на {purchaseAmount} 💎            │
│   Ти отримав +{bonus} 💎 бонус      │
│                                     │
│           [ Чудово! ]               │
└─────────────────────────────────────┘
```

Tapping "Чудово!" dismisses the modal; no server call needed.

---

## Referral Screen (Profile Tab)

A new "Реферали" entry in the player profile. Loads data from `GET /player/referral`.

```
┌─────────────────────────────────────┐
│  Реферали                           │
├─────────────────────────────────────┤
│  Твій код:  [ AB12CD ]  📋 Копіювати│
│  [ 🔗 Поділитися посиланням ]       │
├─────────────────────────────────────┤
│  Запрошені гравці                   │
│                                     │
│  👤 Vasyl                           │
│     ✅ Реєстрація  +5 💎  Отримано  │
│     ✅ Рівень 30   +50💎  Отримано  │
│     💰 Бонус з покупок: +23 💎      │
│                                     │
│  👤 Olha                            │
│     ✅ Реєстрація  +5 💎  Отримано  │
│     ⏳ Рівень 30   (зараз 14 рівень)│
│     💰 Бонус з покупок: +0 💎       │
└─────────────────────────────────────┘
```

Share button uses React Native `Share.share()` with a text containing the deep link URL.

---

## Registration Screen Changes

- Add optional field: "Реферальний код (необов'язково)"
- On app launch, `expo-linking` checks for incoming deep link. If `ref` param is present, value is stored to MMKV key `referral.pendingCode`
- Registration screen reads `referral.pendingCode` on mount and pre-fills the field
- After successful registration, `referral.pendingCode` is cleared from MMKV

---

## Server-side Milestone Detection

- **Level 30:** server detects when XP sync crosses the level 30 threshold and sets `milestones.level30.reachedAt`. The pending claim appears in the next sync response for the referrer.
- **Gem purchases:** when the purchase endpoint processes a gem top-up, server finds all referrers of the buyer, calculates 10% of purchased amount, credits gems immediately, and appends to `referralPurchaseBonuses` for the referrer's next sync.

---

## New Command Type

```
add_referral_gems: { gems: number }
```

Used to apply claimed referral rewards to local game state via the existing `executeCommand` pattern. Server validates the claim before the client calls this command.

---

## Out of Scope

- Referral analytics dashboard (admin)
- Fraud detection / abuse prevention (deferred)
- Push notifications for referral events (modals on next session open are sufficient)
- Multi-level referrals
