# ✅ SISTEMA DE PERMISOS POR ALMACÉN - IMPLEMENTACIÓN COMPLETA

## 📋 Resumen

Se ha implementado un sistema completo de permisos por almacén donde:
- **Cada trabajador** solo puede vender desde su almacén asignado
- **Admins y Managers** tienen acceso a todos los almacenes
- **Interfaz de gestión** para asignar almacenes a usuarios
- **Bloqueo automático** del POS para usuarios sin almacén

---

## 🔧 ARCHIVOS MODIFICADOS

### 1. **migration-warehouse-permissions.sql** (NUEVO)
Script SQL para agregar campo `warehouse_id` a tabla `profiles` y actualizar políticas RLS.

**Cambios principales:**
- `ALTER TABLE profiles ADD COLUMN warehouse_id UUID`
- Índice para performance: `idx_profiles_warehouse`
- Políticas RLS para `stock_levels`, `sales`, `transfers`

**Instrucciones:**
1. Abre Supabase Dashboard → SQL Editor
2. Copia y pega el script completo
3. Ejecuta (Run)
4. Verifica los resultados

---

### 2. **src/types.ts**
**Línea 25:** Agregado campo `warehouseId` a interface `User`

```typescript
export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  warehouseId?: string | null; // NUEVO
  lastActive?: string;
}
```

---

### 3. **src/types/supabase.ts**

**Línea 44:** Agregado `warehouse_id` a `DbProfile`
```typescript
export interface DbProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  warehouse_id?: string | null; // NUEVO
  created_at: string;
  updated_at: string;
  last_active?: string;
}
```

**Líneas 238-246:** Actualizado `toUser()` para incluir `warehouseId`
**Líneas 249-257:** Actualizado `fromUser()` para incluir `warehouse_id`

---

### 4. **src/App.tsx**

#### Modificación 1: Login actualizado (líneas 246-289)
- **Antes:** Rol hardcodeado a 'Admin', no consultaba BD
- **Ahora:** Consulta real a tabla `profiles`, carga rol y `warehouse_id`

```typescript
const handleLogin = async (user: any) => {
  // Consultar perfil real desde la base de datos
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userProfile: User = {
    id: profileData.id,
    name: profileData.name || ...,
    role: profileData.role || 'Sales', // ROL REAL de BD
    email: profileData.email || user.email,
    warehouseId: profileData.warehouse_id || null, // NUEVO
    lastActive: new Date().toISOString()
  };

  // Validar almacén asignado
  if (userProfile.role !== 'Admin' && userProfile.role !== 'Manager' && !userProfile.warehouseId) {
    showNotification('Advertencia: No tienes almacén asignado...', 'info');
  }
}
```

#### Modificación 2: Modo offline (línea 94)
```typescript
const offlineUser: User = {
  id: 'offline-admin',
  name: 'Administrator',
  role: 'Admin',
  email: 'admin@local',
  warehouseId: null, // NUEVO
  lastActive: new Date().toISOString()
};
```

#### Modificación 3: Pasar warehouses a UsersComp (línea 432)
```typescript
case 'users': return <UsersComp
  currentUser={currentUser}
  users={users}
  warehouses={warehouses}  // NUEVO
  onAddUser={handleAddUser}
  onUpdateUser={handleUpdateUser}
  onDeleteUser={handleDeleteUser}
/>;
```

---

### 5. **src/hooks/useSupabaseData.ts**

#### Modificación 1: fetchUsers (línea 952)
```typescript
const usersData: User[] = (data || []).map(profile => ({
  id: profile.id,
  name: profile.name,
  role: profile.role,
  email: profile.email || '',
  warehouseId: profile.warehouse_id || null, // NUEVO
  lastActive: profile.last_active || new Date().toISOString()
}));
```

#### Modificación 2: addUser (línea 987)
```typescript
const { data, error } = await supabase.functions.invoke('create-user', {
  body: {
    email: user.email,
    password: user.password,
    name: user.name,
    role: user.role,
    warehouse_id: user.warehouseId || null // NUEVO
  }
});
```

#### Modificación 3: updateUser (líneas 1004, 1040)
```typescript
// Permitir actualizar warehouse_id
if (updates.warehouseId !== undefined) profileUpdates.warehouse_id = updates.warehouseId;

// Incluir en el retorno
const updatedUser: User = {
  id: data.id,
  name: data.name,
  role: data.role,
  email: data.email || '',
  warehouseId: data.warehouse_id || null, // NUEVO
  lastActive: data.last_active
};
```

