# Game Backlog

A lightweight, clean personal game backlog tracker for games you need to play, are actively playing, have completed, or have dropped.

## Features

- Track games across Need to play, Playing, Completed, and Dropped play states
- Track acquisition separately as Unknown, Owned, Needs acquiring, or Not applicable
- Load Nexus ownership-matching JSON (`owned-index.json`) to show owned/needs-acquiring indicators with unknown fallback
- Add title, platform, priority, rating, tags, notes, cover image URL, acquired date, source notes, ROM path, and library match ID
- Search and filter by play status
- Required Supabase email/password login before backlog data or tools are shown
- Browser `localStorage` cache only after login for signed-in cloud data
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

## Canonical game fields

Use these canonical field names and values throughout the app and exported JSON:

- `play_status`: `need_to_play`, `playing`, `completed`, `dropped`
- `status`: legacy compatibility mirror of `play_status`; new code should read and write `play_status`
- `acquisition_status`: `unknown`, `owned`, `needs_acquiring`, `not_applicable`
- Optional acquisition/library fields: `acquired_at`, `source_notes`, `rom_path`, `library_match_id`

Backward compatibility:

- Legacy `status`/`play_status: interested` imports as `need_to_play` and is displayed as “Need to play”
- Legacy `status`/`play_status: played` imports as `completed` and is displayed as “Completed”
- `playing`, `completed`, and `dropped` keep their existing values
- The UI labels are “Need to play”, “Playing”, and “Completed” for the primary add flow; “Dropped” remains visible for legacy/backlog management.

## Ownership matching

The app tries to fetch `owned-index.json` from the deployed site root on startup. This file should be the read-only Nexus scan output; it can contain `files`, `games`, `entries`, `owned`, or `matches` arrays with fields such as `title`, `filename`, `platform`/`systemFolder`, `absolutePath`/`rom_path`, and `id`/`match_id`.

If the file is present, backlog cards show:

- `Owned` when exactly one same-title/same-system match is found
- `Needs acquiring` when the index is loaded and no match is found
- `Unknown` when no index is loaded or multiple candidate ROMs make the match ambiguous

You can also import an ownership JSON file from the UI for local preview without moving, deleting, renaming, or writing any Nexus files.

## Supabase login and sync

The Supabase project URL is already set in `.env.example`.
Login is required to use the app. To enable sign-in locally, copy it to `.env.local` and add the anon public key:

```bash
cp .env.example .env.local
# then fill in VITE_SUPABASE_ANON_KEY
```

Create the database table and security policies by running `supabase/schema.sql` in the Supabase SQL Editor. The app only loads
games after Supabase confirms a signed-in session, and row-level security limits each account to its own rows.

For GitHub Pages, add these repository variables/secrets before deployment:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deploy

This repo includes a GitHub Pages workflow at `.github/workflows/pages.yml`.
After pushing to GitHub, enable Pages with **Settings → Pages → Source: GitHub Actions**.
