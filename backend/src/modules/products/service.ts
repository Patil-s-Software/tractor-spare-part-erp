import { ERROR_CODES } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { productRepository, ProductRepository } from './repository';

export class ProductService {
  constructor(private repo: ProductRepository = productRepository) {}

  async createProduct(data: {
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
    const existing = await this.repo.findByPartNumber(data.partNumber);
    if (existing) {
      throw new AppError('Part number already exists', 409, ERROR_CODES.CONFLICT);
    }

    const productCode = await this.repo.generateProductCode();
    return this.repo.createProductWithInventory({
      ...data,
      productCode,
    });
  }

  async getProductById(id: bigint) {
    const product = await this.repo.findById(id);
    if (!product) {
      throw new AppError('Product not found', 404, ERROR_CODES.NOT_FOUND);
    }
    return product;
  }

  async getAllProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: bigint;
    companyId?: bigint;
    status?: string;
    lowStock?: boolean;
    outOfStock?: boolean;
  }) {
    const { total, products } = await this.repo.findAll(params);
    const limit = params.limit || 20;
    const page = params.page || 1;
    return {
      products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateProductCatalog(id: bigint, data: any) {
    await this.getProductById(id);
    return this.repo.updateCatalog(id, data);
  }

  async updateProductStatus(id: bigint, status: string) {
    await this.getProductById(id);
    return this.repo.updateStatus(id, status);
  }
}

export const productService = new ProductService();
