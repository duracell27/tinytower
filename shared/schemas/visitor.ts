import { z } from 'zod';

export const VisitorRoleSchema = z.enum(['guest', 'businessman', 'deliverer', 'seller', 'builder']);

export const VisitorSchema = z.object({
  id: z.string(),
  role: VisitorRoleSchema.optional(),
  isVip: z.boolean().optional(),
  targetFloor: z.number().int().positive().optional(),
  hairColor: z.string().optional(),
  female: z.boolean().optional(),
  pendingFloorType: z.string().optional(),
});
