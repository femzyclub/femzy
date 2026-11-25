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
2. SQL Editor → run `supabase/schema.sql` (profiles, admin role and audit log), then `supabase/migrations/004_events.sql` (events, registrations, storage and security rules).
3. Copy the project URL, publishable key and secret key into `.env.local` (and Vercel). The publishable key is safe for the browser; the secret key must remain server-only.
4. Sign up / log in on the site, then make yourself admin in the SQL editor:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`

## Event registration & payments

- Every attendee registers as a guest; no account creation or sign-in is shown anywhere in the public website.
- Free events are confirmed instantly. Paid events use the GPay / UPI QR in `public/payments/`: the visitor submits the UTR + screenshot, the seat is held, and an admin approves or rejects it on the event's admin page.
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
