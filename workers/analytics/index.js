/**
 * Cloudflare Worker - Analytics Event Handler & Real-Time Notifications
 *
 * This worker:
 * 1. Receives analytics events from the client
 * 2. Stores events in D1 database
 * 3. Sends real-time email notifications to partners when their card/page is accessed
 *
 * Deploy: wrangler deploy workers/analytics/index.js
 */

// Admin email - receives copy of all partner notifications
const ADMIN_EMAIL = "pixelandcodestudios@gmail.com";

// Partner email configuration
const PARTNER_EMAILS = {
  "brian-dow": "sales@myhst.com",
  "joshua-naylor": "josh@thenaylorgroup.com",
  "tiffany-mcalister": "tiffany@dreamlivingflorida.com",
  "tom-berry": "info@longviewwealthadvisors.com",
};

const PARTNER_NAMES = {
  "brian-dow": "Brian Dow",
  "joshua-naylor": "Joshua Naylor",
  "tiffany-mcalister": "Tiffany McAlister",
  "tom-berry": "Tom Berry",
};

export default {
  async fetch(request, env) {
    // CORS headers for client requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      // Parse event payload
      const event = await request.json();

      // Validate event structure
      if (!event.event || !event.timestamp || !event.session_id) {
        return new Response("Invalid event structure", {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Enrich with server-side data
      const enrichedEvent = {
        ...event,
        ip: request.headers.get("CF-Connecting-IP"),
        country: request.headers.get("CF-IPCountry"),
        user_agent: event.user_agent || request.headers.get("User-Agent"),
        received_at: new Date().toISOString(),
      };

      // Store in D1 database
      await storeEvent(env.DB, enrichedEvent);

      // Send real-time email notification for partner events
      if (shouldNotifyPartner(enrichedEvent)) {
        await sendPartnerNotification(env, enrichedEvent);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } catch (error) {
      console.error("Analytics error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }
  },
};

/**
 * Store analytics event in D1 database
 */
async function storeEvent(db, event) {
  await db
    .prepare(
      `
    INSERT INTO analytics_events (
      event_type, session_id, referrer_id, partner_id,
      timestamp, url, ip, country, user_agent, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      event.event,
      event.session_id,
      event.referrer_id || null,
      event.partner_id || null,
      event.timestamp,
      event.url,
      event.ip,
      event.country,
      event.user_agent,
      JSON.stringify(event),
    )
    .run();
}

/**
 * Determine if partner should be notified for this event
 */
function shouldNotifyPartner(event) {
  const notifiableEvents = [
    "partner_click", // When card is clicked on hub
    "partner_page_view_from_hub", // When partner page is viewed
    "contact_submit", // When contact form is submitted
    "external_site_click", // When their website link is clicked
  ];

  return notifiableEvents.includes(event.event) && event.partner_id;
}

/**
 * Send real-time email notification to partner
 */
async function sendPartnerNotification(env, event) {
  const partnerId = event.partner_id;
  const partnerEmail = PARTNER_EMAILS[partnerId];
  const partnerName = PARTNER_NAMES[partnerId];

  if (!partnerEmail) {
    console.log(`No email configured for partner: ${partnerId}`);
    return;
  }

  // Determine event description
  let eventDescription = "";
  let subject = "";

  switch (event.event) {
    case "partner_click":
      subject = `🔔 New Click on Your Partner Card`;
      eventDescription = `Someone clicked on your partner card on the referral hub`;
      break;
    case "partner_page_view_from_hub":
      subject = `👀 New Visit to Your Partner Page`;
      eventDescription = `Someone visited your partner profile page from the referral hub`;
      break;
    case "contact_submit":
      subject = `✉️ New Contact Form Submission`;
      eventDescription = `Someone submitted the contact form on your partner page`;
      break;
    case "external_site_click":
      subject = `🔗 Someone Clicked to Visit Your Website`;
      eventDescription = `Someone clicked the link to visit your website from your partner page`;
      break;
  }

  // Get referral source info
  const referralSource = event.referrer_id
    ? `QR Code: ${event.referrer_id}`
    : "Direct access";
  const location = event.country || "Unknown location";

  // Create email body
  const emailBody = `
Partner Activity Alert: ${partnerName}

${eventDescription}!

Event Details:
• Partner: ${partnerName}
• Action: ${event.event}
• Time: ${new Date(event.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" })}
• Referral Source: ${referralSource}
• Location: ${location}
• Page: ${event.pathname || event.url}

This notification is sent in real-time when someone interacts with a partner card.

---
Referral Network Analytics
  `.trim();

  // Send email using Cloudflare Email Workers or external service
  // Option 1: Use Cloudflare Email Workers (recommended)
  // Option 2: Use SendGrid, Mailgun, or other email service

  try {
    // Using a simple email service (you'll need to configure this)
    // For now, we'll use a generic fetch to an email API
    // You can replace this with SendGrid, Mailgun, etc.

    // TEMPORARY: Only sending to admin until email service is configured
    // MailChannels free tier ended June 2024 - need to set up Resend, SendGrid, or other service
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: ADMIN_EMAIL, name: "Pixel & Code Studios" }],
          },
        ],
        from: {
          email: "notifications@referralnetwork.com",
          name: "Referral Network Notifications",
        },
        subject: subject,
        content: [
          {
            type: "text/plain",
            value: emailBody,
          },
        ],
      }),
    });

    console.log(
      `Email sent to ${ADMIN_EMAIL} for ${partnerName} event: ${event.event}`,
    );
  } catch (error) {
    console.error(`Failed to send email to ${partnerEmail}:`, error);
  }
}
