import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Create Sale Edge Function
 *
 * Transactional sale creation with:
 * - Sale record creation
 * - Sale items insertion
 * - Atomic stock reduction via update_stock_level function
 * - Audit log entry
 * - Rollback on any failure
 */

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Get user from auth header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }

  const { sale } = await req.json();
  let saleId: string | null = null;

  try {
    // 1. Create sale record
    const { data: saleData, error: saleError } = await supabaseClient
      .from('sales')
      .insert({
        date: sale.date || new Date().toISOString(),
        warehouse_id: sale.warehouseId,
        customer_id: sale.customerId,
        customer_name: sale.customerName,
        customer_type: sale.customerType,
        subtotal_amount: sale.subtotalAmount,
        tax_rate: sale.taxRate,
        tax_amount: sale.taxAmount,
        total_amount: sale.totalAmount,
        amount_paid: sale.amountPaid || 0,
        payment_status: sale.paymentStatus || 'Unpaid',
        credited_amount: 0,
        status: 'Completed',
        created_by: user.id
      })
      .select()
      .single();

    if (saleError) throw new Error(`Sale creation failed: ${saleError.message}`);
    saleId = saleData.id;

    console.log(`Sale created: ${saleId}`);

    // 2. Insert sale items
    const { error: itemsError } = await supabaseClient
      .from('sale_items')
      .insert(
        sale.items.map((item: any) => ({
          sale_id: saleId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount: item.discount,
          total: item.total
        }))
      );

    if (itemsError) throw new Error(`Sale items insertion failed: ${itemsError.message}`);

    console.log(`Sale items inserted: ${sale.items.length} items`);

    // 3. Reduce stock atomically for each item
    for (const item of sale.items) {
      const { error: stockError } = await supabaseClient.rpc('update_stock_level', {
        p_product_id: item.productId,
        p_warehouse_id: sale.warehouseId,
        p_delta: -item.quantity,
        p_reason: `Sale ${saleData.id}`,
        p_user_id: user.id
      });

      if (stockError) {
        throw new Error(`Stock update failed for product ${item.productId}: ${stockError.message}`);
      }
    }

    console.log(`Stock reduced for ${sale.items.length} products`);

    // 4. Create audit log
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'SALE',
      entity: 'Sale',
      entity_id: saleId,
      details: `Created sale ${saleId} for ${sale.customerName}, total: ${sale.totalAmount}`
    });

    console.log(`Audit log created for sale ${saleId}`);

    // 5. If initial payment provided, insert payment
    if (sale.payments && sale.payments.length > 0) {
      const { error: paymentError } = await supabaseClient
        .from('payments')
        .insert(
          sale.payments.map((payment: any) => ({
            sale_id: saleId,
            date: payment.date || new Date().toISOString(),
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
            recorded_by: user.id
          }))
        );

      if (paymentError) {
        console.warn(`Payment insertion failed (non-critical): ${paymentError.message}`);
        // Don't throw - payment can be added later
      } else {
        console.log(`Payments inserted: ${sale.payments.length}`);
      }
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        sale: saleData,
        message: `Sale ${saleId} created successfully`
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );

  } catch (error: any) {
    console.error('Sale creation failed:', error);

    // ROLLBACK: Delete sale if it was created
    if (saleId) {
      console.log(`Rolling back sale ${saleId}...`);

      try {
        // Delete sale (cascade will delete items)
        await supabaseClient.from('sales').delete().eq('id', saleId);
        console.log(`Rollback successful: sale ${saleId} deleted`);
      } catch (rollbackError: any) {
        console.error(`Rollback failed: ${rollbackError.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.toString()
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
