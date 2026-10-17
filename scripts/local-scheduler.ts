
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const secret = process.env.LOCAL_SCHEDULER_SECRET;
const endpoint = "http://localhost:3000/api/cron/publish";

if (!secret) {
  throw new Error("LOCAL_SCHEDULER_SECRET is missing from .env.local");
}

let isRunning = false;

async function checkScheduledReels() {
  if (isRunning) {
    console.log("Previous scheduler check is still running.");
    return;
  }

  isRunning = true;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(120_000),
    });

    const result = await response.text();

    console.log(
      `[${new Date().toLocaleString()}] Scheduler response:`,
      response.status,
      result
    );
  } catch (error) {
    console.error("Scheduler check failed:", error);
  } finally {
    isRunning = false;
  }
}

console.log("MegaWatch local scheduler started.");
console.log("Checking for due Reels every 60 seconds.");

// Check immediately, then every 60 seconds.
void checkScheduledReels();
setInterval(() => {
  void checkScheduledReels();
}, 60_000);

