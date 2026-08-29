import os
import json
import re
import math
from dotenv import load_dotenv

load_dotenv()


def _load_vector_indexes():
    raw = os.getenv('VECTOR_INDEXES_JSON', '{}')
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError('VECTOR_INDEXES_JSON must contain valid JSON') from error
    if not isinstance(value, dict):
        raise RuntimeError('VECTOR_INDEXES_JSON must be a JSON object')
    for version, settings in value.items():
        if not isinstance(version, str) or not re.fullmatch(
            r'[A-Za-z0-9_.-]{1,100}', version
        ):
            raise RuntimeError('VECTOR_INDEXES_JSON contains an invalid version')
        if not isinstance(settings, dict):
            raise RuntimeError(f'Vector index {version} must be a JSON object')
        if not isinstance(settings.get('url'), str) or not settings['url']:
            raise RuntimeError(f'Vector index {version} requires a URL')
        if not isinstance(settings.get('token'), str) or not settings['token']:
            raise RuntimeError(f'Vector index {version} requires a token')
        if 'hybrid' in settings and not isinstance(settings['hybrid'], bool):
            raise RuntimeError(f'Vector index {version} hybrid must be boolean')
    return value

class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'rag-pipeline-secret')
    SERVICE_TOKEN = os.getenv('INGESTION_SERVICE_TOKEN')
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            'CORS_ORIGINS', 'http://localhost:3000,http://localhost:8000'
        ).split(',')
        if origin.strip()
    ]
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    
    # Processing
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 200
    BATCH_SIZE = 4
    POLL_INTERVAL = 10  # seconds
    MAX_WORKERS = 4
    LEASE_HEARTBEAT_SECONDS = int(os.getenv('LEASE_HEARTBEAT_SECONDS', '120'))
    
    # Models
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'gemini-embedding-001')
    LLM_MODEL = os.getenv('LLM_MODEL', 'gemini-2.5-flash')
    GEMINI_EMBEDDING_DIMENSIONS = int(
        os.getenv('GEMINI_EMBEDDING_DIMENSIONS', '768')
    )
    GEMINI_EMBED_BATCH_SIZE = int(os.getenv('GEMINI_EMBED_BATCH_SIZE', '32'))
    GEMINI_TIMEOUT_MS = int(os.getenv('GEMINI_TIMEOUT_MS', '60000'))
    GEMINI_MAX_RETRIES = int(os.getenv('GEMINI_MAX_RETRIES', '5'))
    GEMINI_TEMPERATURE = float(os.getenv('GEMINI_TEMPERATURE', '0.2'))
    GEMINI_MAX_OUTPUT_TOKENS = int(
        os.getenv('GEMINI_MAX_OUTPUT_TOKENS', '2048')
    )
    INDEX_VERSION = os.getenv('INDEX_VERSION', 'text-v1')
    VECTOR_INDEXES = _load_vector_indexes()
    HYBRID_SEARCH_ENABLED = os.getenv('HYBRID_SEARCH_ENABLED', 'false').lower() in {
        '1', 'true', 'yes', 'on'
    }
    SPARSE_HASH_DIMENSIONS = int(os.getenv('SPARSE_HASH_DIMENSIONS', '2147483647'))
    HYBRID_DENSE_WEIGHT = float(os.getenv('HYBRID_DENSE_WEIGHT', '1.0'))
    HYBRID_SPARSE_WEIGHT = float(os.getenv('HYBRID_SPARSE_WEIGHT', '1.0'))
    
    
    # Vector DB
    UPSTASH_VECTOR_REST_URL = os.getenv('UPSTASH_VECTOR_REST_URL')
    UPSTASH_VECTOR_REST_TOKEN = os.getenv('UPSTASH_VECTOR_REST_TOKEN')
    
    # Retrieval
    TOP_K = 5
    RERANK_TOP_K = 3
    SIMILARITY_THRESHOLD = 0.7
    
    # API
    RATE_LIMIT = "100/hour"
    
    # File storage
    UPLOAD_FOLDER = "./uploads"
    ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'pptx'}

    # Confidence thresholds
    CONFIDENCE_THRESHOLDS = {
        "very_low": 0.3,     # Don't proceed
        "low": 0.5,          # Proceed with caution
        "medium": 0.7,       # Standard processing
        "high": 0.85         # High confidence
    }
    
    # Safety settings
    MIN_SIMILARITY_THRESHOLD = 0.5
    MIN_CONTENT_LENGTH = 500
    MAX_HALLUCINATION_RISK = "medium"


if Config.GEMINI_EMBEDDING_DIMENSIONS < 1 or not 1 <= Config.GEMINI_EMBED_BATCH_SIZE <= 100:
    raise RuntimeError('Gemini embedding dimensions and batch size are invalid')
if Config.GEMINI_TIMEOUT_MS < 1 or Config.GEMINI_MAX_RETRIES < 1:
    raise RuntimeError('Gemini timeout and retry count must be positive')
if not math.isfinite(Config.GEMINI_TEMPERATURE) or not 0 <= Config.GEMINI_TEMPERATURE <= 2:
    raise RuntimeError('GEMINI_TEMPERATURE must be between 0 and 2')
if Config.GEMINI_MAX_OUTPUT_TOKENS < 1:
    raise RuntimeError('GEMINI_MAX_OUTPUT_TOKENS must be positive')
