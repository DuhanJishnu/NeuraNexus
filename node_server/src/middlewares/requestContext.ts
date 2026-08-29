import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';


export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const supplied = req.get('x-request-id');
  const requestId = supplied && /^[A-Za-z0-9_-]{8,128}$/.test(supplied)
    ? supplied
    : randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
};
