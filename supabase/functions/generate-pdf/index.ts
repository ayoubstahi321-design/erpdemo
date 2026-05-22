// @ts-ignore - Deno import
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Generate PDF Edge Function
 * 
 * Generates professional PDFs for:
 * - Invoices (FACTURE)
 * - Delivery Notes (BON DE LIVRAISON)
 * - Receipts (TICKET)
 * 
 * Uses Puppeteer for HTML to PDF conversion
 * Generates native PDF documents (not image-based)
 */

serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  try {
    const { html, filename, format = 'A4' } = await req.json();

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'Missing HTML content' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Dynamic import of Puppeteer
    // @ts-ignore - Deno dynamic import
    const puppeteer = await import('https://deno.land/x/puppeteer@16.2.0/mod.ts');

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Set viewport based on format
    let width = 210;
    let height = 297;
    if (format === 'TICKET') {
      width = 80;
      height = 200;
    }

    await page.setViewport({ width, height });

    // Set HTML content
    await page.setContent(html, { waitUntil: 'networkidle2' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: format === 'A4' ? 'A4' : undefined,
      width: format === 'TICKET' ? '80mm' : undefined,
      height: format === 'TICKET' ? undefined : undefined,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
      displayHeaderFooter: false,
      printBackground: true,
    });

    await browser.close();

    // Return PDF as base64
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    return new Response(
      JSON.stringify({
        success: true,
        pdf: base64Pdf,
        filename: filename || `document_${Date.now()}.pdf`,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('PDF Generation Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to generate PDF',
        details: String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
