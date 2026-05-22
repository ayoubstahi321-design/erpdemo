import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // SERVICE_ROLE_KEY necesario
const supabase = createClient(supabaseUrl, supabaseKey)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    })
  }

  try {
    const { query, user } = await req.json()

    // Enhanced validation
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: must be a non-empty string')
    }

    if (query.length > 500) {
      throw new Error('Query too long: maximum 500 characters')
    }

    if (!user || !user.id) {
      throw new Error('Invalid request body: missing user or user.id')
    }

    // Validate user.id format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(user.id)) {
      throw new Error('Invalid user.id format')
    }

    // Obtener rol real desde la base de datos
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role_id, roles(name)')
      .eq('user_id', user.id)
      .single()
    
    if (profileError || !profile || !profile.roles) {
      throw new Error('Usuario no encontrado o rol no asignado')
    }

    const actualRole = profile.roles.name

    // Preparar datos según rol
    const roleContext: string = (() => {
      switch(actualRole) {
        case 'Admin': return "USER ROLE: ADMIN. Acceso completo a costos, márgenes y stock.";
        case 'Manager': return "USER ROLE: MANAGER. Enfoque en inventario y ventas.";
        case 'Sales': return "USER ROLE: SALES. Enfoque en clientes y ventas.";
        case 'Delivery': return "USER ROLE: DELIVERY. Enfoque en transferencias y stock.";
        case 'Cashier': return "USER ROLE: CASHIER. Enfoque en productos y precios.";
        default: return "USER ROLE: GENERAL.";
      }
    })()

    // Limitar contexto interno (ejemplo: top 20 productos)
    const contextData = {
      user: { id: user.id, role: actualRole, name: user.name || 'Unknown' },
      inventory: (user.context?.inventory || [])
        .slice(0, 20)
        .map(p => ({
          name: p.name,
          sku: p.sku,
          totalStock: p.totalStock,
          price: (['Admin','Manager','Sales','Cashier'].includes(actualRole)) ? p.price : 'HIDDEN',
          cost: (['Admin','Manager'].includes(actualRole)) ? p.cost : 'HIDDEN',
          status: p.totalStock === 0 ? 'OUT_OF_STOCK' : p.totalStock < (p.minStock || 0) ? 'LOW_STOCK' : 'OK'
        })),
      transfers: user.context?.transfers?.slice(0, 3) || [],
      recentSales: (user.context?.sales || []).slice(0, 5)
    }

    // Obtener API key de Groq
    const groqApiKey = Deno.env.get('GROQ_API_KEY')
    if (!groqApiKey) throw new Error('GROQ_API_KEY no configurado')

    // Prompt del sistema
    const systemPrompt = `
    ${roleContext}
    Fecha actual: ${new Date().toLocaleDateString()}
    
    Datos disponibles para análisis:
    ${JSON.stringify(contextData, null, 2)}

    Instrucciones:
    - Analiza la query del usuario usando solo los datos proporcionados.
    - Responde en bullets, conciso y profesional.
    - Sugiere transferencias o reabastecimientos si hay stock bajo.
    `

    // Llamada a la API de Groq
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3,
        max_tokens: 1024
      })
    })

    if (!groqResponse.ok) throw new Error(`Error Groq API: ${groqResponse.status}`)

    const groqData = await groqResponse.json()
    const response = groqData.choices[0]?.message?.content || "No se generó respuesta."

    return new Response(JSON.stringify({ response }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    })

  } catch (error) {
    console.error('Edge Function Error:', error)
    return new Response(JSON.stringify({
      response: "Ocurrió un error procesando la solicitud. Intenta nuevamente."
    }), { status: 500, headers: { "Content-Type": "application/json" }})
  }
})
