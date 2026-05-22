# 🔍 ANÁLISIS Y MEJORAS - SISTEMA DE ROLES Y PERMISOS

## 📊 ROLES ACTUALES (Estado Actual)

### 1. **Admin** (Administrador)
**Descripción actual**: CEO/Propietario - Acceso total al sistema

**Permisos actuales**:
- ✅ Gestión completa de usuarios (crear, editar, eliminar)
- ✅ Gestión completa de productos y almacenes
- ✅ Acceso a todos los almacenes (sin restricción)
- ✅ Ver y modificar TODAS las ventas, transfers, returns
- ✅ Configurar descuentos y promociones
- ✅ Ver logs de auditoría completos
- ✅ Configuración global del sistema
- ✅ Acceso a costos, márgenes y precios

---

### 2. **Manager** (Gerente)
**Descripción actual**: Gerente de operaciones - Casi acceso total

**Permisos actuales**:
- ✅ Gestión completa de productos y almacenes
- ✅ Acceso a todos los almacenes (sin restricción)
- ✅ Ver y modificar TODAS las ventas, transfers, returns
- ✅ Configurar descuentos
- ✅ Ver logs de auditoría completos
- ✅ Acceso a costos, márgenes y precios
- ❌ NO puede crear/eliminar usuarios (solo Admin)

**Problema detectado**: Casi idéntico a Admin, diferencia poco clara

---

### 3. **Sales** (Vendedor)
**Descripción actual**: Personal de ventas - Enfocado en clientes y ventas

**Permisos actuales**:
- ✅ Ver TODO (productos, stock, clientes, ventas, almacenes)
- ✅ Crear y editar ventas
- ✅ Gestionar clientes (crear, editar)
- ✅ Registrar pagos
- ✅ Actualizar stock al vender
- ✅ Ver productos con precios
- ❌ NO puede modificar productos ni precios
- ❌ NO puede gestionar almacenes
- ❌ NO puede ver costos (solo precios de venta)

**Restricción**: Solo vende desde SU almacén asignado (warehouse_id)

---

### 4. **Cashier** (Cajero)
**Descripción actual**: Cajero de tienda - Solo acceso POS

**Permisos actuales**:
- ✅ Ver TODO (productos, stock, clientes, ventas)
- ✅ Crear ventas (solo en POS)
- ✅ Gestionar clientes básicos
- ✅ Registrar pagos
- ✅ Imprimir facturas/tickets
- ✅ Ver productos con precios
- ❌ NO puede modificar productos ni precios
- ❌ NO puede ver costos
- ❌ NO puede acceder a módulos de gestión (solo POS)

**Restricción**: Solo vende desde SU almacén asignado (warehouse_id)

**Problema detectado**: Muy similar a Sales, diferencia confusa

---

### 5. **Delivery** (Repartidor/Logística)
**Descripción actual**: Personal de entregas y transferencias

**Permisos actuales**:
- ✅ Ver productos (SIN precios ni costos)
- ✅ Ver stock y almacenes
- ✅ Crear y gestionar transferencias entre almacenes
- ✅ Marcar entregas como completadas
- ✅ Actualizar stock al transferir
- ❌ NO puede ver precios ni costos
- ❌ NO puede crear ventas
- ❌ NO puede gestionar clientes
- ❌ NO puede ver información financiera

**Restricción**: Solo transfiere desde/hacia SU almacén asignado (warehouse_id)

---

## ⚠️ PROBLEMAS DETECTADOS

### 1. **Duplicación entre Sales y Cashier**
- Ambos tienen permisos casi idénticos
- La única diferencia es que Cashier "solo POS" pero no hay restricción técnica
- **Solución**: Fusionar o diferenciar claramente

### 2. **Manager y Admin muy similares**
- Manager tiene casi los mismos permisos que Admin
- La única diferencia es crear/eliminar usuarios
- **Problema**: ¿Por qué un Manager no podría crear usuarios?
- **Solución**: Definir mejor las responsabilidades

### 3. **Falta rol de Supervisor/Jefe de Almacén**
- Un almacén grande necesita un responsable con más permisos que Sales
- Debería poder:
  - Gestionar stock de SU almacén
  - Ver reportes de SU almacén
  - Autorizar transferencias
  - NO acceder a otros almacenes

### 4. **Falta rol de Contador/Finanzas**
- Necesita ver TODAS las ventas y reportes financieros
- NO necesita crear ventas ni modificar productos
- Solo lectura de todo + reportes contables

### 5. **Permisos de descuentos no están controlados**
- Actualmente cualquier Sales/Cashier puede aplicar descuentos
- **Riesgo**: Descuentos no autorizados
- **Solución**: Requerir aprobación Manager/Admin para descuentos > X%

