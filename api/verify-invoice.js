/**
 * Vercel Serverless Function: Public Invoice Verification Page
 *
 * GET /api/verify-invoice?id=SALE_UUID
 *
 * Returns an HTML page showing invoice details and payment status.
 * Customers can scan the QR code on their invoice to see the current state.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).send(errorPage('Lien invalide', 'Aucune référence de facture fournie.'));
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).send(errorPage('Service indisponible', 'Configuration serveur manquante.'));
  }

  try {
    // Fetch sale with items
    const saleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sales?id=eq.${id}&select=*,sale_items(*),payments:payments(*)`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!saleRes.ok) {
      return res.status(404).send(errorPage('Facture introuvable', 'Cette facture n\'existe pas ou a été supprimée.'));
    }

    const sales = await saleRes.json();
    if (!sales || sales.length === 0) {
      return res.status(404).send(errorPage('Facture introuvable', 'Cette facture n\'existe pas ou a été supprimée.'));
    }

    const sale = sales[0];

    // Fetch company settings
    let company = null;
    if (sale.company_id) {
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/company_profiles?id=eq.${sale.company_id}&select=settings`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Accept': 'application/json',
          },
        }
      );
      const companies = await compRes.json();
      if (companies && companies.length > 0) {
        company = companies[0].settings;
      }
    }

    // If no company from profile, try global settings
    if (!company) {
      const settingsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/app_settings?key=eq.company_settings&select=value`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Accept': 'application/json',
          },
        }
      );
      const settings = await settingsRes.json();
      if (settings && settings.length > 0) {
        company = settings[0].value;
      }
    }

    const html = renderInvoicePage(sale, company);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(html);
  } catch (error) {
    console.error('[verify-invoice] Error:', error);
    return res.status(500).send(errorPage('Erreur', 'Impossible de charger la facture.'));
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(amount) {
  return (amount || 0).toFixed(2);
}

function getStatusInfo(status) {
  switch (status) {
    case 'Paid': return { label: 'Payée', color: '#16a34a', bg: '#dcfce7' };
    case 'Partial': return { label: 'Partiellement payée', color: '#d97706', bg: '#fef3c7' };
    case 'Unpaid': return { label: 'Non payée', color: '#dc2626', bg: '#fee2e2' };
    default: return { label: status || 'Inconnu', color: '#64748b', bg: '#f1f5f9' };
  }
}

function renderInvoicePage(sale, company) {
  const docRef = sale.invoice_number || sale.delivery_note_number || sale.id.substring(0, 8).toUpperCase();
  const docType = sale.document_type === 'DELIVERY_NOTE' ? 'Bon de Livraison' : 'Facture';
  const status = getStatusInfo(sale.payment_status);
  const items = sale.sale_items || [];
  const payments = sale.payments || [];
  const remainingBalance = (sale.total_amount || 0) - (sale.amount_paid || 0) - (sale.credited_amount || 0);
  const companyName = company?.name || 'Entreprise';
  const companyICE = company?.ice || '';
  const companyPhone = company?.phone || '';
  const companyAddress = company?.address || '';
  const companyCity = company?.city || '';

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${escapeHtml(item.product_name)}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 14px;">${item.quantity}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 14px;">${formatAmount(item.unit_price)} MAD</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 14px;">${formatAmount(item.total)} MAD</td>
    </tr>
  `).join('');

  const paymentsHTML = payments.length > 0 ? payments.map(p => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${formatDate(p.date)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${p.method || '-'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600; font-size: 13px; color: #16a34a;">${formatAmount(p.amount)} MAD</td>
    </tr>
  `).join('') : `<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 13px;">Aucun paiement enregistré</td></tr>`;

  return `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${docType} ${docRef} - ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; }
    .container { max-width: 640px; margin: 0 auto; padding: 16px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; margin-bottom: 16px; }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); color: white; padding: 24px 20px; text-align: center; }
    .header h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .header .ref { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
    .header .date { font-size: 13px; opacity: 0.8; margin-top: 8px; }
    .status-bar { padding: 16px 20px; text-align: center; }
    .status-badge { display: inline-block; padding: 8px 24px; border-radius: 50px; font-weight: 700; font-size: 15px; }
    .section { padding: 16px 20px; }
    .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
    .total-row { background: #f0f9ff; }
    .total-row td { padding: 14px 20px; font-weight: 700; font-size: 18px; }
    .balance-row td { padding: 14px 20px; font-weight: 800; font-size: 20px; }
    .company-footer { padding: 16px 20px; background: #f8fafc; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .updated { text-align: center; padding: 12px; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>${companyName}</h1>
        <div style="font-size: 13px; opacity: 0.7; margin-bottom: 12px;">${docType}</div>
        <div class="ref">N° ${escapeHtml(docRef)}</div>
        <div class="date">${formatDate(sale.date)} &bull; ${escapeHtml(sale.customer_name)}</div>
      </div>

      <div class="status-bar">
        <div class="status-badge" style="color: ${status.color}; background: ${status.bg};">
          ${status.label}
        </div>
      </div>

      <div class="section">
        <div class="section-title">Articles</div>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th style="text-align: center;">Qté</th>
              <th style="text-align: right;">P.U.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>
      </div>

      ${sale.global_discount_amount > 0 ? `
      <div style="padding: 0 20px;">
        <table>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Remise globale</td>
            <td style="padding: 8px 0; text-align: right; color: #dc2626; font-weight: 600;">-${formatAmount(sale.global_discount_amount)} MAD</td>
          </tr>
        </table>
      </div>` : ''}

      <div style="padding: 0 20px;">
        <table>
          <tr style="border-top: 2px solid #e2e8f0;">
            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">HT</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px;">${formatAmount((sale.total_amount || 0) - (sale.tax_amount || 0))} MAD</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">TVA (${((sale.tax_rate || 0) * 100).toFixed(0)}%)</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px;">${formatAmount(sale.tax_amount)} MAD</td>
          </tr>
        </table>
      </div>

      <div class="total-row">
        <table><tr>
          <td>Total TTC</td>
          <td style="text-align: right; color: #1e3a5f;">${formatAmount(sale.total_amount)} MAD</td>
        </tr></table>
      </div>

      <div class="section">
        <div class="section-title">Historique des paiements</div>
        <table>
          <thead><tr>
            <th>Date</th>
            <th>Mode</th>
            <th style="text-align: right;">Montant</th>
          </tr></thead>
          <tbody>${paymentsHTML}</tbody>
        </table>
      </div>

      <div style="padding: 0 20px 4px;">
        <table>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Total payé</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px; color: #16a34a; font-weight: 600;">${formatAmount(sale.amount_paid)} MAD</td>
          </tr>
          ${sale.credited_amount > 0 ? `
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Avoir / Retours</td>
            <td style="padding: 8px 0; text-align: right; font-size: 13px; color: #7c3aed; font-weight: 600;">${formatAmount(sale.credited_amount)} MAD</td>
          </tr>` : ''}
        </table>
      </div>

      ${remainingBalance > 0 ? `
      <div class="balance-row" style="background: #fef2f2;">
        <table><tr>
          <td style="color: #dc2626;">Reste à payer</td>
          <td style="text-align: right; color: #dc2626;">${formatAmount(remainingBalance)} MAD</td>
        </tr></table>
      </div>` : `
      <div class="balance-row" style="background: #dcfce7;">
        <table><tr>
          <td style="color: #16a34a;">Soldée</td>
          <td style="text-align: right; color: #16a34a;">0.00 MAD</td>
        </tr></table>
      </div>`}

      <div class="company-footer">
        <strong>${escapeHtml(companyName)}</strong><br>
        ${companyAddress ? escapeHtml(companyAddress) + ', ' : ''}${escapeHtml(companyCity)}<br>
        ${companyPhone ? 'Tél: ' + escapeHtml(companyPhone) + '<br>' : ''}
        ${companyICE ? 'ICE: ' + escapeHtml(companyICE) : ''}
      </div>
    </div>

    <div class="updated">
      Mis à jour le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </div>
  </div>
</body>
</html>`;
}

function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;color:#1e293b;text-align:center;padding:20px;}
.box{background:white;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:400px;}
h1{font-size:20px;margin-bottom:8px;}p{color:#64748b;font-size:14px;}</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
