import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { productService, ProductService } from './service';

export class ProductController {
  constructor(private service: ProductService = productService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = BigInt(req.user!.id);
      const product = await this.service.createProduct({
        ...req.body,
        createdBy,
      });
      return sendSuccess(res, 'Product created successfully', product, null, 201);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const product = await this.service.getProductById(id);
      return sendSuccess(res, 'Product details retrieved', product);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = req.query.q as string;
      const categoryId = req.query.categoryId ? BigInt(req.query.categoryId as string) : undefined;
      const companyId = req.query.companyId ? BigInt(req.query.companyId as string) : undefined;
      const status = req.query.status as string;
      const lowStock = req.query.lowStock === 'true';
      const outOfStock = req.query.outOfStock === 'true';

      const { products, meta } = await this.service.getAllProducts({
        page,
        limit,
        search,
        categoryId,
        companyId,
        status,
        lowStock,
        outOfStock,
      });

      return sendSuccess(res, 'Products list retrieved', products, meta);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const updated = await this.service.updateProductCatalog(id, req.body);
      return sendSuccess(res, 'Product catalog updated successfully', updated);
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const updated = await this.service.updateProductStatus(id, req.body.status);
      return sendSuccess(res, 'Product status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  };
}

export const productController = new ProductController();
