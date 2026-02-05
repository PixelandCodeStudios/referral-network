/**
 * Cloudflare Worker - Contact Form Handler
 *
 * Handles contact form submissions and sends emails via Cloudflare Email Workers
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

// CORS headers for Pages domain
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://referral-website-5o3.pages.dev",
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
  const { name, email, phone, message, partnerId, referrerId, source } = formData;

  // Create MIME message
  const msg = createMimeMessage();
  msg.setSender({
    name: env.FROM_NAME || "Referral Network Forms",
    addr: env.FROM_EMAIL || "forms@pcs-hub.com"
  });
  msg.setRecipient(env.ADMIN_EMAIL || "pixelandcodestudios@gmail.com");
  msg.setSubject(`New Contact Form: ${partnerId}`);

  // HTML email body - standard contact form notification
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #ddd; }
    .header { background: #333; color: #fff; padding: 20px; text-align: center; }
    .content { padding: 30px; }
    .field { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
    .field:last-child { border-bottom: none; }
    .label { font-weight: bold; color: #555; display: block; margin-bottom: 5px; }
    .value { color: #333; }
    .footer { background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Contact Form Submission</h2>
    </div>

    <div class="content">
      <div class="field">
        <span class="label">Name:</span>
        <span class="value">${name}</span>
      </div>

      <div class="field">
        <span class="label">Email:</span>
        <span class="value"><a href="mailto:${email}">${email}</a></span>
      </div>

      <div class="field">
        <span class="label">Phone:</span>
        <span class="value">${phone}</span>
      </div>

      <div class="field">
        <span class="label">Message:</span>
        <div class="value" style="margin-top: 10px; white-space: pre-wrap;">${message}</div>
      </div>

      <div class="field">
        <span class="label">Partner:</span>
        <span class="value">${partnerId}</span>
      </div>

      <div class="field">
        <span class="label">Referral Source:</span>
        <span class="value">${referrerId === 'none' ? 'Direct' : referrerId} (${source})</span>
      </div>

      <div class="field">
        <span class="label">Submitted:</span>
        <span class="value">${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })}</span>
      </div>
    </div>

    <div class="footer">
      This form was submitted via the Referral Network website
    </div>
  </div>
</body>
</html>
  `.trim();

  // Plain text fallback
  const textBody = `
NEW CONTACT FORM SUBMISSION

Name: ${name}
Email: ${email}
Phone: ${phone}

Message:
${message}

---
Partner: ${partnerId}
Referral Source: ${referrerId === 'none' ? 'Direct' : referrerId} (${source})
Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })}

---
This form was submitted via the Referral Network website
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
