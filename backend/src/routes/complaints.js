import { Router } from "express";
import pool from "../config/db.js";
import { makeId, asyncHandler } from "../utils/helpers.js";
import { stripHtml, validatePhone } from "../utils/validation.js";

const router = Router();

// POST / — submit complaint
router.post("/", asyncHandler(async (req, res) => {
  const { name, phone, issueType, details } = req.body;
  if (!name || !phone || !issueType || !details) {
    return res.status(400).json({ error: "Missing required complaint fields." });
  }
  if (!validatePhone(phone)) {
    return res.status(400).json({ error: "Invalid phone number." });
  }

  const result = await pool.query(
    `INSERT INTO complaints (id, name, phone, issue_type, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, phone, issue_type AS "issueType", details, status, created_at AS "createdAt"`,
    [makeId("CP"), stripHtml(name).trim(), phone.trim(), stripHtml(issueType), stripHtml(details).trim()]
  );
  return res.status(201).json(result.rows[0]);
}));

// GET / — list complaints with pagination
router.get("/", asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const conditions = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM complaints ${whereClause}`, params);

  params.push(limit);
  params.push(offset);

  const result = await pool.query(
    `SELECT id, name, phone, issue_type AS "issueType", details, status, created_at AS "createdAt"
     FROM complaints ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return res.json({ total: countResult.rows[0].total, limit, offset, data: result.rows });
}));

export default router;
