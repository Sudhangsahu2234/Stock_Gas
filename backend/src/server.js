import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import pool from "./config/db.js";
const app = express();

const nodeEnv = process.env.NODE_ENV?.trim() || "development";
const port = Number(process.env.PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:3000";
const razorpayKeyId = process.env.RAZORPAY_KEY_ID?.trim() || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET?.trim() || "";
const razorpayCurrency = process.env.RAZORPAY_CURRENCY?.trim() || "INR";
const razorpayCompanyName = process.env.RAZORPAY_COMPANY_NAME?.trim() || "Stockgap Fuels";
const jwtExpiry = "24h";
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    if (nodeEnv === "production") {
      throw new Error("JWT_SECRET environment variable is required in production.");
    }
    console.warn("WARNING: JWT_SECRET not set. Using insecure default for development only.");
    return "stockgas-dev-only-insecure-key-do-not-use-in-production";
  }
  return secret;
};
const jwtSecret = getJwtSecret();
const allowedOrigins = Array.from(
  new Set(
    [frontendOrigin, "http://localhost:3000", "http://127.0.0.1:3000"]
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
    if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
      databaseUrl = `postgresql://${databaseUrl}`;
    }

    const parsed = new URL(databaseUrl);

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

const describeDbTarget = (dbConfig) => {
  if (dbConfig.connectionString) {
    const parsed = new URL(dbConfig.connectionString);
    const portPart = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.username || "postgres"}@${parsed.hostname}${portPart}${parsed.pathname}`;
  }

  return `postgresql://${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
};

const dbConfig = buildDbConfig();
const dbTarget = describeDbTarget(dbConfig);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err.message);
});

const placeholderRazorpayValues = new Set([
  "",
  "rzp_test_your_key_id",
  "your_key_secret",
  "your_real_key_secret",
  "change_me",
  "change_me_in_production"
]);
const sensitiveKeys = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "otp",
  "otpcode",
  "newpassword",
  "razorpaysignature",
  "razorpay_signature"
]);
const orderFieldsSql = `
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

const stripHtml = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/<[^>]*>/g, "").trim();
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const validateEmail = (email) => {
  if (!email || typeof email !== "string") {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

const normalizePhoneDigits = (value = "") => value.replace(/\D/g, "");

const sanitiseBody = (body, currentKey = "") => {
  if (currentKey && sensitiveKeys.has(currentKey.toLowerCase())) {
    return "[REDACTED]";
  }

  if (Array.isArray(body)) {
    return body.map((item) => sanitiseBody(item));
  }

  if (body && typeof body === "object") {
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, sanitiseBody(value, key)])
    );
  }

  return body;
};

const makeId = (prefix) => `${prefix}-${Date.now()}`;

const parseAmountInr = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const validateOrderPayload = ({
  customerName,
  phone,
  cylinderSizeKg,
  quantity,
  paymentMethod,
  address,
  amountInr
}) => {
  const sanitizedCustomerName = stripHtml(customerName);
  const sanitizedPhone = stripHtml(phone);
  const sanitizedPaymentMethod = stripHtml(paymentMethod);
  const sanitizedAddress = stripHtml(address);
  const sizeKg = Number(cylinderSizeKg);
  const qty = Number(quantity);
  const parsedAmountInr = parseAmountInr(amountInr);

  if (
    !sanitizedCustomerName ||
    !sanitizedPhone ||
    !sanitizedPaymentMethod ||
    !sanitizedAddress ||
    cylinderSizeKg === undefined ||
    quantity === undefined
  ) {
    return { error: "Missing required order fields." };
  }

  if (!validatePhone(sanitizedPhone)) {
    return { error: "Phone number must contain between 7 and 15 digits." };
  }

  if (!Number.isFinite(sizeKg) || sizeKg <= 0) {
    return { error: "Cylinder size must be a valid number." };
  }

  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: "Quantity must be a whole number greater than zero." };
  }

  if (parsedAmountInr !== null && (!Number.isFinite(parsedAmountInr) || parsedAmountInr <= 0)) {
    return { error: "Amount must be a valid number greater than zero." };
  }

  return {
    payload: {
      customerName: sanitizedCustomerName,
      phone: sanitizedPhone,
      cylinderSizeKg: sizeKg,
      quantity: qty,
      paymentMethod: sanitizedPaymentMethod,
      address: sanitizedAddress,
      amountInr: parsedAmountInr
    }
  };
};

const insertOrder = async ({
  customerName,
  phone,
  cylinderSizeKg,
  quantity,
  paymentMethod,
  address,
  amountInr = null,
  currency = null,
  paymentStatus = "Pending",
  paymentGateway = null,
  gatewayOrderId = null,
  gatewayPaymentId = null
}) => {
  const result = await pool.query(
    `INSERT INTO orders
      (
        id,
        customer_name,
        phone,
        cylinder_size_kg,
        quantity,
        payment_method,
        address,
        amount_inr,
        currency,
        payment_status,
        payment_gateway,
        gateway_order_id,
        gateway_payment_id
      )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING ${orderFieldsSql}`,
    [
      makeId("SG"),
      customerName,
      phone,
      cylinderSizeKg,
      quantity,
      paymentMethod,
      address,
      amountInr,
      currency,
      paymentStatus,
      paymentGateway,
      gatewayOrderId,
      gatewayPaymentId
    ]
  );

  return result.rows[0];
};

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const generateToken = (payload) => jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiry });

const verifyToken = (token) => jwt.verify(token, jwtSecret);

const requireAdmin = (req, res, next) => {
  const authHeader = req.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Provide a Bearer token." });
  }

  try {
    const decoded = verifyToken(authHeader.slice(7));

    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      return res.status(403).json({ error: "Insufficient permissions." });
    }

    req.adminUser = decoded;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }

    return res.status(401).json({ error: "Invalid token." });
  }
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();

const storeOtp = async (userId, purpose) => {
  await pool.query(
    `UPDATE otp_tokens
     SET used = true
     WHERE user_id = $1 AND purpose = $2 AND used = false`,
    [userId, purpose]
  );

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `INSERT INTO otp_tokens (user_id, otp_code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, otpCode, purpose, expiresAt]
  );

  return otpCode;
};

