# Guía de Implementación de Seguridad

## ✅ PASO 1: Habilitar RLS en TODAS las Tablas (CRÍTICO)

### Estado: Listo para aplicar

### Archivos creados:
- ✅ `supabase/migrations/add-multi-tenant-schema.sql` - Esquema multi-tenant (warehouse_companies, company_id)
- ✅ `supabase/migrations/add-rls-helper-functions.sql` - Funciones auxiliares
- ✅ `supabase/migrations/security-audit-enable-rls-all-tables.sql` - Políticas RLS
- ✅ `supabase/migrations/test-rls-policies.sql` - Script de pruebas
- ✅ `supabase/check_rls.sql` - Verificación de estado RLS

### Cómo aplicar:

#### Opción A: Supabase Dashboard (Recomendado)

1. **Ir a tu proyecto en Supabase Dashboard**
   - https://app.supabase.com/project/TU-PROJECT-ID

2. **Abrir SQL Editor**
   - Click en "SQL Editor" en el menú lateral

3. **Ejecutar las migraciones EN ORDEN (IMPORTANTE!):**

   **Primera migración: Esquema Multi-Tenant**
   ```bash
   # Copia y pega TODO el contenido de:
   supabase/migrations/add-multi-tenant-schema.sql

   # Click en "Run" (Ejecutar)
   # Esto crea warehouse_companies y añade company_id a las tablas
   ```

   **Segunda migración: Funciones Auxiliares**
   ```bash
   # Copia y pega TODO el contenido de:
   supabase/migrations/add-rls-helper-functions.sql

   # Click en "Run" (Ejecutar)
   ```

   **Tercera migración: Políticas RLS**
   ```bash
   # Copia y pega TODO el contenido de:
   supabase/migrations/security-audit-enable-rls-all-tables.sql

   # Click en "Run" (Ejecutar)
   ```

4. **Verificar que RLS está habilitado:**
   ```bash
   # Ejecuta:
   supabase/check_rls.sql

   # Deberías ver:
   # - "Row Level Security ENABLED" para TODAS las tablas
   # - Si alguna dice "DISABLED" → Hay un problema
   ```

#### Opción B: Supabase CLI (Si usas terminal)

```bash
# Desde la raíz del proyecto:
supabase db push

# O manualmente:
psql -h db.YOUR-PROJECT.supabase.co -U postgres -d postgres -f supabase/migrations/add-rls-helper-functions.sql
psql -h db.YOUR-PROJECT.supabase.co -U postgres -d postgres -f supabase/migrations/security-audit-enable-rls-all-tables.sql
```

### Pruebas después de aplicar:

1. **Crear usuarios de prueba con diferentes company_id:**
   - User A: company_id = 'COMP-A', role = 'Sales'
   - User B: company_id = 'COMP-B', role = 'Sales'
   - Admin: company_id = NULL, role = 'Admin'

2. **Ejecutar script de pruebas:**
   ```bash
   # En SQL Editor:
   supabase/migrations/test-rls-policies.sql
   ```

3. **Verificar manualmente:**
   - Login como User A → Solo ves ventas de COMP-A
   - Login como User B → Solo ves ventas de COMP-B
   - Login como Admin → Ves TODAS las ventas
   - Todos ven los mismos productos (compartidos)
   - Todos ven los mismos clientes (compartidos)

### ⚠️ IMPORTANTE - Posibles Problemas:

**Problema 1: "function user_company_id() does not exist"**
- Solución: No ejecutaste `add-rls-helper-functions.sql` primero
- Ejecuta las funciones auxiliares ANTES de las políticas

**Problema 2: "Users can't see any data after migration"**
- Causa: El user_id en `profiles` no coincide con auth.uid()
- Solución: Verifica que profiles.id = auth.users.id para cada usuario

**Problema 3: "Admin can't see all data"**
- Causa: Admin user tiene company_id en vez de NULL
- Solución:
  ```sql
  UPDATE profiles SET company_id = NULL WHERE role = 'Admin';
  ```

**Problema 4: "warehouse_companies table doesn't exist"**
- Causa: No ejecutaste `add-multi-tenant-schema.sql` primero
- Solución: Ejecuta las migraciones EN ORDEN (schema → funciones → RLS)

### Rollback (si algo sale mal):

```sql
-- SOLO SI NECESITAS DESHACER LOS CAMBIOS:

-- Deshabilitar RLS en todas las tablas
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
-- ... (repite para todas las tablas)

-- Eliminar todas las políticas
DROP POLICY IF EXISTS "users_view_own_profile" ON profiles;
DROP POLICY IF EXISTS "users_view_company_sales" ON sales;
-- ... (repite para todas las políticas)
```

---

## 📋 PASO 2: Validación del Lado del Servidor

### Estado: Pendiente

### Qué hacer:

Crear **Supabase Edge Functions** para validar datos ANTES de insertarlos en la base de datos.

### Archivos a crear:

