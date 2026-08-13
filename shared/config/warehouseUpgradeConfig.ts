export type WarehouseUpgradeCost =
  | { currency: 'coins'; amount: number }
  | { currency: 'gems';  amount: number };

// Index = target level (1–15). Index 0 is null (base level, no purchase).
export const WAREHOUSE_UPGRADE_COSTS: (WarehouseUpgradeCost | null)[] = [
  null,
  { currency: 'coins', amount: 20_000 },
  { currency: 'gems',  amount: 20 },
  { currency: 'coins', amount: 200_000 },
  { currency: 'gems',  amount: 50 },
  { currency: 'coins', amount: 2_000_000 },
  { currency: 'gems',  amount: 100 },
  { currency: 'coins', amount: 20_000_000 },
  { currency: 'gems',  amount: 250 },
  { currency: 'coins', amount: 100_000_000 },
  { currency: 'gems',  amount: 500 },
  { currency: 'coins', amount: 500_000_000 },
  { currency: 'gems',  amount: 1_000 },
  { currency: 'coins', amount: 1_500_000_000 },
  { currency: 'gems',  amount: 2_000 },
  { currency: 'coins', amount: 4_500_000_000 },
];

export const WAREHOUSE_BASE_CAPACITY = 30;
export const WAREHOUSE_CAPACITY_PER_LEVEL = 20;
export const WAREHOUSE_MAX_LEVEL = 15;

export function warehouseCapacity(level: number): number {
  return WAREHOUSE_BASE_CAPACITY + level * WAREHOUSE_CAPACITY_PER_LEVEL;
}
