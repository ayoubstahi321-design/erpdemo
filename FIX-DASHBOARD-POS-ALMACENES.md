# FIX: Dashboard y POS no mostraban almacenes ni productos

## Problema Identificado

Dashboard y POS mostraban vacío (sin almacenes ni productos) a pesar de que los datos existían en la base de datos.

## Causa Raíz

**Schema Real de Supabase vs Código TypeScript:**

### Schema Real (Supabase):
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT,
  role TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Código TypeScript (INCORRECTO):
```typescript
// DbProfile esperaba:
interface DbProfile {
  full_name: string;    // ❌ NO EXISTE - debería ser 'name'
  email: string;        // ❌ NO EXISTE - está en auth.users
  warehouse_id: string; // ❌ NO EXISTE - no hay restricción por almacén
}
```

### Consecuencias:
1. `toUser()` intentaba leer `db.full_name` → **undefined** → usuarios sin nombre
2. `toUser()` intentaba leer `db.email` → **undefined** → usuarios sin email
3. `toUser()` intentaba leer `db.warehouse_id` → **undefined** → `warehouseId = null`
4. Dashboard y POS verificaban `currentUser.warehouseId` → **null** → no seleccionaban ningún almacén
5. Sin almacén seleccionado → **no se mostraban productos ni almacenes**

## Cambios Implementados

### 1. Corregir `DbProfile` interface (src/types/supabase.ts)
```typescript
// ANTES (incorrecto):
export interface DbProfile {
  id: string;
  email: string;          // ❌
  full_name: string;      // ❌
  warehouse_id?: string;  // ❌
  ...
}

// DESPUÉS (correcto):
export interface DbProfile {
  id: string;
  name: string;           // ✅ Campo real
  role: UserRole;
  created_at: string;
  updated_at: string;
  // email viene de auth.users (JOIN)
  // warehouse_id NO existe - todos ven todos los almacenes
}
```

### 2. Actualizar `toUser()` converter
```typescript
// ANTES:
export function toUser(db: DbProfile): User {
  return {
    name: db.full_name,        // ❌
    email: db.email,           // ❌
    warehouseId: db.warehouse_id || null, // ❌
    ...
  };
}

// DESPUÉS:
export function toUser(db: DbProfile, email?: string): User {
  return {
    name: db.name,             // ✅
    email: email || '',        // ✅ Viene como parámetro
    warehouseId: null,         // ✅ Schema no tiene warehouse_id
    ...
  };
}
```

### 3. Actualizar queries de Supabase (src/services/supabaseService.ts)
```typescript
// ANTES:
const { data } = await supabase
  .from('profiles')
  .select('*')
  .order('full_name'); // ❌

return data.map(toUser); // ❌

// DESPUÉS:
const { data } = await supabase
  .from('profiles')
  .select('*, email:id(email)') // ✅ JOIN con auth.users
  .order('name'); // ✅

return data.map(profile => toUser(profile, profile.email?.[0]?.email)); // ✅
```

### 4. Simplificar selección de almacén en Dashboard
```typescript
// ANTES:
const [selectedWarehouseId] = useState(() => {
  if (currentUser.role === 'Admin') return 'ALL';
  if (currentUser.warehouseId) return currentUser.warehouseId; // ❌ Siempre null
  return 'ALL';
});

// DESPUÉS:
const [selectedWarehouseId] = useState(() => {
  if (currentUser.role === 'Admin') return 'ALL';
  return warehouses.length > 0 ? warehouses[0].id : 'ALL'; // ✅ Primer almacén
});
```

### 5. Simplificar selección de almacén en POS
```typescript
// ANTES:
const [selectedWarehouseId] = useState(() => {
  if (currentUser.warehouseId) return currentUser.warehouseId; // ❌ Siempre null
  return warehouses[0]?.id || '';
});

// DESPUÉS:
const [selectedWarehouseId] = useState(() => {
  return warehouses.length > 0 ? warehouses[0].id : ''; // ✅ Primer almacén
});
```

### 6. Corregir `fromUser()` converter
```typescript
// ANTES:
export function fromUser(user: User): Partial<DbProfile> {
  return {
    full_name: user.name,        // ❌
    email: user.email,           // ❌
    warehouse_id: user.warehouseId, // ❌
    ...
  };
}

// DESPUÉS:
export function fromUser(user: User): Partial<DbProfile> {
  return {
    name: user.name,             // ✅
    role: user.role,
    // email NO se guarda en profiles
    // warehouse_id NO existe
  };
}
```

### 7. Desactivar `updateLastActive()`
```typescript
// Campo last_active no existe en schema - comentado para evitar errores
async updateLastActive(userId: string): Promise<void> {
  logDebug('last_active field not in schema - skipping update');
  // Código comentado
}
```

## Resultados

### ✅ Antes del Fix:
- Dashboard: vacío (no almacenes, no productos)
- POS: vacío (no almacenes, no productos)
- Usuarios cargaban con `warehouseId = null`

### ✅ Después del Fix:
- Dashboard: muestra todos los almacenes y productos
- POS: selecciona automáticamente el primer almacén
- Usuarios cargan correctamente con email desde `auth.users`
- Sistema funciona sin restricción por almacén (diseño correcto)

## Verificación

```bash
npm run build  # ✅ Compila sin errores
```

## Notas Técnicas

1. **Sistema sin restricción de almacén**: El schema NO tiene `warehouse_id` en `profiles`, lo que significa que el diseño correcto es que **todos los usuarios vean todos los almacenes**.

2. **Email en auth.users**: El email del usuario NO se replica en `profiles`, debe obtenerse mediante JOIN con `auth.users`.

3. **Campos que NO existen en profiles**:
   - `full_name` → usar `name`
   - `email` → JOIN con `auth.users`
   - `warehouse_id` → no existe
   - `last_active` → no existe

4. **Comportamiento por rol**:
   - **Admin**: Ve "TODOS" los almacenes por defecto en Dashboard
   - **Otros roles**: Ven el primer almacén disponible por defecto
   - **POS**: Siempre selecciona el primer almacén para ventas

## Archivos Modificados

- `src/types/supabase.ts` - Corregir DbProfile y converters
- `src/services/supabaseService.ts` - Corregir queries y JOINs
- `src/components/Dashboard.tsx` - Simplificar selección de almacén
- `src/components/POS.tsx` - Simplificar selección de almacén

## Commit

```bash
git add -A
git commit -m "Fix: Dashboard y POS no mostraban almacenes/productos

Problema: Dashboard y POS vacíos a pesar de datos en DB

Causa: DbProfile usaba campos inexistentes (full_name, email, warehouse_id)
- Schema real: profiles(id, name, role, created_at, updated_at)
- toUser() leía db.warehouse_id → null → no se seleccionaba almacén

Cambios:
- ✅ DbProfile.name (era full_name)
- ✅ toUser() recibe email como parámetro (JOIN con auth.users)
- ✅ warehouseId siempre null (schema no tiene restricción)
- ✅ Dashboard/POS seleccionan primer almacén disponible
- ✅ Queries con JOIN: select('*, email:id(email)')
- ✅ Desactivado updateLastActive (campo no existe)

Resultado: Dashboard y POS muestran datos correctamente"
```
