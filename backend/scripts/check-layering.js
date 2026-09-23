const fs = require("fs");
const path = require("path");

const SERVICES_DIR = path.join(__dirname, "..", "src", "services");
const FORBIDDEN = /\b(req|res)\s*\./;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith(".ts") ? [full] : [];
  });
}

const violations = [];
for (const file of walk(SERVICES_DIR)) {
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (FORBIDDEN.test(code)) {
      violations.push(`${path.relative(process.cwd(), file)}:${i + 1}  ${line.trim()}`);
    }
  });
}

if (violations.length > 0) {
  console.error("LAYERING VIOLATION - services must never reference req or res:\n");
  violations.forEach((v) => console.error("  " + v));
  console.error("\nMove the HTTP concern into a controller (brief 9.1).");
  process.exit(1);
}

console.log("Layering contract holds: no req/res in src/services/");
