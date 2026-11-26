# TradeGuru AI — Deployment, CI/CD & DevOps Guide

## 1. Deployment Topology
* **Frontend + BFF API Routes:** Deployed on **Vercel** (`Root Directory: nextrade-web`, `vercel.json`).
* **Auth & Database:** **Supabase** (PostgreSQL 15+, PgBouncer connection pooling, Auth PKCE).
* **Optional Java Matching Engine:** Containerized via `Dockerfile` and `docker-compose.yml` for Render / Fly.io / self-hosted Docker.

## 2. Database Migration Pipeline
Run SQL migrations in strict order in Supabase SQL Editor (or `supabase db push`):
1. `supabase/migrations/001_tradeguru_schema.sql` — Core tables + RLS policies.
2. `supabase/migrations/002_enterprise_hardening.sql` — Financial immutability triggers, idempotency keys, cursor pagination indexes, and numeric check constraints.

## 3. Monitoring & Operational Diagnostics
* Poll `GET /api/health` every 60 seconds via UptimeRobot / Vercel Monitoring to track uptime, memory footprint, Supabase configuration status, and `/api/market/quotes` cache hit ratio + circuit-breaker state.
* Monitor Vercel Web Analytics & Speed Insights for real-user LCP, INP, and CLS.
