# SKIEVL.com — Ellicottville Ski Exchange

**Buy. Sell. Trade. Ski Local.** A peer-to-peer marketplace for used ski and snowboard gear in Ellicottville, NY. It has integrated checkout, a configurable marketplace commission, seller payouts through Stripe Connect, local pickup or paid seller drop-off, verified seller reviews, and an admin console.

| Layer | Technology |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database / Auth / Storage | Supabase (Postgres + Row Level Security, Supabase Auth, Supabase Storage) |
| Payments | Stripe Connect Express (destination charges + application fee), Stripe Checkout |
| Email | Resend (HTTP API) |
| Hosting | Vercel (+ Vercel Cron) |
| Analytics | Google Analytics 4 (optional, env-controlled) |

---

## 1. What's in the box

```
supabase/
  migrations/               ← run these in order (schema, functions, security, reference data)
  tests/                    ← SQL behaviour tests (RLS, inventory lock, payments, reviews)
src/
  proxy.ts                  ← session refresh + auth guard (Next 16 "proxy", formerly middleware)
  app/
    page.tsx                ← homepage
    search/                 ← search + dynamic, category-specific filters
    listings/[id]/          ← listing detail + buy box (pickup / drop-off)
    sellers/[id]/           ← public seller profile + verified reviews
    account/                ← buyer: orders, favorites, messages, notifications, settings
    sell/                   ← seller: dashboard, setup (shop, Stripe, private address, drop-off ZIPs),
                              listings (form + photo upload), orders (fulfillment), reviews (responses)
    admin/                  ← overview metrics, listing approval, orders/refunds/disputes, users,
                              reviews, reports, catalog (categories/brands), settings (commission)
    api/checkout/           ← reserve item + create Stripe Checkout session
    api/stripe/webhook/     ← payment, refund, dispute, account and payout events
    api/stripe/connect/     ← Stripe Express onboarding + dashboard link
    api/cron/maintenance/   ← releases stale holds, auto-completes orders
    actions/                ← server actions (all validated with zod)
  lib/                      ← supabase clients, stripe, email, search parsing, sizing, formatting
```

### Key design points

- **Category-specific attributes, not one generic "size" field.** `attribute_definitions` defines typed fields per category: ski length (cm), Mondopoint boot size, apparel size, helmet size, ski type, and so on. Listing values live in `listings.attributes` (jsonb with a GIN index). A trigger validates them against the definitions, so bad data can't get in. Filters in the UI are generated from the same definitions.
- **Boot sizes** are stored as Mondopoint. Sellers and buyers can enter or filter in Mondo, US men's, or US women's sizes.
- **Inventory locking.** `reserve_listing()` uses a row lock and a conditional update. Only one buyer can hold an item, and only for the checkout window. Expired Stripe sessions, the cancel URL, and a cron safety net all release the hold. If a payment ever arrives for an item that has already sold, the buyer is refunded automatically.
- **Private address.** The pickup address lives in `seller_private`, which only its owner can read under RLS. It is copied onto the order only by `mark_order_paid()`, which runs after Stripe confirms payment.
- **Money.** The order records `item_price_cents`, `dropoff_fee_cents`, `commission_bps`, `platform_fee_cents`, and `seller_proceeds_cents` separately. Payment uses a destination charge with `application_fee_amount`, so the seller's share goes straight to their connected account. Refunds reverse the transfer and refund the application fee proportionally.
- **Reviews.** Only the buyer of a **completed** order can review, once per order. This is enforced by RLS and a unique constraint. Reviews rate communication, listing accuracy, transaction experience, and overall experience. Sellers can respond publicly, users can report reviews, and admins can hide or remove them.
- **Admin writes** always go through server actions that re-check the admin role, use the service role, and write to `admin_audit_log`.

---

## 2. Local development

Prerequisites: Node 20.9+, a Supabase project (free tier is fine), a Stripe account in **test mode**, and optionally the Stripe CLI and Supabase CLI.

```bash
npm install
cp .env.example .env.local      # fill in values (see §3)
npm run dev                     # http://localhost:3000
```

Forward Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook \
              --forward-connect-to localhost:3000/api/stripe/webhook
# put the printed whsec_… into BOTH STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET
```

Database tests (vanilla Postgres 15+, no Supabase needed):

```bash
PGHOST=localhost PGUSER=postgres npm run db:test     # → "ALL TESTS PASSED"
```

---

## 3. Production setup (step by step)

### 3.1 Supabase

1. Create a project (region: `us-east-1` is closest to Western NY).
2. Apply the migrations, using either method:
   - **CLI:** `npx supabase link --project-ref <ref>` then `npx supabase db push`
   - **Dashboard:** SQL Editor → paste and run each file in `supabase/migrations/` in filename order.
3. **Authentication → URL Configuration**
   - Site URL: `https://skievl.com`
   - Redirect URLs: `https://skievl.com/auth/callback`, `https://*.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`
