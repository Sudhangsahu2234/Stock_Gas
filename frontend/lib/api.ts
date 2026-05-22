export function getApiBase(): string {
  if (!process.env.NEXT_PUBLIC_API_URL) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("NEXT_PUBLIC_API_URL environment variable is required in production.");
    }
    console.warn("WARNING: NEXT_PUBLIC_API_URL not set. Using localhost for development only.");
    return "http://localhost:4000";
  }
  return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}
