import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { customerService, CustomerService } from './service';

export class CustomerController {
  constructor(private service: CustomerService = customerService) {}

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const createdBy = BigInt(req.user!.id);
      const customer = await this.service.createCustomer({ ...req.body, createdBy });
      return sendSuccess(res, 'Customer created successfully', customer, null, 201);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const customer = await this.service.getCustomerById(id);
      return sendSuccess(res, 'Customer profile retrieved', customer);
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = req.query.q as string;
      const status = req.query.status as string;

      const { customers, meta } = await this.service.getAllCustomers({ page, limit, search, status });
      return sendSuccess(res, 'Customers list retrieved', customers, meta);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const updated = await this.service.updateCustomer(id, req.body);
      return sendSuccess(res, 'Customer profile updated', updated);
    } catch (error) {
      next(error);
    }
  };

  getSales = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const { sales, meta } = await this.service.getCustomerSales(id, page, limit);
      return sendSuccess(res, 'Customer sales retrieved', sales, meta);
    } catch (error) {
      next(error);
    }
  };

  getInvoices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const { invoices, meta } = await this.service.getCustomerInvoices(id, page, limit);
      return sendSuccess(res, 'Customer invoices retrieved', invoices, meta);
    } catch (error) {
      next(error);
    }
  };

  getPayments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const { payments, meta } = await this.service.getCustomerPayments(id, page, limit);
      return sendSuccess(res, 'Customer payments retrieved', payments, meta);
    } catch (error) {
      next(error);
    }
  };

  getLedger = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const { ledger, meta } = await this.service.getCustomerLedger(id, page, limit);
      return sendSuccess(res, 'Customer ledger retrieved', ledger, meta);
    } catch (error) {
      next(error);
    }
  };

  getOutstanding = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const result = await this.service.getCustomerOutstanding(id);
      return sendSuccess(res, 'Customer outstanding balance retrieved', result);
    } catch (error) {
      next(error);
    }
  };
}

export const customerController = new CustomerController();
