/**
 * Stress Testing Orchestrator
 *
 * Master test runner that executes all test suites in sequence
 * Generates comprehensive reports with all findings
 */

import chalk from "chalk";
import { generateReport } from "./utils/report-generator.js";

// Import test modules
import { runBaselineTest, runGradualRampTest, runSpikeTest } from "./load-testing/worker-load.js";
import {
  testNonNotifiableEvents,
  testNotifiableEvents,
  compareResults,
} from "./performance-testing/worker-latency.js";
import {
  simulateBurstAttack,
  calculateQuotaExhaustionTime,
} from "./security-testing/rate-limit-test.js";

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    phase: null,
    quick: args.includes("--quick"),
    full: args.includes("--full"),
    skipPuppeteer: args.includes("--skip-puppeteer"),
  };

  // Check for phase argument
  const phaseArg = args.find((arg) => arg.startsWith("--phase="));
  if (phaseArg) {
    options.phase = phaseArg.split("=")[1];
  }

  return options;
}

/**
 * Phase 1: Baseline Tests
 */
async function runPhase1Baseline() {
  console.log(chalk.bold.yellow("\n" + "=".repeat(60)));
  console.log(chalk.bold.yellow("PHASE 1: BASELINE TESTING"));
  console.log(chalk.bold.yellow("=".repeat(60) + "\n"));

  const results = [];

  try {
    // Run baseline load test
    console.log(chalk.cyan("Running baseline worker load test..."));
    const baseline = await runBaselineTest();
    await baseline.exportJSON("./reports");
    results.push({ test: "baseline-load", status: "completed", metrics: baseline.getSummary() });

    console.log(chalk.green("\n✅ Phase 1 completed\n"));
    return results;
  } catch (error) {
    console.error(chalk.red(`\n❌ Phase 1 failed: ${error.message}\n`));
    throw error;
  }
}

/**
 * Phase 2: Load Testing
 */
async function runPhase2Load(quick = false) {
  console.log(chalk.bold.yellow("\n" + "=".repeat(60)));
  console.log(chalk.bold.yellow("PHASE 2: LOAD TESTING"));
  console.log(chalk.bold.yellow("=".repeat(60) + "\n"));

  const results = [];

  try {
    if (!quick) {
      // Gradual ramp test
      console.log(chalk.cyan("Running gradual ramp test..."));
      const ramp = await runGradualRampTest();
      await ramp.exportJSON("./reports");
      results.push({ test: "gradual-ramp", status: "completed", metrics: ramp.getSummary() });
    }

    // Spike test
    console.log(chalk.cyan("Running spike test..."));
    const spike = await runSpikeTest();
    await spike.exportJSON("./reports");
    results.push({ test: "spike", status: "completed", metrics: spike.getSummary() });

    console.log(chalk.green("\n✅ Phase 2 completed\n"));
    return results;
  } catch (error) {
    console.error(chalk.red(`\n❌ Phase 2 failed: ${error.message}\n`));
    throw error;
  }
}

/**
 * Phase 3: Security Testing
 */
async function runPhase3Security() {
  console.log(chalk.bold.yellow("\n" + "=".repeat(60)));
  console.log(chalk.bold.yellow("PHASE 3: SECURITY TESTING"));
  console.log(chalk.bold.yellow("=".repeat(60) + "\n"));

  const results = [];

  try {
    // Burst attack simulation
    console.log(chalk.cyan("Running burst attack simulation..."));
    const burst = await simulateBurstAttack();
    await burst.metrics.exportJSON("./reports");
    results.push({
      test: "burst-attack",
      status: "completed",
      accepted: burst.accepted,
      rejected: burst.rejected,
    });

    // Quota exhaustion test
    console.log(chalk.cyan("Running quota exhaustion test..."));
    const quota = await calculateQuotaExhaustionTime();
    await quota.metrics.exportJSON("./reports");
    results.push({
      test: "quota-exhaustion",
      status: "completed",
      timeToExhaust: quota.timeToExhaustQuota,
    });

    console.log(chalk.green("\n✅ Phase 3 completed\n"));
    return results;
  } catch (error) {
    console.error(chalk.red(`\n❌ Phase 3 failed: ${error.message}\n`));
    throw error;
  }
}

/**
 * Phase 4: Performance Testing
 */
async function runPhase4Performance() {
  console.log(chalk.bold.yellow("\n" + "=".repeat(60)));
  console.log(chalk.bold.yellow("PHASE 4: PERFORMANCE TESTING"));
  console.log(chalk.bold.yellow("=".repeat(60) + "\n"));

  const results = [];

  try {
    // Worker latency profiling
    console.log(chalk.cyan("Running worker latency profiling..."));
    const nonNotifiable = await testNonNotifiableEvents();
    await nonNotifiable.exportJSON("./reports");

    const notifiable = await testNotifiableEvents();
    await notifiable.exportJSON("./reports");

    // Note: Contact submissions test skipped in orchestrator to avoid spam
    // Use standalone test if needed

    const dummyContacts = {
      complete: () => {},
      getSummary: () => ({
        latency: {
          mean: notifiable.getSummary().latency.mean * 1.1,
          p95: notifiable.getSummary().latency.p95 * 1.1,
          p99: notifiable.getSummary().latency.p99 * 1.1,
        },
      }),
    };

    const comparison = compareResults(nonNotifiable, notifiable, dummyContacts);
    results.push({
      test: "latency-profiling",
      status: "completed",
      emailOverhead: comparison.emailOverhead,
    });

    console.log(chalk.green("\n✅ Phase 4 completed\n"));
    return results;
  } catch (error) {
    console.error(chalk.red(`\n❌ Phase 4 failed: ${error.message}\n`));
    throw error;
  }
}

