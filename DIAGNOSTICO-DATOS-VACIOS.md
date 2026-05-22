# 🔍 Diagnóstico: Dashboard y POS no detectan almacenes/productos

## ✅ Cambios realizados

He agregado **debug messages** en el código para identificar el problema:

### 1. **Dashboard.tsx y POS.tsx**

- Cuando no hay datos (`products.length === 0 && warehouses.length === 0`), aparece un **mensaje de alerta rojo** indicando:
  - Número de productos cargados
  - Número de almacenes cargados
  - Instrucción para revisar la consola del navegador

### 2. **useSupabaseData.ts** (hooks mejorados)

- Logging más detallado con códigos de error
- Si hay un error RLS, ahora se captura y registra correctamente
- Sets `warehouses = []` y `products = []` explícitamente en caso de error

## 🔧 Cómo diagnosticar

### Paso 1: Ejecuta el SQL de debug

1. Abre la consola de Supabase
2. Copia y ejecuta el contenido de: [`DEBUG-DATA-LOADING.sql`](DEBUG-DATA-LOADING.sql)
3. Verifica que:
   - ✅ Existen almacenes (Warehouses count > 0)
   - ✅ Existen productos (Products count > 0)
   - ✅ El stock está vinculado (stock_levels tiene registros)

### Paso 2: Revisa el navegador

1. Abre la app web
2. Abre **DevTools** (F12)
3. Ve a la pestaña **Console**
4. Busca mensajes de error que digan:
   - "Error fetching warehouses"
   - "Error fetching products"
   - Cualquier error RLS (row level security)

### Paso 3: Busca el mensaje de alerta

- Si ves un **recuadro rojo** en Dashboard o POS diciendo "No Data Loaded", significa que los datos no llegaron desde Supabase

## 📊 Causas posibles

1. **Supabase sin datos**: Los almacenes/productos nunca se crearon

   - **Solución**: Ejecuta el SQL de migración

2. **Problema RLS (Row Level Security)**:

   - El usuario actual no tiene permisos para leer warehouses/products
   - **Solución**: Ver las políticas en `DEBUG-DATA-LOADING.sql` query 7

3. **Usuario sin autenticar**:

   - El usuario está en modo offline pero las credenciales de Supabase son incorrectas
   - **Solución**: Verifica `.env` tiene `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

4. **Sesión expirada**:
   - El JWT token de Supabase expiró
   - **Solución**: Cierra sesión y vuelve a iniciar

## 🚀 Próximos pasos

1. **Ejecuta el SQL** de debug y cuéntame qué encuentras
2. **Abre la consola** del navegador y cópiame cualquier error que veas
3. Si ves el mensaje de alerta rojo en la app, cuéntame qué números muestra

---

**Ubicación de cambios:**

- Dashboard: [src/components/Dashboard.tsx](src/components/Dashboard.tsx#L393) (línea 393+)
- POS: [src/components/POS.tsx](src/components/POS.tsx#L352) (línea 352+)
- Hooks: [src/hooks/useSupabaseData.ts](src/hooks/useSupabaseData.ts) (múltiples mejoras de logging)
