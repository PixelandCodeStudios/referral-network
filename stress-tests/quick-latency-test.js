/**
 * Quick Latency Comparison Test
 *
 * Compares events with vs without email notifications
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const WORKER_URL = 'https://referral-analytics.contact-newleafllc.workers.dev';

async function sendEvent(event) {
  const startTime = Date.now();

  try {
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });

    return {
      success: response.ok,
      latency: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - startTime
    };
  }
}

async function testEventType(eventType, hasEmail, count = 20) {
  const latencies = [];

  for (let i = 0; i < count; i++) {
    const event = {
      event: eventType,
      timestamp: new Date().toISOString(),
      session_id: `test_latency_${Date.now()}_${i}`,
      referrer_id: 'qr-latency-test',
      url: 'https://referral-website-5o3.pages.dev',
      pathname: '/',
      user_agent: 'Mozilla/5.0 (Latency Test)'
    };

    if (hasEmail) {
      event.partner_id = 'brian-dow';
    }

    const result = await sendEvent(event);
    if (result.success) {
      latencies.push(result.latency);
    }

    process.stdout.write(chalk.gray('.'));
  }

  latencies.sort((a, b) => a - b);
  return {
    mean: latencies.reduce((a, b) => a + b, 0) / latencies.length,
    median: latencies[Math.floor(latencies.length * 0.5)],
    p95: latencies[Math.floor(latencies.length * 0.95)],
    min: latencies[0],
    max: latencies[latencies.length - 1]
  };
}

async function main() {
  console.log(chalk.bold.cyan('\n🔬 Worker Latency Profiling\n'));
  console.log(`Testing endpoint: ${chalk.yellow(WORKER_URL)}\n`);

  // Test 1: Non-notifiable events (qr_scan - no email)
  console.log(chalk.blue('Testing non-notifiable events (qr_scan - no email)...'));
  const nonNotifiable = await testEventType('qr_scan', false, 20);
  console.log(chalk.green(' done!\n'));

  // Test 2: Notifiable events (partner_click - with email)
  console.log(chalk.blue('Testing notifiable events (partner_click - with email)...'));
  const notifiable = await testEventType('partner_click', true, 20);
  console.log(chalk.green(' done!\n'));

  // Calculate overhead
  const meanOverhead = ((notifiable.mean - nonNotifiable.mean) / nonNotifiable.mean * 100);
  const p95Overhead = ((notifiable.p95 - nonNotifiable.p95) / nonNotifiable.p95 * 100);

  // Print results
  console.log(chalk.bold('='.repeat(60)));
  console.log(chalk.bold.cyan('LATENCY COMPARISON'));
  console.log(chalk.bold('='.repeat(60)));
  console.log('');

  console.log(chalk.bold('1. Non-Notifiable Events (QR Scan - No Email)'));
  console.log(`   Mean:   ${chalk.green(nonNotifiable.mean.toFixed(2) + 'ms')}`);
  console.log(`   Median: ${chalk.green(nonNotifiable.median.toFixed(2) + 'ms')}`);
  console.log(`   p95:    ${chalk.green(nonNotifiable.p95.toFixed(2) + 'ms')}`);
  console.log('');

  console.log(chalk.bold('2. Notifiable Events (Partner Click - With Email)'));
  console.log(`   Mean:   ${chalk.yellow(notifiable.mean.toFixed(2) + 'ms')}`);
  console.log(`   Median: ${chalk.yellow(notifiable.median.toFixed(2) + 'ms')}`);
  console.log(`   p95:    ${chalk.yellow(notifiable.p95.toFixed(2) + 'ms')}`);
  console.log('');

  console.log(chalk.bold('📊 Email Sending Overhead:'));
  console.log(`   Mean difference: ${chalk.yellow('+' + (notifiable.mean - nonNotifiable.mean).toFixed(2) + 'ms')} (${chalk.yellow('+' + meanOverhead.toFixed(1) + '%')})`);
  console.log(`   p95 difference:  ${chalk.yellow('+' + (notifiable.p95 - nonNotifiable.p95).toFixed(2) + 'ms')} (${chalk.yellow('+' + p95Overhead.toFixed(1) + '%')})`);
  console.log('');

  console.log(chalk.bold('🔍 Analysis:'));
  if (meanOverhead > 200) {
    console.log(chalk.red('   ⚠️  Email overhead is >200% - CRITICAL ISSUE'));
    console.log(chalk.red('   Synchronous email sending significantly impacts response times.'));
    console.log(chalk.yellow('   RECOMMENDATION: Move email to async queue (Cloudflare Queues).'));
  } else if (meanOverhead > 100) {
    console.log(chalk.yellow('   ⚠️  Email overhead is >100% - HIGH PRIORITY'));
    console.log(chalk.yellow('   Email sending doubles response times.'));
  } else {
    console.log(chalk.green('   ✓ Email overhead is acceptable (<100%)'));
  }
  console.log('');

  console.log(chalk.bold('💡 Estimated Improvement with Async Email:'));
  console.log(`   Current p95:    ${notifiable.p95.toFixed(2)}ms`);
  console.log(`   Potential p95:  ${nonNotifiable.p95.toFixed(2)}ms`);
  console.log(`   Improvement:    ${chalk.green('-' + (notifiable.p95 - nonNotifiable.p95).toFixed(2) + 'ms')} (${chalk.green('-' + p95Overhead.toFixed(1) + '%')})`);
  console.log('');

  console.log(chalk.bold('='.repeat(60)));
  console.log('');
}

main().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error.message);
  process.exit(1);
});
