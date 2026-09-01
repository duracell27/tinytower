import type { Vehicles } from '../types';

export type VehicleType = keyof Vehicles;

export interface VehicleDefinition {
  key: VehicleType;
  name: string;
  description: string;
  gemCost: number;
  accentColor: string;
  bonus1Label: (count: number) => string;
  bonus2Label: (count: number) => string;
}

export const VEHICLE_TYPES: VehicleType[] = [
  'taxi', 'forklift', 'armored_truck', 'delivery_truck', 'bus',
];

export const VEHICLE_CONFIG: Record<VehicleType, VehicleDefinition> = {
  taxi: {
    key: 'taxi',
    name: 'Taxi',
    description:
      'Each taxi increases the number of free gem exchanges in the elevator by 1 and gives +1,000 experience for each visitor.',
    gemCost: 1_000,
    accentColor: '#22C55E',
    bonus1Label: (n) => `+${n} 💎 exchange limit`,
    bonus2Label: (n) => `+${(n * 1_000).toLocaleString()} XP/visitor`,
  },
  forklift: {
    key: 'forklift',
    name: 'Forklift',
    description:
      'Each forklift speeds up sales of all goods by +1% and gives +5,000 extra experience for each product listed.',
    gemCost: 1_000,
    accentColor: '#3B82F6',
    bonus1Label: (n) => `-${n}% sell time`,
    bonus2Label: (n) => `+${(n * 5_000).toLocaleString()} XP/sell`,
  },
  armored_truck: {
    key: 'armored_truck',
    name: 'Armored Truck',
    description:
      'Each armored truck increases base production profit by +5% and base experience by +10%. These bonuses apply before all other multipliers.',
    gemCost: 2_500,
    accentColor: '#EAB308',
    bonus1Label: (n) => `+${n * 5}% base profit`,
    bonus2Label: (n) => `+${n * 10}% base XP`,
  },
  delivery_truck: {
    key: 'delivery_truck',
    name: 'Delivery Truck',
    description:
      'Each truck speeds up the delivery of all goods by +1% and gives +5,000 extra experience for each product you buy.',
    gemCost: 1_000,
    accentColor: '#3376E5',
    bonus1Label: (n) => `-${n}% delivery time`,
    bonus2Label: (n) => `+${(n * 5_000).toLocaleString()} XP/buy`,
  },
  bus: {
    key: 'bus',
    name: 'Bus',
    description:
      'Each bus increases the number of visitors in the elevator by 5 and increases tips by +5%.',
    gemCost: 1_000,
    accentColor: '#8B5CF6',
    bonus1Label: (n) => `+${n * 5} visitor slots`,
    bonus2Label: (n) => `+${n * 5}% tips`,
  },
};
