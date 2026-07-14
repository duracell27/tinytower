import { gameConfig, createInitialState } from '../gameConfig';

describe('gameConfig', () => {
  it('has 2 pre-built floors', () => {
    expect(gameConfig.floors).toHaveLength(2);
  });

  it('has 45 production types', () => {
    expect(Object.keys(gameConfig.productionTypes)).toHaveLength(45);
    // Green / Products
    expect(gameConfig.productionTypes).toHaveProperty('buns');
    expect(gameConfig.productionTypes).toHaveProperty('pastries');
    expect(gameConfig.productionTypes).toHaveProperty('cakes');
    expect(gameConfig.productionTypes).toHaveProperty('burgers');
    expect(gameConfig.productionTypes).toHaveProperty('fries');
    expect(gameConfig.productionTypes).toHaveProperty('drinks');
    expect(gameConfig.productionTypes).toHaveProperty('milk');
    expect(gameConfig.productionTypes).toHaveProperty('cheese');
    expect(gameConfig.productionTypes).toHaveProperty('yogurt');
    // Blue / Service
    expect(gameConfig.productionTypes).toHaveProperty('cards');
    expect(gameConfig.productionTypes).toHaveProperty('loans');
    expect(gameConfig.productionTypes).toHaveProperty('accounts');
    expect(gameConfig.productionTypes).toHaveProperty('scooters');
    expect(gameConfig.productionTypes).toHaveProperty('consoles');
    expect(gameConfig.productionTypes).toHaveProperty('tools');
    expect(gameConfig.productionTypes).toHaveProperty('fillings');
    expect(gameConfig.productionTypes).toHaveProperty('cleaning');
    expect(gameConfig.productionTypes).toHaveProperty('braces');
    // Yellow / Rest
    expect(gameConfig.productionTypes).toHaveProperty('paintings');
    expect(gameConfig.productionTypes).toHaveProperty('sculptures');
    expect(gameConfig.productionTypes).toHaveProperty('gallery');
    expect(gameConfig.productionTypes).toHaveProperty('karts');
    expect(gameConfig.productionTypes).toHaveProperty('helmets');
    expect(gameConfig.productionTypes).toHaveProperty('track');
    expect(gameConfig.productionTypes).toHaveProperty('cocktails');
    expect(gameConfig.productionTypes).toHaveProperty('hookahs');
    expect(gameConfig.productionTypes).toHaveProperty('pizza');
    // Purple / Fashion
    expect(gameConfig.productionTypes).toHaveProperty('canvas_shoes');
    expect(gameConfig.productionTypes).toHaveProperty('sneakers');
    expect(gameConfig.productionTypes).toHaveProperty('custom_sneakers');
    expect(gameConfig.productionTypes).toHaveProperty('tshirts');
    expect(gameConfig.productionTypes).toHaveProperty('pants');
    expect(gameConfig.productionTypes).toHaveProperty('jackets');
    expect(gameConfig.productionTypes).toHaveProperty('hoodies');
    expect(gameConfig.productionTypes).toHaveProperty('sweatshirts');
    expect(gameConfig.productionTypes).toHaveProperty('caps');
    // Red / Electronics
    expect(gameConfig.productionTypes).toHaveProperty('phones');
    expect(gameConfig.productionTypes).toHaveProperty('cases');
    expect(gameConfig.productionTypes).toHaveProperty('screen_protectors');
    expect(gameConfig.productionTypes).toHaveProperty('pcs');
    expect(gameConfig.productionTypes).toHaveProperty('laptops');
    expect(gameConfig.productionTypes).toHaveProperty('monitors');
    expect(gameConfig.productionTypes).toHaveProperty('robots');
    expect(gameConfig.productionTypes).toHaveProperty('drones');
    expect(gameConfig.productionTypes).toHaveProperty('spare_parts');
  });

  it('has 5 floor types', () => {
    expect(Object.keys(gameConfig.floorTypes)).toHaveLength(5);
    expect(gameConfig.floorTypes).toHaveProperty('green');
    expect(gameConfig.floorTypes).toHaveProperty('blue');
    expect(gameConfig.floorTypes).toHaveProperty('yellow');
    expect(gameConfig.floorTypes).toHaveProperty('purple');
    expect(gameConfig.floorTypes).toHaveProperty('red');
  });

  it('each floor type has 3 businesses', () => {
    for (const [, ft] of Object.entries(gameConfig.floorTypes)) {
      expect(ft.businesses).toHaveLength(3);
    }
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

  it('starting balance is 500', () => {
    expect(gameConfig.startingBalance).toBe(500);
  });

  it('hotel capacity is 10', () => {
    expect(gameConfig.hotelCapacity).toBe(10);
  });

  it('has 12 floor unlocks (floors 4–15)', () => {
    expect(gameConfig.floorUnlocks).toHaveLength(12);
  });

  it('floor 4 costs 300 coins, 1 tool slot', () => {
    const f4 = gameConfig.floorUnlocks.find((f) => f.floorId === 4);
    expect(f4).toEqual({ floorId: 4, price: 300, currency: 'coins', constructionDurationMs: 15 * 60 * 1000, requiredToolSlots: 1, requiredToolCount: 1 });
  });

  it('floors 11-15 require 2 tool slots', () => {
    for (let i = 11; i <= 15; i++) {
      const f = gameConfig.floorUnlocks.find((f) => f.floorId === i);
      expect(f?.requiredToolSlots).toBe(2);
    }
  });

  it('floor 11 builds in 4 hours, floor 14 in 10 hours', () => {
    expect(gameConfig.floorUnlocks.find((f) => f.floorId === 11)?.constructionDurationMs).toBe(240 * 60 * 1000);
    expect(gameConfig.floorUnlocks.find((f) => f.floorId === 14)?.constructionDurationMs).toBe(600 * 60 * 1000);
  });

  it('floor 5 costs 3 gems', () => {
    const f5 = gameConfig.floorUnlocks.find((f) => f.floorId === 5);
    expect(f5).toMatchObject({ price: 3, currency: 'gems' });
  });

  it('floor 10 costs 15 gems', () => {
    const f10 = gameConfig.floorUnlocks.find((f) => f.floorId === 10);
    expect(f10).toMatchObject({ price: 15, currency: 'gems' });
  });

  it('floor 15 costs 50 gems', () => {
    const f15 = gameConfig.floorUnlocks.find((f) => f.floorId === 15);
    expect(f15).toMatchObject({ price: 50, currency: 'gems' });
  });
});

describe('createInitialState', () => {
  it('sets balance to startingBalance', () => {
    const state = createInitialState(gameConfig);
    expect(state.balance).toBe(500);
  });

  it('creates correct number of pre-built floors', () => {
    const state = createInitialState(gameConfig);
    expect(state.floors).toHaveLength(2);
  });

  it('creates correct number of production slots per floor', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      expect(floor.productions).toHaveLength(3);
    }
  });

  it('pre-assigns typeIds from availableTypes', () => {
    const state = createInitialState(gameConfig);
    // Floor 2 (Confectionery): buns, pastries, cakes
    expect(state.floors[0].productions[0].typeId).toBe('buns');
    expect(state.floors[0].productions[1].typeId).toBe('pastries');
    expect(state.floors[0].productions[2].typeId).toBe('cakes');
    // Floor 3 (Banking): cards, loans, accounts
    expect(state.floors[1].productions[0].typeId).toBe('cards');
    expect(state.floors[1].productions[1].typeId).toBe('loans');
    expect(state.floors[1].productions[2].typeId).toBe('accounts');
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

  it('workers array starts with 5 hotel workers', () => {
    const state = createInitialState(gameConfig);
    expect(state.workers).toHaveLength(5);
  });

  it('initial workers are unassigned', () => {
    const state = createInitialState(gameConfig);
    for (const w of state.workers) {
      expect(w.assignedFloorId).toBeNull();
      expect(w.assignedSlotIdx).toBeNull();
    }
  });

  it('hotelCapacity matches config', () => {
    const state = createInitialState(gameConfig);
    expect(state.hotelCapacity).toBe(gameConfig.hotelCapacity);
  });

  it('gems initialized to 10', () => {
    const state = createInitialState(gameConfig);
    expect(state.gems).toBe(10);
  });

  it('lobby fields initialized', () => {
    const state = createInitialState(gameConfig);
    expect(state.lobbyVisitors).toHaveLength(gameConfig.lobbyConfig.defaultLobbyCapacity);
    expect(state.lobbyCapacity).toBe(gameConfig.lobbyConfig.defaultLobbyCapacity);
    expect(state.elevatorLevel).toBe(1);
    expect(state.elevatorFloor).toBe(0);
    expect(state.dailyTips).toBe(0);
    expect(state.dailyGemsCollected).toBe(0);
    expect(state.dailyTipsStage1Claimed).toBe(false);
    expect(state.dailyTipsStage2Claimed).toBe(false);
    expect(state.lastDailyReset).toBe(0);
    expect(state.nextVisitorAt).toBe(0);
  });

  it('tools initialized with all 4 types having 1', () => {
    const state = createInitialState(gameConfig);
    const keys = ['briks', 'glass', 'nails', 'screw'] as const;
    for (const k of keys) {
      expect(state.tools[k]).toBe(1);
    }
  });

  it('underConstruction initialized to empty array', () => {
    const state = createInitialState(gameConfig);
    expect(state.underConstruction).toEqual([]);
  });

  it('openedFloorTypes initialized to empty object', () => {
    const state = createInitialState(gameConfig);
    expect(state.openedFloorTypes).toEqual({});
  });
});
