import "dotenv/config";

function readString(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Environment variable missing: ${key}`);
  }

  return value;
}

export const env = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: readString("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/newmj?schema=public"),
  clientOrigin: readString("CLIENT_ORIGIN", "http://localhost:5173"),
  sessionCookieName: readString("SESSION_COOKIE_NAME", "newmj_session")
};

