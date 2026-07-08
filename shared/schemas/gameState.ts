import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';
import { VisitorSchema } from './visitor';

export const ToolsSchema = z.object({
  briks: z.number().int().nonnegative(),
  glass: z.number().int().nonnegative(),
  nails: z.number().int().nonnegative(),
  screw: z.number().int().nonnegative(),
});

export const RequiredToolEntrySchema = z.object({
  tool: z.enum(['briks', 'glass', 'nails', 'screw']),
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
  totalBought: z.number().int().nonnegative().default(0),
  totalListed: z.number().int().nonnegative().default(0),
  totalSold:   z.number().int().nonnegative().default(0),
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
  dailyTipsRewardClaimed: z.boolean(),
  lastDailyReset: z.number().nonnegative(),
  nextVisitorAt: z.number().nonnegative(),
  tools: ToolsSchema.default({ briks: 0, glass: 0, nails: 0, screw: 0 }),
  underConstruction: UnderConstructionSchema.array().default([]),
  openedFloorTypes: z.record(z.string(), z.string()).default({}),
  stats: StatsSchema.default({ totalBought: 0, totalListed: 0, totalSold: 0 }),
});
