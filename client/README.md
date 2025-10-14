# 🎨 Next.js Frontend Client

> **Modern, responsive web application providing an intuitive interface for the NeuraNexus RAG platform with real-time chat, file management, and admin capabilities.**

## 📋 Overview

The Next.js client is the user-facing interface of the NeuraNexus platform, offering a sophisticated chat experience, comprehensive file management, and powerful admin tools. Built with Next.js 15 and React 19, it provides a seamless and performant user experience with modern design patterns.

## ✨ Features

### 💬 **Intelligent Chat Interface**
- **Multi-Modal AI Chat**: Interface for interacting with Gemma3:4b LLM and hybrid search
- **Real-time Streaming**: Live response generation with Server-Sent Events
- **Message Threading**: Organized conversation history with context preservation
- **Citation Display**: Interactive source references with file links
- **AI-Powered File Processing**: Upload images, audio, PDFs with BLIP, YOLO, Vosk analysis
- **File Upload in Chat**: Direct file sharing within conversations with automatic AI processing
- **Typing Indicators**: Visual feedback during response generation
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

### 🔐 **Authentication System**
- **Secure Login/Signup**: JWT-based authentication with form validation
- **Protected Routes**: Automatic redirection for unauthorized access
- **User Profile Management**: Account settings and profile updates
- **Session Management**: Persistent login with refresh token handling
- **Role-based Access**: Different interfaces for users and administrators

### 📁 **File Management**
- **Drag & Drop Upload**: Intuitive file upload interface
- **Multi-format Support**: Images, PDFs, audio files, and documents
- **File Preview**: In-browser preview for various file types
- **Upload Progress**: Real-time upload status and progress tracking
- **File Organization**: Search, filter, and pagination capabilities
- **Thumbnail Generation**: Smart preview images for uploaded files

### 👨‍💼 **Admin Dashboard**
- **User Management**: User creation, editing, and role assignment
- **File Administration**: Complete file system management
- **System Overview**: Statistics and system health monitoring
- **Bulk Operations**: Multi-file actions and batch processing
- **Access Control**: Admin-only features and restricted areas

### 🎨 **Modern UI/UX**
- **Dark/Light Theme**: Elegant theme switching with system preference detection
- **Responsive Layout**: Mobile-first design with adaptive components
- **Smooth Animations**: Framer Motion powered transitions and interactions
- **Loading States**: Comprehensive loading indicators and skeleton screens
- **Error Handling**: User-friendly error messages and retry mechanisms

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│             Next.js App Router          │
├─────────────────────────────────────────┤
│  Auth Pages  │  Chat UI   │  Admin UI   │
├─────────────────────────────────────────┤
│  Components  │  Services  │  Contexts   │
├─────────────────────────────────────────┤
│  API Client  │  Auth      │  File Mgmt  │
└─────────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Runtime**: React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **State Management**: React Context + Hooks
- **HTTP Client**: Axios
- **Forms**: React Hook Form + Zod validation
- **Icons**: Heroicons + Lucide React
- **AI Integration**: 
  - Interface for Gemma3:4b LLM via Node.js API
  - Multi-modal file processing (BLIP, CLIP, YOLO, Vosk)
  - Hybrid search with BM25 + Vector similarity
  - Real-time streaming responses

## 🚀 Getting Started

### Prerequisites
```bash
# Required
Node.js 18+
npm or yarn

# Optional
Vercel CLI (for deployment)
```

### Installation
```bash
# Clone and navigate
git clone <repository-url>
cd NeuraNexus/client

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Variables
```env
# API Endpoints
NEXT_PUBLIC_API_URL="http://localhost:8000"
NEXT_PUBLIC_PYTHON_API_URL="http://localhost:5000"

# Authentication
NEXT_PUBLIC_JWT_SECRET="your-jwt-secret"

