require('dotenv').config();
const sgMail = require('@sendgrid/mail');

// Support legacy RESEND_API_KEY env so users do not need to rename immediately.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}
const emailClientReady = Boolean(SENDGRID_API_KEY);

const GROUP_LABELS = {
  VIDEO: 'Video Course',
  AI: 'AI Group',
};

const GROUP_SUBJECTS = {
  VIDEO: 'Your Video Course Pack',
  AI: 'Welcome to AVA – Your AI Interview Coach',
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

  // If no SendGrid API key, skip sending so flow can continue locally
  if (!emailClientReady) {
    console.log(`⚠️  Email skipped (no SENDGRID_API_KEY/RESEND_API_KEY): ${to} - ${group_name}`);
    return { ok: true, skipped: true };
  }

  // Validate email format
  if (!to || !to.includes('@')) {
    return { ok: false, error: 'Invalid email address' };
  }

  const groupLabel = GROUP_LABELS[group_name];
  const { htmlBody, textBody, subject } = buildEmailTemplates({
    group: group_name,
    groupLabel,
    ucas_code,
  });

  try {
    const [response] = await sgMail.send({
      to,
      from: process.env.EMAIL_FROM,
      subject,
      html: htmlBody,
      text: textBody,
    });

    const messageId = response?.headers ? response.headers['x-message-id'] || response.headers['x-sendgrid-message-id'] : undefined;
    console.log(`✓ Email sent to ${to} - ${group_name} (SendGrid id: ${messageId || 'n/a'})`);
    return { ok: true, id: messageId };
  } catch (error) {
    const errMsg = error?.response?.body?.errors?.[0]?.message || error.message;
    console.error(`✗ Email send failed to ${to}:`, errMsg);
    return { ok: false, error: errMsg };
  }
}

module.exports = {
  sendGroupEmail,
};

function buildEmailTemplates({ group, groupLabel, ucas_code }) {
  if (group === 'VIDEO') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #1f2933;
            max-width: 640px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f7fb;
          }
          .card {
            background: #fff;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
          }
          h1 {
            color: #0f62fe;
            margin-bottom: 10px;
          }
          .info-box {
            background: #e8f1ff;
            border-left: 4px solid #0f62fe;
            padding: 14px;
            border-radius: 6px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 20px;
            background: #0f62fe;
            color: #fff;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin: 15px 0;
          }
          ul {
            padding-left: 18px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🎓 Welcome to the Video Course Group!</h1>
          <p>UCAS Personal ID: <strong>${ucas_code}</strong></p>
          <p>Congratulations! You have been allocated to the <strong>Video Course group</strong> for our national study on interview preparation. You now have free access to the Medical Interview Video Course until May 2026, featuring 50+ hours of structured lessons covering MMI, panel, and Oxbridge interviews.</p>

          <p>Please watch the video and read the brochure in full:</p>
          <ul>
            <li>🚀 Induction video: <a href="https://youtu.be/mqdV7OEE7VY">https://youtu.be/mqdV7OEE7VY</a></li>
            <li>🌟 Video Course brochure: <a href="https://drive.google.com/file/d/15KiBt4QEY02f50QRaqYnnOFOBOqzBoEM/view?usp=sharing">View brochure</a></li>
          </ul>

          <div class="info-box">
            <strong>To activate your access:</strong>
            <ol>
              <li>Sign up here: <a href="https://courses.theaspiringmedics.co.uk/p/medicine-interview-course">https://courses.theaspiringmedics.co.uk/p/medicine-interview-course</a></li>
              <li>Enter the coupon code: <strong>VIDEO</strong></li>
              <li>Log in here: <a href="https://courses.theaspiringmedics.co.uk/courses/1238867/lectures/51544174">https://courses.theaspiringmedics.co.uk/courses/1238867/lectures/51544174</a></li>
            </ol>
          </div>

          <p>This course is designed to help you master every interview format with guided walkthroughs, exemplar answers, and step-by-step drills.</p>

          <p>Warm regards,<br>Aspiring Medics Research Team<br><a href="mailto:Outreach@theaspiringmedics.co.uk">Outreach@theaspiringmedics.co.uk</a></p>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to the Video Course Group!

UCAS Personal ID: ${ucas_code}

You now have free access to the Medical Interview Video Course until May 2026.

Please watch the video and read the brochure in full:
🚀 Induction video: https://youtu.be/mqdV7OEE7VY
🌟 Video Course brochure: https://drive.google.com/file/d/15KiBt4QEY02f50QRaqYnnOFOBOqzBoEM/view?usp=sharing

To activate your access:
1) Sign up here: https://courses.theaspiringmedics.co.uk/p/medicine-interview-course
2) Enter the coupon code: VIDEO
3) Log in here: https://courses.theaspiringmedics.co.uk/courses/1238867/lectures/51544174

