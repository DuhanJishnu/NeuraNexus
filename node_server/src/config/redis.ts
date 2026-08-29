import Redis from 'ioredis';
import 'dotenv/config';

const redisUrl = process.env.REDIS_URL;
const parsedRedisUrl = redisUrl ? new URL(redisUrl) : null;

if (parsedRedisUrl && !['redis:', 'rediss:'].includes(parsedRedisUrl.protocol)) {
  throw new Error('REDIS_URL must use redis:// or rediss://');
}

export const redisConnection = parsedRedisUrl ? {
  host: parsedRedisUrl.hostname,
  port: Number(parsedRedisUrl.port || 6379),
  username: parsedRedisUrl.username ? decodeURIComponent(parsedRedisUrl.username) : undefined,
  password: parsedRedisUrl.password ? decodeURIComponent(parsedRedisUrl.password) : undefined,
  tls: parsedRedisUrl.protocol === 'rediss:' ? {} : undefined,
  maxRetriesPerRequest: null,
} : {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

export const redis = new Redis(redisConnection);

// Handle Redis connection events
redis.on('connect', () => {
  console.log('Redis connected');
});

redis.on('ready', () => {
  console.log('Redis ready');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});
