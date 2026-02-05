/*
  ═══════════════════════════════════════════════════════════════
  ANALYTICS & CONTEXT MANAGEMENT
  ═══════════════════════════════════════════════════════════════

  Purpose: First-party, privacy-respecting analytics via Cloudflare Workers

  This script handles:
  1. QR referral attribution (reading ?ref= parameter)
  2. Context preservation across navigation
  3. Event tracking hook points
  4. Hub-to-partner flow validation

  NO THIRD-PARTY SERVICES
  All analytics are first-party and will be sent to your own Cloudflare Worker endpoint.

  FUTURE IMPLEMENTATION:
  - Create a Cloudflare Worker at /api/analytics
  - Store events in Cloudflare D1 (SQL) or KV (key-value)
  - Build a simple dashboard to view insights
*/

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ANALYTICS_CONFIG = {
  // Cloudflare Worker endpoint - LIVE AND ACTIVE!
  endpoint: "https://referral-analytics.contact-newleafllc.workers.dev",

  // Analytics enabled - real-time notifications active!
  enabled: true,

  // Storage keys for localStorage
  storageKeys: {
    referrerId: "ref_id",
    sessionId: "session_id",
    firstVisit: "first_visit",
  },

  // Event types tracked
  events: {
    QR_SCAN: "qr_scan",
    PARTNER_CLICK: "partner_click",
    PARTNER_VIEW_HUB: "partner_page_view_from_hub",
    PARTNER_VIEW_DIRECT: "partner_page_view_direct",
    CONTACT_SUBMIT: "contact_submit",
    EXTERNAL_SITE_CLICK: "external_site_click",
    PHONE_CLICK: "phone_click",
    EMAIL_CLICK: "email_click",
  },
};

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get URL parameter by name
 */
function getURLParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

/**
 * Generate a simple session ID
 * In production, consider using crypto.randomUUID()
 */
function generateSessionId() {
  return "sess_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

/**
 * Get or create session ID
 */
function getSessionId() {
  let sessionId = localStorage.getItem(ANALYTICS_CONFIG.storageKeys.sessionId);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(ANALYTICS_CONFIG.storageKeys.sessionId, sessionId);
  }
  return sessionId;
}

/**
 * Store referrer ID from QR scan
 */
function storeReferrerId(referrerId) {
  if (referrerId) {
    localStorage.setItem(ANALYTICS_CONFIG.storageKeys.referrerId, referrerId);

    // Also store first visit timestamp if not exists
    if (!localStorage.getItem(ANALYTICS_CONFIG.storageKeys.firstVisit)) {
      localStorage.setItem(ANALYTICS_CONFIG.storageKeys.firstVisit, new Date().toISOString());
    }
  }
}

/**
 * Get stored referrer ID
 */
function getReferrerId() {
  return localStorage.getItem(ANALYTICS_CONFIG.storageKeys.referrerId) || null;
}

// ═══════════════════════════════════════════════════════════════
// ANALYTICS EVENT TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Send analytics event to Cloudflare Worker
 *
 * FUTURE IMPLEMENTATION:
 * This function will POST to your Cloudflare Worker endpoint.
 * The Worker will validate, enrich, and store the event.
 *
 * @param {string} eventType - Type of event (from ANALYTICS_CONFIG.events)
 * @param {object} eventData - Additional event-specific data
 */
