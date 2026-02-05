/**
 * Performance Thresholds & SLA Targets
 *
 * Defines acceptable performance criteria for all tests
 */

export const thresholds = {
  // Response time targets (milliseconds)
  responseTime: {
    p50: 200,   // Median response should be under 200ms
    p95: 500,   // 95th percentile under 500ms
    p99: 1000,  // 99th percentile under 1s
    max: 3000   // Absolute max before failure
  },

  // Error rate limits
  errorRate: {
    max: 0.01,       // 1% maximum error rate
    warning: 0.001   // 0.1% warning threshold
  },

  // Throughput requirements
  throughput: {
    min: 100,        // Minimum 100 req/sec capacity
    target: 500,     // Target 500 req/sec
    burst: 1000      // Should handle 1000 req/sec burst
  },

  // Database constraints (D1 Free Tier)
  database: {
    maxWritesPerDay: 1000,    // Hard limit on free tier
    maxQueryTime: 100,        // Query should complete in <100ms
    warningWriteRate: 0.8     // Warn at 80% of daily quota
  },

  // Frontend Web Vitals (Google's "Good" thresholds)
  pageLoad: {
    lcp: 2500,   // Largest Contentful Paint (ms)
    fcp: 1800,   // First Contentful Paint (ms)
    ttfb: 600,   // Time to First Byte (ms)
    fid: 100,    // First Input Delay (ms)
    cls: 0.1     // Cumulative Layout Shift (unitless)
  },

  // Resource size limits
  resources: {
    maxImageSize: 200 * 1024,      // 200KB per image
    maxTotalPageSize: 1024 * 1024, // 1MB total page weight
    maxJSSize: 100 * 1024,         // 100KB JavaScript
    maxCSSSize: 50 * 1024          // 50KB CSS
  },

  // Rate limiting recommendations
  rateLimits: {
    perIP: {
      requests: 10,
      window: 60  // 10 requests per 60 seconds
    },
    perSession: {
      requests: 100,
      window: 60  // 100 requests per 60 seconds
    }
  }
};

export default thresholds;
