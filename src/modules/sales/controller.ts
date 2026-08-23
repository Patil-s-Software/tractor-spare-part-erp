import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { salesService, SalesService } from './service';

export class SalesController {
  constructor(private service: SalesService = salesService) {}

  createDraft = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = BigInt(req.user!.id);
      const draft = await this.service.createDraft({ ...req.body, createdBy });
      return sendSuccess(res, 'Draft sale created successfully', draft, null, 201);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const sale = await this.service.getSaleById(id);
      return sendSuccess(res, 'Sale details retrieved', sale);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const customerId = req.query.customerId ? BigInt(req.query.customerId as string) : undefined;
      const saleStatus = req.query.saleStatus as string;
      const paymentStatus = req.query.paymentStatus as string;

      const { sales, meta } = await this.service.getAllSales({ page, limit, customerId, saleStatus, paymentStatus });
      return sendSuccess(res, 'Sales list retrieved', sales, meta);
    } catch (error) {
      next(error);
    }
  };

  finalize = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const finalizedBy = BigInt(req.user!.id);
      const idempotencyKey = req.headers['idempotency-key'] as string;

      const result = await this.service.finalizeSale(id, finalizedBy, idempotencyKey);
      return sendSuccess(res, 'Sale finalized successfully', result);
    } catch (error) {
      next(error);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const cancelledBy = BigInt(req.user!.id);
      const result = await this.service.cancelSale(id, cancelledBy, req.body.cancelReason);
      return sendSuccess(res, 'Sale cancelled successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const salesController = new SalesController();
