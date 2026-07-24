# Capsflux

Offline-first fee management platform for African schools.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Build and Deployment](#build-and-deployment)
- [Architecture](#architecture)
- [Pages and Flows](#pages-and-flows)
- [Developer Notes](#developer-notes)
- [Project Roadmap](#project-roadmap)
- [Contributing](#contributing)
- [License](#license)

## Overview

Capflux is a local-first web application that helps schools manage student records, billing, payments, and notifications while supporting offline operation. The app persists transactions in IndexedDB and synchronizes them with Supabase when connectivity is available.

## Features

- Student registration and search
- Offline billing and payment creation
- Local notification logging
- Background sync queue for online reconciliation
- Supabase authentication with local-dev fallback
- Fee-first reporting workflow
- Responsive, modern Vue-based UI

## Technology Stack

- Frontend: Vue 3 + Vite
- Styling: Tailwind CSS
- State management: Pinia
- Routing: Vue Router
- Offline storage: Dexie.js / IndexedDB
- Backend: Supabase
- Database: PostgreSQL
- Payment provider integration: Monnify / Paystack (planned)
- Notification provider integration: Termii (planned)

## Repository Structure

- `frontend/` - Vue application source
  - `src/views/` - page-level views
  - `src/components/` - reusable UI components
  - `src/services/` - business logic and domain services
  - `src/repositories/` - data persistence and sync helpers
  - `src/offline/` - local database and sync engine
  - `src/stores/` - Pinia stores
  - `src/router/` - routes configuration
- `supabase/` - Supabase SQL schema, migrations, policies, and seeds

## Getting Started

### Clone repository

```bash
git clone git@github.com:capflux-ssng/capflux.git
cd capflux/frontend
```

### Install dependencies

```bash
npm install
```

### Run the app locally

```bash
npm run dev
```

Open the URL shown by Vite in your browser.

The public landing page is available at `/` and links into the authenticated dashboard.

## Demo Data

A seeded demo tenant called `Capstone Demo School` is included in `supabase/migrations/202607100007_seed_data.sql`.
The seed file creates sample students and fee ledger entries for testing:

- Amina Okafor — JSS 1
- Chinedu Ibe — JSS 2
- Halima Abdullahi — SSS 1
- Tunde Adejumo — SSS 2
- Ngozi Nwosu — JSS 3
- Fatima Suleiman — SSS 3

When the frontend is running without a configured Supabase instance, login works in local dev mode using any email and password.

If you connect to Supabase, create an auth user for demo access and use the same login screen.

## Environment Configuration

Create a `.env` file in `frontend/` with the following values:

```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

If these variables are missing, the app will still run with local development fallbacks for authentication and sync.

## Build and Deployment

Build the production app:

```bash
cd frontend
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Architecture

- Local data is stored in IndexedDB via `frontend/src/offline/localDb.ts`
- Sync queue entries are kept in `sync_queue`
- `frontend/src/offline/syncEngine.ts` processes pending items when the browser is online
- Failed sync attempts are marked and retried with improved visibility

## Pages and Flows

- `LandingView` - public marketing and access page for CAPFLUX
- `HomeView` - authenticated dashboard with sync status
- `StudentListView` - register and search students locally
- `StudentDetailView` - view student details and ledger entries
- `BillingView` - billing summary, charge entry, and payment history
- `PaymentsView` - dedicated page to record payments
- `NotificationsView` - record notifications and track local status

## Developer Notes

- `src/services/` implements the domain logic for students, billing, payments, notifications, auth, and sync.
- `src/repositories/` abstracts data persistence and sync enqueueing.
- `src/offline/` contains the local DB schema and background sync engine.
- Sync operations use Supabase `upsert` when online.
- Local dev fallback allows working without Supabase config.

## Project Roadmap

- Add stronger user profile and school management workflows
- Implement Supabase-backed persistence for students, ledger entries, and notifications
- Support payment provider integration and real billing reconciliation
- Add reporting views for payments and financial summaries
- Improve offline conflict handling and sync visibility

## Contributing

1. Fork the repo
2. Create a feature branch
3. Commit changes with clear messages
4. Push and create a pull request

## License

This project is licensed under the terms defined in the repository.
