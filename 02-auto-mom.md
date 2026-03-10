# Auto MOM — Complete Standalone Agent Prompt

## Project Identity

| Field | Value |
|-------|-------|
| **Project Folder** | `C:\Users\namsi\Desktop\Projects\Auto MOM` |
| **Tech Stack** | React + Vite frontend (TypeScript/Tailwind CSS) |
| **Vercel URL** | https://auto-mom.vercel.app/ |
| **GitHub Repo** | `NamanSingh69/Auto-MOM` (create if not exists) |
| **Vercel Env Vars** | `GEMINI_API_KEY` is set |

### Key Files
- `src/App.tsx` — Main app component with audio recorder and synthesis flow
- `src/AgentModal.tsx` — Agent Config modal with "Inference Engine" dropdown (Pro/Flash options)
- `src/` — React component tree
- `package.json` — Dependencies (React, Vite, Tailwind, etc.)
- `vite.config.ts` — Vite configuration

---

## Shared Infrastructure Context (CRITICAL — Read Before Making Changes)

This project is part of a 16-project portfolio. Previous work sessions established shared patterns you MUST follow:

### Design System — The "UX Mandate"
All projects must implement **4 core UI states**:
1. **Loading** → Animated skeleton screen placeholders (shimmer effect, NOT static "Loading..." or spinner text)
2. **Success** → Toast notifications (use `sonner` library in React projects — green, auto-dismiss after 4s)
3. **Empty** → Beautiful null states with friendly messaging and SVG/icon graphics
4. **Error** → Red toast notification with actionable recovery messages

**NEVER use native `alert()`, `confirm()`, or `prompt()` dialogs.**

### React Project Toast Standard
All React+Vite projects use the **`sonner`** library for toast notifications:
```bash
npm install sonner
```
```tsx
import { Toaster, toast } from 'sonner';
// In root component: <Toaster position="bottom-right" richColors />
// Usage: toast.success('Minutes generated!'), toast.error('Failed to process audio')
```

### Smart Model Cascade (March 2026)
**Primary (Free Preview):** `gemini-3.1-pro-preview` → `gemini-3-flash-preview` → `gemini-3.1-flash-lite-preview`
**Fallback (Free Stable):** `gemini-2.5-pro` → `gemini-2.5-flash` → `gemini-2.5-flash-lite`

**Note:** `gemini-2.0-*` deprecated March 3, 2026. Do NOT use.
- Store selection in `localStorage` key `gemini_mode` (value: `"pro"` or `"fast"`)
- Pro → first model in cascade (highest capability), Fast → second model (speed-optimized)
- Rate limit: 15 RPM free tier, counter stored in `localStorage`, resets after 60 seconds

### Security Rules
- **NEVER** hardcode API keys in client-side code
- Use Vercel Serverless Functions (`api/` directory) to proxy Gemini API calls using `process.env.GEMINI_API_KEY`
- If the app currently requires users to paste their own API key, add `process.env.GEMINI_API_KEY` as a **fallback** via a serverless proxy
- `.gitignore` MUST cover: `.env*`, `node_modules/`, `.vercel/`, `dist/`

### Mobile Responsiveness (Required)
- `<meta name="viewport" content="width=device-width, initial-scale=1.0">` must be in `index.html <head>`
- All layouts must work at 375px width (iPhone SE) through 1920px (desktop)
- Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) for breakpoint-specific styles
- Touch targets must be at least 44×44px (especially audio record/stop buttons)
- Font sizes must be readable on mobile (minimum 14px body text, `text-sm` or larger)

### Accessibility
- ARIA labels on all interactive elements (especially the record button, synthesize button)
- Keyboard navigability
- WCAG AA contrast ratios

---

## Current Live State (Verified March 10, 2026)

| Feature | Status | Details |
|---------|--------|---------|
| Site loads | ✅ 200 OK | Dark navy/rose themed audio recording UI |
| Login wall | ✅ None | No login required |
| Pro/Fast Toggle | ✅ Present | "Inference Engine" dropdown in Agent Config modal with Pro/Flash options, also shows "🚀 FAST" indicator |
| Rate Limit Counter | ❌ MISSING | No visible counter anywhere in the UI |
| Empty State | ✅ Present | Clean landing page with centered recording button |
| Skeleton Loaders | ⚠️ UNVERIFIED | Could not trigger without audio — needs verification |
| Toasts | ✅ Present | Warning toasts work (e.g., "requires your own Gemini API Key") |
| Mobile Responsive | ✅ Yes | Layout adapts at 375px width, elements stack vertically |
| Console Errors | ✅ Clean | No errors observed |

