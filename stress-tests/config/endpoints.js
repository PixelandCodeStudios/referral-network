/**
 * Endpoint Configuration
 *
 * Central configuration for all service endpoints across different environments
 */

export const endpoints = {
  production: {
    analyticsWorker: 'https://referral-analytics.contact-newleafllc.workers.dev',
    weeklyReportWorker: 'https://referral-weekly-report.contact-newleafllc.workers.dev',
    website: 'https://referral-website-5o3.pages.dev',
    partnersPages: {
      brian: 'https://referral-website-5o3.pages.dev/brian-dow.html',
      joshua: 'https://referral-website-5o3.pages.dev/joshua-naylor.html',
      tiffany: 'https://referral-website-5o3.pages.dev/tiffany-mcalister.html',
      tom: 'https://referral-website-5o3.pages.dev/tom-berry.html'
    }
  },

  local: {
    analyticsWorker: 'http://localhost:8787',
    weeklyReportWorker: 'http://localhost:8788',
    website: 'http://localhost:8000',
    partnersPages: {
      brian: 'http://localhost:8000/brian-dow.html',
      joshua: 'http://localhost:8000/joshua-naylor.html',
      tiffany: 'http://localhost:8000/tiffany-mcalister.html',
      tom: 'http://localhost:8000/tom-berry.html'
    }
  }
};

// Default to production for stress testing
export const currentEnvironment = process.env.TEST_ENV || 'production';
export const config = endpoints[currentEnvironment];

export default config;
