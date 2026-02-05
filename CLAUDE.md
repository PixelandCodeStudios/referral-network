# Referral Network Website - Project Overview

## Project Summary

A QR code-enabled referral network platform with real-time email notifications and weekly analytics. Built on Cloudflare Pages with Workers for serverless analytics and D1 for data storage.

## User Preferences

- **Auto-commit all changes**: Automatically commit all changes after completing tasks without asking for confirmation

## Live URLs

- **Main Site**: https://referral-website-5o3.pages.dev
- **Analytics Worker**: https://referral-analytics.contact-newleafllc.workers.dev
- **Weekly Report Worker**: https://referral-weekly-report.contact-newleafllc.workers.dev

## Architecture

### Frontend

- **Platform**: Cloudflare Pages
- **Files**: Static HTML/CSS/JS
- **Analytics**: Client-side tracking with localStorage persistence
- **Key Files**:
  - [index.html](index.html) - Main hub with partner cards
  - [styles.css](styles.css) - Global design system
  - [analytics.js](analytics.js) - Client-side tracking
  - Partner pages: [brian-dow.html](brian-dow.html), [joshua-naylor.html](joshua-naylor.html), [tiffany-mcalister.html](tiffany-mcalister.html), [tom-berry.html](tom-berry.html)

### Backend (Cloudflare Workers)

1. **Analytics Worker** ([workers/analytics/index.js](workers/analytics/index.js))
   - Real-time event processing
   - Email notifications via MailChannels
   - D1 database storage

2. **Weekly Report Worker** ([workers/weekly-report/index.js](workers/weekly-report/index.js))
   - Scheduled analytics summaries
   - Cron disabled (free plan limit) - trigger manually via HTTP POST
   - Partner performance metrics

### Database

- **Type**: Cloudflare D1 (SQLite)
- **Name**: referral-analytics-db
- **ID**: 50aa2341-12ad-406d-8905-f40b398c8dc0
- **Schema**: [workers/schema.sql](workers/schema.sql)

## Partners

### 1. Brian Dow - Healthcare Solutions Team

