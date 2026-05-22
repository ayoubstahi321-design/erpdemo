# 🔧 SOLUCIÓN: Todos los roles pueden ver productos y datos

## Problema
Los usuarios con roles diferentes a Admin/Manager no podían ver productos, almacenes, ventas y otros datos necesarios para su trabajo.

## Causa
Las políticas RLS (Row Level Security) de Supabase estaban muy restrictivas - solo permitían SELECT a ciertos roles específicos.

## Solución Aplicada

He creado el archivo **`FIX-RLS-ALL-ROLES.sql`** que implementa el siguiente modelo de permisos:

### 📊 Modelo de Permisos

| Tabla | Ver (SELECT) | Modificar (INSERT/UPDATE/DELETE) |
|-------|-------------|----------------------------------|
| **warehouses** | ✅ Todos | 🔒 Admin, Manager |
| **products** | ✅ Todos | 🔒 Admin, Manager |
| **stock_levels** | ✅ Todos | 🔒 Admin, Manager, Sales, Cashier, Delivery |
| **customers** | ✅ Todos | 🔒 Admin, Manager, Sales, Cashier |
| **sales** | ✅ Todos | 🔒 Admin, Manager, Sales, Cashier |
| **sale_items** | ✅ Todos | ✅ Todos |
| **payments** | ✅ Todos | 🔒 Admin, Manager, Sales, Cashier |
| **transfers** | ✅ Todos | 🔒 Admin, Manager, Delivery |
| **transfer_items** | ✅ Todos | ✅ Todos |
| **returns** | ✅ Todos | 🔒 Admin, Manager, Sales, Cashier |
| **return_items** | ✅ Todos | ✅ Todos |
| **audit_logs** | ✅ Todos | ➕ INSERT solo |
| **profiles** | ✅ Todos | 🔒 Admin, Manager (+ auto-actualización) |

### 🎯 Permisos por Rol

#### 👑 Admin
- ✅ Ve TODO
- ✅ Modifica TODO

#### 👨‍💼 Manager
- ✅ Ve TODO
- ✅ Modifica TODO excepto usuarios (solo Admin puede crear/eliminar usuarios)

#### 💼 Sales
- ✅ Ve TODO (productos, stock, clientes, ventas, almacenes)
- ✅ Crea/edita: ventas, clientes, pagos
- ✅ Actualiza stock al vender

#### 💰 Cashier
- ✅ Ve TODO (productos, stock, clientes, ventas)
- ✅ Crea/edita: ventas, clientes, pagos (solo en POS)
- ✅ Actualiza stock al vender

#### 🚚 Delivery
- ✅ Ve TODO (productos, stock, almacenes, transferencias)
- ✅ Crea/edita: transferencias
- ✅ Actualiza stock al transferir

## 📝 Pasos para Aplicar la Solución

### Opción 1: Supabase Dashboard (Recomendado)

1. **Abre Supabase Dashboard**
   - Ve a https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Abre SQL Editor**
   - Click en "SQL Editor" en el menú lateral

3. **Ejecuta el script**
   - Copia TODO el contenido de `FIX-RLS-ALL-ROLES.sql`
   - Pégalo en el editor
   - Click en "RUN" o presiona `Ctrl+Enter`

4. **Verifica**
   - Al final del script se ejecuta una query de verificación
   - Deberías ver todas las políticas listadas con sus nombres nuevos

### Opción 2: CLI de Supabase

```bash
# Desde la raíz del proyecto
supabase db execute -f FIX-RLS-ALL-ROLES.sql
```

## ✅ Verificación

Después de ejecutar el script:

1. **Dashboard**: Todos los usuarios deberían ver productos, almacenes, ventas
2. **POS**: Todos los roles deberían ver el catálogo de productos
3. **Sales**: Roles de ventas deberían poder crear ventas
4. **Inventory**: Solo Admin/Manager pueden agregar/editar productos

## 🔍 Debugging

Si un rol específico NO puede ver datos:

1. **Verifica sesión**:
   ```sql
   SELECT auth.uid(), email FROM auth.users WHERE id = auth.uid();
   ```

2. **Verifica perfil**:
   ```sql
   SELECT * FROM profiles WHERE id = auth.uid();
   ```

3. **Verifica políticas**:
   ```sql
   SELECT tablename, policyname, cmd 
   FROM pg_policies 
   WHERE schemaname = 'public' AND tablename = 'products';
   ```

## 🎯 Resultado Esperado

Después de aplicar este script:

✅ **Todos los usuarios autenticados** pueden VER:
- Productos y niveles de stock
- Almacenes
- Clientes
- Ventas y pagos
- Transferencias
- Devoluciones
- Logs de auditoría

🔒 **Solo roles autorizados** pueden MODIFICAR según la tabla de permisos arriba

## 📌 Notas Importantes

1. ✅ Este script es **idempotente** - puedes ejecutarlo múltiples veces sin problemas
2. ✅ Usa `DROP POLICY IF EXISTS` para evitar errores si las políticas ya existen
3. ✅ Separa permisos de SELECT (ver) de INSERT/UPDATE/DELETE (modificar)
4. ✅ Mantiene seguridad: cada rol solo puede modificar lo que necesita
5. ✅ No requiere cambios en el código frontend

## 🚀 Próximos Pasos

Después de aplicar el script:

1. **No necesitas hacer cambios en el código** - el frontend ya está listo
2. **Prueba con diferentes roles** para confirmar que funciona
3. **Reinicia sesiones** si los usuarios ya estaban logueados

---

**Archivo creado**: `FIX-RLS-ALL-ROLES.sql`
**Fecha**: 2026-01-15
