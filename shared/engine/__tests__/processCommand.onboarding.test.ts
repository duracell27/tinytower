import { processCommand } from '../processCommand';
import { createInitialState, gameConfig } from '../../config/gameConfig';
import type { GameState } from '../../types';

const NOW = 1_700_000_000_000;

// Fresh player: only static floors 2+3, no constructions.
function freshState(gems = 50): GameState {
  return { ...createInitialState(gameConfig), gems };
}

// Player who has already opened floor 4 (dynamic floor exists).
function stateWithDynamicFloor(): GameState {
  const base = freshState();
  return {
    ...base,
    floors: [
      ...base.floors,
      { id: 4, productions: [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }] },
    ],
    openedFloorTypes: { '4': 'green' },
  };
}

function cmd<T extends object>(type: string, extra: T) {
  return { id: 'test', type, timestamp: NOW, ...extra } as any;
}

// ─── freeFloor ───────────────────────────────────────────────────────────────

describe('freeFloor guard', () => {
  it('allows freeFloor for first dynamic floor during onboarding', () => {
    const result = processCommand(
      freshState(0),
      cmd('buy_floor', { floorId: 4, freeFloor: true, requiredTools: [] }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.underConstruction).toHaveLength(1);
    expect(result.state.underConstruction[0].floorId).toBe(4);
    expect(result.state.balance).toBe(freshState(0).balance); // no coins deducted
  });

  it('blocks freeFloor when a dynamic floor already exists', () => {
    const result = processCommand(
      stateWithDynamicFloor(),
      cmd('buy_floor', { floorId: 5, freeFloor: true, requiredTools: [] }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/onboarding/);
  });

  it('blocks freeFloor when a construction is already in progress', () => {
    const state: GameState = {
      ...freshState(0),
      underConstruction: [{
        floorId: 4,
        startedAt: NOW - 1000,
        durationMs: 2 * 60 * 1000,
        requiredTools: [],
        selectedFloorType: null,
      }],
    };
    const result = processCommand(
      state,
      cmd('buy_floor', { floorId: 5, freeFloor: true, requiredTools: [] }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/onboarding/);
  });

  it('normal paid buy_floor still works for non-gem floor', () => {
    const state = freshState(0);
    const result = processCommand(
      { ...state, balance: 1_000_000 },
      cmd('buy_floor', { floorId: 4, requiredTools: [] }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.balance).toBeLessThan(1_000_000); // coins deducted
  });
});

// ─── freeOpen ────────────────────────────────────────────────────────────────

describe('freeOpen guard', () => {
  const uc4 = {
    floorId: 4,
    startedAt: NOW - 5 * 60 * 1000,
    durationMs: 2 * 60 * 1000,
    requiredTools: [{ tool: 'briks' as const, count: 1 }],
    selectedFloorType: 'green' as const,
  };

  it('allows freeOpen for first dynamic floor during onboarding (skips tool check)', () => {
    // tools: 0 — would fail the tool check without freeOpen
    const state: GameState = {
      ...freshState(),
      underConstruction: [uc4],
      tools: { briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 },
    };
    const result = processCommand(
      state,
      cmd('open_floor', { floorId: 4, floorType: 'green', freeOpen: true }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.floors.some((f) => f.id === 4)).toBe(true);
    expect(result.state.underConstruction).toHaveLength(0);
  });

  it('blocks freeOpen when a dynamic floor already exists', () => {
    const state: GameState = {
      ...stateWithDynamicFloor(),
      underConstruction: [{ ...uc4, floorId: 5, selectedFloorType: 'blue' }],
    };
    const result = processCommand(
      state,
      cmd('open_floor', { floorId: 5, floorType: 'blue', freeOpen: true }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/onboarding/);
  });
});

// ─── freeSpeedup ─────────────────────────────────────────────────────────────

describe('freeSpeedup guard', () => {
  const uc4 = {
    floorId: 4,
    startedAt: NOW - 1000,
    durationMs: 15 * 60 * 1000,
    requiredTools: [],
    selectedFloorType: null,
  };

  it('allows freeSpeedup for first construction during onboarding', () => {
    const state: GameState = { ...freshState(0), underConstruction: [uc4] };
    const result = processCommand(
      state,
      cmd('speed_up_construction', { floorId: 4, freeSpeedup: true }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(0); // no gems deducted
  });

  it('blocks freeSpeedup when a dynamic floor already exists', () => {
    const state: GameState = {
      ...stateWithDynamicFloor(),
      underConstruction: [{ ...uc4, floorId: 5 }],
    };
    const result = processCommand(
      state,
      cmd('speed_up_construction', { floorId: 5, freeSpeedup: true }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/onboarding/);
  });

  it('deducts gems normally when freeSpeedup is absent (post-onboarding)', () => {
    const state: GameState = { ...stateWithDynamicFloor(), gems: 10, underConstruction: [{ ...uc4, floorId: 5 }] };
    const result = processCommand(
      state,
      cmd('speed_up_construction', { floorId: 5 }),
      gameConfig, NOW, 1, { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBeLessThan(10);
  });
});