### 6. **No hay diferenciación de precios B2B vs B2C**
- Sales podría necesitar acceso a precios mayoristas
- Cashier solo precios retail
- Actualmente no hay distinción

---

## 💡 PROPUESTA DE MEJORA

### OPCIÓN A+: Sistema Optimizado (5 roles) ⭐ RECOMENDADO

#### 1. **Admin** (Administrador/Propietario)
**Quién**: Dueño, CEO, Gerente General
- ✅ Configuración global del sistema
- ✅ Gestión de usuarios (crear, editar, eliminar)
- ✅ Acceso a TODOS los almacenes
- ✅ Ver TODOS los datos (costos, márgenes, ventas)
- ✅ Aprobar descuentos de cualquier monto
- ✅ Backup y auditoría
- ✅ Gestión de productos y precios
- 👥 Usuarios típicos: 1-2 personas

#### 2. **Manager** (Gerente de Tienda/Almacén)
**Quién**: Gerente de cada almacén (Casablanca, Rabat, Tánger)
- ✅ Gestión de productos y precios
- ✅ Ver reportes de TODOS los almacenes
- ✅ Aprobar descuentos ≤ 15%
- ✅ Gestionar transfers entre almacenes
- ✅ Crear usuarios Sales/Warehouse (para su equipo)
- ✅ Ver costos (para control de inventario)
- ❌ NO puede: Configuración global, crear Admin, eliminar usuarios
- 👥 Usuarios típicos: 3-5 personas (1 por almacén principal)

#### 3. **Accountant** (Contador/Contable) 💼 NUEVO
**Quién**: Contador de la empresa, responsable financiero
- ✅ Ver TODAS las facturas y ventas (filtrar por trimestre/año)
- ✅ Ver reportes financieros completos
- ✅ Ver cuentas por cobrar/pagar
- ✅ Exportar datos contables (Excel, PDF)
- ✅ Ver productos con precios y costos (para valoración de inventario)
- ✅ Ver TODOS los almacenes (solo lectura)
- ❌ NO puede: Crear/modificar ventas, productos, clientes, transfers
- ❌ NO puede: Gestionar usuarios
- 👥 Usuarios típicos: 1-2 personas
- 🎯 **Caso de uso**: "Necesito ver todas las facturas del Q3 2025 para la declaración de IVA"

#### 4. **Sales** (Vendedor/Cajero)
**Quién**: Personal de ventas, cajeros de mostrador
- ✅ Crear ventas (POS + módulo ventas B2B)
- ✅ Gestionar clientes
- ✅ Aplicar descuentos ≤ 5%
- ✅ Ver stock de SU almacén asignado
- ✅ Imprimir facturas/tickets
- ✅ Registrar pagos
- ❌ NO puede: Ver costos, modificar precios, acceder a otros almacenes
- 👥 Usuarios típicos: 10-15 personas
- **FUSIONA**: Cashier + Sales (eran casi idénticos)

#### 5. **Warehouse** (Logística/Almacén)
**Quién**: Personal de almacén, repartidores, preparadores de pedidos
- ✅ Ver productos SIN precios ni costos
- ✅ Gestionar transfers de SU almacén
- ✅ Actualizar stock físico (recepción, despacho)
- ✅ Marcar entregas como completadas
- ✅ Preparar pedidos
- ❌ NO puede: Ver información financiera, crear ventas, gestionar clientes
- 👥 Usuarios típicos: 5-8 personas
- **RENOMBRA**: Delivery → Warehouse (nombre más claro)

---

### OPCIÓN B: Sistema Completo (7 roles)

#### 1. **Admin** (Propietario/CEO)
- Acceso total
- Configuración global
- Gestión de usuarios
- Audit logs completos

#### 2. **Manager** (Gerente General)
- Gestión operacional completa
- Crear usuarios (excepto Admin)
- Aprobar descuentos y devoluciones
- Reportes completos

#### 3. **Warehouse Manager** (Jefe de Almacén) **NUEVO**
- Gestionar stock de SU almacén
- Aprobar transfers de SU almacén
- Ver reportes de SU almacén
- Gestionar productos (cantidad, no precio)
- Responsable de inventario físico

#### 4. **Sales** (Vendedor)
- Crear ventas B2B y B2C
- Gestionar clientes
- Aplicar descuentos ≤ 5%
- Ver precios mayoristas
- Trabajar desde CUALQUIER almacén (si Manager lo autoriza)

#### 5. **Cashier** (Cajero)
- Solo POS (ventas rápidas)
- Clientes walk-in
- Aplicar descuentos ≤ 3%
- Solo precios retail
- Solo SU almacén

