import { z } from 'zod';

const imageKeySchema = z.string().min(1).max(512);

export const createTryOnSchema = z.object({
  personImageKey: imageKeySchema,
  productImageKey: imageKeySchema,
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent to process the photo is required' }),
  }),
});

export const tryOnStatusQuerySchema = z.object({
  jobId: z.string().uuid('jobId must be a valid id'),
});

export type CreateTryOnInput = z.infer<typeof createTryOnSchema>;
