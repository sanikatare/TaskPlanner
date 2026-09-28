import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: AppError, _req: Request, res: Response, _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message    = err.isOperational ? err.message : 'Internal Server Error';

  if (statusCode >= 500) logger.error(err.stack ?? err.message);

  res.status(statusCode).json({ success: false, error: message });
}

export class AppError extends Error {
  statusCode: number;
  isOperational = true;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
