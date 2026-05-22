/**
 * Migration Utilities
 *
 * One-time utilities for migrating data from localStorage to Supabase PostgreSQL.
 *
 * Features:
 * - Batch data migration
 * - Validation and integrity checks
 * - Comparison between local and remote data
 * - Rollback capability
 *
 * Usage:
 *   await migrationUtils.migrateAllData();
 *   const report = await migrationUtils.validateMigration();
 */

import { supabaseService } from '../services/supabaseService';
import { dataService, KEYS, BackupData } from '../services/dataService';
import {
  Warehouse,
  Customer,
  User,
  Product,
  Sale,
  Transfer,
  Return,
  AuditLogEntry,
  CompanySettings,
} from '../types';
import { FEATURE_FLAGS } from '../config/features';

// ==================== TYPES ====================

export interface MigrationResult {
  entity: string;
  success: boolean;
  migrated: number;
  skipped: number;
  errors: string[];
}

export interface MigrationReport {
  timestamp: string;
  results: MigrationResult[];
  totalMigrated: number;
  totalErrors: number;
  duration: number;
}

export interface ValidationResult {
  entity: string;
  localCount: number;
  remoteCount: number;
  match: boolean;
  missing: string[];
  extra: string[];
}

export interface ComparisonReport {
  timestamp: string;
  validations: ValidationResult[];
  allMatch: boolean;
}

// ==================== MIGRATION FUNCTIONS ====================

/**
 * Migrate all data from localStorage to Supabase
 */
async function migrateAllData(): Promise<MigrationReport> {
  const startTime = Date.now();
  const results: MigrationResult[] = [];

  console.log('[MIGRATION] Starting full data migration...');

  // Create backup before migration
  const localData = loadAllLocalData();
  const backup = dataService.createBackup(localData);
  if (!backup.success) {
    throw new Error('Failed to create backup before migration');
  }
  console.log('[MIGRATION] Backup created:', backup.timestamp);

  // Migrate in dependency order
  results.push(await migrateWarehouses(localData.warehouses));
  results.push(await migrateCustomers(localData.customers));
  results.push(await migrateUsers(localData.users));
  results.push(await migrateProducts(localData.products));
  results.push(await migrateSales(localData.sales));
  results.push(await migrateTransfers(localData.transfers));
  results.push(await migrateReturns(localData.returns));
  results.push(await migrateAuditLogs(localData.auditLogs));

  if (localData.settings) {
    results.push(await migrateSettings(localData.settings));
  }

  const duration = Date.now() - startTime;
  const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    results,
    totalMigrated,
    totalErrors,
    duration,
  };

  console.log('[MIGRATION] Complete:', report);
  return report;
}

/**
 * Load all data from localStorage
 */
function loadAllLocalData(): BackupData {
  return {
    warehouses: dataService.load<Warehouse[]>(KEYS.WAREHOUSES, []),
    customers: dataService.load<Customer[]>(KEYS.CUSTOMERS, []),
    users: dataService.load<User[]>(KEYS.USERS, []),
    products: dataService.load<Product[]>(KEYS.PRODUCTS, []),
    sales: dataService.load<Sale[]>(KEYS.SALES, []),
    transfers: dataService.load<Transfer[]>(KEYS.TRANSFERS, []),
    returns: dataService.load<Return[]>(KEYS.RETURNS, []),
    auditLogs: dataService.load<AuditLogEntry[]>(KEYS.AUDIT_LOGS, []),
    settings: dataService.load<CompanySettings | undefined>(KEYS.SETTINGS, undefined),
  };
}

// ==================== ENTITY-SPECIFIC MIGRATIONS ====================

