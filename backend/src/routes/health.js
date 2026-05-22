import { Router } from "express";
import pool from "../config/db.js";
import { asyncHandler } from "../utils/helpers.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const timestamp = new Date().toISOString();
  try {
    await pool.query("SELECT 1 AS ping");
    res.json({ ok: true, service: "stockgas-backend", timestamp, database: { connected: true } });
  } catch (err) {
    res.json({ ok: false, service: "stockgas-backend", timestamp, database: { connected: false, error: err.message } });
  }
}));

export default router;
