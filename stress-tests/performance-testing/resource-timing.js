/**
 * Resource Timing & Web Vitals Testing
 *
 * Measures frontend performance using Puppeteer
 * Tests LCP, FCP, TTFB, and resource loading times
 */

import puppeteer from "puppeteer";
import chalk from "chalk";
import { writeFile } from "fs/promises";
import { join } from "path";
import config from "../config/endpoints.js";
import thresholds from "../config/thresholds.js";

const BASE_URL = config.website;

const PAGES_TO_TEST = [
  { name: "Hub (Index)", url: BASE_URL },
  { name: "Brian Dow", url: `${BASE_URL}/brian-dow.html` },
  { name: "Joshua Naylor", url: `${BASE_URL}/joshua-naylor.html` },
  { name: "Tiffany McAlister", url: `${BASE_URL}/tiffany-mcalister.html` },
  { name: "Tom Berry", url: `${BASE_URL}/tom-berry.html` },
];

/**
 * Measure page performance metrics
 */
async function measurePagePerformance(page, url) {
  await page.goto(url, { waitUntil: "networkidle0" });

  // Get performance metrics
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const paint = performance.getEntriesByType("paint");
    const resources = performance.getEntriesByType("resource");

    // Calculate Web Vitals
    const fcp = paint.find((p) => p.name === "first-contentful-paint");

    // Get resource breakdown
    const resourceBreakdown = {};
    let totalSize = 0;

    for (const resource of resources) {
      const type = resource.initiatorType || "other";
      if (!resourceBreakdown[type]) {
        resourceBreakdown[type] = {
          count: 0,
          duration: 0,
          size: resource.transferSize || 0,
        };
      }
      resourceBreakdown[type].count++;
      resourceBreakdown[type].duration += resource.duration;
      resourceBreakdown[type].size += resource.transferSize || 0;
      totalSize += resource.transferSize || 0;
    }

    return {
      ttfb: navigation.responseStart,
      domContentLoaded: navigation.domContentLoadedEventEnd,
      loadComplete: navigation.loadEventEnd,
      fcp: fcp ? fcp.startTime : null,
      resourceCount: resources.length,
      resourceBreakdown,
      totalTransferSize: totalSize,
    };
  });

  // Get LCP using PerformanceObserver (need to inject script)
  const lcp = await page.evaluate(() => {
    return new Promise((resolve) => {
      let lcpValue = 0;
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        lcpValue = lastEntry.renderTime || lastEntry.loadTime;
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });

      // Give it a moment to capture
      setTimeout(() => {
        observer.disconnect();
        resolve(lcpValue);
      }, 100);
    });
  });

  metrics.lcp = lcp;

  return metrics;
}

/**
 * Test a single page
 */
async function testPage(browser, pageInfo) {
  console.log(chalk.blue(`\n📄 Testing: ${pageInfo.name}`));
  console.log(chalk.gray(`   URL: ${pageInfo.url}\n`));

  const page = await browser.newPage();

  try {
    const metrics = await measurePagePerformance(page, pageInfo.url);

    // Evaluate against thresholds
    const results = {
      page: pageInfo.name,
      url: pageInfo.url,
      metrics,
      evaluation: {
        ttfb: metrics.ttfb < thresholds.pageLoad.ttfb ? "good" : "poor",
        fcp: metrics.fcp && metrics.fcp < thresholds.pageLoad.fcp ? "good" : "poor",
        lcp: metrics.lcp < thresholds.pageLoad.lcp ? "good" : "poor",
      },
    };

    // Print results
    console.log(chalk.bold("  Metrics:"));
    console.log(`    TTFB: ${formatMetric(metrics.ttfb, thresholds.pageLoad.ttfb)}ms`);
    console.log(
      `    FCP:  ${metrics.fcp ? formatMetric(metrics.fcp, thresholds.pageLoad.fcp) + "ms" : "N/A"}`
    );
    console.log(`    LCP:  ${formatMetric(metrics.lcp, thresholds.pageLoad.lcp)}ms`);
    console.log(`    Load: ${metrics.loadComplete.toFixed(0)}ms`);
    console.log(`    Size: ${(metrics.totalTransferSize / 1024).toFixed(1)}KB`);
    console.log(`    Resources: ${metrics.resourceCount}`);

    // Resource breakdown
    console.log(chalk.bold("\n  Resource Breakdown:"));
    for (const [type, data] of Object.entries(metrics.resourceBreakdown)) {
      console.log(`    ${type}: ${data.count} (${(data.size / 1024).toFixed(1)}KB)`);
    }

    await page.close();
    return results;
  } catch (error) {
    console.error(chalk.red(`    Error: ${error.message}`));
    await page.close();
    return null;
  }
}

