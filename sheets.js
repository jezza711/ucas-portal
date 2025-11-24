require('dotenv').config();
const { google } = require('googleapis');

const SHEETS_SCOPE = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_NAME = process.env.GOOGLE_SHEET_TAB || 'Students';
const rawSheetId = process.env.GOOGLE_SHEET_ID;
const SHEET_ID = rawSheetId && rawSheetId !== 'your-google-sheet-id' ? rawSheetId : null;
const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY || '';
const PRIVATE_KEY = rawPrivateKey.includes('...') || rawPrivateKey.length === 0
  ? null
  : rawPrivateKey.replace(/\\n/g, '\n');
const hasSheetsConfig = Boolean(
  SHEET_ID && process.env.GOOGLE_CLIENT_EMAIL && PRIVATE_KEY
);

let sheetsClient = null;

if (hasSheetsConfig) {
  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: SHEETS_SCOPE,
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    console.log(`[Sheets] Integration ready (tab: ${SHEET_NAME})`);
  } catch (error) {
    console.error('[Sheets] Failed to initialise Google Sheets client:', error.message);
  }
} else {
  console.log('[Sheets] Integration disabled (missing env vars).');
}

function mapStudentToRow(student = {}) {
  return [
    student.ucas_code || '',
    student.group_name || '',
    student.email || '',
    student.created_at || '',
    student.updated_at || '',
    student.email_last_sent_at || '',
  ];
}

function sheetsReady() {
  return Boolean(sheetsClient && SHEET_ID);
}

async function syncStudentRow(student) {
  if (!sheetsReady() || !student?.ucas_code) {
    return { ok: false, skipped: true };
  }

  try {
    const rowValues = [mapStudentToRow(student)];
    const existingRows = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = existingRows.data.values || [];
    let rowNumber = null;

    for (let index = 0; index < rows.length; index++) {
      const cellValue = rows[index][0];
      if (!cellValue || cellValue.toLowerCase() === 'ucas code') {
        continue;
      }
      if (cellValue === student.ucas_code) {
        rowNumber = index + 1;
        break;
      }
    }

    if (rowNumber) {
      await sheetsClient.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A${rowNumber}:F${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rowValues },
      });

      return { ok: true, updated: true };
    }

    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A:F`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowValues },
    });

    return { ok: true, appended: true };
  } catch (error) {
    console.error(`[Sheets] Row sync failed (${student.ucas_code}):`, error.message);
    return { ok: false, error: error.message };
  }
}

async function syncAllStudents(students = []) {
  if (!sheetsReady()) {
    return { ok: false, skipped: true };
  }

  const header = ['UCAS Code', 'Group Name', 'Email', 'Created At', 'Updated At', 'Email Last Sent At'];
  const rows = [header, ...students.map(mapStudentToRow)];

  try {
    await sheetsClient.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: SHEET_NAME,
    });

    await sheetsClient.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1:F${rows.length}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    return { ok: true, total: students.length };
  } catch (error) {
    console.error('[Sheets] Full sync failed:', error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  syncStudentRow,
  syncAllStudents,
  sheetsReady,
};
