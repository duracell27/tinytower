import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';
import { VisitorSchema } from './visitor';

export const ToolsSchema = z.object({
  briks:  z.number().int().nonnegative(),
  glass:  z.number().int().nonnegative(),
  nails:  z.number().int().nonnegative(),
  screw:  z.number().int().nonnegative(),
  wood:   z.number().int().nonnegative(),
  cement: z.number().int().nonnegative(),
});

export const RequiredToolEntrySchema = z.object({
  tool: z.enum(['briks', 'glass', 'nails', 'screw', 'wood', 'cement']),
  count: z.number().int().positive(),
});

export const UnderConstructionSchema = z.object({
  floorId: z.number().int(),
  startedAt: z.number(),
  durationMs: z.number(),
  requiredTools: z.array(RequiredToolEntrySchema),
  selectedFloorType: z.string().nullable().default(null),
});

export const StatsSchema = z.object({
  totalBought:           z.number().int().nonnegative().default(0),
  totalListed:           z.number().int().nonnegative().default(0),
  totalCollected:        z.number().int().nonnegative().default(0),
  totalPassengersLifted: z.number().int().nonnegative().default(0),
});

export const TokensSchema = z.object({
  green:  z.number().int().nonnegative().default(0),
  blue:   z.number().int().nonnegative().default(0),
  yellow: z.number().int().nonnegative().default(0),
  purple: z.number().int().nonnegative().default(0),
  red:    z.number().int().nonnegative().default(0),
});

export const BusinessUpgradesSchema = z.object({
  green:  z.number().int().min(0).max(40).default(0),
  blue:   z.number().int().min(0).max(40).default(0),
  yellow: z.number().int().min(0).max(40).default(0),
  purple: z.number().int().min(0).max(40).default(0),
  red:    z.number().int().min(0).max(40).default(0),
});

export const VehiclesSchema = z.object({
  taxi:          z.number().int().min(0).max(10).default(0),
  forklift:      z.number().int().min(0).max(10).default(0),
  armored_truck: z.number().int().min(0).max(10).default(0),
  delivery_truck:z.number().int().min(0).max(10).default(0),
  bus:           z.number().int().min(0).max(10).default(0),
});

export const DailyTaskProgressSchema = z.object({
  visitorsLifted:   z.number().int().nonnegative().default(0),
  vipsLifted:       z.number().int().nonnegative().default(0),
  goodsBought:      z.number().int().nonnegative().default(0),
  residentsAdded:   z.number().int().nonnegative().default(0),
  gemsPurchased:    z.number().int().nonnegative().default(0),
  goodsCollected:   z.number().int().nonnegative().default(0),
  floorsBuilt:      z.number().int().nonnegative().default(0),
  residentsEvicted: z.number().int().nonnegative().default(0),
  goodsListed:      z.number().int().nonnegative().default(0),
});

export const DailyTasksSchema = z.object({
  progress:           DailyTaskProgressSchema.default({
    visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
    gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
  }),
  claimed:            z.array(z.string()).default([]),
  doubleRewardActive: z.boolean().default(false),
  dailyMaterialType:  z.enum(['briks', 'glass', 'nails', 'screw', 'wood', 'cement']).optional(),
});

export const TutorialProgressSchema = z.object({
  coinsCollected:    z.number().int().nonnegative().default(0),
  visitorsLifted:    z.number().int().nonnegative().default(0),
  workersHired:      z.number().int().nonnegative().default(0),
  floorsBuilt:       z.number().int().nonnegative().default(0),
  dailyTasksClaimed: z.number().int().nonnegative().default(0),
  elevatorUpgraded:  z.number().int().nonnegative().default(0),
  lobbyUpgraded:     z.number().int().nonnegative().default(0),
  floorUpgraded:     z.number().int().nonnegative().default(0),
  inviteSent:        z.number().int().nonnegative().default(0),
  businessUpgraded:  z.number().int().nonnegative().default(0),
});

export const TutorialTasksSchema = z.object({
  currentIndex: z.number().int().min(0).max(11).default(0),
  snapshot:     z.record(z.string(), z.number()).default({}),
  claimedFinal: z.boolean().default(false),
});

export const FloorStateSchema = z.object({
  id: z.number().int(),
  productions: z.array(ProductionSchema).min(1).max(3),
});

export const GameStateSchema = z.object({
  balance: z.number().nonnegative(),
  gems: z.number().int().nonnegative(),
  floors: z.array(FloorStateSchema).min(1),
  commandQueue: z.array(CommandSchema),
  workers: z.array(WorkerSchema),
  hotelCapacity: z.number().int().positive(),
  lobbyVisitors: z.array(VisitorSchema),
  lobbyCapacity: z.number().int().positive(),
  elevatorLevel: z.number().int().positive(),
  elevatorFloor: z.number().int().nonnegative(),
  dailyTips: z.number().nonnegative(),
  dailyGemsCollected: z.number().int().nonnegative(),
  dailyTipsStage1Claimed: z.boolean(),
  dailyTipsStage2Claimed: z.boolean(),
  lastDailyReset: z.number().nonnegative(),
  dailyFillLobbyUses: z.number().int().nonnegative().default(0),
  nextVisitorAt: z.number().nonnegative(),
  tools: ToolsSchema.default({ briks: 0, glass: 0, nails: 0, screw: 0, wood: 0, cement: 0 }),
  underConstruction: UnderConstructionSchema.array().default([]),
  openedFloorTypes: z.record(z.string(), z.string()).default({}),
  stats: StatsSchema.default({ totalBought: 0, totalListed: 0, totalCollected: 0, totalPassengersLifted: 0 }),
  coinBonusPercent: z.number().int().nonnegative().default(0),
  xpBonusPercent:   z.number().int().nonnegative().default(0),
  tokens:     TokensSchema.default({ green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }),
  businessUpgrades: BusinessUpgradesSchema.default({ green: 0, blue: 0, yellow: 0, purple: 0, red: 0 }),
  vehicles: VehiclesSchema.default({ taxi: 0, forklift: 0, armored_truck: 0, delivery_truck: 0, bus: 0 }),
  floorStars: z.record(z.string(), z.number().int().min(0).max(5)).default({}),
  warehouseLevel: z.number().int().nonnegative().default(0),
  dailyTasks: DailyTasksSchema.default({
    progress: {
      visitorsLifted: 0, vipsLifted: 0, goodsBought: 0, residentsAdded: 0,
      gemsPurchased: 0, goodsCollected: 0, floorsBuilt: 0, residentsEvicted: 0, goodsListed: 0,
    },
    claimed: [],
    doubleRewardActive: false,
  }),
  tutorialProgress: TutorialProgressSchema.default({
    coinsCollected: 0, visitorsLifted: 0, workersHired: 0, floorsBuilt: 0,
    dailyTasksClaimed: 0, elevatorUpgraded: 0, lobbyUpgraded: 0,
    floorUpgraded: 0, inviteSent: 0, businessUpgraded: 0,
  }),
  tutorialTasks: TutorialTasksSchema.default({ currentIndex: 0, snapshot: {}, claimedFinal: false }),
});
