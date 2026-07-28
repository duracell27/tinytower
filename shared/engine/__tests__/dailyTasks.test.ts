import { checkDailyReset } from '../lobbyUtils';
import { processCommand } from '../processCommand';
import { gameConfig, createInitialState } from '../../config/gameConfig';
import type { GameState } from '../../types';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeState(overrides = {}): GameState {
  return {
    ...createInitialState(gameConfig),
    lastDailyReset: 1000,
    ...overrides,
  } as GameState;
}

describe('checkDailyReset — dailyTasks', () => {
  it('resets progress and claimed at midnight', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 50, vipsLifted: 0, goodsBought: 30, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: ['transporter'],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.progress.visitorsLifted).toBe(0);
    expect(next.dailyTasks.progress.goodsBought).toBe(0);
    expect(next.dailyTasks.claimed).toEqual([]);
  });

  it('sets doubleRewardActive when 7+ visible tasks were claimed', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: ['transporter', 'vip_transporter', 'wholesale', 'new_residents',
          'easy_money', 'money_collector', 'build_floor'],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.doubleRewardActive).toBe(true);
  });

  it('does not set doubleRewardActive when fewer than 7 tasks claimed', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: ['transporter', 'vip_transporter', 'wholesale'],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.doubleRewardActive).toBe(false);
  });

  it('does not count hidden IAP tasks towards double reward', () => {
    const state = makeState({
      dailyTasks: {
        progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: ['transporter', 'vip_transporter', 'wholesale', 'new_residents',
          'easy_money', 'money_collector', 'investor'],
        doubleRewardActive: false,
      },
    });
    const next = checkDailyReset(state, 1000 + DAY_MS + 1);
    expect(next.dailyTasks.doubleRewardActive).toBe(false);
  });

  it('does not reset if not past midnight', () => {
    const base = createInitialState(gameConfig);
    const state = makeState({
      dailyTasks: {
        ...base.dailyTasks,
        progress: { ...base.dailyTasks.progress, visitorsLifted: 42 },
      },
    });
    const next = checkDailyReset(state, 1000 + 100);
    expect(next.dailyTasks.progress.visitorsLifted).toBe(42);
  });
});

describe('progress tracking', () => {
  it('increments goodsBought on buy command', () => {
    const baseState = createInitialState(gameConfig);
    const floor = baseState.floors[0];
    // Assign a worker to slot 0 so the buy command can proceed
    const state: GameState = {
      ...baseState,
      balance: 999999,
      workers: [
        {
          id: 'w-test', name: 'Test Worker', female: false,
          floorType: 'green', dreamJob: 'buns', level: 5, hairColor: '#5C3A22',
          assignedFloorId: floor.id, assignedSlotIdx: 0, isSpecialist: false,
        },
        ...baseState.workers,
      ],
    };
    const cmd = {
      id: '1', type: 'buy' as const,
      floorId: floor.id, slotIdx: 0,
      typeId: floor.productions[0].typeId!,
      timestamp: Date.now(),
    };
    const result = processCommand(state, cmd, gameConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.dailyTasks.progress.goodsBought).toBe(1);
  });

  it('increments residentsEvicted on evict_worker', () => {
    const state = makeState();
    const hotelWorker = state.workers.find(w => w.assignedFloorId === null);
    if (!hotelWorker) throw new Error('No hotel worker in initial state');
    const cmd = { id: '2', type: 'evict_worker' as const, workerId: hotelWorker.id, timestamp: Date.now() };
    const result = processCommand(state, cmd, gameConfig, Date.now());
    expect(result.success).toBe(true);
    expect(result.state.dailyTasks.progress.residentsEvicted).toBe(1);
  });
});

describe('claim_daily_task', () => {
  const baseCmd = {
    id: 'c1', type: 'claim_daily_task' as const, timestamp: Date.now(),
    taskKey: 'transporter', tokenCount: 3, tokenColor: 'green' as const,
  };

  function stateWithProgress(visitorsLifted: number) {
    return makeState({
      balance: 0, gems: 0,
      tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
      dailyTasks: {
        progress: { visitorsLifted, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
  }

  it('fails when progress not reached', () => {
    const result = processCommand(stateWithProgress(50), baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(false);
  });

  it('fails when already claimed', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, claimed: ['transporter'] } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(false);
  });

  it('adds coins (baseCoins × multiplier) to balance', () => {
    // transporter baseCoins=1300, level 1 → multiplier 1 → +1300
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(true);
    expect(result.state.balance).toBe(1300);
  });

  it('adds fixed gems regardless of level', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 25);
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(1); // transporter gems = 1
  });

  it('doubles coins when doubleRewardActive', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, doubleRewardActive: true } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.balance).toBe(2600); // 1300 × 2
  });

  it('does NOT double gems when doubleRewardActive', () => {
    const state = { ...stateWithProgress(100), dailyTasks: { ...stateWithProgress(100).dailyTasks, doubleRewardActive: true } };
    const result = processCommand(state, baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.gems).toBe(1); // still 1
  });

  it('adds tokens of specified color and count', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.tokens.green).toBe(3);
  });

  it('marks task as claimed', () => {
    const result = processCommand(stateWithProgress(100), baseCmd, gameConfig, Date.now(), 1);
    expect(result.state.dailyTasks.claimed).toContain('transporter');
  });

  it('adds materials for build_floor task', () => {
    const stateWithFloor = makeState({
      tokens: { green: 0, blue: 0, yellow: 0, purple: 0, red: 0 },
      tools: { briks: 0, glass: 0, nails: 0, screw: 0 },
      dailyTasks: {
        progress: { visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
          gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 1, residentsEvicted: 0, goodsListed: 0 },
        claimed: [],
        doubleRewardActive: false,
      },
    });
    const buildCmd = { ...baseCmd, taskKey: 'build_floor', materialType: 'briks' as const };
    // level 1 → getMaterialCount(1) = 2
    const result = processCommand(stateWithFloor, buildCmd, gameConfig, Date.now(), 1);
    expect(result.success).toBe(true);
    expect(result.state.tools.briks).toBe(2);
  });
});
