import { getWorkerForSlot, getFloorDiscount, getRevenueMultiplier, getWorkerMood, getFloorSpecialistBonus } from '../workerUtils';
import type { Worker } from '../../types';

describe('Worker schema isSpecialist default', () => {
  it('defaults isSpecialist to false when field is absent', () => {
    const { WorkerSchema } = require('../../schemas/worker');
    const result = WorkerSchema.parse({
      id: 'w1', name: 'Test', female: false, floorType: 'green',
      dreamJob: 'buns', level: 5, hairColor: '#5C3A22',
      assignedFloorId: null, assignedSlotIdx: null,
    });
    expect(result.isSpecialist).toBe(false);
  });
});

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'bulky', level: 5, hairColor: '#5C3A22',
    assignedFloorId: null, assignedSlotIdx: null,
    isSpecialist: false,
    ...overrides,
  };
}

describe('getWorkerMood', () => {
  it('returns bad for unemployed worker', () => {
    expect(getWorkerMood(makeWorker(), null, null)).toBe('bad');
  });

  it('returns bad for worker on wrong floor type', () => {
    const w = makeWorker({ floorType: 'green', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'blue', 'wash')).toBe('bad');
  });

  it('returns mid for worker on matching floor type but wrong product', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'green', 'cake')).toBe('mid');
  });

  it('returns good for worker on dream job', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky', assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerMood(w, 'green', 'bulky')).toBe('good');
  });
});

describe('getRevenueMultiplier', () => {
  it('returns 1.0 for wrong floor type', () => {
    const w = makeWorker({ floorType: 'green' });
    expect(getRevenueMultiplier(w, 'blue', 'wash')).toBe(1.0);
  });

  it('returns 1.3 for matching floor, wrong product', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky' });
    expect(getRevenueMultiplier(w, 'green', 'cake')).toBe(1.3);
  });

  it('returns 2.0 for dream job match', () => {
    const w = makeWorker({ floorType: 'green', dreamJob: 'bulky' });
    expect(getRevenueMultiplier(w, 'green', 'bulky')).toBe(2.0);
  });
});

describe('getFloorDiscount', () => {
  it('returns 0 for floor with no workers', () => {
    expect(getFloorDiscount([], 1)).toBe(0);
  });

  it('sums levels of all workers on floor', () => {
    const workers = [
      makeWorker({ id: 'w1', level: 3, assignedFloorId: 1, assignedSlotIdx: 0 }),
      makeWorker({ id: 'w2', level: 5, assignedFloorId: 1, assignedSlotIdx: 1 }),
      makeWorker({ id: 'w3', level: 7, assignedFloorId: 1, assignedSlotIdx: 2 }),
    ];
    expect(getFloorDiscount(workers, 1)).toBeCloseTo(0.15);
  });

  it('ignores workers on other floors', () => {
    const workers = [
      makeWorker({ id: 'w1', level: 9, assignedFloorId: 2, assignedSlotIdx: 0 }),
    ];
    expect(getFloorDiscount(workers, 1)).toBe(0);
  });
});

describe('getWorkerForSlot', () => {
  it('finds worker assigned to specific slot', () => {
    const w = makeWorker({ assignedFloorId: 1, assignedSlotIdx: 0 });
    expect(getWorkerForSlot([w], 1, 0)).toBe(w);
  });

  it('returns undefined for empty slot', () => {
    expect(getWorkerForSlot([], 1, 0)).toBeUndefined();
  });
});

describe('getFloorSpecialistBonus', () => {
  it('returns 0 when no workers on floor', () => {
    expect(getFloorSpecialistBonus([], 1)).toBe(0);
  });

  it('returns 0 when workers are not specialists', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: false }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBe(0);
  });

  it('returns 0.09 for one specialist', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBeCloseTo(0.09);
  });

  it('returns 0.27 for three specialists', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 1, assignedSlotIdx: 0, isSpecialist: true }),
      makeWorker({ id: 'w2', assignedFloorId: 1, assignedSlotIdx: 1, isSpecialist: true }),
      makeWorker({ id: 'w3', assignedFloorId: 1, assignedSlotIdx: 2, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBeCloseTo(0.27);
  });

  it('ignores specialists on other floors', () => {
    const workers = [
      makeWorker({ id: 'w1', assignedFloorId: 2, assignedSlotIdx: 0, isSpecialist: true }),
    ];
    expect(getFloorSpecialistBonus(workers, 1)).toBe(0);
  });
});

import { getBuiltFloorCountForType } from '../workerUtils';
import type { Floor, GameConfig } from '../../types';

const miniConfig = {
  floorTypes: {
    green: { shirtColor: '#0', accent: '#0', businesses: [] },
    blue:  { shirtColor: '#0', accent: '#0', businesses: [] },
  },
  floors: [
    { id: 1, slots: 1, floorType: 'green', availableTypes: [] },
    { id: 2, slots: 1, floorType: 'blue',  availableTypes: [] },
  ],
  productionTypes: {},
  startingBalance: 0,
  hotelCapacity: 0,
  lobbyConfig: {} as any,
  floorUnlocks: [],
} as unknown as GameConfig;

function makeFloor(id: number): Floor {
  return { id, productions: [] };
}

describe('getBuiltFloorCountForType', () => {
  it('returns 0 when no floors exist', () => {
    expect(getBuiltFloorCountForType('green', [], {}, miniConfig)).toBe(0);
  });

  it('counts static floors of matching type', () => {
    const floors = [makeFloor(1), makeFloor(2)];
    // floor 1 is green (from miniConfig.floors), floor 2 is blue
    expect(getBuiltFloorCountForType('green', floors, {}, miniConfig)).toBe(1);
    expect(getBuiltFloorCountForType('blue',  floors, {}, miniConfig)).toBe(1);
  });

  it('counts dynamic floors via openedFloorTypes', () => {
    const floors = [makeFloor(1), makeFloor(5), makeFloor(6)];
    const openedFloorTypes = { '5': 'green', '6': 'green' };
    // floor 1 static green + floors 5,6 dynamic green = 3
    expect(getBuiltFloorCountForType('green', floors, openedFloorTypes, miniConfig)).toBe(3);
  });

  it('ignores floors of a different type', () => {
    const floors = [makeFloor(2)]; // blue
    expect(getBuiltFloorCountForType('green', floors, {}, miniConfig)).toBe(0);
  });

  it('static type takes precedence over openedFloorTypes for same id', () => {
    // floor 1 is green in config; even if openedFloorTypes says blue, config wins
    const floors = [makeFloor(1)];
    const openedFloorTypes = { '1': 'blue' };
    expect(getBuiltFloorCountForType('green', floors, openedFloorTypes, miniConfig)).toBe(1);
    expect(getBuiltFloorCountForType('blue',  floors, openedFloorTypes, miniConfig)).toBe(0);
  });
});
