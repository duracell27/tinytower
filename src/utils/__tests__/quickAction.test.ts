import { getAvailableMode, getFloorsForMode, getFloorActionInfo } from '../quickAction';
import { gameConfig } from '../../../shared/config/gameConfig';
import type { Floor, Worker } from '../../../shared/types';

// Pick the first real typeId from config so tests stay in sync with config changes
const REAL_TYPE = Object.keys(gameConfig.productionTypes)[0];

function makeFloor(id: number, productions: Floor['productions']): Floor {
  return { id, productions };
}

function makeWorker(
  id: string,
  assignedFloorId: number | null,
  assignedSlotIdx: number | null,
): Worker {
  return {
    id,
    name: 'Test',
    female: false,
    floorType: 'green',
    dreamJob: REAL_TYPE,
    level: 1,
    hairColor: '#000',
    assignedFloorId,
    assignedSlotIdx,
    isSpecialist: false,
  };
}

describe('getAvailableMode', () => {
  const now = 100_000;

  it('returns null when floors array is empty', () => {
    expect(getAvailableMode([], [], now)).toBeNull();
  });

  it('returns null when all productions are actively selling', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    // sellDuration is much longer than 100ms, so timer has not elapsed
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBeNull();
  });

  it('returns collect when floor has READY_TO_COLLECT', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [], now)).toBe('collect');
  });

  it('returns list when floor has READY_TO_LIST and no collect', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [], now)).toBe('list');
  });

  it('returns buy when floor has IDLE typeId and no collect/list', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('buy');
  });

  it('returns hire when floor has typed slot with no worker and no collect/list/buy', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    // workers = [] means no worker on slot 0 of floor 1
    expect(getAvailableMode([floor], [], now)).toBe('hire');
  });

  it('prioritizes collect over list', () => {
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('collect');
  });

  it('prioritizes list over buy', () => {
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('list');
  });

  it('prioritizes buy over hire', () => {
    // floor 1 has IDLE (buy) + no worker (hire); floor 2 has selling + no worker (hire only)
    const floors = [
      makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]),
      makeFloor(2, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]),
    ];
    expect(getAvailableMode(floors, [], now)).toBe('buy');
  });

  it('detects READY_TO_COLLECT derived from an elapsed SELLING timer', () => {
    const tc = gameConfig.productionTypes[REAL_TYPE]!;
    const floor = makeFloor(1, [
      {
        typeId: REAL_TYPE,
        stage: 'SELLING',
        stageStartedAt: now - tc.sellDuration - 1,
      },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('collect');
  });

  it('detects READY_TO_LIST derived from an elapsed DELIVERING timer', () => {
    const tc = gameConfig.productionTypes[REAL_TYPE]!;
    const floor = makeFloor(1, [
      {
        typeId: REAL_TYPE,
        stage: 'DELIVERING',
        stageStartedAt: now - tc.deliveryDuration - 1,
      },
    ]);
    expect(getAvailableMode([floor], [makeWorker('w1', 1, 0)], now)).toBe('list');
  });
});

describe('getFloorsForMode', () => {
  const now = 100_000;

  it('returns only floors with matching collect slot', () => {
    const f1 = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f2 = makeFloor(2, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    const result = getFloorsForMode('collect', [f1, f2], [], now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('returns floors sorted by ID descending (highest first)', () => {
    const f1 = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f5 = makeFloor(5, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const f3 = makeFloor(3, [{ typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 }]);
    const result = getFloorsForMode('collect', [f1, f5, f3], [], now);
    expect(result.map((f) => f.id)).toEqual([5, 3, 1]);
  });

  it('includes buy floors regardless of balance', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 }]);
    expect(getFloorsForMode('buy', [floor], [], now)).toHaveLength(1);
  });

  it('excludes floor from hire mode when all typed slots have workers', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    const worker = makeWorker('w1', 1, 0);
    expect(getFloorsForMode('hire', [floor], [worker], now)).toHaveLength(0);
  });

  it('includes floor in hire mode when at least one typed slot has no worker', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 },
    ]);
    const worker = makeWorker('w1', 1, 0); // slot 0 covered, slot 1 empty
    expect(getFloorsForMode('hire', [floor], [worker], now)).toHaveLength(1);
  });

  it('excludes floor from buy mode when slot has no typeId', () => {
    const floor = makeFloor(1, [{ typeId: null, stage: 'IDLE', stageStartedAt: 0 }]);
    expect(getFloorsForMode('buy', [floor], [], now)).toHaveLength(0);
  });
});

describe('getFloorActionInfo', () => {
  const now = 100_000;
  const tc = gameConfig.productionTypes[REAL_TYPE]!;

  it('collect — returns sum of batchValues for all READY_TO_COLLECT slots', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'READY_TO_COLLECT', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }, // not ready
    ]);
    const info = getFloorActionInfo('collect', floor, now);
    expect(info).toEqual({ mode: 'collect', totalCoins: tc.batchValue * 2 });
  });

  it('collect — returns null when no slot is ready', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('collect', floor, now)).toBeNull();
  });

  it('list — returns count 1 for a single ready slot', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 }]);
    expect(getFloorActionInfo('list', floor, now)).toEqual({ mode: 'list', count: 1 });
  });

  it('list — returns count for multiple ready slots', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
      { typeId: REAL_TYPE, stage: 'READY_TO_LIST', stageStartedAt: 0 },
    ]);
    expect(getFloorActionInfo('list', floor, now)).toEqual({ mode: 'list', count: 2 });
  });

  it('buy — returns highest slotIdx that is IDLE', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },    // slot 0
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },    // slot 1
    ]);
    const info = getFloorActionInfo('buy', floor, now);
    expect(info).toMatchObject({ mode: 'buy', slotIdx: 1, typeId: REAL_TYPE, buyCost: tc.buyCost });
  });

  it('buy — skips non-IDLE slots and picks next eligible', () => {
    const floor = makeFloor(1, [
      { typeId: REAL_TYPE, stage: 'IDLE', stageStartedAt: 0 },      // slot 0
      { typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now },  // slot 1 — not IDLE
    ]);
    const info = getFloorActionInfo('buy', floor, now);
    expect(info).toMatchObject({ mode: 'buy', slotIdx: 0 });
  });

  it('buy — returns null when no IDLE slot with typeId', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('buy', floor, now)).toBeNull();
  });

  it('hire — always returns hire info', () => {
    const floor = makeFloor(1, [{ typeId: REAL_TYPE, stage: 'SELLING', stageStartedAt: now - 100 }]);
    expect(getFloorActionInfo('hire', floor, now)).toEqual({ mode: 'hire' });
  });
});
