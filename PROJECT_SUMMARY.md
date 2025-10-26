# UCAS Randomisation Portal - Project Summary

## ✅ Project Complete

The UCAS Randomisation Portal has been successfully built with all requested features.

## 📁 Project Structure

```
ucas-portal/
├── db/
│   ├── init.js              # Database initialization and schema
│   ├── app.db               # SQLite database (auto-created)
│   ├── app.db-shm          # SQLite shared memory (auto-created)
│   └── app.db-wal          # SQLite write-ahead log (auto-created)
├── public/
│   ├── index.html          # Student portal frontend
│   └── admin.html          # Admin dashboard frontend
├── email.js                # Email service with Resend integration
├── server.js               # Main Express server with all routes
├── package.json            # Dependencies and scripts
├── .env.example            # Environment variables template
├── .env                    # Your environment configuration
├── .gitignore             # Git ignore rules
├── README.md              # User documentation
├── TESTING.md             # Manual testing guide
└── test.ps1               # Quick PowerShell test script

```

## 🚀 Quick Start

### 1. Install Dependencies (Already Done)
```bash
npm install
```

### 2. Configure Environment
Edit `.env` file with your settings:
- Set `ADMIN_USER` and `ADMIN_PASS` for admin access
- Set `WEBHOOK_SECRET` for webhook security
- Set `RESEND_API_KEY` for email delivery (optional for testing)
- Update PDF URLs when you have them hosted

### 3. Start Server
```bash
npm start          # Production mode
npm run dev        # Development mode (auto-reload)
```

Server runs on: http://localhost:3000

## 🎯 Features Implemented

### ✅ Student Portal
- Clean, responsive UI with form validation
- 10-digit UCAS code input with real-time validation
- 50-50 random assignment to VIDEO or AI groups
- Persistent assignment storage
- Re-entry protection (shows existing assignment)
- Automatic PDF link display based on group
- Optional email delivery when email is on file

### ✅ Admin Dashboard
- Basic Auth protected routes
- CSV upload with upsert functionality
- Advanced search by UCAS code and/or group
- Full data export to CSV
- Clean tabular results display
- Upload/update student emails

### ✅ Webhooks
- **JISC Webhook** (`POST /api/jisc-webhook`)
  - Header-based secret authentication
  - Upsert student records with email
  - Creates new records or updates existing

- **Send Pack Webhook** (`POST /api/hooks/send-pack`)
  - Looks up student assignment
  - Sends appropriate PDF via email
  - Supports email override parameter
  - Updates email_last_sent_at timestamp

### ✅ Email Service
- Resend integration for email delivery
- Graceful fallback when API key not configured
- HTML and text email formats
- Group-specific subjects and content
- PDF download links embedded

### ✅ Security & Performance
- Helmet for secure HTTP headers
- Rate limiting (100 req/15min public, 1000 req/15min webhooks)
- Basic Auth for admin routes
- Webhook secret authentication
- Input validation and sanitization
- SQL injection protection (prepared statements)
- CORS disabled by default

### ✅ Database
- SQLite with better-sqlite3
- WAL mode enabled for better concurrency
- Indexed for performance
- Proper constraints and validations
- Automatic schema creation

## 🔌 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/` | GET | None | Student portal UI |
| `/randomise` | POST | None | Randomise student to group |
| `/health` | GET | None | Health check |
| `/admin` | GET | Basic Auth | Admin dashboard UI |
| `/admin/upload` | POST | Basic Auth | Upload CSV |
| `/admin/search` | GET | Basic Auth | Search students |
| `/admin/export.csv` | GET | Basic Auth | Export all data |
| `/api/jisc-webhook` | POST | Webhook Secret | JISC student upsert |
| `/api/hooks/send-pack` | POST | Webhook Secret | Send email pack |

## 🧪 Testing

### Quick Test
Run the PowerShell test script:
```powershell
.\test.ps1
```

### Comprehensive Testing
See `TESTING.md` for detailed curl/PowerShell commands for all endpoints.

