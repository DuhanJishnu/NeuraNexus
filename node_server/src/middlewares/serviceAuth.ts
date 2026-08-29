import { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import authMiddleware from './auth';

function hasValidServiceToken(req: Request): boolean {
  const configuredToken = process.env.INGESTION_SERVICE_TOKEN;
  const authorization = req.get('authorization');
  if (!configuredToken || !authorization?.startsWith('Bearer ')) {
    return false;
  }

  const suppliedToken = authorization.slice('Bearer '.length);
  const configured = Buffer.from(configuredToken);
  const supplied = Buffer.from(suppliedToken);
  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

export const serviceAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!hasValidServiceToken(req)) {
    return res.status(401).json({ error: 'Invalid service credentials' });
  }
  next();
};

export const userOrServiceAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (hasValidServiceToken(req)) {
    return next();
  }
  return authMiddleware(req, res, next);
};
