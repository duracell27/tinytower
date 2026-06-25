import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';
import { VisitorSchema } from './visitor';

export const FloorStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
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
});
