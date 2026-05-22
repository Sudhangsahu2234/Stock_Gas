import crypto from "crypto";

// Generate a 6-digit OTP
const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Store OTP in database with 10-minute expiry
// purpose can be: 'login', 'verify', 'reset'
const storeOtp = async (pool, userId, purpose) => {
  // Invalidate any existing unused OTPs for this user+purpose
  await pool.query(
    `UPDATE otp_tokens SET used = true WHERE user_id = $1 AND purpose = $2 AND used = false`,
    [userId, purpose]
  );

  const otpCode = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await pool.query(
    `INSERT INTO otp_tokens (user_id, otp_code, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, otpCode, purpose, expiresAt]
  );

  return otpCode;
};

// Verify OTP - returns true if valid, false otherwise
// Only marks OTP as used AFTER successful validation
const verifyOtp = async (pool, userId, otpCode, purpose) => {
  // First check if OTP exists and is valid (without marking as used)
  const checkResult = await pool.query(
    `SELECT id FROM otp_tokens
     WHERE user_id = $1
       AND otp_code = $2
       AND purpose = $3
       AND used = false
       AND expires_at > NOW()`,
    [userId, otpCode, purpose]
  );

  if (checkResult.rowCount === 0) {
    return false;
  }

  // OTP is valid - mark as used
  await pool.query(
    `UPDATE otp_tokens
     SET used = true
     WHERE id = $1`,
    [checkResult.rows[0].id]
  );

  return true;
};

export { generateOtp, storeOtp, verifyOtp };