4. **Authentication → Providers → Email:** keep "Confirm email" **on**.
5. **Authentication → SMTP:** use Resend's SMTP so confirmation emails come from `@skievl.com`. Supabase's built-in sender is heavily rate-limited.
6. **Project Settings → API:** copy the URL, the anon key, and the service_role key into Vercel env vars.
7. **Make yourself an admin.** Sign up on the site, then run:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

### 3.2 Stripe

1. **Connect → Get started.** Choose *Platform or marketplace* and enable **Express** accounts. Fill in the platform profile, branding (logo, color `#13293d`), and business details.
2. **Settings → Connect → Onboarding options:** country US, individual sellers.
3. **Developers → Webhooks.** Add **two** endpoints, both pointing to `https://skievl.com/api/stripe/webhook`:
   - **Events on your account:** `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`. Signing secret goes to `STRIPE_WEBHOOK_SECRET`.
   - **Events on Connected accounts:** `account.updated`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`. Signing secret goes to `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. Turn on Apple Pay / Google Pay under **Settings → Payment methods** (Checkout shows them automatically for cards).
5. Do the whole flow in **test mode** first (see §4), then repeat steps 1–4 in live mode and swap the keys.

### 3.3 Resend

Add and verify the domain `skievl.com` (DNS records at your registrar). Create an API key and put it in `RESEND_API_KEY`.

### 3.4 Vercel and the domain

1. Push this folder to a GitHub repo, then **Vercel → Add New Project → Import**.
2. Add all variables from `.env.example` for both **Production** and **Preview**. Set `NEXT_PUBLIC_SITE_URL=https://skievl.com`, and set `CRON_SECRET` to a long random string.
3. Deploy, then go to **Settings → Domains** and add `skievl.com` and `www.skievl.com`. Follow Vercel's DNS instructions (an A record or Vercel nameservers) and redirect `www` to the apex domain.
4. The cron in `vercel.json` runs daily, which works on the Hobby plan. On Pro you can change it to `*/15 * * * *`. Webhooks handle the time-critical cases either way.

---

## 4. Launch test plan (Stripe test mode)

| # | Scenario | Expected |
|---|---|---|
| 1 | Sign up → confirm email → sign in | Profile created; header shows account links |
| 2 | Start selling → shop profile → Stripe onboarding (test data: SSN `000-00-0000`, routing `110000000`, account `000123456789`) | Setup page shows "Payouts are set up" |
| 3 | Add private address + drop-off ZIP 14731 | Saved; address not visible on any public page |
| 4 | Create a ski listing (length 172, all-mountain), add 3 photos, submit | Status "In review" |
| 5 | Admin → Listings → Approve | Live; seller gets an email |
| 6 | Search: Skis, 165–179 cm, Rossignol, ≤ $400 | Listing appears; a 150–160 cm filter hides it |
| 7 | Second account: buy with pickup, card `4242 4242 4242 4242` | Success page; order "Awaiting fulfillment"; pickup address visible to buyer; both get emails |
| 8 | While #7 is in checkout, a third account tries to buy | "No longer available" |
| 9 | Abandon a checkout (Back button) | Item immediately available again |
| 10 | Seller: Ready → Scheduled → Picked up; buyer confirms | Completed; review form appears |
| 11 | Buyer leaves review; seller responds | Seller rating updates; response shown publicly |
| 12 | Drop-off order to a ZIP outside the area | Blocked before payment |
| 13 | Seller cancels a paid order | Buyer refunded in full (transfer reversed, fee refunded); listing "Unavailable" |
| 14 | Admin partial refund $20 | Refund row; order shows refunded amount |
| 15 | Card `4000 0000 0000 0259` (dispute) | Order "Disputed"; admin alert email |
| 16 | Admin changes commission to 10% | New checkouts use 10%; old orders unchanged |

---

## 5. Operations

- **Disputes:** respond in the Stripe Dashboard. With destination charges, the platform account is debited first; recover the money from the seller as your policy allows.
- **Account deletion requests:** remove the auth user in Supabase. Orders are kept for accounting (foreign keys prevent deleting buyers who have orders, so anonymize the profile instead).
- **Generated types:** `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`, then pass the type to `createClient<Database>()` for end-to-end typing.
- **Security review checklist:** RLS is enabled on every table (`supabase/migrations/*_security.sql`); the service role key exists only in server code; webhooks verify signatures and are idempotent (`stripe_events`); security headers are set in `next.config.ts`; photos are re-encoded client-side, which strips EXIF/GPS data.

See **DECISIONS.md** for open business decisions that need your sign-off.
