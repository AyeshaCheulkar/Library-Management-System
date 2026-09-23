import app from "./app";
import { env } from "./config/env";
import { connectToDatabase } from "./db";

async function start(): Promise<void> {
  await connectToDatabase();
  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

void start();