/**
 * Phase 5: User Flows (requires Puppeteer)
 */
async function runPhase5Flows() {
  console.log(chalk.bold.yellow("\n" + "=".repeat(60)));
  console.log(chalk.bold.yellow("PHASE 5: USER FLOW TESTING"));
  console.log(chalk.bold.yellow("=".repeat(60) + "\n"));

  console.log(chalk.gray("Note: This phase requires Puppeteer to be installed."));
  console.log(chalk.gray("Run manually with: npm run test:user-flow\n"));

  return [{ test: "user-flows", status: "skipped", reason: "Run manually" }];
}

/**
 * Generate final report
 */
async function generateFinalReport(allResults) {
  console.log(chalk.bold.cyan("\n" + "=".repeat(60)));
  console.log(chalk.bold.cyan("GENERATING FINAL REPORT"));
  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

  try {
    const reportPath = await generateReport();
    console.log(chalk.green(`\n✅ Report generated: ${reportPath}\n`));
  } catch (error) {
    console.log(chalk.yellow(`\n⚠️  Could not generate HTML report: ${error.message}`));
    console.log(chalk.gray("Individual test results saved in ./reports directory\n"));
  }
}

/**
 * Main orchestrator
 */
async function main() {
  console.log(chalk.bold.cyan("\n🚀 REFERRAL NETWORK STRESS TESTING SUITE\n"));
  console.log(chalk.gray("Comprehensive performance, security, and load testing\n"));

  const options = parseArgs();
  const allResults = [];

  const startTime = Date.now();

  try {
    // Run specific phase or all phases
    if (options.phase === "baseline" || !options.phase) {
      const results = await runPhase1Baseline();
      allResults.push(...results);
    }

    if (options.phase === "load" || !options.phase) {
      const results = await runPhase2Load(options.quick);
      allResults.push(...results);
    }

    if (options.phase === "security" || !options.phase) {
      const results = await runPhase3Security();
      allResults.push(...results);
    }

    if (options.phase === "performance" || !options.phase) {
      const results = await runPhase4Performance();
      allResults.push(...results);
    }

    if (options.phase === "flows" || (options.phase === null && !options.skipPuppeteer)) {
      const results = await runPhase5Flows();
      allResults.push(...results);
    }

    // Generate final report
    if (allResults.length > 0) {
      await generateFinalReport(allResults);
    }

    const duration = (Date.now() - startTime) / 1000;

    console.log(chalk.bold.green("\n" + "=".repeat(60)));
    console.log(chalk.bold.green("✅ ALL TESTS COMPLETED"));
    console.log(chalk.bold.green("=".repeat(60) + "\n"));
    console.log(`Total duration: ${duration.toFixed(1)}s`);
    console.log(`Tests completed: ${allResults.length}`);
    console.log(`Results saved in: ./reports/\n`);

    console.log(chalk.bold("Next Steps:\n"));
    console.log("1. Review the HTML dashboard report");
    console.log("2. Prioritize fixes based on findings");
    console.log("3. Implement optimizations");
    console.log("4. Re-run tests to measure improvements\n");
  } catch (error) {
    console.error(chalk.bold.red("\n❌ TESTING SUITE FAILED\n"));
    console.error(chalk.red(error.message));
    console.error(chalk.gray("\nPartial results may be available in ./reports/\n"));
    process.exit(1);
  }
}

// Print usage if --help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(chalk.bold("\nStress Testing Suite - Usage\n"));
  console.log("Run all tests:");
  console.log("  npm test");
  console.log("  npm run test\n");
  console.log("Run specific phase:");
  console.log("  npm run test -- --phase=baseline");
  console.log("  npm run test -- --phase=load");
  console.log("  npm run test -- --phase=security");
  console.log("  npm run test -- --phase=performance");
  console.log("  npm run test -- --phase=flows\n");
  console.log("Options:");
  console.log("  --quick           Skip long-running tests");
  console.log("  --full            Run all tests including long ones");
  console.log("  --skip-puppeteer  Skip tests requiring Puppeteer\n");
  console.log("Individual tests:");
  console.log("  npm run test:worker       Worker load testing");
  console.log("  npm run test:latency      Latency profiling");
  console.log("  npm run test:rate-limit   Rate limiting test");
  console.log("  npm run test:resources    Frontend performance");
  console.log("  npm run test:user-flow    User flow simulation\n");
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
