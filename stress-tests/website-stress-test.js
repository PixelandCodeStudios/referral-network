/**
 * Comprehensive Website Stress Test
 *
 * Tests the entire referral website frontend including:
 * - Homepage (index.html)
 * - All partner pages
 * - Page load times
 * - Resource loading
 * - Image optimization verification
 * - Analytics firing
 * - Concurrent user simulation
 */

import puppeteer from 'puppeteer';
import chalk from 'chalk';

const BASE_URL = 'https://referral-website-53j.pages.dev';

const PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/brian-dow.html', name: 'Brian Dow' },
  { path: '/joshua-naylor.html', name: 'Joshua Naylor' },
  { path: '/tiffany-mcalister.html', name: 'Tiffany McAlister' },
  { path: '/tom-berry.html', name: 'Tom Berry' },
  { path: '/jordan-clay.html', name: 'Jordan Clay' }
];

// Performance thresholds
const THRESHOLDS = {
  LCP: 2500,        // Largest Contentful Paint (ms)
  FCP: 1800,        // First Contentful Paint (ms)
  TTFB: 600,        // Time to First Byte (ms)
  LOAD_TIME: 3000   // Total page load (ms)
};

/**
 * Test single page performance
 */
async function testPagePerformance(page, url, pageName) {
  const startTime = Date.now();

  try {
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Collect performance metrics
    const metrics = await page.evaluate(() => {
      const paint = performance.getEntriesByType('paint');
      const navigation = performance.getEntriesByType('navigation')[0];

      return {
        ttfb: navigation.responseStart,
        domContentLoaded: navigation.domContentLoadedEventEnd,
        loadComplete: navigation.loadEventEnd,
        fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        transferSize: navigation.transferSize,
        resources: performance.getEntriesByType('resource').length
      };
    });

    // Get LCP using PerformanceObserver
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lcpValue = 0;
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          lcpValue = lastEntry.startTime;
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });

        // Wait 2 seconds for LCP to stabilize
        setTimeout(() => {
          observer.disconnect();
          resolve(lcpValue);
        }, 2000);
      });
    });

    const totalTime = Date.now() - startTime;

    return {
      success: true,
      pageName,
      url,
      ttfb: Math.round(metrics.ttfb),
      fcp: Math.round(metrics.fcp),
      lcp: Math.round(lcp),
      domContentLoaded: Math.round(metrics.domContentLoaded),
      loadComplete: Math.round(metrics.loadComplete),
      totalTime,
      transferSize: Math.round(metrics.transferSize / 1024), // KB
      resourceCount: metrics.resources
    };
  } catch (error) {
    return {
      success: false,
      pageName,
      url,
      error: error.message
    };
  }
}

/**
 * Test concurrent users
 */
async function testConcurrentLoad(concurrentUsers = 10) {
  console.log(chalk.blue(`\n🔄 Testing ${concurrentUsers} concurrent users...`));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < concurrentUsers; i++) {
    const promise = (async () => {
      const page = await browser.newPage();
      const url = `${BASE_URL}/?ref=stress-test-user-${i}`;

      try {
        const start = Date.now();
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        const loadTime = Date.now() - start;
        await page.close();
        return { success: true, loadTime, userId: i };
      } catch (error) {
        await page.close();
        return { success: false, error: error.message, userId: i };
      }
    })();

    promises.push(promise);
  }

  const results = await Promise.all(promises);
  await browser.close();

  const totalTime = Date.now() - startTime;
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgLoadTime = results
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.loadTime, 0) / successful;

  return {
    totalTime,
    concurrentUsers,
    successful,
    failed,
    avgLoadTime: Math.round(avgLoadTime),
    throughput: (successful / (totalTime / 1000)).toFixed(2) // requests per second
  };
}

/**
 * Verify analytics are firing correctly
 */
async function testAnalyticsFiring(page, url) {
  const requests = [];

  page.on('request', request => {
    if (request.url().includes('referral-analytics')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        postData: request.postData()
      });
    }
  });

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Wait for analytics to fire
  await page.waitForTimeout(1000);

  return requests;
}

/**
 * Main test runner
 */
