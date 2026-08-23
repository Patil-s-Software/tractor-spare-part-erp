import { z } from 'zod';
import { STATUS } from '../../constants';

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required'),
  parentCategoryId: z.string().optional().transform((val) => (val ? BigInt(val) : undefined)),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2, 'Category name is required').optional(),
  parentCategoryId: z.string().optional().nullable().transform((val) => (val ? BigInt(val) : null)),
  status: z.enum([STATUS.ACTIVE, STATUS.INACTIVE]).optional(),
});
