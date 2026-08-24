import { processCommand } from '../processCommand';
import { createInitialState, gameConfig } from '../../config/gameConfig';
import type { GameState } from '../../types';
import { TUTORIAL_TASKS, FINAL_REWARD } from '../../config/tutorialTasksConfig';

const testConfig = gameConfig; // use real config

function makeState(overrides?: Partial<GameState>): GameState {
  return { ...createInitialState(testConfig), ...overrides };
}

const baseCmd = { id: '', timestamp: Date.now() };

describe('claim_tutorial_task', () => {
  it('rejects wrong index', () => {
    const state = makeState({ tutorialTasks: { currentIndex: 0, snapshot: {}, claimedFinal: false } });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_task', taskIndex: 1 }, testConfig, Date.now());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/index/i);
  });

  it('rejects when threshold not met', () => {
    const state = makeState({
      tutorialTasks: { currentIndex: 0, snapshot: { coinsCollected: 0 }, claimedFinal: false },
      tutorialProgress: { coinsCollected: 5, visitorsLifted: 0, workersHired: 0, floorsBuilt: 0, dailyTasksClaimed: 0, elevatorUpgraded: 0, lobbyUpgraded: 0, floorUpgraded: 0, inviteSent: 0, businessUpgraded: 0 },
    });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_task', taskIndex: 0 }, testConfig, Date.now());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not complete/i);
  });

  it('succeeds, grants coins, advances index, sets snapshot', () => {
    const task0 = TUTORIAL_TASKS[0]!; // collect_revenue, threshold 10, reward 500 coins
    const state = makeState({
      tutorialTasks: { currentIndex: 0, snapshot: { coinsCollected: 0 }, claimedFinal: false },
      tutorialProgress: { coinsCollected: 10, visitorsLifted: 0, workersHired: 0, floorsBuilt: 0, dailyTasksClaimed: 0, elevatorUpgraded: 0, lobbyUpgraded: 0, floorUpgraded: 0, inviteSent: 0, businessUpgraded: 0 },
    });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_task', taskIndex: 0 }, testConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(state.balance + task0.reward.coins);
    expect(result.state.tutorialTasks.currentIndex).toBe(1);
    expect(result.state.tutorialTasks.snapshot['visitorsLifted']).toBeDefined();
  });

  it('rejects already claimed (index already past)', () => {
    const state = makeState({ tutorialTasks: { currentIndex: 1, snapshot: {}, claimedFinal: false } });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_task', taskIndex: 0 }, testConfig, Date.now());
    expect(result.success).toBe(false);
  });
});

describe('claim_tutorial_final', () => {
  it('rejects when not all tasks done', () => {
    const state = makeState({ tutorialTasks: { currentIndex: 5, snapshot: {}, claimedFinal: false } });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_final' }, testConfig, Date.now());
    expect(result.success).toBe(false);
  });

  it('rejects if already claimed', () => {
    const state = makeState({ tutorialTasks: { currentIndex: 10, snapshot: {}, claimedFinal: true } });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_final' }, testConfig, Date.now());
    expect(result.success).toBe(false);
  });

  it('succeeds, grants final reward, sets claimedFinal', () => {
    const state = makeState({ tutorialTasks: { currentIndex: 10, snapshot: {}, claimedFinal: false } });
    const result = processCommand(state, { ...baseCmd, type: 'claim_tutorial_final' }, testConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(state.balance + FINAL_REWARD.coins);
    expect(result.state.gems).toBe(state.gems + FINAL_REWARD.gems);
    expect(result.state.tutorialTasks.claimedFinal).toBe(true);
  });
});
