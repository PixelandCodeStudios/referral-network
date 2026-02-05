/**
 * Report Generator
 *
 * Generates HTML dashboard reports from test metrics
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load all test results from reports directory
 */
async function loadTestResults() {
  const reportsDir = join(__dirname, '..', 'reports');
  const files = await readdir(reportsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  const results = [];
  for (const file of jsonFiles) {
    const content = await readFile(join(reportsDir, file), 'utf-8');
    results.push(JSON.parse(content));
  }

  return results.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

/**
 * Generate HTML report from test results
 */
function generateHTML(results) {
  const latestResults = results.slice(0, 10); // Show latest 10 tests

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stress Test Report - Referral Network</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      background: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #6e6e73;
      font-size: 18px;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .card-title {
      font-size: 14px;
      color: #6e6e73;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }

    .card-value {
      font-size: 36px;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .card-subtitle {
      font-size: 14px;
      color: #86868b;
    }

    .status-good { color: #34c759; }
    .status-warning { color: #ff9500; }
    .status-bad { color: #ff3b30; }

    .test-results {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 30px;
    }

    .test-results h2 {
      font-size: 24px;
      margin-bottom: 20px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      text-align: left;
      padding: 12px 15px;
      border-bottom: 1px solid #e5e5ea;
    }

    th {
      background: #f5f5f7;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6e6e73;
    }

    tr:hover {
      background: #fafafa;
    }

    .metric {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }

    .metric-good {
      background: #d1f4e0;
      color: #0a6332;
    }

    .metric-warning {
      background: #ffe5d0;
      color: #993800;
    }

    .metric-bad {
      background: #ffd7d5;
      color: #99211c;
    }

    .recommendations {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .recommendations h2 {
      font-size: 24px;
      margin-bottom: 20px;
    }

    .recommendation {
      padding: 20px;
      border-left: 4px solid;
      margin-bottom: 15px;
      background: #fafafa;
      border-radius: 0 8px 8px 0;
    }

    .recommendation.high { border-left-color: #ff3b30; }
    .recommendation.medium { border-left-color: #ff9500; }
    .recommendation.low { border-left-color: #34c759; }

    .recommendation h3 {
      font-size: 18px;
      margin-bottom: 8px;
    }

    .recommendation p {
      color: #6e6e73;
      line-height: 1.6;
    }

    .priority {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 10px;
    }

    .priority.high {
      background: #ffd7d5;
      color: #99211c;
    }

    .priority.medium {
      background: #ffe5d0;
      color: #993800;
    }

    .priority.low {
      background: #d1f4e0;
      color: #0a6332;
    }

    .timestamp {
      color: #86868b;
      font-size: 14px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 Stress Test Dashboard</h1>
      <p class="subtitle">Referral Network Performance Analysis</p>
      <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    </header>

    ${generateSummaryCards(latestResults)}
    ${generateTestResultsTable(latestResults)}
    ${generateRecommendations(latestResults)}
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate summary cards
 */
function generateSummaryCards(results) {
  if (results.length === 0) {
    return '<div class="card"><p>No test results available yet.</p></div>';
  }

  const latest = results[0];
  const avgLatency = latest.latency.mean;
  const successRate = latest.successRate * 100;
  const throughput = latest.throughput.average;

  const latencyStatus = avgLatency < 200 ? 'good' : avgLatency < 500 ? 'warning' : 'bad';
  const successStatus = successRate > 99 ? 'good' : successRate > 95 ? 'warning' : 'bad';

  return `
    <div class="summary-cards">
      <div class="card">
        <div class="card-title">Avg Response Time</div>
        <div class="card-value status-${latencyStatus}">${avgLatency.toFixed(0)}ms</div>
        <div class="card-subtitle">p95: ${latest.latency.p95.toFixed(0)}ms</div>
      </div>

      <div class="card">
        <div class="card-title">Success Rate</div>
        <div class="card-value status-${successStatus}">${successRate.toFixed(1)}%</div>
        <div class="card-subtitle">${latest.requests.successful}/${latest.requests.total} requests</div>
      </div>

      <div class="card">
        <div class="card-title">Throughput</div>
        <div class="card-value">${throughput.toFixed(1)}</div>
        <div class="card-subtitle">req/sec (peak: ${latest.throughput.peak.toFixed(1)})</div>
      </div>

      <div class="card">
        <div class="card-title">Test Duration</div>
        <div class="card-value">${latest.duration.seconds.toFixed(0)}s</div>
        <div class="card-subtitle">${latest.testName}</div>
      </div>
    </div>
  `;
}

/**
 * Generate test results table
 */
function generateTestResultsTable(results) {
  if (results.length === 0) return '';

  const rows = results.map(result => {
    const latencyClass = result.latency.p95 < 500 ? 'good' : result.latency.p95 < 1000 ? 'warning' : 'bad';
    const successClass = result.successRate > 0.99 ? 'good' : result.successRate > 0.95 ? 'warning' : 'bad';

    return `
      <tr>
        <td>${result.testName}</td>
        <td>${new Date(result.startTime).toLocaleString()}</td>
        <td>${result.duration.seconds.toFixed(1)}s</td>
        <td>${result.requests.total}</td>
        <td><span class="metric metric-${successClass}">${(result.successRate * 100).toFixed(1)}%</span></td>
        <td><span class="metric metric-${latencyClass}">${result.latency.p95.toFixed(0)}ms</span></td>
        <td>${result.throughput.average.toFixed(1)} req/s</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="test-results">
      <h2>Test Results</h2>
      <table>
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Run Time</th>
            <th>Duration</th>
            <th>Requests</th>
            <th>Success Rate</th>
            <th>p95 Latency</th>
            <th>Throughput</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Generate recommendations
 */
function generateRecommendations(results) {
  if (results.length === 0) return '';

  const latest = results[0];
  const recommendations = [];

  // Check latency
  if (latest.latency.p95 > 500) {
    recommendations.push({
      priority: 'high',
      title: 'High Response Latency Detected',
      description: `p95 latency is ${latest.latency.p95.toFixed(0)}ms (target: <500ms). This is likely due to synchronous email sending blocking the response. Consider moving email notifications to an async queue.`
    });
  }

  // Check error rate
  if (latest.errorRate > 0.01) {
    recommendations.push({
      priority: 'high',
      title: 'Elevated Error Rate',
      description: `Error rate is ${(latest.errorRate * 100).toFixed(2)}% (target: <1%). Review error logs and implement proper error handling and retry logic.`
    });
  }

  // Check database writes
  if (latest.database.writes > 800) {
    recommendations.push({
      priority: 'medium',
      title: 'Approaching D1 Daily Write Limit',
      description: `Test used ${latest.database.writes} database writes. Free tier limit is 1,000/day. Implement rate limiting to prevent quota exhaustion.`
    });
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      title: 'Performance Within Acceptable Range',
      description: 'All metrics are within target thresholds. Continue monitoring and consider implementing the following optimizations: image compression, font loading optimization, and caching strategy.'
    });
  }

  const recommendationHTML = recommendations.map(rec => `
    <div class="recommendation ${rec.priority}">
      <h3>
        ${rec.title}
        <span class="priority ${rec.priority}">${rec.priority} priority</span>
      </h3>
      <p>${rec.description}</p>
    </div>
  `).join('');

  return `
    <div class="recommendations">
      <h2>Recommendations</h2>
      ${recommendationHTML}
    </div>
  `;
}

/**
 * Main report generation function
 */
export async function generateReport() {
  try {
    const results = await loadTestResults();
    const html = generateHTML(results);

    const outputPath = join(__dirname, '..', 'reports', `dashboard-${Date.now()}.html`);
    await writeFile(outputPath, html);

    console.log(`✅ Report generated: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating report:', error.message);
    throw error;
  }
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport()
    .then(path => console.log(`Report saved to: ${path}`))
    .catch(error => console.error('Failed to generate report:', error));
}

export default { generateReport };
