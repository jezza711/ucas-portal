# TESTING.md - UCAS Portal Manual Tests

This document provides curl commands to manually test all endpoints of the UCAS Portal.

## Prerequisites

1. Start the server: `npm start`
2. Set your credentials in `.env` file
3. Default admin credentials: `admin` / `change-this`
4. Default webhook secret: `replace-with-a-long-secret`

## Health Check

```bash
curl -s http://localhost:3000/health
```

**Expected:** `{"ok":true}`

---

## Student Portal Tests

### Test 1: Invalid UCAS Code (Wrong Format)

```bash
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=abc" http://localhost:3000/randomise
```

**Expected:** Error message about invalid format

### Test 2: Invalid UCAS Code (Too Short)

```bash
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=12345" http://localhost:3000/randomise
```

**Expected:** Error message about needing 10 digits

### Test 3: First Randomisation (New Student)

```bash
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=0123456789" http://localhost:3000/randomise
```

**Expected:** JSON with `already_assigned: false`, assigned group (VIDEO or AI), and PDF URL

### Test 4: Re-submit Same Code (Already Assigned)

```bash
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=0123456789" http://localhost:3000/randomise
```

**Expected:** JSON with `already_assigned: true` and same group as Test 3

### Test 5: Another New Student

```bash
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=9876543210" http://localhost:3000/randomise
```

**Expected:** New assignment (may be different group than Test 3)

---

## Admin Tests

### Test 6: Admin Page Access (No Auth)

```bash
curl -s http://localhost:3000/admin
```

**Expected:** 401 Unauthorized

### Test 7: Admin Page Access (With Auth)

```bash
curl -s -u admin:change-this http://localhost:3000/admin
```

**Expected:** HTML content with admin dashboard

### Test 8: Search All Students

```bash
curl -s -u admin:change-this http://localhost:3000/admin/search
```

**Expected:** JSON with `results` array containing all students from previous tests

### Test 9: Search by UCAS Code

```bash
curl -s -u admin:change-this "http://localhost:3000/admin/search?ucas_code=0123456789"
```

**Expected:** JSON with matching student record

### Test 10: Search by Group

```bash
curl -s -u admin:change-this "http://localhost:3000/admin/search?group=VIDEO"
```

**Expected:** JSON with all students in VIDEO group

### Test 11: Search Unassigned Students

```bash
curl -s -u admin:change-this "http://localhost:3000/admin/search?group=null"
```

**Expected:** JSON with students who haven't been assigned yet

### Test 12: Export CSV

```bash
curl -s -u admin:change-this http://localhost:3000/admin/export.csv
```

**Expected:** CSV file with all student records

### Test 13: Upload CSV (Create Test File First)

First, create a test CSV file:

```bash
# On Windows PowerShell:
@"
ucas_code,email
1111111111,alice@example.com
2222222222,bob@example.com
"@ | Out-File -Encoding utf8 test.csv

# On macOS/Linux:
cat > test.csv << 'EOF'
ucas_code,email
1111111111,alice@example.com
2222222222,bob@example.com
EOF
```

Then upload it:

```bash
curl -s -u admin:change-this -F "csvFile=@test.csv" http://localhost:3000/admin/upload
```

**Expected:** JSON with `processed: 2`, `created` and `updated` counts

---

## Webhook Tests

### Test 14: JISC Webhook (Missing Secret)

```bash
curl -s -X POST -H "Content-Type: application/json" -d "{\"ucas_code\":\"3333333333\",\"email\":\"charlie@example.com\"}" http://localhost:3000/api/jisc-webhook
```

**Expected:** 401 Unauthorized - Invalid webhook secret

### Test 15: JISC Webhook (Valid Secret)

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"3333333333\",\"email\":\"charlie@example.com\"}" http://localhost:3000/api/jisc-webhook
```

**Expected:** `{"ok":true}` with success message

### Test 16: JISC Webhook Update Existing

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"0123456789\",\"email\":\"updated@example.com\"}" http://localhost:3000/api/jisc-webhook
```

**Expected:** `{"ok":true}` - should update email for existing student

### Test 17: Send Pack Email (Student Not Found)

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"9999999999\"}" http://localhost:3000/api/hooks/send-pack
```

**Expected:** 404 - Student not found

### Test 18: Send Pack Email (Existing Student)

First, ensure student 0123456789 has an email and assignment from previous tests:

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"0123456789\"}" http://localhost:3000/api/hooks/send-pack
```

**Expected:** `{"ok":true, "email_sent": true}` (or `skipped: true` if no SENDGRID_API_KEY/RESEND_API_KEY set)

### Test 19: Send Pack Email with Override Email

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"0123456789\",\"email\":\"override@example.com\"}" http://localhost:3000/api/hooks/send-pack
```

**Expected:** `{"ok":true}` - email sent to override address

### Test 20: Send Pack Email (Unassigned Student)

First create an unassigned student via JISC webhook:

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"4444444444\",\"email\":\"test@example.com\"}" http://localhost:3000/api/jisc-webhook
```

Then try to send pack:

```bash
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"4444444444\"}" http://localhost:3000/api/hooks/send-pack
```

**Expected:** 400 - Student has not been assigned to a group yet

---

## Rate Limiting Tests

### Test 21: Rate Limit Check

Run the same request repeatedly (100+ times) to trigger rate limiting:

```bash
# Windows PowerShell:
for ($i=1; $i -le 110; $i++) { 
  curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=0123456789" http://localhost:3000/randomise 
}

# macOS/Linux:
for i in {1..110}; do
  curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=0123456789" http://localhost:3000/randomise
done
```

**Expected:** After 100 requests within 15 minutes, you should see rate limit error

---

## Browser Tests

### Test 22: Student Portal UI

1. Open browser to `http://localhost:3000`
2. Enter a 10-digit UCAS code
3. Click "Get My Assignment"
4. Verify you see group assignment and PDF link
5. Re-submit same code - verify "already assigned" message

### Test 23: Admin Dashboard UI

1. Open browser to `http://localhost:3000/admin`
2. Enter credentials when prompted: `admin` / `change-this`
3. Test CSV upload with the test.csv file
4. Test search functionality
5. Test export CSV button

---

## Integration Test Flow

Complete end-to-end flow:

```bash
# 1. Add student via JISC webhook
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"5555555555\",\"email\":\"integration@example.com\"}" http://localhost:3000/api/jisc-webhook

# 2. Student visits portal and gets assigned
curl -s -X POST -H "Content-Type: application/x-www-form-urlencoded" -d "ucas_code=5555555555" http://localhost:3000/randomise

# 3. Send pack email
curl -s -X POST -H "Content-Type: application/json" -H "x-webhook-secret: replace-with-a-long-secret" -d "{\"ucas_code\":\"5555555555\"}" http://localhost:3000/api/hooks/send-pack

# 4. Admin searches for student
curl -s -u admin:change-this "http://localhost:3000/admin/search?ucas_code=5555555555"
```

---

## Notes

- **Email Testing**: If `SENDGRID_API_KEY` (or fallback `RESEND_API_KEY`) is not set, emails will be skipped (check server logs for confirmation)
- **UCAS Code Format**: Must be exactly 10 digits, spaces are automatically removed
- **Groups**: Only two valid groups: `VIDEO` and `AI`
- **Rate Limits**: 100 requests per 15 minutes for public routes, 1000 for webhooks
- **Authentication**: Admin routes use Basic Auth, webhooks use header-based secret

## Cleanup

To start fresh, delete the database:

```bash
# Windows PowerShell:
Remove-Item db\app.db*

# macOS/Linux:
rm db/app.db*
```

Then restart the server to create a new empty database.