The course includes 50+ hours of structured lessons for MMI, panel, and Oxbridge interviews.

Aspiring Medics Research Team
Outreach@theaspiringmedics.co.uk`.trim();

    return { htmlBody: html, textBody: text, subject: GROUP_SUBJECTS.VIDEO };
  }

  if (group === 'AI') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 640px;
            margin: 0 auto;
            padding: 20px;
            background: #f7f7fb;
          }
          .card {
            background: #fff;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 12px 25px rgba(102, 126, 234, 0.15);
          }
          h1 {
            color: #4f46e5;
            margin-bottom: 10px;
          }
          .steps {
            margin: 20px 0;
            padding-left: 18px;
          }
          .steps li {
            margin-bottom: 10px;
          }
          a.button {
            display: inline-block;
            margin: 10px 0;
            padding: 12px 20px;
            background: #4f46e5;
            color: #fff;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
          }
          .info-box {
            background: #eef2ff;
            border-left: 4px solid #4f46e5;
            padding: 14px;
            border-radius: 6px;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🎉 Welcome to the AVA Group!</h1>
          <p>UCAS Personal ID: <strong>${ucas_code}</strong></p>
          <p>Congratulations! You’ve been allocated to the <strong>AVA group</strong> for our national study on medical interview preparation. You now receive <strong>free access to AVA</strong>, your AI interview coach, until May 2026.</p>

          <p>Please watch the video and read the brochure in full:</p>
          <ul>
            <li>🚀 Induction video: <a href="https://youtu.be/JSWoEZXdo90">https://youtu.be/JSWoEZXdo90</a></li>
            <li>🌟 AVA brochure: <a href="https://drive.google.com/file/d/1p8MntMcR-HJxHPNbvD05aCoZ4-xItE4c/view?usp=sharing">View brochure</a></li>
          </ul>

          <div class="info-box">
            <strong>Important:</strong> To activate your access, please ensure you use the same email address (uncapitalised) that you used in the surveys.
          </div>

          <ol class="steps">
            <li>Register here: <a href="https://ai.theaspiringmedics.co.uk/register">https://ai.theaspiringmedics.co.uk/register</a></li>
            <li>Sign up here: <a href="https://buy.stripe.com/4gMcN55nBdgo04o63f6c009">https://buy.stripe.com/4gMcN55nBdgo04o63f6c009</a></li>
          </ol>

          <p>AVA lets you practise MMI and panel interviews with real-time feedback, available 24/7. We’re excited to have you on the programme!</p>

          <p>Warm regards,<br>Aspiring Medics Research Team<br><a href="mailto:Outreach@theaspiringmedics.co.uk">Outreach@theaspiringmedics.co.uk</a></p>
        </div>
      </body>
      </html>
    `;

    const text = `Welcome to the AVA Group!

UCAS Personal ID: ${ucas_code}

You now have free access to AVA, your AI interview coach, until May 2026.

Please watch the video and read the brochure in full:
🚀 Induction video: https://youtu.be/JSWoEZXdo90
🌟 AVA brochure: https://drive.google.com/file/d/1p8MntMcR-HJxHPNbvD05aCoZ4-xItE4c/view?usp=sharing

To activate your access, please ensure you use the same email address (uncapitalised) that you used in the surveys:
1) Register here: https://ai.theaspiringmedics.co.uk/register
2) Sign up here: https://buy.stripe.com/4gMcN55nBdgo04o63f6c009

AVA lets you practise MMI and panel interviews with real-time feedback. Welcome aboard!

Aspiring Medics Research Team
Outreach@theaspiringmedics.co.uk`.trim();

    return { htmlBody: html, textBody: text, subject: GROUP_SUBJECTS.AI };
  }

  const html = `
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

  const text = `Group Assignment Confirmed

Hello,

Your group assignment has been confirmed.

UCAS Personal ID: ${ucas_code}
Assigned Group: ${groupLabel}

Download your course pack: ${pdfUrl}

If you have any questions, please contact your course administrator.

Best regards,
Course Administration Team`.trim();

  return { htmlBody: html, textBody: text, subject: GROUP_SUBJECTS[group] };
}
