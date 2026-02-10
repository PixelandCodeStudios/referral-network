/**
 * Shared Email Notification Logic
 *
 * Reusable email sending functionality for analytics worker
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

// Partner email configuration
export const PARTNER_EMAILS = {
  "brian-dow": "sales@myhst.com",
  "joshua-naylor": "josh@thenaylorgroup.com",
  "tiffany-mcalister": "tiffany@dreamlivingflorida.com",
  "tom-berry": "info@longviewwealthadvisors.com",
  "jordan-clay": "jordan@selectinsuranceproviders.com",
  "teresa-fitzpatrick": "Teresa@Fitzpatricklawyers.com",
  "kelly-love": "kelly@thachercpa.com",
  "jamie-marcario": "jamie@bravalaw.com",
};

export const PARTNER_NAMES = {
  "brian-dow": "Brian Dow",
  "joshua-naylor": "Joshua Naylor",
  "tiffany-mcalister": "Tiffany McAlister",
  "tom-berry": "Tom Berry",
  "jordan-clay": "Jordan Clay",
  "teresa-fitzpatrick": "Teresa Fitzpatrick",
  "kelly-love": "Kelly Love",
  "jamie-marcario": "Jamie Marcario",
};

// Admin email - receives copy of all partner notifications
const ADMIN_EMAIL = "pixelandcodestudios@gmail.com";

/**
 * Determine if partner should be notified for this event
 */
export function shouldNotifyPartner(event) {
  const notifiableEvents = [
    "partner_click", // When card is clicked on hub
    // "partner_page_view_from_hub", // Disabled - redundant with partner_click
    // "contact_submit", // Disabled - handled by contact-form worker
    "external_site_click", // When their website link is clicked
    "phone_click", // When phone number is clicked
    "email_click", // When email address is clicked
  ];

  return notifiableEvents.includes(event.event) && event.partner_id;
}

/**
 * Send real-time email notification to partner
 */
export async function sendPartnerNotification(env, event) {
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
    case "phone_click":
      subject = `📞 HOT LEAD: Someone Clicked Your Phone Number`;
      eventDescription = `Someone clicked your phone number to call you`;
      break;
    case "email_click":
      subject = `✉️ HOT LEAD: Someone Clicked Your Email`;
      eventDescription = `Someone clicked your email address to contact you`;
      break;
  }

  // Get referral source info
  const referralSource = event.referrer_id ? `QR Code: ${event.referrer_id}` : "Direct access";
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

  try {
    // Create MIME message using mimetext
    const msg = createMimeMessage();
    msg.setSender({
      name: env.FROM_NAME || "Referral Network Notifications",
      addr: env.FROM_EMAIL || "notifications@referralnetwork.com",
    });
    msg.setRecipient(ADMIN_EMAIL);
    msg.setSubject(subject);
    msg.addMessage({
      contentType: "text/plain",
      data: emailBody,
    });

    // Create EmailMessage and send via Cloudflare Email Workers
    const message = new EmailMessage(
      env.FROM_EMAIL || "notifications@referralnetwork.com",
      ADMIN_EMAIL,
      msg.asRaw()
    );

    await env.EMAIL.send(message);
    console.log(`Email sent to ${ADMIN_EMAIL} for ${partnerName} event: ${event.event}`);
  } catch (error) {
    console.error(`Failed to send email:`, error);
  }
}
