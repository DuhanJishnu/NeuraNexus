
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

## ✨ Key Features

### 🔍 Advanced RAG Pipeline
- **Multi-Modal Document Support:** PDF, DOCX, PPTX, TXT, images (PNG, JPG, WEBP), and audio (MP3, WAV, OGG)
- **Hybrid Search Engine:** Combines BM25 sparse retrieval with vector similarity using **Reciprocal Rank Fusion (RRF)**
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
  - 🧠 `Gemma3:4b` (via Ollama) – text generation and reasoning  
  - 🧩 `nomic-embed-text:v1.5` – semantic embeddings
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
  - `Gemma3:4b` for reasoning  
  - `nomic-embed-text:v1.5` for embeddings
- **Vision Models:**  
  - `BLIP`, `CLIP-ViT-L-14`, `YOLOv8n`
- **Speech Recognition:**  
  - `Vosk` with word-level timestamps
- **Hybrid Search Stack:**  
  - `BM25Okapi`, `Vector Similarity`, `RRF`, and Cross-Encoder re-ranking

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

### 1️⃣ Clone Repository
```bash
git clone https://github.com/duhanjishnu/NeuraNexus.git
cd NeuraNexus
````

### 2️⃣ Set Up Environment Variables

Create `.env` files in each directory from the templates.

### 3️⃣ Install Dependencies

```bash
# Frontend
cd client && npm install

# Node.js API
cd ../node_server && npm install

# Python RAG Engine
cd ../python_server && pip install -r requirements.txt
# or: uv sync
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
cd python_server && python run_server.py

# Terminal 4
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

## 🔧 Environment Variables

**Node.js**

```env
DATABASE_URL=postgresql://...
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
REDIS_URL=redis://localhost:6379
DOMAIN_NAME=http://localhost:8000
```

**Python**

```env
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=your_token
OLLAMA_BASE_URL=http://localhost:11434
FLASK_ENV=development
```

**Frontend**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:5000
```

---

## 🧪 Testing

```bash
# Python RAG Engine
cd python_server && python api_test.py

# Node.js API
cd node_server && npm test
```

Use the provided **Postman collection** in `Routes.md` for API testing.

---

## 📈 Performance Highlights

* Real-time SSE streaming
* Redis caching & queues
* Indexed queries
* Automatic media compression
* CDN-ready delivery

---

## 🔒 Security Highlights

* Strict Zod validation
* Magic-number file checks
* JWT security
* CORS & rate limiting
* Prisma query safety

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