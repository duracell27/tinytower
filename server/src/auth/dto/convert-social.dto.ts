import { z } from 'zod';

export const ConvertSocialSchema = z.object({
  idToken: z.string().min(1),
  fullName: z.object({
    givenName: z.string().optional(),
    familyName: z.string().optional(),
  }).optional(),
  overwrite: z.boolean().optional().default(false),
});

export type ConvertSocialDto = z.infer<typeof ConvertSocialSchema>;
