import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const DMG_URL =
  "https://github.com/scottschindler/focused-writer/releases/latest/download/Focused_Writer_1.0.0_aarch64.dmg";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { session_id } = req.query;

  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ error: "Missing session_id" });
  }

  const session = await stripe.checkout.sessions.retrieve(session_id);

  if (session.payment_status !== "paid") {
    return res.status(403).json({ error: "Payment not completed" });
  }

  res.redirect(302, DMG_URL);
}
