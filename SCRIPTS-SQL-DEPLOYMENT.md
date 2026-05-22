# 📋 Scripts SQL para Deployment en Supabase

Este documento lista todos los scripts SQL que deben ejecutarse en Supabase para que el sistema funcione correctamente.

## ⚠️ ORDEN DE EJECUCIÓN IMPORTANTE

Ejecuta los scripts en el orden indicado. Algunos scripts dependen de otros.

---

## 1️⃣ **migration-warehouse-permissions.sql** ✅ COMPLETADO

**Prioridad:** 🔴 CRÍTICA

**Descripción:** Agrega el campo `warehouse_id` a la tabla `profiles` y crea políticas RLS para permisos por almacén.

**Qué hace:**
- ✅ Agrega columna `warehouse_id` a tabla `profiles`
- ✅ Crea índice `idx_profiles_warehouse` para performance
- ✅ Actualiza políticas RLS en `stock_levels`, `sales`, `transfers`

**Cuándo ejecutar:** ANTES de usar el sistema de permisos por almacén

**Instrucciones:**
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de `migration-warehouse-permissions.sql`
3. Pega y ejecuta
4. Verifica mensaje: "✓ Verificación de Migración"

---

## 2️⃣ **fix-sales-global-discount.sql** ✅ COMPLETADO

**Prioridad:** 🔴 CRÍTICA

**Descripción:** Agrega columnas faltantes a la tabla `sales` para descuentos globales, devoluciones, y numeración de facturas.

**Qué hace:**
- ✅ Agrega `global_discount_type` (TEXT)
- ✅ Agrega `global_discount_value` (NUMERIC)
- ✅ Agrega `global_discount_amount` (NUMERIC)
- ✅ Agrega `credited_amount` (NUMERIC)
- ✅ Agrega `invoice_number` (TEXT)

**Error que soluciona:**
```
error: Could not find the 'global_discount_amount' column of 'sales' in the schema cache
```

**Cuándo ejecutar:** ANTES de crear ventas con descuentos globales o devoluciones

**Instrucciones:**
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de `fix-sales-global-discount.sql`
3. Pega y ejecuta
4. Verifica mensaje: "✓ Columnas de descuento global agregadas"

---

## 3️⃣ **fix-sales-financial-columns.sql** ✅ COMPLETADO

**Prioridad:** 🔴 CRÍTICA

**Descripción:** Agrega columnas financieras faltantes a la tabla `sales` necesarias para el sistema de ventas TTC.

**Qué hace:**
- ✅ Agrega `items_subtotal` (NUMERIC)
- ✅ Agrega `subtotal_amount` (NUMERIC)
- ✅ Agrega `tax_rate` (NUMERIC, default 0.20)
- ✅ Agrega `tax_amount` (NUMERIC)
- ✅ Agrega `total_amount` (NUMERIC)
- ✅ Agrega `amount_paid` (NUMERIC)
- ✅ Agrega `payment_status` (TEXT, default 'Unpaid')

**Error que soluciona:**
```
error: Could not find the 'items_subtotal' column of 'sales' in the schema cache
```

**Cuándo ejecutar:** ANTES de confirmar pedidos o crear ventas

**Instrucciones:**
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de `fix-sales-financial-columns.sql`
3. Pega y ejecuta
4. Verifica mensaje: "✓ Columnas financieras agregadas"
5. Resultado esperado: 23 columnas totales, 7 columnas financieras

---

## 🔍 **diagnostico-columnas-sales.sql** (OPCIONAL)

**Prioridad:** 🟡 OPCIONAL

**Descripción:** Script de diagnóstico para verificar qué columnas existen en la tabla `sales`.

**Cuándo usar:** Si quieres verificar qué columnas faltan antes de ejecutar el fix

**Instrucciones:**
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de `diagnostico-columnas-sales.sql`
3. Ejecuta para ver un reporte de columnas

---

## 📝 **asignar-almacenes-usuarios.sql** (OPCIONAL)

**Prioridad:** 🟢 OPCIONAL

**Descripción:** Script helper para asignar almacenes a usuarios existentes.

**Cuándo usar:** Si prefieres asignar almacenes via SQL en lugar de usar la interfaz de usuario

**Nota:** Es RECOMENDADO usar la interfaz de usuario (página Users) en lugar de este script.

---

## ✅ Checklist de Deployment

### Scripts Críticos (Ejecutar OBLIGATORIAMENTE)
- [x] `migration-warehouse-permissions.sql` ejecutado ✅
- [x] `fix-sales-global-discount.sql` ejecutado ✅
- [x] `fix-sales-financial-columns.sql` ejecutado ✅

### Verificación Post-Ejecución
- [x] Columna `warehouse_id` existe en `profiles` ✅
- [x] Columnas de descuento global existen en `sales` ✅
- [x] Columnas financieras existen en `sales` (23 columnas totales) ✅
- [x] Políticas RLS creadas correctamente ✅
- [x] No hay errores en consola del navegador ✅

### Configuración de Usuarios
- [x] Asignar almacenes a usuarios existentes ✅
  - basma → Almacén Tánger
  - halima → Sucursal Rabat
  - lkhdar → Almacén Central
- [x] Verificar que Admin/Manager tienen `warehouse_id = NULL` ✅

---

## 🚨 Errores Comunes y Soluciones

### Error: "Column warehouse_id does not exist"
**Solución:** Ejecutar `migration-warehouse-permissions.sql`

### Error: "Column global_discount_amount does not exist"
**Solución:** Ejecutar `fix-sales-global-discount.sql`

### Error: "Column items_subtotal does not exist"
**Solución:** Ejecutar `fix-sales-financial-columns.sql`

**Detalles:** Este error ocurre al intentar confirmar pedidos. La tabla `sales` necesita las columnas financieras:
- `items_subtotal`, `subtotal_amount`
- `tax_rate`, `tax_amount`, `total_amount`
- `amount_paid`, `payment_status`

### Error: "Permission denied" al crear ventas
**Solución:** Verificar que el usuario tenga almacén asignado (o sea Admin/Manager)

### Error: "new row violates row-level security policy"
**Solución:** Verificar que las políticas RLS se crearon correctamente con `migration-warehouse-permissions.sql`

---

## 📞 Soporte

Si encuentras errores durante el deployment:

1. Ejecuta los scripts de diagnóstico para identificar el problema
2. Revisa los logs de Supabase en Dashboard → Logs
3. Verifica que ejecutaste los scripts en el orden correcto
4. Consulta la documentación en `SISTEMA-PERMISOS-ALMACEN.md`

---

**Última actualización:** 2026-01-11
**Versión:** 1.0.0
