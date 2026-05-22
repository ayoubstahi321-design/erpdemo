/**
 * Feature Flags for gradual Supabase migration
 * Set to true to enable Supabase for each entity
 */

export const FEATURE_FLAGS = {
  // Entities - ENABLED for Supabase migration
  USE_SUPABASE_WAREHOUSES: true,
  USE_SUPABASE_CUSTOMERS: true,
  USE_SUPABASE_PRODUCTS: true,     // ✅ Enabled - Full CRUD implementation with stock levels
  USE_SUPABASE_SALES: true,        // ✅ Enabled - Full CRUD implementation with items and payments
  USE_SUPABASE_TRANSFERS: true,    // ✅ Enabled - Full CRUD implementation with transfer_items
  USE_SUPABASE_RETURNS: true,      // ✅ Enabled - Full CRUD implementation with return_items
  USE_SUPABASE_AUDIT_LOGS: true,   // ✅ Enabled - Audit logging with automatic tracking
  USE_SUPABASE_USERS: true,        // ✅ Enabled - Full CRUD implementation
  USE_SUPABASE_STOCK_LEVELS: true, // ✅ Enabled - Stock level management with RPC
  USE_SUPABASE_PAYMENTS: true,     // ✅ Enabled - Payment registration and tracking
  USE_SUPABASE_SETTINGS: true,     // ✅ Enabled - Company settings management

  // Features
  ENABLE_REALTIME: true,   // ✅ Enabled - snake_case payloads are now transformed via snakeToCamel
  OFFLINE_MODE: true       // ✅ Enabled - Offline mode with sync queue and auto-sync
};

/**
 * Simplified feature access for components
 */
export const FEATURES = {
  /** Enable offline mode with IndexedDB sync queue */
  OFFLINE_MODE: FEATURE_FLAGS.OFFLINE_MODE,
  /** Enable realtime subscriptions */
  REALTIME: FEATURE_FLAGS.ENABLE_REALTIME,
};
