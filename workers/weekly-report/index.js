/**
 * Cloudflare Worker - Weekly Analytics Report (Scheduled)
 *
 * This worker runs every Tuesday at 6:00 AM EST
 * and sends weekly analytics summaries to all partners
 *
 * Deploy: wrangler deploy workers/weekly-report/index.js
 * Schedule: 0 11 * * 2 (Tuesdays at 11:00 UTC = 6:00 AM EST)
 */

// Partner email configuration
const PARTNER_EMAILS = {
  "brian-dow": "sales@myhst.com",
  "joshua-naylor": "josh@thenaylorgroup.com",
  "tiffany-mcalister": "tiffany@dreamlivingflorida.com",
  "tom-berry": "info@longviewwealthadvisors.com", // Update with actual email
};

const PARTNER_NAMES = {
  "brian-dow": "Brian Dow - Healthcare Solutions Team",
  "joshua-naylor": "Joshua Naylor - The Naylor Group",
  "tiffany-mcalister": "Tiffany McAlister - Dream Living Florida",
  "tom-berry": "Tom Berry - Longview Wealth Advisors",
};

export default {
  // Handle scheduled cron trigger
  async scheduled(event, env, ctx) {
    console.log("Running weekly analytics report...");

    try {
      // Get date range for past week
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      // Generate and send reports for each partner
      for (const [partnerId, email] of Object.entries(PARTNER_EMAILS)) {
        await generateAndSendReport(
          env.DB,
          partnerId,
          email,
          startDate,
          endDate,
        );
      }

      console.log("Weekly reports sent successfully");
    } catch (error) {
      console.error("Error generating weekly reports:", error);
    }
  },

  // Also allow manual triggering via HTTP
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response(
        "Method not allowed. Use POST to trigger manual report.",
        {
          status: 405,
        },
      );
    }

    // Verify secret token for manual triggers
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${env.REPORT_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get date range from query params or default to past week
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "7");

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    try {
      for (const [partnerId, email] of Object.entries(PARTNER_EMAILS)) {
        await generateAndSendReport(
          env.DB,
          partnerId,
          email,
          startDate,
          endDate,
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Reports generated for ${days} days`,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  },
};

/**
 * Generate analytics report for a partner
 */
async function generateAndSendReport(db, partnerId, email, startDate, endDate) {
  const partnerName = PARTNER_NAMES[partnerId];

  // Query analytics for this partner
  const stats = await getPartnerStats(db, partnerId, startDate, endDate);

  // Format report email
  const emailBody = formatReportEmail(partnerName, stats, startDate, endDate);

  // Send email
  await sendReportEmail(email, partnerName, emailBody, startDate, endDate);

  console.log(`Report sent to ${email}`);
}

/**
 * Get analytics stats for a partner
 */
async function getPartnerStats(db, partnerId, startDate, endDate) {
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  // Total clicks on partner card
  const cardClicks = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'partner_click'
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `,
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // Page views from hub
  const pageViews = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'partner_page_view_from_hub'
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `,
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // Direct page views (not from hub)
  const directViews = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'partner_page_view_direct'
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `,
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // Website clicks
  const websiteClicks = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'external_site_click'
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `,
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // Contact form submissions
  const contactSubmissions = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type = 'contact_submit'
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `,
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // QR code scans (all QR scans that led to this partner)
  const qrScans = await db
    .prepare(
      `
    SELECT DISTINCT referrer_id, COUNT(*) as scans
    FROM analytics_events
    WHERE partner_id = ?
      AND referrer_id IS NOT NULL
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY referrer_id
  `,
    )
    .bind(partnerId, startISO, endISO)
    .all();

  // Top referring QR codes
  const topQRCodes = qrScans.results || [];

  return {
    cardClicks: cardClicks?.count || 0,
    pageViews: pageViews?.count || 0,
    directViews: directViews?.count || 0,
    websiteClicks: websiteClicks?.count || 0,
    contactSubmissions: contactSubmissions?.count || 0,
    totalQRScans: topQRCodes.reduce((sum, qr) => sum + qr.scans, 0),
    topQRCodes: topQRCodes.slice(0, 5), // Top 5 QR codes
  };
}

/**
 * Format the report email
 */
function formatReportEmail(partnerName, stats, startDate, endDate) {
  const dateRange = `${startDate.toLocaleDateString("en-US")} - ${endDate.toLocaleDateString("en-US")}`;

  let qrBreakdown = "No QR code activity this week";
  if (stats.topQRCodes.length > 0) {
    qrBreakdown = stats.topQRCodes
      .map(
        (qr) =>
          `  • ${qr.referrer_id}: ${qr.scans} scan${qr.scans > 1 ? "s" : ""}`,
      )
      .join("\n");
  }

  return `
Hi ${partnerName.split(" - ")[0]},

Here's your weekly referral network analytics summary for ${dateRange}.

📊 WEEKLY PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Partner Card Interactions:
  • Card Clicks: ${stats.cardClicks}
  • Page Views (from hub): ${stats.pageViews}
  • Direct Page Views: ${stats.directViews}

Engagement:
  • Website Link Clicks: ${stats.websiteClicks}
  • Contact Form Submissions: ${stats.contactSubmissions}

QR Code Performance:
  • Total QR Scans: ${stats.totalQRScans}

Top Performing QR Codes:
${qrBreakdown}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Engagement: ${stats.cardClicks + stats.pageViews + stats.websiteClicks + stats.contactSubmissions} interactions

${stats.contactSubmissions > 0 ? "🎉 Great job! You had contact form submissions this week!" : ""}

Keep up the great work! These analytics help track the effectiveness of your referral presence.

Questions? Reply to this email.

---
Referral Network Weekly Report
Sent every Tuesday at 6:00 AM EST
  `.trim();
}

/**
 * Send report email
 */
async function sendReportEmail(email, partnerName, body, startDate, endDate) {
  const dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: email, name: partnerName.split(" - ")[0] }],
        },
      ],
      from: {
        email: "reports@referralnetwork.com", // Update with your domain
        name: "Referral Network Analytics",
      },
      subject: `📊 Your Weekly Referral Report (${dateRange})`,
      content: [
        {
          type: "text/plain",
          value: body,
        },
      ],
    }),
  });
}
