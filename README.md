
# 🏛️ NeuraNexus

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

> **Advanced Retrieval-Augmented Generation (RAG) platform with multi-modal document processing, intelligent conversation management, and enterprise-grade security features.**

---

## 🎯 Project Overview

**NeuraNexus** is a sophisticated AI-powered platform combining **Large Language Models (LLMs)** with intelligent document retrieval systems.  
It includes a modern web interface, robust backend services, and advanced RAG capabilities for processing PDFs, images, audio, and Microsoft Office documents.

---

https://github.com/user-attachments/assets/f24b3772-c43d-4352-b237-12558fde1f05


---

## ✨ Key Features

### 🔍 Advanced RAG Pipeline
- **Multi-Modal Document Support:** PDF, DOCX, PPTX, TXT, images (PNG, JPG, WEBP), and audio (MP3, WAV, OGG)
- **Hybrid Search Engine:** Combines stateless hashed lexical retrieval with vector similarity using **Reciprocal Rank Fusion (RRF)**
- **AI-Powered Processing:**
  - **BLIP** (`Salesforce/blip-image-captioning-large`) for image captioning
  - **CLIP-ViT-L-14** for 768D semantic image embeddings
  - **YOLOv8n** for object detection and tagging
  - **Vosk** (`vosk-model-small-en-us-0.15`) for speech recognition with timestamps
- **Intelligent Document Processing:** OCR, audio transcription, text extraction
- **Confidence Scoring & Query Analysis:** Adaptive retrieval quality assessment
- **Hallucination Detection:** Context validation for safety
- **Secure Mode:** Multi-layer validation for enterprise environments

---

### 💬 Intelligent Chat System
- **AI Models:**
  - 🧠 Gemini API (`gemini-2.5-flash` by default) for grounded generation
  - 🧩 `gemini-embedding-001` with retrieval-specific 768D embeddings
- **Real-time Streaming:** Server-Sent Events (SSE)
- **Persistent Conversations:** Threaded chat history
- **Citation System:** Automatic file/page referencing
- **Context-Aware Responses:** Maintains dialogue continuity
- **Multiple Modes:** Standard / Enhanced / Secure

---

### 📁 Enterprise File Management
- **Secure Uploads:** Multi-part uploads with magic number validation
- **Background Processing:** Redis + BullMQ job queues
- **Intelligent Compression:** Auto-optimization for media files
- **Thumbnail Generation:** Smart preview generation
- **Encrypted Storage:** Secure file identifiers
- **Admin Dashboard:** Paginated file management interface

---

### 🔐 Security & Authentication
- **JWT-based Authentication:** Access & refresh tokens with secure cookies
- **Role-Based Access Control:** User/Admin privileges
- **File Validation:** Magic number detection
- **CORS Protection:** Configurable origin rules
- **Input Sanitization:** Strict Zod validation

---

### 🧠 AI Models & Search Technology
- **Text Models:**  
  - Configurable Gemini generation model for grounded answers
  - `gemini-embedding-001` for document and query embeddings
- **Vision Models:**  
  - `BLIP`, `CLIP-ViT-L-14`, `YOLOv8n`
- **Speech Recognition:**  
  - `Vosk` with word-level timestamps
- **Hybrid Search Stack:**  
  - Hashed sparse vectors, dense vector similarity, RRF, and cross-encoder re-ranking

---

### 🎨 Modern Web Interface
- **Next.js 15 + Turbopack**
- **Responsive Design:** Tailwind CSS
- **Dark/Light Mode:** Seamless switching
- **Live Chat:** Typing indicators, streaming messages
- **Framer Motion Animations**
- **Drag-and-Drop Uploads:** File previews

---

## 🏗️ Architecture

```

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js       │    │   Node.js        │    │   Python        │
│   Frontend      │◄──►│   API Server     │◄──►│   RAG Engine    │
│   (Port 3000)   │    │   (Port 8000)    │    │   (Port 5000)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
│                       │                       │
▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ React Context   │    │ PostgreSQL DB    │    │ Upstash Vector  │
│ State Mgmt      │    │ (Prisma ORM)     │    │ Database        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
│
▼
┌──────────────────┐
│ Redis Queue      │
│ Background Jobs  │
└──────────────────┘

````

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL
- Redis
- Upstash Vector DB
- Gemini API key and embedding/generation quota

### 1️⃣ Clone Repository
```bash
git clone https://github.com/duhanjishnu/NeuraNexus.git
cd NeuraNexus
````

### 2️⃣ Set Up Environment Variables

Create service `.env` files from the templates. For Python, copy
`python_server/env.example` to `python_server/.env` and replace every secret.

### 3️⃣ Install Dependencies

```bash
# Frontend
cd client && npm install

# Node.js API
cd ../node_server && npm install

# Python RAG Engine
cd ../python_server && uv sync
# Alternative: python -m pip install -e .
```