- **Website**: https://myhst.com
- **Email**: sales@myhst.com
- **Phone**: (630) 261-3000
- **Service**: Health Insurance Solutions
- **Brand Colors**: Blue (#0B70BE), Green (#09A223)
- **Page**: [brian-dow.html](brian-dow.html)

### 2. Joshua Naylor - The Naylor Group

- **Website**: https://thenaylorgroup.com
- **Email**: josh@thenaylorgroup.com
- **Phone**: (727) 482-6093
- **Service**: Mortgage Lending
- **Brand Colors**: Red (#d13030, #CA2C1D)
- **Page**: [joshua-naylor.html](joshua-naylor.html)

### 3. Tiffany McAlister - Dream Living Florida

- **Website**: https://dreamlivingflorida.com
- **Email**: tiffany@dreamlivingflorida.com
- **Phone**: (417) 522-5669
- **Service**: Real Estate
- **Brand Colors**: Teal (#008CBA), Green (#0fc502)
- **Page**: [tiffany-mcalister.html](tiffany-mcalister.html)

### 4. Tom Berry - Longview Wealth Advisors

- **Website**: http://www.longviewwealthadvisors.com
- **Email**: info@longviewwealthadvisors.com
- **Service**: Wealth Management
- **Brand Colors**: Dark Forest Green (#2d5f4f), Bright Green (#00a651)
- **Page**: [tom-berry.html](tom-berry.html)

## Analytics Events

### Event Types

1. **qr_scan** - User scans QR code with ?ref= parameter
2. **partner_click** - User clicks partner card on hub
3. **partner_page_view_from_hub** - User views partner detail page from hub
4. **external_site_click** - User clicks "Visit Website" button
5. **contact_submit** - User submits contact form

### Real-Time Notifications

Partners receive instant emails when:

- Someone clicks their card
- Someone views their detail page
- Someone submits their contact form
- Someone clicks through to their website

Email includes: referrer ID, timestamp, source, and user location data.

## Deployment

### Deploy Website

```bash
wrangler pages deploy . --project-name=referral-website
```

### Deploy Workers

```bash
# Analytics worker
cd workers/analytics
wrangler deploy

# Weekly report worker
cd workers/weekly-report
wrangler deploy
```

### Database Operations

```bash
# Run schema migration
wrangler d1 execute referral-analytics-db --file=workers/schema.sql

# Query events
wrangler d1 execute referral-analytics-db --command="SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 10"

# Count events by type
wrangler d1 execute referral-analytics-db --command="SELECT event_type, COUNT(*) as count FROM analytics_events GROUP BY event_type"
```

### Monitor Workers

```bash
# Real-time logs for analytics
wrangler tail referral-analytics

# Real-time logs for weekly reports
wrangler tail referral-weekly-report
```

## Weekly Reports

**Status**: Cron trigger disabled (free plan has 5 cron limit exceeded)

### Manual Trigger

```bash
curl -X POST https://referral-weekly-report.contact-newleafllc.workers.dev \
  -H "Content-Type: application/json"
```

### Scheduled Time (when enabled)

- **Frequency**: Every Tuesday
- **Time**: 11:00 UTC (6:00 AM EST)
- **Cron**: `0 11 * * 2`

### To Enable Cron

1. Upgrade Cloudflare plan OR remove other cron triggers
2. Uncomment in [workers/weekly-report/wrangler.toml](workers/weekly-report/wrangler.toml):

```toml
[triggers]
crons = ["0 11 * * 2"]
```

3. Redeploy: `wrangler deploy`

## QR Code Usage

### Generate QR Codes

Create QR codes pointing to:

```
https://referral-website-5o3.pages.dev?ref=qr-LOCATION-NUMBER
```

Examples:

- `?ref=qr-office-001` - Office location #1
- `?ref=qr-event-conference2024` - Specific event
- `?ref=qr-partner-brian` - Brian's personal card

### Analytics Tracking

The `?ref=` parameter:

1. Gets stored in localStorage
2. Fires a `qr_scan` event
3. Persists across page views
4. Appears in all analytics reports

## Configuration Files

### Worker Configuration

- [workers/analytics/wrangler.toml](workers/analytics/wrangler.toml)
- [workers/weekly-report/wrangler.toml](workers/weekly-report/wrangler.toml)

Both include:

- D1 database binding
- Environment variables (FROM_EMAIL, FROM_NAME)
- Database ID: 50aa2341-12ad-406d-8905-f40b398c8dc0

### Email Configuration

Workers use **MailChannels** (free for Cloudflare Workers):

- No API key required
- No setup needed
- Sends from: notifications@referralnetwork.com / reports@referralnetwork.com
- Can be customized to use custom domain

## Design System

### Colors

- Background: #fafaf9 (warm off-white)
- Card background: #ffffff
- Text primary: #1a1816
- Text secondary: #5f5d5a
- Accent: #6b7d8f

### Partner Brand Integration

Each partner page has custom CSS matching their website:

- Brand-specific color variables
- Custom button styles
- Typography matching their site
- Gradient hero sections

### Card Specifications

- **Avatar**: 160px × 160px square with rounded corners
- **Border**: 2px solid with subtle color
- **Shadow**: 0 2px 8px rgba(0, 0, 0, 0.08)
- **Hover**: Lifts 3px with enhanced shadow
- **Padding**: 3rem (48px)

## Development

### Local Testing

```bash
# Serve locally
python3 -m http.server 8000

# Test worker locally
cd workers/analytics
wrangler dev

# Query local D1
wrangler d1 execute referral-analytics-db --local --command="SELECT * FROM analytics_events"
```

### Adding New Partners

1. Add partner info to [index.html](index.html)
2. Create partner page (e.g., `new-partner.html`)
3. Add email to `PARTNER_EMAILS` in both workers
4. Add name to `PARTNER_NAMES` in both workers
5. Add headshot to `images/` folder
6. Redeploy workers

## Troubleshooting

### Emails Not Sending

1. Check worker logs: `wrangler tail referral-analytics`
2. Verify email addresses in worker code
3. Check spam folders

### Analytics Not Recording

1. Ensure `analytics.js` has `enabled: true`
2. Check browser console for errors
3. Verify Worker endpoint URL is correct
4. Test with: `wrangler tail referral-analytics`

### Weekly Reports Not Triggering

- **Current Status**: Cron disabled due to account limit
- **Solution**: Trigger manually via HTTP POST or upgrade plan

## Security

### CORS

Workers accept requests from:

- https://referral-website-5o3.pages.dev
- localhost (for development)

### Data Privacy

- No third-party analytics
- First-party data only
- IP addresses hashed
- No PII stored beyond events

## Future Enhancements

- [ ] Dashboard for viewing analytics
- [ ] Partner-specific login for viewing their stats
- [ ] Custom QR code generator
- [ ] A/B testing for card designs
- [ ] Referral conversion tracking
- [ ] SMS notifications option
- [ ] Multi-language support

## Important Commands

```bash
# Deploy everything
wrangler pages deploy . --project-name=referral-website
cd workers/analytics && wrangler deploy
cd ../weekly-report && wrangler deploy

# View logs
wrangler tail referral-analytics
wrangler tail referral-weekly-report

# Query database
wrangler d1 execute referral-analytics-db --command="SELECT COUNT(*) FROM analytics_events"

# Trigger weekly report
curl -X POST https://referral-weekly-report.contact-newleafllc.workers.dev
```

## Support

- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers: https://dash.cloudflare.com/workers
- D1 Database: https://dash.cloudflare.com/d1
- Pages: https://dash.cloudflare.com/pages
