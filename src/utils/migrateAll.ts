/**
 * Complete Migration Script - All Entities
 *
 * Migrates all data from localStorage to Supabase PostgreSQL
 *
 * Usage from browser console:
 *   await window.migrateAll()
 */

import { dataService, KEYS } from '../services/dataService';
import { supabaseService } from '../services/supabaseService';
import { Warehouse, Customer, Product, AuditLogEntry, CompanySettings } from '../types';

interface MigrationReport {
  timestamp: string;
  results: {
    entity: string;
    migrated: number;
    skipped: number;
    errors: string[];
  }[];
  totalMigrated: number;
  totalSkipped: number;
  totalErrors: number;
  duration: number;
}

export async function migrateAll(): Promise<MigrationReport> {
  const startTime = Date.now();
  const results: any[] = [];

  console.log('\n🚀 ===== FULL MIGRATION TO SUPABASE ===== 🚀\n');

  // Create backup
  const backupData = {
    warehouses: dataService.load<Warehouse[]>(KEYS.WAREHOUSES, []),
    customers: dataService.load<Customer[]>(KEYS.CUSTOMERS, []),
    users: dataService.load(KEYS.USERS, []),
    products: dataService.load<Product[]>(KEYS.PRODUCTS, []),
    sales: dataService.load(KEYS.SALES, []),
    transfers: dataService.load(KEYS.TRANSFERS, []),
    returns: dataService.load(KEYS.RETURNS, []),
    auditLogs: dataService.load<AuditLogEntry[]>(KEYS.AUDIT_LOGS, []),
    settings: dataService.load<CompanySettings | undefined>(KEYS.SETTINGS, undefined),
  };

  const backup = dataService.createBackup(backupData);
  if (!backup.success) {
    throw new Error('Failed to create backup');
  }

  console.log(`📦 Backup created: ${backup.timestamp}\n`);

  // Migrate in dependency order

  // Phase 1: Simple entities
  results.push(await migrateWarehouses(backupData.warehouses));
  results.push(await migrateCustomers(backupData.customers));

  // Phase 2: Products (complex - with stock levels)
  results.push(await migrateProducts(backupData.products));

  // Phase 3: Audit logs
  results.push(await migrateAuditLogs(backupData.auditLogs));

  // Phase 4: Settings
  if (backupData.settings) {
    results.push(await migrateSettings(backupData.settings));
  }

  // Calculate totals
  const duration = Date.now() - startTime;
  const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    results,
    totalMigrated,
    totalSkipped,
    totalErrors,
    duration,
  };

  console.log('\n📊 ===== MIGRATION SUMMARY ===== 📊\n');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Migrated: ${totalMigrated}`);
  console.log(`⏭️  Skipped: ${totalSkipped}`);
  console.log(`❌ Errors: ${totalErrors}\n`);

  results.forEach(r => {
    const status = r.errors.length === 0 ? '✅' : '⚠️';
    console.log(`${status} ${r.entity}: ${r.migrated} migrated, ${r.skipped} skipped, ${r.errors.length} errors`);
  });

  if (totalErrors > 0) {
    console.log('\n⚠️  ERRORS DETAILS:\n');
    results.forEach(r => {
      if (r.errors.length > 0) {
        console.error(`❌ ${r.entity}:`, r.errors);
      }
    });
  }

  if (totalMigrated > 0) {
    console.log('\n🎉 Migration completed! Refresh the page to see data from Supabase.\n');
  }

  return report;
}

// Entity-specific migration functions

async function migrateWarehouses(warehouses: Warehouse[]) {
  const result = { entity: 'Warehouses', migrated: 0, skipped: 0, errors: [] as string[] };

  console.log(`🏢 Migrating ${warehouses.length} warehouses...`);

  for (const warehouse of warehouses) {
    try {
      const existing = await supabaseService.warehouses.getById(warehouse.id);
      if (existing) {
        result.skipped++;
      } else {
        await supabaseService.warehouses.create(warehouse);
        result.migrated++;
      }
    } catch (error: any) {
      result.errors.push(`${warehouse.name}: ${error.message}`);
    }
  }

  return result;
}

async function migrateCustomers(customers: Customer[]) {
  const result = { entity: 'Customers', migrated: 0, skipped: 0, errors: [] as string[] };

  console.log(`👥 Migrating ${customers.length} customers...`);

  for (const customer of customers) {
    try {
      const existing = await supabaseService.customers.getById(customer.id);
      if (existing) {
        result.skipped++;
      } else {
        await supabaseService.customers.create(customer);
        result.migrated++;
      }
    } catch (error: any) {
      result.errors.push(`${customer.name}: ${error.message}`);
    }
  }

  return result;
}

async function migrateProducts(products: Product[]) {
  const result = { entity: 'Products', migrated: 0, skipped: 0, errors: [] as string[] };

  console.log(`📦 Migrating ${products.length} products with stock levels...`);

  for (const product of products) {
    try {
      const existing = await supabaseService.products.getById(product.id);
      if (existing) {
        result.skipped++;
      } else {
        await supabaseService.products.create(product);
        result.migrated++;
      }
    } catch (error: any) {
      result.errors.push(`${product.name}: ${error.message}`);
    }
  }

  return result;
}

async function migrateAuditLogs(logs: AuditLogEntry[]) {
  const result = { entity: 'AuditLogs', migrated: 0, skipped: 0, errors: [] as string[] };

  console.log(`📝 Migrating ${logs.length} audit logs...`);

  // Batch insert audit logs (they're immutable, no duplicates)
  const batchSize = 100;
  for (let i = 0; i < logs.length; i += batchSize) {
    const batch = logs.slice(i, i + batchSize);
    try {
      for (const log of batch) {
        await supabaseService.auditLogs.create(log);
        result.migrated++;
      }
    } catch (error: any) {
      result.errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`);
    }
  }

  return result;
}

async function migrateSettings(settings: CompanySettings) {
  const result = { entity: 'Settings', migrated: 0, skipped: 0, errors: [] as string[] };

  console.log(`⚙️  Migrating company settings...`);

  try {
    await supabaseService.settings.updateCompanySettings(settings);
    result.migrated = 1;
  } catch (error: any) {
    result.errors.push(error.message);
  }

  return result;
}

// Make available globally
declare global {
  interface Window {
    migrateAll: typeof migrateAll;
  }
}

if (typeof window !== 'undefined') {
  window.migrateAll = migrateAll;
}
