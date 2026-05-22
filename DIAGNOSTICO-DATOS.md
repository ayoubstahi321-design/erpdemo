# Diagnóstico: No se ven almacenes ni productos

## Problema Reportado
En POS y Dashboard no aparecen almacenes ni productos.

## Posibles Causas

### 1. **Base de datos vacía**
- No hay warehouses creados en Supabase
- No hay productos creados en Supabase

**Verificación**:
```sql
-- Ejecutar en Supabase SQL Editor
SELECT COUNT(*) as total_warehouses FROM warehouses;
SELECT COUNT(*) as total_products FROM products;
```

### 2. **Permisos RLS (Row Level Security)**
- El usuario no tiene permisos para ver los datos
- Las políticas RLS están bloqueando las consultas

**Verificación**:
```sql
-- Ver políticas RLS activas
SELECT * FROM warehouses LIMIT 5;
SELECT * FROM products LIMIT 5;

-- Si no devuelven nada, verificar políticas
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('warehouses', 'products');
```

### 3. **Usuario no asignado a almacén**
- El usuario current no tiene `warehouseId` asignado
- Las consultas filtran por almacén del usuario

**Solución**: 
- Verificar `profiles` table
- Asignar `warehouse_id` al usuario actual

### 4. **Error en frontend (JavaScript)**
- Errores en consola del navegador
- Hooks no cargan datos

**Verificación**:
1. Abrir DevTools (F12)
2. Ir a Console
3. Buscar errores en rojo
4. Verificar Network → Filter "warehouses" y "products"

## Soluciones Rápidas

### Opción A: Crear datos de prueba
```sql
-- 1. Crear almacén
INSERT INTO warehouses (id, name, location, phone, email)
VALUES 
  (gen_random_uuid(), 'Almacén Principal - Casablanca', 'Casa', '+212-123-456', 'casa@azmol.ma');

-- 2. Crear producto
INSERT INTO products (id, sku, name, cost_price, sale_price, category, unit)
VALUES 
  (gen_random_uuid(), 'PROD-001', 'Producto de Prueba', 50.00, 100.00, 'General', 'unidad');
```

### Opción B: Verificar y arreglar RLS

Si las tablas tienen datos pero no se ven:

```sql
-- Desactivar RLS temporalmente para diagnosticar
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- ⚠️ Reactivar después de verificar:
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

### Opción C: Verificar perfil de usuario

```sql
-- Ver perfil del usuario actual
SELECT auth.uid() as my_user_id;

SELECT * FROM profiles WHERE id = auth.uid();

-- Si no existe o falta warehouse_id, actualizar:
UPDATE profiles 
SET warehouse_id = (SELECT id FROM warehouses LIMIT 1)
WHERE id = auth.uid();
```

## Logs de Debug en Consola

Buscar en la consola del navegador:
```
🏢 Warehouses API Response: { data: [...], error: null }
✅ Warehouses loaded: X
```

Si ves `data: []` (array vacío), la base de datos está vacía.
Si ves `error: { ... }`, hay problema con permisos o conexión.

## Checklist de Verificación

- [ ] Verificar datos existen en Supabase (SQL Editor)
- [ ] Verificar políticas RLS no están bloqueando
- [ ] Verificar usuario tiene warehouse_id asignado
- [ ] Verificar consola del navegador por errores
- [ ] Verificar Network tab en DevTools
- [ ] Verificar variables de entorno en Vercel/Local (.env)

## Siguiente Paso

Ejecuta este comando en tu navegador (Console):
```javascript
// Ver estado de warehouses
console.log('Warehouses:', warehouses);
console.log('Products:', products);
```

O ejecuta en Supabase SQL Editor:
```sql
SELECT * FROM warehouses;
SELECT * FROM products LIMIT 10;
```
