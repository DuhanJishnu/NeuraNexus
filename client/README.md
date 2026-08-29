# NeuraNexus Next.js client

The client provides text chat, streamed grounded responses, citations,
conversation history, authentication, and an administrator interface for files
and user promotion.

## Architecture

```mermaid
flowchart TD
    Pages[Next.js App Router pages]
    Context[Auth and chat contexts]
    Services[Typed Axios and SSE services]
    Proxy[/backend rewrite]
    Node[Node API]

    Pages --> Context
    Context --> Services
    Services --> Proxy
    Proxy --> Node
```

The browser uses the relative `/backend` prefix. Next.js rewrites that prefix to
the server-only `BACKEND_ORIGIN`. This is a small backend-for-frontend boundary:
the browser sees one Vercel origin, HTTP-only cookies remain first-party, and
the actual Render hostname is not compiled into browser code.

## Implemented features

- Signup, login, token refresh, logout, and protected routes.
- Frontend and API role checks for the admin dashboard.
- Conversation history with pagination and new-conversation handling.
- Resumable EventSource streaming with inactivity timeouts and bounded retry.
- Grounded Markdown answers and protected file citations.
- Admin file upload, status, search, preview, pagination, and deletion.
- User lookup and promotion to the `ADMIN` role.
- Responsive layouts, keyboard-safe chat input, accessible controls, and
  reduced-motion support.

The chat input is text-only. Multimodal processing occurs through the admin
file-ingestion workflow, not by attaching images directly to a chat message.

## Local development

```bash
cp env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`. The default configuration proxies
`/backend/*` to `http://localhost:8000/*`.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `BACKEND_ORIGIN` | Server/build only | Node API origin used by the Next.js rewrite |
| `NEXT_PUBLIC_BASEURL` | Browser | API prefix; use `/backend` |
| `NEXT_PUBLIC_FILE_BASE_URL` | Browser | Protected file prefix; use `/backend` |

Local example:

```env
BACKEND_ORIGIN=http://localhost:8000
NEXT_PUBLIC_BASEURL=/backend
NEXT_PUBLIC_FILE_BASE_URL=/backend
```

Production example:

```env
BACKEND_ORIGIN=https://YOUR-API.onrender.com
NEXT_PUBLIC_BASEURL=/backend
NEXT_PUBLIC_FILE_BASE_URL=/backend
```

Never place JWT secrets, Gemini keys, Redis credentials, database URLs, Upstash
tokens, or service tokens in a `NEXT_PUBLIC_*` variable. Public variables are
embedded into the client build.

Directly setting the public base URL to a Render hostname is discouraged. It
creates cross-site cookie behavior, breaks the frontend middleware's session
visibility, and depends on browser third-party-cookie policy.

## Source layout

```text
src/
├── app/                 App Router pages and admin dashboard
├── components/          Chat, navigation, citations, and shared UI
├── config/              Validated public runtime/build configuration
├── context/             Authentication and chat state
├── service/             Auth, conversation, exchange, file, and API clients
├── types/               Exchange, citation, and response contracts
└── middleware.ts        Early protected-route redirect
```

The middleware only checks whether an auth cookie exists. Node remains the
security authority and validates token signatures, expiry, users, ownership,
and roles on every protected request.

## Streaming behavior

1. The client creates an exchange through Axios.
2. It opens an EventSource for the returned response ID.
3. Answer chunks update the optimistic exchange.
4. Every SSE event records its Redis stream ID.
5. A reconnect requests events after the last received ID, preventing duplicate
   text.
6. The final event persists answer and citation metadata.

Streams are explicitly closed on unmount and have a 45-second inactivity timer.

## Vercel deployment

1. Import the repository into Vercel.
2. Set **Root Directory** to `client`.
3. Keep the detected Next.js framework, install command, and build command.
4. Add the three production variables shown above.
5. Deploy.
6. Add the resulting Vercel origin to the Node service's `CORS_ORIGINS` and
   redeploy Node.

The rewrite is configured in [`next.config.ts`](next.config.ts). Vercel Hobby is
free for personal, non-commercial projects and includes automatic Git deploys
and HTTPS. See the root [deployment runbook](../README.md#free-deployment-vercel--render)
for the complete provider creation order and free-tier caveats.

## Validation

```bash
npm ci
npm run lint
npm run typecheck
BACKEND_ORIGIN=http://localhost:8000 \
NEXT_PUBLIC_BASEURL=/backend \
NEXT_PUBLIC_FILE_BASE_URL=/backend \
npm run build
npm audit
```

The production build intentionally fails when required public configuration is
missing or malformed.
