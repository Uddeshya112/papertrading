# TradeGuru AI — Real-World Production Deployment Guide (100% Free Stack)

Deploy TradeGuru AI live on the internet in under 5 minutes using **Vercel (Frontend + API Routes)** + **Supabase (Auth + PostgreSQL)** + optional **Java Spring Boot Backend (Docker / Render)**.

---

## 1. Provision Supabase Database (Free Tier)
1. Create a free project at [supabase.com](https://supabase.com/).
2. Open **SQL Editor** in your Supabase Dashboard.
3. Paste and run the entire migration file: `supabase/migrations/001_tradeguru_schema.sql`.
   - Creates `tradeguru_accounts`, `tradeguru_journal_trades` (immutable — no delete), `tradeguru_refill_history` (append-only), `tradeguru_psychology_logs`, and `tradeguru_audit_log` (append-only) with strict Row-Level Security (RLS).
4. In **Project Settings → API**, copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon / public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. In **Authentication → URL Configuration**, add your production domain (e.g. `https://your-app.vercel.app/auth/callback` and `https://your-app.vercel.app/auth/reset-password`) to Redirect URLs.

---

## 2. Deploy Frontend + Live Market Quote API on Vercel (Free Tier)
1. Push this repository to GitHub.
2. Import the repo on [vercel.com](https://vercel.com/) and set **Root Directory** to `nextrade-web`.
3. Add Environment Variables in Vercel:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   # Optional: point to deployed Java backend
   NEXT_PUBLIC_API_URL=https://your-java-api.onrender.com
   ```
4. Click **Deploy**.
   - `/api/market/quotes` automatically fetches public delayed NSE/BSE/Index quotes (15-second cache) and cleanly distinguishes real delayed quotes from simulated execution.
   - Signed-in users automatically sync accounts, journal trades, and refill history to Supabase PostgreSQL; guests work 100% offline-first in the browser.

---

## 3. Run Locally
```bash
cd nextrade-web
cp .env.example .env.local
npm install
npm run dev
```
Open `http://localhost:3000`.

---

## 4. Optional: Run the Java Spring Boot Backend (Docker)
```bash
docker compose up --build
```
The upgraded `PortfolioController` exposes:
- `GET /api/v1/portfolio` — Auto-provisions ₹10,00,000 virtual account
- `POST /api/v1/portfolio/refill` — Safe ₹10,00,000 refill preserving all historical trades
- `GET /api/v1/portfolio/refills` — Immutable refill ledger
- `GET /api/v1/portfolio/audit-log` — Immutable administrative audit trail
