import { z } from 'zod';

export const ConvertSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  playerName: z.string().min(1).max(30),
});

export type ConvertDto = z.infer<typeof ConvertSchema>;
