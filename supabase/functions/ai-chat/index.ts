import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIContext {
  products?: any[];
  sales?: any[];
  warehouses?: any[];
  customers?: any[];
  transfers?: any[];
  userRole?: string;
}

interface AIChatRequest {
  message: string;
  context: AIContext;
  conversationHistory?: Array<{ role: string; content: string }>;
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Groq API Configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";
const MAX_TOKENS = 1000;

// Rate limiting (simple in-memory - consider Redis for production)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // 2. Rate limiting check
    const userId = user.id;
    const now = Date.now();
    const userLimit = requestCounts.get(userId);

    if (userLimit && userLimit.resetAt > now) {
      if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429
          }
        );
      }
      userLimit.count++;
    } else {
      requestCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    // 3. Get user profile for role-based access
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || 'Sales';

    // 4. Parse request body
    const body: AIChatRequest = await req.json();

    if (!body.message || typeof body.message !== 'string') {
      throw new Error('Invalid message');
    }

    // 5. Filter context based on user role
    const filteredContext = filterContextByRole(body.context, userRole);

    // 6. Build system prompt
    const systemPrompt = buildSystemPrompt(filteredContext, userRole);

    // 7. Build conversation messages
    const messages: GroqMessage[] = [
      { role: "system", content: systemPrompt },
      ...(body.conversationHistory || []).slice(-6), // Keep last 3 exchanges
      { role: "user", content: body.message }
    ];

    // 8. Call Groq API
    const groqApiKey = Deno.env.get('estoqly');
    if (!groqApiKey) {
      throw new Error('Groq API key not configured (secret: estoqly)');
    }

    const groqResponse = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        top_p: 0.9,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      console.error('Groq API Error:', errorText);
      throw new Error(`Groq API error: ${groqResponse.status}`);
    }

    const groqData = await groqResponse.json();
    const aiResponse = groqData.choices?.[0]?.message?.content || 'No response generated';

    // 9. Return response
    return new Response(
      JSON.stringify({
        response: aiResponse,
        usage: groqData.usage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});

// --- HELPER FUNCTIONS ---

function filterContextByRole(context: AIContext, role: string): AIContext {
  const filtered: AIContext = { ...context };

  // Remove cost data for non-admin roles
  if (role !== 'Admin' && role !== 'Manager') {
    if (filtered.products) {
      filtered.products = filtered.products.map(p => {
        const { cost, ...rest } = p;
        return rest;
      });
    }
  }

  // Limit data size to control costs
  if (filtered.products && filtered.products.length > 100) {
    filtered.products = filtered.products.slice(0, 100);
  }
  if (filtered.sales && filtered.sales.length > 50) {
    filtered.sales = filtered.sales.slice(0, 50);
  }

  return filtered;
}

function buildSystemPrompt(context: AIContext, userRole: string): string {
  const contextSummary = `
You are Stoqly AI, an intelligent business analyst for Stoqly ERP system.

User Role: ${userRole}

Current Context:
- Products in inventory: ${context.products?.length || 0}
- Recent sales: ${context.sales?.length || 0}
- Warehouses: ${context.warehouses?.length || 0}
- Customers: ${context.customers?.length || 0}
- Transfers: ${context.transfers?.length || 0}

Your responsibilities:
1. Analyze sales performance and trends
2. Identify low stock items and recommend reorders
3. Suggest optimal warehouse transfers
4. Provide inventory insights
5. Answer business questions conversationally

Guidelines:
- Be concise and professional
- Use data from the context when available
- For Admin/Manager: Include profit margins and cost analysis
- For Sales: Focus on revenue, customers, and sales trends
- For Delivery/Logistics: Focus on stock levels and transfers
- Always respond in the user's language (detect from their message)
- Use bullet points for clarity
- If data is insufficient, acknowledge it

IMPORTANT: Never expose sensitive cost data to Sales, Cashier, or Delivery roles.
`;

  return contextSummary.trim();
}