---

### 6. **src/components/POS.tsx**

#### Modificación 1: Auto-selección de almacén (líneas 27-42)
```typescript
// Almacén según permisos del usuario
const [selectedWarehouseId, setSelectedWarehouseId] = useState(() => {
  if (currentUser.warehouseId) return currentUser.warehouseId;
  return warehouses[0]?.id || '';
});

// Auto-select warehouse cuando warehouses carga
useEffect(() => {
  if (warehouses.length > 0 && !selectedWarehouseId) {
    const defaultWarehouse = currentUser.warehouseId || warehouses[0].id;
    setSelectedWarehouseId(defaultWarehouse);
  }
}, [warehouses, selectedWarehouseId, currentUser.warehouseId]);
```

#### Modificación 2: Bloqueo si no tiene almacén (líneas 320-338)
```typescript
// BLOQUEO SI USUARIO SIN ALMACÉN
if (currentUser.role !== 'Admin' && currentUser.role !== 'Manager' && !currentUser.warehouseId) {
  return (
    <div className="...">
      <h2>Sin Almacén Asignado</h2>
      <p>No tienes un almacén asignado para realizar ventas.</p>
      <p>Por favor contacta al administrador...</p>
    </div>
  );
}
```

#### Modificación 3: Selector de almacén condicional (líneas 374-394)
```typescript
{/* Selector de almacén - Solo visible para Admin/Manager */}
{(currentUser.role === 'Admin' || currentUser.role === 'Manager') && (
  <select
    value={selectedWarehouseId}
    onChange={(e) => {
      handleClearCart();
      setSelectedWarehouseId(e.target.value);
    }}
  >
    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
  </select>
)}

{/* Badge de almacén fijo para usuarios no-admin */}
{currentUser.role !== 'Admin' && currentUser.role !== 'Manager' && (
  <div className="...">
    <Store className="..." />
    {warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Sin almacén'}
  </div>
)}
```

---

### 7. **src/components/Users.tsx**

#### Modificación 1: Imports y props (líneas 2-6, 12)
```typescript
import React, { useState, useEffect } from 'react';
import { User, Warehouse } from '../types';
import { ..., Building2 } from 'lucide-react';
import { useUsers, useWarehouses } from '../hooks/useSupabaseData';

interface UsersProps {
  users?: User[];
  warehouses?: Warehouse[]; // NUEVO
  currentUser: User;
  ...
}
```

#### Modificación 2: Hooks y formData (líneas 24, 34, 39, 45-49)
```typescript
const warehousesHook = useWarehouses(); // NUEVO

const [formData, setFormData] = useState<Partial<User> & { password?: string }>({
  role: 'Sales',
  name: '',
  email: '',
  password: '',
  warehouseId: null // NUEVO
});

const warehouses = FEATURE_FLAGS.USE_SUPABASE_USERS ? warehousesHook.warehouses : (props.warehouses ?? []);

// Auto-limpiar warehouse cuando se selecciona Admin/Manager
useEffect(() => {
  if (formData.role === 'Admin' || formData.role === 'Manager') {
    setFormData(prev => ({ ...prev, warehouseId: null }));
  }
}, [formData.role]);
```

#### Modificación 3: Nueva columna en tabla (línea 230, 267-280)
```typescript
{/* Header */}
<th>Almacén</th>

{/* Celdas */}
<td className="px-6 py-4">
  {user.warehouseId ? (
    <div className="flex items-center text-sm text-slate-600">
      <Store className="w-4 h-4 mr-2 text-emerald-500" />
      {warehouses.find(w => w.id === user.warehouseId)?.name || 'Desconocido'}
    </div>
  ) : (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700">
      <Building2 className="w-3 h-3 mr-1" />
      Todos los almacenes
    </span>
  )}
</td>
```

#### Modificación 4: Selector de almacén en formulario (líneas 451-479)
```typescript
{/* Selector de almacén */}
<div>
  <label>Almacén Asignado</label>
  <div className="text-xs text-slate-500 mb-2">
    {formData.role === 'Admin' || formData.role === 'Manager'
      ? 'Los administradores tienen acceso a todos los almacenes'
      : 'Selecciona el almacén donde este usuario trabajará'}
  </div>

  {formData.role !== 'Admin' && formData.role !== 'Manager' ? (
    <select
      value={formData.warehouseId || ''}
      onChange={(e) => setFormData({...formData, warehouseId: e.target.value || null})}
    >
      <option value="">-- Sin almacén --</option>
      {warehouses.map(w => (
        <option key={w.id} value={w.id}>{w.name}</option>
      ))}
    </select>
  ) : (
    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg...">
      <Building2 className="w-4 h-4 mr-2" />
      Acceso a todos los almacenes (Admin/Manager)
    </div>
  )}
</div>
```

