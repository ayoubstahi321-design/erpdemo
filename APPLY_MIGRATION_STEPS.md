# 🚀 Ejecutar Migration en Supabase

## Paso a Paso

### 1. Abre Supabase Dashboard
```
https://supabase.com/dashboard
```

### 2. Selecciona tu proyecto
- Nombre: `azmol-stockerp` (o similar)

### 3. Click en "SQL Editor" (lado izquierdo)
```
Dashboard → SQL Editor
```

### 4. Click en "+ New Query"
```
Botón azul en la parte superior derecha
```

### 5. Copia TODO el contenido del archivo:
```
supabase-migration-returns-enhancements.sql
```

**Ubicación en repo:**
```
/supabase-migration-returns-enhancements.sql
```

**Content:**
- Comienza con: `-- ========================================`
- Termina con: `-- SELECT * FROM pg_policies WHERE tablename = 'returns';`

### 6. Pega en el SQL Editor
```
Ctrl+A → Ctrl+V (o Command+V en Mac)
```

### 7. Click en "Run" (botón azul)
```
Esquina superior derecha del editor SQL
```

### 8. Espera a que termine
- Verde ✅ = Éxito
- Rojo ❌ = Error (déjame saber qué dice)

---

## ¿Qué hace la migration?

✅ Agrega columna `deleted_at` a returns
✅ Agrega columna `deleted_at` a return_items  
✅ Crea trigger de validación de cantidad
✅ Crea RLS policies para admin-only delete
✅ Crea índices para performance
✅ Crea view para auditoría
✅ Crea trigger para logging automático

---

## Después de ejecutar

El app automáticamente:
- ✅ Podrá usar soft-delete (ya está en código)
- ✅ Los PATCH requests funcionarán
- ✅ El botón "Delete" funcionará correctamente
- ✅ Todo estará listo para producción

---

## Si hay error

Dime exactamente qué dice el error y lo arreglamos.

Common errors:
- `column "deleted_at" already exists` → Ya existe (ignorar, es safe)
- `syntax error` → Copiar/pegar issue (retry)
- `permission denied` → Role issues (decime)

---

**¿Ya lo hiciste? Avísame cuando termine y verificamos que todo funciona.** ✅
