# Block Writer payment check, September 16, 2026

The live $15 checkout and activation verification work for an existing paid purchase. No new charge was made and no live Stripe configuration or deployment was changed. The desktop app's final local activation write was inspected in source, not exercised against a customer's license.

## Live evidence

- `https://buy.stripe.com/eVq9AV8aT3fBaro0F06J200` is active, in live mode, and displays Block Writer for $15 USD. Merchant display name is Dash Studios.
- Stripe reports charges and payouts enabled.
- One existing completed, paid $15 checkout exists on this payment link.
- Production `/api/verify` accepts that paid session and rejects an unpaid session and an invalid code. No session identifiers or customer details are included here.
- Stripe redirects to `https://focused-writer.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`. This alias resolves to the current Block Writer deployment. The older domain is functional.

## Findings and prepared fixes

1. Medium: Opening `/success` without a checkout reference displays “You're activated” with a blank Copy control. Any supplied reference is displayed without verification. Fixed locally by verifying payment before displaying the code, adding missing-reference, processing, error and retry states, and copy feedback.
2. Medium: Verification accepts any paid Stripe session retrievable with this account's key, without checking that it belongs to Block Writer. Fixed locally by requiring a live, completed, one-time paid checkout from the verified Block Writer payment link. Responses are not cached and operational failures return retryable HTTP 503.

Both fixes require publishing the landing project before they affect customers. Existing desktop binaries keep the same verification contract.

## Coverage ledger

| Environment / state or control | Result |
| --- | --- |
| Live landing page and published purchase destination | Passed: destination from desktop source opens correct checkout |
| Live checkout product, amount and account availability | Passed |
| Live Pay button submission | Not performed: no new charge authorized |
| Configured post-checkout return URL | Passed: reachable via direct navigation; a new payment redirect was not exercised |
| Existing paid / unpaid / invalid production activation verification | Passed |
| Updated handler with existing paid and unpaid Stripe sessions | Passed |
| Local success page, missing reference | Passed: no code or false activation claim |
| Local success page, simulated paid response | Passed: activation instructions, code, download link |
| Local Copy button | Passed: copied feedback |
| Local simulated unpaid response | Passed: no activation code; retry and support offered |
| Local simulated service failure and Check again button | Passed: retry remains usable and no prompt to repurchase |
| Actual desktop purchase button and license database update | Source inspected only |
| Mobile layout, legal and support navigation | Outside focused payment-check scope |

Local browser payment states used a temporary simulated API. They are not evidence of a new live payment. Automated verification tests cover paid, unpaid, incomplete, test-mode, other-product and subscription sessions, malformed codes, missing checkout, missing server configuration, outages and unsupported methods: 15 passed. `npm run build --prefix landing` and `git diff --check` passed.

## Remaining limitations

No new card or bank transaction, receipt delivery, delayed-payment completion, refund handling or lost-code recovery was exercised. There is no automatic activation-code recovery implementation in this repository; the confirmation page directs customers to support. The existing app stores activation locally after verification. These checks do not establish unique-customer or non-transferable license enforcement.
