import { prisma } from '../../database';
import { ERROR_CODES, MOVEMENT_TYPES } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';

export class InventoryRepository {
  async findAll(params: { page?: number; limit?: number; search?: string; lowStockOnly?: boolean }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.search) {
      where.product = {
        OR: [
          { name: { contains: params.search } },
          { partNumber: { contains: params.search } },
          { productCode: { contains: params.search } },
        ],
      };
    }

    const [total, items] = await Promise.all([
      prisma.inventory.count({ where }),
      prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              productCode: true,
              name: true,
              partNumber: true,
              minimumStock: true,
              unit: { select: { shortCode: true } },
            },
          },
        },
      }),
    ]);

    const formatted = items.map((inv) => ({
      id: inv.id.toString(),
      productId: inv.productId.toString(),
      productName: inv.product.name,
      productCode: inv.product.productCode,
      partNumber: inv.product.partNumber,
      unit: inv.product.unit.shortCode,
      currentStock: inv.currentStock,
      minimumStock: inv.product.minimumStock,
      isLowStock: inv.currentStock <= inv.product.minimumStock,
      lastMovementAt: inv.lastMovementAt,
    }));

    return { total, items: formatted };
  }

  async findByProductId(productId: bigint) {
    return prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: {
          select: {
            id: true,
            productCode: true,
            name: true,
            partNumber: true,
            minimumStock: true,
          },
        },
      },
    });
  }

  /**
   * Core Atomic Stock Movement Function
   * Locks target inventory row (`SELECT ... FOR UPDATE`), checks non-negative constraint,
   * inserts inventory_movements record, and updates current_stock in 1 transaction.
   */
  async applyStockMovement(
    tx: any,
    data: {
      productId: bigint;
      movementType: string;
      quantity: number; // raw positive number
      referenceType?: string;
      referenceId?: bigint;
      remarks?: string;
      createdBy: bigint;
    }
  ) {
    // 1. Determine direction: negative for OUT, positive for IN
    const isOut = [
      MOVEMENT_TYPES.SALE_OUT,
      MOVEMENT_TYPES.ADJUSTMENT_OUT,
      MOVEMENT_TYPES.DAMAGE_OUT,
    ].includes(data.movementType as any);

    const quantityChange = isOut ? -Math.abs(data.quantity) : Math.abs(data.quantity);

    // 2. Lock inventory row for update
    const rawInv: any[] = await tx.$queryRaw`
      SELECT id, current_stock FROM inventory WHERE product_id = ${data.productId} FOR UPDATE
    `;

    if (!rawInv || rawInv.length === 0) {
      throw new AppError(`Inventory record not found for product ID ${data.productId}`, 404, ERROR_CODES.NOT_FOUND);
    }

    const currentStock = Number(rawInv[0].current_stock);
    const newStock = currentStock + quantityChange;

    if (newStock < 0) {
      throw new AppError(
        `Insufficient stock for product ID ${data.productId}. Requested: ${Math.abs(quantityChange)}, Available: ${currentStock}`,
        400,
        ERROR_CODES.INSUFFICIENT_STOCK
      );
    }

    // 3. Update inventory current_stock
    await tx.inventory.update({
      where: { productId: data.productId },
      data: {
        currentStock: newStock,
        lastMovementAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // 4. Insert inventory movement log
    const movement = await tx.inventoryMovement.create({
      data: {
        productId: data.productId,
        movementType: data.movementType,
        quantityChange,
        stockBefore: currentStock,
        stockAfter: newStock,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        remarks: data.remarks,
        createdBy: data.createdBy,
      },
    });

    return { movement, stockBefore: currentStock, stockAfter: newStock };
  }

  async findMovements(params: {
    page?: number;
    limit?: number;
    productId?: bigint;
    movementType?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.productId) where.productId = params.productId;
    if (params.movementType) where.movementType = params.movementType;

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where }),
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, partNumber: true } },
          creator: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { total, movements };
  }
}

export const inventoryRepository = new InventoryRepository();
