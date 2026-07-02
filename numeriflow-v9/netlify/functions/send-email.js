const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  // Basic origin check
  const origin = event.headers.origin || '';
  if (!origin.includes('numeriflow.uk') && !origin.includes('localhost')) {
    return { statusCode: 403, body: 'Forbidden' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { parent_name, to_email, type } = body;
  if (!to_email || !parent_name) {
    return { statusCode: 400, body: 'Missing fields' };
  }

  // Email content by type
  const templates = {
    welcome: {
      subject: `Welcome to NumeriFlow, ${parent_name}! 🦊`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#F8F4EF;padding:32px 24px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src="https://numeriflow.uk/logo.png" alt="NumeriFlow" style="height:56px;">
          </div>
          <div style="background:#fff;border-radius:14px;padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🦊</div>
            <h1 style="font-size:24px;color:#1B2D6B;margin-bottom:8px;font-family:Arial,sans-serif;">
              Welcome, ${parent_name}!
            </h1>
            <p style="color:#5F5E5A;font-size:15px;line-height:1.7;margin-bottom:24px;">
              Your NumeriFlow account is ready. Pip the fox is excited to start learning with your child!
            </p>
            <a href="https://numeriflow.uk/login" 
               style="display:inline-block;background:#FF6B6B;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;">
              Sign in to NumeriFlow →
            </a>
            <div style="margin-top:24px;background:#E1F5EE;border-radius:10px;padding:16px;text-align:left;">
              <div style="font-size:13px;font-weight:700;color:#0F6E56;margin-bottom:8px;">Getting started:</div>
              <div style="font-size:13px;color:#0F6E56;line-height:2;">
                1️⃣ Sign in and add your child's profile<br>
                2️⃣ Run the 8-minute game-based assessment<br>
                3️⃣ Pip creates a personalised learning plan
              </div>
            </div>
            <p style="color:#888780;font-size:12px;margin-top:20px;">
              Questions? Reply to this email or contact 
              <a href="mailto:info@numeriflow.uk" style="color:#1D9E75;">info@numeriflow.uk</a>
            </p>
          </div>
          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">
            Numeriflow Kids Learning Ltd · London, UK · 
            <a href="https://numeriflow.uk" style="color:#aaa;">numeriflow.uk</a>
          </p>
        </div>
      `
    },
    beta: {
      subject: `You're in the NumeriFlow Beta! 🎉`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#F8F4EF;padding:32px 24px;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <img src="https://numeriflow.uk/logo.png" alt="NumeriFlow" style="height:56px;">
          </div>
          <div style="background:#fff;border-radius:14px;padding:32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🎉</div>
            <h1 style="font-size:24px;color:#1B2D6B;margin-bottom:8px;font-family:Arial,sans-serif;">
              Welcome to the Beta, ${parent_name}!
            </h1>
            <p style="color:#5F5E5A;font-size:15px;line-height:1.7;margin-bottom:20px;">
              You're one of our founding families. Your feedback will shape NumeriFlow for thousands of children.
            </p>
            <div style="background:#E1F5EE;border-radius:10px;padding:16px;text-align:left;margin-bottom:24px;">
              <div style="font-size:13px;font-weight:700;color:#0F6E56;margin-bottom:8px;">Your free Pro access code:</div>
              <div style="font-size:28px;font-weight:900;color:#1B2D6B;text-align:center;letter-spacing:4px;padding:10px;">NF2026</div>
              <div style="font-size:12px;color:#0F6E56;text-align:center;">Enter this on your dashboard to unlock all games</div>
            </div>
            <a href="https://numeriflow.uk/login" 
               style="display:inline-block;background:#FF6B6B;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;text-decoration:none;">
              Sign in and enter code →
            </a>
          </div>
          <p style="text-align:center;color:#aaa;font-size:11px;margin-top:16px;">
            Numeriflow Kids Learning Ltd · London, UK
          </p>
        </div>
      `
    }
  };

  const template = templates[type] || templates.welcome;

  const transporter = nodemailer.createTransport({
    host: 'smtp.ionos.co.uk',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.sendMail({
      from: `"NumeriFlow" <${process.env.SMTP_USER}>`,
      to: to_email,
      subject: template.subject,
      html: template.html,
    });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch(err) {
    console.error('SMTP error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
