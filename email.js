require('dotenv').config();
const { Resend } = require('resend');

// Initialize Resend client if API key is present
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const GROUP_LABELS = {
  VIDEO: 'Video Course',
  AI: 'AI Group',
};

const GROUP_SUBJECTS = {
  VIDEO: 'Your Video Course Pack',
  AI: 'Your AI Group Pack',
};

/**
 * Send group assignment email to student
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.ucas_code - Student's UCAS code
 * @param {string} params.group_name - Group assignment (VIDEO or AI)
 * @returns {Promise<Object>} { ok: boolean, skipped?: boolean, id?: string, error?: string }
 */
async function sendGroupEmail({ to, ucas_code, group_name }) {
  // Validate group
  if (!['VIDEO', 'AI'].includes(group_name)) {
    return { ok: false, error: 'Invalid group name' };
  }

  // If no Resend API key, skip sending
  if (!resend) {
    console.log(`⚠️  Email skipped (no RESEND_API_KEY): ${to} - ${group_name}`);
    return { ok: true, skipped: true };
  }

  // Validate email format
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Invalid email address' };
  }

  const pdfUrl = group_name === 'VIDEO' 
    ? process.env.VIDEO_PDF_URL 
    : process.env.AI_PDF_URL;

  const subject = GROUP_SUBJECTS[group_name];
  const groupLabel = GROUP_LABELS[group_name];

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 8px 8px 0 0;
          text-align: center;
        }
        .content {
          background: #f9f9f9;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin-top: 20px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          color: #888;
          font-size: 14px;
        }
        .info-box {
          background: white;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎓 Group Assignment Confirmed</h1>
      </div>
      <div class="content">
        <p>Hello,</p>
        
        <p>Your group assignment has been confirmed. Here are your details:</p>
        
        <div class="info-box">
          <strong>UCAS Personal ID:</strong> ${ucas_code}<br>
          <strong>Assigned Group:</strong> ${groupLabel}
        </div>
        
        <p>Please download your course pack using the link below:</p>
        
        <div style="text-align: center;">
          <a href="${pdfUrl}" class="button">📄 Download ${groupLabel} Pack</a>
        </div>
        
        <p style="margin-top: 30px;">If you have any questions, please contact your course administrator.</p>
        
        <p>Best regards,<br>Course Administration Team</p>
      </div>
      <div class="footer">
        This email was sent regarding your UCAS application.
      </div>
    </body>
    </html>
  `;

  const textBody = `
Group Assignment Confirmed

Hello,

Your group assignment has been confirmed.

UCAS Personal ID: ${ucas_code}
Assigned Group: ${groupLabel}

Download your course pack: ${pdfUrl}

If you have any questions, please contact your course administrator.

Best regards,
Course Administration Team
  `.trim();

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: to,
      subject: subject,
      html: htmlBody,
      text: textBody,
    });

    console.log(`✓ Email sent to ${to} - ${group_name} (ID: ${result.data?.id})`);
    return { ok: true, id: result.data?.id };
  } catch (error) {
    console.error(`✗ Email send failed to ${to}:`, error.message);
    return { ok: false, error: error.message };
  }
}

module.exports = {
  sendGroupEmail,
};
