import mongoose from "mongoose";
import { env } from "./config/env";

export async function connectToDatabase(uri = env.mongoUri): Promise<void> {
  await mongoose.connect(uri);
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