### 4️⃣ Database Setup

```bash
cd node_server
npx prisma migrate dev
npx prisma generate
```

### 5️⃣ Start Services

```bash
# Terminal 1
cd client && npm run dev

# Terminal 2
cd node_server && npm run dev

# Terminal 3
cd python_server && uv run python run_server.py

# Terminal 4: ingestion service
cd python_server && uv run python ingestion_worker.py

# Terminal 5
redis-server
```

### 6️⃣ Access

* Frontend → [http://localhost:3000](http://localhost:3000)
* API → [http://localhost:8000](http://localhost:8000)
* Admin → [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 📊 System Components

| Component    | Technology       | Purpose                       |
| ------------ | ---------------- | ----------------------------- |
| Frontend     | Next.js 15       | UI & Streaming                |
| Backend      | Express + Prisma | API & DB                      |
| RAG Engine   | Flask            | Retrieval + LLM Orchestration |
| Database     | PostgreSQL       | Structured Data               |
| Vector Store | Upstash          | Embeddings                    |
| Queue        | Redis + BullMQ   | Background Jobs               |

---

## Production-grade RAG architecture

### Retrieval and answer generation

- Gemini-backed dense retrieval uses separate `RETRIEVAL_DOCUMENT` and
  `RETRIEVAL_QUERY` task types, fixed output dimensionality, unit normalization,
  bounded batches, pooled connections, timeouts, and retries for transient API
  failures.
- Hybrid retrieval combines Gemini dense vectors with deterministic hashed
  sparse vectors. Upstash applies IDF weighting, and local Reciprocal Rank
  Fusion merges the independent dense and lexical rankings.
- A cross-encoder reranks the fused candidate set before context reaches the
  LLM. Candidate depth and final context depth are bounded separately.
- Retrieval can be restricted to trusted document IDs and tenant visibility
  filters. Filter syntax and size are validated before being sent to the vector
  database.
- Grounded prompts instruct Gemini to use only retrieved context. Responses
  carry document/page citations, retrieval scores, confidence metrics, and
  conservative refusal behavior when evidence is weak.
- Both buffered responses and native Gemini streaming are exposed through the
  Python service; Node proxies streaming responses to the authenticated client.

### Reliable, horizontally scalable ingestion

- Redis and BullMQ separate upload/compression work from Python document
  extraction and vector ingestion.
- PostgreSQL claims ingestion work atomically with `FOR UPDATE SKIP LOCKED`, so
  multiple workers can poll concurrently without intentionally duplicating a
  document.
- Every attempt receives a lease ID. Heartbeats renew long-running work, stale
  leases can be reclaimed, retry counts are bounded, and completion is fenced
  to the worker that owns the current lease.
- Vector IDs are deterministic and document-prefixed. Reindexing deletes a
  target version before rebuilding it, preventing duplicate and orphaned chunks.
- Successful ingestion returns a vector manifest containing the prefix, chunk
  count, embedding model, and index version. PostgreSQL stores coverage per
  document and physical index.
- Text, OCR, image-caption, and audio-transcript chunks all enter the same text
  embedding space. Raw CLIP image vectors are intentionally excluded from the
  text index because they require a separate compatible multimodal query path.

### Zero-downtime index lifecycle

- Python maintains a validated registry of versioned physical Upstash indexes;
  credentials remain server-side and are never exposed by the index-discovery
  endpoint.
- Prisma persists `ACTIVE`, `CANDIDATE`, and `RETIRED` deployments. A partial
  unique database index enforces one active deployment, while Redis caches the
  read path for normal chat traffic.
- New ingestion leases bind to the authoritative active database version rather
  than a worker startup default.
- Candidate and baseline indexes are evaluated over the same labeled JSONL
  cases. Reports include hit rate, MRR, recall, precision, NDCG, error rate,
  retrieval methods, and mean/p50/p95 latency.
- Promotion gates enforce minimum hit rate/MRR/query count, maximum error and
  p95 latency, baseline-regression limits, complete physical-index coverage,
  and evaluation freshness after the last indexing change.
- Promotion, rollback, reindex scheduling, and coverage invalidation use
  serializable transactions. Rollback is rejected when its physical index does
  not cover every compressed document.

### Security and tenant isolation

- JWT access/refresh authentication, role-based admin controls, service-to-
  service bearer authentication, strict CORS allowlists, and rate limiting
  protect the public and internal boundaries.
- Uploads use secure type validation instead of trusting extensions alone.
- Documents support `GLOBAL` and owner-scoped `PRIVATE` visibility. Retrieval,
  citations, downloads, thumbnails, filename resolution, and conversations
  enforce the same ownership boundary.
- Request payloads are validated with Zod/explicit Python validation, vector
  filter injection is rejected, and sensitive model/vector credentials are read
  only from environment-backed secrets.

### Observability, evaluation, and CI

- Node and Python propagate `X-Request-Id`. Retrieval logs are structured and
  record only a short query hash—not raw user questions—along with method,
  candidate/result counts, scope, and latency.
- The service-authenticated `/api/metrics` endpoint exports Prometheus counters
  and cumulative latency histograms split by retrieval method and outcome.
- Offline quality evaluation and concurrent load-test harnesses provide release
  gates for relevance, errors, and p95 latency.
- GitHub Actions runs dependency-light Python tests, Prisma generation and
  validation, the Node TypeScript build, and the client typecheck on pushes and
  pull requests.

### Production deployment requirements

The application-level controls above are implemented. A real production
deployment must additionally provide managed PostgreSQL and Redis with backups,
TLS and network policies, a secret manager for Gemini/Upstash/JWT credentials,
centralized logs and Prometheus scraping, worker autoscaling, alerting, and a
durable object store/CDN replacing local upload storage. Apply Prisma migrations
before starting new code, use rolling service updates, set provider quotas and
budgets, and exercise ingestion recovery plus index promotion/rollback in
staging before serving traffic.

---

## 🔧 Environment Variables

**Node.js**

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
REDIS_URL=redis://localhost:6379
DOMAIN_NAME=http://localhost:8000
INGESTION_SERVICE_TOKEN=generate_a_long_random_shared_secret
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
RAG_ACTIVE_INDEX_VERSION=gemini-embed-001-768-v1
RAG_PROMOTION_MIN_HIT_RATE=0.7
RAG_PROMOTION_MIN_MRR=0.5
RAG_PROMOTION_MAX_ERROR_RATE=0.01
RAG_PROMOTION_MAX_P95_MS=2000
RAG_PROMOTION_MIN_QUERIES=20
RAG_PROMOTION_MAX_HIT_RATE_REGRESSION=0.02
RAG_PROMOTION_MAX_MRR_REGRESSION=0.02
RAG_PROMOTION_MAX_P95_MULTIPLIER=1.5
```

**Python**

```env
GEMINI_API_KEY=store_in_a_secret_manager
LLM_MODEL=gemini-2.5-flash
EMBEDDING_MODEL=gemini-embedding-001
GEMINI_EMBEDDING_DIMENSIONS=768
GEMINI_EMBED_BATCH_SIZE=32
GEMINI_TIMEOUT_MS=60000
GEMINI_MAX_RETRIES=5
GEMINI_TEMPERATURE=0.2
GEMINI_MAX_OUTPUT_TOKENS=2048
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=your_token
FLASK_ENV=development
INGESTION_SERVICE_TOKEN=the_same_shared_secret_as_node
CORS_ORIGINS=http://localhost:3000,http://localhost:8000
INDEX_VERSION=gemini-embed-001-768-v1
HYBRID_SEARCH_ENABLED=false
SPARSE_HASH_DIMENSIONS=2147483647
HYBRID_DENSE_WEIGHT=1.0
HYBRID_SPARSE_WEIGHT=1.0
LEASE_HEARTBEAT_SECONDS=120
VECTOR_INDEXES_JSON='{"gemini-embed-001-768-v1":{"url":"https://active...","token":"...","hybrid":true}}'
```

`HYBRID_SEARCH_ENABLED=true` requires an Upstash **hybrid index**. Recreate or
reindex existing dense-only data before enabling it, and use a new
`INDEX_VERSION` such as `hybrid-hash-v1`. The active hybrid path stores both
dense Gemini embeddings and stateless hashed lexical vectors, applies
server-maintained IDF weighting, fuses independent
dense/sparse rankings with RRF, then applies cross-encoder reranking.

Gemini embeddings must be written to a new physical index. They are not
compatible with vectors produced by Nomic/Ollama, even when both indexes use
768 dimensions. Configure `gemini-embed-001-768-v1`, reindex every document,
run paired evaluation, and promote it through the versioned release workflow.
The adapter sends `RETRIEVAL_DOCUMENT` for indexed content and
`RETRIEVAL_QUERY` for search queries, requests 768 dimensions, and normalizes
the returned vectors. See the official [Gemini embedding documentation](https://ai.google.dev/gemini-api/docs/embeddings)
and [Google Gen AI Python SDK](https://googleapis.github.io/python-genai/).

**Frontend**

```env
NEXT_PUBLIC_BASEURL=http://localhost:8000
NEXT_PUBLIC_FILE_BASE_URL=http://localhost:8000
```

These are public browser origins only. Gemini credentials and authentication
secrets stay in their server-side environment files and must never use the
`NEXT_PUBLIC_` prefix.

---

## 🧪 Testing

```bash
# Python RAG Engine
cd python_server && python api_test.py

# Offline retrieval evaluation against a running Python API
INGESTION_SERVICE_TOKEN=... python -m evaluation.retrieval_eval evaluation/sample_dataset.jsonl

# Paired candidate/baseline evaluation for promotion (same labeled queries)
INGESTION_SERVICE_TOKEN=... python -m evaluation.retrieval_eval \
  evaluation/sample_dataset.jsonl --index-version gemini-embed-001-768-v1 \
  --baseline-version text-v1

# Concurrent gate: fails above 1% errors or two-second p95 latency
INGESTION_SERVICE_TOKEN=... python -m evaluation.retrieval_load_test \
  evaluation/sample_dataset.jsonl --concurrency 8 --requests 100

# Node.js API
cd node_server && npm test
```

Use the provided **Postman collection** in `Routes.md` for API testing.

Uploads default to `GLOBAL`. An administrator can submit `visibility=PRIVATE`
and an optional `ownerId` in the multipart upload body; when `ownerId` is
omitted, the uploader becomes the owner. RAG queries, citations, file downloads,
and filename lookups enforce the same visibility rule. Documents indexed before
this migration are treated as global for backward compatibility.

The Python service exposes service-authenticated Prometheus metrics at
`GET /api/metrics`. Node and Python responses propagate `X-Request-Id`, while
retrieval logs contain the same identifier without recording raw query text.

Administrators can schedule a bounded, version-aware reindex through the Node
API. Documents currently being processed are skipped. Completion is accepted
only from the worker lease that claimed the job and only for the requested
index version.

```http
POST /api/file/v1/reindex
Content-Type: application/json
Authorization: Bearer <admin-access-token>

{
  "documentIds": ["document_id"],
  "targetIndexVersion": "gemini-embed-001-768-v1"
}
```

### Zero-downtime RAG index releases

The Python data plane can keep multiple physical vector indexes online while
Node stores the single logical active version. Normal chat traffic resolves the
active version through Redis/Prisma; candidate evaluation addresses its version
directly and never changes production routing.

1. Add both physical indexes to `VECTOR_INDEXES_JSON`, restart Python, and set
   `RAG_ACTIVE_INDEX_VERSION` to the currently serving version.
2. Register the configured candidate with `POST /api/rag-index/v1/candidates`
   using `{ "version": "gemini-embed-001-768-v1" }` and an admin token.
3. Reindex documents in bounded batches with `POST /api/file/v1/reindex` and
   `targetIndexVersion: "gemini-embed-001-768-v1"`. Lease fencing prevents stale workers
   from completing a newer attempt.
4. Run the paired evaluation command above. Submit its top-level
   `promotion_metrics` as `metrics` to `POST /api/rag-index/v1/evaluations`,
   together with `version`.
5. Call `POST /api/rag-index/v1/promote`. Promotion is rejected unless all
   compressed documents finished candidate indexing, absolute quality/latency
   gates pass, and candidate hit rate, MRR, and p95 latency stay within the
   configured baseline-regression limits. Evaluation must be newer than the
   candidate's last indexing change; any later reindex requires a fresh run.
6. If production behavior regresses, atomically route back with
   `POST /api/rag-index/v1/rollback` and the retired version. Keep the retired
   physical index available until the rollback window expires. Rollback is
   blocked if any document lacks a successful manifest for that physical index;
   reindex documents uploaded since retirement into it before retrying.

All index-control endpoints require both authentication and the admin role.
Store `VECTOR_INDEXES_JSON` in a secret manager because it contains vector-store
tokens; never commit its real value.

---

## 📈 Performance Highlights

* Native Gemini SSE streaming
* Bounded embedding batches with pooled, retry-enabled API access
* Redis caching and horizontally scalable queues
* Concurrent fenced ingestion with PostgreSQL `SKIP LOCKED`
* Hybrid candidate retrieval followed by cross-encoder reranking
* Automatic media compression

---

## 🔒 Security Highlights

* Strict Zod and Python boundary validation
* Magic-number upload checks
* JWT, RBAC, and internal service authentication
* Tenant-aware retrieval and file ownership enforcement
* CORS allowlists, rate limiting, and Prisma query safety
* Secrets kept out of client responses and structured retrieval logs

---

## 📝 Documentation

Full API docs: [Routes.md](./Routes.md)

---

## 🤝 Contributing

1. Fork repository
2. Create branch `feature/amazing-feature`
3. Commit and push
4. Open Pull Request

---

## 📄 License

MIT License – see [LICENSE](LICENSE)

---

## 👥 Team

**Team NeuraNexus**

* AI & ML Integration
* Modern Web Development
* Enterprise Security & Scalability

---

<div align="center">
  <strong>Built with ❤️ by Team NeuraNexus</strong>
</div>
