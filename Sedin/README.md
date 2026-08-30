# ReachInbox Full-Stack Email Job Scheduler

A production-grade distributed email job scheduler built with TypeScript, Node.js, Express, BullMQ, Redis, MySQL (Prisma), Elasticsearch, and React.

## Project Structure

- `backend/`: Express server, BullMQ queues/workers, Prisma models, and Elasticsearch indexing.
- `frontend/`: React, TypeScript, and Tailwind CSS client interface.
- `infrastructure/`: Docker Compose settings for local services (MySQL, Redis, Elasticsearch).
- `docs/`: Audits, architectural decisions, and setup logs.

## Setup Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js (v18+ recommended)
- NPM

### 1. Infrastructure
Run the following to start the external dependencies:
```bash
cd infrastructure
docker compose up -d
```

### 2. Configuration
Copy the `.env.example` to a local `.env` and fill out client IDs/secrets:
```bash
cp .env.example .env
```

### 3. Backend Setup
Install and run backend:
```bash
cd backend
npm install
npm run prisma:migrate
npm run dev
```

### 4. Frontend Setup
Install and run frontend:
```bash
cd frontend
npm install
npm run dev
```

## Admin Portal (Bull Board)

Mounted at `GET /admin/queues`, showing live job state for both the `email-send` and `email-reindex` BullMQ queues (the same real queues the worker processes — nothing separate or mocked).

**Access model — single-admin, not per-owner scoping.** Access requires two things, both enforced server-side:
1. A valid session (same `requireAuth` check used everywhere else).
2. The logged-in user's email must exactly match the `ADMIN_EMAIL` environment variable.

Every other authenticated user gets `403 Forbidden`; unauthenticated requests get `401`. There is no per-user/per-owner queue scoping in Bull Board — whoever's email matches `ADMIN_EMAIL` sees *all* jobs from *all* users, by design (this is an internal ops dashboard, not a user-facing feature). Set `ADMIN_EMAIL` in your `.env` to the Google account email you'll use as the admin.

### How this was verified
`backend/scripts/test-bullboard-admin.ts` spins up a real Express app with the real `requireAdmin` middleware and the real `bullBoardRouter` (backed by real BullMQ queues against a real Redis), and confirms:
- No session → `401`
- A logged-in user whose email ≠ `ADMIN_EMAIL` → `403`
- A logged-in user whose email = `ADMIN_EMAIL` → `200` with the actual Bull Board HTML

Only the single `prisma.user.findUnique` lookup inside `requireAuth` is stubbed (no MySQL was available in the sandbox this was built in) — the auth/admin logic itself is exercised unmodified. Run it yourself with:
```bash
redis-server --daemonize yes --port 6399
REDIS_PORT=6399 npx ts-node --transpile-only backend/scripts/test-bullboard-admin.ts
```

### Note on the Prisma client and binaryTargets
This repo's committed Prisma client was originally generated on Windows. I added `binaryTargets = ["native", "debian-openssl-3.0.x"]` to `schema.prisma` so it also works if you ever run the backend on Linux/Docker/CI — run `npx prisma generate` (from `backend/`) after pulling this change to pick it up. (I couldn't regenerate it myself in the sandbox this was built in — `binaries.prisma.sh` wasn't reachable there — so this needs a `prisma generate` on your end to take effect.)

## Slack Integration Setup (required to test Phase 10)

The Slack OAuth connect flow and the rate-limit notification are fully implemented against Slack's real API — nothing is mocked. To actually exercise them you need a real Slack app and workspace:

1. Go to https://api.slack.com/apps → **Create New App** → "From scratch". Pick any name and pick your own (or a throwaway) workspace as the install target.
2. In **OAuth & Permissions**, under **Redirect URLs**, add exactly:
   `http://localhost:9000/api/slack/callback`
3. Still in **OAuth & Permissions**, under **Scopes → Bot Token Scopes**, add:
   - `chat:write`
   - `incoming-webhook`
