import fetch from "node-fetch";

const url = "https://referral-analytics.contact-newleafllc.workers.dev";

(async () => {
  console.log("Testing rate limiting...\n");

  for (let i = 0; i < 15; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "qr_scan",
        timestamp: new Date().toISOString(),
        session_id: "rate_limit_test_" + i,
        url: "https://test.com",
        pathname: "/",
        user_agent: "Test",
      }),
    });

    const remaining = res.headers.get("x-ratelimit-remaining");
    const limit = res.headers.get("x-ratelimit-limit");

    console.log(`Request ${i + 1}: ${res.status} - Remaining: ${remaining}/${limit}`);

    if (res.status === 429) {
      const body = await res.json();
      console.log("✅ Rate limiting working! Got 429 after", i + 1, "requests");
      console.log("   Reset in:", body.resetIn, "seconds");
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n✅ Rate limiting test complete!");
})();
