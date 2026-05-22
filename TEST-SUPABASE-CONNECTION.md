# 🔍 Diagnóstico: Dashboard/POS sin almacenes

## Problema Identificado

Dashboard y POS muestran "No hay almacenes. Verifica la conexión a Supabase o RLS policies."

## Causas Posibles

### 1. ❌ Usuario NO autenticado en Supabase
- RLS policies requieren `auth.uid() IS NOT NULL`
- Si no hay sesión activa → queries retornan vacío
- **Solución**: Login en la app

### 2. ❌ No hay datos en Supabase
- Tablas `warehouses` y `products` vacías
- **Solución**: Insertar datos iniciales

### 3. ❌ RLS policies demasiado restrictivas
- Policies bloquean acceso incluso a usuarios autenticados
- **Solución**: Ajustar policies

## ✅ Pasos de Verificación

### Paso 1: Verificar Autenticación

Abre **Developer Tools** (F12) en tu navegador y ve a la consola. Busca:

```
🔐 Session established for user: xxxxx
```

Si NO ves este mensaje → **No estás autenticado**

### Paso 2: Verificar Datos en Supabase

Ejecuta este SQL en **Supabase SQL Editor**:

```sql
-- 1. ¿Existen almacenes?
SELECT COUNT(*) as total_warehouses FROM warehouses;

-- 2. ¿Existen productos?
SELECT COUNT(*) as total_products FROM products;

-- 3. Listar almacenes
SELECT * FROM warehouses ORDER BY name;

-- 4. Listar primeros 5 productos
SELECT * FROM products ORDER BY name LIMIT 5;
```

Si retorna **0 almacenes/productos** → **No hay datos**

### Paso 3: Verificar RLS Policies

Ejecuta este SQL como **usuario autenticado**:

```sql
-- Test si puedes ver warehouses
SELECT COUNT(*) FROM warehouses;
-- Si falla con "permission denied" → RLS bloqueando

-- Test si puedes ver products
SELECT COUNT(*) FROM products;
-- Si falla con "permission denied" → RLS bloqueando
```

### Paso 4: Verificar Profile del Usuario

```sql
-- ¿Tu usuario tiene perfil en profiles?
SELECT 
  p.id,
  p.name,
  p.role,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.id = auth.uid();
```

Si retorna **0 filas** → **Tu usuario NO tiene perfil en `profiles`**

## 🛠️ Soluciones

### Solución A: Insertar Datos Iniciales

Si no tienes almacenes ni productos, ejecuta:

```sql
-- Insertar almacenes
INSERT INTO warehouses (id, name, location, type) VALUES
  (gen_random_uuid(), 'Tánger', 'Tánger, Morocco', 'Central'),
  (gen_random_uuid(), 'Oujda', 'Oujda, Morocco', 'Branch')
ON CONFLICT (id) DO NOTHING;

-- Insertar productos de ejemplo
INSERT INTO products (id, sku, name, category, cost, price, pack_size, unit, min_stock) VALUES
  (gen_random_uuid(), 'PROD001', 'Producto Test 1', 'General', 100.00, 150.00, 1, 'pcs', 10),
  (gen_random_uuid(), 'PROD002', 'Producto Test 2', 'General', 200.00, 300.00, 1, 'pcs', 5)
ON CONFLICT (id) DO NOTHING;
```

### Solución B: Crear Perfil para Usuario Autenticado

Si tu usuario NO tiene perfil:

```sql
-- Obtener tu user ID
SELECT auth.uid();

-- Crear perfil Admin
INSERT INTO profiles (id, name, role)
VALUES (
  auth.uid(),
  'Administrador',
  'Admin'
)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  role = EXCLUDED.role;
```

### Solución C: Desactivar RLS Temporalmente (SOLO PARA DESARROLLO)

**⚠️ PELIGRO: Esto desactiva seguridad. Solo usar en desarrollo local.**

```sql
-- DESACTIVAR RLS (NO recomendado en producción)
ALTER TABLE warehouses DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels DISABLE ROW LEVEL SECURITY;
```

### Solución D: Hacer Policies más Permisivas

```sql
-- Permitir acceso anónimo (solo desarrollo)
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
CREATE POLICY "Allow all to view warehouses" ON warehouses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
CREATE POLICY "Allow all to view products" ON products
  FOR SELECT USING (true);
```

## 🔑 Variables de Entorno

Verifica que tu `.env` o configuración de Vercel tenga:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Si estas variables están mal → Frontend no puede conectar a Supabase

## 📋 Checklist de Diagnóstico

- [ ] ¿Estás autenticado? (F12 → Console busca "Session established")
- [ ] ¿Existen datos en warehouses? (`SELECT COUNT(*) FROM warehouses`)
- [ ] ¿Existen datos en products? (`SELECT COUNT(*) FROM products`)
- [ ] ¿Tienes perfil en profiles? (`SELECT * FROM profiles WHERE id = auth.uid()`)
- [ ] ¿Puedes ejecutar `SELECT * FROM warehouses` sin errores?
- [ ] ¿Variables de entorno correctas? (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

## 💡 Siguiente Paso

Ejecuta los tests de **Paso 1 a 4** y reporta los resultados para identificar el problema exacto.
