import { z } from 'zod';

const BaseCommandSchema = z.object({
  id: z.string(),
  floorId: z.number().int(),
  slotIdx: z.number().int(),
  timestamp: z.number(),
});

export const BuyCommandSchema = BaseCommandSchema.extend({
  type: z.literal('buy'),
  typeId: z.string(),
});

export const ListCommandSchema = BaseCommandSchema.extend({
  type: z.literal('list'),
});

export const CollectCommandSchema = BaseCommandSchema.extend({
  type: z.literal('collect'),
});

export const CommandSchema = z.discriminatedUnion('type', [
  BuyCommandSchema,
  ListCommandSchema,
  CollectCommandSchema,
]);
