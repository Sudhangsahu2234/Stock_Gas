import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../config/db.js";
import { makeId, asyncHandler } from "../utils/helpers.js";
import { validateEmail, stripHtml } from "../utils/validation.js";
import { generateToken, requireAdmin } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import { storeOtp, verifyOtp } from "../utils/otp.js";

const router = Router();

// POST /login — Admin login (returns JWT + sends OTP for 2FA)
router.post("/login", authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const result = await pool.query(
    `SELECT id, username, email, password_hash, role, is_active FROM admin_users WHERE username = $1`,
    [username.trim()]
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

  // Generate OTP for 2FA verification
  const otpCode = await storeOtp(pool, user.id, "login");

  // In production, send OTP via email/SMS. For development, return it.
  return res.json({
    message: "Login successful. OTP sent for verification.",
    userId: user.id,
    requiresOtp: true,
    // DEV ONLY: Remove in production
    _devOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined
  });
}));

// POST /verify-otp — Verify OTP and return full auth token
router.post("/verify-otp", authLimiter, asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) {
    return res.status(400).json({ error: "User ID and OTP are required." });
  }

  const valid = await verifyOtp(pool, userId, otp, "login");
  if (!valid) {
    return res.status(401).json({ error: "Invalid or expired OTP." });
  }

  // Fetch user details for token
  const userResult = await pool.query(
    `SELECT id, username, email, role FROM admin_users WHERE id = $1`,
    [userId]
  );
  if (userResult.rowCount === 0) {
    return res.status(404).json({ error: "User not found." });
  }

  const user = userResult.rows[0];

  // Update last login
  await pool.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

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
}));

// POST /forgot-password — Request password reset
router.post("/forgot-password", authLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ error: "A valid email address is required." });
  }

  const userResult = await pool.query(
    `SELECT id, email FROM admin_users WHERE email = $1 AND is_active = true`,
    [email.trim()]
  );

  // Always return success to prevent email enumeration
  if (userResult.rowCount === 0) {
    return res.json({ message: "If an account exists with that email, a reset link has been sent." });
  }

  const user = userResult.rows[0];

  // Invalidate previous reset tokens
  await pool.query(
    `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
    [user.id]
  );

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user.id, resetToken, expiresAt]
  );

  // In production, send reset link via email. For dev, return it.
  return res.json({
    message: "If an account exists with that email, a reset link has been sent.",
    // DEV ONLY: Remove in production
    _devResetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined
  });
}));

// POST /reset-password — Reset password using token
router.post("/reset-password", authLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: "Reset token and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters long." });
  }

  const tokenResult = await pool.query(
    `SELECT user_id FROM password_reset_tokens
     WHERE token = $1 AND used = false AND expires_at > NOW()`,
    [token]
  );

  if (tokenResult.rowCount === 0) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }

  const userId = tokenResult.rows[0].user_id;
  const passwordHash = await bcrypt.hash(newPassword, 12);

  await pool.query(`UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [passwordHash, userId]);
  await pool.query(`UPDATE password_reset_tokens SET used = true WHERE token = $1`, [token]);

  return res.json({ message: "Password has been reset successfully. You can now log in." });
}));

// POST /register — Register new admin (requires existing superadmin)
router.post("/register", requireAdmin, asyncHandler(async (req, res) => {
  if (req.adminUser.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmins can register new admin users." });
  }

  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "Username, email, and password are required." });
  }
  if (!validateEmail(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const allowedRoles = ["admin", "superadmin"];
  const userRole = allowedRoles.includes(role) ? role : "admin";

  const existingUser = await pool.query(
    `SELECT id FROM admin_users WHERE username = $1 OR email = $2`,
    [username.trim(), email.trim()]
  );
  if (existingUser.rowCount > 0) {
    return res.status(409).json({ error: "Username or email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `INSERT INTO admin_users (id, username, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, username, email, role, created_at AS "createdAt"`,
    [makeId("ADM"), username.trim(), email.trim(), passwordHash, userRole]
  );

  return res.status(201).json(result.rows[0]);
}));

// GET /me — Get current admin user profile
router.get("/me", requireAdmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT id, username, email, role, last_login_at AS "lastLoginAt", created_at AS "createdAt"
     FROM admin_users WHERE id = $1`,
    [req.adminUser.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "User not found." });
  return res.json(result.rows[0]);
}));

export default router;
