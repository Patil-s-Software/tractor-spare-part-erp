import { z } from 'zod';

export const createUnitSchema = z.object({
  name: z.string().min(1, 'Unit name is required'),
  shortCode: z.string().optional(),
});
