# Estado de Roles y Permisos - AZMOL ERP

**Fecha de Verificación:** 2026-01-03
**Estado:** ✅ CONFIGURADO CORRECTAMENTE

---

## 🔐 Sistema de Roles Configurado

### Roles Disponibles:

1. **Admin** (Administrador)
   - Acceso total al sistema
   - Puede gestionar usuarios
   - Puede gestionar productos, almacenes, clientes
   - Puede ver y modificar todas las ventas
   - Puede configurar descuentos y promociones

2. **Manager** (Gerente)
   - Similar a Admin
   - Puede gestionar productos y almacenes
   - Puede ver y modificar ventas
   - Puede configurar descuentos

3. **Sales** (Vendedor)
   - Puede crear ventas
   - Puede ver clientes y productos
   - Puede gestionar clientes
   - No puede modificar productos ni precios

4. **Cashier** (Cajero)
   - Puede crear ventas
   - Puede gestionar clientes
   - Puede ver stock
   - No puede modificar productos

5. **Delivery** (Repartidor)
   - Acceso limitado (para entregas)
   - Solo lectura de información básica

---

## 📊 Permisos por Tabla

### 1. **profiles** (Usuarios)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Crear (INSERT): Solo su propio perfil
✅ Actualizar (UPDATE): Solo su propio perfil
❌ Eliminar (DELETE): No permitido (CASCADE desde auth.users)
```

### 2. **warehouses** (Almacenes)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager
❌ Otros roles: Solo lectura
```

### 3. **customers** (Clientes)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager, Sales, Cashier
❌ Delivery: Solo lectura
```

### 4. **products** (Productos)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager
❌ Sales, Cashier, Delivery: Solo lectura
```

### 5. **stock_levels** (Niveles de Stock)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager, Sales, Cashier
❌ Delivery: Solo lectura
```

**Nota:** El stock se gestiona automáticamente mediante triggers al crear ventas o transferencias.

### 6. **sales** (Ventas)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Crear (INSERT): Admin, Manager, Sales, Cashier
✅ Actualizar (UPDATE): Solo Admin, Manager
❌ Eliminar (DELETE): No permitido (integridad de datos)
```

### 7. **sale_items** (Items de Venta)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Crear (INSERT): Admin, Manager, Sales, Cashier
✅ Actualizar (UPDATE): Admin, Manager
❌ Eliminar (DELETE): Solo si la venta no está completada
```

### 8. **payments** (Pagos)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Crear (INSERT): Admin, Manager, Sales, Cashier
✅ Actualizar (UPDATE): Admin, Manager
❌ Eliminar (DELETE): No permitido (auditoría)
```

### 9. **price_history** (Historial de Precios)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Crear (INSERT): Sistema automático (trigger)
❌ Actualizar/Eliminar: No permitido (auditoría)
```

### 10. **volume_discounts** (Descuentos por Volumen)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager
❌ Otros roles: Solo lectura
```

### 11. **customer_discounts** (Descuentos por Cliente)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager
❌ Otros roles: Solo lectura
```

### 12. **promotions** (Promociones)
```
✅ Ver (SELECT): Todos los usuarios autenticados
✅ Gestionar (ALL): Admin, Manager
❌ Otros roles: Solo lectura
```

### 13. **notification_settings** (Configuración de Notificaciones)
```
✅ Gestionar (ALL): Solo su propia configuración
```

### 14. **notification_log** (Registro de Notificaciones)
```
✅ Ver (SELECT): Admin, Manager (todas) + Usuarios (solo las propias)
❌ Crear/Actualizar: Sistema automático
```

---

## 🔒 Seguridad RLS (Row Level Security)

### ✅ Estado Actual:

**Todas las tablas tienen RLS HABILITADO:**

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE volume_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
```

### 🛡️ Políticas Implementadas:

1. **Autenticación Obligatoria:**
   - Todos los accesos requieren `auth.uid() IS NOT NULL`
   - No hay acceso anónimo a ninguna tabla

2. **Control por Rol:**
   - Políticas verifican el rol del usuario en la tabla `profiles`
   - Diferentes permisos según el rol

3. **Datos Propios:**
   - Usuarios pueden gestionar su propio perfil
   - Usuarios pueden ver sus propias notificaciones

4. **Auditoría:**
   - Tablas de auditoría (price_history, notification_log) son solo lectura
   - Se registra automáticamente quién hace cambios

---

## 🔑 Funciones de Seguridad

### 1. **Verificación de Usuario Autenticado**
```sql
auth.uid() IS NOT NULL
```
- Usado en todas las políticas SELECT
- Garantiza que solo usuarios autenticados accedan

### 2. **Verificación de Rol**
```sql
EXISTS (
  SELECT 1 FROM profiles
  WHERE id = auth.uid()
  AND role IN ('Admin', 'Manager')
)
```
- Usado en políticas de gestión (INSERT, UPDATE, DELETE)
- Verifica que el usuario tenga el rol apropiado

