import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";
import app from "./app.js";

const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

start();
