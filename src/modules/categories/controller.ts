import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { categoryService, CategoryService } from './service';

export class CategoryController {
  constructor(private service: CategoryService = categoryService) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.service.getAllCategories();
      return sendSuccess(res, 'Categories retrieved', categories);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const category = await this.service.createCategory(req.body);
      return sendSuccess(res, 'Category created', category, null, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = BigInt(req.params.id);
      const updated = await this.service.updateCategory(id, req.body);
      return sendSuccess(res, 'Category updated', updated);
    } catch (error) {
      next(error);
    }
  };
}

export const categoryController = new CategoryController();