# Application
NEXT_PUBLIC_APP_NAME="NeuraNexus"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```

## 📁 Project Structure

```
client/
├── public/                 # Static assets
│   ├── icons/             # App icons and favicons
│   └── images/            # Static images
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── globals.css    # Global styles
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   ├── login/         # Authentication pages
│   │   ├── signup/        
│   │   └── admin/         # Admin dashboard
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   ├── ChatWindow.tsx # Main chat interface
│   │   ├── Sidebar.tsx   # Navigation sidebar
│   │   ├── Header.tsx    # Application header
│   │   └── withAuth.tsx  # HOC for authentication
│   ├── context/          # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ChatContext.tsx
│   ├── service/          # API services
│   │   ├── api.ts        # Base API client
│   │   ├── auth.ts       # Authentication services
│   │   ├── conv.ts       # Conversation services
│   │   ├── exch.ts       # Exchange services
│   │   └── file.ts       # File services
│   ├── lib/              # Utility libraries
│   │   ├── utils.ts      # Common utilities
│   │   └── db.ts         # Database utilities
│   ├── types/            # TypeScript definitions
│   └── models/           # Data models
├── components.json        # shadcn/ui configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── next.config.ts         # Next.js configuration
└── tsconfig.json         # TypeScript configuration
```

## 🔧 Key Features Deep Dive

### Chat System
The chat interface provides a seamless conversational experience:

- **Real-time Streaming**: Responses are streamed in real-time using Server-Sent Events
- **Conversation Management**: Automatic conversation creation and management
- **File Integration**: Upload and reference files directly in conversations
- **Citation System**: Clickable citations with source file references

### Authentication System
Secure authentication with JWT tokens:

```typescript
// AuthContext provides global auth state
const { isAuthenticated, user, login, logout } = useAuth();

// withAuth HOC protects routes
export default withAuth(ProtectedComponent);
```

### State Management
Efficient state management with React Context:

```typescript
// ChatContext manages conversation state
const { 
  exchanges, 
  convId, 
  setConvId, 
  refreshConversations 
} = useChat();
```

### API Integration
Modular API services for different functionality:

```typescript
// Authentication
await login(email, password);
await signup(username, email, password);

// Chat operations
await createExchange(query, convId, title);
await getExchanges(convId, page);

// File operations
await uploadFile(files);
await getJobStatus(jobId);
```

## 🎨 UI Components

### Core Components

**ChatWindow**: Main chat interface
- Message threading and history
- Real-time response streaming
- File upload integration
- Infinite scroll for message history

**Sidebar**: Navigation and conversation list
- Recent conversations display
- New chat creation
- Conversation search and filtering
- Responsive design for mobile

**Header**: Application header
- User profile access
- Sidebar toggle
- Application branding
- Responsive navigation

**MessageBubble**: Individual message display
- User and assistant message styling
- Citation rendering
- File attachment display
- Timestamp formatting

### Admin Components

**FileUpload**: Complete file management interface
- Drag & drop file upload
- File preview and management
- Upload progress tracking
- File type filtering

**AdminUserManager**: User administration
- User creation and editing
- Role management
- User activity monitoring

## 🚀 Performance Optimizations

- **Next.js 15**: Latest framework features with Turbopack
- **Image Optimization**: Automatic image optimization and lazy loading
- **Code Splitting**: Automatic code splitting for optimal loading
- **Caching**: Efficient API response caching
- **SSR**: Server-side rendering for improved SEO and performance

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first design approach
- Adaptive layouts for all screen sizes
- Touch-friendly interfaces
- Progressive web app capabilities

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Docker
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

## 🔧 Development Scripts

```bash
npm run dev          # Development server with hot reload
npm run build        # Build for production
npm run start        # Start production server  
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## 🤝 Contributing

1. Follow React and Next.js best practices
2. Use TypeScript for all new components
3. Implement proper error boundaries
4. Add comprehensive prop types
5. Write unit tests for components
6. Update documentation for new features

---

**Built with ❤️ by Team NeuraNexus**

To start the development server, run:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Folder Structure

```
client/
├── public/                 # Static assets
├── src/
│   ├── app/                # Next.js app directory
│   │   ├── (auth)/         # Authentication pages (login, signup)
│   │   ├── (main)/         # Main application pages
│   │   ├── globals.css     # Global styles
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # Reusable UI components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── ChatInput.tsx
│   │   ├── ChatWindow.tsx
│   │   ├── Header.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── Sidebar.tsx
│   │   └── withAuth.tsx
│   ├── context/            # React context providers
│   │   ├── AuthContext.tsx
│   │   └── ChatContext.tsx
│   ├── lib/                # Library functions and utilities
│   │   ├── db.ts
│   │   └── utils.ts
│   ├── models/             # Data models
│   │   └── User.ts
│   └── service/            # API service layer
│       ├── api.ts
│       ├── auth.ts
│       ├── conv.ts
│       ├── exch.ts
│       └── file.ts
├── .env.local              # Environment variables
├── next.config.js          # Next.js configuration
└── package.json            # Project dependencies and scripts
```