### Manual Browser Testing
1. **Student Portal**: http://localhost:3000
2. **Admin Dashboard**: http://localhost:3000/admin
   - Username: `admin`
   - Password: `change-this`

## 📊 Database Schema

**Table: students**
| Column | Type | Description |
|--------|------|-------------|
| ucas_code | TEXT (PK) | 10-digit UCAS Personal ID |
| group_name | TEXT | VIDEO or AI (null until assigned) |
| email | TEXT | Student email (optional) |
| created_at | TEXT | ISO datetime |
| updated_at | TEXT | ISO datetime |
| email_last_sent_at | TEXT | ISO datetime (optional) |

**Indexes:**
- Primary key on `ucas_code`
- Index on `group_name`

## 🌐 Deployment

### Render / Railway
1. Create new Web Service
2. Connect GitHub repository
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. **Add Persistent Disk**: Mount at `/app/db` for SQLite persistence
6. Set environment variables in dashboard
7. Update PDF URLs to production links

### Environment Variables for Production
```
PORT=3000
ADMIN_USER=your-admin-username
ADMIN_PASS=strong-password-here
WEBHOOK_SECRET=long-random-secret-string

RESEND_API_KEY=re_your_actual_key
EMAIL_FROM=noreply@yourdomain.com

VIDEO_PDF_URL=https://yourdomain.com/pdfs/video-course-pack.pdf
AI_PDF_URL=https://yourdomain.com/pdfs/ai-group-pack.pdf
```

## 📝 Common Tasks

### Add Students via CSV
1. Create CSV with columns: `ucas_code,email`
2. Visit http://localhost:3000/admin
3. Upload file
4. Students will be created (no group assigned until they visit portal)

### Search Students
- Admin dashboard → Search form
- Filter by UCAS code pattern or group
- Returns all matches

### Export All Data
- Admin dashboard → "Download CSV Export" button
- Downloads complete database

### Trigger Email Manually
Use the send-pack webhook:
```powershell
$body = @{
    ucas_code = "0123456789"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/hooks/send-pack" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{"x-webhook-secret" = "replace-with-a-long-secret"} `
    -Body $body
```

## 🛠️ Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify `.env` file exists
- Check `node_modules` is installed

### Database errors
- Delete `db/app.db*` files and restart to recreate
- Check disk permissions on `db/` directory

### Email not sending
- Verify `RESEND_API_KEY` is set correctly
- Check Resend dashboard for API status
- Emails are skipped (not failed) if API key is missing

### Rate limit hit
- Wait 15 minutes
- Adjust limits in `server.js` if needed

## 📚 Documentation Files

- **README.md**: User guide and deployment instructions
- **TESTING.md**: Comprehensive testing procedures with curl examples
- **test.ps1**: Quick PowerShell test script
- **.env.example**: Environment variable template

## 🎉 Acceptance Criteria - All Met

✅ Running `node server.js` starts app on PORT with no runtime errors  
✅ New UCAS codes randomise correctly and persist  
✅ Re-submit of same code shows fixed message with correct group  
✅ CSV upload creates or updates records  
✅ JISC webhook upserts records with secret auth only  
✅ send-pack webhook sends email and returns JSON  
✅ Admin search returns JSON and export returns CSV  
✅ All routes enforce intended auth rules  
✅ README explains run, test, and deploy steps clearly  

## 💡 Next Steps (Optional Enhancements)

1. **Block Randomisation**: Implement near-perfect 50-50 balance
2. **Admin Table UI**: Enhanced search results display
3. **Switchable Email Backend**: Support multiple providers
4. **Analytics Dashboard**: View assignment statistics
5. **Audit Log**: Track all changes and access
6. **Email Templates**: Customize emails per group
7. **Bulk Operations**: Mass email sending, bulk updates

## 📞 Support

For questions about the implementation, refer to:
- Code comments in `server.js`, `db/init.js`, and `email.js`
- Testing examples in `TESTING.md`
- Deployment notes in `README.md`

---

**Project Status**: ✅ Complete and Ready for Use

**Built with**: Node.js, Express, SQLite, Resend, Helmet, Rate Limiting

**License**: MIT
