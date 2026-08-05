# Two-Stage Daily Tips Reward System

## Overview

Replace the current single-threshold (10 000 coins → 5 gems) daily tips reward with a two-stage system where both the target and reward scale with elevator level. This keeps the challenge meaningful at all elevator levels while giving players a visible mid-point milestone.

## Target Calculation

Stage 1 target scales sub-linearly with elevator level so higher-level players have a slight advantage, but the challenge still grows:

```
stage1Target = round(10 000 × √elevatorLevel)
stage2Target = stage1Target × 2
```

Examples:

| Elevator Level | Stage 1 | Stage 2 |
|---|---|---|
| 1 | 10 000 | 20 000 |
| 2 | 14 142 | 28 284 |
| 5 | 22 361 | 44 721 |
| 10 | 31 623 | 63 246 |

## Rewards

- Stage 1 reached and claimed → +2 gems
- Stage 2 reached and claimed → +3 gems
- Stages are independent: stage 2 can be claimed without claiming stage 1 first
- Both claims reset at daily reset alongside `dailyTips`

## Data Model Changes

### Config (`shared/config/gameConfig.ts`)

Remove:
- `dailyTipsTarget: 10_000`
- `dailyTipsReward: 5`

Add:
- `dailyTipsBaseTarget: 10_000`
- `dailyTipsStage1Reward: 2`
- `dailyTipsStage2Reward: 3`

### State (`shared/types`)

Remove:
- `dailyTipsRewardClaimed: boolean`

Add:
- `dailyTipsStage1Claimed: boolean`
- `dailyTipsStage2Claimed: boolean`

### Command (`shared/types`)

`claim_daily_reward` gains a required field:
- `stage: 1 | 2`

### New Utility (`shared/engine/lobbyUtils.ts`)

```ts
export function getDailyTipsTargets(
  elevatorLevel: number,
  config: GameConfig,
): { stage1: number; stage2: number } {
  const stage1 = Math.round(config.lobbyConfig.dailyTipsBaseTarget * Math.sqrt(elevatorLevel));
  return { stage1, stage2: stage1 * 2 };
}
```

## Engine Changes (`shared/engine/lobbyCommands.ts`)

`handleClaimDailyReward` receives `state.elevatorLevel` and `command.stage`:

- Stage 1: check `dailyTips >= stage1Target && !dailyTipsStage1Claimed`, grant `dailyTipsStage1Reward` gems
- Stage 2: check `dailyTips >= stage2Target && !dailyTipsStage2Claimed`, grant `dailyTipsStage2Reward` gems

## UI Changes (`src/components/LobbyPanel.tsx`)

### Progress Bar

Single continuous bar from 0 to `stage2Target`.

```
[████████░░░░|░░░░░░░░░░░░]
             💎
   20k               40k
   +2💎              +3💎
```

- Mid-point marker (50% of bar width): diamond icon, above = stage1 amount, below = "+2💎"
- End marker (100% of bar width): above = stage2 amount, below = "+3💎"
- Amount formatting: values ≥ 1 000 shown as "Xk" (e.g. 22k, not 22 361)
- When a stage is claimed: its label text switches from the amount to **"Отримано"**

### Claim Button

- Appears below the bar when a stage is reached and not yet claimed
- Text: `Отримати нагороду  +2💎` or `Отримати нагороду  +3💎`
- If both stages are claimable simultaneously, show two buttons stacked
- Button disappears after claim

## Backward Compatibility

All existing persisted state that has `dailyTipsRewardClaimed` must be migrated:
- If `dailyTipsRewardClaimed === true` → set `dailyTipsStage1Claimed: true, dailyTipsStage2Claimed: false`
- If `dailyTipsRewardClaimed === false` → set both to `false`

Migration happens in `gameStore.ts` during state hydration (the existing normalization step).

## Tests to Update

- `shared/engine/__tests__/lobbyCommands.test.ts` — update `claim_daily_reward` cases for both stages
- `shared/engine/__tests__/lobbyUtils.test.ts` — add `getDailyTipsTargets` tests
- `src/stores/__tests__/gameStore.test.ts` — update hydration/normalization tests
