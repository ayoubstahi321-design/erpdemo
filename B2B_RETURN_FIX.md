# 🔧 Solución: Pedidos B2B No Se Actualizan Después de Devolución

## ❌ Problema
Al procesar una devolución de un pedido B2B:
1. ✅ La devolución se crea correctamente en la base de datos
2. ✅ El stock se restaura
3. ✅ El `credited_amount` se actualiza
4. ❌ **El pedido sigue apareciendo en la lista sin cambios**
5. ❌ **Sigue mostrándose como "Pagado" aunque debería reflejar el cambio**
6. ❌ **Factura y Albarán siguen visibles**

## 🔍 Causa Raíz

En `src/components/Sales.tsx`, la función `handleReturnSubmit` (línea 388):
```tsx
await returnsHook.createReturn(newReturn);
// ❌ FALTA: No se refrescaban los datos de ventas
```

**El problema es que:**
1. `createReturn()` actualiza el `credited_amount` y `payment_status` en la tabla `sales`
2. **PERO** los datos de ventas en el componente React NO se refrescan
3. El usuario ve datos **obsoletos** del estado anterior

## ✅ Solución Implementada

### Archivo: `src/components/Sales.tsx`

**Línea 388-396** - Agregué el refresh de datos:

```tsx
try {
  if (returnsHook) {
    // Use Supabase hook to create return
    await returnsHook.createReturn(newReturn);
    // ✅ CRITICAL: Refresh sales data to reflect credited_amount and payment_status changes
    await salesHook.refresh();  // ← NUEVA LÍNEA
  } else {
    // Fallback to props (localStorage mode)
    const returnWithId = { ...newReturn, id: `ret-${Date.now()}` } as Return;
    onNewReturn(returnWithId);
  }
  setShowReturnModal(null);
  setReturnedItems({});
  setReturnReason('');
} catch (error: any) {
  alert(`${t('error')}: ${error.message}`);
}
```

### Por Qué Funciona

El hook `useSales()` retorna una función `refresh` que:
1. Vuelve a traer TODOS los datos de ventas de Supabase
2. Recalcula el estado (`payment_status`) basado en `total_amount`, `amount_paid` y `credited_amount`
3. Actualiza el componente React con los datos nuevos
4. El pedido ahora muestra el estado correcto (Partial, Unpaid, Paid)

## 📊 Flujo Completo Después del Fix

```
Usuario selecciona pedido → Click "Procesar Devolución"
    ↓
Modal de devolución se abre
    ↓
Selecciona items y cantidad
    ↓
Click "Confirmar Devolución"
    ↓
1️⃣ returnsHook.createReturn() → Crea devolución en BD
2️⃣ Restaura stock
3️⃣ Calcula credited_amount
4️⃣ Actualiza payment_status en tabla sales
    ↓
5️⃣ salesHook.refresh() → ✅ NUEVO: Recarga datos de ventas
    ↓
Modal se cierra
    ↓
Pedido desaparece de lista O muestra estado actualizado
✅ Datos correctos en pantalla
```

## 🧪 Verificación

Para verificar que funciona:

1. **Crear un pedido B2B**
   ```
   Pedidos B2B → Nuevo Pedido → Agregar productos → Guardar
   ```

2. **Procesar devolución parcial**
   ```
   Click en pedido → Procesar Devolución → Seleccionar items → Confirmar
   ```

3. **Verificar cambios**
   - ✅ El `credited_amount` debe aparecer reducido
   - ✅ El `payment_status` debe cambiar (Paid → Partial, etc.)
   - ✅ El pedido debe reflejarse correctamente en la lista

## 🔗 Referencias en el Código

- **Hook donde se crea la devolución**: `src/hooks/useSupabaseData.ts` línea 859 (`useReturns`)
- **Hook que maneja ventas**: `src/hooks/useSupabaseData.ts` línea 496 (`useSales`)
- **Componente donde se procesa**: `src/components/Sales.tsx` línea 356 (`handleReturnSubmit`)

## 📝 Cambios Mínimos

- **1 línea agregada** en `src/components/Sales.tsx`
- **Sin cambios en la BD**
- **Sin cambios en tipos o interfaces**
- **Totalmente retrocompatible**

---

**Estado**: ✅ Resuelto - Los pedidos B2B ahora se actualizan correctamente después de procesar devoluciones.
