# 🤖 Python RAG Engine

> **Advanced multi-modal Retrieval-Augmented Generation (RAG) engine with intelligent document processing, confidence scoring, and hallucination detection.**

## 📋 Overview

The Python RAG Engine is the core AI component of the NeuraNexus platform, providing sophisticated document processing, vector-based retrieval, and intelligent response generation. Built with Flask and modern AI libraries, it offers multiple pipeline modes for different use cases and security requirements.

## ✨ Features

### 🧠 **Advanced RAG Pipeline**
- **Document Processing**: PyPDF2, python-docx, LangChain loaders

## 🧠 AI Models & Architecture

### Large Language Model
- **Gemma3:4b**: 4 billion parameter model via Ollama
  - Primary LLM for text generation, reasoning, and chat responses
  - Optimized for conversational AI and document-based Q&A
  - Supports streaming responses for real-time interaction

### Embedding Models
- **nomic-embed-text:v1.5**: Advanced text embedding model
  - Semantic text representations for similarity search
  - High-quality embeddings for RAG retrieval
  - Optimized for multi-domain text understanding

### Vision Models
- **BLIP (Salesforce/blip-image-captioning-large)**:
  - Automatic image captioning and description generation
  - Visual understanding for multi-modal RAG
  - Generates descriptive text from images for searchability

- **CLIP-ViT-L-14**: 
  - Vision Transformer for image embeddings (768 dimensions)
  - Semantic image understanding and similarity matching
  - Enables image-text cross-modal retrieval

- **YOLOv8n (Nano)**:
  - Real-time object detection and classification
  - Automatic tagging of objects in images
  - Lightweight model optimized for fast inference

### Speech Recognition
- **Vosk (vosk-model-small-en-us-0.15)**:
  - Offline speech recognition with high accuracy
  - Word-level timestamp extraction for precise audio processing
  - Lightweight model suitable for real-time transcription

### Hybrid Search Architecture
- **BM25Okapi**: Sparse retrieval algorithm for keyword-based search
- **Vector Similarity**: Dense retrieval using semantic embeddings
- **Reciprocal Rank Fusion (RRF)**: Intelligent combination of search results
- **Query Type Analysis**: Automatic detection of optimal search strategy
- **Cross-Encoder Reranking**: Advanced relevance scoring for result optimization

## 🚀 Features
- **Hybrid Search Engine**: Advanced combination of BM25 sparse retrieval and vector similarity search
- **Multi-Modal AI Processing**: BLIP captioning, CLIP embeddings, YOLO detection, Vosk transcription
- **Intelligent Text Extraction**: OCR for images, audio transcription with word-level timestamps
- **Reciprocal Rank Fusion**: Smart algorithm for combining sparse and dense search results
- **Multiple Pipeline Modes**: Standard, Enhanced, and Secure modes for different requirements
- **Streaming Responses**: Real-time response generation with Server-Sent Events

### 🛡️ **AI Safety & Quality**
- **Confidence Scoring**: Advanced metrics to assess retrieval quality and response reliability
- **Hallucination Detection**: Built-in mechanisms to prevent AI-generated false information
- **Enhanced Retrieval**: Confidence-based document retrieval with quality assessment
- **Safe LLM Grounding**: Multiple validation layers for enterprise-grade safety
- **Citation System**: Automatic source attribution with detailed metadata

### 📊 **Document Intelligence & Search**
- **Hybrid Embedding Service**: Combines BM25Okapi sparse retrieval with dense vector search
- **Query Analysis**: Automatic query type detection for optimal search strategy selection
- **Fusion Methods**: Reciprocal Rank Fusion (RRF), weighted combination, and auto-selection
- **Cross-Encoder Reranking**: Advanced relevance scoring using transformer models
- **Timestamp-aware Processing**: Audio transcription with word-level timestamps
- **Content Analysis**: Intelligent chunking and metadata extraction
- **Quality Assessment**: Content sufficiency and relevance scoring
- **Multi-format Support**: Comprehensive document type coverage