async function trackEvent(eventType, eventData = {}) {
  // Construct event payload
  const payload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    session_id: getSessionId(),
    referrer_id: getReferrerId(),
    url: window.location.href,
    pathname: window.location.pathname,
    user_agent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    ...eventData,
  };

  // LOG to console for development/debugging
  console.log("[Analytics]", eventType, payload);

  // Send to Cloudflare Worker if enabled
  if (ANALYTICS_CONFIG.enabled) {
    try {
      await fetch(ANALYTICS_CONFIG.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // Don't wait for response to avoid blocking UI
        keepalive: true,
      });
    } catch (error) {
      console.error("[Analytics] Failed to send event:", error);
      // Silently fail - don't disrupt user experience
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// QR SCAN ATTRIBUTION
// ═══════════════════════════════════════════════════════════════

/**
 * Check for QR referral parameter and track initial scan
 *
 * HOOK POINT: qr_scan event
 * Fires when: User visits hub with ?ref= parameter
 * Purpose: Track which QR codes/referrers are driving traffic
 */
function initQRAttribution() {
  const refParam = getURLParameter("ref");

  if (refParam) {
    // Store the referrer ID
    storeReferrerId(refParam);

    // Track QR scan event
    trackEvent(ANALYTICS_CONFIG.events.QR_SCAN, {
      referrer_id: refParam,
      landing_page: window.location.pathname,
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// PARTNER CARD CLICK TRACKING (Hub Page)
// ═══════════════════════════════════════════════════════════════

/**
 * Track partner card clicks on the referral hub
 *
 * HOOK POINT: partner_click event
 * Fires when: User clicks a partner card on index.html
 * Purpose: Understand which partners get the most interest
 */
function initPartnerClickTracking() {
  // Find all partner cards
  const partnerCards = document.querySelectorAll(".partner-card");

  partnerCards.forEach((card) => {
    card.addEventListener("click", (_e) => {
      const partnerId = card.getAttribute("data-partner-id");
      const referrerId = getReferrerId();

      // Update card's data attribute for context preservation
      if (referrerId) {
        card.setAttribute("data-referrer-id", referrerId);
      }

      // Track click event
      trackEvent(ANALYTICS_CONFIG.events.PARTNER_CLICK, {
        partner_id: partnerId,
        referrer_id: referrerId,
        destination: card.getAttribute("href"),
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PARTNER PAGE VIEW TRACKING (Partner Page)
// ═══════════════════════════════════════════════════════════════

/**
 * Track partner page views with hub-origin context
 *
 * HOOK POINTS:
 * - partner_page_view_from_hub (if ?source=hub)
 * - partner_page_view_direct (if no source)
 *
 * Fires when: Partner page loads
 * Purpose: Validate flow integrity and track partner profile views
 */
function initPartnerPageTracking() {
  // Check if we're on a partner page
  const partnerId = getURLParameter("id");
  if (!partnerId) return;

  const source = getURLParameter("source");
  const referrerId = getReferrerId();

  // Determine event type based on source
  const eventType =
    source === "hub"
      ? ANALYTICS_CONFIG.events.PARTNER_VIEW_HUB
      : ANALYTICS_CONFIG.events.PARTNER_VIEW_DIRECT;

  // Track page view
  trackEvent(eventType, {
    partner_id: partnerId,
    referrer_id: referrerId,
    source: source || "direct",
    has_context: !!referrerId,
  });

  // Update UI based on context
  updatePartnerPageContext(source, referrerId);

  // Populate hidden form fields if contact form exists
  populateContactFormContext(partnerId, referrerId, source);
}

/**
 * Update partner page UI based on hub-origin context
 */
function updatePartnerPageContext(source, referrerId) {
  // Show hub context indicator if accessed from hub
  const contextIndicator = document.getElementById("hub-context-indicator");
  if (contextIndicator) {
    if (source === "hub" && referrerId) {
      contextIndicator.style.display = "block";
      contextIndicator.textContent = "From our curated referral network";
    } else {
      contextIndicator.style.display = "block";
      contextIndicator.textContent = "This profile is part of a trusted referral network";
    }
  }

  // Update back link to preserve ref parameter
  const backLink = document.getElementById("back-to-hub");
  if (backLink && referrerId) {
    const currentHref = backLink.getAttribute("href");
    backLink.setAttribute("href", currentHref + "?ref=" + referrerId);
  }
}

/**
 * Populate contact form hidden fields with context
 */
function populateContactFormContext(partnerId, referrerId, source) {
  // Populate hidden fields for context preservation
  const partnerIdField = document.getElementById("form-partner-id");
  const referrerIdField = document.getElementById("form-referrer-id");
  const sourceField = document.getElementById("form-source");

  if (partnerIdField) partnerIdField.value = partnerId || "";
  if (referrerIdField) referrerIdField.value = referrerId || "";
  if (sourceField) sourceField.value = source || "direct";
}

// ═══════════════════════════════════════════════════════════════
// CONTACT FORM SUBMISSION TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Track contact form submissions
 *
 * HOOK POINT: contact_submit event
 * Fires when: User submits contact form on partner page
 * Purpose: Track conversions and referral effectiveness
 */
function initContactFormTracking() {
  const contactForm = document.getElementById("contact-form");
  if (!contactForm) return;

  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const partnerId = document.getElementById("form-partner-id")?.value;
    const referrerId = document.getElementById("form-referrer-id")?.value;
    const source = document.getElementById("form-source")?.value;

    // Track submission event
    trackEvent(ANALYTICS_CONFIG.events.CONTACT_SUBMIT, {
      partner_id: partnerId,
      referrer_id: referrerId,
      source: source || "direct",
      has_context: !!referrerId,
    });

    // Get form data
    const formData = new FormData(contactForm);
    const data = Object.fromEntries(formData.entries());

    // Add tracking fields
    data.partner_id = partnerId;
    data.referrer_id = referrerId;
    data.source = source || "direct";

    // Disable submit button
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    try {
      const response = await fetch("https://referral-contact-form.contact-newleafllc.workers.dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        // Show success message
        alert("Thank you! Your message has been sent successfully.");
        contactForm.reset();
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      alert(
        "Sorry, there was an error sending your message. Please try again or contact us directly."
      );
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// EXTERNAL WEBSITE CLICK TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Track clicks to partner's external website
 *
 * HOOK POINT: external_site_click event
 * Fires when: User clicks "Visit Website" button
 * Purpose: Track referral effectiveness and outbound traffic
 */
function initExternalSiteTracking() {
  const websiteButton = document.getElementById("visit-website-btn");
  if (!websiteButton) return;

  websiteButton.addEventListener("click", (_e) => {
    const partnerId = websiteButton.getAttribute("data-partner-id");
    const referrerId = getReferrerId();
    const destinationUrl = websiteButton.getAttribute("href");

    // Track outbound click
    trackEvent(ANALYTICS_CONFIG.events.EXTERNAL_SITE_CLICK, {
      partner_id: partnerId,
      referrer_id: referrerId,
      destination_url: destinationUrl,
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// PHONE NUMBER CLICK TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Track phone number clicks
 *
 * HOOK POINT: phone_click event
 * Fires when: User clicks a phone number link
 * Purpose: Track leads attempting to call
 */
function initPhoneTracking() {
  const phoneLinks = document.querySelectorAll('a[href^="tel:"]');

  phoneLinks.forEach((link) => {
    link.addEventListener("click", (_e) => {
      const phoneNumber = link.getAttribute("href").replace("tel:", "");
      const partnerId = link.getAttribute("data-partner-id");
      const referrerId = getReferrerId();

      // Track phone click
      trackEvent(ANALYTICS_CONFIG.events.PHONE_CLICK, {
        partner_id: partnerId,
        referrer_id: referrerId,
        phone_number: phoneNumber,
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// EMAIL CLICK TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Track email clicks
 *
 * HOOK POINT: email_click event
 * Fires when: User clicks an email link
 * Purpose: Track leads attempting to email
 */
function initEmailTracking() {
  const emailLinks = document.querySelectorAll('a[href^="mailto:"]');

  emailLinks.forEach((link) => {
    link.addEventListener("click", (_e) => {
      const email = link.getAttribute("href").replace("mailto:", "").split("?")[0];
      const partnerId = link.getAttribute("data-partner-id");
      const referrerId = getReferrerId();

      // Track email click
      trackEvent(ANALYTICS_CONFIG.events.EMAIL_CLICK, {
        partner_id: partnerId,
        referrer_id: referrerId,
        email: email,
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTEXT PRESERVATION FOR NAVIGATION
// ═══════════════════════════════════════════════════════════════

/**
 * Add referrer context to partner card links
 * This ensures ?ref= and ?source=hub are preserved when navigating
 */
function preserveNavigationContext() {
  const referrerId = getReferrerId();
  if (!referrerId) return;

  // Add ref and source parameters to all partner card links
  const partnerCards = document.querySelectorAll(".partner-card");
  partnerCards.forEach((card) => {
    const href = card.getAttribute("href");
    if (href && !href.includes("ref=")) {
      const separator = href.includes("?") ? "&" : "?";
      card.setAttribute("href", href + separator + "ref=" + referrerId + "&source=hub");
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Initialize all analytics tracking on page load
 */
function initAnalytics() {
  console.log("[Analytics] Initializing...");

  // Initialize QR attribution (hub page)
  initQRAttribution();

  // Initialize partner click tracking (hub page)
  initPartnerClickTracking();

  // Initialize partner page tracking (partner page)
  initPartnerPageTracking();

  // Initialize contact form tracking (partner page)
  initContactFormTracking();

  // Initialize external site tracking (partner page)
  initExternalSiteTracking();

  // Initialize phone click tracking (partner page)
  initPhoneTracking();

  // Initialize email click tracking (partner page)
  initEmailTracking();

  // Preserve context in navigation links
  preserveNavigationContext();

  console.log("[Analytics] Initialized", {
    session_id: getSessionId(),
    referrer_id: getReferrerId(),
  });
}

// Run on DOMContentLoaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAnalytics);
} else {
  initAnalytics();
}

// ═══════════════════════════════════════════════════════════════
// FUTURE: CLOUDFLARE WORKER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

/*
  CLOUDFLARE WORKER ENDPOINT: /api/analytics
  ============================================

  When you're ready to implement the backend, create a Cloudflare Worker:

  export default {
    async fetch(request, env) {
      // Only accept POST requests
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      // Parse event payload
      const event = await request.json();

      // Validate event structure
      if (!event.event || !event.timestamp) {
        return new Response('Invalid event', { status: 400 });
      }

      // Enrich with server-side data
      const enrichedEvent = {
        ...event,
        ip: request.headers.get('CF-Connecting-IP'),
        country: request.headers.get('CF-IPCountry'),
        received_at: new Date().toISOString()
      };

      // Store in Cloudflare D1 (SQL database)
      await env.DB.prepare(`
        INSERT INTO analytics_events (
          event_type, session_id, referrer_id, partner_id,
          timestamp, url, data
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        enrichedEvent.event,
        enrichedEvent.session_id,
        enrichedEvent.referrer_id,
        enrichedEvent.partner_id || null,
        enrichedEvent.timestamp,
        enrichedEvent.url,
        JSON.stringify(enrichedEvent)
      ).run();

      return new Response('OK', { status: 200 });
    }
  };

  DATABASE SCHEMA:
  ================

  CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    referrer_id TEXT,
    partner_id TEXT,
    timestamp TEXT NOT NULL,
    url TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX idx_event_type ON analytics_events(event_type);
  CREATE INDEX idx_referrer_id ON analytics_events(referrer_id);
  CREATE INDEX idx_partner_id ON analytics_events(partner_id);
  CREATE INDEX idx_timestamp ON analytics_events(timestamp);

  EXAMPLE QUERIES:
  ================

  -- Which partners get the most clicks?
  SELECT partner_id, COUNT(*) as clicks
  FROM analytics_events
  WHERE event_type = 'partner_click'
  GROUP BY partner_id
  ORDER BY clicks DESC;

  -- Which QR codes/referrers drive the most traffic?
  SELECT referrer_id, COUNT(DISTINCT session_id) as unique_visitors
  FROM analytics_events
  WHERE event_type = 'qr_scan'
  GROUP BY referrer_id
  ORDER BY unique_visitors DESC;

  -- Conversion funnel: Hub view -> Partner view -> Contact submit
  SELECT
    referrer_id,
    COUNT(CASE WHEN event_type = 'qr_scan' THEN 1 END) as scans,
    COUNT(CASE WHEN event_type = 'partner_click' THEN 1 END) as clicks,
    COUNT(CASE WHEN event_type = 'contact_submit' THEN 1 END) as conversions
  FROM analytics_events
  GROUP BY referrer_id;
*/