#### 6. **Accountant** (Contador) **NUEVO**
- Ver TODAS las ventas y reportes financieros
- Exportar datos contables
- Ver cuentas por cobrar
- **NO** crear/modificar ventas
- Solo lectura (excepto exportar)

#### 7. **Warehouse Staff** (Personal de Almacén)
- Ver productos SIN precios
- Recibir mercancía
- Preparar pedidos
- Marcar entregas
- **RENOMBRA**: Delivery

---

## 🎯 RECOMENDACIÓN FINAL

### Para AZMOL British Petrochemicals (USO INTERNO):

**OPCIÓN A+ (Sistema Optimizado - 5 roles)** es la mejor opción porque:

1. **Uso interno de una empresa** (NO es SaaS multi-tenant)
   - 5 roles es el equilibrio perfecto: ni m+ - RECOMENDADO)

| Funcionalidad | Admin | Manager | Accountant | Sales | Warehouse |
|--------------|-------|---------|------------|-------|-----------|
| **PRODUCTOS** |
| Ver productos | ✅ | ✅ | ✅ | ✅ | ✅ (sin precio) |
| Ver precios | ✅ | ✅ | ✅ | ✅ | ❌ |
| Ver costos | ✅ | ✅ | ✅ | ❌ | ❌ |
| Crear/editar | ✅ | ✅ | ❌ | ❌ | ❌ |
| **ALMACENES** |
| Ver todos | ✅ Todos | ✅ Todos | ✅ Todos | Solo asignado | Solo asignado |
| Gestionar | ✅ | ✅ | ❌ | ❌ | ❌ |
| **STOCK** |
| Ver stock | ✅ Todos | ✅ Todos | ✅ Todos | Solo asignado | Solo asignado |
| Ajustar stock | ✅ | ✅ | ❌ | ❌ | ✅ Su almacén |
| **VENTAS** |
| Crear ventas | ✅ | ✅ | ❌ | ✅ | ❌ |
| Ver ventas | ✅ Todas | ✅ Todas | ✅ Todas | Solo propias | ❌ |
| Editar ventas | ✅ | ✅ | ❌ | ✅ Propias | ❌ |
| Descuentos | ✅ Sin límite | ≤ 15% | ❌ | ≤ 5% | ❌ |
| **FACTURAS** |
| Ver facturas | ✅ Todas | ✅ Todas | ✅ Todas | Solo propias | ❌ |
| Filtrar trimestre | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exportar | ✅ | ✅ | ✅ | ❌ | ❌ |
| **CLIENTES** |
| Ver clientes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Gestionar | ✅ | ✅ | ❌ | ✅ | ❌ |
| **TRANSFERENCIAS** |
| Crear | ✅ | ✅ | ❌ | ❌ | ✅ Su almacén |
| Aprobar | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver | ✅ Todas | ✅ Todas | ✅ Todas | ❌ | ✅ Su almacén |
| **REPORTES** |
| Financieros | ✅ | ✅ | ✅ | ❌ | ❌ |
| Stock | ✅ | ✅ | ✅ | ❌ | ✅ Su almacén |
| Ventas | ✅ | ✅ | ✅ | ✅ Propias | ❌ |
| **USUARIOS** |
| Ver | ✅ | ✅ | ❌ | ❌ | ❌ |
| Crear | ✅ Todos | ✅ Sales/Warehouse | ❌ | ❌ | ❌ |
| Asignar almacén | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CONFIGURACIÓN** |
| Sistema | ✅ | ❌ | ❌ | ❌ | ❌ |
| Precios | ✅ | ✅ | ❌ | ❌ | ❌ |
| Compañía | ✅ | ❌| ✅ | ❌ | ❌ |
| Ver | ✅ Todas | ✅ Todas | ❌ | ✅ Su almacén |
| **REPORTES** |
| Financieros | ✅ | ✅ | ❌ | ❌ |
| Stock | ✅ | ✅ | ❌ | ✅ Su almacén |
| Ventas | ✅ | ✅ | ✅ Propias | ❌ |
| **USUARIOS** |
| Ver | ✅ | ✅ | ❌ | ❌ |
| Crear | ✅ Todos | ✅ Sales/Warehouse | ❌ | ❌ |
| Asignar almacén | ✅ | ✅ | ❌ | ❌ |
| **CONFIGURACIÓN** |
| Sistema | ✅ | ❌ | ❌ | ❌ |
| Precios | ✅ | ✅ | ❌ | ❌ |
| Compañía | ✅ | ❌ | ❌ | ❌ |

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### Fase 1: Preparación (1 día)
1. ✅ Analizar roles actuales (HECHO)
2. ⏳ Decidir entre Opción A o B
3. ⏳ Documentar matriz de permisos final
4. ⏳ Actualizar copilot-instructions.md

