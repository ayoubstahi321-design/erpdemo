import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ValidateStockRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
  operation: 'sale' | 'transfer' | 'adjustment';
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

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: ValidateStockRequest = await req.json();

    // Validate input
    if (!body.productId || !body.warehouseId || typeof body.quantity !== 'number') {
      throw new Error('Invalid request body');
    }

    if (body.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // For operations that decrease stock, validate availability
    if (['sale', 'transfer'].includes(body.operation)) {
      // Here you would query your products table to check stock levels
      // This is a placeholder - implement according to your schema
      const stockAvailable = true; // Replace with actual query

      if (!stockAvailable) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Insufficient stock',
            message: `Only X units available in warehouse ${body.warehouseId}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ valid: true, message: 'Stock validation passed' }),
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
