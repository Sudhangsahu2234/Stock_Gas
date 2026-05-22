import { Router } from "express";
import pool from "../config/db.js";
import { makeId, asyncHandler } from "../utils/helpers.js";
import { requireAdmin } from "../middleware/auth.js";
import { stripHtml } from "../utils/validation.js";

const router = Router();

// All routes in this file require admin auth
router.use(requireAdmin);

// GET /summary — Dashboard summary counts
router.get("/summary", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COUNT(*)::int FROM contacts) AS contacts,
      (SELECT COUNT(*)::int FROM complaints) AS complaints,
      (SELECT COUNT(*)::int FROM request_logs) AS "requestLogs",
      (SELECT COUNT(*)::int FROM admin_users WHERE is_active = true) AS "activeAdmins",
      COALESCE((SELECT COUNT(*)::int FROM notifications WHERE is_read = false), 0) AS "unreadNotifications",
      COALESCE((SELECT COUNT(*)::int FROM alerts WHERE is_active = true), 0) AS "activeAlerts",
      COALESCE((SELECT COUNT(*)::int FROM error_logs), 0) AS "errorLogs"`
  );
  return res.json(result.rows[0]);
}));

// GET /logs — Request audit logs with pagination + filters
router.get("/logs", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const conditions = [];
  const params = [];

  if (req.query.method) { params.push(req.query.method.toUpperCase()); conditions.push(`method = $${params.length}`); }
  if (req.query.status) { params.push(Number(req.query.status)); conditions.push(`status_code = $${params.length}`); }
  if (req.query.path) { params.push(`%${req.query.path}%`); conditions.push(`path ILIKE $${params.length}`); }
  if (req.query.from) { params.push(req.query.from); conditions.push(`created_at >= $${params.length}::timestamptz`); }
  if (req.query.to) { params.push(req.query.to); conditions.push(`created_at <= $${params.length}::timestamptz`); }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM request_logs ${whereClause}`, params);

  params.push(limit);
  params.push(offset);

  const result = await pool.query(
    `SELECT id, method, url, path, query_string AS "queryString", ip,
       user_agent AS "userAgent", referer, status_code AS "statusCode",
       response_time_ms AS "responseTimeMs", request_body AS "requestBody",
       created_at AS "createdAt"
     FROM request_logs ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return res.json({ total: countResult.rows[0].total, limit, offset, logs: result.rows });
}));

// GET /errors — Error logs with pagination
router.get("/errors", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM error_logs`);

  const result = await pool.query(
    `SELECT id, error_type AS "errorType", message, stack, route, method, ip,
       created_at AS "createdAt"
     FROM error_logs ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return res.json({ total: countResult.rows[0].total, limit, offset, errors: result.rows });
}));

// ── Analytics ──

// GET /analytics/orders — Order analytics
router.get("/analytics/orders", asyncHandler(async (req, res) => {
  const period = req.query.period || "7d";
  const periodDays = period === "30d" ? 30 : period === "90d" ? 90 : period === "1d" ? 1 : 7;

  const [summary, byDay, byStatus, topSizes] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS "totalOrders",
              COALESCE(SUM(amount_inr), 0)::float AS "totalRevenue",
              COALESCE(AVG(amount_inr), 0)::float AS "avgOrderValue"
       FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
      [periodDays]
    ),
    pool.query(
      `SELECT created_at::date AS date, COUNT(*)::int AS count,
              COALESCE(SUM(amount_inr), 0)::float AS revenue
       FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY created_at::date ORDER BY date`,
      [periodDays]
    ),
    pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY status`,
      [periodDays]
    ),
    pool.query(
      `SELECT cylinder_size_kg AS "sizeKg", COUNT(*)::int AS count
       FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY cylinder_size_kg ORDER BY count DESC LIMIT 10`,
      [periodDays]
    )
  ]);

  const statusObj = {};
  byStatus.rows.forEach((r) => { statusObj[r.status] = r.count; });

  return res.json({
    period,
    ...summary.rows[0],
    ordersByDay: byDay.rows,
    ordersByStatus: statusObj,
    topCylinderSizes: topSizes.rows
  });
}));

// GET /analytics/requests — Request analytics
router.get("/analytics/requests", asyncHandler(async (req, res) => {
  const periodDays = Number(req.query.days) || 7;

  const [summary, topEndpoints, byHour] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS "totalRequests",
              COUNT(*) FILTER (WHERE status_code >= 400)::int AS "errorCount",
              ROUND(AVG(response_time_ms)::numeric, 2)::float AS "avgResponseMs"
       FROM request_logs WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
      [periodDays]
    ),
    pool.query(
      `SELECT path, method, COUNT(*)::int AS count
       FROM request_logs WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY path, method ORDER BY count DESC LIMIT 10`,
      [periodDays]
    ),
    pool.query(
      `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS count
       FROM request_logs WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY hour ORDER BY hour`,
      [periodDays]
    )
  ]);

  return res.json({
    periodDays,
    ...summary.rows[0],
    topEndpoints: topEndpoints.rows,
    requestsByHour: byHour.rows
  });
}));

