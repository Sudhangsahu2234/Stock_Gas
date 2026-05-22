import { Router } from "express";
import crypto from "crypto";
import pool from "../config/db.js";
import { makeId, asyncHandler } from "../utils/helpers.js";
import { validateOrderPayload } from "../utils/validation.js";
import { insertOrder, orderFieldsSql } from "./orders.js";
import { orderLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
const razorpayCurrency = process.env.RAZORPAY_CURRENCY?.trim() || "INR";
const isRazorpayConfigured = () => Boolean(razorpayKeyId && razorpayKeySecret);

// POST /razorpay/order — create Razorpay payment order
router.post("/razorpay/order", orderLimiter, asyncHandler(async (req, res) => {
  const validation = validateOrderPayload({ ...req.body, paymentMethod: "Razorpay" });
  if (validation.error) return res.status(400).json({ error: validation.error });
  if (!isRazorpayConfigured()) return res.status(500).json({ error: "Razorpay is not configured." });

  const { customerName, phone, cylinderSizeKg, quantity, address, amountInr } = validation.payload;
  if (amountInr === null) return res.status(400).json({ error: "Amount is required for Razorpay payments." });

  const successUrl = `${process.env.FRONTEND_ORIGIN}/success`;
  const cancelUrl = `${process.env.FRONTEND_ORIGIN}/error`;

  const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(amountInr * 100),
      currency: razorpayCurrency,
      receipt: makeId("RZP"),
      callback_url: successUrl,
      cancel_url: cancelUrl,
      notes: { customerName, phone, cylinderSizeKg: String(cylinderSizeKg), quantity: String(quantity), address }
    })
  });

  const razorpayData = await razorpayResponse.json().catch(() => ({}));
  if (!razorpayResponse.ok) {
    return res.status(502).json({
      error: razorpayData?.error?.description || razorpayData?.error?.reason || "Unable to create Razorpay order."
    });
  }

  const checkoutUrl = `https://checkout.razorpay.com/v1/checkout/embedded?key_id=${razorpayKeyId}&order_id=${razorpayData.id}&callback_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`;
  return res.json({ checkoutUrl });
}));

// POST /razorpay/verify — verify Razorpay payment and create order
router.post("/razorpay/verify", orderLimiter, asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, booking } = req.body;
  if (!isRazorpayConfigured()) return res.status(500).json({ error: "Razorpay is not configured." });
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !booking) {
    return res.status(400).json({ error: "Missing Razorpay verification details." });
  }

  const validation = validateOrderPayload({ ...booking, paymentMethod: "Razorpay" });
  if (validation.error) return res.status(400).json({ error: validation.error });

  const expectedSignature = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ error: "Razorpay signature verification failed." });
  }

  const existing = await pool.query(
    `SELECT ${orderFieldsSql} FROM orders WHERE gateway_payment_id = $1`,
    [razorpayPaymentId]
  );
  if (existing.rowCount > 0) return res.json(existing.rows[0]);

  const order = await insertOrder({
    ...validation.payload,
    paymentMethod: "Razorpay",
    currency: razorpayCurrency,
    paymentStatus: "Paid",
    paymentGateway: "Razorpay",
    gatewayOrderId: razorpayOrderId,
    gatewayPaymentId: razorpayPaymentId
  });

  return res.status(201).json(order);
}));

export default router;
