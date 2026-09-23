const crypto = require("node:crypto");
const path = require("path");
const { MongoMemoryServer } = require("mongodb-memory-server");

const BACKEND = path.resolve(__dirname, "..");

async function main() {
  console.log("Starting an in-memory MongoDB (first run downloads a binary)...");
  const mongo = await MongoMemoryServer.create({ instance: { dbName: "library" } });

  const uri = mongo.getUri("library");
  process.env.MONGODB_URI = uri;

  console.log("\n  In-memory MongoDB is at:\n    " + uri);
  console.log("  Look inside it with:\n    npm run db:peek \"" + uri + "\"\n");

  process.env.JWT_ACCESS_SECRET ||= crypto.randomBytes(48).toString("hex");
  process.env.JWT_REFRESH_SECRET ||= crypto.randomBytes(48).toString("hex");

  require("ts-node").register({
    transpileOnly: true,
    project: path.join(BACKEND, "tsconfig.json"),
  });

  const { seed } = require(path.join(BACKEND, "seed.ts"));
  await seed();

  require(path.join(BACKEND, "src", "server.ts"));

  const shutdown = async () => {
    await mongo.stop().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("dev:local failed to start:", error);
  process.exit(1);
});
