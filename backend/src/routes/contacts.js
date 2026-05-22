import { Router } from "express";
import pool from "../config/db.js";
import { makeId, asyncHandler } from "../utils/helpers.js";
import { validateEmail, stripHtml } from "../utils/validation.js";

const router = Router();

// POST / — submit contact form
router.post("/", asyncHandler(async (req, res) => {
  const { name, email, message, type } = req.body;
  if (!name || !email || !message || !type) {
    return res.status(400).json({ error: "Missing required contact fields." });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const result = await pool.query(
    `INSERT INTO contacts (id, name, email, message, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, message, type, created_at AS "createdAt"`,
    [makeId("CT"), stripHtml(name).trim(), email.trim(), stripHtml(message).trim(), stripHtml(type)]
  );
  return res.status(201).json(result.rows[0]);
}));

// GET / — list contacts with pagination (admin should protect this externally)
router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];

  if (req.query.type) {
    params.push(req.query.type);
    conditions.push(`type = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM contacts ${whereClause}`, params);

  params.push(limit);
  params.push(offset);

  const result = await pool.query(
    `SELECT id, name, email, message, type, created_at AS "createdAt"
     FROM contacts ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return res.json({ total: countResult.rows[0].total, limit, offset, data: result.rows });
}));

export default router;
