import { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../utils/response';
import { authService, AuthService } from './service';

export class AuthController {
  constructor(private service: AuthService = authService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userAgent = req.headers['user-agent'];
      const result = await this.service.login(req.body.email, req.body.password, userAgent);
      return sendSuccess(res, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userAgent = req.headers['user-agent'];
      const result = await this.service.refresh(req.body.refreshToken, userAgent);
      return sendSuccess(res, 'Token refreshed successfully', result);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.refreshToken) {
        await this.service.logout(req.body.refreshToken);
      }
      return sendSuccess(res, 'Logged out successfully', null);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = BigInt(req.user!.id);
      await this.service.changePassword(userId, req.body.currentPassword, req.body.newPassword);
      return sendSuccess(res, 'Password changed successfully. Please log in again.', null);
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
