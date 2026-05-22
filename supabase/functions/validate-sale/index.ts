import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SaleItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface ValidateSaleRequest {
  customerId: string;
  warehouseId: string;
  items: SaleItem[];
  totalAmount: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Verify authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: ValidateSaleRequest = await req.json();

    // Validate required fields
    if (!body.customerId || !body.warehouseId || !body.items || body.items.length === 0) {
      throw new Error('Missing required fields');
    }

    // Validate items
    for (const item of body.items) {
      if (!item.productId || item.quantity <= 0) {
        throw new Error(`Invalid item: ${item.productId}`);
      }

      if (item.unitPrice < 0) {
        throw new Error('Unit price cannot be negative');
      }

      if (item.discount < 0 || item.discount > 100) {
        throw new Error('Discount must be between 0 and 100');
      }
    }

    // Validate total amount matches calculation
    const calculatedTotal = body.items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice * (1 - item.discount / 100);
      return sum + itemTotal;
    }, 0);

    const tolerance = 0.01; // Allow 1 cent difference for rounding
    if (Math.abs(calculatedTotal - body.totalAmount) > tolerance) {
      throw new Error('Total amount mismatch');
    }

    // Check user has permission to create sales
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const allowedRoles = ['Admin', 'Manager', 'Sales', 'Cashier'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      throw new Error('User does not have permission to create sales');
    }

    return new Response(
      JSON.stringify({
        valid: true,
        message: 'Sale validation passed',
        calculatedTotal
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