// GET /analytics/customers — Customer analytics
router.get("/analytics/customers", asyncHandler(async (req, res) => {
  const periodDays = Number(req.query.days) || 30;

  const [topCustomers, newVsReturning] = await Promise.all([
    pool.query(
      `SELECT customer_name AS "customerName", phone, COUNT(*)::int AS "orderCount",
              COALESCE(SUM(amount_inr), 0)::float AS "totalSpent"
       FROM orders WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY customer_name, phone ORDER BY "orderCount" DESC LIMIT 20`,
      [periodDays]
    ),
    pool.query(
      `SELECT
        COUNT(DISTINCT phone) FILTER (WHERE first_order >= NOW() - INTERVAL '1 day' * $1)::int AS "newCustomers",
        COUNT(DISTINCT phone) FILTER (WHERE first_order < NOW() - INTERVAL '1 day' * $1)::int AS "returningCustomers"
       FROM (SELECT phone, MIN(created_at) AS first_order FROM orders GROUP BY phone) sub`,
      [periodDays]
    )
  ]);

  return res.json({
    periodDays,
    ...newVsReturning.rows[0],
    topCustomers: topCustomers.rows
  });
}));

// ── Products (Catalog) ──

// GET /products — List all products (admin view, includes out-of-stock)
router.get("/products", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, size_kg AS "sizeKg", price_inr AS "priceInr", description,
       in_stock AS "inStock", sort_order AS "sortOrder",
       created_at AS "createdAt", updated_at AS "updatedAt"
     FROM products ORDER BY sort_order, size_kg`
  );
  return res.json(result.rows);
}));

// POST /products — Create product
router.post("/products", asyncHandler(async (req, res) => {
  const { name, sizeKg, priceInr, description, inStock, sortOrder } = req.body;
  if (!name || !sizeKg || !priceInr) {
    return res.status(400).json({ error: "Name, size (kg), and price (INR) are required." });
  }

  const result = await pool.query(
    `INSERT INTO products (id, name, size_kg, price_inr, description, in_stock, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, size_kg AS "sizeKg", price_inr AS "priceInr", description,
       in_stock AS "inStock", sort_order AS "sortOrder", created_at AS "createdAt"`,
    [makeId("PRD"), stripHtml(name), Number(sizeKg), Number(priceInr), description ? stripHtml(description) : null, inStock !== false, Number(sortOrder || 0)]
  );
  return res.status(201).json(result.rows[0]);
}));

// PATCH /products/:id — Update product
router.patch("/products/:id", asyncHandler(async (req, res) => {
  const updates = [];
  const params = [];

  if (req.body.name !== undefined) { params.push(stripHtml(req.body.name)); updates.push(`name = $${params.length}`); }
  if (req.body.sizeKg !== undefined) { params.push(Number(req.body.sizeKg)); updates.push(`size_kg = $${params.length}`); }
  if (req.body.priceInr !== undefined) { params.push(Number(req.body.priceInr)); updates.push(`price_inr = $${params.length}`); }
  if (req.body.description !== undefined) { params.push(req.body.description ? stripHtml(req.body.description) : null); updates.push(`description = $${params.length}`); }
  if (req.body.inStock !== undefined) { params.push(Boolean(req.body.inStock)); updates.push(`in_stock = $${params.length}`); }
  if (req.body.sortOrder !== undefined) { params.push(Number(req.body.sortOrder)); updates.push(`sort_order = $${params.length}`); }

  if (updates.length === 0) return res.status(400).json({ error: "No fields to update." });

  updates.push(`updated_at = NOW()`);
  params.push(req.params.id);

  const result = await pool.query(
    `UPDATE products SET ${updates.join(", ")} WHERE id = $${params.length}
     RETURNING id, name, size_kg AS "sizeKg", price_inr AS "priceInr", description,
       in_stock AS "inStock", sort_order AS "sortOrder", updated_at AS "updatedAt"`,
    params
  );

  if (result.rowCount === 0) return res.status(404).json({ error: "Product not found." });
  return res.json(result.rows[0]);
}));

// DELETE /products/:id — Soft delete (set in_stock = false)
router.delete("/products/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE products SET in_stock = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Product not found." });
  return res.json({ message: "Product removed from catalog." });
}));

export default router;
