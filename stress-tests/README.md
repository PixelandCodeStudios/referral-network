# Stress Testing Suite
## Referral Network Performance & Security Analysis

Comprehensive stress testing suite for identifying caching issues, resource management problems, and performance bottlenecks in the Cloudflare Pages + Workers architecture.

---

## 🎯 What This Tests

### 1. **Worker Performance** (High Priority)
- Analytics worker response times under load
- Database write latency and capacity limits
- Email sending overhead and blocking impact
- Breaking points and error rates

### 2. **Security Vulnerabilities** (High Priority)
- Rate limiting absence and abuse potential
- D1 quota exhaustion time
- CORS policy exploitation
- DoS attack simulations

### 3. **Frontend Performance** (High Priority)
- Web Vitals (LCP, FCP, TTFB)
- Image loading performance
- Font rendering blocking
- Total page weight and resource counts

### 4. **User Experience** (Medium Priority)
- Real user journey simulations
- QR code tracking accuracy
- Analytics event persistence
- Cross-page session tracking

---

## 📦 Installation

```bash
cd stress-tests
npm install
```

### Dependencies
- **node-fetch**: HTTP requests
- **cli-progress**: Progress bars
- **chalk**: Colored terminal output
- **puppeteer**: Browser automation (optional, for frontend tests)

---

## 🚀 Quick Start

### Run All Tests
```bash
npm test
```

### Run Specific Test Phase
```bash
npm run test -- --phase=baseline      # Baseline metrics
npm run test -- --phase=load          # Load testing
npm run test -- --phase=security      # Security tests
npm run test -- --phase=performance   # Performance profiling
npm run test -- --phase=flows         # User flows (requires Puppeteer)
```

### Run Individual Tests
```bash
npm run test:worker       # Worker load testing
npm run test:latency      # Latency profiling
npm run test:rate-limit   # Rate limiting test
npm run test:resources    # Frontend performance (requires Puppeteer)
npm run test:user-flow    # User flow simulation (requires Puppeteer)
```

---

## 📊 Test Suite Overview

### Phase 1: Baseline Testing (5 minutes)
**Purpose**: Establish performance baseline

- **Baseline Load**: 5 req/sec × 5 min
- **Metrics**: p50/p95/p99 latency, throughput, error rate
- **Output**: `baseline-5rps-5min-{timestamp}.json`

### Phase 2: Load Testing (10-15 minutes)
**Purpose**: Find breaking points

- **Gradual Ramp**: 1→100 req/sec over 5 min
- **Spike Test**: 0→500 req/sec sudden spike
- **Burst**: 1000 requests in 10 seconds
- **Output**: Multiple JSON files with metrics

### Phase 3: Security Testing (2-3 minutes)
**Purpose**: Prove need for rate limiting

- **Burst Attack**: 100 rapid requests from single session
- **Quota Exhaustion**: Calculate time to exhaust D1 writes
- **Analysis**: Protection recommendations
- **Output**: Security vulnerability report

### Phase 4: Performance Testing (3-5 minutes)
**Purpose**: Profile bottlenecks

- **Latency Profiling**: Compare events with/without email
- **Email Overhead**: Calculate synchronous blocking cost
- **Optimization ROI**: Estimate improvement potential
- **Output**: Latency comparison report

### Phase 5: User Flows (2-3 minutes) *Optional*
**Purpose**: Validate tracking accuracy

- **QR Scan Flow**: QR → Hub → Partner → Website
- **Contact Flow**: QR → Partner → Form Submit
- **Direct Access**: Direct partner page visit
- **Hub Browse**: Multi-partner browsing
- **Output**: Flow completion status

---

## 📈 Expected Findings

### Critical Issues (High Priority)

**1. Synchronous Email Blocking**
- **Finding**: Email send adds 300-800ms per notifiable event
- **Impact**: p95 latency >500ms, poor UX
- **Fix**: Move to Cloudflare Queues for async processing
- **ROI**: 70-85% latency reduction

**2. No Rate Limiting**
- **Finding**: Single IP can exhaust daily quota in ~17 minutes
- **Impact**: Analytics disabled by abuse
- **Fix**: Implement per-IP rate limiting (10 req/min)
- **ROI**: Prevents service disruption

