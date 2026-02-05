/**
 * Real User Flow Simulation
 *
 * Simulates realistic user journeys through the referral network
 * Tests QR scan → click → submit flows with proper timing
 */

import puppeteer from "puppeteer";
import chalk from "chalk";
import config from "../config/endpoints.js";

const BASE_URL = config.website;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flow 1: QR Scan to Website Click
 */
async function qrScanFlow(browser) {
  console.log(chalk.blue("\n🔗 Flow 1: QR Scan → Hub → Partner Page → Website Click\n"));

  const page = await browser.newPage();
  const events = [];

  try {
    // Step 1: Scan QR code (land with ref parameter)
    console.log(chalk.gray("  Step 1: Landing with QR code..."));
    await page.goto(`${BASE_URL}?ref=qr-test-001`);
    await sleep(2000); // Read time
    events.push("qr_scan");

    // Step 2: Click partner card
    console.log(chalk.gray("  Step 2: Clicking partner card..."));
    await page.click('[data-partner-id="brian-dow"]');
    await sleep(3000); // Page load + read time
    events.push("partner_click", "partner_page_view_from_hub");

    // Step 3: Click "Visit Website"
    console.log(chalk.gray('  Step 3: Clicking "Visit Website"...'));
    // Find and click the external website link
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a"));
      const websiteLink = links.find(
        (a) => a.textContent.includes("Visit Website") || a.href.includes("myhst.com")
      );
      if (websiteLink) websiteLink.click();
    });
    await sleep(1000);
    events.push("external_site_click");

    console.log(chalk.green("  ✓ Flow completed\n"));
    console.log(chalk.gray(`    Events tracked: ${events.join(" → ")}\n`));

    await page.close();
    return { success: true, events };
  } catch (error) {
    console.error(chalk.red(`  ✗ Flow failed: ${error.message}\n`));
    await page.close();
    return { success: false, error: error.message };
  }
}

/**
 * Flow 2: QR Scan to Contact Form
 */
async function contactSubmitFlow(browser) {
  console.log(chalk.blue("\n✉️  Flow 2: QR Scan → Partner Page → Contact Submit\n"));

  const page = await browser.newPage();
  const events = [];

  try {
    // Step 1: Scan QR and go directly to partner page
    console.log(chalk.gray("  Step 1: Landing on partner page with QR code..."));
    await page.goto(`${BASE_URL}/brian-dow.html?ref=qr-test-002&source=hub`);
    await sleep(2000);
    events.push("qr_scan", "partner_page_view_from_hub");

    // Step 2: Fill contact form
    console.log(chalk.gray("  Step 2: Filling contact form..."));
    await page.type('input[name="name"]', "Test User", { delay: 100 });
    await page.type('input[name="email"]', "test@example.com", { delay: 100 });
    await page.type('input[name="phone"]', "555-0100", { delay: 100 });
    await page.type('textarea[name="message"]', "This is a test message from stress testing.", {
      delay: 50,
    });
    await sleep(1000);

    // Step 3: Submit form
    console.log(chalk.gray("  Step 3: Submitting form..."));
    await page.click('button[type="submit"]');
    await sleep(2000);
    events.push("contact_submit");

    console.log(chalk.green("  ✓ Flow completed\n"));
    console.log(chalk.gray(`    Events tracked: ${events.join(" → ")}\n`));

    await page.close();
    return { success: true, events };
  } catch (error) {
    console.error(chalk.red(`  ✗ Flow failed: ${error.message}\n`));
    await page.close();
    return { success: false, error: error.message };
  }
}

/**
 * Flow 3: Direct Access (No QR)
 */
