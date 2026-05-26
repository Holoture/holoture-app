# Holoture Setup Guide

## Project Structure

```
holoture-app/
├── app/
│   ├── generated/prisma/      ← auto-generated Prisma client (don't edit)
│   ├── (auth)/sign-in/        ← Clerk sign-in page
│   ├── (auth)/sign-up/        ← Clerk sign-up page
│   ├── api/
│   │   ├── signals/           ← signal CRUD endpoints
│   │   ├── stripe/checkout/   ← create Stripe checkout session
│   │   ├── stripe/webhook/    ← handle Stripe subscription events
│   │   └── user/sync/         ← sync Clerk user to DB
│   ├── admin/signals/         ← admin signal management (protected)
│   ├── dashboard/             ← main dashboard (free/pro-aware)
│   ├── pricing/               ← pricing page
│   └── page.tsx               ← landing page
├── components/                ← shared UI components
├── lib/
│   ├── prisma.ts              ← Prisma client singleton
│   ├── stripe.ts              ← Stripe client
│   ├── user.ts                ← get/create user helpers
│   └── utils.ts               ← cn(), formatCurrency()
├── prisma/schema.prisma        ← DB schema
├── prisma.config.ts            ← Prisma 7 config (DB URL lives here)
└── .env                        ← environment variables
```

## Step 1 — Set up Railway (PostgreSQL)

1. Go to railway.app and create a new project
2. Add a PostgreSQL service
3. Copy the connection string from the "Connect" tab
4. Paste it as `DATABASE_URL` in your `.env` file AND in `prisma.config.ts`

## Step 2 — Set up Clerk

1. Go to clerk.com and create a new application
2. Copy your **Publishable Key** and **Secret Key**
3. Paste them into `.env`:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
   - `CLERK_SECRET_KEY=sk_live_...`
4. Find your own Clerk user ID (go to Users in the Clerk dashboard after signing up)
5. Set `ADMIN_USER_ID=user_xxxxx` in `.env` — this unlocks `/admin/signals` for you

## Step 3 — Set up Stripe

1. Go to stripe.com and create an account
2. Copy your **Secret Key** and **Publishable Key** into `.env`
3. Create a product: Stripe Dashboard → Products → Add product
   - Name: "Holoture Pro"
   - Price: $15 / month (recurring)
   - Copy the **Price ID** (starts with `price_`)
   - Set `STRIPE_PRO_PRICE_ID=price_xxxxx` in `.env`
4. Set up a webhook:
   - Stripe Dashboard → Developers → Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET=whsec_xxxxx`
   - For local development, use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Step 4 — Apply DB Schema & Run

```bash
# Push schema to Railway (creates tables)
npm run db:push

# Start dev server
npm run dev
```

## Step 5 — Add Your First Signals

1. Sign up at `http://localhost:3000/sign-up`
2. Make sure your Clerk user ID matches `ADMIN_USER_ID` in `.env`
3. Go to `http://localhost:3000/admin/signals`
4. Click "Add Signal" and fill in the form

## Environment Variables Reference

```env
DATABASE_URL=                          # Railway PostgreSQL connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=     # Clerk publishable key
CLERK_SECRET_KEY=                      # Clerk secret key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
STRIPE_SECRET_KEY=                     # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=    # Stripe publishable key
STRIPE_WEBHOOK_SECRET=                 # Stripe webhook signing secret
STRIPE_PRO_PRICE_ID=                   # Price ID for $15/month plan
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_USER_ID=                         # Your Clerk user ID for admin access
```

## How Tier Logic Works

- **Free users** see 1 signal per day, randomly selected based on today's date
- **Pro users** see all active signals, grouped by BUY / HOLD / SELL
- Upgrading triggers a Stripe checkout → webhook fires → user's `tier` column updates to `pro`
- Canceling triggers the webhook → user's `tier` reverts to `free`

## Deployment (Vercel)

```bash
# Deploy to Vercel
vercel deploy

# Set all env vars in Vercel dashboard under Settings > Environment Variables
# After deploy, update:
# - NEXT_PUBLIC_APP_URL to your Vercel URL
# - Stripe webhook URL to your Vercel URL
```
