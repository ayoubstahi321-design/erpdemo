/**
 * ============================================
 * EDGE FUNCTION: SEND-NOTIFICATION
 * ============================================
 *
 * Envía notificaciones por email o SMS
 *
 * IMPORTANTE: Para usar esta función necesitas configurar:
 * 1. Un servicio de email (Resend, SendGrid, etc.)
 * 2. Variables de entorno en Supabase:
 *    - RESEND_API_KEY (para email)
 *    - FROM_EMAIL (email del remitente)
 *
 * USO:
 * ```ts
 * const { data, error } = await supabase.functions.invoke('send-notification', {
 *   body: {
 *     type: 'email',
 *     to: 'user@example.com',
 *     subject: 'Alerta de bajo stock',
 *     message: 'El producto X tiene bajo stock'
 *   }
 * });
 * ```
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Tipos de notificaciones soportadas
type NotificationType = 'low_stock' | 'payment_due' | 'payment_received' | 'new_sale' | 'price_change' | 'stock_update' | 'custom';
type Channel = 'email' | 'sms';

interface NotificationRequest {
  type: NotificationType;
  channel: Channel;
  to: string; // Email o número de teléfono
  subject?: string; // Solo para email
  message: string;
  userId?: string; // Usuario que recibe la notificación
  data?: Record<string, any>; // Datos adicionales
}

// Plantillas de email
const emailTemplates: Record<NotificationType, (data: any) => { subject: string; html: string }> = {
  low_stock: (data) => ({
    subject: `⚠️ Alerta: Bajo stock de ${data.productName}`,
    html: `
      <h2>Alerta de Bajo Stock</h2>
      <p>El producto <strong>${data.productName}</strong> tiene bajo stock.</p>
      <ul>
        <li><strong>SKU:</strong> ${data.sku}</li>
        <li><strong>Stock actual:</strong> ${data.currentStock}</li>
        <li><strong>Stock mínimo:</strong> ${data.minStock}</li>
        <li><strong>Almacén:</strong> ${data.warehouseName}</li>
      </ul>
      <p>Es recomendable reabastecer este producto pronto.</p>
    `
  }),

  payment_due: (data) => ({
    subject: `💰 Pago pendiente: Factura ${data.invoiceNumber}`,
    html: `
      <h2>Recordatorio de Pago</h2>
      <p>El cliente <strong>${data.customerName}</strong> tiene un pago pendiente.</p>
      <ul>
        <li><strong>Factura:</strong> ${data.invoiceNumber}</li>
        <li><strong>Monto total:</strong> ${data.totalAmount} DH</li>
        <li><strong>Pagado:</strong> ${data.amountPaid} DH</li>
        <li><strong>Pendiente:</strong> ${data.totalAmount - data.amountPaid} DH</li>
        <li><strong>Fecha de venta:</strong> ${data.saleDate}</li>
      </ul>
    `
  }),

  payment_received: (data) => ({
    subject: `✅ Pago recibido: ${data.amount} DH`,
    html: `
      <h2>Pago Recibido</h2>
      <p>Se ha registrado un nuevo pago.</p>
      <ul>
        <li><strong>Cliente:</strong> ${data.customerName}</li>
        <li><strong>Monto:</strong> ${data.amount} DH</li>
        <li><strong>Método:</strong> ${data.method}</li>
        <li><strong>Factura:</strong> ${data.invoiceNumber}</li>
        ${data.reference ? `<li><strong>Referencia:</strong> ${data.reference}</li>` : ''}
      </ul>
    `
  }),

  new_sale: (data) => ({
    subject: `🛒 Nueva venta: ${data.invoiceNumber}`,
    html: `
      <h2>Nueva Venta Registrada</h2>
      <p>Se ha completado una nueva venta.</p>
      <ul>
        <li><strong>Factura:</strong> ${data.invoiceNumber}</li>
        <li><strong>Cliente:</strong> ${data.customerName}</li>
        <li><strong>Total:</strong> ${data.totalAmount} DH</li>
        <li><strong>Estado de pago:</strong> ${data.paymentStatus}</li>
        <li><strong>Vendedor:</strong> ${data.salesPerson}</li>
      </ul>
    `
  }),

  price_change: (data) => ({
    subject: `💵 Cambio de precio: ${data.productName}`,
    html: `
      <h2>Cambio de Precio</h2>
      <p>Se ha actualizado el precio del producto <strong>${data.productName}</strong>.</p>
      <ul>
        <li><strong>SKU:</strong> ${data.sku}</li>
        <li><strong>Precio anterior:</strong> ${data.oldPrice} DH</li>
        <li><strong>Precio nuevo:</strong> ${data.newPrice} DH</li>
        <li><strong>Variación:</strong> ${data.newPrice > data.oldPrice ? '+' : ''}${((data.newPrice - data.oldPrice) / data.oldPrice * 100).toFixed(2)}%</li>
        <li><strong>Modificado por:</strong> ${data.changedBy}</li>
      </ul>
    `
  }),

  stock_update: (data) => ({
    subject: `📦 Actualización de stock: ${data.productName}`,
    html: `
      <h2>Actualización de Stock</h2>
      <p>Se ha actualizado el stock del producto <strong>${data.productName}</strong>.</p>
      <ul>
        <li><strong>SKU:</strong> ${data.sku}</li>
        <li><strong>Almacén:</strong> ${data.warehouseName}</li>
        <li><strong>Stock anterior:</strong> ${data.oldStock}</li>
        <li><strong>Stock nuevo:</strong> ${data.newStock}</li>
        <li><strong>Cambio:</strong> ${data.newStock > data.oldStock ? '+' : ''}${data.newStock - data.oldStock}</li>
        <li><strong>Razón:</strong> ${data.reason}</li>
      </ul>
    `
  }),

  custom: (data) => ({
    subject: data.subject || 'Notificación de Azmol Stock ERP',
    html: `
      <h2>${data.title || 'Notificación'}</h2>
      <p>${data.message}</p>
      ${data.details ? `<pre>${JSON.stringify(data.details, null, 2)}</pre>` : ''}
    `
  })
};

/**
 * Envía un email usando Resend
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@azmol.ma';

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY no está configurada');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Error enviando email:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error enviando email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Registra la notificación en la base de datos
 */
