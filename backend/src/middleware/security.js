import cors from "cors";
import helmet from "helmet";

const createSecurityMiddleware = (allowedOrigins) => {
  const helmetMiddleware = helmet({
    contentSecurityPolicy: false, // Disable CSP for API server
    crossOriginEmbedderPolicy: false
  });

  const corsMiddleware = cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  });

  return { helmetMiddleware, corsMiddleware };
};

export { createSecurityMiddleware };
