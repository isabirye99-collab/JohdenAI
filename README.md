# JohdenAI Business Manager

A separate, mobile-first business-management PWA for Johden Business Consultancy Services. This project is independent of JBCS Finance and CIU CRM.

## Current application
- Supabase email/password sign-up and sign-in
- Email-confirmation callback at `/auth/callback`
- Server-verified protected dashboard at `/dashboard`
- Sign-out
- Prospects, tasks and message approvals in the existing dashboard
- Per-account local browser storage for the dashboard workspace
- PWA manifest and a minimal offline fallback

## Local setup
1. Install Node.js 22 LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set the JohdenAI Supabase project URL and publishable key.
5. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
6. Run `npm run dev`.

## Supabase Auth configuration

In the JohdenAI Supabase project (inside the JBCS organization):

1. Open **Authentication → Providers → Email** and ensure Email sign-in is enabled.
2. Open **Authentication → URL Configuration**.
3. Set the Site URL to your local app while developing (`http://localhost:3000`); change it to your production origin when deployed.
4. Add these Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
5. If email confirmation is enabled, configure the email confirmation template to use the Supabase confirmation URL flow and return to the app callback.

The app supports both confirmation-enabled and confirmation-disabled signup. For a private internal workspace, disable public signups after creating the approved accounts, if that matches your access policy.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`: JohdenAI project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key (safe for browser use when Row Level Security is correctly configured).
- `NEXT_PUBLIC_SITE_URL`: app origin used to construct email confirmation callback links.

Never put a Supabase secret/service-role key or third-party integration secret in a `NEXT_PUBLIC_*` variable. No service-role key is used by the browser authentication flow.

## Offline and data protection

The service worker caches only the public offline fallback and manifest. It does not cache authenticated pages, auth callbacks, API responses, or private workspace data. The existing dashboard saves its current prospects, tasks and drafts in browser local storage using a per-user key. Cloud sync, durable offline queues, cross-device sync, and conflict resolution are not implemented yet.

## Safety

Message approval in the dashboard does not send a message. Outreach remains manual. Google Calendar writes and WhatsApp sending are not enabled by this authentication setup. Any future public database tables must have RLS enabled with policies scoped to the authenticated user (for example, `auth.uid()`).
