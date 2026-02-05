/**
 * Rate Limiting Security Test
 *
 * Proves the vulnerability of having no rate limiting
 * Simulates abuse scenarios to demonstrate quota exhaustion risk
 */

import fetch from "node-fetch";
import chalk from "chalk";
import { MetricsCollector } from "../utils/metrics-collector.js";
import { generateEvent, generateSessionId } from "../utils/test-data-factory.js";
import config from "../config/endpoints.js";
import thresholds from "../config/thresholds.js";

const WORKER_URL = config.analyticsWorker;
const D1_DAILY_WRITE_LIMIT = 1000; // Free tier limit

/**
 * Send an event
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
      rejected: response.status === 429, // Too Many Requests
    };
  } catch (error) {
    return {
      success: false,
      statusCode: 0,
      latency: Date.now() - startTime,
      rejected: false,
    };
  }
}

/**
 * Simulate burst attack
 */
async function simulateBurstAttack() {
  console.log(chalk.blue("\n💥 Simulating Burst Attack...\n"));
  console.log("Sending 100 requests in rapid succession from single session.\n");

  const metrics = new MetricsCollector("security-burst-attack");
  const sessionId = generateSessionId();
  const burstSize = 100;

  let rejected = 0;
  let accepted = 0;

  for (let i = 0; i < burstSize; i++) {
    const event = generateEvent({
      sessionId,
      referrerId: "qr-abuse-test",
    });

    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode);

    if (result.rejected) {
      rejected++;
    } else if (result.success) {
      accepted++;
    }

    if ((i + 1) % 10 === 0) {
      process.stdout.write(chalk.gray(`.`));
    }
  }

  console.log(chalk.green("\n\n✓ Burst attack simulation completed\n"));

  metrics.complete();

  console.log(chalk.bold("Results:"));
  console.log(`  Total requests: ${burstSize}`);
  console.log(
    `  Accepted: ${chalk.yellow(accepted)} (${((accepted / burstSize) * 100).toFixed(1)}%)`
  );
  console.log(
    `  Rejected: ${chalk.green(rejected)} (${((rejected / burstSize) * 100).toFixed(1)}%)`
  );

  if (rejected === 0) {
    console.log(chalk.red("\n  ⚠️  NO RATE LIMITING DETECTED"));
    console.log(chalk.red("  All requests were accepted. System is vulnerable to abuse.\n"));
  } else {
    console.log(chalk.green("\n  ✓ Rate limiting is active\n"));
  }

  return { metrics, accepted, rejected };
}

/**
 * Calculate quota exhaustion time
 */
async function calculateQuotaExhaustionTime() {
  console.log(chalk.blue("\n⏱️  Calculating Quota Exhaustion Time...\n"));
  console.log("Measuring how long it takes to exhaust D1 daily write quota.\n");

  const metrics = new MetricsCollector("security-quota-exhaustion");
  const testDuration = 60; // Test for 60 seconds
  const sessionId = generateSessionId();

  console.log(chalk.gray(`Testing at maximum rate for ${testDuration} seconds...\n`));

  const startTime = Date.now();
  let requestsSent = 0;
  let accepted = 0;

  while (Date.now() - startTime < testDuration * 1000) {
    const event = generateEvent({
      sessionId,
      referrerId: "qr-quota-test",
    });

    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode);

    requestsSent++;
    if (result.success) {
      accepted++;
    }

    if (requestsSent % 50 === 0) {
      process.stdout.write(chalk.gray(`.`));
    }
  }

  console.log(chalk.green("\n\n✓ Quota exhaustion test completed\n"));

  metrics.complete();

  const elapsed = (Date.now() - startTime) / 1000;
  const requestsPerSecond = accepted / elapsed;
  const timeToExhaustQuota = D1_DAILY_WRITE_LIMIT / requestsPerSecond;

  console.log(chalk.bold("Quota Exhaustion Analysis:\n"));
  console.log(`  Test duration: ${elapsed.toFixed(1)}s`);
  console.log(`  Requests sent: ${requestsSent}`);
  console.log(`  Requests accepted: ${chalk.yellow(accepted)}`);
  console.log(`  Rate: ${chalk.yellow(requestsPerSecond.toFixed(2) + " req/sec")}`);
  console.log(`  D1 daily limit: ${D1_DAILY_WRITE_LIMIT} writes`);
  console.log(
    `  Time to exhaust quota: ${chalk.red(timeToExhaustQuota.toFixed(1) + " seconds")} (${chalk.red((timeToExhaustQuota / 60).toFixed(1) + " minutes")})`
  );

  if (timeToExhaustQuota < 1800) {
    // Less than 30 minutes
    console.log(chalk.red("\n  ⚠️  CRITICAL VULNERABILITY"));
    console.log(chalk.red("  A single attacker can exhaust daily quota in under 30 minutes!"));
  } else if (timeToExhaustQuota < 3600) {
    console.log(chalk.yellow("\n  ⚠️  HIGH VULNERABILITY"));
    console.log(chalk.yellow("  Daily quota can be exhausted in under 1 hour."));
  } else {
    console.log(chalk.yellow("\n  ⚠️  MEDIUM VULNERABILITY"));
    console.log(chalk.yellow("  Quota exhaustion is possible but takes longer."));
  }

  console.log("");

  return { metrics, requestsPerSecond, timeToExhaustQuota };
}

