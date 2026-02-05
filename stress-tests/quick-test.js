/**
 * Quick Stress Test - Demonstration
 *
 * Runs a quick 30-second test to demonstrate functionality
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const WORKER_URL = 'https://referral-analytics.contact-newleafllc.workers.dev';

console.log(chalk.bold.cyan('\n🚀 Quick Stress Test - 30 Second Demo\n'));
console.log(`Testing endpoint: ${chalk.yellow(WORKER_URL)}\n`);

const stats = {
  total: 0,
  successful: 0,
  failed: 0,
  latencies: []
};

async function sendTestEvent() {
  const event = {
    event: Math.random() > 0.5 ? 'qr_scan' : 'partner_click',
    timestamp: new Date().toISOString(),
    session_id: `test_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    referrer_id: 'qr-stress-test',
    partner_id: ['brian-dow', 'joshua-naylor', 'tiffany-mcalister', 'tom-berry'][Math.floor(Math.random() * 4)],
    url: 'https://referral-website-5o3.pages.dev',
    pathname: '/',
    user_agent: 'Mozilla/5.0 (Stress Test)'
  };

  const startTime = Date.now();

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    const latency = Date.now() - startTime;
    stats.latencies.push(latency);
    stats.total++;

    if (response.ok) {
      stats.successful++;
    } else {
      stats.failed++;
    }

    return { success: response.ok, latency };
  } catch (error) {
    stats.total++;
    stats.failed++;
    return { success: false, latency: Date.now() - startTime };
  }
}

async function runTest() {
  const duration = 30; // 30 seconds
  const requestsPerSecond = 10;
  const startTime = Date.now();

  console.log(chalk.gray(`Running test: ${requestsPerSecond} req/sec for ${duration} seconds\n`));

  while ((Date.now() - startTime) < duration * 1000) {
    const batchStart = Date.now();

    // Send batch of requests
    const requests = [];
    for (let i = 0; i < requestsPerSecond; i++) {
      requests.push(sendTestEvent());
    }

    await Promise.all(requests);

    // Show progress
    if (stats.total % 50 === 0) {
      process.stdout.write(chalk.gray('.'));
    }

    // Wait for rest of second
    const batchDuration = Date.now() - batchStart;
    if (batchDuration < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - batchDuration));
    }
  }

  console.log(chalk.green('\n\n✓ Test completed!\n'));

  // Calculate statistics
  stats.latencies.sort((a, b) => a - b);
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)];
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)];
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)];
  const mean = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;

  // Print results
  console.log(chalk.bold('='.repeat(60)));
  console.log(chalk.bold.cyan('TEST RESULTS'));
  console.log(chalk.bold('='.repeat(60)));
  console.log('');
  console.log(`Total Requests:    ${stats.total}`);
  console.log(`Successful:        ${chalk.green(stats.successful)} (${((stats.successful/stats.total)*100).toFixed(1)}%)`);
  console.log(`Failed:            ${stats.failed > 0 ? chalk.red(stats.failed) : chalk.green(stats.failed)}`);
  console.log('');
  console.log(chalk.bold('Latency:'));
  console.log(`  Mean:     ${mean.toFixed(2)}ms`);
  console.log(`  Median:   ${p50.toFixed(2)}ms`);
  console.log(`  p95:      ${p95.toFixed(2)}ms`);
  console.log(`  p99:      ${p99.toFixed(2)}ms`);
  console.log(`  Min:      ${stats.latencies[0].toFixed(2)}ms`);
  console.log(`  Max:      ${stats.latencies[stats.latencies.length - 1].toFixed(2)}ms`);
  console.log('');
  console.log(chalk.bold('Analysis:'));

  if (p95 < 500) {
    console.log(chalk.green('  ✓ p95 latency is good (<500ms)'));
  } else {
    console.log(chalk.yellow('  ⚠️  p95 latency exceeds target (>500ms)'));
    console.log(chalk.yellow('     Likely due to synchronous email sending'));
  }

  if (stats.failed === 0) {
    console.log(chalk.green('  ✓ No errors - 100% success rate'));
  } else {
    console.log(chalk.red(`  ⚠️  ${stats.failed} requests failed`));
  }

  console.log('');
  console.log(chalk.bold('='.repeat(60)));
  console.log('');
  console.log(chalk.gray('For comprehensive testing, run: npm test'));
  console.log('');
}

runTest().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error.message);
  process.exit(1);
});
