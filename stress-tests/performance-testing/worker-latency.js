/**
 * Worker Latency Profiling
 *
 * Measures the impact of email sending on worker response times
 * Compares notifiable events (with email) vs non-notifiable events (without email)
 */

import fetch from 'node-fetch';
import chalk from 'chalk';
import { MetricsCollector } from '../utils/metrics-collector.js';
import { generateEvent } from '../utils/test-data-factory.js';
import config from '../config/endpoints.js';

const WORKER_URL = config.analyticsWorker;

/**
 * Send an event and measure latency
 */
async function sendEvent(event) {
  const startTime = Date.now();

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });

    const latency = Date.now() - startTime;
    return {
      success: response.ok,
      statusCode: response.status,
      latency,
      error: null
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      statusCode: 0,
      latency,
      error: error.message
    };
  }
}

/**
 * Test non-notifiable events (qr_scan - no email sent)
 */
async function testNonNotifiableEvents() {
  console.log(chalk.blue('\n📊 Testing Non-Notifiable Events (qr_scan)...\n'));
  console.log('These events do NOT trigger email notifications.\n');

  const metrics = new MetricsCollector('latency-non-notifiable-qr-scan');
  const testCount = 100;

  for (let i = 0; i < testCount; i++) {
    const event = generateEvent({
      event: 'qr_scan'
    });

    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode, result.error);

    if ((i + 1) % 20 === 0) {
      process.stdout.write(chalk.gray(`.`));
    }
  }

  console.log(chalk.green('\n\n✓ Non-notifiable test completed\n'));
  metrics.complete();
  metrics.printSummary();

  return metrics;
}

/**
 * Test notifiable events (partner_click - sends email)
 */
async function testNotifiableEvents() {
  console.log(chalk.blue('\n📧 Testing Notifiable Events (partner_click)...\n'));
  console.log('These events TRIGGER email notifications.\n');

  const metrics = new MetricsCollector('latency-notifiable-partner-click');
  const testCount = 100;

  for (let i = 0; i < testCount; i++) {
    const event = generateEvent({
      event: 'partner_click',
      partnerId: 'brian-dow'
    });

    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode, result.error);

    if ((i + 1) % 20 === 0) {
      process.stdout.write(chalk.gray(`.`));
    }
  }

  console.log(chalk.green('\n\n✓ Notifiable test completed\n'));
  metrics.complete();
  metrics.printSummary();

  return metrics;
}

/**
 * Test contact form submissions (highest priority notifications)
 */
async function testContactSubmissions() {
  console.log(chalk.blue('\n✉️  Testing Contact Submissions...\n'));
  console.log('These are the highest priority notifications.\n');

  const metrics = new MetricsCollector('latency-contact-submit');
  const testCount = 50; // Fewer tests to avoid spam

  for (let i = 0; i < testCount; i++) {
    const event = generateEvent({
      event: 'contact_submit',
      partnerId: 'brian-dow'
    });

    const result = await sendEvent(event);
    metrics.recordRequest(result.latency, result.statusCode, result.error);

    if ((i + 1) % 10 === 0) {
      process.stdout.write(chalk.gray(`.`));
    }
  }

  console.log(chalk.green('\n\n✓ Contact submission test completed\n'));
  metrics.complete();
  metrics.printSummary();

  return metrics;
}

/**
 * Compare results and calculate email overhead
 */
