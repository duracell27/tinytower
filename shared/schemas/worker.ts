import { z } from 'zod';

export const WorkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  female: z.boolean(),
  floorType: z.string(),
  dreamJob: z.string(),
  level: z.number().int().min(1).max(9),
  hairColor: z.string(),
  assignedFloorId: z.number().nullable(),
  assignedSlotIdx: z.number().nullable(),
  isSpecialist: z.boolean().default(false),
});
