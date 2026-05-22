// Script de diagnóstico para verificar conexión a Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mkehxermgmdqsogmlaqq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWh4ZXJtZ21kcXNvZ21sYXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTU5NzIsImV4cCI6MjA4MTI3MTk3Mn0.pys0cEJ5KZgZetwaYctAZg3-dTXrqNtqBzL0QXQxeB4';

console.log('🔍 Verificando conexión a Supabase...\n');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey.length, 'caracteres\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Verificar si podemos obtener la sesión
    console.log('📝 Test 1: Verificar auth...');
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.log('❌ Error en sesión:', sessionError.message);
    } else {
      console.log('✅ Auth funciona (sin sesión activa es normal)');
    }

    // Test 2: Intentar consultar la tabla profiles
    console.log('\n📝 Test 2: Consultar tabla profiles...');
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error en consulta:', error.message);
      console.log('   Code:', error.code);
      console.log('   Details:', error.details);
      console.log('   Hint:', error.hint);
    } else {
      console.log('✅ Tabla profiles accesible');
      console.log('   Registros encontrados:', data?.length || 0);
    }

    // Test 3: Verificar conectividad básica
    console.log('\n📝 Test 3: Conectividad básica...');
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      console.log('✅ Servidor responde:', response.status);

      if (response.status === 200) {
        const text = await response.text();
        console.log('   Respuesta:', text.substring(0, 100) + '...');
      }
    } catch (fetchError) {
      console.log('❌ Error de red:', fetchError.message);
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN:');
    console.log('='.repeat(50));

    if (sessionError || error) {
      console.log('\n⚠️  PROBLEMAS DETECTADOS:');
      if (error && error.code === 'PGRST116') {
        console.log('   - La tabla "profiles" no existe en la base de datos');
        console.log('   - Solución: Ejecutar las migraciones SQL');
        console.log('   - Comando: npx supabase db push');
      } else if (error && error.message.includes('Failed to fetch')) {
        console.log('   - No se puede conectar al servidor Supabase');
        console.log('   - Verifica que el proyecto existe en Supabase');
        console.log('   - URL del proyecto:', supabaseUrl);
      } else {
        console.log('   - Error:', error?.message || sessionError?.message);
      }
    } else {
      console.log('\n✅ Supabase está correctamente configurado y conectado');
    }

  } catch (err) {
    console.log('\n❌ Error general:', err.message);
    console.log('\n💡 POSIBLES CAUSAS:');
    console.log('   1. El proyecto Supabase no existe o fue eliminado');
    console.log('   2. Las credenciales son incorrectas');
    console.log('   3. Problemas de red/firewall');
    console.log('\n💡 SOLUCIONES:');
    console.log('   1. Verifica en https://supabase.com que el proyecto existe');
    console.log('   2. Regenera las credenciales desde el dashboard de Supabase');
    console.log('   3. Usa el modo offline (la app funciona sin Supabase)');
  }
}

testConnection();
