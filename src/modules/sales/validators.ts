import { z } from 'zod';

const saleItemInputSchema = z.object({
  productId: z.string().transform((val) => BigInt(val)),
  quantity: z.number().int().positive('Quantity must be > 0'),
  unitPrice: z.number().min(0, 'Unit price must be >= 0').optional(),
  discountAmount: z.number().min(0).default(0),
});

export const createDraftSaleSchema = z.object({
  customerId: z.string().transform((val) => BigInt(val)),
  items: z.array(saleItemInputSchema).min(1, 'At least 1 item is required'),
  discountAmount: z.number().min(0).default(0),
  paidAmount: z.number().min(0).default(0),
  paymentMethod: z.string().optional().default('CASH'),
});

export const updateDraftSaleSchema = createDraftSaleSchema.partial().extend({
  items: z.array(saleItemInputSchema).optional(),
});

export const cancelSaleSchema = z.object({
  cancelReason: z.string().min(3, 'Cancel reason required'),
});
