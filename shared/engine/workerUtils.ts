import type { Worker } from '../types';

export const SPECIALIST_UPGRADE_COST = 10;

export type WorkerMood = 'good' | 'mid' | 'bad';

export function getWorkerMood(
  worker: Worker,
  floorType: string | null,
  slotTypeId: string | null,
): WorkerMood {
  if (floorType === null || slotTypeId === null) return 'bad';
  if (floorType !== worker.floorType) return 'bad';
  if (slotTypeId === worker.dreamJob) return 'good';
  return 'mid';
}

export function getRevenueMultiplier(
  worker: Worker,
  floorType: string,
  slotTypeId: string | null,
): number {
  const mood = getWorkerMood(worker, floorType, slotTypeId);
  switch (mood) {
    case 'good': return 2.0;
    case 'mid': return 1.3;
    case 'bad': return 1.0;
  }
}

export function getFloorDiscount(workers: Worker[], floorId: number): number {
  let totalLevel = 0;
  for (const w of workers) {
    if (w.assignedFloorId === floorId) totalLevel += w.level;
  }
  return totalLevel * 0.01;
}

export function getWorkerForSlot(
  workers: Worker[],
  floorId: number,
  slotIdx: number,
): Worker | undefined {
  return workers.find(
    (w) => w.assignedFloorId === floorId && w.assignedSlotIdx === slotIdx,
  );
}

export function getFloorSpecialistBonus(workers: Worker[], floorId: number): number {
  const count = workers.filter(
    (w) => w.assignedFloorId === floorId && w.isSpecialist,
  ).length;
  return count * 0.09;
}
