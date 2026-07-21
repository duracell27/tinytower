import { gameConfig } from '../../shared/config/gameConfig';
import type { Worker, Floor } from '../../shared/types';

export function isBetterCandidate(
  hotelWorker: Worker,
  assignedWorkers: Worker[],
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
): boolean {
  for (const floor of floors) {
    const floorType =
      openedFloorTypes[String(floor.id)] ??
      gameConfig.floors.find((f) => f.id === floor.id)?.floorType;
    if (!floorType) continue;

    for (let slotIdx = 0; slotIdx < floor.productions.length; slotIdx++) {
      if (floor.productions[slotIdx].typeId !== hotelWorker.dreamJob) continue;

      const assigned = assignedWorkers.find(
        (w) => w.assignedFloorId === floor.id && w.assignedSlotIdx === slotIdx,
      );
      if (!assigned) return true;

      const hotelMatchesFloor = hotelWorker.floorType === floorType;
      const assignedMatchesFloor = assigned.floorType === floorType;
      if (hotelMatchesFloor && !assignedMatchesFloor) return true;
      if (hotelMatchesFloor && assignedMatchesFloor && hotelWorker.level > assigned.level) return true;
    }
  }
  return false;
}

export function hasAnyBetterCandidate(
  workers: Worker[],
  floors: Floor[],
  openedFloorTypes: Record<string, string>,
): boolean {
  const unemployed = workers.filter((w) => w.assignedFloorId === null);
  const assigned = workers.filter((w) => w.assignedFloorId !== null);
  return unemployed.some((w) => isBetterCandidate(w, assigned, floors, openedFloorTypes));
}