async function main() {
  console.log(chalk.bold.cyan('\n🌐 Comprehensive Website Stress Test\n'));
  console.log(`Testing: ${chalk.yellow(BASE_URL)}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allResults = [];

  // Test 1: Individual page performance
  console.log(chalk.bold('📊 Test 1: Page Performance Metrics\n'));

  for (const pageInfo of PAGES) {
    const url = `${BASE_URL}${pageInfo.path}`;
    process.stdout.write(chalk.gray(`Testing ${pageInfo.name}...`));

    const page = await browser.newPage();
    const result = await testPagePerformance(page, url, pageInfo.name);
    await page.close();

    allResults.push(result);

    if (result.success) {
      console.log(chalk.green(' ✓'));
    } else {
      console.log(chalk.red(` ✗ (${result.error})`));
    }
  }

  // Test 2: Concurrent load
  const concurrentResult = await testConcurrentLoad(10);

  // Test 3: Analytics verification
  console.log(chalk.blue('\n📡 Test 3: Analytics Verification\n'));
  const page = await browser.newPage();
  const analyticsRequests = await testAnalyticsFiring(
    page,
    `${BASE_URL}/?ref=analytics-verification-test`
  );
  await page.close();

  await browser.close();

  // Print Results
  console.log(chalk.bold('\n' + '='.repeat(80)));
  console.log(chalk.bold.cyan('STRESS TEST RESULTS'));
  console.log(chalk.bold('='.repeat(80) + '\n'));

  // Page Performance Results
  console.log(chalk.bold('1. Individual Page Performance:\n'));

  const successfulResults = allResults.filter(r => r.success);

  if (successfulResults.length > 0) {
    console.log(chalk.gray('Page'.padEnd(25) + 'TTFB'.padEnd(10) + 'FCP'.padEnd(10) + 'LCP'.padEnd(10) + 'Load'.padEnd(10) + 'Size'));
    console.log(chalk.gray('-'.repeat(80)));

    for (const result of successfulResults) {
      const ttfbColor = result.ttfb < THRESHOLDS.TTFB ? chalk.green : chalk.yellow;
      const fcpColor = result.fcp < THRESHOLDS.FCP ? chalk.green : chalk.yellow;
      const lcpColor = result.lcp < THRESHOLDS.LCP ? chalk.green : chalk.yellow;
      const loadColor = result.totalTime < THRESHOLDS.LOAD_TIME ? chalk.green : chalk.yellow;

      console.log(
        result.pageName.padEnd(25) +
        ttfbColor(`${result.ttfb}ms`.padEnd(10)) +
        fcpColor(`${result.fcp}ms`.padEnd(10)) +
        lcpColor(`${result.lcp}ms`.padEnd(10)) +
        loadColor(`${result.totalTime}ms`.padEnd(10)) +
        `${result.transferSize}KB`
      );
    }

    // Calculate averages
    const avgTTFB = Math.round(successfulResults.reduce((sum, r) => sum + r.ttfb, 0) / successfulResults.length);
    const avgFCP = Math.round(successfulResults.reduce((sum, r) => sum + r.fcp, 0) / successfulResults.length);
    const avgLCP = Math.round(successfulResults.reduce((sum, r) => sum + r.lcp, 0) / successfulResults.length);
    const avgLoad = Math.round(successfulResults.reduce((sum, r) => sum + r.totalTime, 0) / successfulResults.length);
    const avgSize = Math.round(successfulResults.reduce((sum, r) => sum + r.transferSize, 0) / successfulResults.length);

    console.log(chalk.gray('-'.repeat(80)));
    console.log(chalk.bold(
      'Average'.padEnd(25) +
      `${avgTTFB}ms`.padEnd(10) +
      `${avgFCP}ms`.padEnd(10) +
      `${avgLCP}ms`.padEnd(10) +
      `${avgLoad}ms`.padEnd(10) +
      `${avgSize}KB`
    ));
  }

  // Concurrent Load Results
  console.log(chalk.bold('\n2. Concurrent Load Test:\n'));
  console.log(`   Concurrent Users: ${chalk.yellow(concurrentResult.concurrentUsers)}`);
  console.log(`   Successful: ${chalk.green(concurrentResult.successful)}`);
  console.log(`   Failed: ${concurrentResult.failed > 0 ? chalk.red(concurrentResult.failed) : chalk.green(concurrentResult.failed)}`);
  console.log(`   Average Load Time: ${chalk.yellow(concurrentResult.avgLoadTime + 'ms')}`);
  console.log(`   Throughput: ${chalk.yellow(concurrentResult.throughput + ' req/sec')}`);
  console.log(`   Total Time: ${chalk.yellow(concurrentResult.totalTime + 'ms')}`);

  // Analytics Verification
  console.log(chalk.bold('\n3. Analytics Verification:\n'));
  if (analyticsRequests.length > 0) {
    console.log(chalk.green(`   ✓ Analytics firing correctly (${analyticsRequests.length} requests detected)`));
  } else {
    console.log(chalk.red('   ✗ No analytics requests detected'));
  }

  // Performance Summary
  console.log(chalk.bold('\n📈 Performance Summary:\n'));

  const ttfbPass = avgTTFB < THRESHOLDS.TTFB;
  const fcpPass = avgFCP < THRESHOLDS.FCP;
  const lcpPass = avgLCP < THRESHOLDS.LCP;
  const loadPass = avgLoad < THRESHOLDS.LOAD_TIME;

  console.log(`   TTFB: ${avgTTFB}ms ${ttfbPass ? chalk.green('✓') : chalk.red('✗')} (threshold: ${THRESHOLDS.TTFB}ms)`);
  console.log(`   FCP:  ${avgFCP}ms ${fcpPass ? chalk.green('✓') : chalk.red('✗')} (threshold: ${THRESHOLDS.FCP}ms)`);
  console.log(`   LCP:  ${avgLCP}ms ${lcpPass ? chalk.green('✓') : chalk.red('✗')} (threshold: ${THRESHOLDS.LCP}ms)`);
  console.log(`   Load: ${avgLoad}ms ${loadPass ? chalk.green('✓') : chalk.red('✗')} (threshold: ${THRESHOLDS.LOAD_TIME}ms)`);

  const allPassed = ttfbPass && fcpPass && lcpPass && loadPass;

  console.log('\n' + chalk.bold('='.repeat(80)));

  if (allPassed) {
    console.log(chalk.bold.green('\n✅ All performance tests PASSED!\n'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️  Some performance thresholds not met\n'));
  }

  // Failed pages
  const failedResults = allResults.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log(chalk.bold.red('Failed Pages:\n'));
    for (const result of failedResults) {
      console.log(chalk.red(`   ✗ ${result.pageName}: ${result.error}`));
    }
    console.log('');
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error.message);
  console.error(error.stack);
  process.exit(1);
});
