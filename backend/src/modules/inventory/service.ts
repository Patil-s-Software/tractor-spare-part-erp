import { prisma } from '../../database';
import { inventoryRepository, InventoryRepository } from './repository';

export class InventoryService {
  constructor(private repo: InventoryRepository = inventoryRepository) {}

  async getInventoryList(params: { page?: number; limit?: number; search?: string; lowStockOnly?: boolean }) {
    const { total, items } = await this.repo.findAll(params);
    const limit = params.limit || 20;
    const page = params.page || 1;
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStockByProductId(productId: bigint) {
    return this.repo.findByProductId(productId);
  }

  async adjustStock(data: {
    productId: bigint;
    movementType: string;
    quantity: number;
    remarks: string;
    createdBy: bigint;
  }) {
    return prisma.$transaction(async (tx) => {
      return this.repo.applyStockMovement(tx, data);
    });
  }

  async getMovementsHistory(params: { page?: number; limit?: number; productId?: bigint; movementType?: string }) {
    const { total, movements } = await this.repo.findMovements(params);
    const limit = params.limit || 20;
    const page = params.page || 1;
    return {
      movements,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}

export const inventoryService = new InventoryService();
