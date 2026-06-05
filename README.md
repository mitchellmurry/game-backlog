# Game Backlog

A lightweight, clean personal game backlog tracker for games you are interested in playing, actively playing, and have played.

## Features

- Track games across Interested, Playing, Played, and Dropped states
- Add title, platform, priority, rating, tags, notes, and cover image URL
- Search and filter by status
- Browser `localStorage` persistence
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

## Deploy

This repo includes a GitHub Pages workflow at `.github/workflows/pages.yml`.
After pushing to GitHub, enable Pages with **Settings → Pages → Source: GitHub Actions**.
