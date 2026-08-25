import { getProductionStatus } from '../productionStatus';
import type { Production, ProductionTypeConfig } from '../../types';

const coffeeConfig: ProductionTypeConfig = {
  buyCost: 10,
  deliveryDuration: 5000,
  sellDuration: 10000,
  batchValue: 25,
};

describe('getProductionStatus', () => {
  describe('EMPTY slot (no typeId)', () => {
    it('returns EMPTY with canAct true', () => {
      const prod: Production = { typeId: null, stage: 'IDLE', stageStartedAt: 0 };
      const status = getProductionStatus(prod, null, 1000, 100);
      expect(status.effectiveStage).toBe('EMPTY');
      expect(status.canAct).toBe(true);
      expect(status.timeRemaining).toBe(0);
      expect(status.actionLabel).toBeNull();
    });
  });

  describe('IDLE stage (type assigned)', () => {
    const prod: Production = { typeId: 'coffee_shop', stage: 'IDLE', stageStartedAt: 0 };

    it('returns IDLE with canAct true when balance sufficient', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('IDLE');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Buy ($10)');
    });

    it('returns IDLE with canAct false when balance insufficient', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 5);
      expect(status.effectiveStage).toBe('IDLE');
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBe('Buy ($10)');
    });

    it('returns canAct true when balance exactly equals cost', () => {
      const status = getProductionStatus(prod, coffeeConfig, 1000, 10);
      expect(status.canAct).toBe(true);
    });
  });

  describe('DELIVERING stage', () => {
    it('returns DELIVERING with time remaining when timer not elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 3000, 100);
      expect(status.effectiveStage).toBe('DELIVERING');
      expect(status.timeRemaining).toBe(3000);
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBeNull();
    });

    it('returns READY_TO_LIST when timer exactly elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 6000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Sell');
    });

    it('returns READY_TO_LIST when timer overdue', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'DELIVERING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 99000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
    });
  });

  describe('SELLING stage', () => {
    it('returns SELLING with time remaining when timer not elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 5000, 100);
      expect(status.effectiveStage).toBe('SELLING');
      expect(status.timeRemaining).toBe(6000);
      expect(status.canAct).toBe(false);
      expect(status.actionLabel).toBeNull();
    });

    it('returns READY_TO_COLLECT when timer exactly elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 11000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.timeRemaining).toBe(0);
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Collect ($25)');
    });

    it('returns READY_TO_COLLECT when timer overdue', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 1000 };
      const status = getProductionStatus(prod, coffeeConfig, 99000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.canAct).toBe(true);
    });

    it('SELLING: uses sellDurationOverride instead of typeConfig.sellDuration', () => {
      // At t=12000, default sellDuration=10000 would be done, but override=15000 means still selling
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 12_000, 0, 15_000);
      expect(status.effectiveStage).toBe('SELLING');
      expect(status.timeRemaining).toBeGreaterThan(0);
    });

    it('SELLING: completes when override duration has elapsed', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 15_001, 0, 15_000);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
    });

    it('SELLING: default behavior unchanged when no override given', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'SELLING', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 10_001, 0);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
    });
  });

  describe('stored READY_TO_LIST / READY_TO_COLLECT stages', () => {
    it('handles stored READY_TO_LIST', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'READY_TO_LIST', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('READY_TO_LIST');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Sell');
    });

    it('handles stored READY_TO_COLLECT', () => {
      const prod: Production = { typeId: 'coffee_shop', stage: 'READY_TO_COLLECT', stageStartedAt: 0 };
      const status = getProductionStatus(prod, coffeeConfig, 1000, 100);
      expect(status.effectiveStage).toBe('READY_TO_COLLECT');
      expect(status.canAct).toBe(true);
      expect(status.actionLabel).toBe('Collect ($25)');
    });
  });
});
