import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the project root (4 levels up from this file)
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const required = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "JWT_SECRET",
  "MTN_BASE_URL",
  "MTN_SUBSCRIPTION_KEY",
  "MTN_TARGET_ENVIRONMENT",
  "MTN_CURRENCY",
];

// Crash immediately if any required variable is missing
for (const key of required) {
  if (!process.env[key] && process.env[key] !== "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  // App
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV !== "production",

  // Database
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
  },

  // Auth
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  },
  pin: {
    saltRounds: parseInt(process.env.PIN_SALT_ROUNDS, 10) || 10,
  },

  // MTN MoMo
  mtn: {
    baseUrl: process.env.MTN_BASE_URL,
    subscriptionKey: process.env.MTN_SUBSCRIPTION_KEY,
    targetEnvironment: process.env.MTN_TARGET_ENVIRONMENT,
    currency: process.env.MTN_CURRENCY,
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
};
