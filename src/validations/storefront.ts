import { z } from 'zod';

export const storefrontSessionSchema = z.object({
  publicKey: z.string().min(1).max(128).startsWith('pk_'),
});

export const storefrontTryOnSchema = z.object({
  photoKey: z.string().min(1).max(512),
  productImageUrl: z.string().url().max(2048),
  // 'single' = front view (1 credit); 'multi' = front + side + back (2 credits)
  views: z.enum(['single', 'multi']).default('single'),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Consent to process the photo is required' }),
  }),
});

export const storefrontStatusQuerySchema = z.object({
  jobId: z.string().uuid('jobId must be a valid id'),
});
