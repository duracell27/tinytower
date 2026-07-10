import { getExhaustedFloorTypes } from '../floorTypeUtils';

const config = {
  floors: [
    { id: 2, slots: 1, floorType: 'green', availableTypes: ['green'] },
    { id: 3, slots: 1, floorType: 'blue', availableTypes: ['blue'] },
  ],
  floorTypes: {
    green: {
      shirtColor: '#00ff00',
      accent: '#008800',
      businesses: [
        { name: 'Business1', dreamJobs: ['job1'] },
        { name: 'Business2', dreamJobs: ['job2'] },
        { name: 'Business3', dreamJobs: ['job3'] },
      ],
    },
    blue: {
      shirtColor: '#0000ff',
      accent: '#000088',
      businesses: [
        { name: 'Business1', dreamJobs: ['job1'] },
        { name: 'Business2', dreamJobs: ['job2'] },
        { name: 'Business3', dreamJobs: ['job3'] },
      ],
    },
    yellow: {
      shirtColor: '#ffff00',
      accent: '#888800',
      businesses: [
        { name: 'Business1', dreamJobs: ['job1'] },
        { name: 'Business2', dreamJobs: ['job2'] },
        { name: 'Business3', dreamJobs: ['job3'] },
      ],
    },
  },
};

describe('getExhaustedFloorTypes', () => {
  it('returns empty set when nothing is built', () => {
    const result = getExhaustedFloorTypes(
      10,
      [{ id: 2 }, { id: 3 }],
      {},
      [],
      config,
    );
    expect(result.size).toBe(0);
  });

  it('marks a type exhausted when static floors fill all tiers', () => {
    // green has 3 businesses; 1 is in config.floors (id:2), 2 more in openedFloorTypes
    const result = getExhaustedFloorTypes(
      10,
      [{ id: 2 }],
      { '5': 'green', '6': 'green' },
      [],
      config,
    );
    expect(result.has('green')).toBe(true);
    expect(result.has('blue')).toBe(false);
  });

  it('counts pending UC floors (excluding current floor)', () => {
    // yellow: 2 opened + 1 pending other UC = exhausted
    const result = getExhaustedFloorTypes(
      10,
      [],
      { '4': 'yellow', '5': 'yellow' },
      [
        { floorId: 7,  selectedFloorType: 'yellow' },  // other UC — counts
        { floorId: 10, selectedFloorType: 'yellow' },  // current — excluded
      ],
      config,
    );
    expect(result.has('yellow')).toBe(true);
  });

  it('does not count current floor UC in the tally', () => {
    // yellow: 2 opened + current floor (excluded) = 2, not exhausted
    const result = getExhaustedFloorTypes(
      10,
      [],
      { '4': 'yellow', '5': 'yellow' },
      [{ floorId: 10, selectedFloorType: 'yellow' }],
      config,
    );
    expect(result.has('yellow')).toBe(false);
  });

  it('counts static config floors only when they appear in built floors list', () => {
    // config has floor 2 as green, but if floor 2 is not in built floors[] it shouldn't count
    const result = getExhaustedFloorTypes(
      10,
      [],  // no built floors
      { '5': 'green', '6': 'green' },
      [],
      config,
    );
    // 0 static + 2 opened = 2, not exhausted (max 3)
    expect(result.has('green')).toBe(false);
  });
});
