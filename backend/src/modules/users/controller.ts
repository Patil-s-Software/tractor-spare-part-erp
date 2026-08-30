import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { userService, UserService } from './service';

export class UserController {
  constructor(private service: UserService = userService) {}

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = BigInt(req.user!.id);
      const user = await this.service.getUserById(userId);
      return sendSuccess(res, 'User profile retrieved', user);
    } catch (error) {
      next(error);
    }
  };

  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '20', 10);
      const search = req.query.q as string;

      const { users, meta } = await this.service.getAllUsers(page, limit, search);
      return sendSuccess(res, 'Users list retrieved', users, meta);
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.service.createUser(req.body);
      return sendSuccess(res, 'User created successfully', user, null, 201);
    } catch (error) {
      next(error);
    }
  };

  updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = BigInt(req.params.id);
      const updated = await this.service.updateUserStatus(userId, req.body.status);
      return sendSuccess(res, 'User status updated successfully', updated);
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();
