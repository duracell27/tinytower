import type { Vehicles } from '../types';

export type VehicleType = keyof Vehicles;

export interface VehicleDefinition {
  key: VehicleType;
  name: string;
  description: string;
  shortDescription: string;
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
      'Each taxi adds +1 free {gem} exchange per day and gives +1,000 {xp} for each elevator visitor.',
    shortDescription: 'More gem exchanges & XP per lobby visitor',
    gemCost: 1_000,
    accentColor: '#22C55E',
    bonus1Label: (n) => `+${n} gem exchange limit`,
    bonus2Label: (n) => `+${(n * 1_000).toLocaleString()} XP/visitor`,
  },
  forklift: {
    key: 'forklift',
    name: 'Forklift',
    description:
      'Each forklift {speed} speeds up sales by 1% and gives +5,000 {xp} per listed product.',
    shortDescription: 'Faster sales & bonus XP per listing',
    gemCost: 1_000,
    accentColor: '#3B82F6',
    bonus1Label: (n) => `-${n}% sell time`,
    bonus2Label: (n) => `+${(n * 5_000).toLocaleString()} XP/sell`,
  },
  armored_truck: {
    key: 'armored_truck',
    name: 'Armored Truck',
    description:
      'Each armored truck boosts base {coin} profit by 5% and base {xp} by 10%. These bonuses apply before all other multipliers.',
    shortDescription: 'Boosts base profit & XP before all multipliers',
    gemCost: 2_500,
    accentColor: '#EAB308',
    bonus1Label: (n) => `+${n * 5}% base profit`,
    bonus2Label: (n) => `+${n * 10}% base XP`,
  },
  delivery_truck: {
    key: 'delivery_truck',
    name: 'Delivery Truck',
    description:
      'Each truck {speed} speeds up delivery by 1% and gives +5,000 {xp} per purchased product.',
    shortDescription: 'Faster deliveries & bonus XP per purchase',
    gemCost: 1_000,
    accentColor: '#3376E5',
    bonus1Label: (n) => `-${n}% delivery time`,
    bonus2Label: (n) => `+${(n * 5_000).toLocaleString()} XP/buy`,
  },
  bus: {
    key: 'bus',
    name: 'Bus',
    description:
      'Each bus adds 5 {visitor} slots to the elevator and boosts {coin} tips by 5%.',
    shortDescription: 'More elevator visitors & higher tips',
    gemCost: 1_000,
    accentColor: '#8B5CF6',
    bonus1Label: (n) => `+${n * 5} visitor slots`,
    bonus2Label: (n) => `+${n * 5}% tips`,
  },
};