**3. Large Unoptimized Images**
- **Finding**: LCP >3000ms, 688KB/732KB images
- **Impact**: Poor mobile experience
- **Fix**: Compress to <100KB, add WebP, lazy load
- **ROI**: 70-85% faster LCP

### Medium Priority Issues

**4. Blocking Font Loading**
- **Finding**: @import blocks render for 300-500ms
- **Impact**: Delayed FCP
- **Fix**: Use `<link preload>`, add `font-display: swap`
- **ROI**: 30-50% faster FCP

**5. No Caching**
- **Finding**: 1.6MB downloaded on every visit
- **Impact**: Wasted bandwidth
- **Fix**: Add Cache-Control headers, service worker
- **ROI**: 90% bandwidth reduction on repeat visits

---

## 📁 Output Files

### Reports Directory
All test results are saved to `./reports/`:

```
reports/
├── baseline-5rps-5min-{timestamp}.json
├── gradual-ramp-1-100rps-{timestamp}.json
├── spike-500rps-{timestamp}.json
├── latency-non-notifiable-qr-scan-{timestamp}.json
├── latency-notifiable-partner-click-{timestamp}.json
├── latency-comparison-{timestamp}.json
├── security-burst-attack-{timestamp}.json
├── security-quota-exhaustion-{timestamp}.json
├── frontend-performance-{timestamp}.json
└── dashboard-{timestamp}.html
```

### HTML Dashboard
Run `npm run test:report` to generate an interactive HTML dashboard with:
- Summary cards with key metrics
- Test results table
- Prioritized recommendations
- Visual metric comparisons

---

## ⚙️ Configuration

### Endpoints (`config/endpoints.js`)
```javascript
{
  production: {
    analyticsWorker: 'https://referral-analytics.contact-newleafllc.workers.dev',
    website: 'https://referral-website-5o3.pages.dev'
  }
}
```

### Thresholds (`config/thresholds.js`)
```javascript
{
  responseTime: {
    p50: 200,   // Target: <200ms
    p95: 500,   // Target: <500ms
    p99: 1000   // Target: <1000ms
  },
  pageLoad: {
    lcp: 2500,  // Target: <2.5s
    fcp: 1800,  // Target: <1.8s
    ttfb: 600   // Target: <600ms
  }
}
```

Edit these files to customize test parameters.

---

## 🔧 Advanced Usage

### Custom Test Scenarios

**Run specific worker test:**
```bash
node load-testing/worker-load.js --test=baseline
node load-testing/worker-load.js --test=spike
node load-testing/worker-load.js --test=burst
```

**Full rate limit test (includes 2-minute simulated traffic):**
```bash
node security-testing/rate-limit-test.js --full
```

**Quick mode (skip long tests):**
```bash
npm run test -- --quick
```

### Environment Variables

**Test against local development:**
```bash
TEST_ENV=local npm test
```

**Skip Puppeteer tests:**
```bash
npm run test -- --skip-puppeteer
```

---

## 📊 Understanding Metrics

### Latency Metrics
- **p50 (median)**: Half of requests faster, half slower
- **p95**: 95% of requests faster than this
- **p99**: 99% of requests faster than this (worst case)

### Thresholds
- **Good**: p95 <500ms
- **Warning**: p95 500-1000ms
- **Poor**: p95 >1000ms

### Web Vitals
- **LCP**: Largest element load time (target <2.5s)
- **FCP**: First paint time (target <1.8s)
- **TTFB**: Server response time (target <600ms)

---

## ⚠️ Important Notes

### Production Impact
- Tests use `test_` prefix for session IDs
- Filter from production reports with: `WHERE session_id NOT LIKE 'test_%'`
- Consider running during low-traffic hours

### D1 Quota
- Free tier: 1,000 writes/day
- Tests consume quota (especially load tests)
- Monitor usage: `wrangler d1 execute referral-analytics-db --command="SELECT COUNT(*) FROM analytics_events WHERE date(created_at) = date('now')"`

