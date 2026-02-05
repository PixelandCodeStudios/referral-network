/**
 * Cloudflare Worker - Weekly Analytics Report (Scheduled)
 *
 * This worker runs every Tuesday at 6:00 AM EST
 * and sends weekly analytics summaries to all partners
 *
 * Deploy: wrangler deploy workers/weekly-report/index.js
 * Schedule: 0 11 * * 2 (Tuesdays at 11:00 UTC = 6:00 AM EST)
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

// Partner email configuration
// TEMPORARY: All emails going to admin for testing
const PARTNER_EMAILS = {
  "brian-dow": "pixelandcodestudios@gmail.com",
  "joshua-naylor": "pixelandcodestudios@gmail.com",
  "tiffany-mcalister": "pixelandcodestudios@gmail.com",
  "tom-berry": "pixelandcodestudios@gmail.com",
  "jordan-clay": "pixelandcodestudios@gmail.com",
};

const PARTNER_NAMES = {
  "brian-dow": "Brian Dow - Healthcare Solutions Team",
  "joshua-naylor": "Joshua Naylor - The Naylor Group",
  "tiffany-mcalister": "Tiffany McAlister - Dream Living Florida",
  "tom-berry": "Tom Berry - Longview Wealth Advisors",
  "jordan-clay": "Jordan Clay - Select Insurance Providers",
};

// Helper function to convert QR code ID to partner first name
function getPartnerNameFromQR(qrCode) {
  // Map common QR codes to partners
  const qrToPartner = {
    "qr-brian": "brian-dow",
    "qr-brian-dow": "brian-dow",
    "qr-joshua": "joshua-naylor",
    "qr-joshua-naylor": "joshua-naylor",
    "qr-tiffany": "tiffany-mcalister",
    "qr-tiffany-mcalister": "tiffany-mcalister",
    "qr-tom": "tom-berry",
    "qr-tom-berry": "tom-berry",
    "qr-jordan": "jordan-clay",
    "qr-jordan-clay": "jordan-clay",
  };

  const matchedPartnerId = qrToPartner[qrCode.toLowerCase()];
  if (matchedPartnerId && PARTNER_NAMES[matchedPartnerId]) {
    return PARTNER_NAMES[matchedPartnerId].split(" - ")[0]; // Return first name only
  }

  return qrCode; // Fallback to QR code if no match
}

export default {
  // Handle scheduled cron trigger
  async scheduled(event, env, _ctx) {
    console.log("Running weekly analytics report...");

    try {
      // Get date range for past week
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 7);

      // Generate and send reports for each partner
      for (const [partnerId, email] of Object.entries(PARTNER_EMAILS)) {
        await generateAndSendReport(env.DB, partnerId, email, startDate, endDate, env);
      }

      console.log("Weekly reports sent successfully");
    } catch (error) {
      console.error("Error generating weekly reports:", error);
    }
  },

  // Also allow manual triggering via HTTP
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed. Use POST to trigger manual report.", {
        status: 405,
      });
    }

    // TEMPORARY: Auth disabled for testing
    // const authHeader = request.headers.get("Authorization");
    // if (authHeader !== `Bearer ${env.REPORT_SECRET}`) {
    //   return new Response("Unauthorized", { status: 401 });
    // }

    // Get date range from query params or default to past week
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "7");

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    try {
      for (const [partnerId, email] of Object.entries(PARTNER_EMAILS)) {
        await generateAndSendReport(env.DB, partnerId, email, startDate, endDate, env);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Reports generated for ${days} days`,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
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
        }
      );
    }
  },
};

/**
 * Generate analytics report for a partner
 */
