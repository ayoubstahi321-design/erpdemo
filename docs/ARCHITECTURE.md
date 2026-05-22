# Architecture - Azmol StockERP

## Overview

Azmol StockERP is a multi-company wholesale/retail ERP built with React + Supabase, targeting Moroccan businesses (lubricants industry). It handles sales (POS + B2B), inventory, returns, payments (including check/traite tracking), and multi-company invoicing.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand (global) + React hooks (local) |
| Backend | Supabase (PostgreSQL + Auth + RLS + Realtime) |
| PDF | @react-pdf/renderer |
| Offline | IndexedDB sync queue + service worker |
| Build | Vite |
| Tests | Vitest + React Testing Library |

## Directory Structure

```
src/
  components/       # React UI components (pages + modals)
  hooks/            # Custom React hooks (data + logic)
  services/         # External service integrations
  store/            # Zustand global store
  config/           # Feature flags and configuration
  utils/            # Pure utility functions (no side effects)
  types.ts          # TypeScript type definitions
  types/            # Additional type modules (supabase, offline)
docs/               # Developer and setup documentation
sql/                # Database schema and migrations
```

## Architecture Layers

### 1. Components (`src/components/`)

Page-level components that render UI and orchestrate user interactions.

| Component | Responsibility |
|---|---|
| `POS.tsx` | Point-of-sale: cart, checkout, fast sales (B2C) |
| `Sales.tsx` | B2B sales: create/edit invoices, payments, returns |
| `Inventory.tsx` | Product stock levels across warehouses |
| `Dashboard.tsx` | KPIs, charts, business overview |
| `Customers.tsx` | Customer CRUD with credit limits |
| `Transfers.tsx` | Inter-warehouse stock transfers |
| `Returns.tsx` | Return tracking and credit management |
| `Treasury.tsx` | Payment tracking (checks, traites, cash) |
| `Layout.tsx` | App shell: sidebar, header, company selector |

### 2. Hooks (`src/hooks/`)

Data management and business logic hooks. These are the **core business layer**.

| Hook | Purpose |
|---|---|
| `useSupabaseData.ts` | All Supabase CRUD operations (sales, products, warehouses, customers, payments, returns) |
| `useInvoiceCalculation.ts` | Invoice total calculation (TTC/HT/TVA with global discounts) |
| `useWarehouseSelection.ts` | Warehouse selection with persistence and sync |
| `useOfflineSales.ts` | Offline-first sale creation with sync queue |
| `useRealtime.ts` | Supabase realtime subscriptions |
| `usePagination.ts` | Client-side pagination |
| `usePersistedState.ts` | localStorage-backed React state |

### 3. Services (`src/services/`)

External integrations and infrastructure.

| Service | Purpose |
|---|---|
| `supabaseClient.ts` | Supabase client singleton |
| `documentNumbering.ts` | Sequential document number generation (FAC/BL/T-YYYY-NNNNN) |
| `authService.ts` | Authentication (login, 2FA, session management) |
| `i18n.tsx` | Multi-language support (FR, ES, AR, EN) |
| `offline/` | Offline mode: IndexedDB, sync engine, network detection |

### 4. Utils (`src/utils/`)

Pure functions with no side effects. These are the most testable layer.

| Module | Purpose |
|---|---|
| `pricing.ts` | **Critical**: TTC/HT/TVA calculations, invoice computation, penny distribution |
| `helpers.ts` | Item totals, SKU generation, invoice numbering, stock utilities |
| `fuzzySearch.ts` | Levenshtein-based fuzzy search for products |
| `logger.ts` | Structured logging with levels |

### 5. Store (`src/store/`)

Zustand global state for cross-component data.

```
useStore: {
  activeCompanyId    // Selected company filter (Admin: all companies)
  companyProfiles    // Available companies for current user
  currentUser        // Authenticated user
}
```

## Data Flow

```
User Action
  -> Component (UI event handler)
    -> Hook (useSupabaseData.createSale / updateSaleItems / registerPayment)
      -> Supabase RPC (create_sale_atomic / update_sale_optimistic)
        -> PostgreSQL (atomic transaction: sale + items + stock + payments)
          -> RLS policies (company isolation)
      <- Hook updates local state + triggers refresh
    <- Component re-renders with new data
  <- Realtime subscription pushes changes to other connected clients
```

## Critical Business Rules

