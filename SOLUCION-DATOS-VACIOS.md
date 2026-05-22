# 🎯 Solución: Dashboard y POS vacíos

## ¿Qué pasó?

Tu app no muestra almacenes ni productos en Dashboard y POS. Esto significa que **los datos no se están cargando desde Supabase**.

## ✅ He realizado 3 mejoras

### 1. **Debug visual en la app**

Agregué mensajes de **alerta roja** que aparecen cuando no hay datos:

- Aparecerá en Dashboard si `products.length === 0 && warehouses.length === 0`
- Aparecerá en POS con la misma condición
- Te mostrarán exactamente cuántos datos se cargaron

### 2. **Logging mejorado en los hooks**

- **useWarehouses()** ahora registra:
  - ✅ Si la petición fue exitosa
  - ✅ El número de almacenes cargados
  - ❌ Si hay error, el código y mensaje
- **useProducts()** ahora registra:
  - ✅ Si la petición fue exitosa
  - ✅ El número de productos cargados
  - ❌ Si hay error, el código y mensaje

### 3. **Manejo mejorado de errores**

- Si hay un error RLS, **ahora se captura correctamente**
- Los arrays se inicializan como `[]` explícitamente en caso de error

## 🔍 Cómo verificar dónde está el problema

### **PASO 1: Verifica los datos en Supabase**

Entra a tu Supabase y ejecuta este SQL:

```sql
-- Contar almacenes
SELECT COUNT(*) as almacenes FROM warehouses;

-- Contar productos
SELECT COUNT(*) as productos FROM products;

-- Ver los almacenes
SELECT id, name FROM warehouses;

-- Ver los primeros 5 productos
SELECT id, sku, name FROM products LIMIT 5;
```

**¿Qué debería pasar?**

- ✅ Si ves `almacenes: X` (donde X > 0), los datos existen
- ❌ Si ves `almacenes: 0`, NO hay almacenes en la BD - necesitas crearlos

---

### **PASO 2: Abre la app y revisa la consola**

1. Abre tu app web
2. Presiona `F12` para abrir DevTools
3. Ve a la pestaña **Console**
4. Busca los mensajes que dicen:
   - `Fetching warehouses...`
   - `Warehouses response` → aquí verás si hay error
   - `Fetching products...`
   - `Products response` → aquí verás si hay error

**Si ves algo como:**

```
Warehouses response {count: 0, error: undefined}
```

✅ Los datos se cargaron (pero hay 0 almacenes en BD)

```
Warehouses response {count: null, error: "permission denied"}
```

❌ Problema RLS - el usuario no tiene permisos

---

### **PASO 3: Revisa el mensaje de alerta en la app**

Si aparece un **recuadro rojo** en Dashboard/POS, mostrará:

- `Products: 0`
- `Warehouses: 0`

Esto confirma que los hooks no obtuvieron datos.

---

## 🚨 Casos posibles

### **CASO A: Datos = 0 en Supabase**

```
Warehouses: 0
Products: 0
```

**Solución:** Necesitas crear almacenes y productos:

1. Usa el formulario en la app: **Settings → Warehouses** (crear almacén)
2. O ejecuta SQL directamente (ve a `GUIA_IMPORTACION_CSV_ACTUALIZADA.md`)

---

### **CASO B: Datos existen pero no aparecen en la app**

```
Supabase: warehouses count = 5
Consola: Warehouses response {count: 0, error: undefined}
```

**Solución:** Problema de RLS. Ejecuta esto en Supabase:

```sql
-- Simplificar políticas RLS
DROP POLICY IF EXISTS "Authenticated users can view warehouses" ON warehouses;
CREATE POLICY "Allow authenticated access" ON warehouses
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can view products" ON products;
CREATE POLICY "Allow authenticated access" ON products
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authorized users can manage products" ON products;
CREATE POLICY "Allow authenticated manage" ON products
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

Luego recarga la app.

---

### **CASO C: Consola muestra error diferente**

Si ves algo como:

```
Error fetching warehouses: {code: "PGRST..." message: "..."}
```

**Cuéntame exactamente qué dice el error y te ayudaré.**

---

## 📋 Checklist de diagnóstico

- [ ] He ejecutado el SQL en Supabase y vi que hay almacenes/productos
- [ ] He abierto DevTools (F12) y revisado la consola
- [ ] He buscado los mensajes "Fetching warehouses" y "Warehouses response"
- [ ] He visto el mensaje de alerta rojo en la app (si corresponde)
- [ ] He ejecutado las SQL de RLS si el problema era permisos

---

## 📞 Cuéntame qué encontraste

Cuando hayas hecho los pasos, cuéntame:

1. **¿Hay almacenes en Supabase?** (SÍ/NO)
2. **¿Cuántos productos hay?** (número)
3. **¿Qué dice la consola cuando buscas "Warehouses response"?**
4. **¿Aparece el mensaje de alerta roja en la app?** (SÍ/NO)

Con esa info podré identificar exactamente dónde está el problema.

---

**Archivos de referencia:**

- SQL de debug: [DEBUG-DATA-LOADING.sql](DEBUG-DATA-LOADING.sql)
- Cambios en código: [DIAGNOSTICO-DATOS-VACIOS.md](DIAGNOSTICO-DATOS-VACIOS.md)
