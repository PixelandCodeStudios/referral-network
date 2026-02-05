/**
 * Website Load Test (Fetch-based)
 *
 * Tests all website pages for:
 * - Response times
 * - HTTP status codes
 * - Content delivery
 * - Concurrent load handling
 */

import fetch from "node-fetch";
import chalk from "chalk";

const BASE_URL = "https://referral-website-53j.pages.dev";

const PAGES = [
  { path: "/", name: "Homepage" },
  { path: "/brian-dow.html", name: "Brian Dow" },
  { path: "/joshua-naylor.html", name: "Joshua Naylor" },
  { path: "/tiffany-mcalister.html", name: "Tiffany McAlister" },
  { path: "/tom-berry.html", name: "Tom Berry" },
  { path: "/jordan-clay.html", name: "Jordan Clay" },
  { path: "/styles.css", name: "Styles CSS" },
  { path: "/analytics.js", name: "Analytics JS" },
];

const IMAGES = [
  "/images/tiffany-mcalister.jpg",
  "/images/tom-berry.jpg",
  "/images/brian-dow.jpg",
  "/images/joshua-naylor.jpg",
  "/images/jordan-clay.jpg",
];

/**
 * Test single page load
 */
async function testPageLoad(url, name) {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Website-Stress-Test/1.0",
      },
    });

    const loadTime = Date.now() - startTime;
    const contentLength = parseInt(response.headers.get("content-length") || "0");
    const contentType = response.headers.get("content-type");

    return {
      success: response.ok,
      name,
      url,
      status: response.status,
      loadTime,
      size: Math.round(contentLength / 1024), // KB
      contentType,
      cached: response.headers.get("cf-cache-status") === "HIT",
    };
  } catch (error) {
    return {
      success: false,
      name,
      url,
      error: error.message,
    };
  }
}

/**
 * Test concurrent requests
 */
async function testConcurrentLoad(url, concurrent = 20, totalRequests = 100) {
  console.log(
    chalk.blue(`\n🔄 Testing ${totalRequests} requests with ${concurrent} concurrent...`)
  );

  const results = [];
  const startTime = Date.now();

  // Batch requests in groups of 'concurrent'
  for (let i = 0; i < totalRequests; i += concurrent) {
    const batch = [];
    const batchSize = Math.min(concurrent, totalRequests - i);

    for (let j = 0; j < batchSize; j++) {
      batch.push(
        (async () => {
          const reqStart = Date.now();
          try {
            const response = await fetch(url);
            return {
              success: response.ok,
              latency: Date.now() - reqStart,
              status: response.status,
            };
          } catch (error) {
            return {
              success: false,
              latency: Date.now() - reqStart,
              error: error.message,
            };
          }
        })()
      );
    }

    const batchResults = await Promise.all(batch);
    results.push(...batchResults);

    // Progress indicator
    const progress = Math.round(((i + batchSize) / totalRequests) * 100);
    process.stdout.write(
      `\r${chalk.gray(`Progress: ${progress}% (${i + batchSize}/${totalRequests})`)}`
    );
  }

  console.log(""); // New line after progress

  const totalTime = Date.now() - startTime;
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const latencies = results
    .filter((r) => r.success)
    .map((r) => r.latency)
    .sort((a, b) => a - b);

  return {
    totalRequests,
    concurrent,
    successful,
    failed,
    totalTime,
    throughput: (successful / (totalTime / 1000)).toFixed(2),
    latency: {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      mean: Math.round(latencies.reduce((sum, l) => sum + l, 0) / latencies.length),
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.floor(latencies.length * 0.99)],
    },
  };
}

/**
 * Test image sizes (verify optimization)
 */
