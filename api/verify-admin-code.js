/**
 * Vercel Serverless Function: Verify Admin 2FA Code
 *
 * POST /api/verify-admin-code
 * Body: { userId, code }
 *
 * Verifies the 6-digit code against stored value.
 * Returns success if code matches and hasn't expired.
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

  const { userId, code } = req.body;
  if (!userId || !code) {
    return res.status(400).json({ error: 'Missing userId or code' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[verify-admin-code] Missing env vars:', {
      hasSupabaseUrl: !!SUPABASE_URL,
      hasSupabaseKey: !!SUPABASE_KEY,
    });
    return res.status(500).json({
      error: 'Server configuration error',
      missing: {
        SUPABASE_URL: !SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !SUPABASE_KEY,
      }
    });
  }

  try {
    // Fetch code from database
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_verification_codes?user_id=eq.${userId}&select=code,expires_at`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!fetchRes.ok) {
      console.error('[verify-admin-code] Failed to fetch code');
      return res.status(500).json({ error: 'Failed to verify code' });
    }

    const codes = await fetchRes.json();
    if (!codes || codes.length === 0) {
      return res.status(400).json({ error: 'No code found. Request a new one.', expired: true });
    }

    const stored = codes[0];
    const now = new Date();
    const expiresAt = new Date(stored.expires_at);

    // Check if expired
    if (now > expiresAt) {
      // Delete expired code
      await fetch(`${SUPABASE_URL}/rest/v1/admin_verification_codes?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      return res.status(400).json({ error: 'Code expired. Request a new one.', expired: true });
    }

    // Check if code matches
    if (stored.code !== code) {
      return res.status(400).json({ error: 'Invalid code', invalid: true });
    }

    // Code is valid - delete it (one-time use)
    await fetch(`${SUPABASE_URL}/rest/v1/admin_verification_codes?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });

    console.log(`[verify-admin-code] Code verified for user ${userId}`);
    return res.status(200).json({ success: true, verified: true });

  } catch (error) {
    console.error('[verify-admin-code] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
