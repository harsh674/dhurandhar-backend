# Deploying ServiQ Backend to Vercel + MongoDB Atlas

## 1. MongoDB Atlas
- Create a free M0 cluster (region close to you, e.g. ap-south-1).
- DB user: `yourserviq` / password `Serviq@123` (already in your URI).
- Network Access -> Add IP -> `0.0.0.0/0` (Vercel IPs are dynamic).

## 2. Local test
```bash
npm install
cp .env.example .env        # edit if needed
npm run seed                # creates admin + sample services/technicians
npm run dev                 # http://localhost:5000/api/v1
```
Default admin: `admin@serviq.in` / `Admin@123`

## 3. Push to GitHub, then Import to Vercel
On Vercel -> Project Settings -> Environment Variables, add:

| Name                       | Value |
|---------------------------|-------|
| MONGO_URI                 | mongodb+srv://yourserviq:Serviq%40123@cluster0.nyqv6sh.mongodb.net/serviq?retryWrites=true&w=majority&appName=Cluster0 |
| JWT_SECRET                | (long random string) |
| JWT_EXPIRES_IN            | 7d |
| CORS_ORIGINS              | https://serviq-ops-hub.lovable.app,http://localhost:5173 |
| NODE_ENV                  | production |
| WHATSAPP_VERIFY_TOKEN     | serviq-verify-token |

(Leave Cloudinary + WhatsApp token blank for now — stubs handle that.)

DO NOT set `PORT` or `VERCEL` — Vercel injects them automatically.

## 4. Deploy
Vercel auto-detects `vercel.json`. After deploy, test:
```
GET https://<your-app>.vercel.app/health
GET https://<your-app>.vercel.app/api/v1/services
POST https://<your-app>.vercel.app/api/v1/auth/admin/login
     { "email": "admin@serviq.in", "password": "Admin@123" }
```

## 5. Point Lovable frontend at it
In Lovable -> Project Settings -> Environment Variables:
```
VITE_SERVIQ_API_URL = https://<your-app>.vercel.app/api/v1
```
Then republish.

## Important caveats on Vercel
- **Socket.IO is disabled on Vercel** (serverless = no persistent connections).
  Live ops events still emit fine in local/long-running deploys (Render/Railway/EC2).
  For realtime on Vercel, use Pusher/Ably or move to Render later.
- **Local file uploads (`/uploads`) won't persist** on Vercel — set Cloudinary
  env vars to use Cloudinary storage instead.
- **Seed script must be run locally** (`npm run seed`) — Vercel can't run it.
- **Rotate your DB password** after testing — it's been shared.
