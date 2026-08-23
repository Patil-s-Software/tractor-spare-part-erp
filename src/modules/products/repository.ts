import { prisma } from '../../database';
import { MOVEMENT_TYPES } from '../../constants';

export class ProductRepository {
  async generateProductCode(): Promise<string> {
    const count = await prisma.product.count();
    return `PRD-${(count + 1).toString().padStart(6, '0')}`;
  }

  async findByPartNumber(partNumber: string) {
    return prisma.product.findUnique({ where: { partNumber } });
  }

  async findById(id: bigint) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, shortCode: true } },
        inventory: { select: { currentStock: true, lastMovementAt: true } },
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: bigint;
    companyId?: bigint;
    status?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { partNumber: { contains: params.search } },
        { productCode: { contains: params.search } },
      ];
    }
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.companyId) where.companyId = params.companyId;
    if (params.status) where.status = params.status;

    if (params.outOfStock) {
      where.inventory = { currentStock: 0 };
    } else if (params.lowStock) {
      where.inventory = {
        currentStock: { lte: prisma.product.fields.minimumStock },
      };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortCode: true } },
          inventory: { select: { currentStock: true } },
        },
      }),
    ]);

    return { total, products };
  }

  async createProductWithInventory(data: {
    productCode: string;
    name: string;
    partNumber: string;
    companyId: bigint;
    categoryId: bigint;
    unitId: bigint;
    description?: string;
    purchasePrice: number;
    sellingPrice: number;
    gstPercent: number;
    minimumStock: number;
    maximumStock?: number;
    initialStock: number;
    createdBy: bigint;
  }) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          productCode: data.productCode,
          name: data.name,
          partNumber: data.partNumber,
          companyId: data.companyId,
          categoryId: data.categoryId,
          unitId: data.unitId,
          description: data.description,
          purchasePrice: data.purchasePrice,
          sellingPrice: data.sellingPrice,
          gstPercent: data.gstPercent,
          minimumStock: data.minimumStock,
          maximumStock: data.maximumStock,
          createdBy: data.createdBy,
        },
      });

      const inventory = await tx.inventory.create({
        data: {
          productId: product.id,
          currentStock: data.initialStock,
          lastMovementAt: data.initialStock > 0 ? new Date() : null,
        },
      });

      if (data.initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            movementType: MOVEMENT_TYPES.OPENING_STOCK,
            quantityChange: data.initialStock,
            stockBefore: 0,
            stockAfter: data.initialStock,
            remarks: 'Initial opening stock at product creation',
            createdBy: data.createdBy,
          },
        });
      }

      return { ...product, currentStock: inventory.currentStock };
    });
  }

  async updateCatalog(id: bigint, data: any) {
    return prisma.product.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: {
        inventory: { select: { currentStock: true } },
      },
    });
  }

  async updateStatus(id: bigint, status: string) {
    return prisma.product.update({
      where: { id },
      data: { status, updatedAt: new Date() },
    });
  }
}

export const productRepository = new ProductRepository();