### 🔧 **Enterprise Features**
- **Conversation Memory**: Persistent chat history with LangChain integration
- **Rate Limiting**: API throttling to prevent abuse
- **Error Handling**: Comprehensive error management and logging
- **Configurable Models**: Support for different LLM and embedding models
- **Scalable Architecture**: Designed for production deployment

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Flask API Server                     │
├─────────────────────────────────────────────────────────┤
│   Standard RAG   │   Enhanced RAG   │   Secure RAG      │
│    Pipeline      │    Pipeline      │    Pipeline       │
├─────────────────────────────────────────────────────────┤
│  Document        │  Confidence      │  Hallucination    │
│  Ingestion       │  Scoring         │  Detection        │
├─────────────────────────────────────────────────────────┤
│  Vector DB       │  LLM Service     │  Embedding        │
│  (Upstash)       │  (Ollama)        │  Service          │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Framework**: Flask 2.3+
- **Language**: Python 3.11+
- **AI/ML**: LangChain, Transformers, Sentence-Transformers, Ultralytics YOLO
- **Vector DB**: Upstash Vector Database
- **Search**: BM25Okapi + Vector Similarity with Reciprocal Rank Fusion
- **LLM**: Ollama Gemma3:4b for text generation and reasoning
- **Embeddings**: nomic-embed-text:v1.5 for semantic text representations
- **Vision Models**: 
  - BLIP (Salesforce/blip-image-captioning-large) for image captioning
  - CLIP-ViT-L-14 for image embeddings (768D)
  - YOLOv8n for object detection
- **Speech Recognition**: Vosk (vosk-model-small-en-us-0.15) with timestamps
- **Audio Processing**: Vosk, noisereduce, scipy
- **Image Processing**: Tesseract OCR, Pillow, PyTorch
- **Document Processing**: PyPDF2, python-docx, LangChain loaders

## 🚀 Getting Started

*   **Endpoint**: `GET /api/health`
*   **Description**: Check the health of the API server.
*   **Response**:
    ```json
    {
        "status": "healthy",
        "message": "RAG Pipeline Server is running"
    }
    ```

### Chat

### Prerequisites
```bash
# Required
Python 3.11+
Tesseract-OCR (for image text extraction)
Ollama (for LLM inference)

# Optional
CUDA drivers (for GPU acceleration)
```

### Installation
```bash
# Clone and navigate
git clone <repository-url>
cd NeuraNexus/python_server

# Install dependencies using uv (recommended)
uv sync

# Or using pip
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Download required models
ollama pull gemma3:4b
ollama pull nomic-embed-text:v1.5

# Start the server
python run_server.py
```

### Environment Variables
```env
# Vector Database
UPSTASH_VECTOR_REST_URL="https://your-upstash-url"
UPSTASH_VECTOR_REST_TOKEN="your-upstash-token"

# LLM Configuration
OLLAMA_BASE_URL="http://localhost:11434"
EMBEDDING_MODEL="nomic-embed-text:v1.5"
LLM_MODEL="gemma3:4b"

# Flask Configuration
FLASK_ENV="development"
SECRET_KEY="your-secret-key"

# Processing Configuration
MAX_WORKERS=4
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

## 📚 API Endpoints

### Health Check
```bash
GET /api/health
```
**Response:**
```json
{
    "status": "healthy",
    "message": "RAG Pipeline Server is running"
}
```

### Chat Interface
**Endpoint**: `POST /api/chat`

Ask questions and get AI-powered answers from processed documents.

**Request Body**:

```json
{
    "question": "What is the main topic of the document?",
    "conv_id": "<conversation-id>",
    "secure_mode": false,
    "stream": false
}
```

*   `question` (string, required): The question you want to ask.
*   `conv_id` (string, required): A unique identifier for the conversation.
*   `secure_mode` (boolean, optional, default: `false`): Set to `true` to use the secure pipeline with enhanced safety features.
*   `stream` (boolean, optional, default: `false`): Set to `true` to receive a streaming response. When `true`, the response will be sent using Server-Sent Events (SSE).

**Standard Response (`stream: false`)**:

```json
{
    "success": true,
    "question": "What is the main topic of the document?",
    "answer": "The main topic of the document is...",
    "citations": [...]
}
```

**Streaming Response (`stream: true`)**:

The response will be a stream of Server-Sent Events (SSE). Each event is a JSON object with a `type` and `data` field.

*   `type: 'retrieval_metrics'`: Contains information about the retrieved documents.
*   `type: 'answer_chunk'`: A chunk of the answer.
*   `type: 'final'`: The final event, containing citations and retrieved documents.
*   `type: 'error'`: If an error occurs.

Example SSE stream:

```
data: {"type": "retrieval_metrics", "data": {"metrics": ..., "documents_retrieved": 5, "should_proceed": true}}

