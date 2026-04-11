import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sessionId = req.query.session_id;

  if (typeof sessionId !== "string" || !sessionId) {
    return res.json({ valid: false });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({ valid: session.payment_status === "paid" });
  } catch {
    return res.json({ valid: false });
  }
}
