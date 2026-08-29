import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { redis } from '../config/redis';


export class FixedWindowRateLimit {
  private readonly max: number;
  private readonly window: number;
  private readonly redisClient: Redis;
  /* 
    paramters - 2 - (max, window) 
    max: Maximum number of requests allowed within the time window
    window:(seconds) Time window in seconds during which the requests are counted
  */
  constructor(max: number, window: number) {
    this.max = max;
    this.window = window;
    this.redisClient = redis;
  }

  withIPaddress() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (!ipAddress) {
        return res.status(400).json({ error: 'IP address is required' });
      }

      const key = `rate_limit:${ipAddress}`;
      const currentCount = parseInt((await this.redisClient.get(key)) || '0');

      if (currentCount === 0) {
        await this.redisClient.set(key, 1, 'EX', this.window);
        next();
      } else if (currentCount < this.max) {
        await this.redisClient.incr(key);
        next();
      } else {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfterSeconds: this.window,
        });
      }
    };
  }
}
