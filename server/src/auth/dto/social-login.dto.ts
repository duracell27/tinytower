import { z } from 'zod';

export const SocialLoginSchema = z.object({
  idToken: z.string().min(1),
  fullName: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  }).optional(),
});

export type SocialLoginDto = z.infer<typeof SocialLoginSchema>;