4. Go to **Incoming Webhooks** and toggle it **On**. This is what makes Slack show a channel picker during install and return a `channel_id` we can post to — without it, the callback will fail with a clear error telling you this scope is missing.
5. Copy the **Client ID** and **Client Secret** from **Basic Information** into your `.env`:
   ```
   SLACK_CLIENT_ID=<your client id>
   SLACK_CLIENT_SECRET=<your client secret>
   SLACK_REDIRECT_URI=http://localhost:9000/api/slack/callback
   ```
6. Restart the backend, log in, then visit `http://localhost:9000/api/slack/connect`. You'll be sent to Slack's real consent screen, asked to pick a channel, and redirected back — the connection (team, channel, encrypted bot token) is stored against your user.
7. To see a real notification: set a sender's `hourlyLimit` very low (e.g. 2) and schedule several emails for immediate delivery. Once the worker's Lua rate-limit script rejects a job specifically because the **hourly cap** was exceeded (not the min-delay check), it calls Slack's real `chat.postMessage` API — you'll see the message land in the channel you picked in step 6.

### What was verified without live Slack credentials
Since this environment has no Slack app of its own, the following were verified directly against the real code (not reimplemented/faked), using a real local Redis instance:
- `backend/scripts/test-ratelimit-lua.js` — loads the actual rate-limit Lua script and confirms a min-delay rejection reports `isHourlyCap=0` while an hourly-cap rejection reports `isHourlyCap=1`.
- `backend/scripts/test-slack-dedup.js` — simulates 50 concurrent hourly-cap rejections for the same sender/hour window against a real Redis and confirms exactly one wins the `SET slack-notified:{senderId}:{hourBucket} 1 NX EX <ttl>` dedup lock (i.e. exactly one would call the real Slack API), that a further burst in the same window produces zero additional notifications, and that a different hour bucket is unaffected.
- `backend/scripts/test-slack-state.ts` — calls the real `slackCallback` controller directly with a missing `state` and a tampered `state`, confirming both are rejected with `400`.

These can be re-run any time with:
```bash
redis-server --daemonize yes --port 6399
REDIS_PORT=6399 node backend/scripts/test-ratelimit-lua.js
REDIS_PORT=6399 node backend/scripts/test-slack-dedup.js
npx ts-node --transpile-only backend/scripts/test-slack-state.ts
```
What was **not** verified in this environment (needs your real Slack workspace per the steps above): the full end-to-end OAuth token exchange, and an actual message landing in a live Slack channel.

## Frontend (Phases 12–15)

React + Vite + TypeScript + Tailwind CSS, in `frontend/`. Strongly typed throughout (no `any`), session-cookie auth via `withCredentials: true` (no tokens in `localStorage`).

### Design source: Figma access limitation, then a screenshot-based revision pass
The assignment's Figma file (`Outbox Labs Assignment`) could not be opened from this environment — `figma.com` returns a `ROBOTS_DISALLOWED` error to automated fetches here, so the mockups, spacing, and color values weren't visible during the original build (Phases 0–15). Per the fallback instruction, no details were invented. Instead an original, deliberate visual system was built from scratch: a "dispatch/manifest" theme (steel-blue primary, status-coded amber/green/red/gray for SCHEDULED/SENT/FAILED/CANCELLED, IBM Plex Sans for headings, Inter for body copy, IBM Plex Mono for job IDs/timestamps/emails), factored so that `Header`, `Sidebar`, `DataTable`, `StatusBadge`, etc. are largely a Tailwind-config-only change away from matching a real design source.

