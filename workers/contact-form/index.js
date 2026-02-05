/**
 * Cloudflare Worker - Contact Form Handler
 *
 * Handles contact form submissions and sends emails via Cloudflare Email Workers
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

// CORS headers for Pages domain
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://midlife-mafia.pages.dev",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: CORS_HEADERS
      });
    }

    try {
      // Parse form data
      const data = await request.json();

      // Validate required fields
      if (!data.name || !data.email || !data.message) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          {
            status: 400,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
          }
        );
      }

      // Get partner and referrer info
      const partnerId = data.partner_id || "unknown";
      const referrerId = data.referrer_id || "none";
      const source = data.source || "direct";

      // Send email notification
      await sendContactFormEmail(env, {
        name: data.name,
        email: data.email,
        phone: data.phone || "Not provided",
        message: data.message,
        partnerId,
        referrerId,
        source
      });

      return new Response(
        JSON.stringify({ success: true, message: "Form submitted successfully" }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        }
      );

    } catch (error) {
      console.error("Form submission error:", error);

      return new Response(
        JSON.stringify({ error: "Failed to submit form" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
        }
      );
    }
  }
};

/**
 * Send contact form email notification
 */
async function sendContactFormEmail(env, formData) {
  const { name, email, phone, message, partnerId } = formData;

  // Create MIME message
  const msg = createMimeMessage();
  msg.setSender({
    name: env.FROM_NAME || "Referral Network Forms",
    addr: env.FROM_EMAIL || "forms@pcs-hub.com"
  });
  msg.setRecipient(env.ADMIN_EMAIL || "pixelandcodestudios@gmail.com");
  msg.setSubject(`New Contact Form Submission - ${partnerId}`);

  // HTML email body
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1816 0%, #2d2b28 100%); color: #c9a227; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .field { margin-bottom: 20px; }
    .label { font-weight: 600; color: #666; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; }
    .value { margin-top: 5px; font-size: 16px; color: #1a1816; }
    .message-box { background: #f8f8f8; padding: 15px; border-radius: 4px; border-left: 3px solid #c9a227; }
    .meta { background: #f0f0f0; padding: 15px; margin-top: 20px; border-radius: 4px; font-size: 13px; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">📩 New Contact Form</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Referral Network Submission</p>
    </div>

    <div class="content">
      <div class="field">
        <div class="label">From</div>
        <div class="value">${name}</div>
      </div>

      <div class="field">
        <div class="label">Email</div>
        <div class="value"><a href="mailto:${email}">${email}</a></div>
      </div>

      <div class="field">
        <div class="label">Phone</div>
        <div class="value">${phone}</div>
      </div>

      <div class="field">
        <div class="label">Message</div>
        <div class="message-box">${message.replace(/\n/g, '<br>')}</div>
      </div>
    </div>

    <div class="footer">
      Sent via Referral Network Contact Form
    </div>
  </div>
</body>
</html>
  `.trim();

  // Plain text fallback
  const textBody = `
New Contact Form Submission

FROM: ${name}
EMAIL: ${email}
PHONE: ${phone}

MESSAGE:
${message}
  `.trim();

  msg.addMessage({
    contentType: "text/plain",
    data: textBody,
  });

  msg.addMessage({
    contentType: "text/html",
    data: htmlBody,
  });

  // Send via Cloudflare Email Workers
  const emailMessage = new EmailMessage(
    env.FROM_EMAIL || "forms@pcs-hub.com",
    env.ADMIN_EMAIL || "pixelandcodestudios@gmail.com",
    msg.asRaw()
  );

  try {
    await env.EMAIL.send(emailMessage);
    console.log(`Contact form email sent for ${partnerId}`);
  } catch (error) {
    console.error("Failed to send contact form email:", error);
    throw error;
  }
}
