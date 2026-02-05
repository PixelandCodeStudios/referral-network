/**
 * Metrics Collector
 *
 * Centralized metrics collection and aggregation for all stress tests
 * Calculates percentiles, error rates, throughput, and custom metrics
 */

import { writeFile } from "fs/promises";
import { join } from "path";

export class MetricsCollector {
  constructor(testName) {
    this.testName = testName;
    this.startTime = Date.now();
    this.endTime = null;

    // Request tracking
    this.requests = {
      total: 0,
      successful: 0,
      failed: 0,
      errorsByCode: {},
    };

    // Latency tracking
    this.latencies = [];

    // Throughput tracking
    this.throughputData = [];
    this.lastThroughputCheck = Date.now();
    this.requestsSinceLastCheck = 0;

    // Database metrics
    this.database = {
      writes: 0,
      writesPerSecond: 0,
      queryTimes: [],
    };

    // Custom metrics
    this.custom = {};
  }

  /**
   * Record a request result
   */
  recordRequest(latency, statusCode = 200, error = null) {
    this.requests.total++;

    if (statusCode >= 200 && statusCode < 300) {
      this.requests.successful++;
    } else {
      this.requests.failed++;
      this.requests.errorsByCode[statusCode] = (this.requests.errorsByCode[statusCode] || 0) + 1;
    }

    if (latency) {
      this.latencies.push(latency);
    }

    this.requestsSinceLastCheck++;

    // Update throughput every second
    const now = Date.now();
    if (now - this.lastThroughputCheck >= 1000) {
      const elapsed = (now - this.lastThroughputCheck) / 1000;
      const rps = this.requestsSinceLastCheck / elapsed;
      this.throughputData.push({
        timestamp: now,
        requestsPerSecond: rps,
      });
      this.requestsSinceLastCheck = 0;
      this.lastThroughputCheck = now;
    }
  }

  /**
   * Record a database write
   */
  recordDatabaseWrite(queryTime = null) {
    this.database.writes++;
    if (queryTime) {
      this.database.queryTimes.push(queryTime);
    }
  }

  /**
   * Record a custom metric
   */
  recordCustom(key, value) {
    if (!this.custom[key]) {
      this.custom[key] = [];
    }
    this.custom[key].push(value);
  }

  /**
   * Calculate percentile from sorted array
   */
  calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Calculate latency statistics
   */
  getLatencyStats() {
    if (this.latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        p999: 0,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / sorted.length,
      median: this.calculatePercentile(sorted, 50),
      p50: this.calculatePercentile(sorted, 50),
      p95: this.calculatePercentile(sorted, 95),
      p99: this.calculatePercentile(sorted, 99),
      p999: this.calculatePercentile(sorted, 99.9),
    };
  }

  /**
   * Calculate error rate
   */
  getErrorRate() {
    if (this.requests.total === 0) return 0;
    return this.requests.failed / this.requests.total;
  }

  /**
   * Calculate success rate
   */
  getSuccessRate() {
    if (this.requests.total === 0) return 0;
    return this.requests.successful / this.requests.total;
  }

  /**
   * Calculate average throughput
   */
  getAverageThroughput() {
    if (this.throughputData.length === 0) return 0;

    const sum = this.throughputData.reduce((acc, val) => acc + val.requestsPerSecond, 0);
    return sum / this.throughputData.length;
  }

  /**
   * Calculate peak throughput
   */
  getPeakThroughput() {
    if (this.throughputData.length === 0) return 0;

    return Math.max(...this.throughputData.map((d) => d.requestsPerSecond));
  }

  /**
   * Get database write rate
   */
  getDatabaseWriteRate() {
    const duration = (this.endTime || Date.now() - this.startTime) / 1000;
    return this.database.writes / duration;
  }

