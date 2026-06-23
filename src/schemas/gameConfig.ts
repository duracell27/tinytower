import { z } from 'zod';

export const ProductionTypeConfigSchema = z.object({
  buyCost: z.number().positive(),
  deliveryDuration: z.number().positive(),
  sellDuration: z.number().positive(),
  batchValue: z.number().positive(),
});

export const FloorConfigSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slots: z.number().int().min(1).max(3),
  availableTypes: z.array(z.string()).min(1),
});

export const GameConfigSchema = z.object({
  floors: z.array(FloorConfigSchema).min(1),
  productionTypes: z.record(z.string(), ProductionTypeConfigSchema),
  startingBalance: z.number().nonnegative(),
});
