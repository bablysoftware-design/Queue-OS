# Saf Queue — Setup Guide

## Step 1: Supabase

1. Go to https://supabase.com → New Project
2. SQL Editor → paste `sql/schema.sql` → Run
3. Copy: Project URL + `service_role` key (Settings → API)

---

## Step 2: WhatsApp Cloud API

1. Meta Developer Console → Create App → WhatsApp product
2. Get: Phone Number ID + Permanent Token
3. Set webhook URL: `https://your-worker.workers.dev/webhook`
4. Set Verify Token: any random string (you'll use as WHATSAPP_VERIFY_TOKEN)

---

## Step 3: Deploy Cloudflare Worker

```bash
cd worker
npm install -g wrangler
wrangler login

# Set secrets (never commit these)
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_KEY
wrangler secret put WHATSAPP_TOKEN
wrangler secret put WHATSAPP_PHONE_ID
wrangler secret put WHATSAPP_VERIFY_TOKEN
wrangler secret put ADMIN_SECRET

# Deploy
wrangler deploy
```

Note your Worker URL: `https://saf-queue-worker.YOUR_SUBDOMAIN.workers.dev`

---

## Step 4: Deploy PWA to Cloudflare Pages

1. Update `pwa/index.html` line: `WORKER_URL: 'https://...'` → your Worker URL
2. Cloudflare Dashboard → Pages → Create Project
3. Connect GitHub repo or drag-drop the `pwa/` folder
4. Done. Your dashboard is live.

---

## Step 5: Register First Shop (API)

```bash
curl -X POST https://your-worker.workers.dev/shops \
  -H "Content-Type: application/json" \
  -d '{"name":"Ali Barber","category":"barber","area":"Lahore","owner_phone":"923001234567","pin":"1234"}'
```

→ Free 30-day trial starts automatically.

---

## Assign Paid Plan (when they pay)

```bash
curl -X POST https://your-worker.workers.dev/admin/assign-plan \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET" \
  -d '{"shop_id":"UUID_HERE","plan_name":"basic"}'
```

---

## Customer WhatsApp Flow

Customer sends **"hi"** to your WhatsApp number:
→ Sees list of open shops
→ Sends **"1"** to join first shop
→ Gets token number + estimated wait

---

## File Structure

```
saf-queue/
├── sql/
│   └── schema.sql              ← paste into Supabase SQL Editor
├── worker/
│   ├── wrangler.toml
│   └── src/
│       ├── index.js            ← Worker entry point (router)
│       ├── routes/
│       │   ├── webhook.js      ← WhatsApp webhook
│       │   ├── tokens.js       ← Queue token APIs
│       │   ├── shops.js        ← Shop management
│       │   └── subscriptions.js← Plans + admin
│       ├── services/
│       │   ├── tokenService.js
│       │   ├── subscriptionService.js
│       │   └── whatsappService.js
│       └── utils/
│           ├── db.js           ← Supabase REST client
│           ├── response.js     ← HTTP response helpers
│           └── validation.js
└── pwa/
    ├── index.html              ← Full dashboard (single file)
    ├── manifest.json           ← PWA manifest
    └── service-worker.js       ← Offline support
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET    | /webhook | WA verification |
| POST   | /webhook | WA incoming messages |
| POST   | /shops | Register shop |
| POST   | /shops/login | Dashboard login |
| PATCH  | /shops/:id/toggle | Open/close shop |
| GET    | /shops/:id | Get shop info |
| POST   | /tokens | Create token (manual) |
| POST   | /tokens/next | Advance queue |
| GET    | /tokens/queue?shop_id= | Get queue state |
| GET    | /subscriptions?shop_id= | Get subscription |
| POST   | /admin/assign-plan | Assign plan (admin) |
| GET    | /admin/shops | List all shops (admin) |

---

## Adding Payment Later

When Easypaisa/JazzCash confirms payment, call:
```
POST /admin/assign-plan { shop_id, plan_name }
```
That's it. No other changes needed.