const verifyOtpCode = async (userId, otpCode, purpose) => {
  const result = await pool.query(
    `UPDATE otp_tokens
     SET used = true
     WHERE user_id = $1
       AND otp_code = $2
       AND purpose = $3
       AND used = false
       AND expires_at > NOW()
     RETURNING id`,
    [userId, otpCode, purpose]
  );

  return result.rowCount > 0;
};

const isPlaceholderRazorpayValue = (value) => placeholderRazorpayValues.has(value.trim().toLowerCase());

const isRazorpayConfigured = () =>
  !isPlaceholderRazorpayValue(razorpayKeyId) && !isPlaceholderRazorpayValue(razorpayKeySecret);

const razorpayConfigError = {
  error: "Razorpay is not configured yet. Set real RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET values in backend/.env."
};

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please wait before trying again." }
});

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Order rate limit reached. Please wait before placing more orders." }
});

app.disable("x-powered-by");
app.use(helmet());
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
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();

  res.on("finish", () => {
    const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1e6;

    pool.query(
      `INSERT INTO request_logs
        (method, url, path, query_string, ip, user_agent, referer,
         status_code, response_time_ms, request_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        req.method,
        req.originalUrl,
        req.path,
        Object.keys(req.query).length ? JSON.stringify(req.query) : null,
        req.ip || req.socket?.remoteAddress || null,
        req.get("user-agent") || null,
        req.get("referer") || null,
        res.statusCode,
        Math.round(elapsedMs * 100) / 100,
        req.body && Object.keys(req.body).length ? JSON.stringify(sanitiseBody(req.body)) : null
      ]
    ).catch((err) => {
      console.error("Failed to write request log:", err.message);
    });
  });

  next();
});
app.use(globalLimiter);

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

  await pool.query(`
    ALTER TABLE orders
    ALTER COLUMN cylinder_size_kg TYPE DOUBLE PRECISION
    USING cylinder_size_kg::DOUBLE PRECISION;
  `);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_inr DOUBLE PRECISION;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending';`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_order_id TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id BIGSERIAL PRIMARY KEY,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      path TEXT NOT NULL,
      query_string TEXT,
      ip TEXT,
      user_agent TEXT,
      referer TEXT,
      status_code INTEGER,
      response_time_ms DOUBLE PRECISION,
      request_body JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_request_logs_created_at
    ON request_logs (created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      is_active BOOLEAN NOT NULL DEFAULT true,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';`);
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`);
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;`);
  await pool.query(`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS otp_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL DEFAULT 'login',
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_otp_tokens_user
    ON otp_tokens (user_id, purpose, used);
  `);

  console.log("PostgreSQL: connected and schema is ready.");
};

const cleanupRetentionData = async () => {
  const parsedRetentionDays = Number(process.env.LOG_RETENTION_DAYS || 30);
  const retentionDays = Number.isFinite(parsedRetentionDays) && parsedRetentionDays > 0 ? parsedRetentionDays : 30;

  await pool.query(
    `DELETE FROM request_logs
     WHERE created_at < NOW() - INTERVAL '1 day' * $1`,
    [retentionDays]
  );
  await pool.query(`DELETE FROM otp_tokens WHERE expires_at < NOW() OR used = true`);
};

const seedDefaultAdmin = async () => {
  const existing = await pool.query(`SELECT COUNT(*)::int AS count FROM admin_users`);

  if (existing.rows[0].count > 0) {
    return;
  }

  const username = process.env.ADMIN_USERNAME?.trim() || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const email = process.env.ADMIN_EMAIL?.trim() || "admin@stockgas.com";
  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO admin_users (id, username, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'superadmin')`,
    [makeId("ADM"), username, email, passwordHash]
  );

  console.log(`Default admin seeded for "${username}". Change ADMIN_PASSWORD before production use.`);
};

app.get("/", (_req, res) => {
  const safeFrontendOrigin = escapeHtml(frontendOrigin);

  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StockGAS Backend</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe2;
        --surface: rgba(255, 253, 248, 0.96);
        --ink: #10211d;
        --muted: #5b726c;
        --green: #2f8b4b;
        --green-deep: #1e5f36;
        --line: rgba(16, 33, 29, 0.12);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", "Trebuchet MS", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top, rgba(215, 162, 59, 0.10), transparent 30%),
          linear-gradient(180deg, #fbf7ef 0%, var(--bg) 100%);
      }

      .card {
        width: min(720px, 100%);
        padding: 32px;
        border-radius: 28px;
        background: var(--surface);
        border: 1px solid var(--line);
        box-shadow: 0 24px 60px rgba(10, 24, 21, 0.12);
      }

      .eyebrow {
        margin: 0 0 12px;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--green-deep);
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.05;
      }

      p {
        margin: 0 0 18px;
        line-height: 1.65;
        color: var(--muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 24px 0;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 14px 18px;
        border-radius: 999px;
        font-weight: 700;
        text-decoration: none;
      }

      .btn-primary {
        color: #fff;
        background: linear-gradient(135deg, var(--green), var(--green-deep));
      }

      .btn-secondary {
        color: var(--ink);
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--line);
      }

      code {
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(16, 33, 29, 0.06);
        font-family: Consolas, "Courier New", monospace;
        font-size: 0.95em;
      }

      ul {
        margin: 18px 0 0;
        padding-left: 20px;
        color: var(--muted);
      }

      li + li {
        margin-top: 10px;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <p class="eyebrow">StockGAS Backend</p>
      <h1>The API server is running.</h1>
      <p>
        This port serves the backend API. For the customer-facing web app, open the frontend on
        <code>${safeFrontendOrigin}</code>.
      </p>

      <div class="actions">
        <a class="btn btn-primary" href="${safeFrontendOrigin}">Open Frontend</a>
        <a class="btn btn-secondary" href="/api/health">Check API Health</a>
      </div>

      <ul>
        <li><strong>API status:</strong> ready on <code>/api/*</code></li>
        <li><strong>Frontend target:</strong> <code>${safeFrontendOrigin}</code></li>
        <li><strong>Quick check:</strong> open <code>/api/health</code> to confirm database connectivity</li>
      </ul>
    </main>
  </body>
</html>`);
});

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    const timestamp = new Date().toISOString();

    try {
      await pool.query("SELECT 1 AS ping");
      return res.json({ ok: true, service: "stockgas-backend", timestamp, database: { connected: true } });
    } catch (err) {
      return res.status(503).json({
        ok: false,
        service: "stockgas-backend",
        timestamp,
        database: { connected: false, error: err.message }
      });
    }
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }

    const result = await pool.query(
      `SELECT id, username, email, password_hash, role, is_active
       FROM admin_users
       WHERE username = $1`,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "Account is deactivated." });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const otpCode = await storeOtp(user.id, "login");

    return res.json({
      message: "Login successful. OTP sent for verification.",
      userId: user.id,
      requiresOtp: true
    });
  })
);

