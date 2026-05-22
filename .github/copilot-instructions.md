# Copilot Instructions - Azmol StockerP

## Project Overview
**Azmol StockerP** is a **Progressive Web App (PWA) inventory/ERP system** for Azmol British Petrochemicals, built with React + TypeScript + Supabase. It manages warehouses, products, stock levels, sales, transfers, returns, and user permissions across multiple locations (Casablanca, Rabat, Tánger).

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Zustand (state management)
- **Backend**: Supabase (PostgreSQL + Auth + Real-time subscriptions + Edge Functions)
- **Styling**: Tailwind CSS
- **Data Binding**: Bidirectional type conversion between DB (snake_case) ↔ App (camelCase)

### Core Data Flow
```
User Auth (Supabase Auth)
  ↓
Row Level Security (RLS policies by role: Admin/Manager/Sales/Delivery/Cashier)
  ↓
supabaseService.ts (Type-safe CRUD abstraction)
  ↓
Type Converters (types/supabase.ts) ← DB schema ↔ App types
  ↓
useSupabaseData hooks (React hooks for data fetching/mutations)
  ↓
Zustand store (Global state)
  ↓
React Components
```

### Key Service Boundaries
- **supabaseClient.ts**: Singleton Supabase client with anon key (safe for frontend)
- **supabaseService.ts**: Complete CRUD layer with automatic type conversion
- **useSupabaseData.ts**: React hooks wrapping service layer (1200+ lines - comprehensive)
- **types/supabase.ts**: Converters between DB and app types (handles complex fields)
- **authService.ts**: Authentication flows (signup/login/logout/session management)

## Critical Patterns

### Type Conversion (Non-Negotiable)
All data from Supabase requires bidirectional conversion:
- **To app**: Use `toProduct()`, `toSale()`, etc. from types/supabase.ts
- **From app**: Use `fromProduct()`, `fromSale()`, etc.
- **Stock levels special case**: App stores as `Record<warehouseId, quantity>`, DB has separate `stock_levels` table with foreign keys

**Example**:
```typescript
// Fetch and convert
const { data: dbProducts } = await supabase.from('products').select('*');
const products = dbProducts.map(toProduct); // Automatic conversion

// Mutate and convert
const appProduct = { sku: 'ABC123', ... };
const dbProduct = fromProduct(appProduct);
await supabase.from('products').insert(dbProduct);
```

### RLS & Security
- **All tables have RLS enabled** - must check user role in policies
- **Anon key only in frontend** - service role key only in Edge Functions
- **API keys**: VITE_SUPABASE_ANON_KEY (frontend safe), SUPABASE_SERVICE_ROLE_KEY (Edge Functions only)
- **Audit logging**: Automatic via triggers on mutations (audit_logs table)

### Data Fetching Pattern
Use `useSupabaseData` hooks for all queries:
```typescript
const { warehouses, loading, error } = useWarehouses();
await addWarehouse(newWarehouse);
```

Don't manually call `supabase.from()` in components—use pre-built hooks.

### State Management with Zustand
Store is in `store/useStore.ts`, used to avoid prop drilling:
```typescript
const products = useStore(state => state.products);
const addProduct = useStore(state => state.addProduct);
```

## Deployment

### Local Development
```bash
npm install
npm run dev              # Start Vite dev server
npm run test           # Run vitest
npm run lint          # Check TypeScript + ESLint
npm run build:check   # Verify prod build compiles
```

### Production (Vercel)
- Supabase Auth redirect URLs must match deployed domain
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Edge Functions for server-side validation (see `supabase/functions/`)

### Database Migrations
- Schema in `supabase-complete-schema.sql` (comprehensive) or `supabase-schema-simple.sql` (simplified)
- Execute via Supabase Dashboard > SQL Editor
- RLS policies included in schema files
- Never modify schema without `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on new tables

## Common Workflows

### Adding a New Entity (e.g., "Suppliers")
1. Create table in `supabase-complete-schema.sql` with RLS policies
2. Define types in `src/types.ts` (camelCase)
3. Add DB type in `src/types/supabase.ts` (snake_case) + converters (to/from functions)
4. Implement CRUD in `supabaseService.ts` with type conversion
5. Add hook in `useSupabaseData.ts` (`useSuppliers`, `addSupplier`, etc.)
6. Create React component with hook
7. Add tests in `src/services/__tests__/` and `src/hooks/__tests__/`

### Fixing Stock Issues
- Stock is managed atomically via `supabaseService.products.updateStock()`
- Use RPC `update_stock_level` for concurrent-safe mutations
- Audit log automatically created for all stock changes
- Always pass `reason` parameter to track why stock changed

### Debugging
- Enable `FEATURE_FLAGS.DEBUG_MODE` in `src/config/features.ts`
- Logs go to browser console (service layer logs with `[DEBUG]` prefix)
- Check Supabase Dashboard > Realtime for subscription issues
- Check RLS policies if mutations suddenly fail (role permissions changed)

## Project File Structure
```
src/
  ├── services/          # API & integration layer
  │   ├── supabaseClient.ts
  │   ├── supabaseService.ts   # Main CRUD abstraction
  │   ├── authService.ts
  │   └── __tests__/
  ├── hooks/             # Custom React hooks
  │   ├── useSupabaseData.ts   # Data fetching/mutation
  │   └── useRealtime.ts       # Realtime subscriptions
  ├── types/
  │   ├── types.ts       # App types (camelCase)
  │   └── supabase.ts    # DB types & converters
  ├── store/            # Zustand global state
  ├── components/       # UI components
  └── App.tsx
supabase/
  └── functions/         # Edge Functions (server-side)
**/*.sql               # Database schemas & migrations
```

## RLS Roles & Permissions
- **Admin**: Full access to all operations
- **Manager**: Full access except user management
- **Sales**: Create/update sales & customers, view products & stock
- **Delivery**: View products, transfers, sales (no pricing)
- **Cashier**: Create/update payments, view sales

## Important Constraints
- **No local backend** - all logic uses Supabase
- **Type safety**: Always use converters between DB ↔ App types
- **Real-time**: Tables subscribe to changes automatically via `useRealtime` hook
- **Currency**: Stored as NUMERIC(10,2) in DB (not floating-point)
- **Timestamps**: Always UTC via `TIMEZONE('utc'::text, NOW())`
