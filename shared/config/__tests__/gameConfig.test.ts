import { gameConfig, createInitialState } from '../gameConfig';

describe('gameConfig', () => {
  it('has 3 floors', () => {
    expect(gameConfig.floors).toHaveLength(3);
  });

  it('has 9 production types', () => {
    expect(Object.keys(gameConfig.productionTypes)).toHaveLength(9);
    expect(gameConfig.productionTypes).toHaveProperty('bulky');
    expect(gameConfig.productionTypes).toHaveProperty('cupcake');
    expect(gameConfig.productionTypes).toHaveProperty('cake');
    expect(gameConfig.productionTypes).toHaveProperty('wash');
    expect(gameConfig.productionTypes).toHaveProperty('dry');
    expect(gameConfig.productionTypes).toHaveProperty('bleach');
    expect(gameConfig.productionTypes).toHaveProperty('coffee');
    expect(gameConfig.productionTypes).toHaveProperty('pancake');
    expect(gameConfig.productionTypes).toHaveProperty('dessert');
  });

  it('has 5 floor types', () => {
    expect(Object.keys(gameConfig.floorTypes)).toHaveLength(5);
    expect(gameConfig.floorTypes).toHaveProperty('green');
    expect(gameConfig.floorTypes).toHaveProperty('teal');
    expect(gameConfig.floorTypes).toHaveProperty('amber');
    expect(gameConfig.floorTypes).toHaveProperty('purple');
    expect(gameConfig.floorTypes).toHaveProperty('blue');
  });

  it('every floor has a valid floorType', () => {
    const floorTypeKeys = Object.keys(gameConfig.floorTypes);
    for (const floor of gameConfig.floors) {
      expect(floorTypeKeys).toContain(floor.floorType);
    }
  });

  it('every floor references only existing production types', () => {
    const typeIds = Object.keys(gameConfig.productionTypes);
    for (const floor of gameConfig.floors) {
      for (const typeId of floor.availableTypes) {
        expect(typeIds).toContain(typeId);
      }
    }
  });

  it('starting balance is 1000', () => {
    expect(gameConfig.startingBalance).toBe(1000);
  });

  it('hotel capacity is 10', () => {
    expect(gameConfig.hotelCapacity).toBe(10);
  });
});

describe('createInitialState', () => {
  it('sets balance to startingBalance', () => {
    const state = createInitialState(gameConfig);
    expect(state.balance).toBe(1000);
  });

  it('creates correct number of floors', () => {
    const state = createInitialState(gameConfig);
    expect(state.floors).toHaveLength(3);
  });

  it('creates correct number of production slots per floor', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      expect(floor.productions).toHaveLength(3);
    }
  });

  it('pre-assigns typeIds from availableTypes', () => {
    const state = createInitialState(gameConfig);
    // Floor 0 (Кондитерська): bulky, cupcake, cake
    expect(state.floors[0].productions[0].typeId).toBe('bulky');
    expect(state.floors[0].productions[1].typeId).toBe('cupcake');
    expect(state.floors[0].productions[2].typeId).toBe('cake');
    // Floor 1 (Пральня): wash, dry, bleach
    expect(state.floors[1].productions[0].typeId).toBe('wash');
    expect(state.floors[1].productions[1].typeId).toBe('dry');
    expect(state.floors[1].productions[2].typeId).toBe('bleach');
    // Floor 2 (Кав'ярня): coffee, pancake, dessert
    expect(state.floors[2].productions[0].typeId).toBe('coffee');
    expect(state.floors[2].productions[1].typeId).toBe('pancake');
    expect(state.floors[2].productions[2].typeId).toBe('dessert');
  });

  it('all production slots start IDLE', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      for (const prod of floor.productions) {
        expect(prod.stage).toBe('IDLE');
        expect(prod.stageStartedAt).toBe(0);
      }
    }
  });

  it('command queue starts empty', () => {
    const state = createInitialState(gameConfig);
    expect(state.commandQueue).toHaveLength(0);
  });

  it('workers array starts empty', () => {
    const state = createInitialState(gameConfig);
    expect(state.workers).toHaveLength(0);
  });

  it('hotelCapacity matches config', () => {
    const state = createInitialState(gameConfig);
    expect(state.hotelCapacity).toBe(gameConfig.hotelCapacity);
  });

  it('gems initialized to 20', () => {
    const state = createInitialState(gameConfig);
    expect(state.gems).toBe(20);
  });

  it('lobby fields initialized', () => {
    const state = createInitialState(gameConfig);
    expect(state.lobbyVisitors).toEqual([]);
    expect(state.lobbyCapacity).toBe(gameConfig.lobbyConfig.defaultLobbyCapacity);
    expect(state.elevatorLevel).toBe(1);
    expect(state.elevatorFloor).toBe(0);
    expect(state.dailyTips).toBe(0);
    expect(state.dailyGemsCollected).toBe(0);
    expect(state.dailyTipsRewardClaimed).toBe(false);
    expect(state.lastDailyReset).toBe(0);
    expect(state.nextVisitorAt).toBe(0);
  });
});
