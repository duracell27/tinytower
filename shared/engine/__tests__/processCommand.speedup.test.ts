import { processCommand } from '../processCommand';
import { createInitialState, gameConfig } from '../../config/gameConfig';

describe('speed_up_construction freeSpeedup', () => {
  it('does not deduct gems when freeSpeedup=true', () => {
    const base = createInitialState(gameConfig);
    const now = 1000;
    // Put floor 4 under construction
    const stateWithUc: typeof base = {
      ...base,
      gems: 10,
      underConstruction: [{
        floorId: 4,
        startedAt: now - 1000,       // just started
        durationMs: 15 * 60 * 1000,  // 15 min
        requiredTools: [],
        selectedFloorType: null,
      }],
    };
    const result = processCommand(
      stateWithUc,
      { id: 'x', type: 'speed_up_construction', floorId: 4, timestamp: now, freeSpeedup: true },
      gameConfig,
      now,
      1,
      { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(10); // unchanged
  });

  it('deducts gems normally when freeSpeedup is absent', () => {
    const base = createInitialState(gameConfig);
    const now = 1000;
    const stateWithUc: typeof base = {
      ...base,
      gems: 10,
      underConstruction: [{
        floorId: 4,
        startedAt: now - 1000,
        durationMs: 15 * 60 * 1000,
        requiredTools: [],
        selectedFloorType: null,
      }],
    };
    const result = processCommand(
      stateWithUc,
      { id: 'x', type: 'speed_up_construction', floorId: 4, timestamp: now },
      gameConfig,
      now,
      1,
      { coinPercent: 0, xpPercent: 0 },
    );
    expect(result.success).toBe(true);
    expect(result.state.gems).toBe(9); // 1 gem deducted (15min / 60min = 1)
  });
});
