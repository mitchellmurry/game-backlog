# Game Backlog

A lightweight, clean personal game backlog tracker for games you are interested in playing, actively playing, and have played.

## Features

- Track games across Interested, Playing, Played, and Dropped states
- Add title, platform, priority, rating, tags, notes, and cover image URL
- Search and filter by status
- Browser `localStorage` persistence for offline/local use
- Optional Supabase email/password login and cloud sync across devices
- JSON export/import for backups and portability
- Static build suitable for GitHub Pages

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Supabase sync

The Supabase project URL is already set in `.env.example`.
To enable cloud sync locally, copy it to `.env.local` and add the anon public key:

```bash
cp .env.example .env.local
# then fill in VITE_SUPABASE_ANON_KEY
```

Create the database table and security policies by running `supabase/schema.sql` in the Supabase SQL Editor.

For GitHub Pages, add these repository variables/secrets before deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deploy

This repo includes a GitHub Pages workflow at `.github/workflows/pages.yml`.
After pushing to GitHub, enable Pages with **Settings → Pages → Source: GitHub Actions**.
