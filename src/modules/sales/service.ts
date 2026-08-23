import { ERROR_CODES } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { salesRepository, SalesRepository } from './repository';

export class SalesService {
  constructor(private repo: SalesRepository = salesRepository) {}

  async createDraft(data: {
    customerId: bigint;
    items: Array<{
      productId: bigint;
      quantity: number;
      unitPrice?: number;
      discountAmount?: number;
    }>;
    discountAmount: number;
    paidAmount: number;
    paymentMethod?: string;
    createdBy: bigint;
  }) {
    const saleNumber = await this.repo.generateSaleNumber();
    return this.repo.createDraft({ ...data, saleNumber });
  }

  async getSaleById(id: bigint) {
    const sale = await this.repo.findById(id);
    if (!sale) {
      throw new AppError('Sale not found', 404, ERROR_CODES.NOT_FOUND);
    }
    return sale;
  }

  async getAllSales(params: { page?: number; limit?: number; customerId?: bigint; saleStatus?: string; paymentStatus?: string }) {
    const { total, sales } = await this.repo.findAll(params);
    const limit = params.limit || 20;
    const page = params.page || 1;
    return {
      sales,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async finalizeSale(saleId: bigint, finalizedBy: bigint, idempotencyKey?: string) {
    return this.repo.finalizeSaleTransaction(saleId, finalizedBy, idempotencyKey);
  }

  async cancelSale(saleId: bigint, cancelledBy: bigint, cancelReason: string) {
    return this.repo.cancelSaleTransaction(saleId, cancelledBy, cancelReason);
  }
}

export const salesService = new SalesService();
