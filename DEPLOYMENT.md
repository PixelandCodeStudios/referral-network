# Referral Network - Cloudflare Deployment Guide

This guide walks you through deploying your referral network with **real-time email notifications** and **weekly analytics reports**.

---

## 📋 Prerequisites

1. **Cloudflare Account** (free tier works!)
   - Sign up at: https://dash.cloudflare.com/sign-up

2. **Wrangler CLI** (Cloudflare's development tool)
   ```bash
   npm install -g wrangler
   ```

3. **Authenticate Wrangler**
   ```bash
   wrangler login
   ```

---

## 🚀 Step-by-Step Deployment

### Step 1: Create Cloudflare D1 Database

```bash
# Create the database
wrangler d1 create referral-analytics-db
```

**Output will look like:**
```
✅ Successfully created DB 'referral-analytics-db'

[[d1_databases]]
binding = "DB"
database_name = "referral-analytics-db"
database_id = "abc123def456-your-database-id"
```

**Copy the `database_id`** and update it in `wrangler.toml`:
```toml
[[workers.d1_databases]]
binding = "DB"
database_name = "referral-analytics-db"
database_id = "abc123def456-your-database-id"  # <-- Paste your ID here
```

### Step 2: Initialize Database Schema

```bash
# Run the schema migration
wrangler d1 execute referral-analytics-db --file=workers/schema.sql
```

**Expected output:**
```
🌀 Executing on referral-analytics-db:
🌀 To execute on your remote database, add a --remote flag to your wrangler command.
✅ Executed 6 commands in 0.123 seconds
```

### Step 3: Update Partner Email Addresses

**Edit both worker files** and update the `PARTNER_EMAILS` object with real email addresses:

**File: `workers/analytics/index.js`**
```javascript
const PARTNER_EMAILS = {
  'brian-dow': 'sales@myhst.com',
  'joshua-naylor': 'josh@thenaylorgroup.com',
  'tiffany-mcalister': 'tiffany@dreamlivingflorida.com',
  'tom-berry': 'tom@longviewwealthadvisors.com', // Update this!
};
```

**File: `workers/weekly-report/index.js`**
```javascript
const PARTNER_EMAILS = {
  'brian-dow': 'sales@myhst.com',
  'joshua-naylor': 'josh@thenaylorgroup.com',
  'tiffany-mcalister': 'tiffany@dreamlivingflorida.com',
  'tom-berry': 'tom@longviewwealthadvisors.com', // Update this!
};
```

### Step 4: Deploy Analytics Worker

```bash
# Deploy the real-time analytics worker
wrangler deploy workers/analytics/index.js
```

**Output:**
```
⛅️ wrangler 3.x.x
------------------
✨ Successfully deployed to https://referral-analytics.YOUR_SUBDOMAIN.workers.dev
```

**Copy the worker URL!** You'll need it in Step 6.

### Step 5: Deploy Weekly Report Worker

```bash
# Deploy the scheduled weekly report worker
wrangler deploy workers/weekly-report/index.js
```

**Output:**
```
✨ Successfully deployed to https://referral-weekly-report.YOUR_SUBDOMAIN.workers.dev
📅 Cron triggers scheduled: 0 11 * * 2 (Tuesdays at 11:00 UTC)
```

### Step 6: Update Client-Side Analytics

**Edit `analytics.js`** and update the worker endpoint:

```javascript
const ANALYTICS_CONFIG = {
  // Replace YOUR_SUBDOMAIN with your actual Cloudflare subdomain
  endpoint: 'https://referral-analytics.YOUR_SUBDOMAIN.workers.dev',

  // Enable analytics after deployment
  enabled: true, // Change from false to true

  // ... rest of config
};
```

### Step 7: Deploy Website to Cloudflare Pages

#### Option A: Deploy via GitHub

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit with analytics"
   git remote add origin https://github.com/YOUR_USERNAME/referral-website.git
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages:**
   - Go to: https://dash.cloudflare.com/pages
   - Click "Create a project"
   - Click "Connect to Git"
   - Select your repository
   - Configure:
     - **Framework preset:** None
     - **Build command:** (leave empty)
     - **Build output directory:** `/`
   - Click "Save and Deploy"

#### Option B: Deploy Directly

```bash
# Deploy the entire site
wrangler pages deploy . --project-name=referral-network
```

### Step 8: Set Up Custom Domain (Optional)

1. Go to: https://dash.cloudflare.com/pages
2. Select your project
3. Go to "Custom domains"
4. Click "Set up a custom domain"
5. Follow the DNS configuration instructions

---

## 📧 Email Configuration

The workers use **MailChannels** (free for Cloudflare Workers). No additional setup needed!

If you want to use a custom "From" email address:
1. Add your domain to Cloudflare
2. Update the `from.email` in both worker files:
   ```javascript
   from: {
     email: 'notifications@your-domain.com',
     name: 'Referral Network Notifications'
   }
   ```

### Alternative: Use SendGrid or Mailgun

If you prefer SendGrid/Mailgun, replace the email sending code in both workers:

**SendGrid Example:**
```javascript
await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: partnerEmail }] }],
    from: { email: 'notifications@yourdomain.com' },
    subject: subject,
    content: [{ type: 'text/plain', value: emailBody }]
  })
});
```

Then add your API key:
```bash
wrangler secret put SENDGRID_API_KEY --name referral-analytics
```

---

## 🧪 Testing

### Test Real-Time Notifications

1. Open your deployed site
2. Add `?ref=test-qr-001` to the URL
3. Click on a partner card
4. The partner should receive an email notification within seconds!

### Test Weekly Reports Manually

```bash
# Trigger a manual report (requires setting REPORT_SECRET first)
wrangler secret put REPORT_SECRET --name referral-weekly-report

# Then trigger manually:
curl -X POST https://referral-weekly-report.YOUR_SUBDOMAIN.workers.dev \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json"
```

### View Analytics Data

```bash
# Query the database directly
wrangler d1 execute referral-analytics-db --command="SELECT * FROM analytics_events LIMIT 10"
```

---

## 📊 Weekly Report Schedule

Reports are automatically sent **every Tuesday at 6:00 AM EST** (11:00 UTC).

To change the schedule, edit `wrangler.toml`:
```toml
[workers.triggers]
crons = ["0 11 * * 2"]  # Cron format: minute hour day month weekday
```

**Common schedules:**
- Every Monday at 9am EST: `"0 14 * * 1"`
- Every day at 6am EST: `"0 11 * * *"`
- First day of month at 8am EST: `"0 13 1 * *"`

---

## 🔍 Monitoring & Debugging

### View Worker Logs

```bash
# Real-time logs for analytics worker
wrangler tail referral-analytics

# Real-time logs for weekly report worker
wrangler tail referral-weekly-report
```

### Check D1 Database

```bash
# View recent events
wrangler d1 execute referral-analytics-db --command="
  SELECT event_type, partner_id, timestamp
  FROM analytics_events
  ORDER BY created_at DESC
  LIMIT 20
"

# Count events by type
wrangler d1 execute referral-analytics-db --command="
  SELECT event_type, COUNT(*) as count
  FROM analytics_events
  GROUP BY event_type
"
```

### Cloudflare Dashboard

- **Workers:** https://dash.cloudflare.com/workers
- **Pages:** https://dash.cloudflare.com/pages
- **D1 Database:** https://dash.cloudflare.com/d1

---

## 🛠️ Maintenance

### Update Partner Email Addresses

1. Edit `workers/analytics/index.js` and `workers/weekly-report/index.js`
2. Redeploy both workers:
   ```bash
   wrangler deploy workers/analytics/index.js
   wrangler deploy workers/weekly-report/index.js
   ```

### Add New Partners

1. Add their email to `PARTNER_EMAILS` in both worker files
2. Add their name to `PARTNER_NAMES` in both worker files
3. Redeploy both workers
4. Update the frontend HTML files

### Clear Old Data

```bash
# Delete events older than 90 days
wrangler d1 execute referral-analytics-db --command="
  DELETE FROM analytics_events
  WHERE timestamp < datetime('now', '-90 days')
"
```

---

## 💰 Cost Estimate

**Cloudflare Free Tier includes:**
- ✅ 100,000 Worker requests/day (plenty for analytics)
- ✅ 5 GB D1 database storage
- ✅ 100,000 emails/day via MailChannels
- ✅ Unlimited Pages deployments

**Expected monthly cost:** **$0** for most referral networks!

Only upgrade to paid if you exceed:
- 1+ million events/month
- 100+ partners with high traffic

---

## 🆘 Troubleshooting

### Emails Not Sending

**Problem:** Partners not receiving notifications

**Solution:**
1. Check worker logs: `wrangler tail referral-analytics`
2. Verify email addresses in `PARTNER_EMAILS`
3. Check spam folders
4. Ensure MailChannels isn't blocked

### Analytics Not Recording

**Problem:** No data in D1 database

**Solution:**
1. Verify `analytics.js` has `enabled: true`
2. Check browser console for errors
3. Verify Worker endpoint URL is correct
4. Test with: `wrangler tail referral-analytics`

### Weekly Reports Not Sending

**Problem:** No reports on Tuesday morning

**Solution:**
1. Check cron trigger: `wrangler deployments list referral-weekly-report`
2. View logs: `wrangler tail referral-weekly-report`
3. Trigger manually to test (see Testing section above)

---

## 📝 Next Steps

After deployment:
1. ✅ Test with a QR code: Add `?ref=qr-test-001` to your URL
2. ✅ Click on each partner card to trigger notifications
3. ✅ Wait for Tuesday at 6am for first weekly report
4. ✅ Monitor the Cloudflare dashboard for analytics

---

## 🎉 You're Done!

Your referral network now has:
- ✅ Real-time email notifications when cards are clicked
- ✅ Weekly analytics reports every Tuesday at 6am
- ✅ Full QR code tracking
- ✅ Partner engagement metrics
- ✅ Privacy-respecting, first-party analytics

Questions? Check the Cloudflare Workers docs: https://developers.cloudflare.com/workers/
