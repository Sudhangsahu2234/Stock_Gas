import jwt from "jsonwebtoken";

const nodeEnv = process.env.NODE_ENV?.trim() || "development";

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
const JWT_SECRET = getJwtSecret();
const JWT_EXPIRY = "24h";

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Middleware: validates JWT Bearer token on protected routes
const requireAdmin = (req, res, next) => {
  const authHeader = req.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Provide a Bearer token." });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);

    if (decoded.role !== "admin" && decoded.role !== "superadmin") {
      return res.status(403).json({ error: "Insufficient permissions." });
    }

    req.adminUser = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid token." });
  }
};

export { generateToken, verifyToken, requireAdmin, getJwtSecret };
