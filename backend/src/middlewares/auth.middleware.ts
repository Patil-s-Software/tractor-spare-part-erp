import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ERROR_CODES } from '../constants';
import { AppError } from './error-handler.middleware';

export interface AuthUser {
  id: string;
  email: string;
  roleId: number;
  roleName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authorization token required', 401, ERROR_CODES.UNAUTHORIZED);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as any;

    if (!decoded || !decoded.id || !decoded.roleName) {
      throw new AppError('Invalid token payload', 401, ERROR_CODES.UNAUTHORIZED);
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired', 401, ERROR_CODES.UNAUTHORIZED));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid access token', 401, ERROR_CODES.UNAUTHORIZED));
    }
    next(error);
  }
}
