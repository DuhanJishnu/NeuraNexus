# 🚀 Node.js API Server

> **Enterprise-grade backend API server providing authentication, file management, and conversation handling for the NeuraNexus RAG platform.**

## 📋 Overview

The Node.js server acts as the main API gateway for the NeuraNexus platform, handling user authentication, file upload processing, conversation management, and database operations. Built with Express.js and TypeScript, it provides a robust and scalable backend infrastructure.

## ✨ Features

### 🔐 **Authentication System**
- **JWT-based Authentication**: Secure access and refresh token implementation
- **Role-based Access Control**: User and Admin role management
- **Secure Cookie Storage**: HTTP-only cookies for token storage
- **Password Hashing**: bcrypt-based password security
- **Token Refresh**: Automatic token rotation for enhanced security

### 📁 **File Management**
- **Multi-format Support**: Images, Audio, PDFs, and Microsoft Office documents
- **Secure Upload**: Magic number validation and file type verification
- **Background Processing**: Queue-based file processing with BullMQ
- **File Compression**: Automatic optimization for different media types
- **Thumbnail Generation**: Smart preview creation for various file formats
- **Encrypted Storage**: Secure file storage with encrypted identifiers

### 💬 **Conversation Management & AI Integration**
- **Chat History**: Persistent conversation storage and retrieval
- **Exchange System**: Message exchange tracking with metadata
- **Python RAG Integration**: Seamless integration with hybrid search RAG pipeline
- **AI Model Support**: Routes authenticated RAG traffic to Gemini generation and embedding services
- **Pagination**: Efficient conversation and message pagination
- **Real-time Updates**: Support for real-time chat functionality with streaming responses

### 🗄️ **Database Operations**
- **Prisma ORM**: Type-safe database operations
- **PostgreSQL**: Robust relational database with full ACID compliance
- **Migration Support**: Database schema versioning and updates
- **Connection Pooling**: Optimized database connection management

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│              Express.js App             │
├─────────────────────────────────────────┤
│  Authentication │  File Mgmt │  Chat    │
│     Routes      │   Routes   │  Routes  │
├─────────────────────────────────────────┤
│  Auth Service   │ File Service│ Conv Svc│
├─────────────────────────────────────────┤
│         Prisma ORM (Database)           │
├─────────────────────────────────────────┤
│    Redis Queue  │  Background Workers   │
└─────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 5
- **Language**: TypeScript 5
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Redis + BullMQ
- **Authentication**: JWT + bcrypt
- **File Processing**: Sharp, FFmpeg, Multer
- **Validation**: Zod schemas

