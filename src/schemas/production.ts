import { z } from 'zod';

export const ProductionStageSchema = z.enum([
  'IDLE',
  'DELIVERING',
  'READY_TO_LIST',
  'SELLING',
  'READY_TO_COLLECT',
]);

export const ProductionSchema = z.object({
  typeId: z.string().nullable(),
  stage: ProductionStageSchema,
  stageStartedAt: z.number(),
});
