import dotenv from 'dotenv';
dotenv.config({path:'.env'})
export const PORT = process.env.PORT;
export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
export const IMAGE_MAX_SIZE :number = parseInt(process.env.IMAGE_MAX_SIZE! as string);
export const DEFAULT_IMAGE_QUALITY :number = parseInt(process.env.DEFAULT_IMAGE_QUALITY! as string);
export const DEFAULT_IMAGE_WIDTH :number = parseInt(process.env.DEFAULT_IMAGE_WIDTH! as string);
export const DEFAULT_IMAGE_HEIGHT :number = parseInt(process.env.DEFAULT_IMAGE_HEIGHT! as string);
export const AUDIO_MAX_SIZE :number = parseInt(process.env.AUDIO_MAX_SIZE || '50');
export const PDF_MAX_SIZE :number = parseInt(process.env.PDF_MAX_SIZE || '50');
export const DOCUMENT_MAX_SIZE :number = parseInt(process.env.DOCUMENT_MAX_SIZE || '25');
export const MAX_ITEMS_PER_LAYER: number = parseInt(process.env.MAX_ITEMS_PER_LAYER || '100'); 
export const TTL: number = parseInt(process.env.TTL || '3600'); 
export const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL
export const QUERY_REQUEST_TIMEOUT_MS: number = parseInt(process.env.QUERY_REQUEST_TIMEOUT_MS as string);
export const INGESTION_SERVICE_TOKEN = process.env.INGESTION_SERVICE_TOKEN;
export const CORS_ORIGINS = (process.env.CORS_ORIGINS
  || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const boundedNumber = (name: string, fallback: string, min: number, max: number) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
};
const positiveInteger = (name: string, fallback: string) => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};
export const RAG_ACTIVE_INDEX_VERSION = process.env.RAG_ACTIVE_INDEX_VERSION || 'text-v1';
export const RAG_PROMOTION_MIN_HIT_RATE = boundedNumber('RAG_PROMOTION_MIN_HIT_RATE', '0.7', 0, 1);
export const RAG_PROMOTION_MIN_MRR = boundedNumber('RAG_PROMOTION_MIN_MRR', '0.5', 0, 1);
export const RAG_PROMOTION_MAX_ERROR_RATE = boundedNumber('RAG_PROMOTION_MAX_ERROR_RATE', '0.01', 0, 1);
export const RAG_PROMOTION_MAX_P95_MS = boundedNumber('RAG_PROMOTION_MAX_P95_MS', '2000', 1, 3_600_000);
export const RAG_PROMOTION_MIN_QUERIES = positiveInteger('RAG_PROMOTION_MIN_QUERIES', '20');
export const RAG_PROMOTION_MAX_HIT_RATE_REGRESSION = boundedNumber(
  'RAG_PROMOTION_MAX_HIT_RATE_REGRESSION', '0.02', 0, 1,
);
export const RAG_PROMOTION_MAX_MRR_REGRESSION = boundedNumber(
  'RAG_PROMOTION_MAX_MRR_REGRESSION', '0.02', 0, 1,
);
export const RAG_PROMOTION_MAX_P95_MULTIPLIER = boundedNumber(
  'RAG_PROMOTION_MAX_P95_MULTIPLIER', '1.5', 1, 100,
);


export const envVarsCheck = () => {
  if (
    !PORT || 
    !JWT_ACCESS_SECRET || 
    !JWT_REFRESH_SECRET || 
    !IMAGE_MAX_SIZE || 
    !AUDIO_MAX_SIZE || 
    !PDF_MAX_SIZE || 
    !DOCUMENT_MAX_SIZE ||
    !PYTHON_SERVER_URL ||
    !QUERY_REQUEST_TIMEOUT_MS ||
    !INGESTION_SERVICE_TOKEN
  ) {
    console.error("Missing required environment variables.");
    process.exit(1);
  }
}