async function migrateWarehouses(warehouses: Warehouse[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Warehouses',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_WAREHOUSES) {
    result.errors.push('Supabase warehouses disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${warehouses.length} warehouses...`);

  for (const warehouse of warehouses) {
    try {
      // Check if already exists
      const existing = await supabaseService.warehouses.getById(warehouse.id);
      if (existing) {
        result.skipped++;
        console.log(`  Skipped: ${warehouse.name} (already exists)`);
        continue;
      }

      // Create warehouse (use existing ID)
      await supabaseService.warehouses.create(warehouse);
      result.migrated++;
      console.log(`  ✓ Migrated: ${warehouse.name}`);
    } catch (error: any) {
      result.errors.push(`${warehouse.name}: ${error.message}`);
      console.error(`  ✗ Failed: ${warehouse.name}`, error);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function migrateCustomers(customers: Customer[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Customers',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_CUSTOMERS) {
    result.errors.push('Supabase customers disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${customers.length} customers...`);

  for (const customer of customers) {
    try {
      const existing = await supabaseService.customers.getById(customer.id);
      if (existing) {
        result.skipped++;
        continue;
      }

      await supabaseService.customers.create(customer);
      result.migrated++;
    } catch (error: any) {
      result.errors.push(`${customer.name}: ${error.message}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function migrateUsers(users: User[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Users',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_USERS) {
    result.errors.push('Supabase users disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${users.length} user profiles...`);
  console.warn('[MIGRATION] Note: User migration only updates profiles, not auth users');

  for (const user of users) {
    try {
      const existing = await supabaseService.users.getById(user.id);
      if (existing) {
        // Update existing profile
        await supabaseService.users.updateProfile(user.id, {
          name: user.name,
          role: user.role,
          lastActive: user.lastActive,
        });
        result.skipped++;
      } else {
        // Can't create new auth users via migration
        result.errors.push(`${user.name}: Auth user must be created via Supabase Auth`);
      }
    } catch (error: any) {
      result.errors.push(`${user.name}: ${error.message}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function migrateProducts(products: Product[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Products',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_PRODUCTS) {
    result.errors.push('Supabase products disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${products.length} products with stock levels...`);

  for (const product of products) {
    try {
      const existing = await supabaseService.products.getById(product.id);
      if (existing) {
        result.skipped++;
        continue;
      }

      // Create product with normalized stock_levels
      await supabaseService.products.create(product);
      result.migrated++;
      console.log(`  ✓ Migrated: ${product.name} (${Object.keys(product.stockLevels).length} warehouses)`);
    } catch (error: any) {
      result.errors.push(`${product.name}: ${error.message}`);
      console.error(`  ✗ Failed: ${product.name}`, error);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function migrateSales(sales: Sale[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Sales',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_SALES) {
    result.errors.push('Supabase sales disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${sales.length} sales...`);
  console.warn('[MIGRATION] Sales migration does NOT use Edge Function (no stock deduction)');

  // Sales migration is complex - requires manual insertion to avoid stock re-deduction
  result.errors.push('Sales migration requires manual SQL import to avoid stock re-deduction');
  result.success = false;

  return result;
}

async function migrateTransfers(transfers: Transfer[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Transfers',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_TRANSFERS) {
    result.errors.push('Supabase transfers disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${transfers.length} transfers...`);
  result.errors.push('Transfer migration requires manual handling to avoid stock re-adjustment');
  result.success = false;

  return result;
}

async function migrateReturns(returns: Return[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Returns',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_RETURNS) {
    result.errors.push('Supabase returns disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${returns.length} returns...`);
  result.errors.push('Return migration requires manual handling');
  result.success = false;

  return result;
}

async function migrateAuditLogs(logs: AuditLogEntry[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'AuditLogs',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_AUDIT_LOGS) {
    result.errors.push('Supabase audit logs disabled');
    result.success = false;
    return result;
  }

  console.log(`[MIGRATION] Migrating ${logs.length} audit logs...`);

  // Batch insert audit logs (they're immutable)
  for (const log of logs) {
    try {
      await supabaseService.auditLogs.create(log);
      result.migrated++;
    } catch (error: any) {
      result.errors.push(`Log ${log.id}: ${error.message}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

async function migrateSettings(settings: CompanySettings): Promise<MigrationResult> {
  const result: MigrationResult = {
    entity: 'Settings',
    success: true,
    migrated: 0,
    skipped: 0,
    errors: [],
  };

  if (!FEATURE_FLAGS.USE_SUPABASE_SETTINGS) {
    result.errors.push('Supabase settings disabled');
    result.success = false;
    return result;
  }

  console.log('[MIGRATION] Migrating company settings...');

  try {
    await supabaseService.settings.updateCompanySettings(settings);
    result.migrated = 1;
  } catch (error: any) {
    result.errors.push(error.message);
    result.success = false;
  }

  return result;
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate that migration was successful by comparing local and remote data
 */
async function validateMigration(): Promise<ComparisonReport> {
  console.log('[VALIDATION] Starting migration validation...');

  const localData = loadAllLocalData();
  const validations: ValidationResult[] = [];

  validations.push(await validateEntity('Warehouses', localData.warehouses, async () => {
    return await supabaseService.warehouses.getAll();
  }));

  validations.push(await validateEntity('Customers', localData.customers, async () => {
    return await supabaseService.customers.getAll();
  }));

  validations.push(await validateEntity('Products', localData.products, async () => {
    return await supabaseService.products.getAllWithStock();
  }));

  // Skip transactional entities (sales, transfers, returns) - manual validation required

  const allMatch = validations.every(v => v.match);

  return {
    timestamp: new Date().toISOString(),
    validations,
    allMatch,
  };
}

async function validateEntity<T extends { id: string }>(
  name: string,
  localData: T[],
  fetchRemote: () => Promise<T[]>
): Promise<ValidationResult> {
  console.log(`[VALIDATION] Validating ${name}...`);

  const remoteData = await fetchRemote();
  const localIds = new Set(localData.map(item => item.id));
  const remoteIds = new Set(remoteData.map(item => item.id));

  const missing = localData.filter(item => !remoteIds.has(item.id)).map(item => item.id);
  const extra = remoteData.filter(item => !localIds.has(item.id)).map(item => item.id);

  const match = missing.length === 0 && extra.length === 0;

  const result: ValidationResult = {
    entity: name,
    localCount: localData.length,
    remoteCount: remoteData.length,
    match,
    missing,
    extra,
  };

  if (match) {
    console.log(`  ✓ ${name}: All ${localData.length} items match`);
  } else {
    console.warn(`  ⚠ ${name}: Mismatch detected`);
    if (missing.length > 0) console.warn(`    Missing in remote: ${missing.length}`);
    if (extra.length > 0) console.warn(`    Extra in remote: ${extra.length}`);
  }

  return result;
}

/**
 * Compare local and remote data sources
 */
async function compareSources(): Promise<ComparisonReport> {
  return await validateMigration();
}

// ==================== ROLLBACK FUNCTIONS ====================

/**
 * Rollback migration by restoring from localStorage backup
 */
async function rollbackMigration(): Promise<{ success: boolean; message: string }> {
  console.log('[ROLLBACK] Starting migration rollback...');

  const backup = dataService.restoreBackup();
  if (!backup) {
    return {
      success: false,
      message: 'No backup found. Cannot rollback.',
    };
  }

  console.log('[ROLLBACK] Backup found from:', backup.timestamp);
  console.log('[ROLLBACK] Note: This only restores localStorage. Supabase data remains.');
  console.log('[ROLLBACK] To fully rollback, disable Supabase feature flags.');

  // Restore to localStorage
  dataService.save(KEYS.WAREHOUSES, backup.data.warehouses);
  dataService.save(KEYS.CUSTOMERS, backup.data.customers);
  dataService.save(KEYS.USERS, backup.data.users);
  dataService.save(KEYS.PRODUCTS, backup.data.products);
  dataService.save(KEYS.SALES, backup.data.sales);
  dataService.save(KEYS.TRANSFERS, backup.data.transfers);
  dataService.save(KEYS.RETURNS, backup.data.returns);
  dataService.save(KEYS.AUDIT_LOGS, backup.data.auditLogs);
  if (backup.data.settings) {
    dataService.save(KEYS.SETTINGS, backup.data.settings);
  }

  return {
    success: true,
    message: `Rollback complete. Data restored from ${backup.timestamp}`,
  };
}

// ==================== EXPORT ====================

export const migrationUtils = {
  migrateAllData,
  validateMigration,
  compareSources,
  rollbackMigration,
  loadAllLocalData,
};

// ==================== HELPER: EXPORT TO SQL ====================

/**
 * Generate SQL INSERT statements for manual import
 * Useful for transactional entities (sales, transfers, returns)
 */
export function generateSQLInserts(entity: string, data: any[]): string {
  console.log(`[SQL EXPORT] Generating INSERT statements for ${entity}...`);

  // This is a placeholder - actual implementation would need to:
  // 1. Convert app types to DB types
  // 2. Generate proper SQL INSERT statements
  // 3. Handle foreign keys and dependencies

  return `-- SQL INSERT statements for ${entity}\n-- Total records: ${data.length}\n-- Generated: ${new Date().toISOString()}\n\n-- Manual SQL import recommended for transactional data`;
}
