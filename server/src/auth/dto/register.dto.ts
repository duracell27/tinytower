import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  playerName: z.string().min(1).max(30),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
