import dotenv from "dotenv";
dotenv.config();

const LOCAL_DEV_ACCESS_SECRET = "smart_supermarket_local_access_secret_2026";
const LOCAL_DEV_REFRESH_SECRET = "smart_supermarket_local_refresh_secret_2026";
const envString = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

export const env = {
  nodeEnv: envString(process.env.NODE_ENV, "development"),
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: envString(process.env.DATABASE_URL, ""),
  jwtSecret: envString(process.env.JWT_SECRET, LOCAL_DEV_ACCESS_SECRET),
  jwtExpiresIn: envString(process.env.JWT_EXPIRES_IN, "1d"),
  refreshJwtSecret: envString(process.env.REFRESH_JWT_SECRET, envString(process.env.JWT_SECRET, LOCAL_DEV_REFRESH_SECRET)),
  refreshJwtExpiresIn: envString(process.env.REFRESH_JWT_EXPIRES_IN, "30d"),
  corsOrigin: envString(process.env.CORS_ORIGIN, "http://localhost:5173"),
};