### 3. **Funciones SECURITY DEFINER**
```sql
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
- Ejecutan con privilegios elevados
- Permiten operaciones del sistema sin exponer permisos

---

## ✅ Verificación de Configuración

### Tablas con RLS Activo: 14/14 ✅

| Tabla | RLS Habilitado | Políticas | Estado |
|-------|----------------|-----------|--------|
| profiles | ✅ | 3 | ✅ OK |
| warehouses | ✅ | 2 | ✅ OK |
| customers | ✅ | 2 | ✅ OK |
| products | ✅ | 2 | ✅ OK |
| stock_levels | ✅ | 2 | ✅ OK |
| sales | ✅ | 3 | ✅ OK |
| sale_items | ✅ | 3 | ✅ OK |
| payments | ✅ | 3 | ✅ OK |
| price_history | ✅ | 2 | ✅ OK |
| volume_discounts | ✅ | 2 | ✅ OK |
| customer_discounts | ✅ | 2 | ✅ OK |
| promotions | ✅ | 2 | ✅ OK |
| notification_settings | ✅ | 1 | ✅ OK |
| notification_log | ✅ | 2 | ✅ OK |

---

## 📝 Archivos SQL de Configuración

### Archivos Principales:

1. **[supabase-complete-schema.sql](../supabase-complete-schema.sql)**
   - Schema completo de la base de datos
   - Políticas RLS básicas
   - Configuración inicial

2. **[supabase-improvements.sql](../supabase-improvements.sql)**
   - Mejoras y nuevas funcionalidades
   - Sistema de descuentos
   - Historial de precios
   - Notificaciones
   - Políticas RLS avanzadas

### Archivos de Corrección (ya aplicados):

- `fix-profiles-rls.sql` - Corrección de políticas de profiles
- `fix-rls.sql` - Corrección general de RLS
- `supabase-cleanup-rls.sql` - Limpieza de políticas duplicadas

---

## 🚨 Consideraciones de Seguridad

### ✅ Buenas Prácticas Implementadas:

1. **Principio de Menor Privilegio:**
   - Cada rol tiene solo los permisos necesarios
   - No hay accesos administrativos innecesarios

2. **Defensa en Profundidad:**
   - RLS a nivel de base de datos
   - Validación en la aplicación
   - Verificación de roles en políticas

3. **Auditoría:**
   - Registro de cambios de precio
   - Registro de notificaciones
   - Timestamps en todas las tablas

4. **Integridad de Datos:**
   - Foreign keys con CASCADE apropiados
   - Constraints de validación
   - Triggers para operaciones automáticas

### ⚠️ Recomendaciones:

1. **Revisar permisos periódicamente:**
   - Verificar que los roles sigan siendo apropiados
   - Auditar accesos inusuales

2. **Monitorear accesos:**
   - Revisar logs de Supabase Dashboard
   - Vigilar intentos de acceso no autorizado

3. **Backup de configuración:**
   - ✅ Ya implementado con sistema de backup automático
   - Incluye todas las tablas y configuraciones

---

## 🔄 Realtime (Tiempo Real)

### Tablas con Realtime Habilitado:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE sale_items;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
ALTER PUBLICATION supabase_realtime ADD TABLE transfers;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE warehouses;
ALTER PUBLICATION supabase_realtime ADD TABLE price_history;
ALTER PUBLICATION supabase_realtime ADD TABLE volume_discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_discounts;
ALTER PUBLICATION supabase_realtime ADD TABLE promotions;
```

**Nota:** Las actualizaciones en tiempo real respetan las políticas RLS. Los usuarios solo reciben notificaciones de cambios a los que tienen permiso de ver.

---

## 📊 Resumen Final

### ✅ TODO ESTÁ CONFIGURADO CORRECTAMENTE:

- ✅ 5 roles definidos (Admin, Manager, Sales, Cashier, Delivery)
- ✅ 14 tablas con RLS habilitado
- ✅ 31 políticas de seguridad activas
- ✅ Funciones con SECURITY DEFINER para operaciones del sistema
- ✅ Realtime configurado con seguridad RLS
- ✅ Sistema de auditoría implementado
- ✅ Backup automático configurado

### 🎯 Acciones Completadas:

1. ✅ Schema de base de datos creado
2. ✅ RLS habilitado en todas las tablas
3. ✅ Políticas configuradas por rol
4. ✅ Triggers para auditoría automática
5. ✅ Sistema de descuentos con permisos
6. ✅ Backup automático semanal configurado

---

## 📞 Soporte

Si necesitas modificar los permisos de algún rol, edita las políticas en:
1. Supabase Dashboard → SQL Editor
2. Ejecuta `DROP POLICY` y `CREATE POLICY` para actualizar
3. Verifica con: `SELECT * FROM pg_policies WHERE schemaname = 'public';`

**Documentación creada:** 2026-01-03
**Última actualización:** 2026-01-03
