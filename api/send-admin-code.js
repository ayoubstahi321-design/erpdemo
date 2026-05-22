/**
 * Vercel Serverless Function: Send Admin 2FA Code via Resend
 *
 * POST /api/send-admin-code
 * Body: { email, userId }
 *
 * Generates a 6-digit code, stores it in Supabase, and sends via email.
 * Codes expire after 5 minutes.
 */
export default async function handler(req, res) {
  // CORS
  const allowedOrigins = [
    'https://azmol.es',
    'https://www.azmol.es',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, userId } = req.body;
  if (!email || !userId) {
    return res.status(400).json({ error: 'Missing email or userId' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[send-admin-code] Missing env vars:', {
      hasResendKey: !!RESEND_API_KEY,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseKey: !!SUPABASE_KEY,
    });
    return res.status(500).json({
      error: 'Server configuration error',
      missing: {
        RESEND_API_KEY: !RESEND_API_KEY,
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SUPABASE_KEY,
      }
    });
  }

  try {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Delete any existing codes for this user
    await fetch(`${SUPABASE_URL}/rest/v1/admin_verification_codes?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    // Insert new code
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_verification_codes`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        code: code,
        expires_at: expiresAt,
      }),
    });

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('[send-admin-code] Failed to insert code:', err);
      return res.status(500).json({ error: 'Failed to generate code' });
    }

    // Send email via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Azmol ERP <onboarding@resend.dev>',
        to: email,
        subject: 'Codigo de verificacion - Azmol ERP',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1e3a5f; font-size: 24px; margin: 0;">Azmol ERP</h1>
              <p style="color: #64748b; font-size: 14px; margin-top: 8px;">Verificacion de acceso Admin</p>
            </div>

            <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <p style="color: rgba(255,255,255,0.8); font-size: 14px; margin: 0 0 16px 0;">Tu codigo de verificacion es:</p>
              <div style="background: white; border-radius: 12px; padding: 20px; display: inline-block;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a5f;">${code}</span>
              </div>
            </div>

            <div style="background: #fef3c7; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #92400e; font-size: 13px; margin: 0; text-align: center;">
                <strong>Este codigo expira en 5 minutos.</strong><br>
                Si no solicitaste este codigo, ignora este mensaje.
              </p>
            </div>

            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
              Azmol British Petrochemicals
            </p>
          </div>
        `,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('[send-admin-code] Resend error:', err);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    console.log(`[send-admin-code] Code sent to ${email}`);
    return res.status(200).json({ success: true, message: 'Code sent' });

  } catch (error) {
    console.error('[send-admin-code] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