**That real design source arrived afterward**, as seven screenshots exported directly from the Figma file (Login, Homepage/list in two states, Compose, the "Send Later" popover, and an email-detail view) — `figma.com` still isn't reachable from this environment, but the screenshots let the palette, shapes, and layout be matched from actual pixels rather than guessed. That revision pass changed:
- **Primary accent**: steel-blue → **green**, sampled directly from the screenshots' solid button fill (`rgb(0, 166, 62)` / `#00A63E`, used as the `brand-500` token in `tailwind.config.js`; the rest of the 50–900 scale is generated around that one sampled value, not extracted Figma tokens, since only rendered pixels were available, not a dev-mode inspector). Applied via a global `steel-*` → `brand-*` class rename plus the config swap.
- **Shape**: buttons moved to fully pill-shaped (`rounded-full`), inputs/cards to a slightly larger radius (`rounded-lg`), status badges to pill chips, card shadows lightened toward flat/bordered — all matching what the screenshots show.
- **Layout**: the user profile menu and a prominent outline "Compose" button moved from the top header into the sidebar, under a plain wordmark (no icon-box lockup), with nav grouped under a "Core" label — matching the Homepage screenshots' left rail. The top header now only renders on mobile (where the sidebar is hidden) so logout stays reachable everywhere; desktop no longer shows it, matching the chromeless top of the Figma homepage. The screenshots show a live count badge next to "Scheduled"/"Sent" in the nav — that wasn't added, since populating it correctly would mean new count-fetching logic on every page load, not a styling change; the nav rows are styled to accommodate a badge later without one being wired now.
- **Compose form**: detected recipients now render as green outline pill chips (still populated from the same upload-parsed `parsed.valid` state — no new manual add/remove interaction was added) instead of a plain sentence, and the sender/hourly-limit info line was restyled to sit as a bordered chip-like row.

Typography (font family/weights) was **not** changed — screenshot resolution wasn't sufficient to confidently read exact family/weight/line-height off pixels, and there's no dev-mode inspector output for this file, so the existing IBM Plex Sans / Inter / IBM Plex Mono system was kept rather than guess a replacement.

**Deliberately out of scope for this pass** (visual language adopted — green, pill shapes, chip styling, spacing — but not the underlying functionality, since building any of these would mean UI wired to nothing, which the project's operating rules forbid):
- **Email/password login fields.** The Login screenshot shows an "or sign up through email" divider plus Email ID/Password inputs and a second Login button. The backend only implements Google OAuth (see the demo script — "Google login → dashboard"); there's no email/password endpoint. The login page keeps only the Google button, restyled as the green outline pill the screenshot shows for it.
- **Live "Delay between 2 emails" / "Hourly Limit" inputs on the compose form.** This is the same, already-documented deviation described below — the real `/schedule` endpoint has no such fields. The read-only "capped at X/hr, delay enforced automatically" line stays, just repositioned/restyled to sit where the screenshot places that information.
- **Rich-text compose toolbar.** The screenshot shows a bold/italic/underline/list/quote formatting bar under the body field. The compose body is currently a plain `<textarea>`; adding real formatting would change the stored body from plain text to HTML, which is a data-model change, not a style change. Noted here as a legitimate **future-scope item** — a real implementation would need the body field's format (and however it's rendered in the sent email) reconsidered end-to-end — but it wasn't built in this pass.
- **"Send Later" popover with date/time quick-picks** ("Tomorrow", "Tomorrow, 10:00 AM", etc.). The compose form keeps the native `datetime-local` input, restyled toward the screenshot's input aesthetic, rather than building a bespoke popover component.
- **Email detail/reading view.** The screenshots include a full click-through "open email" screen; nothing in the phase plan calls for one, and the app currently only ever shows emails as table rows. No detail page/route was added.

The homepage/list screenshots also show a single combined search-and-list view with no visible Sender column, no per-row Cancel/Retry actions, and no pagination controls. Rather than collapse the app's three pages (Dashboard/Scheduled/Sent, each backed by the shared `EmailStatusExplorer` with its `DataTable`, search, status filter, cancel/retry actions, and pagination) into one page to match that literally, the existing structure was kept and restyled in place — the Sender column, actions, and pagination are real, working functionality that the screenshots simply may not have needed to depict.

### Two real API contract deviations from the original phase plan
While building the frontend I read the actual controllers (not the phase-4 route list) to get exact request/response shapes, and found two places where the real backend differs from what was originally scoped. The frontend is built against the real contracts:

1. **Email routes.** There is no `GET /api/emails/scheduled`, `GET /api/emails/sent`, or `GET /api/emails/:id`. The real route is a single filterable `GET /api/emails/?status=&search=&page=&limit=`, plus bonus `POST /api/emails/:id/cancel` and `POST /api/emails/:id/retry`. The Scheduled and Sent pages both call the same endpoint with a different `status` filter.
2. **Sender updates.** `PUT /api/senders/:id`, not `PATCH`.

### A control I deliberately did *not* build
The original brief asked for "delay" and "hourly limit" fields on the compose form. The real `POST /api/emails/schedule` endpoint only accepts `senderId`, `recipients`, `subject`, `body`, `scheduledAt` — there is no per-schedule delay or hourly-limit field to send. Rate limiting and minimum delay are enforced automatically by the worker's Lua script from `MIN_EMAIL_DELAY_MS` / `MAX_EMAILS_PER_HOUR_PER_SENDER`, and the hourly cap is actually a property of the **sender** (`Sender.hourlyLimit`, set once when the sender profile is created). Adding delay/hourly-limit inputs to the compose form would have been a decorative control wired to nothing, which the project's operating rules explicitly forbid. Instead, the compose form shows the selected sender's real hourly limit as read-only context and explains that delay/rate-limiting happen automatically.

### Structure
```
frontend/src
  components/   Button, Input/Textarea/Select, Modal, DataTable, StatusBadge, Toast,
                Loading/TableSkeleton, EmptyState, ErrorState, FileUploader, Header,
                Sidebar, MobileNav, AppLayout, Pagination
  pages/        Login, Dashboard, ComposeEmail, ScheduledEmails, SentEmails
  features/
    auth/       AuthContext (wraps /auth/me, /auth/logout), ProtectedRoute
    compose/    ComposeForm (+ inline "add sender" modal)
    emails/     EmailStatusExplorer — shared table (search, status filter, pagination,
                cancel/retry actions) reused by Dashboard, ScheduledEmails, SentEmails
    slack/      SlackConnectionWidget (connect/status/disconnect)
    search/     GlobalSearch (Elasticsearch-backed /api/emails/search, surfaces the
                isElasticsearchDown flag if ES is unreachable)
  hooks/        useEmailList, useSenders, useSlackStatus, useDebounce
  services/     api.ts (axios client, normalizes every failure into ApiError),
                authService, emailService, senderService, slackService
  types/        mirrors backend/prisma/schema.prisma + the {success,data}/{success,error}
                response envelope used by every controller
```

Every visible control is wired to a real endpoint verified against the backend source — there are no static numbers or no-op buttons. Client-side CSV/TXT recipient parsing (`utils/parseRecipients.ts`) gives immediate "Detected N email addresses" feedback, but the backend's own zod validation is still the source of truth: `ComposeForm` catches `VALIDATION_ERROR` responses and maps the zod `error.format()` shape onto the same field-level error UI used for client-side errors, so a recipient that slips past client parsing (or a rejected subject/body) still surfaces clearly.

### Running it
```bash
cd frontend
cp .env.example .env   # optional — defaults to http://localhost:9000
npm install
npm run dev            # http://localhost:5173, proxies /api, /auth, /admin to :9000
```

### What was verified in this environment
- `npx tsc --noEmit` — clean, no type errors.
- `npm run build` — production Vite build succeeds (`dist/` output, ~86KB gzipped JS).
- `npm run dev` — dev server boots and serves the login page.

### What was **not** verified in this environment
This sandbox has no Docker, MySQL, or Elasticsearch available, so I could not run the full stack end-to-end (real Google login → dashboard → compose → scheduled → sent) here. Every API call the frontend makes was instead checked line-by-line against the real controller/route/repository code (Zod schemas, response envelopes, status codes) rather than against the phase-4 route list, so the contracts should match exactly — but you should still smoke-test the full flow once your Docker services are up, per the setup instructions above.
