/**
 * Vercel Cron Job — pings Supabase every 3 days to prevent free-tier project pausing.
 * Supabase pauses projects after 7 days of inactivity; this runs every 3 days as a buffer.
 *
 * Schedule: see vercel.json → "crons"
 */
export default async function handler(req, res) {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    'https://mkehxermgmdqsogmlaqq.supabase.co';

  const start = Date.now();

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - start;
    const body = await response.text();

    console.log(`[keepalive] Supabase ping OK — ${response.status} in ${elapsed}ms`);

    return res.status(200).json({
      ok: true,
      supabaseStatus: response.status,
      elapsed,
      body,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`[keepalive] Supabase ping FAILED — ${err.message} (${elapsed}ms)`);

    // Still return 200 so Vercel doesn't mark the cron as failed on a temporary blip
    return res.status(200).json({
      ok: false,
      error: err.message,
      elapsed,
      timestamp: new Date().toISOString(),
    });
  }
}
