import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendSuccess(
  res: Response,
  message: string,
  data: any = null,
  meta: PaginationMeta | Record<string, any> | null = null,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendError(
  res: Response,
  message: string,
  errorCode: string = 'INTERNAL_SERVER_ERROR',
  errors: any[] = [],
  statusCode = 400
) {
  return res.status(statusCode).json({
    success: false,
    message,
    errorCode,
    errors,
  });
}
