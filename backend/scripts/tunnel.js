const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const BACKEND = path.resolve(__dirname, "..");
const BUILD = path.resolve(BACKEND, "../frontend/build/index.html");
const PORT = process.env.PORT || "4000";

function fail(message, fix) {
  console.error("\n  " + message + "\n");
  if (fix) console.error("  " + fix.split("\n").join("\n  ") + "\n");
  process.exit(1);
}

if (!fs.existsSync(BUILD)) {
  fail(
    "The frontend has not been built, so there is nothing to serve.",
    "Build it once, then run this again:\n  cd ../frontend && npm run build\n" +
      "\nOr just use start.bat in the project root, which does it for you."
  );
}

const lookup = process.platform === "win32" ? "where" : "which";
if (spawnSync(lookup, ["cloudflared"], { stdio: "ignore", shell: true }).status !== 0) {
  fail(
    "cloudflared is not on PATH.",
    "Windows:  winget install --id Cloudflare.cloudflared\n" +
      "macOS:    brew install cloudflared\n" +
      "Or download it from https://developers.cloudflare.com/cloudflare-tunnel/"
  );
}

console.log("");
console.log("  Anyone with the URL below can sign in as the seeded admin.");
console.log("  The demo password is in README.md, so treat the link as public access.");
console.log("  The tunnel dies with this process - Ctrl-C ends it.");
console.log("");

const children = [];
let stopping = false;

function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
    }
  }
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

const api = spawn("npm", ["run", "dev:local"], {
  cwd: BACKEND,
  env: { ...process.env, TRUST_PROXY: "1" },
  stdio: "inherit",
  shell: true,
});
children.push(api);

api.on("exit", (code) => {
  if (code !== 0 && !stopping) {
    console.error("\n  The API exited. Stopping the tunnel.\n");
    stop();
  }
});

function announce(url) {
  const rule = "=".repeat(Math.max(46, url.length + 10));
  console.log("");
  console.log("");
  console.log(rule);
  console.log("   YOUR LIBRARY IS LIVE AT");
  console.log("");
  console.log("   " + url);
  console.log("");
  console.log(rule);
  console.log("");
  console.log("   Open that link, or send it to anyone.");
  console.log("   Sign in with the accounts listed in README.md.");
  console.log("   Ctrl-C here closes the tunnel and the server.");
  console.log("");

  setTimeout(() => {
    console.log("");
    console.log("   Reminder - the public URL is:  " + url);
    console.log("");
  }, 20000);
}

setTimeout(() => {
  console.log("");
  console.log("  Opening a Cloudflare tunnel to http://localhost:" + PORT + " ...");
  console.log("");

  const tunnel = spawn("cloudflared", ["tunnel", "--url", "http://localhost:" + PORT], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });
  children.push(tunnel);

  let announced = false;

  const watch = (chunk) => {
    const text = chunk.toString();

    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !announced) {
      announced = true;
      announce(match[0]);
    }

    if (/ERR |error|failed/i.test(text) && !/Thank you for trying/i.test(text)) {
      process.stderr.write(text);
    }
  };

  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);

  tunnel.on("exit", () => {
    if (!stopping) console.error("\n  The tunnel closed.\n");
    stop();
  });

  setTimeout(() => {
    if (!announced) {
      console.error("");
      console.error("  No tunnel URL yet. cloudflared may be blocked by a firewall,");
      console.error("  or the network may not allow outbound connections to Cloudflare.");
      console.error("  The app is still running locally at http://localhost:" + PORT);
      console.error("");
    }
  }, 30000);
}, 6000);