/**
 * Format metric with color coding
 */
function formatMetric(value, threshold) {
  if (value < threshold) {
    return chalk.green(value.toFixed(0));
  } else {
    return chalk.red(value.toFixed(0));
  }
}

/**
 * Generate summary report
 */
function generateSummary(results) {
  console.log(chalk.bold.cyan("\n" + "=".repeat(60)));
  console.log(chalk.bold.cyan("FRONTEND PERFORMANCE SUMMARY"));
  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

  const validResults = results.filter((r) => r !== null);

  // Calculate averages
  const avgTTFB = validResults.reduce((sum, r) => sum + r.metrics.ttfb, 0) / validResults.length;
  const avgFCP =
    validResults.reduce((sum, r) => sum + (r.metrics.fcp || 0), 0) / validResults.length;
  const avgLCP = validResults.reduce((sum, r) => sum + r.metrics.lcp, 0) / validResults.length;
  const avgSize =
    validResults.reduce((sum, r) => sum + r.metrics.totalTransferSize, 0) / validResults.length;

  console.log(chalk.bold("Average Metrics:"));
  console.log(
    `  TTFB: ${formatMetric(avgTTFB, thresholds.pageLoad.ttfb)}ms (target: <${thresholds.pageLoad.ttfb}ms)`
  );
  console.log(
    `  FCP:  ${formatMetric(avgFCP, thresholds.pageLoad.fcp)}ms (target: <${thresholds.pageLoad.fcp}ms)`
  );
  console.log(
    `  LCP:  ${formatMetric(avgLCP, thresholds.pageLoad.lcp)}ms (target: <${thresholds.pageLoad.lcp}ms)`
  );
  console.log(`  Size: ${(avgSize / 1024).toFixed(1)}KB\n`);

  // Issues
  console.log(chalk.bold("Issues Detected:\n"));

  if (avgLCP > thresholds.pageLoad.lcp) {
    console.log(chalk.red("  ⚠️  LCP exceeds threshold"));
    console.log(chalk.yellow("     Likely cause: Large unoptimized images"));
    console.log(chalk.yellow("     Recommendation: Compress images, use WebP, lazy load\n"));
  }

  if (avgFCP > thresholds.pageLoad.fcp) {
    console.log(chalk.red("  ⚠️  FCP exceeds threshold"));
    console.log(chalk.yellow("     Likely cause: Blocking font loading (@import)"));
    console.log(chalk.yellow("     Recommendation: Use <link preload>, font-display: swap\n"));
  }

  if (avgSize > thresholds.resources.maxTotalPageSize) {
    console.log(chalk.red("  ⚠️  Page size exceeds 1MB"));
    console.log(chalk.yellow("     Recommendation: Enable compression, optimize assets\n"));
  }

  // Find slowest page
  const slowest = validResults.reduce((max, r) => (r.metrics.lcp > max.metrics.lcp ? r : max));
  console.log(chalk.bold("Slowest Page:"));
  console.log(`  ${slowest.page}: ${slowest.metrics.lcp.toFixed(0)}ms LCP\n`);

  console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

  return {
    averages: {
      ttfb: avgTTFB,
      fcp: avgFCP,
      lcp: avgLCP,
      size: avgSize,
    },
    slowest: slowest.page,
  };
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan("\n🎨 Frontend Performance Testing\n"));
  console.log(`Testing site: ${chalk.yellow(BASE_URL)}\n`);
  console.log(chalk.gray("Measuring Web Vitals (TTFB, FCP, LCP) and resource loading...\n"));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];

  try {
    for (const pageInfo of PAGES_TO_TEST) {
      const result = await testPage(browser, pageInfo);
      if (result) {
        results.push(result);
      }
    }

    // Generate summary
    const summary = generateSummary(results);

    // Export results
    const outputPath = join(process.cwd(), "reports", `frontend-performance-${Date.now()}.json`);
    await writeFile(outputPath, JSON.stringify({ results, summary }, null, 2));
    console.log(chalk.green(`✓ Results saved: ${outputPath}\n`));

    console.log(chalk.bold.green("✅ Frontend performance testing completed!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { measurePagePerformance, testPage };
