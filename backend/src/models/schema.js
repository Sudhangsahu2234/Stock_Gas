const initializeDatabase = async (pool) => {
  // ── Orders table ──
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
      amount_inr DOUBLE PRECISION,
      currency TEXT,
      payment_status TEXT NOT NULL DEFAULT 'Pending',
      payment_gateway TEXT,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      cancelled_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migration: add columns that may not exist on older installs
  const orderMigrations = [
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_inr DOUBLE PRECISION`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending'`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_order_id TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_reason TEXT`,
    `ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE orders ALTER COLUMN cylinder_size_kg TYPE DOUBLE PRECISION USING cylinder_size_kg::DOUBLE PRECISION`
  ];
  for (const sql of orderMigrations) {
    await pool.query(sql).catch(() => {});
  }

  // ── Contacts table ──
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

  // ── Complaints table ──
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

  // ── Request audit logs ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id            BIGSERIAL PRIMARY KEY,
      method        TEXT NOT NULL,
      url           TEXT NOT NULL,
      path          TEXT NOT NULL,
      query_string  TEXT,
      ip            TEXT,
      user_agent    TEXT,
      referer       TEXT,
      status_code   INTEGER,
      response_time_ms DOUBLE PRECISION,
      request_body  JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs (created_at DESC)`);

  // ── Admin users table ──
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

  // ── OTP tokens table ──
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
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_otp_tokens_user ON otp_tokens (user_id, purpose, used)`);

  // ── Password reset tokens table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Products (catalog) table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size_kg DOUBLE PRECISION NOT NULL,
      price_inr DOUBLE PRECISION NOT NULL,
      description TEXT,
      in_stock BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Notifications table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_read BOOLEAN NOT NULL DEFAULT false,
      link TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read)`);

  // ── System alerts table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      is_active BOOLEAN NOT NULL DEFAULT true,
      priority INTEGER NOT NULL DEFAULT 0,
      target_role TEXT DEFAULT 'all',
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Error logs table ──
  await pool.query(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id BIGSERIAL PRIMARY KEY,
      error_type TEXT NOT NULL,
      message TEXT NOT NULL,
      stack TEXT,
      route TEXT,
      method TEXT,
      ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs (created_at DESC)`);

  console.log("PostgreSQL: all tables and indexes are ready.");
};

// Log cleanup: delete request_logs older than retention days
const cleanupOldLogs = async (pool) => {
  const retentionDays = Number(process.env.LOG_RETENTION_DAYS || 30);
  const result = await pool.query(
    `DELETE FROM request_logs WHERE created_at < NOW() - INTERVAL '1 day' * $1 RETURNING id`,
    [retentionDays]
  );
  if (result.rowCount > 0) {
    console.log(`Log cleanup: removed ${result.rowCount} request_logs older than ${retentionDays} days.`);
  }

  // Also clean expired OTP tokens and password reset tokens
  await pool.query(`DELETE FROM otp_tokens WHERE expires_at < NOW() AND used = true`);
  await pool.query(`DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND used = true`);
};

// Seed default admin user from env if no admins exist
const seedDefaultAdmin = async (pool, bcrypt) => {
  const existing = await pool.query(`SELECT COUNT(*)::int AS count FROM admin_users`);
  if (existing.rows[0].count > 0) return;

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const email = process.env.ADMIN_EMAIL || "admin@stockgas.com";
  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO admin_users (id, username, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'superadmin')`,
    [`ADM-${Date.now()}`, username, email, hash]
  );
  console.log(`Default admin seeded: username="${username}" (change ADMIN_PASSWORD in .env for production)`);
};

export { initializeDatabase, cleanupOldLogs, seedDefaultAdmin };
