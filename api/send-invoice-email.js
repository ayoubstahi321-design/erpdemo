/**
 * Vercel Serverless Function: Send Invoice Email via Resend
 *
 * POST /api/send-invoice-email
 * Body: { to, subject, html, pdfBase64, pdfFilename, replyTo, fromName, fromEmail }
 *
 * Requires RESEND_API_KEY environment variable in Vercel.
 * fromName/fromEmail come from the active company profile.
 * Falls back to RESEND_FROM_EMAIL env var, then to Resend testing address.
 */
export default async function handler(req, res) {
  // CORS: only allow requests from our own domain
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

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({
      error: 'Service email non configuré. Ajoutez RESEND_API_KEY dans les variables Vercel.'
    });
  }

  try {
    const { to, subject, html, pdfBase64, pdfFilename, replyTo, fromName, fromEmail: bodyFromEmail } = req.body;

    // Validate required fields
    if (!to || !subject || !pdfBase64) {
      return res.status(400).json({ error: 'Champs requis manquants: to, subject, pdfBase64' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    // From address: prefer company profile email, fall back to env var, then Resend testing
    let fromAddress;
    if (bodyFromEmail && fromName) {
      fromAddress = `${fromName} <${bodyFromEmail}>`;
    } else if (bodyFromEmail) {
      fromAddress = bodyFromEmail;
    } else {
      fromAddress = process.env.RESEND_FROM_EMAIL || 'Azmol <onboarding@resend.dev>';
    }

    const payload = {
      from: fromAddress,
      to: [to],
      subject,
      html: html || `<p>${subject}</p>`,
      attachments: [
        {
          filename: pdfFilename || 'facture.pdf',
          content: pdfBase64,
        },
      ],
    };

    // Add reply-to if provided (so customer can reply to the company email)
    if (replyTo) {
      payload.reply_to = replyTo;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-invoice-email] Resend error:', data);
      return res.status(response.status).json({
        error: data.message || 'Erreur lors de l\'envoi de l\'email'
      });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('[send-invoice-email] Internal error:', error);
    return res.status(500).json({ error: error.message || 'Erreur interne du serveur' });
  }
}
