# Johden AI Business Manager

A separate, mobile-first business management PWA for Johden Business Consultancy Services.

## Current scope
- Offline-capable prospect and task workspace
- Message drafts with explicit approval state
- Local-first draft storage and sync-ready architecture
- Supabase and AI integrations added after credentials and project isolation are confirmed

## Safety and separation
This application is independent of the existing JBCS finance application. Do not reuse finance database credentials or modify the production finance schema. Keep all server secrets out of `NEXT_PUBLIC_*` variables.

## Local setup
1. Install Node.js LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and fill in the values only after the separate Supabase project is created.
4. Run `npm run dev`.

The first version can be explored locally without connecting external services. WhatsApp sending and calendar writes are not enabled by default; messages require user approval.
