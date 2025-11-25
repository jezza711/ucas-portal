require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const basicAuth = require('express-basic-auth');
const { stringify } = require('csv-stringify/sync');
const path = require('path');

const { db, statements } = require('./db/init');
const { sendGroupEmail } = require('./email');
const { syncStudentRow, syncAllStudents } = require('./sheets');
const { getPackLinks, PACKS_DIR } = require('./pack-manager');
const { isForcedAi } = require('./forced-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Render and other reverse proxies inject X-Forwarded-* headers, so trust them
// to keep rate limiting and logging accurate.
app.set('trust proxy', 1);

// Constants
const GROUP_LABELS = {
  VIDEO: 'Video Course',
  AI: 'AI Group',
};

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Logging
app.use(morgan('tiny'));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static('public'));
app.use('/packs', express.static(PACKS_DIR));

// Rate limiting for public routes
const publicRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Rate limiting for webhook routes
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Higher limit for automated webhooks
  message: { error: 'Rate limit exceeded' }
});

// Basic Auth for admin routes
const adminAuth = basicAuth({
  users: { [process.env.ADMIN_USER]: process.env.ADMIN_PASS },
  challenge: true,
  realm: 'UCAS Portal Admin',
});

// Webhook authentication middleware
function webhookAuth(req, res, next) {
  const secret = req.headers['x-webhook-secret'];
  
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid webhook secret' });
  }
  
  next();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate and normalize UCAS code
 * @param {string} code - Raw UCAS code input
 * @returns {Object} { valid: boolean, code?: string, error?: string }
 */
function validateUcasCode(code) {
  if (!code) {
    return { valid: false, error: 'UCAS code is required' };
  }

  // Remove spaces and convert to uppercase
  const normalized = String(code).replace(/\s/g, '').toUpperCase();

  // Check if exactly 10 digits
  if (!/^[0-9]{10}$/.test(normalized)) {
    return { valid: false, error: 'UCAS code must be exactly 10 digits' };
  }

  return { valid: true, code: normalized };
}

/**
 * Randomise student to VIDEO or AI group (50-50)
 * @returns {string} 'VIDEO' or 'AI'
 */
function randomiseGroup() {
  return Math.random() < 0.5 ? 'VIDEO' : 'AI';
}

/**
 * Get current ISO datetime string
 * @returns {string}
 */
function now() {
  return new Date().toISOString();
}

// =========================================================================
// GOOGLE SHEETS HELPERS
// =========================================================================

function syncStudentSheetByCode(ucasCode) {
  if (!ucasCode) {
    return;
  }

  try {
    const student = statements.findByCode.get(ucasCode);
    if (!student) {
      return;
    }

    syncStudentRow(student).catch((error) => {
      console.error(`[Sheets] Unable to sync ${ucasCode}:`, error.message);
    });
  } catch (error) {
    console.error(`[Sheets] Student lookup failed for ${ucasCode}:`, error.message);
  }
}

function syncEntireSheetAsync() {
  try {
    const students = statements.getAll.all();
    syncAllStudents(students).catch((error) => {
      console.error('[Sheets] Full sync helper failed:', error.message);
    });
  } catch (error) {
    console.error('[Sheets] Unable to read students for full sync:', error.message);
  }
}