async function generateAndSendReport(db, partnerId, email, startDate, endDate, env) {
  const partnerName = PARTNER_NAMES[partnerId];

  // Query analytics for this partner
  const stats = await getPartnerStats(db, partnerId, startDate, endDate);

  // Format report emails (both plain text and HTML)
  const emailBodyText = formatReportEmail(partnerName, stats, startDate, endDate);
  const emailBodyHTML = formatReportEmailHTML(partnerName, stats, startDate, endDate);

  // Send email
  await sendReportEmail(email, partnerName, emailBodyText, emailBodyHTML, startDate, endDate, env);

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
  `
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
  `
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
  `
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
  `
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
  `
    )
    .bind(partnerId, startISO, endISO)
    .first();

  // Clicks to Contact (phone + email clicks)
  const clicksToContact = await db
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM analytics_events
    WHERE event_type IN ('phone_click', 'email_click')
      AND partner_id = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `
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
  `
    )
    .bind(partnerId, startISO, endISO)
    .all();

  // Get lead conversions per referrer (contact_submit, phone_click, email_click)
  const leadConversions = await db
    .prepare(
      `
    SELECT referrer_id, COUNT(*) as leads
    FROM analytics_events
    WHERE partner_id = ?
      AND referrer_id IS NOT NULL
      AND event_type IN ('contact_submit', 'phone_click', 'email_click')
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY referrer_id
  `
    )
    .bind(partnerId, startISO, endISO)
    .all();

  // Combine QR scans with lead conversions and calculate conversion rates
  const leadsByReferrer = {};
  (leadConversions.results || []).forEach((row) => {
    leadsByReferrer[row.referrer_id] = row.leads;
  });

  const topQRCodes = (qrScans.results || [])
    .map((qr) => {
      const leads = leadsByReferrer[qr.referrer_id] || 0;
      const conversionRate = qr.scans > 0 ? ((leads / qr.scans) * 100).toFixed(0) : 0;
      return {
        referrer_id: qr.referrer_id,
        partnerName: getPartnerNameFromQR(qr.referrer_id),
        scans: qr.scans,
        leads: leads,
        conversionRate: conversionRate,
      };
    })
    .sort((a, b) => b.scans - a.scans); // Sort by most interactions

  return {
    cardClicks: cardClicks?.count || 0,
    pageViews: pageViews?.count || 0,
    directViews: directViews?.count || 0,
    websiteClicks: websiteClicks?.count || 0,
    clicksToContact: clicksToContact?.count || 0,
    contactSubmissions: contactSubmissions?.count || 0,
    totalQRScans: topQRCodes.reduce((sum, qr) => sum + qr.scans, 0),
    topQRCodes: topQRCodes.slice(0, 5), // Top 5 QR codes
  };
}

/**
 * Format the report email (plain text version)
 */
function formatReportEmail(partnerName, stats, startDate, endDate) {
  const dateRange = `${startDate.toLocaleDateString("en-US")} - ${endDate.toLocaleDateString("en-US")}`;

  // Create a formatted table for metrics
  const metricsTable = `
┌─────────────────────────────────────┬────────┐
│ Metric                              │ Count  │
├─────────────────────────────────────┼────────┤
│ Card Clicks                         │ ${String(stats.cardClicks).padStart(6)} │
│ Page Views (from hub)               │ ${String(stats.pageViews).padStart(6)} │
│ Direct Page Views                   │ ${String(stats.directViews).padStart(6)} │
│ Website Link Clicks                 │ ${String(stats.websiteClicks).padStart(6)} │
│ Clicks to Contact - LEADS!          │ ${String(stats.clicksToContact).padStart(6)} │
│ Contact Form Submissions - LEADS!   │ ${String(stats.contactSubmissions).padStart(6)} │
│ Total QR Scans                      │ ${String(stats.totalQRScans).padStart(6)} │
└─────────────────────────────────────┴────────┘`;

  let qrBreakdown = "No referral traffic this week";
  let topReferrerInsight = "";
  if (stats.topQRCodes.length > 0) {
    qrBreakdown = stats.topQRCodes
      .map(
        (qr) =>
          `  • ${qr.partnerName}: ${qr.scans} interaction${qr.scans > 1 ? "s" : ""}, ${qr.leads} lead${qr.leads !== 1 ? "s" : ""} (${qr.conversionRate}% conversion)`
      )
      .join("\n");

    // Add top referrer insight
    const topReferrer = stats.topQRCodes[0];
    if (topReferrer) {
      topReferrerInsight = `\n💡 ${topReferrer.partnerName} sent you the most referrals this week${topReferrer.leads > 0 ? `, and ${topReferrer.conversionRate}% of them clicked to contact you!` : "."}`;
    }
  }

  const totalEngagement =
    stats.cardClicks +
    stats.pageViews +
    stats.websiteClicks +
    stats.clicksToContact +
    stats.contactSubmissions;
  const totalLeads = stats.clicksToContact + stats.contactSubmissions;

  return `
Hi ${partnerName.split(" - ")[0]},

Here's your weekly referral network analytics summary for ${dateRange}.

📊 WEEKLY PERFORMANCE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${metricsTable}

🎯 REFERRAL TRAFFIC SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
People who scanned these partners' QR codes then interacted with you:

${qrBreakdown}${topReferrerInsight}

📈 KEY INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Total Engagement: ${totalEngagement} interactions
• Total Leads: ${totalLeads} (${stats.clicksToContact} direct contact + ${stats.contactSubmissions} form submissions)
• Lead Conversion Rate: ${totalEngagement > 0 ? ((totalLeads / totalEngagement) * 100).toFixed(1) : 0}%
${totalLeads > 0 ? "• 🎉 Great job! You generated " + totalLeads + " lead" + (totalLeads > 1 ? "s" : "") + " this week!" : "• Focus on driving more traffic to your page to increase leads"}

Keep up the great work! These analytics help track the effectiveness of your referral presence.

Questions? Reply to this email.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Referral Network Weekly Report
Sent every Tuesday at 6:00 AM EST
  `.trim();
}

/**
 * Format the report email (HTML version with real table)
 */
function formatReportEmailHTML(partnerName, stats, startDate, endDate) {
  const dateRange = `${startDate.toLocaleDateString("en-US")} - ${endDate.toLocaleDateString("en-US")}`;
  const firstName = partnerName.split(" - ")[0];

  let qrRows = "";
  let topReferrerInsightHTML = "";
  if (stats.topQRCodes.length > 0) {
    qrRows = stats.topQRCodes
      .map(
        (qr) => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${qr.partnerName}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${qr.scans}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #059669;">${qr.leads}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700; color: ${qr.conversionRate >= 50 ? "#059669" : "#6b7280"};">${qr.conversionRate}%</td>
          </tr>
        `
      )
      .join("");

    // Add top referrer insight
    const topReferrer = stats.topQRCodes[0];
    if (topReferrer) {
      topReferrerInsightHTML = `
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 15px; color: #92400e;"><strong>💡 ${topReferrer.partnerName}</strong> sent you the most referrals this week${topReferrer.leads > 0 ? `, and <strong>${topReferrer.conversionRate}%</strong> of them clicked to contact you!` : "."}</p>
        </div>
      `;
    }
  } else {
    qrRows = `
      <tr>
        <td colspan="4" style="padding: 16px; text-align: center; color: #6b7280;">No referral traffic this week</td>
      </tr>
    `;
  }

  const totalEngagement =
    stats.cardClicks +
    stats.pageViews +
    stats.websiteClicks +
    stats.clicksToContact +
    stats.contactSubmissions;
  const totalLeads = stats.clicksToContact + stats.contactSubmissions;
  const conversionRate =
    totalEngagement > 0 ? ((totalLeads / totalEngagement) * 100).toFixed(1) : 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Referral Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #c9a227 0%, #9a7b1c 100%); color: #111113; padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 700;">📊 Weekly Referral Report</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">${dateRange}</p>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">

      <p style="margin: 0 0 24px 0; font-size: 16px;">Hi ${firstName},</p>

      <p style="margin: 0 0 32px 0; color: #6b7280;">Here's your weekly referral network analytics summary.</p>

      <!-- Performance Metrics Table -->
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #111827;">📊 Weekly Performance Summary</h2>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">Metric</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; width: 100px;">Count</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Card Clicks</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${stats.cardClicks}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Page Views (from hub)</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${stats.pageViews}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Direct Page Views</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${stats.directViews}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">Website Link Clicks</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 600;">${stats.websiteClicks}</td>
          </tr>
          <tr style="background-color: #fef3c7;">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #92400e;">🎯 Clicks to Contact (Phone + Email) - LEADS!</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700; font-size: 18px; color: #92400e;">${stats.clicksToContact}</td>
          </tr>
          <tr style="background-color: #fef3c7;">
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #92400e;">🎯 Contact Form Submissions - LEADS!</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-weight: 700; font-size: 18px; color: #92400e;">${stats.contactSubmissions}</td>
          </tr>
          <tr>
            <td style="padding: 12px;">Total QR Scans</td>
            <td style="padding: 12px; text-align: center; font-weight: 600;">${stats.totalQRScans}</td>
          </tr>
        </tbody>
      </table>

      <!-- Referral Traffic Sources -->
      <h2 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: #111827;">🎯 Referral Traffic Sources</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280;">People who scanned these partners' QR codes then interacted with you:</p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db;">Partner</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; width: 100px;">Interactions</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; width: 80px;">Leads</th>
            <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; border-bottom: 2px solid #d1d5db; width: 100px;">Conversion</th>
          </tr>
        </thead>
        <tbody>
          ${qrRows}
        </tbody>
      </table>

      ${topReferrerInsightHTML}

      <!-- Key Insights -->
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #065f46;">📈 Key Insights</h3>
        <ul style="margin: 0; padding-left: 20px; color: #047857;">
          <li style="margin-bottom: 8px;">Total Engagement: <strong>${totalEngagement}</strong> interactions</li>
          <li style="margin-bottom: 8px;">Total Leads: <strong>${totalLeads}</strong> (${stats.clicksToContact} direct contact + ${stats.contactSubmissions} form submissions)</li>
          <li style="margin-bottom: 8px;">Lead Conversion Rate: <strong>${conversionRate}%</strong></li>
          ${
            totalLeads > 0
              ? `<li>🎉 <strong>Great job!</strong> You generated ${totalLeads} lead${totalLeads > 1 ? "s" : ""} this week!</li>`
              : `<li>Focus on driving more traffic to your page to increase leads</li>`
          }
        </ul>
      </div>

      <p style="margin: 0 0 8px 0; color: #6b7280;">Keep up the great work! These analytics help track the effectiveness of your referral presence.</p>

      <p style="margin: 0; color: #6b7280;">Questions? Reply to this email.</p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Referral Network Weekly Report<br>Sent every Tuesday at 6:00 AM EST</p>
    </div>

  </div>

</body>
</html>
  `.trim();
}

/**
 * Send report email using Cloudflare Email Workers (with HTML table)
 */
async function sendReportEmail(email, partnerName, bodyText, bodyHTML, startDate, endDate, env) {
  const dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const msg = createMimeMessage();
  msg.setSender({
    name: "Referral Network Analytics",
    addr: env.FROM_EMAIL || "reports@pcs-hub.com",
  });
  msg.setRecipient(email);
  msg.setSubject(`📊 Your Weekly Referral Report (${dateRange})`);

  // Add both plain text and HTML versions
  msg.addMessage({
    contentType: "text/plain",
    data: bodyText,
  });
  msg.addMessage({
    contentType: "text/html",
    data: bodyHTML,
  });

  const message = new EmailMessage(env.FROM_EMAIL || "reports@pcs-hub.com", email, msg.asRaw());

  try {
    await env.EMAIL.send(message);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
}