### Fase 2: Base de Datos (1 hora)
1. ⏳ Actualizar constraint en tabla `profiles`:
   ```sql
   ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
   ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
     CHECK (role IN ('Admin', 'Manager', 'Accountant', 'Sales', 'Warehouse'));
   ```

2. ⏳ Renombrar rol 'Delivery' → 'Warehouse':
   ```sql
   UPDATE profiles SET role = 'Warehouse' WHERE role = 'Delivery';
   ```

3. ⏳ Fusionar 'Cashier' → 'Sales':
   ```sql
   UPDATE profiles SET role = 'Sales' WHERE role = 'Cashier';
   ```

4. ⏳ Agregar campo `discount_limit` a profiles:
   ```sql
   ALTER TABLE profiles ADD COLUMN discount_limit NUMERIC(5,2) DEFAULT 5.00;
   UPDATE profiles SET discount_limit = 100.00 WHERE role = 'Admin';
   UPDATE profiles SET discount_limit = 15.00 WHERE role = 'Manager';
   UPDATE profiles SET discount_limit = 0.00 WHERE role = 'Accountant';
   UPDATE profiles SET discount_limit = 5.00 WHERE role = 'Sales';
   UPDATE profiles SET discount_limit = 0.00 WHERE role = 'Warehouse';
   ```

5. ⏳ Actualizar políticas RLS para Accountant (solo lectura)

### Fase 3: Frontend (2 horas)
1. ⏳ Actualizar `src/types.ts`:
   ```typescript
   export type UserRole = 'Admin' | 'Manager' | 'Accountant' | 'Sales' | 'Warehouse';
   
   export interface User {
     // ... campos existentes
     discountLimit?: number; // NUEVO
   }
   ```

2. ⏳ Actualizar componente UserManagement:
   - Remover 'Cashier' y 'Delivery'
   - Agregar 'Accountant' y 'Warehouse'

3. ⏳ Validación de descuentos en POS/Sales

4. ⏳ Actualizar traducciones (i18n.tsx)

5. ⏳ Filtro trimestral para Accountant

### Fase 4: Testing (1 hora)
1. ⏳ Crear usuarios de prueba para cada rol (Admin, Manager, Sales, Warehouse)
2. ⏳ Verificar permisos de cada rol
3. ⏳ Probar límites de descuentos (intentar exceder límite)
4. ⏳ Verificar acceso a almacenes según role

### Fase 5: Documentación (30 min)
1. ⏳ Actualizar MANUAL-USUARIO.md con nuevos roles
2. ⏳ Actualizar copilot-instructions.md
3. ⏳ Comunicar cambios 
   -- Mantener Admin/Manager como están
   -- Convertir algunos Sales → WarehouseManager (según almacén)
   -- Convertir algunos Sales → Cashier (según función)
   -- Delivery → WarehouseStaff
   ```

2. ⏳ Documentar cambios para usuarios finales

---

## 📝 NOTAS ADICIONALES

### Consideraciones de Seguridad
- Todos los cambios deben pasar por RLS
- Auditar cambios de roles en audit_logs
- Requerir re-autenticación para cambios críticos

### Consideraciones de UX
- Mostrar claramente el rol actual del usuario en header
- Deshabilitar botones/funciones no permitidas (no solo ocultar)
- Mensajes claros cuando un usuario intenta acción no permitida

### Consideraciones de Performance
- Caché de permisos por sesión (no consultar BD cada vez)
- Índices en columnas role y warehouse_id
- Políticas RLS optimizadas (evitar subqueries innecesarias)

---

## ❓ DECISIONES PENDIENTES
✅ ¿Opción A (4 roles) o B (7 roles)?**
   - **DECIDIDO: Opción A** - 4 roles es suficiente para uso interno
   
2. **✅ ¿Límites de descuentos fijos o configurables?**
   - **DECIDIDO: Campo en DB** - `discount_limit` configurable por usuario
   
3. **✅ ¿Fusionar Sales y Cashier?**
   - **DECIDIDO: SÍ** - eran casi idénticos, ahora solo "Sales"
   
4. **✅ ¿Renombrar Delivery?**
   - **DECIDIDO: SÍ** - ahora es "Warehouse" (más claro)
   
5. **⏳ ¿Manager puede crear usuarios Admin?**
   - **Recomendación: NO** - solo Admin puede crear otros Admin
   - Recomendación: SÍ (necesario para contabilidad)

---

**Creado**: {{ current_date }}  
**Autor**: GitHub Copilot  
**Estado**: 🟡 Pendiente aprobación