  /**
   * Complete the test and finalize metrics
   */
  complete() {
    this.endTime = Date.now();

    // Final throughput calculation
    const now = Date.now();
    if (this.requestsSinceLastCheck > 0) {
      const elapsed = (now - this.lastThroughputCheck) / 1000;
      const rps = this.requestsSinceLastCheck / elapsed;
      this.throughputData.push({
        timestamp: now,
        requestsPerSecond: rps,
      });
    }

    // Calculate database write rate
    this.database.writesPerSecond = this.getDatabaseWriteRate();
  }

  /**
   * Get complete metrics summary
   */
  getSummary() {
    if (!this.endTime) {
      this.complete();
    }

    const duration = (this.endTime - this.startTime) / 1000;
    const latencyStats = this.getLatencyStats();

    return {
      testName: this.testName,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date(this.endTime).toISOString(),
      duration: {
        seconds: duration,
        minutes: duration / 60,
      },
      requests: {
        ...this.requests,
        requestsPerSecond: this.requests.total / duration,
      },
      latency: latencyStats,
      errorRate: this.getErrorRate(),
      successRate: this.getSuccessRate(),
      throughput: {
        average: this.getAverageThroughput(),
        peak: this.getPeakThroughput(),
        data: this.throughputData,
      },
      database: {
        ...this.database,
        averageQueryTime:
          this.database.queryTimes.length > 0
            ? this.database.queryTimes.reduce((a, b) => a + b, 0) / this.database.queryTimes.length
            : 0,
      },
      custom: this.custom,
    };
  }

  /**
   * Export metrics to JSON file
   */
  async exportJSON(outputPath) {
    const summary = this.getSummary();
    const filename = join(outputPath, `${this.testName}-${Date.now()}.json`);
    await writeFile(filename, JSON.stringify(summary, null, 2));
    return filename;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const summary = this.getSummary();

    console.log("\n" + "=".repeat(60));
    console.log(`Test: ${summary.testName}`);
    console.log("=".repeat(60));
    console.log(`Duration: ${summary.duration.seconds.toFixed(2)}s`);
    console.log(`Total Requests: ${summary.requests.total}`);
    console.log(
      `Successful: ${summary.requests.successful} (${(summary.successRate * 100).toFixed(2)}%)`
    );
    console.log(`Failed: ${summary.requests.failed} (${(summary.errorRate * 100).toFixed(2)}%)`);

    if (Object.keys(summary.requests.errorsByCode).length > 0) {
      console.log("Errors by Status Code:");
      for (const [code, count] of Object.entries(summary.requests.errorsByCode)) {
        console.log(`  ${code}: ${count}`);
      }
    }

    console.log("\nLatency:");
    console.log(`  Min: ${summary.latency.min.toFixed(2)}ms`);
    console.log(`  Mean: ${summary.latency.mean.toFixed(2)}ms`);
    console.log(`  Median: ${summary.latency.median.toFixed(2)}ms`);
    console.log(`  p95: ${summary.latency.p95.toFixed(2)}ms`);
    console.log(`  p99: ${summary.latency.p99.toFixed(2)}ms`);
    console.log(`  Max: ${summary.latency.max.toFixed(2)}ms`);

    console.log("\nThroughput:");
    console.log(`  Average: ${summary.throughput.average.toFixed(2)} req/sec`);
    console.log(`  Peak: ${summary.throughput.peak.toFixed(2)} req/sec`);

    if (summary.database.writes > 0) {
      console.log("\nDatabase:");
      console.log(`  Writes: ${summary.database.writes}`);
      console.log(`  Write Rate: ${summary.database.writesPerSecond.toFixed(2)} writes/sec`);
      if (summary.database.averageQueryTime > 0) {
        console.log(`  Avg Query Time: ${summary.database.averageQueryTime.toFixed(2)}ms`);
      }
    }

    console.log("=".repeat(60) + "\n");
  }

  /**
   * Create a distribution histogram for latencies
   */
  getLatencyDistribution(bucketSize = 50) {
    if (this.latencies.length === 0) return {};

    const distribution = {};
    for (const latency of this.latencies) {
      const bucket = Math.floor(latency / bucketSize) * bucketSize;
      distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    return distribution;
  }
}

export default MetricsCollector;
