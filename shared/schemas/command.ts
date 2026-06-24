import { z } from 'zod';

const ProductionBaseSchema = z.object({
  id: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const BuyCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('buy'),
  typeId: z.string(),
});

export const ListCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('list'),
});

export const CollectCommandSchema = ProductionBaseSchema.extend({
  type: z.literal('collect'),
});

export const AssignWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('assign_worker'),
  workerId: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const FireWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('fire_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const EvictWorkerCommandSchema = z.object({
  id: z.string(),
  type: z.literal('evict_worker'),
  workerId: z.string(),
  timestamp: z.number(),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
  AssignWorkerCommandSchema,
  FireWorkerCommandSchema,
  EvictWorkerCommandSchema,
]);
