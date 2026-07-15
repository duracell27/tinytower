import { gameConfig } from '../../shared/config/gameConfig';
import { getProductionStatus } from '../../shared/engine/productionStatus';
import { getFloorDiscount, getFloorSpecialistBonus, getRevenueMultiplier, getWorkerForSlot } from '../../shared/engine/workerUtils';
import type { Floor, Worker, Production } from '../../shared/types';

export type QuickActionMode = 'collect' | 'list' | 'buy' | 'hire';

export type FloorActionInfo =
  | { mode: 'collect'; totalCoins: number }
  | { mode: 'list'; count: number }
  | { mode: 'buy'; slotIdx: number; typeId: string; buyCost: number }
  | { mode: 'hire' };

function derivedStage(prod: Production, now: number): string {
  if (!prod.typeId) return 'EMPTY';
  const tc = gameConfig.productionTypes[prod.typeId];
  if (!tc) return 'EMPTY';
  return getProductionStatus(prod, tc, now, 0).effectiveStage;
}

function hasActiveDelivery(floor: Floor, now: number): boolean {
  return floor.productions.some((p) => {
    if (p.stage !== 'DELIVERING' || !p.typeId) return false;
    const tc = gameConfig.productionTypes[p.typeId];
    return tc ? (now - p.stageStartedAt) < tc.deliveryDuration : false;
  });
}

export function getAvailableMode(
  floors: Floor[],
  workers: Worker[],
  now: number,
): QuickActionMode | null {
  let hasList = false;
  let hasBuy = false;
  let hasHire = false;

  for (const floor of floors) {
    for (let slotIdx = 0; slotIdx < floor.productions.length; slotIdx++) {
      const prod = floor.productions[slotIdx];
      const stage = derivedStage(prod, now);

      if (stage === 'READY_TO_COLLECT') return 'collect';
      if (stage === 'READY_TO_LIST') hasList = true;
      if (prod.stage === 'IDLE' && prod.typeId !== null && !hasActiveDelivery(floor, now) && !!getWorkerForSlot(workers, floor.id, slotIdx)) hasBuy = true;
      if (prod.typeId !== null && !getWorkerForSlot(workers, floor.id, slotIdx)) hasHire = true;
    }
  }

  if (hasList) return 'list';
  if (hasBuy) return 'buy';
  if (hasHire) return 'hire';
  return null;
}

export function getFloorsForMode(
  mode: QuickActionMode,
  floors: Floor[],
  workers: Worker[],
  now: number,
): Floor[] {
  return [...floors]
    .sort((a, b) => b.id - a.id)
    .filter((floor) =>
      floor.productions.some((prod, slotIdx) => {
        switch (mode) {
          case 'collect': return derivedStage(prod, now) === 'READY_TO_COLLECT';
          case 'list':    return derivedStage(prod, now) === 'READY_TO_LIST';
          case 'buy':     return prod.stage === 'IDLE' && prod.typeId !== null && !hasActiveDelivery(floor, now) && !!getWorkerForSlot(workers, floor.id, slotIdx);
          case 'hire':    return prod.typeId !== null && !getWorkerForSlot(workers, floor.id, slotIdx);
        }
      }),
    );
}

export function getFloorActionInfo(
  mode: QuickActionMode,
  floor: Floor,
  now: number,
  workers: Worker[],
  coinBonusPercent = 0,
  openedFloorTypes: Record<string, string> = {},
): FloorActionInfo | null {
  switch (mode) {
    case 'collect': {
      const specialistBonusPercent = Math.round(getFloorSpecialistBonus(workers, floor.id) * 100);
      const coinMultiplier = 1 + (coinBonusPercent + specialistBonusPercent) / 100;
      const staticFloorType = gameConfig.floors.find((f) => f.id === floor.id)?.floorType;
      const floorType = staticFloorType ?? openedFloorTypes[String(floor.id)] ?? '';
      const totalCoins = floor.productions.reduce((sum, prod, slotIdx) => {
        if (!prod.typeId) return sum;
        const tc = gameConfig.productionTypes[prod.typeId];
        if (!tc) return sum;
        if (derivedStage(prod, now) !== 'READY_TO_COLLECT') return sum;
        const worker = getWorkerForSlot(workers, floor.id, slotIdx);
        const workerMultiplier = worker ? getRevenueMultiplier(worker, floorType, prod.typeId) : 1;
        return sum + Math.floor(tc.batchValue * coinMultiplier * workerMultiplier);
      }, 0);
      return totalCoins > 0 ? { mode: 'collect', totalCoins } : null;
    }

    case 'list': {
      const count = floor.productions.filter(
        (prod) => prod.typeId !== null && derivedStage(prod, now) === 'READY_TO_LIST',
      ).length;
      return count > 0 ? { mode: 'list', count } : null;
    }

    case 'buy': {
      for (let slotIdx = floor.productions.length - 1; slotIdx >= 0; slotIdx--) {
        const prod = floor.productions[slotIdx];
        if (prod.stage === 'IDLE' && prod.typeId !== null && !!getWorkerForSlot(workers, floor.id, slotIdx)) {
          const tc = gameConfig.productionTypes[prod.typeId];
          if (!tc) continue;
          const discount = getFloorDiscount(workers, floor.id);
          const buyCost = Math.floor(tc.buyCost * (1 - discount));
          return { mode: 'buy', slotIdx, typeId: prod.typeId, buyCost };
        }
      }
      return null;
    }

    case 'hire':
      return { mode: 'hire' };
  }
}
