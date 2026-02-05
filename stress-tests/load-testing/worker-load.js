/**
 * Worker Load Testing
 *
 * Core stress test for analytics worker to find breaking points
 * Tests: Gradual ramp, spike traffic, sustained load, burst
 */

import fetch from "node-fetch";
import cliProgress from "cli-progress";
import chalk from "chalk";
import { MetricsCollector } from "../utils/metrics-collector.js";
import { generateEvent } from "../utils/test-data-factory.js";
import config from "../config/endpoints.js";
import thresholds from "../config/thresholds.js";

const WORKER_URL = config.analyticsWorker;

/**
 * Send a single analytics event to the worker
 */
async function sendEvent(event) {
  const startTime = Date.now();

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    const latency = Date.now() - startTime;
    return {
      success: response.ok,
      statusCode: response.status,
      latency,
      error: null,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      statusCode: 0,
      latency,
      error: error.message,
    };
  }
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run baseline test: steady 5 req/sec for 5 minutes
 */
async function runBaselineTest() {
  console.log(chalk.blue("\n📊 Running Baseline Test (5 req/sec × 5 min)...\n"));

  const metrics = new MetricsCollector("baseline-5rps-5min");
  const duration = 300; // 5 minutes
  const requestsPerSecond = 5;
  const totalRequests = duration * requestsPerSecond;

  const progressBar = new cliProgress.SingleBar({
    format:
      "Progress |" +
      chalk.cyan("{bar}") +
      "| {percentage}% || {value}/{total} requests || Elapsed: {duration}s",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(totalRequests, 0, { duration: 0 });

  const startTime = Date.now();
  let requestsSent = 0;

  while (requestsSent < totalRequests) {
    const batchStartTime = Date.now();
    const requests = [];

    // Send batch of requests for this second
    for (let i = 0; i < requestsPerSecond && requestsSent < totalRequests; i++) {
      const event = generateEvent();
      requests.push(
        sendEvent(event).then((result) => {
          metrics.recordRequest(result.latency, result.statusCode, result.error);
          if (result.success) {
            metrics.recordDatabaseWrite();
          }
          return result;
        })
      );
      requestsSent++;
    }

    await Promise.all(requests);

    // Update progress
    const elapsed = (Date.now() - startTime) / 1000;
    progressBar.update(requestsSent, { duration: elapsed.toFixed(0) });

    // Wait for the rest of the second
    const batchDuration = Date.now() - batchStartTime;
    if (batchDuration < 1000) {
      await sleep(1000 - batchDuration);
    }
  }

  progressBar.stop();
  metrics.complete();

  console.log(chalk.green("\n✓ Baseline test completed\n"));
  metrics.printSummary();

  return metrics;
}

/**
 * Run gradual ramp test: 1→100 req/sec over 5 minutes
 */
async function runGradualRampTest() {
  console.log(chalk.blue("\n📈 Running Gradual Ramp Test (1→100 req/sec × 5 min)...\n"));

  const metrics = new MetricsCollector("gradual-ramp-1-100rps");
  const duration = 300; // 5 minutes
  const startRate = 1;
  const endRate = 100;

  const progressBar = new cliProgress.SingleBar({
    format:
      "Progress |" +
      chalk.cyan("{bar}") +
      "| {percentage}% || {rate} req/s || Elapsed: {duration}s",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(duration, 0, { rate: startRate, duration: 0 });

  const startTime = Date.now();
  let elapsed = 0;

  while (elapsed < duration) {
    const batchStartTime = Date.now();

    // Calculate current rate (linear ramp)
    const progress = elapsed / duration;
    const currentRate = Math.floor(startRate + (endRate - startRate) * progress);

    // Send batch for this second
    const requests = [];
    for (let i = 0; i < currentRate; i++) {
      const event = generateEvent();
      requests.push(
        sendEvent(event).then((result) => {
          metrics.recordRequest(result.latency, result.statusCode, result.error);
          if (result.success) {
            metrics.recordDatabaseWrite();
          }
          return result;
        })
      );
    }

    await Promise.all(requests);

    // Update progress
    elapsed = (Date.now() - startTime) / 1000;
    progressBar.update(Math.floor(elapsed), { rate: currentRate, duration: elapsed.toFixed(0) });

    // Wait for the rest of the second
    const batchDuration = Date.now() - batchStartTime;
    if (batchDuration < 1000) {
      await sleep(1000 - batchDuration);
    }
  }

  progressBar.stop();
  metrics.complete();

  console.log(chalk.green("\n✓ Gradual ramp test completed\n"));
  metrics.printSummary();

  return metrics;
}

/**
 * Run spike test: 0→500 req/sec sudden spike
 */
async function runSpikeTest() {
  console.log(chalk.blue("\n⚡ Running Spike Test (0→500 req/sec spike for 2 min)...\n"));

  const metrics = new MetricsCollector("spike-500rps");
  const baselineRate = 5;
  const spikeRate = 500;
  const spikeDuration = 120; // 2 minutes
  const totalDuration = 300; // 5 minutes total

  const progressBar = new cliProgress.SingleBar({
    format:
      "Progress |" + chalk.cyan("{bar}") + "| {percentage}% || {rate} req/s || Phase: {phase}",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(totalDuration, 0, { rate: baselineRate, phase: "Baseline" });

  const startTime = Date.now();
  let elapsed = 0;

  while (elapsed < totalDuration) {
    const batchStartTime = Date.now();

    // Determine current rate and phase
    let currentRate, phase;
    if (elapsed < 60) {
      currentRate = baselineRate;
      phase = "Baseline";
    } else if (elapsed < 60 + spikeDuration) {
      currentRate = spikeRate;
      phase = "SPIKE!";
    } else {
      currentRate = baselineRate;
      phase = "Recovery";
    }

    // Send batch
    const requests = [];
    for (let i = 0; i < currentRate; i++) {
      const event = generateEvent();
      requests.push(
        sendEvent(event).then((result) => {
          metrics.recordRequest(result.latency, result.statusCode, result.error);
          if (result.success) {
            metrics.recordDatabaseWrite();
          }
          return result;
        })
      );
    }

    await Promise.all(requests);

    // Update progress
    elapsed = (Date.now() - startTime) / 1000;
    progressBar.update(Math.floor(elapsed), { rate: currentRate, phase });

    // Wait for the rest of the second
    const batchDuration = Date.now() - batchStartTime;
    if (batchDuration < 1000) {
      await sleep(1000 - batchDuration);
    }
  }

  progressBar.stop();
  metrics.complete();

  console.log(chalk.green("\n✓ Spike test completed\n"));
  metrics.printSummary();

  return metrics;
}

/**
 * Run sustained load test: 50 req/sec for 30 minutes
 */
async function runSustainedLoadTest() {
  console.log(chalk.blue("\n⏱️  Running Sustained Load Test (50 req/sec × 10 min)...\n"));
  console.log(chalk.yellow("Note: Reduced from 30min to 10min for testing purposes\n"));

  const metrics = new MetricsCollector("sustained-50rps-10min");
  const duration = 600; // 10 minutes (reduced from 30)
  const requestsPerSecond = 50;
  const totalRequests = duration * requestsPerSecond;

  const progressBar = new cliProgress.SingleBar({
    format: "Progress |" + chalk.cyan("{bar}") + "| {percentage}% || {value}/{total} requests",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(totalRequests, 0);

  const startTime = Date.now();
  let requestsSent = 0;

  while (requestsSent < totalRequests) {
    const batchStartTime = Date.now();
    const requests = [];

    for (let i = 0; i < requestsPerSecond && requestsSent < totalRequests; i++) {
      const event = generateEvent();
      requests.push(
        sendEvent(event).then((result) => {
          metrics.recordRequest(result.latency, result.statusCode, result.error);
          if (result.success) {
            metrics.recordDatabaseWrite();
          }
          return result;
        })
      );
      requestsSent++;
    }

    await Promise.all(requests);
    progressBar.update(requestsSent);

    const batchDuration = Date.now() - batchStartTime;
    if (batchDuration < 1000) {
      await sleep(1000 - batchDuration);
    }
  }

  progressBar.stop();
  metrics.complete();

  console.log(chalk.green("\n✓ Sustained load test completed\n"));
  metrics.printSummary();

  return metrics;
}

/**
 * Run burst test: 1000 requests in 10 seconds
 */
async function runBurstTest() {
  console.log(chalk.blue("\n💥 Running Burst Test (1000 requests in 10 sec)...\n"));

  const metrics = new MetricsCollector("burst-1000req-10sec");
  const totalRequests = 1000;
  const concurrency = 100;

  const progressBar = new cliProgress.SingleBar({
    format: "Progress |" + chalk.cyan("{bar}") + "| {percentage}% || {value}/{total} requests",
    barCompleteChar: "\u2588",
    barIncompleteChar: "\u2591",
    hideCursor: true,
  });

  progressBar.start(totalRequests, 0);

  const startTime = Date.now();
  const requests = [];

  for (let i = 0; i < totalRequests; i++) {
    const event = generateEvent();
    const promise = sendEvent(event).then((result) => {
      metrics.recordRequest(result.latency, result.statusCode, result.error);
      if (result.success) {
        metrics.recordDatabaseWrite();
      }
      progressBar.increment();
      return result;
    });
    requests.push(promise);

    // Batch concurrency
    if ((i + 1) % concurrency === 0) {
      await Promise.all(requests.splice(0, concurrency));
    }
  }

  // Wait for remaining requests
  await Promise.all(requests);

  progressBar.stop();
  metrics.complete();

  console.log(chalk.green("\n✓ Burst test completed\n"));
  metrics.printSummary();

  return metrics;
}

/**
 * Main function - run all tests
 */
async function main() {
  console.log(chalk.bold.cyan("\n🚀 Worker Load Testing Suite\n"));
  console.log(`Testing endpoint: ${chalk.yellow(WORKER_URL)}\n`);

  const allMetrics = [];

  try {
    // Run tests
    console.log(chalk.bold("Test Schedule:"));
    console.log("  1. Baseline (5 req/sec × 5 min)");
    console.log("  2. Gradual Ramp (1→100 req/sec × 5 min)");
    console.log("  3. Spike (500 req/sec burst)");
    console.log("  4. Burst (1000 requests in 10 sec)");
    console.log("  5. Sustained Load (50 req/sec × 10 min)\n");

    const runAll = process.argv.includes("--all");
    const testName = process.argv.find((arg) => arg.startsWith("--test="))?.split("=")[1];

    if (testName === "baseline" || runAll) {
      const metrics = await runBaselineTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    if (testName === "ramp" || runAll) {
      const metrics = await runGradualRampTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    if (testName === "spike" || runAll) {
      const metrics = await runSpikeTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    if (testName === "burst" || runAll) {
      const metrics = await runBurstTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    if (testName === "sustained" || runAll) {
      const metrics = await runSustainedLoadTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    if (!testName && !runAll) {
      // Default: run baseline only
      const metrics = await runBaselineTest();
      allMetrics.push(metrics);
      await metrics.exportJSON("../reports");
    }

    console.log(chalk.bold.green("\n✅ All tests completed!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runBaselineTest, runGradualRampTest, runSpikeTest, runBurstTest, runSustainedLoadTest };
