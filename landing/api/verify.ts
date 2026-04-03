import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { session_id } = req.query;

  if (!session_id || typeof session_id !== "string") {
    return res.status(400).json({ valid: false, error: "Missing session_id" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    const valid = session.payment_status === "paid";
    return res.status(200).json({ valid });
  } catch {
    return res.status(200).json({ valid: false, error: "Invalid session" });
  }
}
