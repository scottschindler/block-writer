import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYMENT_LINK_IDS = ["plink_1TL60GRmuMPkEzpHKpbIRzbB", "plink_1UGLbmRmuMPkEzpHS1hhKxeP"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ valid: false });
  }
  const sessionId = req.query.session_id;

  if (typeof sessionId !== "string" || !/^cs_live_[a-zA-Z0-9]+$/.test(sessionId)) {
    return res.json({ valid: false });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ valid: false });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10000, maxNetworkRetries: 1 });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({
      valid: session.livemode && session.mode === "payment" &&
        session.status === "complete" && session.payment_status === "paid" &&
        typeof session.payment_link === "string" && PAYMENT_LINK_IDS.includes(session.payment_link),
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing") {
      return res.json({ valid: false });
    }
    return res.status(503).json({ valid: false });
  }
}