app.post(
  "/api/auth/verify-otp",
  authLimiter,
  asyncHandler(async (req, res) => {
    const userId = typeof req.body.userId === "string" ? req.body.userId.trim() : "";
    const otp = typeof req.body.otp === "string" ? req.body.otp.trim() : "";

    if (!userId || !otp) {
      return res.status(400).json({ error: "User ID and OTP are required." });
    }

    const valid = await verifyOtpCode(userId, otp, "login");

    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    const userResult = await pool.query(
      `SELECT id, username, email, role
       FROM admin_users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = userResult.rows[0];

    await pool.query(`UPDATE admin_users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [user.id]);

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    return res.json({
      message: "OTP verified. Authentication complete.",
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  })
);

app.post(
  "/api/orders",
  orderLimiter,
  asyncHandler(async (req, res) => {
    const validation = validateOrderPayload(req.body);

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const order = await insertOrder(validation.payload);
    return res.status(201).json(order);
  })
);

app.post(
  "/api/payments/razorpay/order",
  orderLimiter,
  asyncHandler(async (req, res) => {
    const validation = validateOrderPayload({
      ...req.body,
      paymentMethod: "Razorpay"
    });

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const { customerName, phone, cylinderSizeKg, quantity, address, amountInr } = validation.payload;

    if (amountInr === null) {
      return res.status(400).json({ error: "Amount is required for Razorpay payments." });
    }

    if (!isRazorpayConfigured()) {
      return res.status(500).json(razorpayConfigError);
    }

    let razorpayResponse;

    try {
      razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(amountInr * 100),
          currency: razorpayCurrency,
          receipt: makeId("RZP"),
          callback_url: `${frontendOrigin}/success`,
          cancel_url: `${frontendOrigin}/error`,
          notes: {
            companyName: razorpayCompanyName,
            customerName,
            phone,
            cylinderSizeKg: String(cylinderSizeKg),
            quantity: String(quantity),
            address
          }
        })
      });
    } catch (_error) {
      return res.status(502).json({ error: "Unable to reach Razorpay right now. Please try again later." });
    }

    const razorpayData = await razorpayResponse.json().catch(() => ({}));

    if (!razorpayResponse.ok) {
      return res.status(502).json({
        error:
          razorpayData?.error?.description ||
          razorpayData?.error?.reason ||
          "Unable to create a Razorpay payment order right now."
      });
    }

    const checkoutUrl = `https://checkout.razorpay.com/v1/checkout/embedded?key_id=${razorpayKeyId}&order_id=${razorpayData.id}&callback_url=${encodeURIComponent(`${frontendOrigin}/success`)}&cancel_url=${encodeURIComponent(`${frontendOrigin}/error`)}`;

    return res.json({ checkoutUrl });
  })
);

