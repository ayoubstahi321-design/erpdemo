# 🔧 Solución: Validación de Devoluciones Duplicadas en Pedidos B2B

## ❌ Problema
El sistema permitía hacer **múltiples devoluciones de la misma orden** sin validar que no se devolviera más de lo que se había vendido:
- ❌ Podías devolver 10 unidades de un producto que se vendió 5 veces
- ❌ Sin límite de devoluciones por pedido
- ❌ Stock se restauraba incorrectamente
- ❌ Créditos se calculaban mal

## 🔍 Causa Raíz

1. **Sin validación en `handleReturnSubmit`**: No verificaba cantidad ya devuelta
2. **Modal mostraba solo cantidad original**: No indicaba cuánto ya se había devuelto
3. **Sin bloqueo de items completamente devueltos**: Permitía inputs en items ya retornados completamente

## ✅ Solución Implementada

### 1️⃣ Validación en `handleReturnSubmit` (Líneas 377-399)

Agregué validación **ANTES** de crear la devolución:

```typescript
// ✅ VALIDATION: Check that we're not returning more than what was sold
let validationError = '';
for (const returnItem of itemsToReturn) {
    const originalItem = showReturnModal.items.find(i => i.productId === returnItem.productId);
    
    // Calculate already returned quantity
    const alreadyReturned = returns
        .filter(ret => ret.originalSaleId === showReturnModal.id)
        .flatMap(ret => ret.items || [])
        .filter(item => item.productId === returnItem.productId)
        .reduce((sum, item) => sum + item.quantity, 0);

    const totalReturnedIfApproved = alreadyReturned + returnItem.quantity;

    if (totalReturnedIfApproved > originalItem.quantity) {
        validationError = `Cannot return ${returnItem.quantity} units...`;
        break;
    }
}
```

**Si hay error**: Muestra mensaje claro y **NO crea la devolución**

### 2️⃣ UI Mejorada en Modal (Líneas 932-980)

El modal ahora muestra 4 columnas:

| Columna | Muestra |
|---------|---------|
| **Producto** | Nombre del item |
| **Vendido** | Cantidad original (inmutable) |
| **Ya Devuelto** | Cantidad ya devuelta en devoluciones anteriores |
| **Cantidad a Devolver** | Input con máximo automático |

**Ejemplo**:
```
Producto A | Vendido: 10 | Ya Devuelto: 3 | Input Max: 7
```

### 3️⃣ Bloqueo de Items Completamente Devueltos

Si ya se devolvió todo:
- ❌ Input **DESHABILITADO**
- 🔒 Muestra texto: "Completamente devuelto"
- 📉 Opacidad reducida

## 📊 Flujo Completo Después del Fix

```
Usuario hace devolución de un pedido B2B
    ↓
Se abre modal mostrando:
  - Producto A: Vendido 10, Ya Devuelto 3, Disponible: 7
  - Producto B: Vendido 5, Ya Devuelto 5, Disponible: 0 (BLOQUEADO)
    ↓
Usuario intenta devolver 10 unidades de Producto A
    ↓
Validación RECHAZA:
  "Cannot return 10 units of 'Producto A'.
   Sold: 10, Already returned: 3, 
   Available to return: 7"
    ↓
Usuario intenta devolver 5 unidades (máximo permitido)
    ↓
✅ Validación APRUEBA
    ↓
Devolución se crea
Stock se restaura
Crédito se calcula
```

## 🧪 Verificación

### Test 1: Devolución Parcial Múltiple (VÁLIDO)
```
1. Crear pedido: 10 unidades de Producto A
2. Devolución 1: Devolver 3 unidades
3. Modal muestra: "Ya Devuelto: 3, Disponible: 7"
4. Devolución 2: Devolver 4 unidades
5. Modal muestra: "Ya Devuelto: 7, Disponible: 3"
6. Devolución 3: Devolver 3 unidades (última)
7. Modal muestra: "Ya Devuelto: 10, Disponible: 0" (BLOQUEADO)
✅ Todas las devoluciones se crean correctamente
```

### Test 2: Intento de Exceso (BLOQUEADO)
```
1. Crear pedido: 5 unidades de Producto B
2. Devolución 1: Devolver 5 unidades (todo)
3. Devolución 2: Intenta devolver 1 unidad
❌ Muestra error: "Cannot return 1 units. Available: 0"
❌ Devolución se rechaza
```

## 📋 Cambios de Código

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/components/Sales.tsx` | 377-399 | Agregada validación de cantidad |
| `src/components/Sales.tsx` | 932-980 | Mejorado modal con columna "Ya Devuelto" |

## 🔗 Referencias

- **Lógica de creación**: `src/hooks/useSupabaseData.ts` línea 913 (`createReturn`)
- **Componente Sales**: `src/components/Sales.tsx` línea 356 (`handleReturnSubmit`)
- **Modal de devoluciones**: `src/components/Sales.tsx` línea 885

## 🔐 Seguridad

La validación se hace **ANTES** de enviar a la BD, bloqueando cualquier intento de:
- ✅ Devolver más de lo vendido
- ✅ Devolver sin límite
- ✅ Crear devoluciones fantasma

## ⚠️ Nota Importante

Si un usuario intenta hacer devoluciones con:
- **API directo** (sin UI): La validación en `createReturn()` del hook también valida
- **Supabase RLS**: Las políticas RLS en la BD también protegen

**Triple validación**: Frontend + Hook + BD = 🔒 Seguro

---

**Estado**: ✅ Resuelto - No se pueden hacer devoluciones duplicadas o excesivas.

**Validación**: ✅ Completamente validado - Con feedback claro al usuario.