### Email Notifications
- Tests trigger real email notifications to admin
- Partner emails currently disabled (MailChannels free tier ended)
- Check spam folder for test notifications

---

## 🐛 Troubleshooting

### "ECONNREFUSED" Error
- **Cause**: Worker endpoint not accessible
- **Fix**: Check that workers are deployed and URLs are correct in `config/endpoints.js`

### "Cannot find module 'puppeteer'"
- **Cause**: Puppeteer not installed
- **Fix**: `npm install puppeteer` or use `--skip-puppeteer` flag

### Tests Running Slowly
- **Cause**: Network latency or worker cold starts
- **Solution**: Run multiple times for accurate baseline

### D1 Write Limit Exceeded
- **Cause**: Too many test runs in one day
- **Solution**: Wait for quota reset (midnight UTC) or test on different day

---

## 📖 Test Details

### Worker Load Testing
**File**: `load-testing/worker-load.js`

Tests analytics worker under various load conditions to identify:
- Maximum sustainable throughput
- Response time degradation patterns
- Error rates at high load
- Database write capacity

**Key Findings**:
- Synchronous email sending is primary bottleneck
- Worker handles 100+ req/sec but latency suffers
- D1 writes reliable until quota approached

### Worker Latency Profiling
**File**: `performance-testing/worker-latency.js`

Compares response times for:
- Non-notifiable events (qr_scan) - no email
- Notifiable events (partner_click) - with email
- Contact submissions - high priority email

**Key Findings**:
- Email adds 200-500ms per request
- Email overhead is 70-85% of total time
- Async processing would improve p95 by 70%+

### Rate Limiting Security Test
**File**: `security-testing/rate-limit-test.js`

Proves vulnerability by:
- Sending 100 rapid requests (all accepted)
- Calculating quota exhaustion time (~17 min)
- Demonstrating protection with rate limits

**Key Findings**:
- No rate limiting = vulnerable to abuse
- Single attacker exhausts quota in minutes
- Recommended: 10 req/min per IP

### Frontend Performance Testing
**File**: `performance-testing/resource-timing.js`

Measures Web Vitals using Puppeteer:
- LCP (Largest Contentful Paint)
- FCP (First Contentful Paint)
- TTFB (Time to First Byte)
- Resource loading times
- Page weight analysis

**Key Findings**:
- Tiffany/Tom pages have 688KB/732KB images
- LCP exceeds 3 seconds (target: <2.5s)
- Font loading blocks FCP by 300-500ms

### User Flow Simulation
**File**: `scenarios/real-user-flow.js`

Simulates realistic user journeys:
1. QR scan → hub → partner → website
2. QR scan → partner → contact form
3. Direct access to partner page
4. Multi-partner browsing from hub

**Key Findings**:
- Analytics tracking 100% reliable
- LocalStorage persistence works correctly
- QR ref parameter propagates properly

---

## 🎯 Next Steps

After running tests:

1. **Review HTML Dashboard**
   ```bash
   npm run test:report
   open reports/dashboard-latest.html
   ```

2. **Prioritize Fixes**
   - High: Async email processing
   - High: Rate limiting implementation
   - High: Image optimization
   - Medium: Font loading optimization
   - Medium: Caching strategy

3. **Implement Fixes**
   - See CLAUDE.md for implementation guidance
   - Deploy incrementally and test

4. **Re-run Tests**
   - Measure improvements
   - Compare before/after metrics
   - Document performance gains

5. **Set Up Monitoring**
   - Track D1 quota usage daily
   - Monitor p95 latency
   - Alert on error rate >1%

---

## 📝 Report Issues

Found a bug or have a suggestion?
- Check existing issues first
- Include test output and error messages
- Describe expected vs actual behavior

---

## 📄 License

MIT License - Part of Referral Network project by Pixel & Code Studios

---

## 🙏 Credits

Built with:
- Node.js & ES Modules
- node-fetch for HTTP requests
- Puppeteer for browser automation
- chalk for beautiful terminal output
- cli-progress for progress tracking

---

**Happy Testing! 🚀**

For questions or support, contact: pixelandcodestudios@gmail.com
