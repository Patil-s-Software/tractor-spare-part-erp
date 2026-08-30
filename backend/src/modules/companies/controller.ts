import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { companyService, CompanyService } from './service';

export class CompanyController {
  constructor(private service: CompanyService = companyService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companies = await this.service.getAllCompanies();
      return sendSuccess(res, 'Companies retrieved', companies);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const company = await this.service.createCompany(req.body.name);
      return sendSuccess(res, 'Company created', company, null, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const updated = await this.service.updateCompany(id, req.body);
      return sendSuccess(res, 'Company updated', updated);
    } catch (error) {
      next(error);
    }
  };
}

export const companyController = new CompanyController();