app.post(
  "/api/payments/razorpay/verify",
  orderLimiter,
  asyncHandler(async (req, res) => {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, booking } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !booking) {
      return res.status(400).json({ error: "Missing Razorpay verification details." });
    }

    const validation = validateOrderPayload({
      ...booking,
      paymentMethod: "Razorpay"
    });

    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    if (!isRazorpayConfigured()) {
      return res.status(500).json(razorpayConfigError);
    }

    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ error: "Razorpay payment signature verification failed." });
    }

    const existingOrder = await pool.query(
      `SELECT ${orderFieldsSql}
       FROM orders
       WHERE gateway_payment_id = $1`,
      [razorpayPaymentId]
    );

    if (existingOrder.rowCount > 0) {
      return res.json(existingOrder.rows[0]);
    }

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
  })
);

app.get(
  "/api/orders",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT
        ${orderFieldsSql}
       FROM orders
       ORDER BY created_at DESC`
    );

    return res.json(result.rows);
  })
);

app.get(
  "/api/orders/lookup",
  asyncHandler(async (req, res) => {
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

    return res.json({ orders: result.rows });
  })
);

app.get(
  "/api/orders/:id",
  asyncHandler(async (req, res) => {
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
  })
);

app.post(
  "/api/contact",
  asyncHandler(async (req, res) => {
    const name = stripHtml(req.body.name);
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const message = stripHtml(req.body.message);
    const type = stripHtml(req.body.type);

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
      [makeId("CT"), name, email, message, type]
    );

    return res.status(201).json(result.rows[0]);
  })
);

app.get(
  "/api/contacts",
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT id, name, email, message, type, created_at AS "createdAt"
       FROM contacts
       ORDER BY created_at DESC`
    );

    return res.json(result.rows);
  })
);