function buildPackLinks(group, req) {
  const links = getPackLinks(group);
  if (!links) {
    return { client: null, email: null };
  }

  const hasAbsoluteEmail = Boolean(links.email && /^https?:\/\//i.test(links.email));
  if (hasAbsoluteEmail || !links.client || !req) {
    return links;
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  return {
    client: links.client,
    email: `${origin}${links.client}`,
  };
}

// ============================================================================
// STUDENT ROUTES
// ============================================================================

/**
 * POST /randomise - Student randomisation endpoint
 */
app.post('/randomise', publicRateLimit, async (req, res) => {
  try {
    const { ucas_code, email } = req.body;

    // Validate UCAS code
    const validation = validateUcasCode(ucas_code);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Validate and sanitize email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }
    const sanitizedEmail = email.trim().toLowerCase();

    const code = validation.code;

    // Check if student already exists
    const existing = statements.findByCode.get(code);
    const forcedAi = isForcedAi(code);
    const timestamp = now();

    if (existing && existing.group_name && (!forcedAi || existing.group_name === 'AI')) {
      const packLinks = buildPackLinks(existing.group_name, req);
      syncStudentSheetByCode(code);
      // Already assigned - return existing assignment
      return res.json({
        already_assigned: true,
        group_name: existing.group_name,
        group_label: GROUP_LABELS[existing.group_name],
        pdf_url: packLinks.client,
      });
    }

    // New or forced assignment needed
    const assignedGroup = forcedAi ? 'AI' : randomiseGroup();

    if (existing) {
      // Student exists but no group assigned yet - update group and email
      statements.updateGroup.run(assignedGroup, timestamp, code);
      statements.upsertEmail.run(code, sanitizedEmail, timestamp, timestamp);
    } else {
      // Completely new student - insert with email
      statements.insert.run(code, assignedGroup, sanitizedEmail, timestamp, timestamp);
    }

    const packLinks = buildPackLinks(assignedGroup, req);

    // Send email with the assigned group pack
    let emailSent = false;
    const emailResult = await sendGroupEmail({
      to: sanitizedEmail,
      ucas_code: code,
      group_name: assignedGroup,
      pdf_url: packLinks.email,
    });

    if (emailResult.ok && !emailResult.skipped) {
      emailSent = true;
      statements.updateEmailSent.run(timestamp, timestamp, code);
    }

    syncStudentSheetByCode(code);

    return res.json({
      already_assigned: Boolean(existing && existing.group_name && !forcedAi),
      group_name: assignedGroup,
      group_label: GROUP_LABELS[assignedGroup],
      pdf_url: packLinks.client,
      email_sent: emailSent,
    });

  } catch (error) {
    console.error('Error in /randomise:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * GET /admin - Admin dashboard HTML
 */
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * GET /admin/search - Search students
 */
app.get('/admin/search', adminAuth, (req, res) => {
  try {
    const { ucas_code, group, email } = req.query;

    const filters = [];
    const params = [];

    if (ucas_code) {
      filters.push('ucas_code LIKE ?');
      params.push(`%${ucas_code}%`);
    }

    if (email) {
      filters.push('email LIKE ?');
      params.push(`%${email}%`);
    }

    if (group) {
      if (group === 'null') {
        filters.push('group_name IS NULL');
      } else {
        filters.push('group_name = ?');
        params.push(group);
      }
    }

    let query = 'SELECT * FROM students';
    if (filters.length > 0) {
      query += ` WHERE ${filters.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC';

    const results = db.prepare(query).all(...params);

    return res.json({ results });

  } catch (error) {
    console.error('Error in /admin/search:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /admin/export.csv - Export all students as CSV
 */
app.get('/admin/export.csv', adminAuth, (req, res) => {
  try {
    const students = statements.getAll.all();

    const csv = stringify(students, {
      header: true,
      columns: ['ucas_code', 'group_name', 'email', 'created_at', 'updated_at', 'email_last_sent_at']
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="students-export.csv"');
    res.send(csv);

  } catch (error) {
    console.error('Error in /admin/export.csv:', error);
    return res.status(500).json({ error: 'Export failed' });
  }
});

// ============================================================================
// WEBHOOK ROUTES
// ============================================================================

/**
 * POST /api/jisc-webhook - JISC student upsert webhook
 */
app.post('/api/jisc-webhook', webhookRateLimit, webhookAuth, async (req, res) => {
  try {
    const { ucas_code, email } = req.body;

    if (!ucas_code) {
      return res.status(400).json({ error: 'ucas_code is required' });
    }

    // Validate UCAS code
    const validation = validateUcasCode(ucas_code);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const code = validation.code;
    const timestamp = now();

    // Upsert the record
    statements.upsertEmail.run(code, email || null, timestamp, timestamp);
    syncStudentSheetByCode(code);

    return res.json({ 
      ok: true, 
      ucas_code: code,
      message: 'Student record upserted successfully' 
    });

  } catch (error) {
    console.error('Error in /api/jisc-webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/hooks/send-pack - Send group pack email webhook
 */
app.post('/api/hooks/send-pack', webhookRateLimit, webhookAuth, async (req, res) => {
  try {
    const { ucas_code, email } = req.body;

    if (!ucas_code) {
      return res.status(400).json({ error: 'ucas_code is required' });
    }

    // Validate UCAS code
    const validation = validateUcasCode(ucas_code);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const code = validation.code;

    // Look up student
    const student = statements.findByCode.get(code);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.group_name) {
      return res.status(400).json({ error: 'Student has not been assigned to a group yet' });
    }

    // Determine email to use
    const targetEmail = email || student.email;

    if (!targetEmail) {
      return res.status(400).json({ error: 'No email address available for this student' });
    }

    const packLinks = buildPackLinks(student.group_name, req);

    // Send email
    const emailResult = await sendGroupEmail({
      to: targetEmail,
      ucas_code: code,
      group_name: student.group_name,
      pdf_url: packLinks.email,
    });

    if (!emailResult.ok) {
      return res.status(500).json({ 
        error: 'Email send failed', 
        details: emailResult.error 
      });
    }

    // Update email_last_sent_at
    if (!emailResult.skipped) {
      const timestamp = now();
      statements.updateEmailSent.run(timestamp, timestamp, code);
      syncStudentSheetByCode(code);
    }

    return res.json({ 
      ok: true,
      email_sent: !emailResult.skipped,
      skipped: emailResult.skipped || false,
      message: emailResult.skipped 
        ? 'Email skipped (no SENDGRID_API_KEY configured)' 
        : 'Email sent successfully'
    });

  } catch (error) {
    console.error('Error in /api/hooks/send-pack:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('');
  console.log('🚀 UCAS Randomisation Portal');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📍 Server running on http://localhost:${PORT}`);
  console.log(`🎓 Student portal: http://localhost:${PORT}`);
  console.log(`🔐 Admin dashboard: http://localhost:${PORT}/admin`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

syncEntireSheetAsync();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    db.close();
    console.log('Database connection closed');
    process.exit(0);
  });
});
