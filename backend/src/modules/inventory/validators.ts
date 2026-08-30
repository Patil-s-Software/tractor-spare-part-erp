import { z } from 'zod';
import { MOVEMENT_TYPES } from '../../constants';

export const adjustStockSchema = z.object({
  productId: z.string().transform((val) => BigInt(val)),
  movementType: z.enum([
    MOVEMENT_TYPES.PURCHASE_IN,
    MOVEMENT_TYPES.ADJUSTMENT_IN,
    MOVEMENT_TYPES.ADJUSTMENT_OUT,
    MOVEMENT_TYPES.DAMAGE_OUT,
  ]),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  remarks: z.string().min(1, 'Remarks / reason required for inventory adjustment'),
});