---

### 8. **src/components/Accounting.tsx**

#### Modificación 1: Props y imports (líneas 1-18)
```typescript
import { useMemo, useState } from 'react';
import { Sale, Customer, Warehouse, CompanySettings, User } from '../types';
import { Store } from 'lucide-react';

interface AccountingProps {
  sales: Sale[];
  customers: Customer[];
  warehouses: Warehouse[];
  companySettings: CompanySettings;
  currentUser: User; // NUEVO
}
```

#### Modificación 2: Estado de filtro de almacén (línea ~30)
```typescript
// Filtro por almacén
const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
  if (currentUser.warehouseId) return currentUser.warehouseId;
  return 'ALL';
});
```

#### Modificación 3: Filtrado de ventas por almacén (línea ~45)
```typescript
const filteredSales = useMemo(() => {
  return sales.filter(s => {
    const inDateRange = /* lógica de fechas */;
    const matchesTax = /* lógica de IVA */;

    // NUEVO: Filtro por almacén
    let matchesWarehouse = true;
    if (selectedWarehouseId !== 'ALL') {
      matchesWarehouse = s.warehouseId === selectedWarehouseId;
    }

    return inDateRange && matchesTax && matchesWarehouse;
  });
}, [sales, startDate, endDate, taxFilter, selectedWarehouseId]);
```

#### Modificación 4: UI del selector de almacén (línea ~180)
```typescript
<div>
  <label className="...">Almacén</label>
  {(currentUser.role === 'Admin' || currentUser.role === 'Manager') ? (
    <div className="relative">
      <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
      <select
        value={selectedWarehouseId}
        onChange={(e) => setSelectedWarehouseId(e.target.value)}
        className="..."
      >
        <option value="ALL">Todos los almacenes</option>
        {warehouses.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
    </div>
  ) : (
    <div className="flex items-center px-3 py-2 border rounded-lg bg-slate-50">
      <Store className="w-4 h-4 mr-2 text-emerald-500" />
      {warehouses.find(w => w.id === currentUser.warehouseId)?.name || 'Sin almacén'}
    </div>
  )}
</div>
```

**Comportamiento:**
- **Admin/Manager:** Dropdown para elegir "Todos los almacenes" o uno específico
- **Otros usuarios:** Badge fijo mostrando su almacén asignado
- **Totales recalculados:** HT, TVA, TTC se recalculan según ventas filtradas

---

### 9. **src/components/Dashboard.tsx**

#### Modificación 1: Props y imports (líneas 1-15)
```typescript
import { useMemo, useState } from 'react';
import { Product, Sale, Transfer, User, Warehouse } from '../types';
import { Store, Building2 } from 'lucide-react';

interface DashboardProps {
  products: Product[];
  sales: Sale[];
  transfers: Transfer[];
  currentUser: User;
  warehouses?: Warehouse[]; // NUEVO
}
```

#### Modificación 2: Estado de filtro de almacén (línea ~25)
```typescript
const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(() => {
  if (currentUser.warehouseId) return currentUser.warehouseId;
  return 'ALL';
});
```

#### Modificación 3: Filtrado de datos (líneas ~35-55)
```typescript
// Filtrar ventas por almacén
const filteredSales = useMemo(() => {
  if (selectedWarehouseId === 'ALL') return sales || [];
  return (sales || []).filter(s => s.warehouseId === selectedWarehouseId);
}, [sales, selectedWarehouseId]);

// Filtrar transferencias por almacén
const filteredTransfers = useMemo(() => {
  if (selectedWarehouseId === 'ALL') return transfers || [];
  return (transfers || []).filter(t =>
    t.fromWarehouseId === selectedWarehouseId ||
    t.toWarehouseId === selectedWarehouseId
  );
}, [transfers, selectedWarehouseId]);
```

