# Femzy — Events for women who play

Next.js 15 (App Router) · Tailwind CSS · Framer Motion · Supabase

The site is built around **events**: an events listing, a page per event with online registration, a live monthly calendar, and an admin dashboard to manage it all.

## Run it

```bash
npm install
cp .env.example .env.local   # optional — without keys the site runs on sample events
npm run dev
```

Open http://localhost:3000

## Pages

| Page | What it is |
| --- | --- |
| `/` | Home: next events, categories, live calendar, how it works, about |
| `/events` | All events — featured, upcoming, past, search + category filter (`/events?category=Sports`) |
| `/events/<event-url>` | Event details + registration form |
| `/events/calendar` | Monthly calendar (month view + list view) |
| `/login` | Admin sign-in (not shown to event visitors) |
| `/admin/events` | Admin: analytics, create / edit / publish / cancel / delete events, participants, payments, CSV export |

## Connect the backend (Supabase)

1. Create a project at supabase.com (region: Mumbai).
2. SQL Editor → run `supabase/schema.sql` (profiles, admin role and audit log), then `supabase/migrations/004_events.sql` and `supabase/migrations/006_cashfree_payments.sql` (in that order).
3. Copy the project URL, publishable key and service-role key into `.env.local` (and Vercel). The publishable key is safe for the browser; `SUPABASE_SERVICE_ROLE_KEY` must remain server-only. Add the Cashfree App ID as `CASHFREE_APP_ID`, Secret Key as `CASHFREE_SECRET_KEY`, and use `CASHFREE_ENV=sandbox` while testing. All Cashfree credentials stay server-only.
4. Sign up / log in on the site, then make yourself admin in the SQL editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`

## Event registration & payments

- Every attendee registers as a guest; no account creation or sign-in is shown anywhere in the public website.
- Free events are confirmed instantly. Paid events open Cashfree Checkout and are confirmed only after the server verifies Cashfree's payment status. In Cashfree, whitelist the production domain and configure the webhook URL as `https://<your-domain>/api/cashfree/webhook`.
- Capacity, deadline, duplicate and UTR checks run inside the database function `register_for_event()`, which locks the event row, so seats can't be oversold even with simultaneous registrations.
- Every registration gets an ID like `FRE-7K2Q9XMD`. There is no email service yet, so confirmations are shown on screen.

## Structure

```
src/app                  pages + API routes (events, registration, auth callback)
src/components/landing   home page sections, navbar, footer
src/components/events    event cards, registration form, calendar
src/components/admin     admin header, event form, admin forms
src/lib/events           event types, data loaders, timezone helpers
supabase/                schema.sql + migrations (004_events.sql = events)
public/brand             logo files
```
