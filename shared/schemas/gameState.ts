import { z } from 'zod';
import { ProductionSchema } from './production';
import { CommandSchema } from './command';
import { WorkerSchema } from './worker';

export const FloorStateSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  productions: z.array(ProductionSchema).min(1).max(3),
});

export const GameStateSchema = z.object({
  balance: z.number().nonnegative(),
  floors: z.array(FloorStateSchema).min(1),
  commandQueue: z.array(CommandSchema),
  workers: z.array(WorkerSchema),
  hotelCapacity: z.number().int().positive(),
});
