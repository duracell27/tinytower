import { calcRevenuePerMin } from '../ratingUtils';
import type { Floor, Worker, GameConfig } from '../../types';

function makeWorker(overrides?: Partial<Worker>): Worker {
  return {
    id: 'w1', name: 'Test', female: false, floorType: 'green',
    dreamJob: 'buns', level: 1, hairColor: '#000000',
    assignedFloorId: null, assignedSlotIdx: null,
    isSpecialist: false,
    ...overrides,
  };
}

const mockConfig = {
  productionTypes: {
    // sellDuration 300_000ms = 5 min, batchValue 64
    buns: { buyCost: 10, deliveryDuration: 105_000, sellDuration: 300_000, batchValue: 64 },
    // sellDuration 480_000ms = 8 min, batchValue 128
    cards: { buyCost: 20, deliveryDuration: 120_000, sellDuration: 480_000, batchValue: 128 },
  },
  floors: [
    { id: 2, slots: 3, floorType: 'green', availableTypes: ['buns'] },
  ],
} as unknown as GameConfig;

describe('calcRevenuePerMin', () => {
  it('returns 0 when no floors', () => {
    expect(calcRevenuePerMin([], [], {}, mockConfig)).toBe(0);
  });

  it('returns 0 when no productions are SELLING', () => {
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'DELIVERING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(0);
  });

  it('skips production with null typeId', () => {
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: null, stage: 'SELLING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(0);
  });

  it('computes revenuePerMin for one SELLING production with no worker', () => {
    // effectiveRevenue = Math.floor(64 * 1 * 1) = 64
    // sellDurationMin = 300_000 / 60_000 = 5
    // revenuePerMin = Math.floor(64 / 5) = 12
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    expect(calcRevenuePerMin(floors, [], {}, mockConfig)).toBe(12);
  });

  it('applies 2x multiplier for dream-job worker', () => {
    // effectiveRevenue = Math.floor(64 * 2 * 1) = 128
    // revenuePerMin = Math.floor(128 / 5) = 25
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'buns',
      assignedFloorId: 2, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(25);
  });

  it('applies 1.3x multiplier for mid-mood worker', () => {
    // effectiveRevenue = Math.floor(64 * 1.3 * 1) = Math.floor(83.2) = 83
    // revenuePerMin = Math.floor(83 / 5) = 16
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'other',
      assignedFloorId: 2, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(16);
  });

  it('applies specialist bonus from same floor', () => {
    // 1 specialist on floor 2: specialistBonus = 0.09
    // effectiveRevenue = Math.floor(64 * 1 * 1.09) = Math.floor(69.76) = 69
    // revenuePerMin = Math.floor(69 / 5) = 13
    const floors: Floor[] = [{
      id: 2,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      assignedFloorId: 2, assignedSlotIdx: 1, isSpecialist: true,
    })];
    expect(calcRevenuePerMin(floors, workers, {}, mockConfig)).toBe(13);
  });

  it('sums across multiple SELLING productions on different floors', () => {
    // floor 2: buns, no worker → 12
    // floor 3 (dynamic): cards, no worker
    //   effectiveRevenue = Math.floor(128 * 1 * 1) = 128
    //   revenuePerMin = Math.floor(128 / 8) = 16
    // total = 28
    const floors: Floor[] = [
      { id: 2, productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }] },
      { id: 3, productions: [{ typeId: 'cards', stage: 'SELLING', stageStartedAt: 0 }] },
    ];
    expect(calcRevenuePerMin(floors, [], { '3': 'blue' }, mockConfig)).toBe(28);
  });

  it('resolves floorType from openedFloorTypes for dynamic floors', () => {
    // floor 99 not in config.floors → uses openedFloorTypes['99'] = 'green'
    // worker with floorType 'green' dreamJob 'buns' on slot 0 → multiplier 2x
    // effectiveRevenue = Math.floor(64 * 2 * 1) = 128
    // revenuePerMin = Math.floor(128 / 5) = 25
    const floors: Floor[] = [{
      id: 99,
      productions: [{ typeId: 'buns', stage: 'SELLING', stageStartedAt: 0 }],
    }];
    const workers = [makeWorker({
      floorType: 'green', dreamJob: 'buns',
      assignedFloorId: 99, assignedSlotIdx: 0,
    })];
    expect(calcRevenuePerMin(floors, workers, { '99': 'green' }, mockConfig)).toBe(25);
  });
});
