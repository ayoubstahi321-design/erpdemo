// Supabase Edge Function para crear usuarios
// Este endpoint permite a los administradores crear nuevos usuarios

import { serve } from 'https://deno.land/std@0.203.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Crear cliente de Supabase con service role key (admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar que el usuario actual sea admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verificar rol de admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['Admin', 'Manager'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Solo los administradores pueden crear usuarios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Obtener datos del nuevo usuario
    const { email, password, name, role, warehouse_id } = await req.json()

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Faltan campos requeridos: email, password, name, role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Validar rol - debe coincidir con UserRole en types.ts
    const validRoles = ['Admin', 'Manager', 'Accountant', 'Sales', 'Warehouse']
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: `Rol inválido. Debe ser uno de: ${validRoles.join(', ')}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Crear usuario en auth.users usando Admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: {
        name: name,
        role: role,
        warehouse_id: warehouse_id || null
      }
    })

    if (createError) {
      console.error('Error al crear usuario:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // El trigger handle_new_user creará automáticamente el perfil
    // Esperar un momento para que el trigger se ejecute
    await new Promise(resolve => setTimeout(resolve, 500))

    // Si se especificó warehouse_id, actualizar el perfil
    if (warehouse_id) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ warehouse_id: warehouse_id })
        .eq('id', newUser.user.id)

      if (updateError) {
        console.error('Error al asignar almacén:', updateError)
      }
    }

    // Obtener el perfil creado
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', newUser.user.id)
      .single()

    if (profileError) {
      console.error('Error al obtener perfil:', profileError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name: userProfile?.name || name,
          role: userProfile?.role || role,
          warehouseId: userProfile?.warehouse_id || warehouse_id || null,
          lastActive: userProfile?.last_active || new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error en create-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