app.post(
  "/api/complaints",
  asyncHandler(async (req, res) => {
    const name = stripHtml(req.body.name);
    const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    const issueType = stripHtml(req.body.issueType);
    const details = stripHtml(req.body.details);

    if (!name || !phone || !issueType || !details) {
      return res.status(400).json({ error: "Missing required complaint fields." });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: "Invalid phone number." });
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
  })
);

app.get(
  "/api/complaints",
  asyncHandler(async (_req, res) => {
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
  })
);

app.get(
  "/api/admin/summary",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM orders) AS orders,
        (SELECT COUNT(*)::int FROM contacts) AS contacts,
        (SELECT COUNT(*)::int FROM complaints) AS complaints,
        (SELECT COUNT(*)::int FROM request_logs) AS "requestLogs"`
    );

    return res.json({
      orders: result.rows[0].orders,
      contacts: result.rows[0].contacts,
      complaints: result.rows[0].complaints,
      requestLogs: result.rows[0].requestLogs
    });
  })
);

app.get(
  "/api/admin/logs",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const conditions = [];
    const params = [];

    if (req.query.method) {
      params.push(String(req.query.method).toUpperCase());
      conditions.push(`method = $${params.length}`);
    }

    if (req.query.status) {
      params.push(Number(req.query.status));
      conditions.push(`status_code = $${params.length}`);
    }

    if (req.query.path) {
      params.push(`%${req.query.path}%`);
      conditions.push(`path ILIKE $${params.length}`);
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
      `SELECT COUNT(*)::int AS total FROM request_logs ${whereClause}`,
      params
    );

    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT
         id,
         method,
         url,
         path,
         query_string AS "queryString",
         ip,
         user_agent AS "userAgent",
         referer,
         status_code AS "statusCode",
         response_time_ms AS "responseTimeMs",
         request_body AS "requestBody",
         created_at AS "createdAt"
       FROM request_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      total: countResult.rows[0].total,
      limit,
      offset,
      logs: result.rows
    });
  })
);

app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith("CORS blocked")) {
    return res.status(403).json({ error: err.message });
  }

  console.error("Unhandled backend error:", err);
  return res.status(500).json({ error: "Internal server error." });
});

const listenAsync = (application, listenPort) =>
  new Promise((resolve, reject) => {
    const server = application.listen(listenPort, () => resolve(server));
    server.once("error", reject);
  });

const startServer = async () => {
  try {
    await initializeDatabase();
    await cleanupRetentionData();
    await seedDefaultAdmin();
  } catch (err) {
    console.error(`Database initialization failed for ${dbTarget}.`);
    console.error("Check DATABASE_URL (or PG* env vars) and ensure PostgreSQL is running before restarting.");
    throw err;
  }

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
