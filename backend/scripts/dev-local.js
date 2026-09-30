const crypto = require("node:crypto");
const path = require("path");

const BACKEND = path.resolve(__dirname, "..");

// With a backend/.env that sets MONGODB_URI, use that real database so the data
// persists (and shows up in MongoDB Compass). Without one, fall back to a
// throwaway in-memory database.
require("dotenv").config({ path: path.join(BACKEND, ".env") });

async function startInMemory() {
  const { MongoMemoryServer } = require("mongodb-memory-server");
  console.log("No MONGODB_URI in backend/.env - starting an in-memory MongoDB (first run downloads a binary)...");
  const mongo = await MongoMemoryServer.create({ instance: { dbName: "library" } });

  const uri = mongo.getUri("library");
  process.env.MONGODB_URI = uri;

  console.log("\n  In-memory MongoDB is at:\n    " + uri);
  console.log("  Look inside it with:\n    npm run db:peek \"" + uri + "\"");
  console.log("  Its data is lost when the server stops.\n");

  return () => mongo.stop();
}

async function isEmpty(uri) {
  const mongoose = require("mongoose");
  const conn = await mongoose.createConnection(uri).asPromise();
  try {
    return (await conn.db.collection("users").countDocuments()) === 0;
  } finally {
    await conn.close();
  }
}

async function main() {
  const persistent = Boolean(process.env.MONGODB_URI);
  const stop = persistent ? async () => undefined : await startInMemory();

  process.env.JWT_ACCESS_SECRET ||= crypto.randomBytes(48).toString("hex");
  process.env.JWT_REFRESH_SECRET ||= crypto.randomBytes(48).toString("hex");

  require("ts-node").register({
    transpileOnly: true,
    project: path.join(BACKEND, "tsconfig.json"),
  });

  if (!persistent || (await isEmpty(process.env.MONGODB_URI))) {
    const { seed } = require(path.join(BACKEND, "seed.ts"));
    await seed();
  }
  if (persistent) {
    console.log("\n  Using the database in backend/.env:\n    " + process.env.MONGODB_URI);
    console.log("  Data is kept between restarts. Run `npm run seed` to reset it to the demo data.\n");
  }

  require(path.join(BACKEND, "src", "server.ts"));

  const shutdown = async () => {
    await stop().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("dev:local failed to start:", error);
  process.exit(1);
});