data: {"type": "answer_chunk", "data": "The main topic"}

data: {"type": "answer_chunk", "data": " of the document is..."}

data: {"type": "final", "data": {"success": true, "question": "...", "citations": [...], "retrieved_documents": [...]}}
```

### Streaming Chat

*   **Endpoint**: `POST /api/chat/stream`
*   **Description**: A dedicated endpoint for streaming chat responses using Server-Sent Events (SSE).

**Request Body**:

```json
{
    "question": "What is the main topic of the document?",
    "conv_id": "<conversation-id>",
    "secure_mode": false
}
```

*   `question` (string, required): The question you want to ask.
*   `conv_id` (string, required): A unique identifier for the conversation.
*   `secure_mode` (boolean, optional, default: `false`): Set to `true` to use the secure pipeline with enhanced safety features.

### Document Search
**Endpoint**: `POST /api/search`

Search the vector database directly for relevant document chunks.

**Request Body**:
```json
{
    "query": "machine learning concepts",
    "k": 5,
    "analyze": false
}
```

**Response**:
```json
{
    "success": true,
    "query": "machine learning concepts",
    "results": [
        {
            "content": "Machine learning is a subset of artificial intelligence...",
            "metadata": {
                "file_id": "doc123",
                "page_number": 1,
                "chunk_type": "text"
            },
            "similarity_score": 0.89
        }
    ]
}
```

## 🔧 Core Components

### Document Ingestion Pipeline
The system supports comprehensive document processing:

```python
class DocumentIngestor:
    def ingest_document(self, file_path: str) -> List[Dict]:
        """Process and ingest various document types"""
        # Supports PDF, DOCX, PPTX, TXT, images, audio
        
    def _process_pdf_file(self, file_path: str) -> List[Dict]:
        """Extract text from PDF with metadata"""
        
    def _process_audio_file(self, file_path: str) -> List[Dict]:
        """Transcribe audio with timestamps"""
        
    def _process_image_file(self, file_path: str) -> List[Dict]:
        """Extract text from images using OCR"""
```

### RAG Pipeline Modes

**Standard Pipeline**: Basic retrieval and generation
```python
retriever = Retriever(vector_db, embedding_service)
llm_grounding = LLMGrounding()
```

**Enhanced Pipeline**: Confidence scoring and quality assessment
```python
enhanced_retriever = EnhancedRetriever(vector_db, embedding_service)
confidence_scorer = ConfidenceScorer()
```

**Secure Pipeline**: Multiple validation layers
```python
safe_llm = SafeLLMGrounding()
hallucination_detector = HallucinationDetector()
```

### Confidence Scoring System
Advanced metrics for retrieval quality:

```python
class ConfidenceScorer:
    def calculate_retrieval_confidence(self, query: str, docs: List[Dict]) -> Dict:
        """Calculate multiple confidence metrics"""
        return {
            "overall_confidence": 0.85,
            "max_similarity": 0.92,
            "mean_similarity": 0.78,
            "coverage_score": 0.83,
            "sufficient_content": True
        }
```

## 🛡️ Safety Features

### Hallucination Detection
Built-in mechanisms to prevent false information:

```python
class HallucinationDetector:
    def create_safety_prompt(self) -> PromptTemplate:
        """Create prompt with anti-hallucination instructions"""
        
    def validate_response(self, response: str, context: str) -> Dict:
        """Validate response against context"""
