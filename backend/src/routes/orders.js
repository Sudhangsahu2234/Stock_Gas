import { Router } from "express";
import pool from "../config/db.js";
import { makeId, asyncHandler, normalizePhoneDigits } from "../utils/helpers.js";
import { validateOrderPayload } from "../utils/validation.js";
import { requireAdmin } from "../middleware/auth.js";
import { orderLimiter } from "../middleware/rateLimiter.js";

const router = Router();

export const orderFieldsSql = `
  id,
  customer_name AS "customerName",
  phone,
  cylinder_size_kg AS "cylinderSizeKg",
  quantity,
  payment_method AS "paymentMethod",
  address,
  status,
  amount_inr AS "amountInr",
  currency,
  payment_status AS "paymentStatus",
  payment_gateway AS "paymentGateway",
  gateway_order_id AS "gatewayOrderId",
  gateway_payment_id AS "gatewayPaymentId",
  cancelled_reason AS "cancelledReason",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

/**
 * Insert a new order into the database.
 * Returns the newly created order row.
 */
export async function insertOrder({
  customerName,
  phone,
  cylinderSizeKg,
  quantity,
  paymentMethod,
  address,
  amountInr = null,
  currency = "INR",
  paymentStatus = "Pending",
  paymentGateway = null,
  gatewayOrderId = null,
  gatewayPaymentId = null,
}) {
  const id = makeId("SG");
  const result = await pool.query(
    `INSERT INTO orders
       (id, customer_name, phone, cylinder_size_kg, quantity,
        payment_method, address, amount_inr, currency,
        payment_status, payment_gateway, gateway_order_id, gateway_payment_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING ${orderFieldsSql}`,
    [
      id, customerName, phone, cylinderSizeKg, quantity,
      paymentMethod, address, amountInr, currency,
      paymentStatus, paymentGateway, gatewayOrderId, gatewayPaymentId,
    ]
  );
  return result.rows[0];
}

// POST / — Create order
router.post("/", orderLimiter, asyncHandler(async (req, res) => {
  const validation = validateOrderPayload(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  const order = await insertOrder(validation.payload);
  return res.status(201).json(order);
}));

// GET / — List orders with pagination
router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (req.query.from) {
    params.push(req.query.from);
    conditions.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (req.query.to) {
    params.push(req.query.to);
    conditions.push(`created_at <= $${params.length}::timestamptz`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM orders ${whereClause}`,
    params
  );

  params.push(limit);
  params.push(offset);

  const result = await pool.query(
    `SELECT ${orderFieldsSql}
     FROM orders ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return res.json({
    total: countResult.rows[0].total,
    limit,
    offset,
    orders: result.rows,
  });
}));

// GET /lookup — Lookup by reference or phone
router.get("/lookup", asyncHandler(async (req, res) => {
  const { ref, phone } = req.query;

  if (ref) {
    const result = await pool.query(
      `SELECT ${orderFieldsSql} FROM orders WHERE id = $1`,
      [ref.trim()]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Order not found." });
    return res.json(result.rows[0]);
  }

  if (phone) {
    const normalized = normalizePhoneDigits(phone);
    const result = await pool.query(
      `SELECT ${orderFieldsSql} FROM orders
       WHERE REGEXP_REPLACE(phone, '\\D', '', 'g') LIKE '%' || $1 || '%'
       ORDER BY created_at DESC LIMIT 20`,
      [normalized]
    );
    return res.json(result.rows);
  }

  return res.status(400).json({ error: "Provide ?ref= or ?phone= query parameter." });
}));

// GET /:id — Get single order
router.get("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT ${orderFieldsSql} FROM orders WHERE id = $1`,
    [req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Order not found." });
  return res.json(result.rows[0]);
}));

// PATCH /:id/status — Update order status (admin only)
router.patch("/:id/status", requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status is required." });

  const allowedFlow = {
    Pending: "Confirmed",
    Confirmed: "Dispatched",
    Dispatched: "Delivered",
  };

  const current = await pool.query(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (current.rowCount === 0) return res.status(404).json({ error: "Order not found." });

  const currentStatus = current.rows[0].status;
  if (allowedFlow[currentStatus] !== status) {
    return res.status(400).json({
      error: `Cannot transition from '${currentStatus}' to '${status}'. Expected '${allowedFlow[currentStatus] || "N/A"}'.`,
    });
  }

  const result = await pool.query(
    `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2
     RETURNING ${orderFieldsSql}`,
    [status, req.params.id]
  );

  return res.json(result.rows[0]);
}));

// PATCH /:id/cancel — Cancel order (admin only)
router.patch("/:id/cancel", requireAdmin, asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const current = await pool.query(`SELECT status FROM orders WHERE id = $1`, [req.params.id]);
  if (current.rowCount === 0) return res.status(404).json({ error: "Order not found." });

  const currentStatus = current.rows[0].status;
  if (!["Pending", "Confirmed"].includes(currentStatus)) {
    return res.status(400).json({
      error: `Cannot cancel an order with status '${currentStatus}'. Only Pending or Confirmed orders can be cancelled.`,
    });
  }

  const result = await pool.query(
    `UPDATE orders SET status = 'Cancelled', cancelled_reason = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING ${orderFieldsSql}`,
    [reason || null, req.params.id]
  );

  return res.json(result.rows[0]);
}));

export default router;
