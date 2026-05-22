# ⚠️ Solución al Error: "stock_movements does not exist"

## ❌ Problema

Al intentar ejecutar la migración `security-audit-enable-rls-all-tables.sql`, apareció este error:

```
ERROR: 42P01: relation "stock_movements" does not exist
```

## ✅ Solución

He creado una versión **SEGURA** de la migración que verifica qué tablas existen antes de aplicar RLS:

**Usar este archivo:** [security-audit-enable-rls-all-tables-SAFE.sql](supabase/migrations/security-audit-enable-rls-all-tables-SAFE.sql)

## 📝 Qué hace la versión SAFE

### Antes (versión original):
```sql
-- Intenta habilitar RLS en TODAS las tablas
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
-- ❌ FALLA si la tabla no existe
```

### Después (versión SAFE):
```sql
-- Verifica primero si la tabla existe
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements') THEN
    ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
    -- ✅ Solo se ejecuta si la tabla existe
END IF;
```

## 🚀 PASOS CORREGIDOS

### 1. Ejecutar Esquema Multi-Tenant
```bash
# En Supabase SQL Editor:
supabase/migrations/add-multi-tenant-schema.sql
```
✅ Esto crea warehouse_companies y añade company_id

### 2. Ejecutar Funciones Auxiliares
```bash
# En Supabase SQL Editor:
supabase/migrations/add-rls-helper-functions.sql
```
✅ Esto crea las funciones user_is_admin(), user_has_company_access(), etc.

### 3. ⭐ Ejecutar RLS SEGURO (NUEVO)
```bash
# En Supabase SQL Editor:
supabase/migrations/security-audit-enable-rls-all-tables-SAFE.sql
```
✅ Esto habilita RLS solo en las tablas que existen

### 4. Verificar
```bash
# En Supabase SQL Editor:
supabase/check_rls.sql
```
✅ Verificar que todas las tablas tienen RLS habilitado

## 📊 Tablas en tu base de datos

Basándome en el error, parece que tienes:

**Tablas que SÍ existen:**
- ✅ profiles
- ✅ products
- ✅ customers
- ✅ warehouses
- ✅ sales
- ✅ sale_items
- ✅ payments

**Tablas que NO existen (serán omitidas):**
- ❌ stock_movements
- ❓ returns (posiblemente no existe)
- ❓ return_items (posiblemente no existe)
- ❓ transfers (posiblemente no existe)
- ❓ transfer_items (posiblemente no existe)
- ❓ document_counters (posiblemente no existe)
- ❓ audit_logs (posiblemente no existe)
- ❓ error_logs (posiblemente no existe)

La migración SAFE aplicará RLS solo a las tablas que existen y mostrará mensajes como:

```
NOTICE: Enabled RLS on table: profiles
NOTICE: Enabled RLS on table: products
NOTICE: Skipped table (does not exist): stock_movements
```

## 🔍 Verificar qué tablas tienes

Para ver todas tus tablas, ejecuta esto en SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## ⚙️ ¿Necesitas crear las tablas faltantes?

Si necesitas funcionalidad de:
- **Returns (Devoluciones)**: Necesitas crear las tablas returns y return_items
- **Transfers (Transferencias)**: Necesitas crear las tablas transfers y transfer_items
- **Stock tracking**: Necesitas crear stock_movements
- **Document numbering**: Necesitas crear document_counters
- **Audit trail**: Necesitas crear audit_logs
- **Error logging**: Necesitas crear error_logs

Puedo ayudarte a crear estas tablas si las necesitas. Por ahora, la seguridad RLS funcionará perfectamente con las tablas que ya tienes.

## 🎯 Siguiente paso

**Ejecuta la versión SAFE de la migración RLS:**

1. Abre: [security-audit-enable-rls-all-tables-SAFE.sql](supabase/migrations/security-audit-enable-rls-all-tables-SAFE.sql)
2. Copia TODO el contenido
3. Pega en Supabase SQL Editor
4. Click "Run"
5. ✅ Deberías ver mensajes de éxito sin errores

---

**Nota:** La versión original [security-audit-enable-rls-all-tables.sql](supabase/migrations/security-audit-enable-rls-all-tables.sql) sigue disponible, pero solo úsala si tienes TODAS las tablas creadas.
