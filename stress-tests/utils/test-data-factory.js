/**
 * Test Data Factory
 *
 * Generates realistic analytics event payloads for stress testing
 */

const PARTNERS = ["brian-dow", "joshua-naylor", "tiffany-mcalister", "tom-berry"];
const EVENT_TYPES = [
  "qr_scan",
  "partner_click",
  "partner_page_view_from_hub",
  "contact_submit",
  "external_site_click",
];
const QR_CODES = [
  "qr-office-001",
  "qr-office-002",
  "qr-event-conference2024",
  "qr-partner-brian",
  "qr-partner-joshua",
  "qr-partner-tiffany",
  "qr-partner-tom",
  "qr-networking-event-01",
  "qr-business-card-001",
];

const USER_AGENTS = [
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

const PATHNAMES = [
  "/",
  "/brian-dow.html",
  "/joshua-naylor.html",
  "/tiffany-mcalister.html",
  "/tom-berry.html",
];

/**
 * Generate a unique session ID
 */
export function generateSessionId() {
  return `test_sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a random QR code reference
 */
export function generateQRCode() {
  return QR_CODES[Math.floor(Math.random() * QR_CODES.length)];
}

/**
 * Get a random partner ID
 */
export function getRandomPartner() {
  return PARTNERS[Math.floor(Math.random() * PARTNERS.length)];
}

/**
 * Get a random event type
 */
export function getRandomEventType() {
  return EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
}

/**
 * Get a random user agent
 */
export function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Generate a complete analytics event payload
 *
 * @param {Object} options - Event customization options
 * @param {string} options.event - Event type (default: random)
 * @param {string} options.partnerId - Partner ID (default: random)
 * @param {string} options.referrerId - QR code reference (default: random)
 * @param {string} options.sessionId - Session ID (default: generated)
 * @returns {Object} Complete event payload matching client format
 */
export function generateEvent(options = {}) {
  const eventType = options.event || getRandomEventType();
  const sessionId = options.sessionId || generateSessionId();
  const partnerId = options.partnerId || getRandomPartner();
  const referrerId =
    options.referrerId !== undefined
      ? options.referrerId
      : Math.random() > 0.5
        ? generateQRCode()
        : null;

  // Base event structure matching analytics.js
  const event = {
    event: eventType,
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    referrer_id: referrerId,
    url: `https://referral-website-5o3.pages.dev${PATHNAMES[Math.floor(Math.random() * PATHNAMES.length)]}`,
    pathname: PATHNAMES[Math.floor(Math.random() * PATHNAMES.length)],
    user_agent: getRandomUserAgent(),
    viewport: {
      width: Math.random() > 0.5 ? 1920 : 390,
      height: Math.random() > 0.5 ? 1080 : 844,
    },
  };

  // Add event-specific data
  switch (eventType) {
    case "partner_click":
    case "partner_page_view_from_hub":
    case "partner_page_view_direct":
    case "external_site_click":
      event.partner_id = partnerId;
      break;

    case "contact_submit":
      event.partner_id = partnerId;
      event.form_data = {
        name: "Test User",
        email: "test@example.com",
        phone: "555-0100",
        message: "This is a test submission from stress testing",
      };
      break;

    case "qr_scan":
      // QR scans don't have partner_id yet
      break;
  }

  return event;
}

/**
 * Generate a batch of events
 *
 * @param {number} count - Number of events to generate
 * @param {Object} options - Options for all events
 * @returns {Array} Array of event payloads
 */
export function generateEventBatch(count, options = {}) {
  const events = [];
  const sessionId = options.sessionId || generateSessionId();
  const referrerId = options.referrerId || (Math.random() > 0.5 ? generateQRCode() : null);

  for (let i = 0; i < count; i++) {
    events.push(
      generateEvent({
        ...options,
        sessionId,
        referrerId,
      })
    );
  }

  return events;
}

/**
 * Generate a realistic user session flow
 *
 * @returns {Array} Array of events representing a typical user session
 */
export function generateUserSession() {
  const sessionId = generateSessionId();
  const referrerId = Math.random() > 0.3 ? generateQRCode() : null;
  const partnerId = getRandomPartner();
  const events = [];

  // 1. QR scan (if came from QR code)
  if (referrerId) {
    events.push(
      generateEvent({
        event: "qr_scan",
        sessionId,
        referrerId,
        partnerId: null,
      })
    );
  }

  // 2. Partner click (from hub)
  events.push(
    generateEvent({
      event: "partner_click",
      sessionId,
      referrerId,
      partnerId,
    })
  );

  // 3. Partner page view
  events.push(
    generateEvent({
      event: "partner_page_view_from_hub",
      sessionId,
      referrerId,
      partnerId,
    })
  );

  // 4. Maybe external site click (70% probability)
  if (Math.random() > 0.3) {
    events.push(
      generateEvent({
        event: "external_site_click",
        sessionId,
        referrerId,
        partnerId,
      })
    );
  }

  // 5. Maybe contact submit (20% probability)
  if (Math.random() > 0.8) {
    events.push(
      generateEvent({
        event: "contact_submit",
        sessionId,
        referrerId,
        partnerId,
      })
    );
  }

  return events;
}

/**
 * Generate events for a specific test scenario
 *
 * @param {string} scenario - Scenario name (baseline, spike, sustained, etc.)
 * @param {Object} config - Scenario configuration
 * @returns {Array} Array of events for the scenario
 */
export function generateScenarioEvents(scenario, config) {
  const events = [];

  switch (scenario) {
    case "baseline":
      // Normal traffic: mix of all event types
      for (let i = 0; i < config.totalRequests || 100; i++) {
        events.push(generateEvent());
      }
      break;

    case "spike":
      // Sudden spike: mostly partner clicks
      for (let i = 0; i < config.totalRequests || 1000; i++) {
        events.push(
          generateEvent({
            event: "partner_click",
          })
        );
      }
      break;

    case "sustained":
      // Long-running: complete user sessions
      const sessionCount = config.totalRequests || 500;
      for (let i = 0; i < sessionCount; i++) {
        events.push(...generateUserSession());
      }
      break;

    case "rateLimitTest":
      // Abuse simulation: same session, same IP
      const abusiveSessionId = generateSessionId();
      for (let i = 0; i < config.totalRequests || 10000; i++) {
        events.push(
          generateEvent({
            sessionId: abusiveSessionId,
            referrerId: "qr-abuse-test",
          })
        );
      }
      break;

    default:
      // Default: random events
      for (let i = 0; i < config.totalRequests || 100; i++) {
        events.push(generateEvent());
      }
  }

  return events;
}

export default {
  generateSessionId,
  generateQRCode,
  getRandomPartner,
  getRandomEventType,
  getRandomUserAgent,
  generateEvent,
  generateEventBatch,
  generateUserSession,
  generateScenarioEvents,
};
