import type { Production, ProductionTypeConfig, DerivedStatus } from '../types';

export function getProductionStatus(
  production: Production,
  typeConfig: ProductionTypeConfig | null,
  now: number,
  balance: number,
): DerivedStatus {
  if (!production.typeId || !typeConfig) {
    return { effectiveStage: 'EMPTY', timeRemaining: 0, canAct: true, actionLabel: null };
  }

  switch (production.stage) {
    case 'IDLE':
      return {
        effectiveStage: 'IDLE',
        timeRemaining: 0,
        canAct: balance >= typeConfig.buyCost,
        actionLabel: `Buy ($${typeConfig.buyCost})`,
      };

    case 'DELIVERING': {
      const remaining = Math.max(0, typeConfig.deliveryDuration - (now - production.stageStartedAt));
      if (remaining <= 0) {
        return { effectiveStage: 'READY_TO_LIST', timeRemaining: 0, canAct: true, actionLabel: 'List' };
      }
      return { effectiveStage: 'DELIVERING', timeRemaining: remaining, canAct: false, actionLabel: null };
    }

    case 'READY_TO_LIST':
      return { effectiveStage: 'READY_TO_LIST', timeRemaining: 0, canAct: true, actionLabel: 'List' };

    case 'SELLING': {
      const remaining = Math.max(0, typeConfig.sellDuration - (now - production.stageStartedAt));
      if (remaining <= 0) {
        return {
          effectiveStage: 'READY_TO_COLLECT',
          timeRemaining: 0,
          canAct: true,
          actionLabel: `Collect ($${typeConfig.batchValue})`,
        };
      }
      return { effectiveStage: 'SELLING', timeRemaining: remaining, canAct: false, actionLabel: null };
    }

    case 'READY_TO_COLLECT':
      return {
        effectiveStage: 'READY_TO_COLLECT',
        timeRemaining: 0,
        canAct: true,
        actionLabel: `Collect ($${typeConfig.batchValue})`,
      };
  }
}
