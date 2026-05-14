import mysql from "mysql2/promise";
import { env } from "./env.js";

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Test the connection on startup
export const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`Database connected: ${env.db.name}`);
    connection.release();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

export default pool;
