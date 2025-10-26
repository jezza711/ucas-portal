const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure db directory exists
const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'app.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create students table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    ucas_code TEXT PRIMARY KEY NOT NULL,
    group_name TEXT CHECK(group_name IN ('VIDEO', 'AI') OR group_name IS NULL),
    email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    email_last_sent_at TEXT
  );
`);

// Create index on group_name for faster filtering
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_group_name ON students(group_name);
`);

console.log('✓ Database initialized at', dbPath);
console.log('✓ WAL mode enabled');
console.log('✓ Students table ready');

// Prepared statements for common operations

const statements = {
  // Find student by UCAS code
  findByCode: db.prepare(`
    SELECT * FROM students WHERE ucas_code = ?
  `),

  // Insert new student (no group assigned yet)
  insert: db.prepare(`
    INSERT INTO students (ucas_code, group_name, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `),

  // Update student's group assignment
  updateGroup: db.prepare(`
    UPDATE students 
    SET group_name = ?, updated_at = ?
    WHERE ucas_code = ?
  `),

  // Update or insert email
  upsertEmail: db.prepare(`
    INSERT INTO students (ucas_code, email, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(ucas_code) DO UPDATE SET
      email = excluded.email,
      updated_at = excluded.updated_at
  `),

  // Update email_last_sent_at
  updateEmailSent: db.prepare(`
    UPDATE students
    SET email_last_sent_at = ?, updated_at = ?
    WHERE ucas_code = ?
  `),

  // Search by UCAS code pattern
  searchByCode: db.prepare(`
    SELECT * FROM students WHERE ucas_code LIKE ?
  `),

  // Filter by group
  searchByGroup: db.prepare(`
    SELECT * FROM students WHERE group_name = ?
  `),

  // Get all students
  getAll: db.prepare(`
    SELECT * FROM students ORDER BY created_at DESC
  `),

  // Combined search
  searchByCodeAndGroup: db.prepare(`
    SELECT * FROM students 
    WHERE ucas_code LIKE ? AND group_name = ?
  `),
};

module.exports = {
  db,
  statements,
};