## 🚀 Getting Started
  - [Running the Server](#running-the-server)
- [API Reference](#api-reference)
  - [Authentication Routes](#authentication-routes)
  - [Conversation Routes](#conversation-routes)
  - [Exchange Routes](#exchange-routes)
  - [File Routes](#file-routes)

## Project Overview

The Node.js server is a core component of the NeuraNexus application, responsible for handling user authentication, managing conversations and exchanges, and processing file uploads. It is built with Express.js and uses a PostgreSQL database via Prisma for data persistence.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm
- PostgreSQL

### Installation

1.  Clone the repository.
2.  Navigate to the `node_server` directory:
    ```bash
    cd node_server
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```
4.  Set up the database by running the Prisma migrations:
    ```bash
    npx prisma migrate dev
    ```

### Prerequisites
```bash
# Required
Node.js 18+
PostgreSQL 14+
Redis 6+

# Optional (for media processing)
FFmpeg
```

### Installation
```bash
# Clone and navigate
git clone <repository-url>
cd NeuraNexus/node_server

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Set up database
npx prisma migrate dev
npx prisma generate

# Start development server
npm run dev
```

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/NeuraNexus"

# JWT Secrets
JWT_ACCESS_SECRET="your-access-secret"
JWT_REFRESH_SECRET="your-refresh-secret"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=8000
NODE_ENV="development"
DOMAIN_NAME="http://localhost:8000"

# File Processing Limits
IMAGE_MAX_SIZE=10
AUDIO_MAX_SIZE=50
DOCUMENT_MAX_SIZE=25
DEFAULT_IMAGE_WIDTH=800
DEFAULT_IMAGE_HEIGHT=600
DEFAULT_IMAGE_QUALITY=80
```

## 📚 API Endpoints

### Authentication (`/api/auth/v1`)
```bash
POST /signup      # User registration
POST /login       # User authentication
GET  /refresh     # Token refresh
GET  /me          # Get current user
```

### File Management (`/api/file/v1`)
```bash
POST /upload           # Upload files
GET  /job/:id          # Check processing status
GET  /files/:id        # Serve file
GET  /thumb/:id        # Serve thumbnail
GET  /documents        # List documents (paginated)
DELETE /documents/:id  # Delete document
```

### Conversations (`/api/conv/v1`)
```bash
GET /getrecentconv     # Get recent conversations
```

### Exchanges (`/api/exch/v1`)
```bash
GET  /getexch         # Get conversation exchanges
POST /createexch      # Create new exchange
```

## 🔧 Core Services

### AuthService
```typescript
// Generate tokens
generateAccessToken(userId: string): string
generateHashRefreshToken(userId: string): Promise<string>

// User management
getSafeUser(user: User): SafeUser
```

### FileService
```typescript
// File processing
processUploadedFiles(files: File[], payload: any, query: any): Promise<Result[]>
processSecureUploadedFiles(files: ValidatedFile[], payload: any, query: any): Promise<Result[]>

// File operations
serveFile(encryptedId: string): Promise<FileData>
serveThumbnail(encryptedId: string): Promise<FileData>
getJobStatus(jobId: string): Promise<JobStatus>
```

## 🔄 Background Processing

### Queue Workers
- **Image Processing**: Compression, resizing, format conversion
- **Audio Processing**: Compression, format conversion  
- **PDF Processing**: Text extraction, thumbnail generation
- **Document Processing**: Text extraction from DOCX, PPTX files
- **Video Processing**: Compression, thumbnail generation

### Queue Configuration
```typescript
const queueConfig = {
  connection: {
    host: 'localhost',
    port: 6379,
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};
```

## 🗃️ Database Schema

### Core Models
```prisma
model User {
  id            String         @id @default(cuid())
  username      String         @unique
  email         String         @unique
  password      String
  role          Role           @default(USER)
  conversations Conversation[]
  tokens        RefreshToken[]
}

model Conversation {
  id        String     @id @default(cuid())
  title     String?
  user      User       @relation(fields: [userId], references: [id])
  userId    String
  exchanges Exchange[]
}

model Exchange {
  id             String       @id @default(cuid())
  userQuery      String
  systemResponse Json
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model Document {
  id                  Int            @id @default(autoincrement())
  documentType        Int
  displayName         String
  documentEncryptedId String         @unique
  status              DocumentStatus @default(PENDING)
  // ... additional fields
}
```

## 🛡️ Security Features

### Input Validation
```typescript
// Zod schemas for request validation
const SignupSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6),
});

const FileUploadSchema = z.object({
  files: z.array(z.any()).min(1),
  // ... additional validation
});
```

### File Security
- **Magic Number Detection**: Verify file types by content, not extension
- **File Size Limits**: Configurable size limits per file type
- **Secure Storage**: Encrypted file identifiers
- **Access Control**: Authentication required for file access

### Authentication Security
- **HTTP-only Cookies**: Prevent XSS attacks
- **Secure Headers**: CORS, CSP, and other security headers
- **Rate Limiting**: Prevent brute force attacks
- **Input Sanitization**: Comprehensive request sanitization

## 📊 Monitoring & Logging

### Request Logging
```typescript
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log('Body:', req.body);
  console.log('Headers:', req.headers);
  next();
});
```

### Error Handling
```typescript
// Global error middleware
app.use(errorMiddleware);

// Custom exception classes
class BadRequestException extends Error
class NotFoundException extends Error
class UnprocessableEntity extends Error
```

## 🧪 Testing

### Unit Tests
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### API Testing
```bash
# Test authentication
curl -X POST http://localhost:8000/api/auth/v1/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"password123"}'

# Test file upload
curl -X POST http://localhost:8000/api/file/v1/upload \
  -H "Authorization: Bearer <token>" \
  -F "files=@test.pdf"
```

## 🚀 Deployment

### Docker Support
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

CMD ["npm", "start"]
```

### Environment Setup
```bash
# Production environment
NODE_ENV=production
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Security
JWT_ACCESS_SECRET="strong-secret"
JWT_REFRESH_SECRET="another-strong-secret"
```

## 📈 Performance Optimization

- **Connection Pooling**: Database connection optimization
- **Query Optimization**: Efficient database queries with proper indexing
- **Caching**: Redis-based caching for frequently accessed data
- **Background Processing**: Non-blocking file processing
- **Compression**: Response compression with gzip

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use Prisma for database operations
3. Implement proper error handling
4. Add comprehensive logging
5. Write unit tests for new features
6. Update API documentation

## 📝 Scripts

```bash
npm run dev          # Development server with nodemon
npm run build        # Compile TypeScript
npm run start        # Production server
npm run test         # Run tests
npm run lint         # Run ESLint
npm run migrate      # Run Prisma migrations
```

---

**Built with ❤️ by Team NeuraNexus**
  }
  ```
- **401 Unauthorized:** If the refresh token is missing.
- **403 Forbidden:** If the refresh token is invalid or expired.

#### `GET /me`

Retrieves the currently authenticated user's information.

**Authentication:** Requires a valid access token in the `access_token` cookie.

**Response:**

- **200 OK:**
  ```json
  {
    "id": 1,
    "email": "test@example.com",
    "username": "testuser"
  }
  ```

#### `GET /getuser`

Retrieves a user by their ID.

**Authentication:** Requires a valid access token in the `access_token` cookie and admin privileges.

**Request Params:**

```json
{
  "email": test@example.com
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "id": 1,
    "email": "test@example.com",
    "username": "testuser",
    "createdAt":"wefr4t4",
    "role":"Eole"
  }
  ```
- **404 Not Found:** If the user is not found.

#### `GET /makeadmin`

Makes a user an admin.

**Authentication:** Requires a valid access token in the `access_token` cookie and admin privileges.

**Request Body:**

```json
{
  "userId": 1
}
```

**Response:**

- **200 OK:**
  ```json
  {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      message: "USER has been promoted to ADMIN"
  }
  ```
- **404 Not Found:** If the user is not found.

### Conversation Routes

Base path: `/api/conv/v1`

#### `GET /getrecentconv`

Retrieves a paginated list of recent conversations for the authenticated user.

**Authentication:** Requires a valid access token in the `access_token` cookie.

**Request Body:**

```json
{
  "page": 1
}
```

**Request Body Schema:**

- `page` (number, required): The page number to retrieve.

**Response:**

- **200 OK:**
  ```json
  {
    "conversations": [
      {
        "id": 1,
        "title": "A new Title",
        "userId": 1,
        "createdAt": "2025-09-30T12:00:00.000Z",
        "updatedAt": "2025-09-30T12:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "totalCount": 1,
      "totalPages": 1
    }
  }
  ```

### Exchange Routes

Base path: `/api/exch/v1`

#### `POST /createexch`

Creates a new exchange within a conversation. If `convId` is not provided, a new conversation is created.

**Authentication:** Requires a valid access token in the `access_token` cookie.

**Request Body:**

```json
{
  "user_query": "Hello, how are you?",
  "convId": 1,
  "convTitle": "My First Conversation"
}
```

**Request Body Schema:**

- `user_query` (string, required): The user's query for the exchange.
- `convId` (number, optional): The ID of the conversation.
- `convTitle` (string, optional): The title for a new conversation. Defaults to "A new Title".

**Response:**

- **200 OK:**
  ```json
  {
    "exchange": {
      "id": 1,
      "userQuery": "Hello, how are you?",
      "systemResponse": "I am a helpful assistant.",
      "conversationId": 1,
      "createdAt": "2025-09-30T12:00:00.000Z",
      "updatedAt": "2025-09-30T12:00:00.000Z"
    },
    "conversation": null
  }
  ```

#### `POST /getexch`

Retrieves a paginated list of exchanges for a given conversation.

**Authentication:** Requires a valid access token in the `access_token` cookie.

**Request Body:**

```json
{
  "conversationId": 1,
  "page": 1
}
```

**Request Body Schema:**

- `conversationId` (number, required): The ID of the conversation.
- `page` (number, required): The page number to retrieve.

**Response:**

- **200 OK:**
  ```json
  {
    "exchanges": [
      {
        "id": 1,
        "userQuery": "Hello, how are you?",
        "systemResponse": "I am a helpful assistant.",
        "conversationId": 1,
        "createdAt": "2025-09-30T12:00:00.000Z",
        "updatedAt": "2025-09-30T12:00:00.000Z"
      }
    ]
  }
  ```

### File Routes

Base path: `/api/file/v1`

#### `POST /upload`

Uploads one or more files. The files are processed in the background.

**Request:** `multipart/form-data`

**Form Data:**

- `files`: The file(s) to upload.

**Response:**

- **200 OK:**
  ```json
  {
    "message": "Files are being processed in background",
    "files": [
      {
        "jobId": "some-job-id",
        "fileType": "1",
        "originalName": "my-document.pdf"
      }
    ]
  }
  ```

#### `GET /job/:id`

Retrieves the status of a background job.

**URL Parameters:**

- `id` (string, required): The ID of the job.

**Query Parameters:**

- `fileType` (string, optional): The type of file. Defaults to `1`.

**Response:**

- **200 OK:**
  ```json
  {
    "status": "completed",
    "progress": 100
  }
  ```

#### `GET /files/:encryptedId`

Serves a file by its encrypted ID.

**URL Parameters:**

- `encryptedId` (string, required): The encrypted ID of the file.

**Response:**

- **200 OK:** The file content with the appropriate `Content-Type` header.

#### `GET /thumb/:encryptedId`

Serves a thumbnail for a file by its encrypted ID.

**URL Parameters:**

- `encryptedId` (string, required): The encrypted ID of the file.

**Response:**

- **200 OK:** The thumbnail image with the appropriate `Content-Type` header.

#### `GET /unprocessed`

Retrieves a list of unprocessed files.

**Response:**

- **200 OK:**
  ```json
  [
    {
      "id": 1,
      "name": "my-document.pdf",
      "encryptedId": "some-encrypted-id"
    }
  ]
  ```

#### `PATCH /update-status`

Updates the status of a file.

**Request Body:**

```json
{
  "encryptedId": "some-encrypted-id",
  "status": "processed"
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "message": "File status updated"
  }
  ```

#### `POST /fetchdocuments`

Retrieves a paginated list of documents.

**Request Body:**

```json
{
  "page": 1
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "documents": [
      {
        "id": 1,
        "name": "my-document.pdf",
        "encryptedId": "some-encrypted-id"
      }
    ],
    "pagination": {
      "page": 1,
      "totalCount": 1,
      "totalPages": 1
    }
  }
  ```

#### `POST /fetchdocumentsbyName`

Retrieves a paginated list of documents by name.

**Request Body:**

```json
{
  "name": "my-document.pdf",
  "page": 1
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "documents": [
      {
        "id": 1,
        "name": "my-document.pdf",
        "encryptedId": "some-encrypted-id"
      }
    ],
    "pagination": {
      "page": 1,
      "totalCount": 1,
      "totalPages": 1
    }
  }
  ```

#### `POST /fetchdocumentsbyID`

Retrieves a paginated list of documents by encrypter ID.

**Request Body:**

```json
{
  "id": "some-encrypted-id",
  "page": 1
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "documents": [
      {
        "id": 1,
        "name": "my-document.pdf",
        "encryptedId": "some-encrypted-id"
      }
    ],
    "pagination": {
      "page": 1,
      "totalCount": 1,
      "totalPages": 1
    }
  }
  ```

#### `DELETE /delete`

Deletes a document by its encrypted ID.

**Request Body:**

```json
{
  "encryptedId": "some-encrypted-id"
}
```

**Response:**

- **200 OK:**
  ```json
  {
    "message": "File deleted successfully"
  }
  ```