function compareResults(nonNotifiable, notifiable, contacts) {
  console.log(chalk.bold.cyan('\n' + '='.repeat(60)));
  console.log(chalk.bold.cyan('LATENCY COMPARISON ANALYSIS'));
  console.log(chalk.bold.cyan('='.repeat(60) + '\n'));

  const nonNotifiableSummary = nonNotifiable.getSummary();
  const notifiableSummary = notifiable.getSummary();
  const contactsSummary = contacts.getSummary();

  // Calculate differences
  const meanDiff = notifiableSummary.latency.mean - nonNotifiableSummary.latency.mean;
  const p95Diff = notifiableSummary.latency.p95 - nonNotifiableSummary.latency.p95;
  const p99Diff = notifiableSummary.latency.p99 - nonNotifiableSummary.latency.p99;

  const meanOverhead = (meanDiff / nonNotifiableSummary.latency.mean) * 100;
  const p95Overhead = (p95Diff / nonNotifiableSummary.latency.p95) * 100;

  console.log(chalk.bold('1. Non-Notifiable Events (QR Scan - No Email)'));
  console.log(`   Mean: ${chalk.green(nonNotifiableSummary.latency.mean.toFixed(2) + 'ms')}`);
  console.log(`   p95:  ${chalk.green(nonNotifiableSummary.latency.p95.toFixed(2) + 'ms')}`);
  console.log(`   p99:  ${chalk.green(nonNotifiableSummary.latency.p99.toFixed(2) + 'ms')}\n`);

  console.log(chalk.bold('2. Notifiable Events (Partner Click - With Email)'));
  console.log(`   Mean: ${chalk.yellow(notifiableSummary.latency.mean.toFixed(2) + 'ms')}`);
  console.log(`   p95:  ${chalk.yellow(notifiableSummary.latency.p95.toFixed(2) + 'ms')}`);
  console.log(`   p99:  ${chalk.yellow(notifiableSummary.latency.p99.toFixed(2) + 'ms')}\n`);

  console.log(chalk.bold('3. Contact Submissions (High Priority Email)'));
  console.log(`   Mean: ${chalk.red(contactsSummary.latency.mean.toFixed(2) + 'ms')}`);
  console.log(`   p95:  ${chalk.red(contactsSummary.latency.p95.toFixed(2) + 'ms')}`);
  console.log(`   p99:  ${chalk.red(contactsSummary.latency.p99.toFixed(2) + 'ms')}\n`);

  console.log(chalk.bold('📊 Email Sending Overhead:'));
  console.log(`   Mean difference: ${chalk.yellow('+' + meanDiff.toFixed(2) + 'ms')} (${chalk.yellow('+' + meanOverhead.toFixed(1) + '%')})`);
  console.log(`   p95 difference:  ${chalk.yellow('+' + p95Diff.toFixed(2) + 'ms')} (${chalk.yellow('+' + p95Overhead.toFixed(1) + '%')})`);
  console.log(`   p99 difference:  ${chalk.yellow('+' + p99Diff.toFixed(2) + 'ms')}\n`);

  // Analysis
  console.log(chalk.bold('🔍 Analysis:\n'));

  if (meanOverhead > 200) {
    console.log(chalk.red('   ⚠️  Email overhead is >200% - CRITICAL ISSUE'));
    console.log(chalk.red('   Synchronous email sending is significantly impacting response times.'));
    console.log(chalk.yellow('   RECOMMENDATION: Move email notifications to async queue (Cloudflare Queues).\n'));
  } else if (meanOverhead > 100) {
    console.log(chalk.yellow('   ⚠️  Email overhead is >100% - HIGH PRIORITY'));
    console.log(chalk.yellow('   Email sending is doubling response times.'));
    console.log(chalk.yellow('   RECOMMENDATION: Implement async email processing.\n'));
  } else if (meanOverhead > 50) {
    console.log(chalk.yellow('   ⚠️  Email overhead is >50% - MEDIUM PRIORITY'));
    console.log(chalk.yellow('   Email sending adds noticeable latency.'));
    console.log(chalk.yellow('   RECOMMENDATION: Consider async processing for better performance.\n'));
  } else {
    console.log(chalk.green('   ✓ Email overhead is acceptable (<50%)'));
    console.log(chalk.green('   Current synchronous approach is performing reasonably well.\n'));
  }

  // Estimated improvement
  const estimatedImprovement = notifiableSummary.latency.p95 - nonNotifiableSummary.latency.p95;
  console.log(chalk.bold('💡 Estimated Improvement with Async Email:\n'));
  console.log(`   Current p95:    ${notifiableSummary.latency.p95.toFixed(2)}ms`);
  console.log(`   Potential p95:  ${nonNotifiableSummary.latency.p95.toFixed(2)}ms`);
  console.log(`   Improvement:    ${chalk.green('-' + estimatedImprovement.toFixed(2) + 'ms')} (${chalk.green('-' + p95Overhead.toFixed(1) + '%')})\n`);

  console.log(chalk.bold.cyan('='.repeat(60) + '\n'));

  return {
    nonNotifiable: nonNotifiableSummary,
    notifiable: notifiableSummary,
    contacts: contactsSummary,
    emailOverhead: {
      meanMs: meanDiff,
      meanPercent: meanOverhead,
      p95Ms: p95Diff,
      p95Percent: p95Overhead
    }
  };
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan('\n🔬 Worker Latency Profiling\n'));
  console.log(`Testing endpoint: ${chalk.yellow(WORKER_URL)}\n`);
  console.log(chalk.gray('This test measures the impact of email sending on worker response times.\n'));

  try {
    // Run tests
    const nonNotifiable = await testNonNotifiableEvents();
    await nonNotifiable.exportJSON('../reports');

    const notifiable = await testNotifiableEvents();
    await notifiable.exportJSON('../reports');

    const contacts = await testContactSubmissions();
    await contacts.exportJSON('../reports');

    // Compare and analyze
    const comparison = compareResults(nonNotifiable, notifiable, contacts);

    // Export comparison report
    const comparisonPath = join(process.cwd(), 'reports', `latency-comparison-${Date.now()}.json`);
    await writeFile(comparisonPath, JSON.stringify(comparison, null, 2));
    console.log(chalk.green(`✓ Comparison report saved: ${comparisonPath}\n`));

    console.log(chalk.bold.green('✅ Latency profiling completed!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Test failed:'), error.message);
    process.exit(1);
  }
}

// Helper imports for comparison export
import { writeFile } from 'fs/promises';
import { join } from 'path';

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testNonNotifiableEvents, testNotifiableEvents, testContactSubmissions, compareResults };