#### Modificación 4: KPIs actualizados (líneas ~60-120)
```typescript
// Todos los KPIs usan filteredSales en lugar de sales
const totalRevenue = filteredSales.reduce((acc, sale) =>
  acc + (sale.totalAmount || 0), 0);

const totalOrders = filteredSales.length;

const estimatedProfit = filteredSales.reduce((acc, sale) => {
  const profit = sale.items.reduce((itemAcc, item) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return itemAcc;
    const costPerUnit = product.cost || 0;
    const margin = item.unitPrice - costPerUnit;
    return itemAcc + (margin * item.quantity);
  }, 0);
  return acc + profit;
}, 0);

// Inventario filtrado por almacén
const inventoryValue = (products || []).reduce((acc, p) => {
  if (!p.stockLevels) return acc;
  if (selectedWarehouseId === 'ALL') {
    const totalStock = (Object.values(p.stockLevels) as number[])
      .reduce((a, b) => a + b, 0);
    return acc + (totalStock * (p.cost || 0));
  } else {
    const stock = p.stockLevels[selectedWarehouseId] || 0;
    return acc + (stock * (p.cost || 0));
  }
}, 0);

// Stock bajo filtrado por almacén
const lowStockItems = (products || []).filter(p => {
  if (!p.stockLevels) return false;
  if (selectedWarehouseId === 'ALL') {
    const totalStock = Object.values(p.stockLevels)
      .reduce((a: number, b: number) => a + b, 0);
    return totalStock <= (p.minStock || 0);
  } else {
    const stock = p.stockLevels[selectedWarehouseId] || 0;
    return stock <= (p.minStock || 0);
  }
});
```

#### Modificación 5: UI del selector de almacén (después del header)
```typescript
<div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
  <div className="flex items-center gap-4">
    <label className="text-sm font-semibold text-slate-700">
      Filtrar por Almacén:
    </label>
    {(currentUser.role === 'Admin' || currentUser.role === 'Manager') ? (
      <div className="relative">
        <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <select
          value={selectedWarehouseId}
          onChange={(e) => setSelectedWarehouseId(e.target.value)}
          className="..."
        >
          <option value="ALL">Todos los almacenes</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>
    ) : (
      <div className="flex items-center px-3 py-2 border rounded-lg bg-slate-50">
        <Store className="w-4 h-4 mr-2 text-emerald-500" />
        <span className="font-medium">
          {warehouses.find(w => w.id === currentUser.warehouseId)?.name || 'Sin almacén'}
        </span>
      </div>
    )}
  </div>
</div>
```

**KPIs afectados por el filtro:**
- 💰 **Ingresos Totales:** Suma de ventas del almacén seleccionado
- 📈 **Beneficios:** Márgenes calculados solo para ventas filtradas
- 💳 **Cobros:** Total recaudado en el almacén
- 🛒 **Pedidos:** Cantidad de ventas del almacén
- 📦 **Valor de Inventario:** Stock valorado del almacén seleccionado
- ⚠️ **Stock Bajo:** Productos con stock bajo en el almacén

---

### 10. **src/App.tsx** (Actualización final)

#### Modificación: Pasar warehouses a componentes (líneas 486, 492)
```typescript
case 'accounting':
  return <Accounting
    sales={sales}
    customers={customers}
    warehouses={warehouses}
    companySettings={companySettings}
    currentUser={currentUser}
  />;

default:
  return <Dashboard
    products={products}
    sales={sales}
    transfers={transfers}
    currentUser={currentUser}
    warehouses={warehouses}
  />;
```

---

## 🚀 INSTRUCCIONES DE DEPLOYMENT

⚠️ **IMPORTANTE:** Ejecuta los scripts SQL en el orden indicado. Ver [SCRIPTS-SQL-DEPLOYMENT.md](SCRIPTS-SQL-DEPLOYMENT.md) para más detalles.

### Paso 1: Ejecutar Migraciones SQL

#### 1.1. Script: migration-warehouse-permissions.sql
1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia el contenido de `migration-warehouse-permissions.sql`
3. Pega y ejecuta
4. Verifica que aparezca: "✓ Verificación de Migración"

**Qué hace:** Agrega `warehouse_id` a `profiles` y crea políticas RLS

#### 1.2. Script: fix-sales-global-discount.sql
1. Abre **Supabase Dashboard** → **SQL Editor** (nueva pestaña)
2. Copia el contenido de `fix-sales-global-discount.sql`
3. Pega y ejecuta
4. Verifica que aparezca: "✓ Columnas de descuento global agregadas"

**Qué hace:** Agrega columnas faltantes a `sales` (global_discount_amount, credited_amount, invoice_number)

