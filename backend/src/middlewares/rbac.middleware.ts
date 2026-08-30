import { Request, Response, NextFunction } from 'express';
import { ERROR_CODES } from '../constants';
import { AppError } from './error-handler.middleware';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('User authentication required', 401, ERROR_CODES.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      return next(
        new AppError(
          `Role '${req.user.roleName}' is not authorized to perform this action`,
          403,
          ERROR_CODES.FORBIDDEN
        )
      );
    }

    next();
  };
}
