import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import morgan from "morgan";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigins = Array.from(
  new Set(
    [process.env.FRONTEND_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"]
      .filter(Boolean)
      .flatMap((originList) => originList.split(","))
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);
const buildDbConfig = () => {
  const fallbackPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres";
  const defaultUser = process.env.PGUSER || "postgres";
  let databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    // Allow "localhost:5432/stockgas" style without scheme
    if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
      databaseUrl = `postgresql://${databaseUrl}`;
    }

    const parsed = new URL(databaseUrl);

    // Common mistake: postgresql://localhost@localhost:5432/db → role "localhost"
    if (parsed.username === "localhost") {
      console.warn(
        'DATABASE_URL: username was "localhost" (invalid for most Postgres installs). Using PGUSER/postgres instead.'
      );
      parsed.username = defaultUser;
    } else if (!parsed.username) {
      parsed.username = defaultUser;
    }

    if (!parsed.password) {
      parsed.password = fallbackPassword;
    }

    return { connectionString: parsed.toString() };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: defaultUser,
    password: fallbackPassword,
    database: process.env.PGDATABASE || "stockgas"
  };
};

const pool = new Pool(buildDbConfig());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());
app.use(morgan("dev"));

const makeId = (prefix) => `${prefix}-${Date.now()}`;
const orderFieldsSql = `
  id,
  customer_name AS "customerName",
  phone,
  cylinder_size_kg AS "cylinderSizeKg",
  quantity,
  payment_method AS "paymentMethod",
  address,
  status,
  created_at AS "createdAt"
`;
const normalizePhoneDigits = (value = "") => value.replace(/\D/g, "");
const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const initializeDatabase = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      cylinder_size_kg DOUBLE PRECISION NOT NULL,
      quantity INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Support fractional cylinder sizes like 12.5kg used by the frontend.
  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN cylinder_size_kg TYPE DOUBLE PRECISION
    USING cylinder_size_kg::DOUBLE PRECISION;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log("PostgreSQL: connected and schema is ready.");
};

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "StockGAS backend is running.",
    health: "/api/health"
  });
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const timestamp = new Date().toISOString();
    const base = { service: "stockgas-backend", timestamp };
    try {
      await pool.query("SELECT 1 AS ping");
      res.json({ ok: true, ...base, database: { connected: true } });
    } catch (err) {
      res.json({
        ok: false,
        ...base,
        database: { connected: false, error: err.message }
      });
    }
  })
);

app.post("/api/orders", asyncHandler(async (req, res) => {
  const { customerName, phone, cylinderSizeKg, quantity, paymentMethod, address } = req.body;
  const sizeKg = Number(cylinderSizeKg);
  const qty = Number(quantity);

  if (!customerName || !phone || !cylinderSizeKg || !quantity || !paymentMethod || !address) {
    return res.status(400).json({ error: "Missing required order fields." });
  }

  if (!Number.isFinite(sizeKg) || sizeKg <= 0) {
    return res.status(400).json({ error: "Cylinder size must be a valid number." });
  }

  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantity must be a whole number greater than zero." });
  }

  const result = await pool.query(
    `INSERT INTO orders
      (id, customer_name, phone, cylinder_size_kg, quantity, payment_method, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${orderFieldsSql}`,
    [makeId("SG"), customerName, phone, sizeKg, qty, paymentMethod, address]
  );

  return res.status(201).json(result.rows[0]);
}));

app.get("/api/orders", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT
      ${orderFieldsSql}
     FROM orders
     ORDER BY created_at DESC`
  );
  return res.json(result.rows);
}));

app.get("/api/orders/lookup", asyncHandler(async (req, res) => {
  const reference =
    typeof req.query.reference === "string"
      ? req.query.reference.trim()
      : typeof req.query.id === "string"
        ? req.query.id.trim()
        : "";
  const phoneDigits = typeof req.query.phone === "string" ? normalizePhoneDigits(req.query.phone) : "";

  if (!reference && !phoneDigits) {
    return res.status(400).json({ error: "Provide an order reference or phone number to continue." });
  }

  if (phoneDigits && phoneDigits.length < 7) {
    return res.status(400).json({ error: "Phone number lookup needs at least 7 digits." });
  }

  const conditions = [];
  const params = [];

  if (reference) {
    params.push(reference);
    conditions.push(`LOWER(id) = LOWER($${params.length})`);
  }

  if (phoneDigits) {
    params.push(phoneDigits);
    conditions.push(`regexp_replace(phone, '\\D', '', 'g') = $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
      ${orderFieldsSql}
     FROM orders
     WHERE ${conditions.join(" AND ")}
     ORDER BY created_at DESC`,
    params
  );

  return res.json({
    orders: result.rows
  });
}));

app.get("/api/orders/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT
      ${orderFieldsSql}
     FROM orders
     WHERE id = $1`,
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Order not found." });
  }
  return res.json(result.rows[0]);
}));

app.post("/api/contact", asyncHandler(async (req, res) => {
  const { name, email, message, type } = req.body;
  if (!name || !email || !message || !type) {
    return res.status(400).json({ error: "Missing required contact fields." });
  }

  const result = await pool.query(
    `INSERT INTO contacts (id, name, email, message, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, message, type, created_at AS "createdAt"`,
    [makeId("CT"), name, email, message, type]
  );
  return res.status(201).json(result.rows[0]);
}));

app.get("/api/contacts", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, email, message, type, created_at AS "createdAt"
     FROM contacts
     ORDER BY created_at DESC`
  );
  return res.json(result.rows);
}));

app.post("/api/complaints", asyncHandler(async (req, res) => {
  const { name, phone, issueType, details } = req.body;
  if (!name || !phone || !issueType || !details) {
    return res.status(400).json({ error: "Missing required complaint fields." });
  }

  const result = await pool.query(
    `INSERT INTO complaints (id, name, phone, issue_type, details)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING
      id,
      name,
      phone,
      issue_type AS "issueType",
      details,
      status,
      created_at AS "createdAt"`,
    [makeId("CP"), name, phone, issueType, details]
  );
  return res.status(201).json(result.rows[0]);
}));

app.get("/api/complaints", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT
      id,
      name,
      phone,
      issue_type AS "issueType",
      details,
      status,
      created_at AS "createdAt"
     FROM complaints
     ORDER BY created_at DESC`
  );
  return res.json(result.rows);
}));

app.get("/api/admin/summary", asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM orders) AS orders,
      (SELECT COUNT(*)::int FROM contacts) AS contacts,
      (SELECT COUNT(*)::int FROM complaints) AS complaints`
  );
  res.json({
    orders: result.rows[0].orders,
    contacts: result.rows[0].contacts,
    complaints: result.rows[0].complaints
  });
}));

app.use((err, _req, res, _next) => {
  console.error("Unhandled backend error:", err);
  res.status(500).json({ error: "Internal server error." });
});

const listenAsync = (application, listenPort) =>
  new Promise((resolve, reject) => {
    const server = application.listen(listenPort, () => resolve(server));
    server.once("error", reject);
  });

const startServer = async () => {
  await initializeDatabase();

  try {
    await listenAsync(app, port);
    console.log(`StockGAS backend running on http://localhost:${port}`);
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Another StockGAS backend instance is likely already running on http://localhost:${port}.`
      );
      console.error("Reuse the running server, or stop the existing process on that port before starting a new one.");
      process.exit(1);
    }

    throw err;
  }
};

startServer().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});
