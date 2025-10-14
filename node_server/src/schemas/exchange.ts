import { z } from 'zod';

export const SystemResponseSchema = z.object({
  answer: z.string(),
  citation: z.object({
    files: z.array(z.string()),
    fileNames: z.array(z.string()),
    fileInfos: z.array(z.record(z.string(), z.any())).optional(),
  }),
});

export type SystemResponse = z.infer<typeof SystemResponseSchema>;