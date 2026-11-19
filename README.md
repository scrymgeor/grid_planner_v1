<p align="center">
  <img src="./public/icon.svg" alt="Grid Logo" width="88" height="88" />
</p>

<h1 align="center">GRID</h1>

<p align="center">
  <strong>Adaptive task, schedule, and habit planner built for real life.</strong><br />
  Time-block around your free hours, protect daily streaks, get lock-screen deadline reminders, and let <strong>Echo</strong> rearrange your plan whenever life happens.
</p>

---

## Features

- **Optimal Auto-Scheduling** — Add tasks with deadlines, durations, priorities, and energy levels. Grid automatically fits them into your available free hours.
- **Free Hours & Time Rules** — Define your weekly open windows so focus blocks only land when you actually have time.
- **Habit Streak Manager** — Track daily habits with one-tap check-ins, streak counters, and evening nudges before your day ends.
- **Chat with Echo** — A mood-aware scheduling assistant that adjusts your day when you miss a block, feel burnt out, or face a deadline crunch.
- **Lock-Screen Deadline Reminders** — Background Web Push notifications warn you before deadlines, focus blocks, or streaks slip—even when the app is closed.
- **Personalize Your Workspace** — Switch between Day/Night mode, custom theme presets, and accent colors inside Settings.
- **Export & Backup** — Export your schedule to `.ics` (Google/Apple/Outlook Calendar), tasks & habits to `.csv`, or download a full `.json` backup.
- **Installable Mobile App (PWA)** — Add Grid to your Android or iOS home screen for a fast, full-screen app experience with real-time cloud sync.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Motion, Lucide Icons
- **Backend:** Express (`server.ts`), Web Push (`web-push`), `@google/genai`
- **Auth & Cloud Sync:** Firebase Authentication & Cloud Firestore
- **Mobile & Offline:** `vite-plugin-pwa` + Custom Push Service Worker (`public/push-sw.js`)

---

## Local Development

### Prerequisites
- Node.js 20+

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:

```env
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"

# Optional: Web Push keys for background lock-screen reminders
# Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:you@example.com"
PUSH_CRON_SECRET="your-random-secret"
```

### 3. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Render

1. Create a new **Web Service** on [Render](https://render.com) connected to this repository.
2. Configure the service commands:
   - **Build Command:** `npm install --include=dev --legacy-peer-deps && npm run build`
   - **Start Command:** `npx tsx server.ts`
3. Add your environment variables in Render (`NODE_ENV=production`, `GEMINI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_CRON_SECRET`).
4. Add your live Render hostname (e.g. `your-app.onrender.com`) under **Firebase Console → Authentication → Settings → Authorized domains**.
5. *(Optional for free tier background notifications)* Schedule a 5-minute GET ping (e.g. via [cron-job.org](https://cron-job.org)) to:
   ```
   https://your-app.onrender.com/api/push/cron?secret=YOUR_PUSH_CRON_SECRET
   ```

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Build production frontend bundle (`dist/`) |
| `npm run lint` | Run TypeScript type checks (`tsc --noEmit`) |
