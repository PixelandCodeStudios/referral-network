/**
 * Cloudflare Worker - Analytics Event Handler & Real-Time Notifications
 *
 * This worker:
 * 1. Receives analytics events from the client
 * 2. Stores events in D1 database
 * 3. Sends real-time email notifications asynchronously (non-blocking)
 * 4. Implements rate limiting to prevent abuse
 *
 * Deploy: wrangler deploy workers/analytics/index.js
 */

import { shouldNotifyPartner, sendPartnerNotification } from "../shared/email-notifications.js";

// Rate limiting configuration
const RATE_LIMITS = {
  PER_IP_PER_MINUTE: 10, // 10 requests per minute per IP
  WINDOW_SECONDS: 60,
};

/**
 * Check rate limit for incoming request
 */
async function checkRateLimit(env, ip) {
  const ipKey = `rate_limit:ip:${ip}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMITS.WINDOW_SECONDS * 1000;

  // Get current count from KV
  const data = await env.RATE_LIMIT_KV.get(ipKey, { type: "json" });

  if (data) {
    // Filter requests within current window
    const recentRequests = data.requests.filter((ts) => ts > windowStart);

    if (recentRequests.length >= RATE_LIMITS.PER_IP_PER_MINUTE) {
      return {
        allowed: false,
        current: recentRequests.length,
        limit: RATE_LIMITS.PER_IP_PER_MINUTE,
        resetIn: Math.ceil((recentRequests[0] + RATE_LIMITS.WINDOW_SECONDS * 1000 - now) / 1000),
      };
    }

    // Add current request
    recentRequests.push(now);
    await env.RATE_LIMIT_KV.put(ipKey, JSON.stringify({ requests: recentRequests }), {
      expirationTtl: RATE_LIMITS.WINDOW_SECONDS,
    });

    return {
      allowed: true,
      current: recentRequests.length,
      limit: RATE_LIMITS.PER_IP_PER_MINUTE,
      remaining: RATE_LIMITS.PER_IP_PER_MINUTE - recentRequests.length,
    };
  } else {
    // First request from this IP
    await env.RATE_LIMIT_KV.put(ipKey, JSON.stringify({ requests: [now] }), {
      expirationTtl: RATE_LIMITS.WINDOW_SECONDS,
    });

    return {
      allowed: true,
      current: 1,
      limit: RATE_LIMITS.PER_IP_PER_MINUTE,
      remaining: RATE_LIMITS.PER_IP_PER_MINUTE - 1,
    };
  }
}

export default {
  async fetch(request, env, ctx) {
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
      // Parse event payload first to check for test sessions
      const event = await request.json();

      // Validate event structure
      if (!event.event || !event.timestamp || !event.session_id) {
        return new Response("Invalid event structure", {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Check rate limit (skip for test sessions)
      const isTestSession = event.session_id && event.session_id.startsWith("test_");
      let rateLimitResult = {
        allowed: true,
        current: 0,
        limit: RATE_LIMITS.PER_IP_PER_MINUTE,
        remaining: RATE_LIMITS.PER_IP_PER_MINUTE,
      };

      if (!isTestSession) {
        const ip = request.headers.get("CF-Connecting-IP");
        rateLimitResult = await checkRateLimit(env, ip);

        if (!rateLimitResult.allowed) {
          return new Response(
            JSON.stringify({
              error: "Rate limit exceeded",
              limit: rateLimitResult.limit,
              current: rateLimitResult.current,
              resetIn: rateLimitResult.resetIn,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": rateLimitResult.resetIn.toString(),
                "X-RateLimit-Limit": rateLimitResult.limit.toString(),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": rateLimitResult.resetIn.toString(),
                ...corsHeaders,
              },
            }
          );
        }
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

      // Send email notification asynchronously (non-blocking)
      if (shouldNotifyPartner(enrichedEvent)) {
        ctx.waitUntil(sendPartnerNotification(env, enrichedEvent));
      }

      // Return immediately with rate limit headers
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Limit": rateLimitResult.limit.toString(),
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
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
  `
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
      JSON.stringify(event)
    )
    .run();
}
