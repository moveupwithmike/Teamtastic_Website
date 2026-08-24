# Teamtastic Brand Design System & Site Architecture

> **Living Document** — This is the single source of truth for all visual, structural, and content decisions for `teamtastic.events`. All development must align with the approved mockup and this specification.

---

## 0. Approved Visual Mockup

The hero design is locked based on the approved high-fidelity mockup. **All development must faithfully reproduce this vision in code.**

Key elements visible in the mockup that must be replicated exactly:

| Element | Mockup Spec |
| :--- | :--- |
| **Background** | Deep navy-to-purple radial gradient (#0a0a2e → #1a0a3e → #0d0d1a). NOT flat black. |
| **Emcee** | Real photographic-style person (bald, Black man with short beard). Warm, open-handed welcoming pose — NOT a wave, NOT a rigid stance. Arms open wide gesturing to the stage. |
| **Polo shirt** | Dark navy/black polo with the **Teamtastic logo icon** + text "Teamtastic" printed in **full color** (purple/orange/gold) — not monochrome. |
| **Game on stage** | "What the Meme" game overlay card visible behind/around the emcee. Shows a cat meme card and a blank white card. |
| **Stage lighting** | Neon purple and pink spot-light beams angled from top corners. Hot pink neon border framing the center stage tile. |
| **Webcam tiles** | **6 real-looking participant tiles** — 3 on the left column, 3 on the right column. People are smiling, happy, engaged. Diverse group (women and men of different ethnicities). NO duplicate tiles. |
| **Chat bubbles** | Floating blue/purple chat (...) bubbles visible on LEFT and RIGHT of the window frame — outside the game window, overlaying the background. |
| **Floating emoji reactions** | 🎉 (confetti) top-left area, 🔥 bottom-left, 👏 / 😍 / ❤️ on the right — scattered in background around the window frame. |
| **Window chrome** | macOS-style window with 3 control dots (red, amber, green) + center label "Virtual Event - Live Now". No platform branding (no Zoom/Teams logos). |
| **Tagline** | "Play. Connect." in bold white Outfit sans-serif. "Celebrate." in neon pink Caveat script, glowing. |
| **CTA button** | Single primary CTA "Book an Event" with purple-to-pink gradient. Centered below tagline. |
| **Teamtastic logo** | Top-left of the full composition. Logo icon (2 people high-five) + "Teamtastic" wordmark in white. |

---

## 1. Visual Philosophy & Creative Direction

Teamtastic's aesthetic is **live television energy meets modern SaaS design** — the Google of virtual game shows. The visual language signals "this is premium, fun, and actually works."

### Three Core Aesthetic Pillars

1. **Deep Space Energy** — Rich midnight backgrounds (#030712 to #0f172a) with glowing radial purple/pink halos give the feeling of a televised broadcast in a darkened studio.
2. **Neon Pop Accents** — High-saturation purples (#8b5cf6), cyber pinks (#ec4899), solar oranges (#f97316), and championship golds (#fbbf24) feel electric against the dark backdrop. They appear only in gradients, text highlights, icon strokes, and interactive state changes.
3. **Glassmorphism** — All UI panels (the mock app window, navbar, cards, chat bubbles) float on frosted glass layers using `backdrop-filter: blur()`. This creates depth without visual noise.

### What This Is NOT
- ❌ Not a plain white/light-mode corporate SaaS (no Bootstrap or generic blue)
- ❌ Not flat and static (every key element should animate or have a hover state)
- ❌ Not consumer/casual (this must feel premium enough for HR directors to trust with their company budget)

---

## 2. Color Palette & Tokens

Defined in [`src/app/globals.css`](file:///Users/moveupwithmike/Documents/Teamtastic/Teamtastic_Website/src/app/globals.css) using Tailwind CSS v4 `@theme` bindings:

```css
@theme {
  --color-brand-purple:      #8b5cf6;   /* Primary — Electric Violet */
  --color-brand-purple-dark: #6d28d9;   /* Gradient Anchor — Deep Royal */
  --color-brand-pink:        #ec4899;   /* Accent — Cyber Pink */
  --color-brand-orange:      #f97316;   /* Energy — Solar Orange */
  --color-brand-gold:        #fbbf24;   /* Trophy — Championship Gold */
  --color-brand-dark:        #030712;   /* Base Background — Rich Black */
  --color-brand-card:        #0f172a;   /* Card Base — Deep Ocean Navy */
}
```

### Color Roles

| Color | Primary Use Cases |
| :--- | :--- |
| `brand-purple` | Primary CTA gradient start, icon accents, link hovers, glow effects |
| `brand-pink` | CTA gradient end, "Celebrate." text glow, Live badge highlights |
| `brand-orange` | Logo icon accent, emcee shirt icon detail, game badge "High Energy" |
| `brand-gold` | Trophy/award icons, sparkle animations, stats highlights |
| `brand-dark` | Page background, scrollbar track |
| `brand-card` | Section panel backgrounds, glassmorphism overlays |

### Gradient Recipes

```css
/* Primary CTA Gradient (purple → pink) */
background: linear-gradient(135deg, #8b5cf6, #ec4899);

/* Hero background radial (matches mockup dark navy-purple) */
background: radial-gradient(ellipse at top, rgba(88, 28, 235, 0.25), #030712 70%);

/* Ambient pink bloom behind hero window */
background: radial-gradient(ellipse 600px 300px at 50% 60%, rgba(236, 72, 153, 0.05), transparent);
```

---

## 3. Typography System

### Font Stack

| Font | Variable | Role | Weights |
| :--- | :--- | :--- | :--- |
| **Outfit** | `--font-outfit` | All body copy, headers, nav, pricing, forms | 300, 400, 500, 600, 700, 800 |
| **Caveat** | `--font-caveat` | Emotional highlight phrases ONLY (e.g., "Celebrate.") | 400, 700 |

### Typography Scale

| Style | Class | Usage |
| :--- | :--- | :--- |
| Hero H1 | `text-5xl sm:text-7xl font-extrabold` | "Play. Connect." |
| Hero Script | `font-script text-5xl sm:text-7xl rotate-[-2deg]` | "Celebrate." |
| Section H2 | `text-3xl sm:text-5xl font-extrabold` | "Our Game Catalog" |
| Card H3 | `text-2xl font-bold` | Game/feature card titles |
| Body | `text-base sm:text-lg text-zinc-400` | Description paragraphs |
| Micro Label | `text-xs font-bold uppercase tracking-widest text-zinc-500` | Stats labels, badges |

### The "Celebrate." Effect

This is a signature brand moment. Must be implemented exactly:
```jsx
<span className="block font-script text-brand-pink neon-glow-pink text-5xl sm:text-7xl 
                 rotate-[-2deg] transform origin-center">
  Celebrate.
</span>
```
```css
/* In globals.css */
.neon-glow-pink {
  text-shadow: 0 0 8px rgba(236, 72, 153, 0.7),
               0 0 16px rgba(236, 72, 153, 0.4),
               0 0 24px rgba(236, 72, 153, 0.2);
}
```

---

## 4. Hero Component Specification

The hero is the most critical element. It must match the approved mockup precisely.

### Layout Structure
```
[FULL-WIDTH HERO SECTION]
├── Background: deep radial gradient (navy-purple)
├── Top-left: Teamtastic logo + wordmark
│
├── CENTER: Mock web conferencing app window
│   ├── Window chrome: 3 macOS dots + "Virtual Event - Live Now"
│   ├── Grid (12 cols):
│   │   ├── [3 cols] LEFT: 3 participant webcam tiles (real photo-style)
│   │   ├── [6 cols] CENTER: Emcee stage
│   │   │   ├── "What the Meme" game overlay card (top center)
│   │   │   ├── Neon purple/pink stage border + lighting beams
│   │   │   ├── EMCEE: Photographic, bald Black man, open-hand pose
│   │   │   ├── Floating emojis (🔥👏🎉😍❤️) rising from bottom
│   │   │   └── Live chat bubbles sliding up from bottom-left
│   │   └── [3 cols] RIGHT: 3 participant webcam tiles
│   └── Bottom bar: mic/camera controls + "Live Stream Connected" + "Leave Lobby"
│
├── FLOATING outside the window: chat bubble icons (left & right)
├── FLOATING outside the window: emoji reactions (corners)
│
└── BELOW window:
    ├── H1: "Play. Connect." (bold white) + "Celebrate." (neon pink script)
    └── CTA: "Book an Event" (purple→pink gradient button)
```

### Emcee Implementation Note

The current SVG-drawn character in `Hero.js` does **not** match the approved mockup. The mockup shows a photographic-quality illustration. The correct implementation should use either:
- **Option A**: A high-quality photographic cutout PNG of the founder (preferred for authenticity)
- **Option B**: A photorealistic AI-generated illustration placed as a `<img>` or `<Image>` tag
- **Option C** (current fallback): The SVG must be substantially upgraded with detailed shading, skin tone gradient fills, and the colored logo properly rendered

The polo shirt logo must show the **Teamtastic icon in purple/orange + "Teamtastic" text in gold** — never a monochrome version.

### Participant Webcam Tiles
- 6 tiles total: 3 left column, 3 right column
- Each tile: gradient avatar initials (letter) with colored gradient background
- Show a name label badge in bottom-left corner of each tile
- Person avatars use distinct gradient pairs (no two tiles with same color)
- Tile backgrounds are `bg-zinc-900/60` with `border border-white/5`

### Chat Bubbles (Framer Motion)
- Rendered inside the stage using `<AnimatePresence>`
- Slide in from bottom: `initial={{ opacity: 0, y: 15 }}` → `animate={{ opacity: 1, y: 0 }}`
- Max 3 visible at once, oldest auto-removed
- User label in `text-purple-300`, message text in `text-zinc-100`
- Bubble container uses `.glassmorphism` class + `rounded-2xl`

### Floating Emoji Engine (Framer Motion)
- Emojis spawn at bottom of stage, float upward with `y: 350 → -50`
- Weave horizontally using `Math.sin(id) * 30`
- Random scale between 1.0–2.5, random x-offset ±100px
- 4 second lifetime, fade-out at top

---

## 5. Glassmorphism System

```css
/* Panel glassmorphism — navbar, hero window, section overlays */
.glassmorphism {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* Card glassmorphism — game cards, pricing blocks, chat bubbles */
.glassmorphism-card {
  background: rgba(30, 41, 59, 0.45);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

---

## 6. Micro-Animation Standards

| Element | Behavior | Implementation |
| :--- | :--- | :--- |
| **CTA Buttons** | Lift on hover + glow intensifies | `hover:-translate-y-1 transition-all duration-300` |
| **Game cards** | Lift on hover, title color shifts to purple | `hover:-translate-y-1 group-hover:text-purple-300` |
| **Navbar** | Transparent → glassmorphism on scroll | `window.scrollY > 10` triggers `glassmorphism` class |
| **Live ping dot** | Radar pulse animation | `animate-ping` on `bg-emerald-500` dot |
| **Sparkles icon** | Slow spin | `animate-spin-slow` (custom class needed) or `animate-pulse` |
| **Emoji engine** | Float up + weave + fade | Framer Motion `AnimatePresence` |
| **Chat feed** | Slide up + fade in | Framer Motion `AnimatePresence`, 0.4s ease |
| **Stat numbers** | Count up animation (future) | `useInView` + counter hook |

---

## 7. Full Site Architecture & Page Plan

### Primary Navigation (Navbar)

```
Logo | Virtual Team Building | Games | Why Teamtastic | Resources | Blog | Pricing | [Host Login] [Book an Event ▶]
```

### Complete Page Structure

```
teamtastic.events/
├── /                          # Homepage (Hero + Stats + Games + Use Cases + Quiz + Pricing + Footer)
├── /virtual-team-building     # ★ SEO CORNERSTONE PAGE
├── /why-teamtastic            # ★ Trust & Authority page
├── /pricing                   # Dedicated standalone pricing page
├── /games/                    # Game catalog index
│   ├── /games/survey-showdown
│   ├── /games/lightning-feud
│   ├── /games/meme-battle
│   └── /games/sound-bite-trivia
├── /use-cases/                # Use case landing pages
│   ├── /use-cases/hr-and-people-ops
│   ├── /use-cases/remote-engineering-teams
│   ├── /use-cases/virtual-intern-cohorts
│   └── /use-cases/private-vip-socials
├── /resources/                # ★ SEO Hub (resource center)
│   ├── /resources/how-it-works
│   ├── /resources/faq
│   └── /resources/event-planning-guide
└── /blog/                     # ★ SEO Blog
    ├── /blog/virtual-team-building-ideas
    ├── /blog/remote-team-engagement-tips
    ├── /blog/virtual-icebreaker-games
    └── /blog/corporate-game-show-activities
```

---

## 8. Page Specifications

### 8.1 Homepage (`/`)
**Goal**: Convert visitors into leads or trial users within 60 seconds.

**Sections (top to bottom)**:
1. **Navbar** — Sticky glassmorphic header with full navigation
2. **Hero** — Interactive mock virtual event window (per spec above)
3. **Social Proof Banner** — Stats: "40k+ Players", "98% Engagement", "1,200+ Lobbies", "0 Downloads"
4. **Game Catalog** — 4-column grid of game cards with badges + hover effects
5. **How It Works** — 3-step visual flow: "Book → Brief → Go Live"
6. **Use Cases Grid** — 4 audience segments with gradient icon cards
7. **Testimonials** — 3 rotating B2B client quotes with company names
8. **"Find Your Event" Quiz** — 4-step interactive lead capture wizard (GameQuiz component)
9. **Pricing** — 3-tier pricing grid (see Section 9)
10. **Footer** — Links, platform badges, legal

---

### 8.2 Virtual Team Building Page (`/virtual-team-building`) ★ PRIORITY SEO PAGE
**Goal**: Rank #1 for "virtual team building activities" and related high-volume terms.

**Meta**:
- `<title>`: Virtual Team Building Activities & Games | Teamtastic
- `<description>`: Discover the best virtual team building activities for remote teams. From live-hosted game shows to self-service trivia, Teamtastic delivers real engagement for teams of 5–500+.

**Content Sections**:
1. **H1**: "The Best Virtual Team Building Activities for Remote & Hybrid Teams"
2. **Why Virtual Team Building Matters** — Stats-driven intro (remote work loneliness, disengagement costs)
3. **Activity Types Grid** — Trivia, Game Shows, Escape Rooms, Meme Battles, Music Rounds
4. **The Teamtastic Difference** — Live emcee vs. self-service comparison table
5. **Top 10 Virtual Team Building Ideas** — Long-form SEO content list
6. **FAQ** — Rich structured FAQ schema (8–10 questions)
7. **CTA** → "Book a Free Event" or "Explore Games"

**Target Keywords**:
- "virtual team building activities" (high volume)
- "virtual team building games" 
- "online team building activities for remote employees"
- "virtual team building for large groups"
- "best virtual team building ideas 2025"

---

### 8.3 Why Teamtastic (`/why-teamtastic`) ★ TRUST PAGE
**Goal**: Convert mid-funnel visitors who are comparing vendors.

**Content Sections**:
1. **H1**: "Why Teams Choose Teamtastic Over Other Virtual Team Building Platforms"
2. **The Problem We Solve** — Before/after contrast (boring Zoom calls → electric gameshow)
3. **The Teamtastic Advantage** — Feature comparison table vs. Jackbox, Kahoot!, Hooray Teams, Weve
4. **Meet the Emcee** — Founder story, credentials, energy, personal commitment to every event
5. **Client Success Stories** — Case studies with engagement metrics
6. **Platform Integrations** — Zoom, Microsoft Teams, Google Meet, Webex, Any Browser
7. **CTA** → "Book a Demo" / "See Our Games"

**Target Keywords**:
- "teamtastic reviews"
- "virtual team building company"
- "best virtual team building platform"
- "online team event hosting"

---

### 8.4 Pricing (`/pricing`) — Dedicated Page
**Goal**: Provide full pricing transparency, reduce sales friction.

**Pricing Structure** (confirmed from live site research — custom quote model):

> ⚠️ The live site confirms Teamtastic does NOT publish fixed price points. Pricing is fully customized based on group size, event duration, and facilitation level. The current pricing component should be updated to reflect this reality.

**Recommended Tier Structure**:

| Tier | Name | Price | Target |
| :--- | :--- | :--- | :--- |
| **Free** | Self-Service Arcade | $0 / free | Small teams (≤10), one-off test sessions |
| **Pro** | Professional Host License | Custom quote | Companies running regular events (monthly) |
| **VIP** | Fully Hosted Event | Custom quote (per event) | Large corporate events 50–500+ players |

**CTA Action per Tier**:
- Free: "Launch Free Lobby" → `teamtastic.games`
- Pro: "Get a Quote" → Contact form / Calendly
- VIP: "Request MC + Quote" → Lead capture form

---

### 8.5 Resources Hub (`/resources`) ★ SEO HUB
**Goal**: Attract and educate mid-funnel prospects searching for event planning content.

**Sub-pages**:
- `/resources/how-it-works` — Step-by-step visual guide
- `/resources/faq` — 20+ FAQ rich schema
- `/resources/event-planning-guide` — Downloadable PDF lead magnet
- `/resources/platform-integrations` — Zoom, Teams, Meet compatibility details

---

### 8.6 Blog (`/blog`) ★ SEO ENGINE
**Goal**: Drive consistent organic traffic through high-value search content.

**Initial 4 Posts** (to launch):

| Slug | Title | Target Keyword |
| :--- | :--- | :--- |
| `virtual-team-building-ideas` | "50 Virtual Team Building Ideas Your Team Will Actually Love" | virtual team building ideas |
| `remote-team-engagement-tips` | "How to Boost Remote Employee Engagement in 2025" | remote team engagement |
| `virtual-icebreaker-games` | "21 Virtual Icebreaker Games That Don't Feel Awkward" | virtual icebreaker games |
| `corporate-game-show-activities` | "Corporate Game Show Ideas: Bring the Energy to Your Next Virtual Event" | corporate game show |

**Blog Format Requirements**:
- Minimum 1,500 words per post
- Structured headers (H2, H3)
- FAQ schema markup
- Internal links to `/games/` and `/virtual-team-building`
- Author byline (Founder / Master Emcee)
- Published date + last updated date

---

## 9. Updated Pricing Recommendation

Based on research of the live `teamtastic.events` website, **no fixed public pricing is shown** — all plans are custom quotes. This is consistent with the VIP/hosted event positioning. The current `Pricing.js` component hardcodes `$99/month` which **does not match the live site**.

**Recommended Update to Pricing Component**:
- Remove the hard $99 price point
- Replace "Professional Host" with a "Request a Quote" CTA that opens a contact/calendly flow
- Keep the Free tier with `Launch Free Lobby → teamtastic.games` CTA
- Keep the VIP tier with "Request MC / Get Quote" CTA

---

## 10. Navigation Component Updates Needed

The current `Navbar.js` is missing key navigation links. **Required additions**:

| Link Label | Route | Icon |
| :--- | :--- | :--- |
| Virtual Team Building | `/virtual-team-building` | `Users` icon (emerald) |
| Why Teamtastic | `/why-teamtastic` | `Star` icon (gold) |
| Resources | `/resources` | `BookOpen` icon (blue) |
| Blog | `/blog` | `PenLine` icon (zinc) |
| Games | `/#games` | `Gamepad2` icon (purple) — existing |
| Pricing | `/pricing` | `CreditCard` icon (pink) — update href |

---

## 11. SEO Technical Standards

Every page must implement:

```jsx
export const metadata = {
  title: "[Page-Specific Title] | Teamtastic",
  description: "[150-160 char compelling description]",
  openGraph: { /* title, description, url, images */ },
  twitter: { card: "summary_large_image" },
};
```

**Schema Markup Required**:
- `Organization` schema on homepage
- `FAQPage` schema on Virtual Team Building and FAQ pages
- `Article` schema on all blog posts
- `BreadcrumbList` on all inner pages

**Core Web Vitals Targets**:
- LCP < 2.5s (use `next/image` with `priority` on hero)
- INP < 200ms (no heavy JS blocking)
- CLS = 0 (define image dimensions, avoid layout shifts)

---

## 12. Scrollbar & Selection Styling

```css
/* Custom scrollbar — dark branded */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: #030712; }
::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #374151; }

/* Text selection — brand purple */
/* Applied via layout.js body className: selection:bg-purple-500 selection:text-white */
```

---

## 13. Google Stitch / Component Library Note

> **On Google Stitch:** Google Stitch (now part of Firebase Studio / IDX) is Google's visual component-building tool. It allows you to design UI components visually and export them to code. This could be a useful workflow for rapid iteration on individual components (like cards, buttons, or the pricing grid). However, since we are already building in Next.js with Tailwind CSS v4 and have a locked design system, Stitch would be most useful for **prototyping new sections** before writing JSX. It is not required for the current build — our design system in this document provides sufficient specification for direct code implementation.

---

*Last updated: May 2026 — Aligned with approved mockup `teamtastic_website_mockup.png`*
