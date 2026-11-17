# Pastebin-Lite

A full-stack text-sharing application built with Next.js App Router, TypeScript, and Upstash Redis. Create a paste, receive a shareable link, and control how long it stays available.

## Features

- **Shareable links:** Create plain-text pastes through the web interface or JSON API.
- **TTL expiry:** Optionally set a lifetime in seconds. Pastes become unavailable at their expiration timestamp.
- **View limits:** Optionally limit successful retrievals. Redis Lua scripts atomically check availability and increment the view count, preventing concurrent requests from exceeding the limit.
- **Deterministic test mode:** Simulate timestamps through a request header to test expiration without waiting.
- **Safe rendering:** Paste content is rendered as escaped plain text.
- **Persistent storage:** Pastes survive across requests and serverless application instances.

## Run locally

### Prerequisites

- Node.js 24 LTS and npm.
- An [Upstash](https://console.upstash.com/) account and Redis database.
- A local checkout of this repository.

### 1. Install dependencies

From the repository root, run:

```sh
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local`:

**macOS / Linux:**

```sh
cp .env.example .env.local
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env.local
```

Open your Redis database in the Upstash console and copy its REST URL and REST token into `.env.local`:

```dotenv
UPSTASH_REDIS_REST_URL=<your-upstash-rest-url>
UPSTASH_REDIS_REST_TOKEN=<your-upstash-rest-token>
TEST_MODE=0
```

Replace the placeholders with your credentials. `.env.local` is ignored by Git and must not be committed. These variables are server-only; do not prefix them with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | HTTPS REST endpoint for your Redis database. |
| `UPSTASH_REDIS_REST_TOKEN` | REST token with permission to read and write paste data. |
| `TEST_MODE` | `0` for normal operation; exactly `1` enables the test clock. |

### 3. Start the application

```sh
npm run dev
```

Open the development URL printed in your terminal. Enter some text, optionally set expiration and view limits, and select **Create paste** to generate a shareable link.

Restart the development server after changing `.env.local`.

## Persistence

Pastebin-Lite uses **Upstash Redis** through `@upstash/redis`. The SDK accesses the managed database over HTTPS, so serverless functions can read and write data without maintaining a long-lived database connection. Data lives outside the application process and remains available when Vercel starts a new function instance.

Pastes are stored as JSON values under unique Redis keys. This implementation needs no relational schema, migration commands, or database connection pool. See the [Upstash connection documentation](https://upstash.com/docs/redis/howto/connect-with-upstash-redis).

Retrieval checks expiration and view limits in a single Lua operation. Each successful API retrieval or HTML page view consumes one view. The final permitted view succeeds with `remaining_views: 0`; subsequent requests return HTTP 404.

Expiration is enforced explicitly using stored timestamps rather than Redis native TTL. Expired and exhausted records currently remain in Redis; access expiration does not delete the underlying data. Storage cleanup requires a separate retention process.

## Deterministic test mode

Set `TEST_MODE=1` and include an `x-test-now-ms` header containing an integer Unix timestamp in milliseconds on paste creation or retrieval requests:

```http
x-test-now-ms: 1700000000000
```

For creation, this timestamp determines the TTL expiration baseline. For retrieval, it determines whether the paste has expired. `created_at_ms` always uses the real system clock. Missing or invalid headers fall back to `Date.now()`. The header is ignored unless `TEST_MODE` is exactly `1`.

Use a consistent simulated timeline when creating and retrieving test pastes. Keep `TEST_MODE=0` in production.

## API reference

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/healthz` | Checks Redis. Returns `200` with `{ "ok": true }`, or `503` if unavailable. |
| `POST` | `/api/pastes` | Creates a paste and returns `201` with `{ id, url }`. Invalid input returns `400`. |
| `GET` | `/api/pastes/[id]` | Consumes one view and returns `{ content, remaining_views, expires_at }`, or `404` when unavailable. |
| `GET` | `/p/[id]` | Consumes one view and renders escaped plain text, or displays a 404 page. |

Example creation body:

```json
{
  "content": "Hello from Pastebin-Lite!",
  "ttl_seconds": 3600,
  "max_views": 10
}
```

`content` must be a non-empty string. `ttl_seconds` and `max_views` are optional positive safe integers; omit either field to leave that limit unrestricted. Share URLs use the incoming request's origin, so no deployment domain needs to be hardcoded.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com/), create a new project and import the repository.
3. Confirm the **Next.js** framework preset and use the repository root as the project root. The build command is `npm run build`.
4. Before deploying, add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` with your Upstash credentials, and set `TEST_MODE=0`.
5. Apply the variables to **Production**, and to **Preview** if preview deployments need database access. Separate databases for testing and production keep paste data isolated.
6. Select **Deploy**. No migration step is required.
7. Open the deployment URL and check `/api/healthz`. A successful connection returns `{ "ok": true }`.

To change variables later, open **Settings → Environment Variables**, save the changes, and redeploy. Updated variables apply to new deployments. See Vercel's [Git deployment guide](https://vercel.com/docs/git) and [environment variable documentation](https://vercel.com/docs/environment-variables).

## Development checks

```sh
npm test
npm run typecheck
npm run build
```

The unit tests mock the Redis boundary. Live Redis integration and concurrency testing require a configured Upstash database.

To serve a production build locally:

```sh
npm run build
npm start
```
