import { z } from 'zod';
import { STATUS } from '../../constants';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  roleId: z.number().int('Role ID must be an integer'),
});

export const updateUserStatusSchema = z.object({
  status: z.enum([STATUS.ACTIVE, STATUS.INACTIVE]),
});
