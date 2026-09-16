import Stripe from "stripe";
import { createHmac } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYMENT_LINK_IDS = ["plink_1TL60GRmuMPkEzpHKpbIRzbB", "plink_1UGLbmRmuMPkEzpHS1hhKxeP"];
const MESSAGE = "If we find a paid purchase for that email, we'll send your activation code. Check your inbox and spam folder. If you requested it today, look for the earlier email.";
// Best-effort instance throttling. Resend idempotency also suppresses duplicate
// emails across instances. Add an edge rate limit before exposing to heavy traffic.
const requests = new Map<string, { count: number; expires: number }>();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }
  const origin = req.headers.origin;
  if (origin && !["https://blockwriter.sh", "https://focused-writer.vercel.app"].includes(origin)) {
    return res.status(403).json({ error: "Request not allowed." });
  }
  if (!req.headers["content-type"]?.includes("application/json")) {
    return res.status(415).json({ error: "Use JSON." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid purchase email." });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LICENSE_EMAIL_FROM;
  if (!key || !resendKey || !from) {
    return res.status(503).json({ error: "Email recovery is temporarily unavailable. Please contact support." });
  }
  const digest = (value: string) => createHmac("sha256", key).update(value).digest("hex");
  const now = Date.now();
  for (const [id, entry] of requests) if (entry.expires <= now) requests.delete(id);
  const ip = req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const bucket = digest(String(ip));
  const entry = requests.get(bucket) || { count: 0, expires: now + 15 * 60 * 1000 };
  if (entry.count >= 5 || requests.size >= 10000) {
    res.setHeader("Retry-After", "900");
    return res.status(429).json({ error: "Too many requests. Please try again in 15 minutes." });
  }
  entry.count++;
  requests.set(bucket, entry);

  try {
    const stripe = new Stripe(key, { timeout: 8000, maxNetworkRetries: 0 });
    let match: Stripe.Checkout.Session | undefined;
    const deadline = Date.now() + 35000;
    // Payment Links can create guest checkouts with no Customer object. Search
    // their completed sessions, including pre-recovery purchases, not Customers.
    for (const paymentLink of PAYMENT_LINK_IDS) {
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        if (Date.now() >= deadline) throw new Error("Recovery search timed out");
        const sessions = await stripe.checkout.sessions.list({
          payment_link: paymentLink, status: "complete", limit: 100,
          ...(cursor ? { starting_after: cursor } : {}),
        });
        const candidate = sessions.data.find((session) =>
          session.livemode && session.mode === "payment" && session.status === "complete" &&
          session.payment_status === "paid" && session.payment_link === paymentLink &&
          (session.customer_details?.email || session.customer_email || "").trim().toLowerCase() === email,
        );
        if (candidate) {
          if (!match || candidate.created > match.created) match = candidate;
          break;
        }
        if (!sessions.has_more) break;
        if (page === 9 || !sessions.data.length) throw new Error("Recovery search limit reached");
        cursor = sessions.data[sessions.data.length - 1].id;
      }
    }
    if (match) {
      const intentId = typeof match.payment_intent === "string" ? match.payment_intent : match.payment_intent?.id;
      if (!intentId) throw new Error("Missing payment reference");
      const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
      const charge = intent.latest_charge;
      if (!charge || typeof charge === "string") throw new Error("Missing charge");
      if (charge.refunded || charge.amount_refunded > 0 || charge.disputed) {
        return res.json({ message: MESSAGE });
      }
      // Deliver only to the address recorded on the checkout, never an alternate
      // address supplied by the requester. Never return the code in the response.
      const recipient = (match.customer_details?.email || match.customer_email)!;
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `license-${digest(`${email}:${match.id}:${new Date().toISOString().slice(0, 10)}`)}`,
        },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          from, to: [recipient], subject: "Your Block Writer activation code",
          text: `Here's your Block Writer activation code:\n\n${match.id}\n\nOpen Block Writer and paste this code into the activation field to unlock lifetime access. Keep it safe for future reinstalls.\n\nDownload Block Writer: https://blockwriter.sh\n\nIf you didn't request this email, you can ignore it. Your license hasn't changed.\n\nNeed help? Reply to scottschindler29@gmail.com.`,
          reply_to: "scottschindler29@gmail.com",
        }),
      });
      if (!response.ok) throw new Error("Recovery email unavailable");
    }
    return res.json({ message: MESSAGE });
  } catch {
    // No Stripe identifiers, email addresses or provider responses in logs/output.
    return res.status(503).json({ error: "We couldn't process your request. Please try again later or contact support." });
  }
}
