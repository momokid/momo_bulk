import { env } from "./config/env.js";
import { connectDB } from "./config/database.js";
import { resetStuckTransfers } from "./modules/transfers/transfers.service.js";
import app from "./app.js";

const start = async () => {
  await connectDB();
  await resetStuckTransfers();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

start();
