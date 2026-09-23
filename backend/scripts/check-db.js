require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set. Copy .env.example to .env first.");
  process.exit(1);
}
if (uri.includes("REPLACE_USERNAME") || uri.includes("<")) {
  console.error("MONGODB_URI still has a placeholder in it:");
  console.error("  " + uri.replace(/:[^:@]+@/, ":****@"));
  console.error("\nFill in your Atlas database username (Atlas > Database Access).");
  process.exit(1);
}

mongoose
  .connect(uri, { serverSelectionTimeoutMS: 8000 })
  .then(async () => {
    const db = mongoose.connection;
    console.log(`Connected to database: ${db.name}`);
    const collections = await db.db.listCollections().toArray();
    console.log(
      collections.length
        ? `Collections: ${collections.map((c) => c.name).join(", ")}`
        : "No collections yet - expected before the models are written."
    );
    await mongoose.disconnect();
  })
  .catch((err) => {
    console.error("Could not connect:", err.message);
    if (/authentication failed/i.test(err.message)) {
      console.error("\nWrong username or password. Check Atlas > Database Access.");
    } else if (/ETIMEDOUT|ServerSelection/i.test(err.message)) {
      console.error("\nUsually the IP allowlist. Atlas > Network Access > Add IP Address.");
    }
    process.exit(1);
  });
