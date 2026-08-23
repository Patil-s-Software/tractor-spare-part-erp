import { z } from 'zod';
import { STATUS } from '../../constants';

export const createCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  mobile: z.string().min(10, 'Valid 10-digit mobile number required'),
  alternateMobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  openingBalance: z.number().optional().default(0),
  creditLimit: z.number().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum([STATUS.ACTIVE, STATUS.INACTIVE]).optional(),
});
