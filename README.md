# ServiQ Backend

Production-ready Node.js + Express + MongoDB backend for **ServiQ** — a WhatsApp-first hyperlocal services marketplace (plumbers, electricians, AC techs, mechanics, cleaners, carpenters, repair pros).

## Stack

- Node.js 18+ / Express 4
- MongoDB + Mongoose
- JWT auth (Admin / Technician / Customer)
- Cloudinary uploads (images & videos)
- WhatsApp Cloud API (webhook + send) — stubbed; drop in your token
- Socket.IO for live ops updates
- Helmet, CORS, rate limiting, Joi validation

## Quick start

```bash
cp .env.example .env       # fill in MONGO_URI, JWT_SECRET, etc.
npm install
npm run seed               # optional: seed admin + services + sample data
npm run dev                # http://localhost:5000
```

Default admin (after seed): `admin@serviq.in` / `Admin@123`

## Folder structure

```
server/
├── app.js                # Express bootstrap + Socket.IO
├── config/               # db, cloudinary, env, logger
├── constants/            # enums (statuses, roles)
├── controllers/          # thin HTTP layer
├── services/             # business logic
├── models/               # Mongoose schemas
├── routes/               # Express routers, mounted at /api/v1/*
├── middleware/           # auth, role, error, rate-limit, upload
├── validations/          # Joi schemas
├── helpers/              # response, pagination
├── utils/                # jwt, asyncHandler, ApiError
├── sockets/              # Socket.IO handlers
├── jobs/                 # seed + background tasks
└── uploads/              # local fallback storage
```

## REST API (base: `/api/v1`)

### Auth
- `POST /auth/admin/login`            — admin login
- `POST /auth/technician/login`       — technician login (phone + password)
- `POST /auth/technician/register`    — technician self-signup (admin can also create)
- `GET  /auth/me`                     — current user (any role)

### Bookings
- `POST   /bookings`                  — create (public / WhatsApp / admin)
- `GET    /bookings`                  — list (filters, pagination, search, sort) — admin
- `GET    /bookings/:id`              — booking detail
- `PATCH  /bookings/:id/assign`       — assign technician — admin
- `PATCH  /bookings/:id/status`       — update status (workflow guarded)
- `PATCH  /bookings/:id/cancel`       — cancel
- `POST   /bookings/:id/media`        — upload images/videos (Cloudinary)

### Technicians
- `POST   /technicians`               — admin create
- `GET    /technicians`               — list with filters
- `GET    /technicians/:id`           — detail
- `PATCH  /technicians/:id`           — update profile
- `PATCH  /technicians/:id/availability` — toggle availability
- `GET    /technicians/:id/earnings`     — earnings summary
- `GET    /technicians/:id/jobs`         — completed jobs

### Services
- `GET /services` · `POST /services` · `PATCH /services/:id` · `DELETE /services/:id`

### Customers
- `GET /customers` · `GET /customers/:id`

### Dashboard
- `GET /dashboard/stats`              — totals + KPIs
- `GET /dashboard/revenue`            — revenue series
- `GET /dashboard/bookings-trend`     — bookings over time
- `GET /dashboard/technician-stats`   — top techs / utilisation
- `GET /dashboard/pending`            — pending jobs queue

### WhatsApp (stubbed)
- `GET  /whatsapp/webhook`            — verification challenge
- `POST /whatsapp/webhook`            — incoming messages → flow engine
- `POST /whatsapp/send`               — send template/text (admin only)

## Booking lifecycle

`NEW → ASSIGNED → ACCEPTED → ON_THE_WAY → STARTED → COMPLETED`
(any state → `CANCELLED`)

Transitions are enforced in `services/booking.service.js`.

## Wiring the React admin (this repo's frontend)

In the admin app create `src/lib/api.ts`:

```ts
import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:5000/api/v1",
});
api.interceptors.request.use((c) => {
  const t = localStorage.getItem("serviq_token");
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});
```

Then replace mock-data calls with:
- `api.get("/dashboard/stats")`
- `api.get("/bookings", { params: { page, status, q } })`
- `api.patch(\`/bookings/\${id}/assign\`, { technicianId })`
- `api.get("/technicians")` …etc.

## WhatsApp Cloud API (stub — ready to activate)

`services/whatsapp.service.js` contains:
- `verifyWebhook()` — handles `hub.challenge`
- `handleIncoming(payload)` — parses messages and drives the flow state machine in `services/whatsappFlow.service.js`
- `sendText()` / `sendTemplate()` — guarded no-ops until `WHATSAPP_TOKEN` is set

Flow steps implemented: greet → service → issue → urgency → location → media → confirm → create booking → notify admin via Socket.IO.

## Security

- Helmet, CORS allowlist, JSON body limit
- Global rate limit + tighter limit on `/auth/*`
- JWT in `Authorization: Bearer …` header
- Role middleware: `requireRole("admin")`, `requireRole("technician")`
- Joi validation on all write routes
- Centralised error handler returns `{ success, message, code, details? }`
