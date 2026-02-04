# Referral Partner Website System

A privacy-respecting, trust-forward referral platform designed for Cloudflare Pages deployment. This system consists of two interconnected websites: a neutral Referral Hub and individual Partner Expansion Pages.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [File Structure](#file-structure)
- [Design Philosophy](#design-philosophy)
- [Style System Architecture](#style-system-architecture)
- [Analytics System](#analytics-system)
- [Partner Data Integration](#partner-data-integration)
- [Deployment Guide](#deployment-guide)
- [Future Enhancements](#future-enhancements)

---

## 🎯 Project Overview

### Website 1: Referral Hub (`index.html`)
**Purpose:** Single landing page accessed via QR codes

**Features:**
- Displays 6-7 curated partner cards
- Mobile-first design (QR-scan context)
- Trust-forward presentation
- Equal visual weight for all partners
- First-party analytics tracking

**User Flow:**
```
QR Scan → Hub Landing → Partner Selection → Partner Detail Page
```

### Website 2: Partner Pages (`partner.html`)
**Purpose:** Individual partner profiles with brand expression

**Features:**
- Extended partner biography
- Brand-aware styling (colors/fonts from partner's website)
- Optional contact form
- Hub-origin context awareness
- Referral attribution preservation

---

## 📁 File Structure

```
referral Website/
├── index.html          # Referral Hub landing page
├── partner.html        # Partner page template
├── styles.css          # Complete design system with CSS variables
├── analytics.js        # Client-side analytics & context management
└── README.md           # This file
```

---

## 🎨 Design Philosophy

### Core Principles

**Trust-Forward, Not Sales-Driven**
- Calm, neutral aesthetic
- No promotional language
- Equal partner presentation
- Human-centered design

**Visual Synthesis**
- Design reflects multiple brands without privileging any single one
- Colors and typography are blended algorithmically
- Feels unified, intentional, and cohesive

**Privacy-Respecting**
- First-party analytics only
- No third-party trackers
- Transparent data practices
- User-owned data

---

## 🏗️ Style System Architecture

The design system is built in **three layers**:

### Layer 1: Base Neutral System

A foundational design language that never gets fully overridden.

**Defined in:** `styles.css` root variables

```css
:root {
  /* Neutral color palette */
  --color-bg-primary: #fafaf9;
  --color-text-primary: #1a1816;
  --color-border-subtle: #e7e5e1;

  /* Typography system */
  --font-primary: -apple-system, BlinkMacSystemFont, ...;
  --font-size-base: 1rem;
  --line-height-relaxed: 1.75;

  /* Spacing rhythm */
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  ...
}
```

**Purpose:**
- Ensures readability and accessibility
- Provides consistent spacing and hierarchy
- Acts as a visual "container" for stylistic variation

---

### Layer 2: Partner Style Extraction (Future)

When you provide partner websites and headshots, the system will extract:

#### From Each Partner Website:
- **Primary color:** Dominant brand color (from h1, buttons, links)
- **Secondary color:** Accent color
- **Font families:** Headline and body fonts
- **Border radius:** Shape language (rounded vs. sharp)
- **Visual density:** Spacing tendencies (airy vs. compact)
- **Tone indicators:** Formal, friendly, bold, minimal

#### From Headshots:
- **Dominant color range:** Warm vs. cool bias
- **Contrast level:** High vs. low contrast
- **Saturation:** Vibrant vs. muted

**Data Structure (Placeholder):**
```javascript
// This is what you'll provide when ready
const partnerStyleData = {
  "partner-001": {
    extracted: {
      primaryColor: "#4A7C9E",
      secondaryColor: "#9E7C4A",
      headlineFont: "Montserrat",
      bodyFont: "Open Sans",
      borderRadius: "8px",
      density: "airy",
      tone: "professional"
    },
    headshot: {
      dominantColor: "#8B7355",
      warmCool: "warm",
      contrast: "medium"
    }
  },
  // ... more partners
};
```

---

### Layer 3: Style Normalization & Synthesis

**Purpose:** Blend extracted partner styles into a cohesive hub aesthetic.

#### Synthesis Rules:

**Color Blending:**
```javascript
// Pseudocode for future implementation
function synthesizeColors(partnerColors) {
  // 1. Average hue values across all partners
  const avgHue = average(partnerColors.map(c => c.hue));

  // 2. Reduce saturation for calmness
  const neutralizedSaturation = avgHue * 0.6;

  // 3. Clamp contrast to WCAG AA standards
  const accessibleColor = ensureContrast(color, 4.5);

  // 4. No single partner contributes more than 20%
  const weightedColor = weightedAverage(partnerColors, maxWeight: 0.2);

  return weightedColor;
}
```

**Typography Mapping:**
- Select ONE primary font that harmonizes with most partners
- Map partner fonts to secondary/accent usage
- Never mix more than two font families on the hub

**Spacing Normalization:**
- Normalize border radius to median value across partners
- Normalize spacing rhythm based on average density

**Weighting Rules:**
- No single partner contributes more than 20% to the final aesthetic
- Hub style must feel "greater than the sum" of individual parts

---

### Application Rules

#### Referral Hub (`index.html`):
- ✅ Uses synthesized composite style only
- ❌ No per-partner overrides
- ✅ Visual equality enforced

#### Partner Pages (`partner.html`):
- ✅ May selectively reintroduce that partner's extracted styles
- ✅ Must retain base spacing and hierarchy
- ✅ Colors and fonts may be overridden within defined bounds

**Example per-partner override:**
```html
<!-- Injected in <head> of partner.html -->
<style>
  :root {
    --color-accent-primary: #4A7C9E;     /* From partner site */
    --color-accent-secondary: #9E7C4A;   /* From partner site */
    --font-primary: 'Montserrat', sans-serif; /* From partner site */
  }
</style>
```

---

## 📊 Analytics System

### Overview
First-party, privacy-respecting analytics powered by Cloudflare Workers.

**File:** `analytics.js`

### Tracked Events

| Event Type | Fires When | Purpose |
|-----------|-----------|---------|
| `qr_scan` | User visits hub with `?ref=` parameter | Track QR code effectiveness |
| `partner_click` | User clicks partner card on hub | Understand partner interest |
| `partner_page_view_from_hub` | Partner page loaded with `?source=hub` | Validate flow integrity |
| `partner_page_view_direct` | Partner page loaded without hub context | Track direct access |
| `contact_submit` | Contact form submitted | Track conversions |
| `external_site_click` | User clicks "Visit Website" | Track outbound referrals |

### Context Preservation

**URL Parameter Flow:**
```
QR Scan → ?ref=qr-abc123
Hub Visit → localStorage: { ref_id: 'qr-abc123' }
Partner Click → ?id=partner-001&source=hub&ref=qr-abc123
Partner Page → Preserves context in forms and back links
```

### Storage
- **Client-side:** localStorage (referrer ID, session ID)
- **Server-side:** Cloudflare D1 database (future implementation)

### Implementation Status

**✅ Completed:**
- Client-side tracking hooks
- Context preservation logic
- Event payload structure
- localStorage management

**⏳ Future Implementation:**
- Cloudflare Worker endpoint (`/api/analytics`)
- D1 database schema and storage
- Analytics dashboard

**Setup Instructions:**
```bash
# 1. Create Cloudflare Worker
wrangler generate analytics-worker

# 2. Create D1 database
wrangler d1 create referral-analytics

# 3. Run schema migration
wrangler d1 execute referral-analytics --file=schema.sql

# 4. Deploy Worker
wrangler publish
```

**Database Schema:**
```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  referrer_id TEXT,
  partner_id TEXT,
  timestamp TEXT NOT NULL,
  url TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_type ON analytics_events(event_type);
CREATE INDEX idx_referrer_id ON analytics_events(referrer_id);
CREATE INDEX idx_partner_id ON analytics_events(partner_id);
```

---

## 👥 Partner Data Integration

### Current State: Real Partners Integrated

**✅ UPDATED:** Real partner data has been integrated for the following partners:

1. **Brian Dow** - Healthcare Solutions Team
   - Website: [myhst.com](https://myhst.com)
   - Services: Health insurance solutions
   - Brand colors: Blue (#0B70BE) and Green (#09A223)
   - Files: `brian-dow.html`, `images/brian-dow.jpg`

2. **Joshua Naylor** - The Naylor Group
   - Website: [thenaylorgroup.com](https://thenaylorgroup.com)
   - Services: Mortgage lending
   - Brand colors: Red (#d13030, #CA2C1D)
   - Files: `joshua-naylor.html`, `images/joshua-naylor.jpg`

3. **Tiffany McAlister** - Dream Living Florida
   - Website: [dreamlivingflorida.com](https://dreamlivingflorida.com)
   - Services: Real estate (Florida REALTOR®)
   - Brand colors: Teal (#008CBA) and Green (#0DAC02)
   - Files: `tiffany-mcalister.html`, `images/tiffany-mcalister.jpg`

4. **Tom Berry** - Longview Wealth Advisors
   - Website: [longviewwealthadvisors.com](http://www.longviewwealthadvisors.com/)
   - Services: Wealth management & financial planning
   - Brand colors: Dark Forest Green (#2d5f4f) and Bright Green (#00a651)
   - Files: `tom-berry.html`, `images/tom-berry.jpg`

Remaining partners (5-7 on the hub page) are still **placeholder content**.

### Future: Dynamic Partner Data

When you're ready to integrate real partner data, you have three options:

---

#### Option 1: Static HTML Generation (Simplest)

**Best for:** Small number of partners (< 20)

**Process:**
1. Create one HTML file per partner: `partner-001.html`, `partner-002.html`
2. Replace placeholder content with real data
3. Customize styles inline per partner

**Pros:**
- No backend required
- Fast performance
- Easy to maintain

**Cons:**
- Manual updates required
- No central data source

---

#### Option 2: JSON Data + Client-Side Rendering

**Best for:** Medium number of partners (20-50)

**Process:**
1. Create `partners.json` with all partner data:
```json
{
  "partners": [
    {
      "id": "partner-001",
      "name": "Alexandra Chen",
      "role": "Financial Planning",
      "blurb": "...",
      "bio": "...",
      "avatarUrl": "/images/alexandra-chen.jpg",
      "websiteUrl": "https://alexandrachen.com",
      "email": "alexandra@example.com",
      "styles": {
        "primaryColor": "#4A7C9E",
        "secondaryColor": "#9E7C4A",
        "font": "Montserrat"
      }
    }
  ]
}
```

2. Fetch and render with JavaScript:
```javascript
// On hub page
fetch('partners.json')
  .then(res => res.json())
  .then(data => renderPartnerCards(data.partners));

// On partner page
const partnerId = new URLSearchParams(location.search).get('id');
fetch('partners.json')
  .then(res => res.json())
  .then(data => renderPartnerPage(data.partners.find(p => p.id === partnerId)));
```

**Pros:**
- Centralized data
- Easy to update
- Still static hosting

**Cons:**
- Requires JavaScript
- SEO considerations
- All data loaded upfront

---

#### Option 3: Cloudflare Workers + KV Storage (Most Scalable)

**Best for:** Large number of partners (50+)

**Process:**
1. Store partner data in Cloudflare KV:
```bash
wrangler kv:namespace create PARTNERS
wrangler kv:key put --binding=PARTNERS partner-001 ./partner-001.json
```

2. Create Worker to serve dynamic pages:
```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const partnerId = url.searchParams.get('id');

    // Fetch partner data from KV
    const partnerData = await env.PARTNERS.get(partnerId, 'json');

    // Render template with data
    return new Response(renderTemplate(partnerData), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
```

**Pros:**
- Fully dynamic
- Scalable to thousands of partners
- Can integrate with CMS or API
- Server-side rendering (good for SEO)

**Cons:**
- More complex setup
- Requires Cloudflare Workers (paid plan for high traffic)

---

### Recommended Approach

**Start with Option 1 (Static HTML)**
- Get feedback on design and structure
- Validate the concept with real partners

**Scale to Option 3 (Workers + KV)**
- When you have 10+ partners
- When you need frequent updates
- When you want CMS integration

---

## 🚀 Deployment Guide

### Cloudflare Pages Setup

**1. Connect Repository:**
```bash
# Push to GitHub
git init
git add .
git commit -m "Initial referral platform"
git remote add origin https://github.com/yourusername/referral-website.git
git push -u origin main
```

**2. Create Cloudflare Pages Project:**
- Go to Cloudflare Dashboard → Pages
- Click "Create a project"
- Connect to your GitHub repository
- Configure build settings:
  - **Build command:** (leave empty, static HTML)
  - **Build output directory:** `/`
  - **Root directory:** `/`

**3. Deploy:**
- Click "Save and Deploy"
- Your site will be live at: `https://your-project.pages.dev`

**4. Custom Domain (Optional):**
- Pages → Custom domains → Add domain
- Add DNS records as instructed
- Enable HTTPS

---

### Local Development

**Option 1: Simple HTTP Server**
```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

**Option 2: Cloudflare Wrangler (Recommended)**
```bash
# Install Wrangler
npm install -g wrangler

# Run local dev server
wrangler pages dev .
```

---

## 🔮 Future Enhancements

### Phase 1: Core Functionality (Current)
- ✅ Static HTML structure
- ✅ CSS design system
- ✅ Analytics hooks (client-side)
- ✅ Mobile-first responsive design

### Phase 2: Analytics Implementation
- ⏳ Cloudflare Worker for event tracking
- ⏳ D1 database for event storage
- ⏳ Simple analytics dashboard
- ⏳ Partner performance reports

### Phase 3: Partner Brand Integration
- ⏳ Website scraping for colors/fonts
- ⏳ Algorithmic style synthesis
- ⏳ Per-partner style generation
- ⏳ Dynamic style injection

### Phase 4: Dynamic Content
- ⏳ JSON data source or CMS integration
- ⏳ Cloudflare Workers for server-side rendering
- ⏳ KV storage for partner data
- ⏳ Admin interface for partner management

### Phase 5: Advanced Features
- ⏳ Partner testimonials (opt-in)
- ⏳ Video introductions
- ⏳ Calendar integration for bookings
- ⏳ Multi-language support
- ⏳ A/B testing framework

---

## 🎯 Next Steps

### Immediate (When You're Ready):

1. **Provide Partner Data:**
   - Partner names, roles, bios
   - Headshots or placeholder images
   - Website URLs
   - Contact information

2. **Test QR Codes:**
   - Generate QR codes with unique `?ref=` parameters
   - Example: `https://yoursite.com/?ref=qr-business-card-001`

3. **Review Design:**
   - Open `index.html` in browser
   - Test on mobile device (QR-scan context)
   - Provide feedback on styling, copy, layout

### Short-Term (Next 2-4 Weeks):

4. **Implement Analytics Backend:**
   - Create Cloudflare Worker
   - Set up D1 database
   - Test event tracking end-to-end

5. **Deploy to Production:**
   - Push to GitHub
   - Connect to Cloudflare Pages
   - Configure custom domain

6. **Brand Scraping:**
   - Extract colors/fonts from partner websites
   - Test synthesis algorithm
   - Generate per-partner stylesheets

### Long-Term (Next 1-3 Months):

7. **Scale to Dynamic System:**
   - Migrate to Workers + KV storage
   - Build partner management interface
   - Integrate with CMS (if needed)

8. **Gather Insights:**
   - Monitor analytics dashboard
   - Identify most effective QR codes
   - Track partner conversion rates
   - Iterate based on data

---

## 📝 Notes

### Design Tokens Reference

All design tokens are defined in `styles.css` as CSS variables. Key categories:

- **Colors:** `--color-*`
- **Typography:** `--font-*`, `--font-size-*`, `--font-weight-*`
- **Spacing:** `--space-*`
- **Layout:** `--width-*`
- **Radius:** `--radius-*`
- **Shadows:** `--shadow-*`

### Browser Support

This system is built with modern web standards and supports:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android 90+)

### Accessibility

- Semantic HTML throughout
- ARIA labels where appropriate
- Keyboard navigation support
- Color contrast meets WCAG AA standards
- Focus states for all interactive elements
- Screen reader friendly

---

## 🤝 Contributing

This is a private project, but if you're collaborating:

1. Follow the existing code style and commenting patterns
2. Test all changes on mobile (QR-first context)
3. Ensure analytics hooks are preserved
4. Maintain the neutral, trust-forward aesthetic

---

## 📄 License

Private project. All rights reserved.

---

**Built with care for trust, privacy, and human connection.**
