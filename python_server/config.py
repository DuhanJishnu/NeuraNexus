import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'rag-pipeline-secret')
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    
    # Processing
    CHUNK_SIZE = 1000
    CHUNK_OVERLAP = 200
    BATCH_SIZE = 4
    POLL_INTERVAL = 10  # seconds
    MAX_WORKERS = 4
    
    # Models
    EMBEDDING_MODEL = "nomic-embed-text:v1.5"
    LLM_MODEL = "gemma3:4b"
    
    
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