```

### Content Validation
Multiple validation layers for enterprise use:

- **Citation Verification**: Ensure all claims are backed by sources
- **Context Relevance**: Verify response relevance to retrieved documents
- **Confidence Thresholds**: Configurable quality gates
- **Safety Checks**: Multiple validation passes

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
python -m pytest tests/

# Run with coverage
python -m pytest --cov=models tests/

# Run specific test
python -m pytest tests/test_retriever.py
```

### API Testing
```bash
# Test the complete pipeline
python api_test.py

# Manual API testing
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is machine learning?", "conv_id": "test123"}'
```

## 🚀 Deployment

### Docker Support
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
```

### Production Configuration
```env
# Production settings
FLASK_ENV=production
GUNICORN_WORKERS=4
GUNICORN_TIMEOUT=120

# Model optimization
BATCH_SIZE=8
MAX_WORKERS=6
ENABLE_GPU=true
```

## 📈 Performance Optimization

- **Batch Processing**: Efficient document ingestion
- **Caching**: Vector and response caching
- **Parallel Processing**: Multi-threaded document processing
- **GPU Acceleration**: CUDA support for embeddings and LLM inference
- **Memory Management**: Efficient memory usage for large documents

## 🔧 Configuration

### Model Configuration
```python
# config.py
EMBEDDING_MODEL = "nomic-embed-text:v1.5"
LLM_MODEL = "gemma3:4b"
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
TOP_K = 5
SIMILARITY_THRESHOLD = 0.7
```

### Vector Database Settings
```python
# Upstash Vector configuration
VECTOR_DIMENSION = 768
SIMILARITY_FUNCTION = "cosine"
INDEX_TYPE = "flat"
```

## 🤝 Contributing

1. Follow Python PEP 8 style guidelines
2. Add type hints to all functions
3. Include comprehensive docstrings
4. Write unit tests for new features
5. Update configuration documentation
6. Test with multiple document types

---

**Built with ❤️ by Team NeuraNexus**
{
    "success": true,
    "query": "machine learning",
    "results": [
        {
            "content": "...",
            "metadata": {...},
            "similarity_score": 0.85,
            "relevance_score": 0.9
        }
    ]
}
```

**Response (when `analyze` is `true`)**:

Returns a detailed analysis of the query, including confidence scores and whether the pipeline should proceed with generating an answer.

```json
{
    "success": true,
    "query": "machine learning",
    "analysis": {...},
    "should_proceed": true,
    "message": "Proceeding with LLM generation.",
    "documents_retrieved": 5
}
```

## Conversation Management

The application now supports conversation management, allowing you to maintain a history for each conversation and summarize it when it's over.

### Summarize Conversation

*   **Endpoint**: `POST /api/summarize`
*   **Description**: Summarize a conversation.

**Request Body**:

```json
{
    "conv_id": "<conversation-id>"
}
```

*   `conv_id` (string, required): The ID of the conversation to summarize.

**Response**:

```json
{
    "success": true,
    "summary": "This is a summary of the conversation."
}
```

### Load Conversation Summary

*   **Endpoint**: `POST /api/load_summary`
*   **Description**: Load a summary into a new conversation.

**Request Body**:

```json
{
    "conv_id": "<new-conversation-id>",
    "summary": "This is a summary of a previous conversation."
}
```

*   `conv_id` (string, required): The ID of the new conversation.
*   `summary` (string, required): The summary to load.

**Response**:

```json
{
    "success": true
}
```

## Ingestion Pipeline

The ingestion pipeline is handled by the `ingestion_worker.py` script. This script runs as a long-running process and does the following:

1.  **Polls for new files**: The worker periodically calls an external API (defined by the `API_URL` environment variable) to get a list of new files to process.
2.  **Processes files in parallel**: The worker uses a thread pool to process multiple files concurrently, which significantly speeds up the ingestion process.
3.  **Extracts content**: It extracts text and images from various document formats.
4.  **Generates embeddings**: It uses a sentence transformer model to generate vector embeddings for the document chunks.
5.  **Stores in Vector DB**: The embeddings are stored in **Upstash Vector**, a serverless vector database.
6.  **Reports status**: After processing each file, the worker reports the status (success or failure) back to the external API.