```typescript
// supabase/functions/validate-sale/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { sale, items } = await req.json()

    // VALIDACIONES:

    // 1. Verificar que company_id es válido
    if (!sale.company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id es requerido' }),
        { status: 400 }
      )
    }

    // 2. Verificar que warehouse pertenece a la company
    const { data: warehouseCompany } = await supabase
      .from('warehouse_companies')
      .select('id')
      .eq('warehouse_id', sale.warehouse_id)
      .eq('company_id', sale.company_id)
      .single()

    if (!warehouseCompany) {
      return new Response(
        JSON.stringify({ error: 'Warehouse no pertenece a esta company' }),
        { status: 403 }
      )
    }

    // 3. Verificar stock disponible
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('stockQuantity')
        .eq('id', item.productId)
        .single()

      if (product.stockQuantity < item.quantity) {
        return new Response(
          JSON.stringify({ error: `Stock insuficiente para ${item.productName}` }),
          { status: 400 }
        )
      }
    }

    // Si todo es válido, permitir la venta
    return new Response(JSON.stringify({ valid: true }), { status: 200 })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

**Comando para crear:**
```bash
supabase functions new validate-sale
supabase functions deploy validate-sale
```

**Integrar en POS.tsx:**
```typescript
const handleCompleteSale = async () => {
  // ANTES de crear la venta, validar en servidor
  const { data, error } = await supabase.functions.invoke('validate-sale', {
    body: { sale: saleData, items: items }
  })

  if (error || !data.valid) {
    alert(data.error || 'Error de validación')
    return
  }

  // Proceder con la venta...
}
```

---

## 🔒 PASO 3: Rate Limiting y CORS

### Estado: Pendiente

### Configurar en Supabase Dashboard:

1. **Rate Limiting:**
   - Settings → API → Rate Limiting
   - Configurar límites:
     - Anonymous requests: 100/hour
     - Authenticated requests: 1000/hour

2. **CORS:**
   - Settings → API → CORS
   - Allowed Origins: `https://tu-dominio.com`
   - No permitir `*` (cualquier origen)

3. **Content Security Policy (CSP):**
   ```typescript
   // src/index.html o en tu servidor
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'self';
                  script-src 'self' 'unsafe-inline' https://supabase.co;
                  style-src 'self' 'unsafe-inline';">
   ```

---

## 🔐 PASO 4: Autenticación de Dos Factores (2FA)

### Estado: Pendiente

### Implementar MFA en Supabase:

1. **Habilitar en Dashboard:**
   - Authentication → Settings
   - Enable "Multi-factor authentication (MFA)"

2. **Código en Login.tsx:**
```typescript
// Después del login exitoso
const { data: factors } = await supabase.auth.mfa.listFactors()

if (factors.length === 0) {
  // Mostrar modal: "Configurar 2FA para mayor seguridad"
  const { data: challengeData } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'Authenticator App'
  })

  // Mostrar QR code: challengeData.totp.qr_code
}

// Verificar código 2FA
const { data, error } = await supabase.auth.mfa.challenge({
  factorId: factorId
})

await supabase.auth.mfa.verify({
  factorId: factorId,
  challengeId: data.id,
  code: userEnteredCode
})
```

---

## 📊 PASO 5: Mejorar Audit Logs

### Estado: Pendiente (tabla ya existe)

### Código a agregar:

```typescript
// src/services/auditService.ts
export const logAction = async (
  action: string,
  tableName: string,
  recordId: string,
  details?: any
) => {
  const { data: { user } } = await supabase.auth.getUser()

  await supabase.from('audit_logs').insert({
    user_id: user?.id,
    action: action,  // 'CREATE', 'UPDATE', 'DELETE'
    table_name: tableName,
    record_id: recordId,
    details: details,
    timestamp: new Date().toISOString()
  })
}

// Uso en POS.tsx:
await logAction('CREATE', 'sales', newSale.id, {
  amount: newSale.totalTTC,
  customer: customerName
})
```

---

## 🎯 PRIORIDAD DE IMPLEMENTACIÓN

### ✅ CRÍTICO - Hacer AHORA:
1. **Aplicar RLS** (Paso 1) → Archivos ya listos, solo ejecutar

### ⚠️ IMPORTANTE - Próxima semana:
2. **Validación servidor** (Paso 2)
3. **Rate Limiting** (Paso 3)

### 📌 RECOMENDADO - Próximo mes:
4. **2FA** (Paso 4)
5. **Audit logs mejorados** (Paso 5)

---

## ✅ CHECKLIST DE VERIFICACIÓN

Después de cada paso, verificar:

- [ ] RLS habilitado en todas las tablas
- [ ] Usuarios de Company A no ven datos de Company B
- [ ] Admin puede ver todos los datos
- [ ] Productos y clientes son compartidos
- [ ] Warehouses filtrados por junction table
- [ ] No hay errores en consola del navegador
- [ ] App funciona igual que antes (sin romper features)
- [ ] Validación funciona en servidor
- [ ] Rate limiting activo
- [ ] CORS configurado correctamente
- [ ] 2FA opcional para usuarios
- [ ] Audit logs registran acciones críticas

---

## 🆘 CONTACTO PARA AYUDA

Si encuentras problemas:
1. Revisar errores en Supabase Dashboard → Logs
2. Revisar consola del navegador (F12)
3. Verificar que los IDs de usuarios coinciden entre auth.users y profiles

**Comando útil para debugging:**
```sql
-- Ver usuarios y sus companies
SELECT
  u.id,
  u.email,
  p.company_id,
  p.role
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id;
```
