import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { inventoryService, InventoryService } from './service';

export class InventoryController {
  constructor(private service: InventoryService = inventoryService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = req.query.q as string;
      const lowStockOnly = req.query.lowStock === 'true';

      const { items, meta } = await this.service.getInventoryList({ page, limit, search, lowStockOnly });
      return sendSuccess(res, 'Inventory list retrieved', items, meta);
    } catch (error) {
      next(error);
    }
  };

  getByProductId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = BigInt(req.params.productId);
      const inv = await this.service.getStockByProductId(productId);
      return sendSuccess(res, 'Product stock detail retrieved', inv);
    } catch (error) {
      next(error);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = BigInt(req.user!.id);
      const result = await this.service.adjustStock({
        ...req.body,
        createdBy,
      });
      return sendSuccess(res, 'Stock adjusted successfully', result);
    } catch (error) {
      next(error);
    }
  };

  getMovements = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const productId = req.query.productId ? BigInt(req.query.productId as string) : undefined;
      const movementType = req.query.movementType as string;

      const { movements, meta } = await this.service.getMovementsHistory({ page, limit, productId, movementType });
      return sendSuccess(res, 'Stock movement history retrieved', movements, meta);
    } catch (error) {
      next(error);
    }
  };
}

export const inventoryController = new InventoryController();
