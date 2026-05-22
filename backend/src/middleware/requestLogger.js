import { sanitiseBody } from "../utils/validation.js";

const createRequestLogger = (pool) => {
  return (req, res, next) => {
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
          req.body && Object.keys(req.body).length
            ? JSON.stringify(sanitiseBody(req.body))
            : null
        ]
      ).catch((err) => {
        console.error("Failed to write request log:", err.message);
      });
    });

    next();
  };
};

export { createRequestLogger };
