import { z } from 'zod';

export const VisitorRoleSchema = z.enum(['guest', 'businessman', 'deliverer', 'seller']);

export const VisitorSchema = z.object({
  id: z.string(),
  role: VisitorRoleSchema,
  targetFloor: z.number().int().positive(),
  hairColor: z.string(),
  female: z.boolean(),
});