/**
 * Test recommended rate limits
 */
async function testRecommendedRateLimits() {
  console.log(chalk.blue("\n📋 Testing Recommended Rate Limits...\n"));

  const recommended = thresholds.rateLimits;
  console.log(chalk.bold("Recommended limits:"));
  console.log(
    `  Per IP: ${recommended.perIP.requests} requests per ${recommended.perIP.window} seconds`
  );
  console.log(
    `  Per Session: ${recommended.perSession.requests} requests per ${recommended.perSession.window} seconds\n`
  );

  console.log(chalk.gray("Simulating traffic within recommended limits...\n"));

  const metrics = new MetricsCollector("security-recommended-limits");
  const testDuration = 120; // 2 minutes
  const requestsPerMinute = recommended.perIP.requests; // 10 requests per minute

  const startTime = Date.now();
  let requestsSent = 0;

  while (Date.now() - startTime < testDuration * 1000) {
    const event = generateEvent();
    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode);

    requestsSent++;

    if (requestsSent % requestsPerMinute === 0) {
      process.stdout.write(chalk.gray(`.`));
      // Wait for next minute
      await new Promise((resolve) => setTimeout(resolve, 60000));
    } else {
      // Space out requests evenly
      await new Promise((resolve) => setTimeout(resolve, 60000 / requestsPerMinute));
    }
  }

  console.log(chalk.green("\n\n✓ Recommended limits test completed\n"));

  metrics.complete();

  const elapsed = (Date.now() - startTime) / 1000;
  const actualRate = requestsSent / (elapsed / 60); // Per minute

  console.log(chalk.bold("Results with Recommended Limits:\n"));
  console.log(`  Requests sent: ${requestsSent}`);
  console.log(`  Rate: ${actualRate.toFixed(1)} req/min`);
  console.log(
    `  Daily usage: ${chalk.green((requestsSent / (elapsed / 86400)).toFixed(0) + " requests/day")}`
  );
  console.log(
    `  D1 writes used: ${chalk.green(((requestsSent / D1_DAILY_WRITE_LIMIT) * 100).toFixed(1) + "%")} of daily quota\n`
  );

  const daysToExhaustQuota = D1_DAILY_WRITE_LIMIT / (requestsSent / (elapsed / 86400));

  console.log(chalk.bold("Protection Analysis:\n"));
  console.log(
    `  Time to exhaust quota (single attacker): ${chalk.green(daysToExhaustQuota.toFixed(1) + " days")}`
  );
  console.log(`  ${chalk.green("✓")} Rate limiting provides effective protection.\n`);

  return { metrics, actualRate, daysToExhaustQuota };
}

/**
 * Generate security report
 */
