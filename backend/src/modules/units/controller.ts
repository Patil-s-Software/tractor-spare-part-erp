import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { unitService, UnitService } from './service';

export class UnitController {
  constructor(private service: UnitService = unitService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const units = await this.service.getAllUnits();
      return sendSuccess(res, 'Units retrieved', units);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const unit = await this.service.createUnit(req.body);
      return sendSuccess(res, 'Unit created', unit, null, 201);
    } catch (error) {
      next(error);
    }
  };
}

export const unitController = new UnitController();
