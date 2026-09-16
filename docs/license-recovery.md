# License recovery and $29 pricing

## Live pricing, September 16, 2026

The production site advertises $29. `/buy` redirects to the live one-time USD 29 checkout at `https://buy.stripe.com/cNi5kFaj1dUfarofzU6J201`. The old USD 15 payment link is inactive and displays a clickable link to `/buy`. Existing purchases remain valid: the production verification endpoint was checked against the existing paid USD 15 checkout after deployment.

Production pricing deployment: `dpl_AWwvvxPH8RSAKHvVtUeZUhx4Tihr`. This deployment also includes the earlier payment-verification and success-page fixes. It does not include recovery. Desktop price copy and the permanent purchase URL are changed locally and need a desktop release.

## Recovery implementation (local, not deployed)

- `/recover` asks for the purchase email. Website footer, success-page help, and desktop paywall link to it.
- `POST /api/recover` searches completed Stripe sessions from both approved Block Writer payment links, including guest checkouts and historical purchases.
- Only live, completed, paid, one-time Block Writer purchases qualify. Refunded, partially refunded or disputed charges are not emailed.
- The code is sent only to the email stored on the purchase. It never appears in the API response. Known and unknown addresses receive the same general confirmation.
- Resend uses an opaque idempotency key for each email/purchase/UTC day to suppress duplicate sends across server instances. Each instance also limits an IP to five requests per 15 minutes. This local throttle is best-effort, not a distributed edge rate limit. Configure a Vercel WAF rate limit for `/api/recover` if traffic or abuse warrants it.
- Searches cover up to 1,000 completed sessions per payment link. If the search limit or deadline is reached, the API returns a service error instead of falsely reporting completion. A purchase-email index should replace scanning before exceeding this scale.

## Required configuration

In the existing Vercel `block-writer` project's production environment, configure:

- `STRIPE_SECRET_KEY`: already present.
- `RESEND_API_KEY`: Resend sending key. Do not put it in source, chat, or a `VITE_` variable.
- `LICENSE_EMAIL_FROM`: a sender on a verified Resend domain, for example `Block Writer <licenses@blockwriter.sh>` after that domain is verified.

Then deploy the updated landing project and validate delivery to an explicitly authorized test recipient. No live recovery email has been sent during this work. Do not advertise recovery as working until configuration and delivery are verified. Missing configuration returns HTTP 503 with support guidance.

The existing API builds previously lacked `@vercel/node` declarations. These are now a dev dependency, and the landing build type-checks both the UI and API. Run `npm test --prefix landing` and `npm run build --prefix landing`.

## Validation

34 unit tests cover verification and recovery, including historical and new-price purchases, guest email matching, pagination, generic responses without code leakage, refunded purchases, idempotency keys, throttling, bad input, HTTP methods/origins, and provider failures. Browser checks used a local simulated email service: required input validation, successful request feedback, and service-error feedback passed. Both landing and desktop frontend builds passed. No new payment or email was sent.

Resend API references: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys .

## Recovery production deployment

Deployed `dpl_6F6RetfDwUqNSyVEUx811dN3TbB6` to https://blockwriter.sh after the user added both email settings. Vercel reports both settings as sensitive Production values, so local env downloads intentionally omit their contents. Production `/recover` renders correctly; invalid input returns 400 and a reserved nonexistent email returns the generic 200 response after Stripe lookup. This confirms configuration presence and the lookup path, not Resend sender validity or inbox delivery. A real recovery email test still requires user authorization. All 34 tests, API/UI type checks, and the production build passed.
