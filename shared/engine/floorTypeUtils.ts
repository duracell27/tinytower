import type { GameConfig } from '../types';

export function getExhaustedFloorTypes(
  ucFloorId: number,
  floors: { id: number }[],
  openedFloorTypes: Record<string, string>,
  underConstruction: { floorId: number; selectedFloorType: string | null }[],
  config: Pick<GameConfig, 'floors' | 'floorTypes'>,
): Set<string> {
  const exhausted = new Set<string>();
  for (const [ft, ftConfig] of Object.entries(config.floorTypes)) {
    const staticCount = config.floors
      .filter((f) => f.floorType === ft && floors.some((sf) => sf.id === f.id))
      .length;
    const openedCount = Object.values(openedFloorTypes)
      .filter((t) => t === ft).length;
    const pendingCount = underConstruction
      .filter((u) => u.floorId !== ucFloorId && u.selectedFloorType === ft)
      .length;
    if (staticCount + openedCount + pendingCount >= ftConfig.businesses.length) {
      exhausted.add(ft);
    }
  }
  return exhausted;
}
