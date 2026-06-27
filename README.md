# StudyMind — AI Study Companion for Competitive Exam Students

> A lightweight, zero-backend web app that helps Indian competitive exam aspirants understand what's affecting their focus, energy, and peace of mind — and gives them clear, actionable guidance to study better and feel better.

**Live Demo:** [Deploy via Netlify Drop](https://app.netlify.com/drop) — drag the project folder and get a live link in 30 seconds.

---

## Chosen Vertical

**Mental Wellness for Students** — specifically targeted at Indian students preparing for high-stakes competitive exams: **NEET, JEE, CUET, CAT, GATE, and UPSC**.

This is not a generic wellness or mood-tracking app. StudyMind operates as a **smart study companion** — a calm, wise senior mentor figure who helps students connect the dots between their daily habits, emotional state, and study performance. The focus is entirely on **academic performance optimization through self-awareness**, not clinical mental health.

### Why this vertical?

- Millions of Indian students face intense preparation pressure with little structured support for managing focus, energy, and stress.
- Existing tools are either generic meditation apps or clinical mental health platforms — neither speaks the language of a student grinding through Organic Chemistry at 2 AM.
- Students need someone who understands *exam context* — someone who can say "your Physics scores are dropping because you've been sleep-deprived for 3 days" rather than "try mindfulness."

---

## Approach and Logic

### Architecture: Zero-Backend, Browser-Only

The entire application runs client-side with **no server, no database, no build tools, and no npm dependencies**:

- **Pure HTML + CSS + JavaScript** — no frameworks, no React, no Vue
- **Mistral AI API** called directly from the browser via `fetch` for all AI-powered features
- **localStorage** for all data persistence — check-in logs, profile, API keys, weekly summaries
- **Chart.js via CDN** for interactive data visualization
- **Single-page app** pattern with JS-driven screen switching (no page reloads)

### AI Integration Strategy

The app makes three distinct types of AI calls, each with a specific purpose:

1. **Streaming Chat Response** — When a student submits a daily check-in, a streaming call generates a structured mentor response in real-time (word-by-word rendering). The system prompt is dynamically built with the student's profile, exam type, days remaining, last 7 days of history, and today's entry.

2. **Trigger & Positive Factor Extraction** — A separate lightweight call extracts structured JSON labels (e.g., "sleep deprivation", "morning walk") from journal text. These labels power the dashboard's frequency charts over time, making tracking deeply personal.

3. **Weekly Insight Generation** — A cached weekly call analyzes 7-day patterns and produces a short insight paragraph highlighting recurring triggers and actionable recommendations.

### System Prompt Design

The AI persona is carefully crafted: a wise, direct senior student who has been through it all. Key constraints baked into every prompt:
- Always explain the **root cause**, not just symptoms
- Give **exam-specific** advice (reference the actual exam, subjects, study patterns)
- End with **one honest, powerful line** of encouragement — never hollow
- Never mention therapists, hotlines, or clinical concepts
- Track and call out **patterns across days**

---

## How the Solution Works

### User Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌───────────┐
│  Onboarding │ ──▶ │ Daily Check- │ ──▶ │  AI Companion   │ ──▶ │ Dashboard │
│  (one-time) │     │     in       │     │   Response +    │     │  & Charts │
│             │     │              │     │   Follow-up Chat│     │           │
└─────────────┘     └──────────────┘     └─────────────────┘     └───────────┘
```

### 1. Onboarding (one-time setup)
- Student enters their name, target exam (NEET/JEE/CUET/CAT/GATE/UPSC), exam date, and Mistral API key
- Data saved to localStorage; onboarding never shown again

### 2. Daily Check-in (Home tab)
- **Mood Score** — slider from 1–10 with live emoji feedback
- **Energy Level** — tap selection: Drained / Low / Okay / High / Charged
- **Focus Quality** — tap selection: Couldn't focus / Scattered / Moderate / Sharp / In the zone
- **Open Journal** — free-text area (max 1200 chars) for the student to describe their day
- If already checked in today, shows a read-only summary card with a "Continue Chatting" button

### 3. AI Companion Response (Companion tab)
On check-in submission, the app streams a Mistral response structured in three sections:
- **🔍 What's Going On** — Root cause analysis of what's affecting the student
- **🛠 What To Do Today** — 2–3 concrete, exam-relevant actions
- **✨ One Thing To Remember** — One honest motivational line

After the response, a **follow-up chat bar** appears for multi-turn conversation. Students can ask things like "How do I stop comparing myself to others?" or "Give me a 5-minute technique to calm down before a mock test."

### 4. Dashboard (Dashboard tab)
All charts are interactive (Chart.js with hover tooltips):
- **Mood & Focus Trend** (14-day line chart) — see if mood and focus move together or diverge
- **Energy Pattern** (7-day bar chart) — color-coded from red (Drained) to emerald (Charged)
- **Stress Trigger Frequency** (30-day horizontal bar) — shows which triggers appear most often
- **Positive Factor Frequency** (30-day horizontal bar) — shows what actually helps
- **Stats row** — current logging streak, mood trend vs last week, best day this month
- **Weekly AI Insight Card** — Mistral-generated pattern analysis, cached per calendar week
- **30-Day Calendar Grid** — color-coded dots; tap any dot for that day's detail modal

### 5. Resource Library (Library tab)
Static, exam-filtered resource cards in accordion format:
- Focus Techniques, Energy Management, Stress Release, Study Strategy, Mind Reset
- Each card has bullet-point tips and a "Try this today" actionable prompt
- Content automatically filtered by the student's registered exam type

### 6. Settings (Library tab, bottom section)
- **API Key Management** — update or replace the Mistral API key anytime
- **Reset Application** — clear all data and start fresh
- API key input also appears on the error card when API calls fail, so users are never stuck

---

## File Structure

```
studymind/
├── index.html              # Single-page app shell with all screen layouts
├── css/
│   ├── main.css            # CSS variables, reset, layout, navigation
│   ├── components.css      # Cards, buttons, sliders, chat bubbles, modals, accordions
│   └── animations.css      # Page transitions, shimmer loading, emoji bounce
├── js/
│   ├── bundle.js           # Combined runtime script (all modules merged for file:// compatibility)
│   ├── storage.js          # localStorage helpers (source module)
│   ├── gemini.js           # Mistral API integration (source module)
│   ├── onboarding.js       # Onboarding flow (source module)
│   ├── checkin.js          # Daily check-in logic (source module)
│   ├── chat.js             # AI response & chat (source module)
│   ├── dashboard.js        # Charts & stats (source module)
│   ├── library-data.js     # Exam-specific resource content (source module)
│   └── app.js              # Main router & initialization (source module)
└── assets/
    └── icons/              # Reserved for SVG icons
```

> **Note:** `bundle.js` is the single combined file that actually runs. The individual module files (`storage.js`, `gemini.js`, etc.) are preserved as readable source references. This bundling approach was chosen because browsers block ES6 module imports when opening HTML files directly via `file://` protocol.

---

## Data Schema (localStorage)

| Key | Type | Description |
|-----|------|-------------|
| `sm_onboarded` | `"true"` | Whether onboarding is complete |
| `sm_gemini_key` | `string` | Mistral API key (stored locally, never transmitted anywhere except Mistral API) |
| `sm_profile` | `JSON` | `{ name, exam, examDate }` |
| `sm_logs` | `JSON array` | `[{ date, mood, energy, focus, journal, aiResponse, triggers[], positives[] }]` |
| `sm_weekly_summary` | `JSON` | `{ weekKey: "YYYY-Www", summary: "..." }` |

---

## Assumptions Made

1. **API Key Ownership**: Users bring their own Mistral API key. The key is stored only in the user's browser localStorage and is sent only to the Mistral API endpoint. There is no server-side storage or logging of keys.

2. **Browser Environment**: The app is designed for modern browsers (Chrome, Firefox, Edge, Safari) that support `fetch`, `ReadableStream`, ES6 syntax, and `localStorage`. It is mobile-responsive but optimized for mobile-first usage at 375px+ width.

3. **No Authentication Needed**: Since all data lives in localStorage, there is no user account system. Each browser/device is its own independent instance. Clearing browser data will erase all logs.

4. **Journal Quality**: The AI trigger/positive extraction depends on the student writing meaningful journal entries. Very short or empty entries will produce limited or empty extraction results.

5. **Network Connectivity**: The app requires internet access only for AI API calls (check-in response, trigger extraction, weekly insight). All other features (resource library, dashboard charts, calendar) work fully offline from cached localStorage data.

6. **Single User per Browser**: The app assumes one student per browser instance. There is no multi-user or profile-switching capability.

7. **Exam Context Relevance**: Resource library content is curated for six specific Indian competitive exams. The AI system prompt also references exam context, so responses are most relevant for these exam types.

8. **API Rate Limits**: The app assumes the user's Mistral API key has sufficient quota. If rate-limited or exhausted, the error card provides an inline option to update the key and retry.

9. **Privacy**: All personal data (journal entries, mood scores, API keys) stays in the user's browser. Nothing is sent to any server except the Mistral API for generating responses. No analytics, no tracking, no cookies.

---

## Deployment

The app is fully static — no build step, no server required.

**Recommended: Netlify Drop**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag and drop the project folder
3. Get a live URL instantly

**Alternatives:**
- **GitHub Pages** — push to a repo, enable Pages in settings
- **Vercel** — run `vercel` in the project directory
- **Local** — open `index.html` directly in any browser

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Structure | HTML5 (semantic, single-page) |
| Styling | Vanilla CSS (CSS variables, dark theme, responsive) |
| Logic | Vanilla JavaScript (ES6, no frameworks) |
| AI | Mistral AI API (`mistral-large-latest`) via direct `fetch` |
| Charts | Chart.js (CDN) |
| Typography | Inter (Google Fonts CDN) |
| Persistence | localStorage |
| Deployment | Static file hosting (Netlify / GitHub Pages / Vercel) |

---

*Built as a submission for the AI-powered mental wellness companion challenge.*