async function testImageSizes() {
  console.log(chalk.blue("\n🖼️  Checking image sizes...\n"));

  const results = [];

  for (const imagePath of IMAGES) {
    const url = `${BASE_URL}${imagePath}`;
    process.stdout.write(chalk.gray(`Checking ${imagePath}...`));

    try {
      const response = await fetch(url, { method: "HEAD" });
      const size = parseInt(response.headers.get("content-length") || "0");
      const sizeKB = Math.round(size / 1024);

      results.push({
        success: true,
        path: imagePath,
        sizeKB,
        status: response.status,
      });

      // Check if optimized (under 200KB is good)
      if (sizeKB < 200) {
        console.log(chalk.green(` ✓ ${sizeKB}KB (optimized)`));
      } else {
        console.log(chalk.yellow(` ⚠️  ${sizeKB}KB (could be smaller)`));
      }
    } catch (error) {
      console.log(chalk.red(` ✗ ${error.message}`));
      results.push({
        success: false,
        path: imagePath,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Main test runner
 */
async function main() {
  console.log(chalk.bold.cyan("\n🌐 Comprehensive Website Load Test\n"));
  console.log(`Testing: ${chalk.yellow(BASE_URL)}\n`);

  // Test 1: Individual Page Loads
  console.log(chalk.bold("📊 Test 1: Individual Page Performance\n"));

  const pageResults = [];

  for (const page of PAGES) {
    const url = `${BASE_URL}${page.path}`;
    process.stdout.write(chalk.gray(`Testing ${page.name}...`));

    const result = await testPageLoad(url, page.name);
    pageResults.push(result);

    if (result.success) {
      const cached = result.cached ? chalk.blue("[CACHED]") : "";
      console.log(chalk.green(` ✓ ${result.loadTime}ms (${result.size}KB) ${cached}`));
    } else {
      console.log(chalk.red(` ✗ ${result.error}`));
    }
  }

  // Test 2: Image Size Verification
  const imageResults = await testImageSizes();

  // Test 3: Concurrent Load Test
  const concurrentResult = await testConcurrentLoad(`${BASE_URL}/`, 20, 100);

  // Test 4: Spike Test
  console.log(chalk.blue("\n⚡ Test 4: Spike Test (50 concurrent requests)\n"));
  const spikeResult = await testConcurrentLoad(`${BASE_URL}/`, 50, 50);

  // Print Results
  console.log(chalk.bold("\n" + "=".repeat(80)));
  console.log(chalk.bold.cyan("LOAD TEST RESULTS"));
  console.log(chalk.bold("=".repeat(80) + "\n"));

  // Page Load Results
  console.log(chalk.bold("1. Page Load Times:\n"));

  const successfulPages = pageResults.filter((r) => r.success);
  if (successfulPages.length > 0) {
    console.log(
      chalk.gray("Page".padEnd(30) + "Load Time".padEnd(15) + "Size".padEnd(10) + "Status")
    );
    console.log(chalk.gray("-".repeat(80)));

    for (const result of successfulPages) {
      const loadColor =
        result.loadTime < 500 ? chalk.green : result.loadTime < 1000 ? chalk.yellow : chalk.red;
      console.log(
        result.name.padEnd(30) +
          loadColor(`${result.loadTime}ms`.padEnd(15)) +
          `${result.size}KB`.padEnd(10) +
          result.status
      );
    }

    const avgLoad = Math.round(
      successfulPages.reduce((sum, r) => sum + r.loadTime, 0) / successfulPages.length
    );
    const totalSize = successfulPages.reduce((sum, r) => sum + r.size, 0);

    console.log(chalk.gray("-".repeat(80)));
    console.log(
      chalk.bold(
        `Average`.padEnd(30) +
          `${avgLoad}ms`.padEnd(15) +
          `${Math.round(totalSize / successfulPages.length)}KB`
      )
    );
  }

  // Image Optimization Results
  console.log(chalk.bold("\n2. Image Optimization:\n"));

  const successfulImages = imageResults.filter((r) => r.success);
  const totalImageSize = successfulImages.reduce((sum, r) => sum + r.sizeKB, 0);
  const avgImageSize = Math.round(totalImageSize / successfulImages.length);
  const optimizedCount = successfulImages.filter((r) => r.sizeKB < 200).length;

  console.log(`   Total Images: ${successfulImages.length}`);
  console.log(`   Optimized (<200KB): ${chalk.green(optimizedCount)}/${successfulImages.length}`);
  console.log(`   Average Size: ${avgImageSize}KB`);
  console.log(`   Total Size: ${totalImageSize}KB`);

  // Concurrent Load Results
  console.log(chalk.bold("\n3. Concurrent Load Test (100 requests, 20 concurrent):\n"));
  console.log(`   Total Requests: ${concurrentResult.totalRequests}`);
  console.log(`   Successful: ${chalk.green(concurrentResult.successful)}`);
  console.log(
    `   Failed: ${concurrentResult.failed > 0 ? chalk.red(concurrentResult.failed) : chalk.green(concurrentResult.failed)}`
  );
  console.log(
    `   Success Rate: ${chalk.yellow(((concurrentResult.successful / concurrentResult.totalRequests) * 100).toFixed(1) + "%")}`
  );
  console.log(`   Throughput: ${chalk.yellow(concurrentResult.throughput + " req/sec")}`);
  console.log(`   Total Time: ${chalk.yellow(concurrentResult.totalTime + "ms")}`);
  console.log(`\n   Latency Distribution:`);
  console.log(`     Min:  ${concurrentResult.latency.min}ms`);
  console.log(`     Mean: ${concurrentResult.latency.mean}ms`);
  console.log(`     p50:  ${concurrentResult.latency.p50}ms`);
  console.log(`     p95:  ${concurrentResult.latency.p95}ms`);
  console.log(`     p99:  ${concurrentResult.latency.p99}ms`);
  console.log(`     Max:  ${concurrentResult.latency.max}ms`);

  // Spike Test Results
  console.log(chalk.bold("\n4. Spike Test (50 concurrent requests):\n"));
  console.log(`   Successful: ${chalk.green(spikeResult.successful)}/${spikeResult.totalRequests}`);
  console.log(
    `   Failed: ${spikeResult.failed > 0 ? chalk.red(spikeResult.failed) : chalk.green(spikeResult.failed)}`
  );
  console.log(`   p95 Latency: ${chalk.yellow(spikeResult.latency.p95 + "ms")}`);
  console.log(`   Throughput: ${chalk.yellow(spikeResult.throughput + " req/sec")}`);

  // Summary
  console.log(chalk.bold("\n📈 Performance Summary:\n"));

  const allPagesPassed = successfulPages.length === PAGES.length;
  const avgLatencyGood = concurrentResult.latency.p95 < 1000;
  const spikeHandled = spikeResult.failed === 0;
  const imagesOptimized = optimizedCount === successfulImages.length;

  console.log(`   All Pages Accessible: ${allPagesPassed ? chalk.green("✓") : chalk.red("✗")}`);
  console.log(`   p95 Latency < 1000ms: ${avgLatencyGood ? chalk.green("✓") : chalk.red("✗")}`);
  console.log(`   Spike Test Passed: ${spikeHandled ? chalk.green("✓") : chalk.red("✗")}`);
  console.log(
    `   Images Optimized: ${imagesOptimized ? chalk.green("✓") : chalk.yellow("⚠️  Some images could be smaller")}`
  );

  console.log("\n" + chalk.bold("=".repeat(80)));

  const allTestsPassed = allPagesPassed && avgLatencyGood && spikeHandled;

  if (allTestsPassed) {
    console.log(chalk.bold.green("\n✅ All load tests PASSED!\n"));
  } else {
    console.log(chalk.bold.yellow("\n⚠️  Some tests need attention\n"));
  }
}

main().catch((error) => {
  console.error(chalk.red("\n❌ Test failed:"), error.message);
  process.exit(1);
});
