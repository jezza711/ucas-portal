# UCAS Randomisation Portal

A simple web application that randomises students into VIDEO or AI groups based on their 10-digit UCAS Personal ID.

## Features

- **Student Portal**: Enter UCAS code, get assigned to a group, receive PDF link
- **Admin Dashboard**: Search records, export data
- **Webhooks**: JISC integration and email trigger endpoints
- **Email**: Automatic pack delivery via Resend
- **Database**: SQLite with persistent storage
- **Reporting**: Optional Google Sheets sync for every student record
- **Course Packs**: Serve downloadable PDFs without redeploying

## Tech Stack

- Node.js 18+ with Express
- SQLite (better-sqlite3)
- Resend for email delivery
- Helmet, rate limiting, and Basic Auth for security

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

**Required settings:**
- `ADMIN_USER` and `ADMIN_PASS` - for admin access
- `WEBHOOK_SECRET` - for securing webhook endpoints
- `RESEND_API_KEY` - for email delivery (optional during development)
- `EMAIL_FROM` - sender email address
- `VIDEO_PDF_URL` and `AI_PDF_URL` - links to course pack PDFs

### 3. Run the Application

**Development** (with auto-reload):
```bash
npm run dev
```

**Production**:
```bash
npm start
```

The server starts on `http://localhost:3000` (or the PORT you set).

## Usage

### Student Flow

1. Visit `http://localhost:3000`
2. Enter 10-digit UCAS Personal ID
3. Get assigned to VIDEO or AI group (50-50 random)
4. Receive PDF link for your group
5. If email is on file, pack is sent automatically

Re-entering the same code shows your existing assignment.

### Admin Access

Visit `http://localhost:3000/admin` (requires Basic Auth: username and password from `.env`)

**Features:**
- Search by UCAS code, email address, or group name
- Export all records as CSV

### Webhooks

#### JISC Student Upsert

```bash
POST /api/jisc-webhook
Content-Type: application/json
x-webhook-secret: your-webhook-secret

{
  "ucas_code": "0123456789",
  "email": "student@example.com"
}
```

Creates or updates student record with email.

#### Send Pack Email

```bash
POST /api/hooks/send-pack
Content-Type: application/json
x-webhook-secret: your-webhook-secret

{
  "ucas_code": "0123456789",
  "email": "override@example.com"  # optional
}
```

Sends the assigned group's PDF pack to the student.

## Course Pack PDFs

Configure the PDF links via environment variables or static files you ship with the app:

1. Host the Video and AI course packs (Render disk, S3, Google Drive direct link, etc.).
2. Set `VIDEO_PDF_URL` and `AI_PDF_URL` to those fully qualified URLs.
3. (Optional) If you ship the PDFs with the app, place them in the `/packs` directory and expose them via your CDN/Render disk.

> Tip: Set the `PUBLIC_BASE_URL` env var (e.g. `https://your-service.onrender.com`) so emails get an absolute link even when the portal itself serves `/packs/...` paths.

## Google Sheets Sync

The server can mirror every student record to a Google Sheet for quick reporting.

1. Create a Google Cloud project and service account with the *Google Sheets API* enabled.
2. Download the JSON key and add these values to your environment:
  - `GOOGLE_SHEET_ID` – the ID portion of your sheet URL.
  - `GOOGLE_CLIENT_EMAIL` – the service account email address.
  - `GOOGLE_PRIVATE_KEY` – the private key, with every newline replaced by `\n`.
  - `GOOGLE_SHEET_TAB` (optional) – defaults to `Students` if omitted.
3. Share the Google Sheet with the service account email so it can edit the sheet.

### What gets synced?

- Columns: `UCAS Code`, `Group Name`, `Email`, `Created At`, `Updated At`, `Email Last Sent At`.
- Every `/randomise`, webhook, or manual email send updates a single row (upserted on UCAS code).
- Server start triggers a full sheet refresh so the Google Sheet always matches the SQLite database.

> **Heads-up:** A bulk refresh overwrites the entire tab, so use a dedicated sheet/tab for this integration.

## Testing

See `TESTING.md` for curl command examples to test all endpoints.

## Deployment

### Render or Railway

1. Create a new Web Service
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Add Persistent Disk**: Mount at `/opt/render/project/src/db` (Render) or `/app/db` (Railway)
4. Set environment variables in the dashboard (copy from `.env.example`)
  - For `GOOGLE_PRIVATE_KEY`, paste the key exactly as shown in the JSON file but replace real newlines with `\n`.
  - Set `PUBLIC_BASE_URL` to your live Render URL so email links point to the right host.
5. Update `VIDEO_PDF_URL` and `AI_PDF_URL` to your actual hosted PDF links
6. Deploy!

**Important**: The database file is stored in the `db/` directory. Ensure this directory is backed by a persistent volume, otherwise data will be lost on restarts.

If you serve PDFs from disk, store them under `uploads/packs` (or your configured `PACKS_DIR`) and mount that directory on a persistent disk so the files survive deploys.

### Alternative: Vercel

⚠️ Vercel has an ephemeral filesystem. If deploying to Vercel:
- Switch to a hosted database (Supabase, Neon Postgres, or PlanetScale)
- Update database connection code accordingly

## Database

SQLite database stored at `db/app.db` with a single `students` table:

| Column | Type | Description |
|--------|------|-------------|
| ucas_code | TEXT | Primary key, 10 digits |
| group_name | TEXT | VIDEO or AI (null until assigned) |
| email | TEXT | Student email (optional) |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |
| email_last_sent_at | TEXT | ISO datetime (optional) |

**Backup**: Simply copy the `db/app.db` file to back up your data.

## Security

- Helmet for secure HTTP headers
- Rate limiting on public and webhook routes
- Basic Auth for admin routes
- Webhook secret for API endpoints
- CORS disabled by default

## Environment Variables

See `.env.example` for all configuration options. Key additions:

- `PUBLIC_BASE_URL` – Base URL (with protocol) used to build absolute `/packs/...` links in outgoing emails.
- `GOOGLE_*` – Service account credentials for the optional sheet sync.
- `PACKS_DIR` (optional) – Custom absolute path for serving on-disk PDFs; defaults to `<project>/uploads/packs`.

## License

MIT
