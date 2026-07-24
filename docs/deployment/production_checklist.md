# CAPFLUX Production Readiness Checklist

## Overview

This document covers the steps required to deploy CAPFLUX to production. Complete each section before going live.

---

## 1. Supabase Project Setup

- [ ] Create a Supabase project at [supabase.com](https://supabase.com)
- [ ] Run all database migrations in order:
  ```bash
  202607100001_foundation.sql
  202607100002_tables.sql
  202607100003_indexes.sql
  202607100004_functions.sql
  202607100005_rls.sql
  202607100006_views.sql
  202607100007_seed_data.sql
  ```
- [ ] Apply RLS hardening policies: `supabase/policies/rls_hardening.sql`
- [ ] Apply audit triggers: `supabase/triggers/audit_triggers.sql`
- [ ] Enable Row-Level Security in the Supabase dashboard for all tables
- [ ] Configure authentication providers (email/password at minimum)
- [ ] Set up custom SMTP for auth emails (optional but recommended)
- [ ] Create initial admin user for the demo school
- [ ] Deploy Edge Functions:
  ```bash
  supabase functions deploy send-notification
  ```
- [ ] Configure Edge Function secrets:
  - `TERMII_API_KEY`
  - `EMAIL_API_KEY`
  - `EMAIL_API_URL`
  - `EMAIL_FROM`

## 2. Environment Configuration

- [ ] Create `frontend/.env` with:
  ```env
  VITE_SUPABASE_URL=https://your-project.supabase.co
  VITE_SUPABASE_ANON_KEY=your-public-anon-key
  ```
- [ ] Create `backend/.env` with:
  ```env
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_KEY=your-service-role-key
  PORT=4000
  ```

## 3. Backend Deployment

- [ ] Deploy the Express backend (Node.js):
  - Host on Railway, Render, Fly.io, or similar
  - Set environment variables from step 2
  - Verify health endpoint: `GET /health`
- [ ] Configure rate limiting (included in backend/index.js)
- [ ] Set up process manager (PM2 or systemd):
  ```bash
  pm2 start backend/index.js --name capflux-api
  pm2 save
  pm2 startup
  ```

## 4. Frontend Build & Deploy

- [ ] Build the production bundle:
  ```bash
  cd frontend
  npm run build
  ```
- [ ] Deploy `frontend/dist/` to:
  - Vercel, Netlify, Cloudflare Pages, or any static host
- [ ] Configure SPA routing (redirect all paths to `index.html`)
- [ ] Set environment variables in hosting dashboard

## 5. Database Backups

- [ ] Schedule regular backups using `backend/scripts/backup.sh`:
  ```bash
  # Add to crontab (runs daily at 2 AM)
  0 2 * * * /path/to/backend/scripts/backup.sh
  ```
- [ ] Configure S3 bucket for backup storage (optional)
- [ ] Configure Slack webhook for backup notifications (optional)
- [ ] Verify backup restoration process

## 6. Monitoring & Alerting

- [ ] Set up health check monitoring (UptimeRobot, BetterUptime, or similar):
  - Endpoint: `https://your-api.com/health`
  - Expected response: `{ "status": "ok", ... }`
- [ ] Configure error tracking (optional):
  - Sentry, LogRocket, or Datadog
- [ ] Monitor Supabase project:
  - Database connections
  - API usage
  - Storage usage

## 7. Security Checklist

- [ ] Verify RLS policies are active on all tables
- [ ] Test multi-tenant isolation:
  - Create two schools
  - Verify school A cannot access school B's data
- [ ] Ensure no service_role keys are exposed client-side
- [ ] Verify JWT expiration and refresh flow
- [ ] Test audit logs are being created on mutations
- [ ] Rate limiting active on backend endpoints
- [ ] CORS configured correctly for your domain

## 8. Multi-Tenant Verification

- [ ] Create test schools with different data
- [ ] Verify student isolation between schools
- [ ] Verify ledger entry isolation between schools
- [ ] Verify notification isolation between schools
- [ ] Verify sync queue isolation between schools
- [ ] Verify report isolation between schools

## 9. Offline-First Verification

- [ ] Test student registration while offline
- [ ] Test billing charge creation while offline
- [ ] Test payment recording while offline
- [ ] Test notification creation while offline
- [ ] Verify sync queue processes when back online
- [ ] Verify no duplicate records after sync

## 10. Performance Checklist

- [ ] Indexes created on all foreign keys (done in migrations)
- [ ] Indexes created on common query fields (done in migrations)
- [ ] Test with 1000+ students to verify query performance
- [ ] Verify IndexedDB performance with large datasets
- [ ] Check bundle size: `npm run build` and inspect `dist/`

## 11. Pre-Launch Tests

- [ ] Full end-to-end flow: Register student → Add charges → Record payment → View report
- [ ] Auth flow: Sign up → Sign in → Session persistence → Sign out → Sign in
- [ ] Sync flow: Create offline data → Go online → Process queue → Verify Supabase
- [ ] School settings: Update currency/timezone → Verify persistence
- [ ] Notification flow: Create notification → Verify status → Retry failure
- [ ] Student management: Create → Edit → Archive → Restore → Search

## 12. Post-Launch

- [ ] Monitor error logs daily for first week
- [ ] Review sync queue health
- [ ] Verify backup jobs are running
- [ ] Collect user feedback
- [ ] Monitor performance metrics
- [ ] Plan for next iteration based on roadmap