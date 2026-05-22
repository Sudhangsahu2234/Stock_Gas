import pg from "pg";

const { Pool } = pg;

const buildDbConfig = () => {
  const fallbackPassword = process.env.DB_PASSWORD || process.env.PGPASSWORD || "postgres";
  const defaultUser = process.env.PGUSER || "postgres";
  let databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
      databaseUrl = `postgresql://${databaseUrl}`;
    }
    const parsed = new URL(databaseUrl);
    if (parsed.username === "localhost" || !parsed.username) {
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

export { pool, buildDbConfig };
export default pool;
