import type { Floor, Worker, GameConfig } from '../types';
import { getWorkerForSlot, getRevenueMultiplier, getFloorSpecialistBonus } from './workerUtils';

export function calcRevenuePerMin(
  floors: Floor[],
  workers: Worker[],
  openedFloorTypes: Record<string, string>,
  config: GameConfig,
): number {
  let total = 0;
  for (const floor of floors) {
    const floorConfig = config.floors.find((f) => f.id === floor.id);
    const floorType = floorConfig?.floorType ?? openedFloorTypes[String(floor.id)] ?? null;
    const specialistBonus = getFloorSpecialistBonus(workers, floor.id);

    floor.productions.forEach((production, slotIdx) => {
      if (production.stage !== 'SELLING' || !production.typeId) return;
      const typeConfig = config.productionTypes[production.typeId];
      if (!typeConfig) return;

      const worker = getWorkerForSlot(workers, floor.id, slotIdx);
      const multiplier = worker && floorType
        ? getRevenueMultiplier(worker, floorType, production.typeId)
        : 1;

      const effectiveRevenue = Math.floor(typeConfig.batchValue * multiplier * (1 + specialistBonus));
      const sellDurationMinutes = typeConfig.sellDuration / 60_000;
      total += Math.floor(effectiveRevenue / sellDurationMinutes);
    });
  }
  return total;
}
