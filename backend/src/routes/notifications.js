import { Router } from "express";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/helpers.js";
import { requireAdmin } from "../middleware/auth.js";
import { stripHtml } from "../utils/validation.js";

const router = Router();

// ── Public: Active alerts ──

// GET /alerts/active — Get all currently active system alerts (public endpoint)
router.get("/alerts/active", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, title, message, type, priority, created_at AS "createdAt"
     FROM alerts
     WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY priority DESC, created_at DESC`
  );
  return res.json(result.rows);
}));

// ── Admin: Notifications ──

// GET /notifications — List notifications for current admin user
router.get("/notifications", requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notifications WHERE user_id = $1 OR user_id IS NULL`,
    [req.adminUser.id]
  );

  const result = await pool.query(
    `SELECT id, title, message, type, is_read AS "isRead", link, created_at AS "createdAt"
     FROM notifications WHERE user_id = $1 OR user_id IS NULL
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.adminUser.id, limit, offset]
  );

  return res.json({ total: countResult.rows[0].total, limit, offset, data: result.rows });
}));

// PATCH /notifications/:id/read — Mark notification as read
router.patch("/notifications/:id/read", requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "Notification not found." });
  return res.json({ message: "Notification marked as read." });
}));

// POST /notifications/mark-all-read — Mark all notifications as read
router.post("/notifications/mark-all-read", requireAdmin, asyncHandler(async (req, res) => {
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
    [req.adminUser.id]
  );
  return res.json({ message: "All notifications marked as read." });
}));

// POST /notifications — Create notification (admin only)
router.post("/notifications", requireAdmin, asyncHandler(async (req, res) => {
  const { title, message, type, userId, link } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required." });
  }

  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id AS "userId", title, message, type, is_read AS "isRead", link, created_at AS "createdAt"`,
    [userId || null, stripHtml(title), stripHtml(message), type || "info", link || null]
  );
  return res.status(201).json(result.rows[0]);
}));

// ── Admin: System Alerts ──

// GET /alerts — List all alerts (admin view)
router.get("/alerts", requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, title, message, type, is_active AS "isActive", priority,
       target_role AS "targetRole", expires_at AS "expiresAt", created_at AS "createdAt"
     FROM alerts ORDER BY created_at DESC`
  );
  return res.json(result.rows);
}));

// POST /alerts — Create system alert
router.post("/alerts", requireAdmin, asyncHandler(async (req, res) => {
  const { title, message, type, priority, targetRole, expiresAt } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: "Title and message are required." });
  }

  const result = await pool.query(
    `INSERT INTO alerts (title, message, type, priority, target_role, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, message, type, is_active AS "isActive", priority,
       target_role AS "targetRole", expires_at AS "expiresAt", created_at AS "createdAt"`,
    [
      stripHtml(title), stripHtml(message),
      type || "info", Number(priority || 0),
      targetRole || "all", expiresAt || null
    ]
  );
  return res.status(201).json(result.rows[0]);
}));

// PATCH /alerts/:id — Update alert (toggle active, edit content)
router.patch("/alerts/:id", requireAdmin, asyncHandler(async (req, res) => {
  const updates = [];
  const params = [];

  if (req.body.title !== undefined) { params.push(stripHtml(req.body.title)); updates.push(`title = $${params.length}`); }
  if (req.body.message !== undefined) { params.push(stripHtml(req.body.message)); updates.push(`message = $${params.length}`); }
  if (req.body.type !== undefined) { params.push(req.body.type); updates.push(`type = $${params.length}`); }
  if (req.body.isActive !== undefined) { params.push(Boolean(req.body.isActive)); updates.push(`is_active = $${params.length}`); }
  if (req.body.priority !== undefined) { params.push(Number(req.body.priority)); updates.push(`priority = $${params.length}`); }
  if (req.body.expiresAt !== undefined) { params.push(req.body.expiresAt); updates.push(`expires_at = $${params.length}`); }

  if (updates.length === 0) return res.status(400).json({ error: "No fields to update." });

  params.push(req.params.id);

  const result = await pool.query(
    `UPDATE alerts SET ${updates.join(", ")} WHERE id = $${params.length}
     RETURNING id, title, message, type, is_active AS "isActive", priority,
       target_role AS "targetRole", expires_at AS "expiresAt", created_at AS "createdAt"`,
    params
  );

  if (result.rowCount === 0) return res.status(404).json({ error: "Alert not found." });
  return res.json(result.rows[0]);
}));

// DELETE /alerts/:id — Delete alert
router.delete("/alerts/:id", requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(`DELETE FROM alerts WHERE id = $1 RETURNING id`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Alert not found." });
  return res.json({ message: "Alert deleted." });
}));

// ── Public: Products catalog ──

// GET /products — List in-stock products (public endpoint for frontend)
router.get("/products", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, size_kg AS "sizeKg", price_inr AS "priceInr", description
     FROM products WHERE in_stock = true
     ORDER BY sort_order, size_kg`
  );
  return res.json(result.rows);
}));

export default router;