**Error que soluciona:**
```
error: Could not find the 'global_discount_amount' column of 'sales' in the schema cache
```

### Paso 2: Actualizar Edge Function (create-user)
La Edge Function `create-user` debe incluir `warehouse_id` al crear perfiles:

```typescript
// En supabase/functions/create-user/index.ts
const { data: profile, error: profileError } = await supabaseAdmin
  .from('profiles')
  .insert({
    id: newUser.id,
    name: body.name,
    role: body.role,
    email: newUser.email,
    warehouse_id: body.warehouse_id || null // AGREGAR ESTO
  })
  .select()
  .single();
```

### Paso 3: Commit y Push
```bash
cd "c:\Users\basma\Downloads\azmol-stockerp"
git add .
git commit -m "$(cat <<'EOF'
Feature: Sistema de permisos por almacén

- Agregar warehouse_id a profiles con migración SQL
- Restricciones de POS por almacén (usuarios ven solo su sucursal)
- Admins/Managers acceso a todos los almacenes
- Interfaz de gestión: asignar almacenes a usuarios
- Bloqueo automático de POS si usuario sin almacén
- Políticas RLS actualizadas para stock_levels, sales, transfers

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

### Paso 4: Verificar en Vercel
1. Ve a [https://vercel.com](https://vercel.com)
2. Espera deployment (2-3 minutos)
3. Abre tu app en producción

---

## 🧪 PLAN DE TESTING

### Test 1: Usuario sin almacén asignado
```
1. En Supabase: Crear usuario con rol "Cashier" SIN asignar warehouse_id
2. Login como ese usuario
3. ✅ Verificar: Notificación "No tienes almacén asignado"
4. Ir a POS
5. ✅ Verificar: Pantalla de bloqueo con mensaje de error
```

### Test 2: Usuario con almacén asignado
```
1. En gestión de usuarios: Asignar "Almacén Tánger" a usuario "Cashier"
2. Login como ese usuario
3. ✅ Verificar: Mensaje de bienvenida normal
4. Ir a POS
5. ✅ Verificar: Badge "Almacén Tánger" (sin dropdown)
6. Buscar producto con stock en Tánger
7. ✅ Verificar: Stock visible
8. Crear venta
9. ✅ Verificar: Venta se registra con warehouse_id correcto
```

### Test 3: Admin/Manager
```
1. Login como Admin
2. Ir a POS
3. ✅ Verificar: Dropdown de almacenes disponible
4. Cambiar entre almacenes
5. ✅ Verificar: Stock se actualiza según almacén seleccionado
6. Crear venta desde "Almacén Central"
7. ✅ Verificar: Venta se registra correctamente
```

### Test 4: Gestión de usuarios
```
1. Login como Admin
2. Ir a página Users
3. ✅ Verificar: Columna "Almacén" visible en tabla
4. Crear nuevo usuario con rol "Sales"
5. ✅ Verificar: Selector de almacén disponible
6. Asignar "Almacén Central"
7. Guardar
8. ✅ Verificar: Usuario aparece con almacén en la tabla
9. Editar usuario y cambiar rol a "Admin"
10. ✅ Verificar: Campo de almacén muestra badge "Todos los almacenes"
```

### Test 5: Seguridad RLS
```
1. Usuario "Cashier" con almacén "Rabat"
2. Abrir consola del navegador (F12)
3. Intentar crear venta desde otro almacén:
   ```javascript
   supabase.from('sales').insert({
     warehouse_id: 'otro-almacen-id',
     customer_id: '...',
     items: [...]
   })
   ```
4. ✅ Verificar: Base de datos rechaza operación (error 403)
```

---

## 📊 POLÍTICAS RLS IMPLEMENTADAS

### 1. stock_levels
**Restricción:** Usuarios solo ven stock de su almacén
```sql
-- Admin/Manager: ven todo
-- Otros: solo su almacén
WHERE role IN ('Admin', 'Manager') OR warehouse_id = stock_levels.warehouse_id
```

### 2. sales
**Restricción:** Usuarios solo crean ventas desde su almacén
```sql
-- Admin/Manager: pueden vender desde cualquier almacén
-- Otros: solo desde su almacén
WHERE role IN ('Admin', 'Manager') OR warehouse_id = sales.warehouse_id
```

### 3. transfers
**Restricción:** Usuarios solo transfieren desde/hacia su almacén
```sql
-- Admin/Manager: pueden transferir entre cualquier almacén
-- Otros: solo desde/hacia su almacén
WHERE role IN ('Admin', 'Manager')
   OR warehouse_id = transfers.from_warehouse_id
   OR warehouse_id = transfers.to_warehouse_id
