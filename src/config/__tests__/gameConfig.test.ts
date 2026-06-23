import { gameConfig, createInitialState } from '../gameConfig';

describe('gameConfig', () => {
  it('has 5 floors', () => {
    expect(gameConfig.floors).toHaveLength(5);
  });

  it('has 3 production types', () => {
    expect(Object.keys(gameConfig.productionTypes)).toHaveLength(3);
    expect(gameConfig.productionTypes).toHaveProperty('coffee_shop');
    expect(gameConfig.productionTypes).toHaveProperty('bookstore');
    expect(gameConfig.productionTypes).toHaveProperty('electronics');
  });

  it('every floor references only existing production types', () => {
    const typeIds = Object.keys(gameConfig.productionTypes);
    for (const floor of gameConfig.floors) {
      for (const typeId of floor.availableTypes) {
        expect(typeIds).toContain(typeId);
      }
    }
  });

  it('starting balance is 100', () => {
    expect(gameConfig.startingBalance).toBe(100);
  });
});

describe('createInitialState', () => {
  it('sets balance to startingBalance', () => {
    const state = createInitialState(gameConfig);
    expect(state.balance).toBe(100);
  });

  it('creates correct number of floors', () => {
    const state = createInitialState(gameConfig);
    expect(state.floors).toHaveLength(5);
  });

  it('creates correct number of production slots per floor', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      expect(floor.productions).toHaveLength(3);
    }
  });

  it('all production slots start empty and IDLE', () => {
    const state = createInitialState(gameConfig);
    for (const floor of state.floors) {
      for (const prod of floor.productions) {
        expect(prod.typeId).toBeNull();
        expect(prod.stage).toBe('IDLE');
        expect(prod.stageStartedAt).toBe(0);
      }
    }
  });

  it('command queue starts empty', () => {
    const state = createInitialState(gameConfig);
    expect(state.commandQueue).toHaveLength(0);
  });
});
