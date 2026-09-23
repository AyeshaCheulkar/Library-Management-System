require("dotenv").config();
const mongoose = require("mongoose");

const uri = process.argv[2] || process.env.MONGODB_URI;

if (!uri) {
  console.error("No URI. Either set MONGODB_URI in .env or pass one as an argument.");
  process.exit(1);
}

const safe = (value) => value.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");

function preview(value, depth = 0) {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[ ${value.length} item(s) ]`;
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (value._bsontype === "ObjectId") return `ObjectId(${value.toString()})`;
    if (depth > 0) return "{ ... }";
    return "{ " + Object.keys(value).slice(0, 4).join(", ") + " }";
  }
  const text = String(value);
  return text.length > 58 ? text.slice(0, 55) + "..." : text;
}

async function main() {
  console.log("Connecting to", safe(uri), "\n");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

  const db = mongoose.connection.db;
  console.log("Database:", db.databaseName);

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .sort();

  if (collections.length === 0) {
    console.log("\nNo collections. Nothing has been written yet - try `npm run seed`.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Collections: ${collections.length}\n`);

  for (const name of collections) {
    const collection = db.collection(name);
    const count = await collection.countDocuments();

    console.log("=".repeat(74));
    console.log(`${name}  -  ${count} document(s)`);
    console.log("=".repeat(74));

    const indexes = await collection.indexes();
    console.log("  indexes:");
    for (const index of indexes) {
      const keys = Object.entries(index.key)
        .map(([field, direction]) => `${field}:${direction}`)
        .join(", ");
      const flags = [
        index.unique ? "unique" : null,
        index.partialFilterExpression ? "partial" : null,
      ]
        .filter(Boolean)
        .join(" ");
      console.log(`    ${index.name.padEnd(38)} { ${keys} }${flags ? "  " + flags : ""}`);
    }

    const sample = await collection.findOne();
    if (sample) {
      console.log("  one document:");
      for (const [field, value] of Object.entries(sample)) {
        console.log(`    ${field.padEnd(20)} ${preview(value, 0)}`);
      }
    }
    console.log();
  }

  console.log("Reminder: these are COLLECTIONS of documents, not tables of rows.");
  console.log("A book carries its reservation queue inside it; a loan points at its book.");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("\nCould not read the database:", error.message);
  if (/ECONNREFUSED|ETIMEDOUT|ServerSelection/i.test(error.message)) {
    console.error(
      "\nIf this is Atlas, the usual cause is the IP access list.\n" +
        "  Atlas > Network Access > Add IP Address > Allow access from anywhere.\n" +
        "If you meant the in-memory database, pass its URI as an argument - see the\n" +
        "line dev:local prints at startup."
    );
  }
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