## Core Technologies

- **Framework:** [Next.js](https://nextjs.org/) (React)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **State Management:** React Context API
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Linting:** [ESLint](https://eslint.org/)

## Authentication Flow

The authentication system is designed to be secure and robust, providing a seamless experience for users while protecting sensitive data and routes.

### 1. Login and Signup

- **User Credentials:** Users can sign up for a new account or log in with their existing credentials (email and password).
- **Token Issuance:** Upon successful authentication, the backend server issues two tokens:
  - `access_token`: A short-lived (15 minutes) JWT used to authenticate API requests.
  - `refresh_token`: A long-lived (7 days) token used to obtain a new `access_token` when the current one expires.
- **Cookie Storage:** Both tokens are sent as **HttpOnly cookies**, which means they are automatically and securely stored by the browser and are not accessible to client-side JavaScript. This is a critical security measure to prevent Cross-Site Scripting (XSS) attacks.

### 2. Session Management

- **`AuthContext`:** The `AuthContext` is the cornerstone of session management on the client. It provides the authentication state (`isAuthenticated`, `user`, `loading`) to all components wrapped within the `AuthProvider`.
- **Initial Load:** When the application first loads, the `AuthProvider` makes a request to the `/auth/v1/me` endpoint. Since the authentication tokens are stored in HttpOnly cookies, the browser automatically includes them in the request. If the request is successful, the user's data is stored in the context, and the `isAuthenticated` state is set to `true`.

### 3. Protected Routes

Route protection is implemented at two levels:

>>>>>>> test_client
- **Middleware (`middleware.ts`):** A Next.js middleware runs on the server side before any page is rendered. It checks for the presence of the `accessToken` cookie. If the cookie is not present, the user is immediately redirected to the `/login` page. This provides a strong, server-side guard for all protected routes.
- **`withAuth` HOC:** The `withAuth` Higher-Order Component provides an additional layer of protection on the client side. It wraps protected pages and ensures that the user is authenticated before rendering the component. It also displays a loading state while the authentication status is being verified.
### 4. Automated Token Refresh

To provide a seamless user experience, the application automatically refreshes the `access_token` without requiring the user to log in again.

- **Axios Interceptor:** An Axios interceptor is configured in `src/service/api.ts`. This interceptor automatically catches any API request that fails with a `401 Unauthorized` status code.
- **Refresh Process:**
  1. When a `401` error is detected, the interceptor pauses the original request and sends a new request to the `/auth/v1/refresh` endpoint.
  2. The browser automatically includes the `refresh_token` cookie in this request.
  3. If the `refresh_token` is valid, the backend responds with a new `access_token`.
  4. The interceptor updates the `Authorization` header of the original failed request with the new `access_token` and retries the request.
- **Refresh Failure:** If the `refresh_token` is also expired or invalid, the refresh request will fail. In this case, the interceptor will automatically redirect the user to the `/login` page, effectively logging them out.

## API Interaction

The client communicates with the backend via a RESTful API. All API-related logic is centralized in the `src/service` directory.

- **`api.ts`:** This file contains the main Axios instance, including the base URL and the response interceptor for token refreshing.
- **`auth.ts`:** This service handles all authentication-related API calls, including `login`, `signup`, `logout`, `refreshToken`, and `getMe`.
- **`conv.ts`:** This service is responsible for fetching conversation data, such as the list of recent conversations.
- **`exch.ts`:** This service manages the chat exchanges, including fetching previous messages and creating new ones.

## State Management

The application uses React's Context API for global state management, ensuring a clear and predictable data flow.

- **`AuthContext`:** Manages the global authentication state, including the user's profile and authentication status.
- **`ChatContext`:** Manages the state of the chat interface, including the current conversation ID, title, and the list of exchanges.

## Component Structure

The UI is built with a modular and reusable component architecture.

- **`Sidebar.tsx`:** Displays the list of recent conversations and includes a "New Chat" button. It features infinite scrolling to load more conversations as the user scrolls.
- **`ChatWindow.tsx`:** The main chat interface where users interact with the assistant. It displays the conversation history and includes the chat input field. It also features infinite scrolling to load older messages.
- **`ChatInput.tsx`:** A controlled component for typing and sending messages, including support for image uploads.
- **`MessageBubble.tsx`:** Renders individual chat messages for both the user and the assistant.
- **`Header.tsx`:** The main application header, which includes a button to toggle the sidebar.