```

---

## 🎯 ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────┐
│                   USUARIOS                      │
├─────────────────────────────────────────────────┤
│ Admin/Manager                                   │
│ ├─ warehouseId: null                           │
│ ├─ Acceso: TODOS los almacenes                 │
│ ├─ POS: Dropdown para seleccionar almacén      │
│ └─ Permisos: Completos                          │
├─────────────────────────────────────────────────┤
│ Sales/Cashier/Delivery                          │
│ ├─ warehouseId: UUID específico                │
│ ├─ Acceso: SOLO su almacén                     │
│ ├─ POS: Badge fijo (sin selector)              │
│ └─ Permisos: Limitados por RLS                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              VALIDACIÓN MULTI-CAPA             │
├─────────────────────────────────────────────────┤
│ 1. Frontend (POS)                               │
│    ├─ Bloqueo si no tiene almacén              │
│    └─ Ocultar selector para no-admin           │
├─────────────────────────────────────────────────┤
│ 2. Backend (RLS - Supabase)                     │
│    ├─ Validar warehouse_id en INSERT           │
│    ├─ Validar warehouse_id en SELECT           │
│    └─ Rechazar operaciones no autorizadas      │
└─────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos y Tipos
- [x] Crear migración SQL con warehouse_id
- [x] Actualizar tipos TypeScript (User, DbProfile)
- [x] Políticas RLS implementadas

### Backend y Hooks
- [x] Modificar handleLogin para cargar perfil real
- [x] Actualizar hooks (fetchUsers, updateUser, addUser)

### Componentes Frontend
- [x] Modificar POS para restricciones por almacén
- [x] Actualizar Users para gestión de almacenes
- [x] Actualizar Accounting con filtro por almacén
- [x] Actualizar Dashboard con filtro por almacén

### Deployment
- [x] Commit y push a GitHub (múltiples commits completados)
- [x] Verificar deployment en Vercel
- [x] Ejecutar `migration-warehouse-permissions.sql` en Supabase ✅ **COMPLETADO**
- [x] Ejecutar `fix-sales-global-discount.sql` en Supabase ✅ **COMPLETADO**
- [ ] Actualizar Edge Function create-user
- [ ] Testing completo en producción

### Asignación de Almacenes
- [x] Asignar almacenes a usuarios existentes ✅ **COMPLETADO**
  - basma → Almacén Tánger
  - halima → Sucursal Rabat
  - lkhdar → Almacén Central

---

## 🔧 TROUBLESHOOTING

### Problema: Error "Column warehouse_id does not exist"
**Solución:** Ejecutar `migration-warehouse-permissions.sql` en Supabase

### Problema: Error "Column global_discount_amount does not exist"
**Solución:** Ejecutar `fix-sales-global-discount.sql` en Supabase

**Detalles:** Este error ocurre cuando intentas crear ventas con descuentos globales o consultar ventas existentes. La tabla `sales` necesita las columnas:
- `global_discount_type`
- `global_discount_value`
- `global_discount_amount`
- `credited_amount`
- `invoice_number`

### Problema: Usuarios no aparecen con almacén
**Solución:** Refrescar datos con F5 o limpiar caché del navegador

### Problema: RLS bloquea operaciones de Admin
**Solución:** Verificar que Admin tenga `warehouse_id = NULL` en BD

### Problema: Edge Function falla al crear usuario
**Solución:** Actualizar Edge Function para incluir warehouse_id

---

## 📝 NOTAS ADICIONALES

- **Reversibilidad:** El script SQL incluye comentario con comandos de rollback
- **Performance:** Índice `idx_profiles_warehouse` optimiza queries por almacén
- **Escalabilidad:** Sistema preparado para relación many-to-many (usuario → múltiples almacenes)
- **Auditoría:** Considerar agregar logging de cambios de almacén de usuarios
- **Filtrado integral:** Dashboard y Accounting ahora respetan permisos por almacén
- **Seguridad multi-capa:** Validación en frontend (filtrado de datos) + RLS en backend (políticas de base de datos)

---

**Fecha de implementación:** 2026-01-11
**Última actualización:** 2026-01-11 (v1.1.0 - Filtros de contabilidad y dashboard)
**Desarrollado por:** Claude Sonnet 4.5
**Versión:** 1.1.0
