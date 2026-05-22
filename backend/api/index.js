/**
 * Vercel serverless entry point for the StockGAS Express backend.
 *
 * Vercel imports this module once per cold start. Top-level await
 * runs the idempotent database migrations (CREATE TABLE IF NOT EXISTS,
 * ALTER TABLE ADD COLUMN IF NOT EXISTS) before the function becomes ready,
 * so every request is guaranteed a valid schema.
 */

import {
  app,
  initializeDatabase,
  cleanupRetentionData,
  seedDefaultAdmin
} from "../src/server.js";

// ── one-time cold-start initialisation ──
try {
  await initializeDatabase();
  await cleanupRetentionData();
  await seedDefaultAdmin();
  console.log("Vercel cold-start: database initialised.");
} catch (err) {
  // Log but don't crash — the function should still respond
  // (individual routes will surface DB errors naturally).
  console.error("Vercel cold-start: database init failed:", err.message);
}

export default app;
