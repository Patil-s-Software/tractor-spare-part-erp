import { z } from 'zod';
import { STATUS } from '../../constants';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  partNumber: z.string().min(1, 'Part number is required'),
  companyId: z.string().transform((val) => BigInt(val)),
  categoryId: z.string().transform((val) => BigInt(val)),
  unitId: z.string().transform((val) => BigInt(val)),
  description: z.string().optional(),
  purchasePrice: z.number().min(0, 'Purchase price must be >= 0'),
  sellingPrice: z.number().min(0, 'Selling price must be >= 0'),
  gstPercent: z.number().min(0, 'GST percent must be >= 0').default(0),
  minimumStock: z.number().int().min(0).default(0),
  maximumStock: z.number().int().optional(),
  initialStock: z.number().int().min(0).optional().default(0),
});

// Update schema explicitly excludes initialStock and currentStock
export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  partNumber: z.string().min(1).optional(),
  companyId: z.string().optional().transform((val) => (val ? BigInt(val) : undefined)),
  categoryId: z.string().optional().transform((val) => (val ? BigInt(val) : undefined)),
  unitId: z.string().optional().transform((val) => (val ? BigInt(val) : undefined)),
  description: z.string().optional(),
  purchasePrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  gstPercent: z.number().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  maximumStock: z.number().int().optional(),
});

export const updateProductStatusSchema = z.object({
  status: z.enum([STATUS.ACTIVE, STATUS.INACTIVE]),
});
