import bcrypt from "bcrypt";

const COST = 12;
const PASSWORD = "correct-horse-battery-staple";

function watchEventLoop(): { stop: () => number[] } {
  const lags: number[] = [];
  let last = process.hrtime.bigint();

  const timer = setInterval(() => {
    const now = process.hrtime.bigint();
    const elapsedMs = Number(now - last) / 1_000_000;
    lags.push(Math.max(0, elapsedMs - 10));
    last = now;
  }, 10);

  return {
    stop() {
      clearInterval(timer);
      return lags;
    },
  };
}

function summarise(lags: number[]): { p50: string; p95: string; max: string } {
  if (lags.length === 0) return { p50: "-", p95: "-", max: "-" };
  const sorted = [...lags].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return {
    p50: at(0.5).toFixed(1),
    p95: at(0.95).toFixed(1),
    max: (sorted[sorted.length - 1] ?? 0).toFixed(1),
  };
}

async function measure(
  label: string,
  hashes: number,
  run: () => Promise<void>
): Promise<{ label: string; hashes: number; wallMs: number } & ReturnType<typeof summarise>> {
  const watcher = watchEventLoop();
  const started = process.hrtime.bigint();
  await run();
  const wallMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  await new Promise((resolve) => setTimeout(resolve, 50));
  return { label, hashes, wallMs, ...summarise(watcher.stop()) };
}

async function main(): Promise<void> {
  const threadpool = process.env.UV_THREADPOOL_SIZE ?? "4 (default)";
  const rows: Awaited<ReturnType<typeof measure>>[] = [];

  await bcrypt.hash(PASSWORD, COST);

  rows.push(
    await measure("async, 4 concurrent", 4, async () => {
      await Promise.all(Array.from({ length: 4 }, () => bcrypt.hash(PASSWORD, COST)));
    })
  );

  rows.push(
    await measure("async, 8 concurrent", 8, async () => {
      await Promise.all(Array.from({ length: 8 }, () => bcrypt.hash(PASSWORD, COST)));
    })
  );

  rows.push(
    await measure("SYNC, 4 sequential", 4, async () => {
      for (let i = 0; i < 4; i += 1) bcrypt.hashSync(PASSWORD, COST);
    })
  );

  console.log(`
bcrypt event-loop benchmark - cost factor ${COST}
UV_THREADPOOL_SIZE: ${threadpool}
Reproduce with: cd backend && npm run bench:bcrypt

  variant                    hashes   wall ms   loop lag p50   p95      max
  --------------------------------------------------------------------------`);
  for (const row of rows) {
    console.log(
      `  ${row.label.padEnd(24)} ${String(row.hashes).padStart(6)}   ${row.wallMs
        .toFixed(0)
        .padStart(7)}   ${row.p50.padStart(12)}   ${row.p95.padStart(6)}   ${row.max.padStart(6)}`
    );
  }

  console.log(`
Reading this:

  Event-loop lag is how long a request that has NOTHING to do with logging in would have
  waited. The async rows keep it near zero because the hashing happens on a threadpool
  thread; the sync row shows the loop frozen for the whole hash, so /health, a catalogue
  read and every other in-flight request stop dead.

  The 8-concurrent row is the threadpool ceiling: wall time roughly doubles against the
  4-concurrent row while lag stays flat. That is queuing, not blocking - the fifth login
  waits for a free thread. Raising UV_THREADPOOL_SIZE trades memory for concurrent logins.
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
