import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODES } from '../constants';
import { sendError } from '../utils/response';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public errors: any[];

  constructor(message: string, statusCode = 400, errorCode: string = ERROR_CODES.INTERNAL_SERVER_ERROR, errors: any[] = []) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandlerMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.errorCode, err.errors, err.statusCode);
  }

  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(
      res,
      'Validation failed',
      ERROR_CODES.VALIDATION_ERROR,
      formattedErrors,
      400
    );
  }

  // Handle Prisma Known Request Errors
  if (err?.code && typeof err.code === 'string') {
    if (err.code === 'P2002') {
      const target = err.meta?.target ? ` on (${(err.meta.target as string[]).join(', ')})` : '';
      return sendError(
        res,
        `Unique constraint violation${target}`,
        ERROR_CODES.CONFLICT,
        [],
        409
      );
    }
    if (err.code === 'P2025') {
      return sendError(res, 'Record not found', ERROR_CODES.NOT_FOUND, [], 404);
    }
  }

  return sendError(
    res,
    err?.message || 'An unexpected error occurred',
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    [],
    500
  );
}