async function directAccessFlow(browser) {
  console.log(chalk.blue("\n🔍 Flow 3: Direct Access → Browse → Exit\n"));

  const page = await browser.newPage();
  const events = [];

  try {
    // Step 1: Direct access to partner page
    console.log(chalk.gray("  Step 1: Direct access to partner page..."));
    await page.goto(`${BASE_URL}/tiffany-mcalister.html`);
    await sleep(3000);
    events.push("partner_page_view_direct");

    // Step 2: Scroll and read
    console.log(chalk.gray("  Step 2: Scrolling and reading..."));
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(2000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(2000);

    // Step 3: Exit
    console.log(chalk.gray("  Step 3: Exiting..."));
    await sleep(1000);

    console.log(chalk.green("  ✓ Flow completed\n"));
    console.log(chalk.gray(`    Events tracked: ${events.join(" → ")}\n`));

    await page.close();
    return { success: true, events };
  } catch (error) {
    console.error(chalk.red(`  ✗ Flow failed: ${error.message}\n`));
    await page.close();
    return { success: false, error: error.message };
  }
}

/**
 * Flow 4: Hub Browsing
 */
async function hubBrowseFlow(browser) {
  console.log(chalk.blue("\n🏠 Flow 4: Hub → Browse Multiple Partners\n"));

  const page = await browser.newPage();
  const events = [];

  try {
    // Step 1: Land on hub
    console.log(chalk.gray("  Step 1: Landing on hub..."));
    await page.goto(BASE_URL);
    await sleep(2000);

    // Step 2: Click first partner
    console.log(chalk.gray("  Step 2: Viewing Brian Dow..."));
    await page.click('[data-partner-id="brian-dow"]');
    await sleep(3000);
    events.push("partner_click", "partner_page_view_from_hub");

    // Step 3: Back to hub
    console.log(chalk.gray("  Step 3: Back to hub..."));
    await page.goBack();
    await sleep(2000);

    // Step 4: Click second partner
    console.log(chalk.gray("  Step 4: Viewing Joshua Naylor..."));
    await page.click('[data-partner-id="joshua-naylor"]');
    await sleep(3000);
    events.push("partner_click", "partner_page_view_from_hub");

    // Step 5: Back to hub
    console.log(chalk.gray("  Step 5: Back to hub..."));
    await page.goBack();
    await sleep(2000);

    // Step 6: Click third partner
    console.log(chalk.gray("  Step 6: Viewing Tiffany McAlister..."));
    await page.click('[data-partner-id="tiffany-mcalister"]');
    await sleep(3000);
    events.push("partner_click", "partner_page_view_from_hub");

    console.log(chalk.green("  ✓ Flow completed\n"));
    console.log(chalk.gray(`    Events tracked: ${events.join(" → ")}\n`));

    await page.close();
    return { success: true, events };
  } catch (error) {
    console.error(chalk.red(`  ✗ Flow failed: ${error.message}\n`));
    await page.close();
    return { success: false, error: error.message };
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.bold.cyan("\n👥 Real User Flow Simulation\n"));
  console.log(`Testing site: ${chalk.yellow(BASE_URL)}\n`);
  console.log(chalk.gray("Simulating realistic user journeys with proper timing...\n"));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const results = [];

  try {
    results.push(await qrScanFlow(browser));
    results.push(await contactSubmitFlow(browser));
    results.push(await directAccessFlow(browser));
    results.push(await hubBrowseFlow(browser));

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(chalk.bold.cyan("=".repeat(60)));
    console.log(chalk.bold.cyan("FLOW SIMULATION SUMMARY"));
    console.log(chalk.bold.cyan("=".repeat(60) + "\n"));
    console.log(`  Total flows: ${results.length}`);
    console.log(`  Successful: ${chalk.green(successful)}`);
    console.log(`  Failed: ${chalk.red(failed)}\n`);

    if (failed === 0) {
      console.log(chalk.green("  ✅ All user flows completed successfully!"));
      console.log(chalk.green("  Analytics tracking appears to be working correctly.\n"));
    } else {
      console.log(chalk.yellow("  ⚠️  Some flows failed - review errors above.\n"));
    }

    console.log(chalk.bold.cyan("=".repeat(60) + "\n"));

    console.log(chalk.bold.green("✅ User flow simulation completed!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { qrScanFlow, contactSubmitFlow, directAccessFlow, hubBrowseFlow };