async function logNotification(
  supabase: any,
  userId: string | null,
  type: NotificationType,
  channel: Channel,
  recipient: string,
  subject: string,
  message: string,
  status: 'sent' | 'failed',
  errorMessage?: string
) {
  try {
    await supabase
      .from('notification_log')
      .insert({
        user_id: userId,
        notification_type: type,
        channel,
        recipient,
        subject,
        message,
        status,
        error_message: errorMessage || null
      });
  } catch (error) {
    console.error('Error registrando notificación:', error);
  }
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
  }

  try {
    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener datos de la petición
    const { type, channel, to, subject, message, userId, data }: NotificationRequest = await req.json();

    // Validar datos
    if (!type || !channel || !to || !message) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    let result: { success: boolean; error?: string } = { success: false };
    let finalSubject = subject;
    let finalMessage = message;

    // Si el tipo tiene una plantilla, usarla
    if (emailTemplates[type] && data) {
      const template = emailTemplates[type](data);
      finalSubject = subject || template.subject;
      finalMessage = template.html || message;
    }

    // Enviar notificación según el canal
    if (channel === 'email') {
      result = await sendEmail(to, finalSubject || 'Notificación', finalMessage);
    } else if (channel === 'sms') {
      // TODO: Implementar envío de SMS (Twilio, etc.)
      result = { success: false, error: 'SMS not implemented yet' };
    }

    // Registrar en la base de datos
    await logNotification(
      supabase,
      userId || null,
      type,
      channel,
      to,
      finalSubject || 'Notificación',
      finalMessage,
      result.success ? 'sent' : 'failed',
      result.error
    );

    // Responder
    return new Response(
      JSON.stringify(result),
      {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );

  } catch (error) {
    console.error('Error en send-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
});