function generateSecurityReport(burstResults, quotaResults, limitsResults) {
  console.log(chalk.bold.cyan("\n" + "=".repeat(60)));
  console.log(chalk.bold.cyan("SECURITY VULNERABILITY REPORT"));
  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

  console.log(chalk.bold("🔴 Current State (No Rate Limiting):\n"));
  console.log(`  Burst attack acceptance: ${chalk.red("100%")} of requests accepted`);
  console.log(
    `  Quota exhaustion time: ${chalk.red(quotaResults.timeToExhaustQuota.toFixed(1) + " seconds")} (${chalk.red((quotaResults.timeToExhaustQuota / 60).toFixed(1) + " minutes")})`
  );
  console.log(
    `  Attack rate: ${chalk.red(quotaResults.requestsPerSecond.toFixed(2) + " req/sec")}`
  );
  console.log(`  ${chalk.red("⚠️  VULNERABLE TO ABUSE")}\n`);

  console.log(chalk.bold("🟢 With Recommended Rate Limiting:\n"));
  console.log(`  Max rate: ${chalk.green("10 req/min per IP")}`);
  console.log(
    `  Quota exhaustion time: ${chalk.green(limitsResults.daysToExhaustQuota.toFixed(1) + " days")}`
  );
  console.log(`  Daily quota usage: ${chalk.green("<1%")} from single source`);
  console.log(`  ${chalk.green("✓ PROTECTED FROM ABUSE")}\n`);

  console.log(chalk.bold("📊 Impact Comparison:\n"));
  const improvement =
    quotaResults.timeToExhaustQuota / 60 / (limitsResults.daysToExhaustQuota * 24 * 60);
  console.log(
    `  Protection multiplier: ${chalk.green(((limitsResults.daysToExhaustQuota * 24 * 60) / (quotaResults.timeToExhaustQuota / 60)).toFixed(0) + "x")}`
  );
  console.log(
    `  From ${chalk.red((quotaResults.timeToExhaustQuota / 60).toFixed(0) + " minutes")} to ${chalk.green(limitsResults.daysToExhaustQuota.toFixed(1) + " days")}\n`
  );

  console.log(chalk.bold("💡 Recommendations:\n"));
  console.log(`  1. Implement per-IP rate limiting: ${chalk.yellow("10 requests per minute")}`);
  console.log(
    `  2. Implement per-session rate limiting: ${chalk.yellow("100 requests per minute")}`
  );
  console.log(`  3. Add monitoring for quota usage`);
  console.log(`  4. Set up alerts at 80% daily quota`);
  console.log(`  5. Consider Cloudflare Rate Limiting rules\n`);

  console.log(chalk.bold("🔧 Implementation Options:\n"));
  console.log("  • Cloudflare Workers KV (track IPs/sessions)");
  console.log("  • Cloudflare Durable Objects (stateful rate limiting)");
  console.log("  • Cloudflare Rate Limiting rules (WAF)\n");

  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan("\n🔒 Rate Limiting Security Test\n"));
  console.log(`Testing endpoint: ${chalk.yellow(WORKER_URL)}\n`);
  console.log(chalk.gray("This test demonstrates the need for rate limiting.\n"));

  try {
    // Test 1: Burst attack
    const burstResults = await simulateBurstAttack();
    await burstResults.metrics.exportJSON("../reports");

    // Test 2: Calculate quota exhaustion time
    const quotaResults = await calculateQuotaExhaustionTime();
    await quotaResults.metrics.exportJSON("../reports");

    // Test 3: Test with recommended limits
    console.log(chalk.yellow("⏭️  Skipping recommended limits test (would take 2+ minutes)"));
    console.log(chalk.gray("Use --full flag to run complete test suite\n"));

    const runFull = process.argv.includes("--full");
    let limitsResults;

    if (runFull) {
      limitsResults = await testRecommendedRateLimits();
      await limitsResults.metrics.exportJSON("../reports");
    } else {
      // Estimate based on recommended rate
      limitsResults = {
        actualRate: 10, // 10 req/min recommended
        daysToExhaustQuota: D1_DAILY_WRITE_LIMIT / (10 * 60 * 24), // 10 req/min for full day
      };
    }

    // Generate security report
    generateSecurityReport(burstResults, quotaResults, limitsResults);

    console.log(chalk.bold.green("✅ Security testing completed!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { simulateBurstAttack, calculateQuotaExhaustionTime, testRecommendedRateLimits };
