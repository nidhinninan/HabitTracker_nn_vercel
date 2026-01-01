
# 2026 Resolution Habit Tracker

A minimalist habit tracker that uses Notion as its single source of truth. All data persists in Notion, accessible from any device/browser.

## HabitTracker_nn_vercel
Simple new year resolution habit tracker connected to Vercel. Build using Perplexity Labs

## Features

- ✅ Track up to 15 daily habits
- ✅ Real-time progress tracking (0-100%)
- ✅ Daily reflections/notes
- ✅ Notion as single source of truth (cross-device sync)
- ✅ Reset day functionality
- ✅ Dark mode UI
- ✅ Mobile responsive (375px+)
- ✅ Secure API handling with Vercel secrets

## Architecture

**Frontend:** Static HTML + Vanilla JavaScript
**Backend:** Vercel Serverless Functions (Node.js)
**Database:** Notion

Data flows:
- Page load → `/api/load` → Fetches today's entry from Notion
- Add/Edit habits → No API call (in-memory state)
- Sync button → `/api/sync` → Creates/updates Notion entry

## Setup Instructions

### 1. Create Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create new integration, name it "Habit Tracker"
3. Copy the **Internal Integration Token** (this is `NOTION_KEY`)
4. Create a new Notion database with these properties:
   - **Date** (Title) - format: YYYY-MM-DD
   - **Habits** (Rich Text) - comma-separated list
   - **Completed** (Rich Text) - comma-separated completed habits
   - **Progress** (Number) - percentage 0-100
   - **Notes** (Rich Text) - daily reflections
5. Share the database with your integration
6. Extract database ID from URL: `https://notion.so/[WORKSPACE]/[DB_ID]?v=...`

### 2. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click "Add New Project"
4. Import your GitHub repository
5. Set environment variables in Project Settings → Environment Variables:
   - `NOTION_KEY`: Your integration token
   - `NOTION_DB_ID`: Your database ID
6. Click "Deploy"

### 3. Local Testing

```bash
npm install
vercel env pull  # Pulls secrets from Vercel
vercel dev       # Runs on http://localhost:3000