---

## Required Changes

### 1. Add Rate Limit Tracker (MISSING)
This is the primary gap. The Pro/Fast toggle already exists, but there's no rate limit indicator.

**Implementation:**
- Add a rate limit badge in the header bar area (near the app title or near the Agent Config button)
- Display: `⚡ X/15 remaining` with a small progress bar
- Store count + reset timestamp in `localStorage`:
  - Key: `gemini_rate_count` (number of requests made in window)
  - Key: `gemini_rate_reset` (timestamp when the count resets)
- Decrement counter on each API call
- Reset automatically after 60 seconds from first request in the window
- Show a `sonner` warning toast when 2 requests remain: `toast.warning('Rate limit: only 2 requests remaining!')`
- When limit is reached, disable the Synthesize button and show: `toast.error('Rate limit reached. Resets in X seconds.')`

### 2. Verify & Harden Skeleton Loaders
When the "Synthesize" button is clicked and audio is being processed:
- Animated skeleton placeholders MUST appear in the minutes output area
- Skeletons should match the app's dark navy/rose design:
```css
/* Example skeleton matching the app theme */
.skeleton-line {
  background: linear-gradient(90deg, rgba(30,30,60,0.6) 25%, rgba(60,30,60,0.8) 50%, rgba(30,30,60,0.6) 75%);
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
  height: 16px;
  margin-bottom: 12px;
}
```
- If skeletons already exist in code, verify they actually render during processing. If they don't appear, fix the rendering logic.
- If they don't exist, create a `<MeetingSkeleton />` component that mimics the shape of meeting minutes output (title line, bullet points, action items).

### 3. Server-Side API Key Proxy
- The app currently requires users to paste their own API key in settings
- **Fix:** Create a `/api/proxy` Vercel Serverless Function:
```javascript
// api/proxy.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server API key not configured' });
  
  const { model, payload } = req.body;
  const modelName = model || 'gemini-3.1-flash-lite-preview';
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  const data = await response.json();
  res.status(response.status).json(data);
}
```
- Update the frontend to use `/api/proxy` as **fallback** when no user key is provided
- The server-proxied key should work transparently — user should NOT need to enter a key to use the app

### 4. Mobile Responsiveness Hardening
The site already stacks at mobile widths. Additionally verify:
- The audio recording interface (microphone button, waveform) is usable on touch devices
- The Agent Config modal doesn't overflow on small screens — use `max-h-[80vh] overflow-y-auto`
- Meeting minutes output area scrolls properly on mobile
- All buttons have min-height of 44px for touch targets

### 5. GitHub & Deployment
- Create GitHub repo `Auto-MOM` under `NamanSingh69` if not exists
- Ensure `.gitignore` covers `.env*`, `node_modules/`, `.vercel/`, `dist/`
- Push all code: `git add -A && git commit -m "feat: rate limit tracker, skeleton verification, api proxy, mobile hardening" && git push`
- Redeploy: `npx vercel --prod --yes`
- Verify at https://auto-mom.vercel.app/

---

## Verification Checklist
1. ✅ Open https://auto-mom.vercel.app/ — page loads without login wall
2. ✅ Open Agent Config modal → Pro/Flash toggle works, persists in `localStorage.gemini_mode`
3. ✅ Rate limit counter is visible (e.g., `⚡ 15/15 remaining`)
4. ✅ Record a short audio clip or upload an audio file → click Synthesize → skeletons appear while processing
5. ✅ Processing completes → success toast fires via `sonner` (green)
6. ✅ Trigger an error → error toast fires (red) — NO native `alert()`
7. ✅ Without entering a personal API key, the app still works (via server proxy)
8. ✅ Resize browser to 375px width → full functionality, no horizontal scroll, touch-friendly buttons
9. ✅ DevTools console → zero JavaScript errors
