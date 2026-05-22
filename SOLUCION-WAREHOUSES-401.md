# 🚨 SOLUCIÓN URGENTE: Warehouses no aparecen + Error 401 Manifest

## 📋 PROBLEMAS IDENTIFICADOS

### 1. ❌ Warehouses no aparecen en Dashboard ni POS
**Causa**: 
- Perfiles de usuarios no creados → RLS policies bloquean acceso
- O no hay warehouses en la base de datos

### 2. ❌ Error 401 en app.webmanifest
**Causa**: 
- `vercel.json` redirige TODOS los archivos a `index.html` (incluyendo manifest)
- Manifest necesita ser servido directamente sin autenticación

---

## ✅ SOLUCIÓN COMPLETA

### PASO 1: Ejecutar Fix SQL en Supabase (5 min)

1. **Ir a Supabase Dashboard** → SQL Editor
2. **Copiar y ejecutar** el archivo: [`FIX-WAREHOUSES-URGENTE.sql`](./FIX-WAREHOUSES-URGENTE.sql)

Este script hace:
- ✅ Crea perfiles faltantes para usuarios sin perfil
- ✅ Simplifica RLS de warehouses (más permisivo)
- ✅ Inserta 3 warehouses por defecto si la tabla está vacía
- ✅ Verifica que el trigger `on_auth_user_created` existe
- ✅ Muestra diagnóstico completo

**Resultado esperado:**
```
✅ Todos los usuarios tienen perfil
✅ Al menos 3 warehouses en DB
✅ 2 policies: SELECT para todos, ALL para Admin/Manager
```

---

### PASO 2: Ejecutar Trigger de Auto-Crear Perfiles (Prevención)

1. **Ir a Supabase Dashboard** → SQL Editor
2. **Copiar y ejecutar** el archivo: [`FIX-AUTO-CREATE-PROFILES-TRIGGER.sql`](./FIX-AUTO-CREATE-PROFILES-TRIGGER.sql)

Esto garantiza que **futuros usuarios** siempre tengan perfil automáticamente.

---

### PASO 3: Deploy Fix de Vercel (Ya corregido en código)

**Cambio aplicado en `vercel.json`:**

```json
"rewrites": [
  {
    "source": "/((?!app\\.webmanifest|manifest\\.json|favicon\\.svg|icon-.*\\.png|.*\\.(js|css|png|jpg|svg|ico|woff2?|ttf|eot)).*)",
    "destination": "/index.html"
  }
]
```

**¿Qué hace?**
- ❌ ANTES: Redirigía TODO a `/index.html` (causaba 401 en manifest)
- ✅ AHORA: Excluye archivos estáticos del rewrite

**Para aplicar:**
```bash
git add vercel.json
git commit -m "Fix: Allow direct access to static assets (manifest, icons)"
git push origin main
```

Vercel re-desplegará automáticamente.

---

## 🧪 VERIFICACIÓN

### En Supabase (SQL Editor):

```sql
-- Debe retornar al menos 3 warehouses
SELECT COUNT(*) FROM warehouses;

-- Todos los usuarios deben tener perfil
SELECT 
  u.email,
  p.name,
  p.role,
  CASE WHEN p.id IS NULL THEN '❌ SIN PERFIL' ELSE '✅ OK' END
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id;

-- Ver policies activas
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'warehouses';
```

### En el Navegador:

1. **Hacer Hard Refresh**: `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)
2. **Abrir DevTools** (F12) → Console
3. **Verificar logs:**
   ```
   ✅ ⚡ Warehouses loaded from cache: 3  (o más)
   ✅ 🏢 Warehouses API Response: { data: [...], error: null }
   ✅ [✅] Fresh manifest loaded: https://...
   ```
4. **Verificar en Dashboard/POS:**
   - Selector de almacén debe mostrar opciones
   - No debe mostrar "Cargando..." infinito

### Verificar Manifest (Producción):

```bash
# Debe retornar 200 OK (no 401)
curl -I https://azmol-stockerp-azmols-projects.vercel.app/app.webmanifest
```

---

## 🔍 DIAGNÓSTICO ADICIONAL (Si persiste problema)

### Si warehouses siguen sin aparecer:

```bash
# Verificar en consola del navegador
localStorage.getItem('warehouse_cache')  # Debe tener datos
```

**Forzar recarga:**
```javascript
localStorage.removeItem('warehouse_cache');
location.reload();
```

### Si manifest sigue dando 401:

1. Verificar que `public/app.webmanifest` existe
2. Verificar que Vercel deployment finalizó
3. Verificar `vercel.json` en producción:
   ```bash
   # Ver archivo en producción
   curl https://azmol-stockerp-azmols-projects.vercel.app/vercel.json
   ```

---

## 📝 RESUMEN DE CAMBIOS

| Archivo | Cambio | Propósito |
|---------|--------|-----------|
| `FIX-WAREHOUSES-URGENTE.sql` | **Nuevo** | Fix RLS + Crear perfiles + Insertar warehouses |
| `FIX-AUTO-CREATE-PROFILES-TRIGGER.sql` | Existente | Prevenir problema en futuros usuarios |
| `vercel.json` | Modificado | Permitir acceso directo a archivos estáticos |

---

## ⏱️ TIEMPO ESTIMADO

- PASO 1 (SQL): 2 minutos
- PASO 2 (SQL): 1 minuto  
- PASO 3 (Deploy): 3-5 minutos
- **TOTAL**: ~10 minutos

---

## 🎯 RESULTADO FINAL

✅ Dashboard muestra selector de almacén  
✅ POS muestra selector de almacén  
✅ No hay error 401 en consola  
✅ Manifest PWA carga correctamente  
✅ Usuarios futuros tendrán perfil automático  

---

## 📞 SOPORTE

Si después de estos pasos el problema persiste:

1. **Capturar logs de consola** (F12 → Console → Copy all)
2. **Ejecutar en Supabase SQL Editor:**
   ```sql
   -- Diagnóstico completo
   SELECT * FROM profiles;
   SELECT * FROM warehouses;
   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'warehouses';
   ```
3. **Reportar con estos datos**

---

**Última actualización**: 13 enero 2026  
**Autor**: GitHub Copilot  
**Prioridad**: 🚨 URGENTE
