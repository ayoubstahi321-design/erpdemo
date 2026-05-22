/**
 * Warehouse Migration Script
 *
 * Execute this from browser console to migrate warehouses from localStorage to Supabase
 *
 * Usage:
 *   1. Open browser console (F12)
 *   2. Navigate to Warehouses page
 *   3. Run: await window.migrateWarehouses()
 */

import { dataService, KEYS } from '../services/dataService';
import { supabaseService } from '../services/supabaseService';
import { Warehouse } from '../types';

export async function migrateWarehouses(): Promise<{
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  console.log('[MIGRATION] Starting warehouse migration...');

  // 1. Load warehouses from localStorage
  const localWarehouses = dataService.load<Warehouse[]>(KEYS.WAREHOUSES, []);
  console.log(`[MIGRATION] Found ${localWarehouses.length} warehouses in localStorage`);

  if (localWarehouses.length === 0) {
    console.log('[MIGRATION] No warehouses to migrate');
    return result;
  }

  // 2. Create backup
  const backupData = {
    warehouses: localWarehouses,
    customers: [],
    users: [],
    products: [],
    sales: [],
    transfers: [],
    returns: [],
    auditLogs: [],
  };

  const backup = dataService.createBackup(backupData);
  if (!backup.success) {
    console.error('[MIGRATION] Failed to create backup');
    result.success = false;
    result.errors.push('Failed to create backup');
    return result;
  }

  console.log(`[MIGRATION] Backup created: ${backup.timestamp}`);

  // 3. Migrate each warehouse
  for (const warehouse of localWarehouses) {
    try {
      // Check if already exists
      const existing = await supabaseService.warehouses.getById(warehouse.id);

      if (existing) {
        console.log(`  ⏭  Skipped: ${warehouse.name} (already exists in Supabase)`);
        result.skipped++;
        continue;
      }

      // Create in Supabase
      await supabaseService.warehouses.create(warehouse);
      console.log(`  ✓ Migrated: ${warehouse.name}`);
      result.migrated++;
    } catch (error: any) {
      const errorMsg = `${warehouse.name}: ${error.message}`;
      console.error(`  ✗ Failed: ${errorMsg}`);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  // 4. Summary
  console.log('\n[MIGRATION] Summary:');
  console.log(`  Total: ${localWarehouses.length}`);
  console.log(`  Migrated: ${result.migrated}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.error('\n[MIGRATION] Errors:', result.errors);
  }

  if (result.success && result.migrated > 0) {
    console.log('\n✅ Migration completed successfully!');
    console.log('   You can now refresh the page to see data from Supabase.');
  } else if (result.migrated === 0 && result.skipped > 0) {
    console.log('\n✅ All warehouses already migrated!');
  }

  return result;
}

// Make available globally for console access
declare global {
  interface Window {
    migrateWarehouses: typeof migrateWarehouses;
  }
}

if (typeof window !== 'undefined') {
  window.migrateWarehouses = migrateWarehouses;
}