### Financial Precision
- All money calculations use `roundTo(value, 2)` after every arithmetic operation
- Global discounts use **penny distribution algorithm**: `roundDown` per line, last line absorbs residual
- TVA groups are accumulated with rounding at each addition

### Role-Based Access (4 roles)
| Feature | Sales/Cashier | Manager | Admin | Accountant |
|---|---|---|---|---|
| Line discount max | 15% | 30% | Unlimited | - |
| Global discount max | 0% | 20% | Unlimited | - |
| Edit sale prices | No | Yes | Yes | No |
| Gift (OFFERT) | No | Yes | Yes | No |
| Edit invoices | No | Yes | Yes | Yes |
| BL -> Invoice | No | Yes | Yes | No |
| Credit limit override | No | Yes (confirm) | Yes (confirm) | No |

### Multi-Company Isolation
- Supabase RLS filters all queries by `user_company_ids()`
- Frontend additionally filters customers and warehouses by `activeCompanyId`
- Warehouses linked to companies via `warehouse_companies` N:M junction table
- Switching company auto-resets customer and warehouse selection

### Check/Traite Payment Lifecycle
```
Pending -> Cashed (normal flow)
Pending -> Bounced (check bounces)
Bounced -> Recovered (re-deposited successfully)
```
When a check bounces: sale's `amount_paid` is recalculated excluding bounced payments, `payment_status` reverts to Unpaid/Partial.

### Document Numbering
- Format: `{PREFIX}-{YEAR}-{NNNNN}` (e.g., `F-2026-00042`)
- Prefixes: `F` (Invoice), `BL` (Delivery Note), `T` (Ticket)
- Generated atomically via `generate_document_number` RPC (PostgreSQL advisory lock)
- Per-company, per-year sequential counters

### Stock Management
- `create_sale_atomic`: Inserts sale + items + deducts stock in single PostgreSQL transaction
- `update_sale_optimistic`: Reverses old stock, applies new stock, uses `updated_at` for conflict detection
- Returns restore stock via `update_stock_level` RPC
- POS validates stock availability before adding to cart

### Edit Protection
- Sales with any returns (partial or full) cannot be edited (would invalidate credited_amount)
- Optimistic locking via `updated_at` timestamp comparison prevents concurrent edit conflicts

## Database (Supabase PostgreSQL)

### Key Tables
```
sales              # Sale header (totals, status, company_id)
sale_items         # Line items per sale
payments           # Payment records per sale
returns            # Return headers
return_items       # Returned items per return
products           # Product catalog with stock_levels JSONB
warehouses         # Physical locations
warehouse_companies # N:M junction (warehouse <-> company)
customers          # Customer registry with credit_limit
document_counters  # Sequential numbering per type/year/company
```

### Key RPC Functions
```sql
create_sale_atomic(p_sale, p_items, p_stock_updates)
update_sale_optimistic(p_sale_id, p_expected_updated_at, p_new_items, ...)
update_stock_level(p_product_id, p_warehouse_id, p_delta, p_reason)
generate_document_number(p_document_type, p_company_id, p_year)
```

## Testing

```bash
npm test              # Run all tests (vitest)
npm run test:coverage # Run with coverage report
npm run test:ui       # Visual test runner
```

### Test Structure
```
src/utils/__tests__/pricing.test.ts          # 53 tests - Financial calculations
src/utils/__tests__/helpers.test.ts          # 30 tests - Business utilities
src/utils/__tests__/fuzzySearch.test.ts      # 14 tests - Search algorithm
src/hooks/__tests__/useInvoiceCalculation.test.ts  # 10 tests - Invoice hook
src/hooks/__tests__/useWarehouseSelection.test.ts  # 9 tests  - Warehouse hook
src/hooks/__tests__/usePagination.test.ts    # 7 tests  - Pagination hook
src/services/__tests__/supabaseService.test.ts     # 15 tests - Service layer
```

## Moroccan-Specific Features
- **TVA rates**: 20% (standard), 14%, 10%, 7%, 0% (exempt)
- **Currency**: MAD (Moroccan Dirham), displayed as "DH"
- **Document types**: Facture (Invoice), Bon de Livraison (Delivery Note), Ticket
- **Payment methods**: Cash, Check, Traite (bill of exchange), Bank Transfer, Credit Card
- **ICE**: Tax identification number on invoices
- **Languages**: French (primary), Arabic, Spanish, English
