import { z } from 'zod';
import { STATUS } from '../../constants';

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Company name is required'),
});

export const updateCompanySchema = z.object({
  name: z.string().min(2, 'Company name is required').optional(),
  status: z.enum([STATUS.ACTIVE, STATUS.INACTIVE]).optional(),
});
