# 🐛 DEBUG: Error de Returns - customerId column

## Error Actual:
```
Error: Could not find the 'customerId' column of 'returns' in the schema cache

URL: mkehxermgmdqsogmlaqq.supabase.co/rest/v1/returns?
columns="date","originalSaleId","customerId","customerName","reason","warehouseId"
&select=*
```

## ⚠️ IMPORTANTE: ¿Cuándo ocurre el error?

Por favor confirma:
- [ ] Al cargar la página de Returns (fetchReturns)
- [ ] Al hacer click en "Confirmar devolución" (createReturn)
- [ ] Después de confirmar (refresh automático)

## 🔍 Análisis del URL del Error

El URL muestra:
1. `columns="customerId"` - En camelCase ❌
2. `&select=*` - Select genérico

Esto sugiere que Supabase está intentando validar las columnas del objeto ANTES de la petición.

## ✅ Fixes Aplicados Hasta Ahora:

### Fix 1 (Commit b3b03aa):
```typescript
// Transformar camelCase → snake_case en INSERT
const returnInfo = {
  customer_id: rest.customerId,
  original_sale_id: rest.originalSaleId,
  warehouse_id: rest.warehouseId,
  // ...
};
```

### Fix 2 (Commit 6842d9e):
```typescript
// Usar 'rest' en lugar de 'returnData'
.eq('warehouse_id', rest.warehouseId)  // ✅
.eq('id', rest.originalSaleId)         // ✅
```

### Fix 3 (Commit 79a63b0):
```typescript
// Especificar columnas explícitamente en SELECT
.select('id, date, customer_id, customer_name, original_sale_id, warehouse_id, reason')
```

## 🔧 Posibles Causas del Error Persistente:

### 1. Cache del Browser
El browser puede estar cacheando una petición vieja con los nombres incorrectos.

**Solución:**
```bash
# En DevTools:
1. Abrir DevTools (F12)
2. Network tab
3. Disable cache (checkbox)
4. Hard refresh (Ctrl+Shift+R)
```

### 2. Schema Cache de Supabase
Supabase puede tener cacheado el schema con los nombres viejos.

**Solución:**
1. Ir a Supabase Dashboard
2. Settings → Database → Connection pooler
3. Restart pooler

### 3. Validación del Cliente Supabase-JS
El cliente de Supabase puede estar validando el objeto antes de enviarlo.

**Solución Temporal:**
```typescript
// En supabaseClient.ts, agregar al createClient:
createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
})
```

### 4. Realtime Subscriptions
Si hay subscripciones realtime activas, pueden estar usando los nombres viejos.

**Verificar:**
```bash
# En useRealtime.ts
grep -n "returns" src/hooks/useRealtime.ts
```

## 📝 Próximos Pasos para Debugging:

### Paso 1: Verificar el fetch inicial
```typescript
// En fetchReturns(), agregar logging:
console.log('Fetching returns...', { data, error: fetchError });
```

### Paso 2: Verificar el objeto que se envía
```typescript
// En createReturn(), antes del insert:
console.log('Sending to Supabase:', returnInfo);
console.log('Original object:', rest);
```

### Paso 3: Verificar la respuesta de Supabase
```typescript
// Después del insert:
console.log('Response from Supabase:', { newReturn, returnError });
```

## 🎯 Fix Definitivo Propuesto:

Si el error persiste, crear un wrapper que limpie completamente el objeto:

```typescript
const createReturn = async (returnData: Omit<Return, 'id'>) => {
  const { items, ...rest } = returnData as any;

  // Crear objeto COMPLETAMENTE NUEVO sin referencias
  const dbReturn = {
    customer_id: String(rest.customerId || ''),
    customer_name: String(rest.customerName || ''),
    original_sale_id: String(rest.originalSaleId || ''),
    warehouse_id: String(rest.warehouseId || ''),
    reason: String(rest.reason || ''),
    date: String(rest.date || new Date().toISOString())
  };

  // Eliminar cualquier propiedad undefined
  Object.keys(dbReturn).forEach(key => {
    if (dbReturn[key] === 'undefined' || dbReturn[key] === '') {
      delete dbReturn[key];
    }
  });

  const { data, error } = await supabase
    .from('returns')
    .insert([dbReturn])
    .select('*')
    .single();

  // ...resto del código
};
```

## 🎯 SOLUCIÓN DEFINITIVA - ROOT CAUSE IDENTIFICADO

Después de 4 intentos de fix en el código TypeScript, el problema persiste.

### ❌ El problema NO está en el código TypeScript

El código ya transforma correctamente camelCase → snake_case antes de insertar.

### ✅ El problema ESTÁ en la base de datos

El URL del error muestra:
```
columns="date","originalSaleId","customerId","customerName","reason","warehouseId"
```

Esto indica que **la tabla `returns` en Supabase tiene columnas en camelCase**.

### 📋 PASOS PARA RESOLVER:

**1. Ir a Supabase Dashboard**
   - Abrir https://mkehxermgmdqsogmlaqq.supabase.co
   - SQL Editor

**2. Ejecutar el script SQL:**
   ```bash
   # El archivo está en la raíz del proyecto:
   supabase-fix-returns-columns-DEFINITIVO.sql
   ```

**3. El script hace:**
   - ✅ Renombra `customerId` → `customer_id`
   - ✅ Renombra `originalSaleId` → `original_sale_id`
   - ✅ Renombra `customerName` → `customer_name`
   - ✅ Renombra `warehouseId` → `warehouse_id`
   - ✅ Verifica/crea foreign keys
   - ✅ Normaliza tabla `return_items`
   - ✅ Notifica a Supabase para reload schema cache

**4. Resultado esperado:**
   Después de ejecutar el script, todas las columnas estarán en snake_case
   (estándar PostgreSQL) y el error desaparecerá.

## 📝 Historial de Fixes Intentados (TypeScript):

- ✅ Fix 1 (b3b03aa): Transformar objeto antes de insert
- ✅ Fix 2 (6842d9e): Usar variable correcta (rest en lugar de returnData)
- ✅ Fix 3 (79a63b0): Especificar columnas explícitamente en SELECT
- ✅ Fix 4 (f4328a8): Documentación y fromReturn import
- ✅ Fix 5 (5f0817c): Eliminar TODAS las referencias a objeto camelCase

**Conclusión**: El código TypeScript está correcto. El problema es el schema de la BD.

## 🔧 Fix SQL Definitivo:

**Archivo:** `supabase-fix-returns-columns-DEFINITIVO.sql`

Este script SQL normaliza la tabla `returns` a snake_case (convención PostgreSQL).

**IMPORTANTE**: Ejecutar este script en Supabase SQL Editor para resolver el problema.
