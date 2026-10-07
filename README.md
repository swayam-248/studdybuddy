# StudyBuddy ⚡

A real-time placement preparation study tracker engineered for college placement candidates. Built with **React 18**, **Vite**, **CSS Modules**, and **Supabase (PostgreSQL, Auth, Realtime)**.

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&logoColor=white)](https://studdybuddy-nu.vercel.app)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**🌐 Live Production App:** [https://studdybuddy-nu.vercel.app](https://studdybuddy-nu.vercel.app)

---

## 🚀 Live Features Implemented

### 1. Synchronized Real-Time Dashboard
* **Side-by-Side Partner Cards:** Current user has interactive action buttons (`Start Studying`, `Take a Break`, `Stop & Log`), while partner's card is tracked in real-time.
* **Zero-Drift Live Study Timer:** Monospace ticker (`HH:MM:SS`) derived client-side from `session_start` against `Date.now()`, remaining perfectly accurate across page refreshes.
* **Animated Status Glow:** Active studying card triggers a subtle pink-to-green gradient border glow with pulsing indicator.
* **Safe Logout Lifecycle:** Resets user status to `offline` and clears active timers in the database before session termination.

### 2. Break Accountability & Overdue Alerts ☕🚨
* **Break Duration Presets:** Quick-select break lengths: `5m (Stretch)`, `10m (Chai/Snack)`, `15m (Power Walk)`, `20m (Meal)`.
* **Live Countdown:** Timer counts down allotted break time (e.g. `08:45 left of 10m`).
* **Overdue Alert & Chime:** If break time runs out (`00:00`), card pulses red, plays an audio chime via Web Audio API, and begins counting overtime (`+03:15 OVERDUE`).
* **Partner Nudge:** Partner's card flags the overdue break in real time (`⚠️ Break overdue by 4m!`) and displays a **"🔔 Nudge"** button.

### 3. Strict Daily Study Quotas & Midnight Streak Kill 🎯🔥
* **Interactive Goal Setter:** Set and adjust daily target study hours (`2h`, `3h`, `4h`, `5h`, `6h`, `8h` presets or custom decimal input) right on the card.
* **Live Progress Bar:** Tracks progress towards daily target (e.g. `2.4h / 4.0h (60%)`) and turns green when completed.
* **Midnight Cutoff Clock:** Displays remaining time before midnight (`⏳ 3h 45m to midnight cutoff`).
* **Consecutive Day Streaks:** Tracks consecutive days meeting the daily quota (`🔥 4d Streak`). If yesterday's quota was missed, resets to `💀 Streak Reset`.

### 4. Anti-Fake Logging & Short Sprint Partner Alerts 📝⚡
* **Quick Sprint Partner Alerts (<15m):** Sessions under 15 minutes are allowed to be logged instead of blocked, but instantly broadcast a real-time audio chime and floating toast banner to the partner (`⚡ [Partner] just logged a short sprint (<15m)`), plus post an automated accountability notice in the Squad Chat.
* **Short Sprint Tag in Logs:** Logs visually tag quick sessions with an amber `⚡ <15m Sprint` badge for transparency.
* **Placement Problem Counters:** Dedicated increment/decrement counters for `🟢 Easy`, `🟡 Medium`, and `🔴 Hard` problems solved during the sprint.
* **Proof of Work Link:** Input for LeetCode submission URL, GitHub commit, or Notion doc.
* **Mandatory Reflection:** Requires reflection notes detailing what was learned or solved.

### 5. Weekly Comparative Analytics 📊
* **Mon–Sun Side-by-Side Bar Chart:** Daily study hours for both partners displayed side-by-side with hover tooltips.
* **Top Focus Areas:** Identifies top 3 most studied subjects for each user this week.
* **Auto-Polling:** Background refresh every 60 seconds ensuring analytics stay synchronized.

### 6. Chronological Study Logs 📜
* **Separated Tabs:** Toggle between **Mine** and **Partner's Logs**.
* **Detailed Session Cards:** Formatted date, time, duration badges, topic chips, problem counts, and reflections.
* **Verified Proof Badge:** Clickable `🔗 Verify Proof of Work` link opening the user's submission.
* **Summary Metrics:** Total dedicated time and completed session count.

### 7. Partner Profiles & LeetCode-Style Consistency Heatmap 🟩
* **Dual Profile Switcher:** View your profile or your partner's complete placement track record (`/profile`).
* **20-Week LeetCode Contribution Heatmap:**
  - 7 rows (Mon–Sun) across 20 weeks (~5 months).
  - 4 levels of green intensity (`<1h`, `1h–2.5h`, `2.5h–4h`, `>4h`).
  - Interactive tooltip on hover showing date, hours, session count, and topics covered.
* **Topic Mastery Matrix:** Comprehensive breakdown of hours spent on each placement topic with percentage distribution.
* **All-Time Metrics:** Total hours, sprints completed, problem difficulty totals, and average sprint duration.

### 8. Peer Tasks & Assignment System 📋
* **Dedicated Task Board (`/tasks`):**
  - **📥 Assigned to Me:** Problems and topics challenged by your partner.
  - **📤 Assigned to Partner:** Challenges you gave to your partner.
* **Live Task Lifecycle & Timer:**
  - **Accept Task (`🚀 Accept & Start Timer`):** Assignee starts the task, kicking off an active timer.
  - **Real-Time Partner Tracking:** Partner's screen immediately shows `🚀 [Partner] is solving now! • 05:20 elapsed`.
  - **Finish Task (`✅ Finish & Mark Done`):** Computes total minutes spent and records completion timestamp.
* **Spoiler-Protected Solution Drawer:** Solution links are hidden by default behind a `💡 View Solution / Editorial` button so answers aren't spoiled.

### 9. Dedicated Real-Time Chat 💬
* **Full-Page Messenger (`/chat`):** Instant messaging powered by Supabase Realtime.
* **Live Partner Presence:** Avatar status dot indicating if partner is live studying, on break, or offline.
* **Code Snippet Mode (`</> Code`):** Syntax box with JetBrains Mono formatting and 1-click **Copy Code** button.
* **1-Click Problem Sharing:** Sends interactive placement challenge cards directly into the conversation stream.
* **Quick Study Reactions:** One-tap presets (`☕ Sending Chai!`, `🔥 Locked In!`, `🙌 High Five!`, `💪 Keep Pushing!`, `❤️ Proud of you!`).
* **Message Emoji Reactions:** React to any message with `❤️`, `🔥`, `☕`, `👏`, `🚀`.
* **Typing Indicator & Audio Chime:** Live `Partner is typing...` notification and soft audio chime on incoming messages.

### 10. Design System & Theme Engine 🎨
* **CSS Variable Tokens:** Exact specification for `--bg`, `--surface`, `--surface-2`, `--border`, `--accent`, `--gradient-accent`, `--green`, `--amber`, `--red`.
* **Dark / Light Mode Toggle:** Pill toggle in navigation bar with smooth 200ms background transition.
* **Typography:** `DM Sans` for UI readability and `JetBrains Mono` for timers, stats, and code blocks.

---

## 🗺️ Future Roadmap & Upcoming Plans

### Phase 2: Multi-User "Study Pods" (2 to 6 Members)
- [ ] **Pod Creation & Invite Codes:** Generate unique 6-character room codes (`POD-8F2A`).
- [ ] **Onboarding Screen:** For new users to either create a pod or join an existing one with an invite code.
- [ ] **Strict Pod Limits:** Minimum 2 members, maximum 6 members per pod.
- [ ] **Single Active Pod Constraint:** Users belong to exactly 1 pod at a time.
- [ ] **Multi-User Dashboard Grid:** Responsive 2–3 column grid displaying live status cards for all 2–6 pod members.
- [ ] **Squad Chat & Task Delegation:** Assign tasks to any specific pod member and chat in a private group room.
- [ ] **Squad Weekly Leaderboard:** Ranked comparison of study hours across all pod members.

### Phase 3: Placement Readiness Matrix & Syllabus Heatmap
- [ ] Core subject checklist (DSA, OS, DBMS, Networks, System Design).
- [ ] Status indicators: `Needs Revision 🟡`, `Practicing 🔵`, `Interview Ready 🟢`.
- [ ] Shared peer teaching recommendations based on partner strengths.

### Phase 4: Mock Interview Scheduler & Scorecard 🎙️
- [ ] Structured 45-minute peer mock interview mode with live scratchpad.
- [ ] Rubric rating: Problem Solving (1-5⭐), Communication (1-5⭐), Code Cleanliness (1-5⭐), Edge Cases (1-5⭐).
- [ ] Permanent mock interview history and feedback logs.

### Phase 5: Anti-Distraction Tab-Switch Tracker 👁️
- [ ] Detects tab switching or window minimize during an active study sprint.
- [ ] Logs distraction frequency and updates partner status to `Tab Switched / Away`.

### Phase 6: Placement Drive Countdown & Milestone Confetti ⏳🎉
- [ ] Countdown clock to campus placement Day-1 drive date.
- [ ] Milestone celebrations (e.g. 100 LeetCode problems solved) with confetti animations.

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- Node.js 18+ and npm
- A free [Supabase](https://supabase.com) project

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Populate from your Supabase Dashboard (**Project Settings > API**):
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

### 3. Database Setup (Supabase SQL Editor)
Run the entire contents of [`schema.sql`](./schema.sql) in your Supabase **SQL Editor**. This sets up:
- `profiles` table (status, break tracking, daily study goals)
- `sessions` table (study logs, problem counts, proof URLs)
- `tasks` table (peer assignments, solution links, live started/completed timestamps)
- `messages` table (real-time chat, code snippets, problem cards, reactions)
- Row Level Security (RLS) policies allowing mutual partner access
- Realtime publication subscriptions (`supabase_realtime`)

### 4. Create User Accounts
In Supabase Dashboard under **Authentication > Users**:
1. Click **Add User > Create User** for User 1 (check **Auto Confirm User**).
2. Click **Add User > Create User** for User 2 (check **Auto Confirm User**).
3. (Optional) Run SQL to set custom display names:
   ```sql
   update public.profiles set display_name = 'YourName' where email = 'you@example.com';
   update public.profiles set display_name = 'PartnerName' where email = 'partner@example.com';
   ```

### 5. Run the Application
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 🌐 Production Deployment (Vercel)

This repository includes a [`vercel.json`](./vercel.json) rewrite configuration so all React Router SPA paths (`/chat`, `/tasks`, `/logs`, `/profile`) resolve cleanly without 404 errors on browser refresh.

### Deployment Steps:
1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "feat: complete study tracker"
   git push origin main
   ```
2. Import the repository in [Vercel](https://vercel.com).
3. Add environment variables in the Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click **Deploy**.
5. Add your Vercel production URL to **Authentication > URL Configuration > Redirect URLs** in your Supabase dashboard:
   - `https://studdybuddy-nu.vercel.app`
   - `https://studdybuddy-nu.vercel.app/**`
