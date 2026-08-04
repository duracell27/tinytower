import type { Floor, Worker, GameConfig } from '../types';
import { getWorkerForSlot, getRevenueMultiplier, getFloorSpecialistBonus } from './workerUtils';
import { FLOOR_STAR_MULTIPLIERS } from '../config/floorUpgradeConfig';

export function calcRevenuePerMin(
  floors: Floor[],
  workers: Worker[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
  now: number,
  businessUpgrades?: Record<string, number>,
  coinBonusPercent?: number,
  floorStars?: Record<string, number>,
): number {
  let total = 0;
  for (const floor of floors) {
    const floorConfig = config.floors.find((f) => f.id === floor.id);
    const floorType = floorConfig?.floorType ?? openedFloorTypes[String(floor.id)] ?? null;
    const specialistBonusPercent = Math.round(getFloorSpecialistBonus(workers, floor.id) * 100);
    const categoryBonus = floorType ? (businessUpgrades?.[floorType] ?? 0) * 5 : 0;
    const coinMultiplier = 1 + ((coinBonusPercent ?? 0) + specialistBonusPercent + categoryBonus) / 100;
    const stars = floorStars?.[String(floor.id)] ?? 0;
    const starMult = FLOOR_STAR_MULTIPLIERS[stars] ?? FLOOR_STAR_MULTIPLIERS[0];

    floor.productions.forEach((production, slotIdx) => {
      if (production.stage !== 'SELLING' || !production.typeId) return;
      const typeConfig = config.productionTypes[production.typeId];
      if (!typeConfig) return;
      const effectiveSellDuration = typeConfig.sellDuration * starMult.time;
      if (now - production.stageStartedAt >= effectiveSellDuration) return;

      const worker = getWorkerForSlot(workers, floor.id, slotIdx);
      const multiplier = worker && floorType
        ? getRevenueMultiplier(worker, floorType, production.typeId)
        : 1;

      const effectiveRevenue = Math.floor(typeConfig.batchValue * starMult.value * coinMultiplier * multiplier);
      const sellDurationMinutes = effectiveSellDuration / 60_000;
      total += Math.floor(effectiveRevenue / sellDurationMinutes);
    });
  }
  return total;
}
