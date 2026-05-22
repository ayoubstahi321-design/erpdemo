/**
 * Customer Migration Script
 *
 * Migrates customer data from localStorage to Supabase PostgreSQL
 *
 * Usage from browser console:
 *   await window.migrateCustomers()
 */

import { dataService, KEYS } from '../services/dataService';
import { supabaseService } from '../services/supabaseService';
import { Customer } from '../types';

interface MigrationReport {
  timestamp: string;
  migrated: number;
  skipped: number;
  errors: string[];
  duration: number;
}

export async function migrateCustomers(): Promise<MigrationReport> {
  const startTime = Date.now();
  const results = { migrated: 0, skipped: 0, errors: [] as string[] };

  console.log('\n🚀 ===== CUSTOMER MIGRATION TO SUPABASE ===== 🚀\n');

  // Load customers from localStorage
  const customers = dataService.load<Customer[]>(KEYS.CUSTOMERS, []);
  console.log(`📦 Found ${customers.length} customers in localStorage\n`);

  if (customers.length === 0) {
    console.log('⚠️  No customers to migrate\n');
    return {
      timestamp: new Date().toISOString(),
      ...results,
      duration: Date.now() - startTime,
    };
  }

  // Create backup
  const backup = dataService.createBackup({ 
    customers,
    products: [],
    sales: [],
    users: [],
    transfers: [],
    returns: [],
    warehouses: [],
    auditLogs: []
  });
  if (!backup.success) {
    throw new Error('Failed to create backup');
  }
  console.log(`💾 Backup created: ${backup.timestamp}\n`);

  // Migrate each customer
  for (const customer of customers) {
    try {
      // Check if already exists
      const existing = await supabaseService.customers.getById(customer.id);
      if (existing) {
        console.log(`⏭️  Skipped: ${customer.name} (already exists)`);
        results.skipped++;
      } else {
        await supabaseService.customers.create(customer);
        console.log(`✅ Migrated: ${customer.name}`);
        results.migrated++;
      }
    } catch (error: any) {
      const errorMsg = `${customer.name}: ${error.message}`;
      console.error(`❌ Error: ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n📊 ===== MIGRATION SUMMARY ===== 📊\n');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Migrated: ${results.migrated}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Errors: ${results.errors.length}\n`);

  if (results.errors.length > 0) {
    console.log('⚠️  ERRORS:\n', results.errors);
  }

  if (results.migrated > 0) {
    console.log('🎉 Migration completed! Refresh the page to see data from Supabase.\n');
  }

  return {
    timestamp: new Date().toISOString(),
    ...results,
    duration,
  };
}

// Make available globally
declare global {
  interface Window {
    migrateCustomers: typeof migrateCustomers;
  }
}

if (typeof window !== 'undefined') {
  window.migrateCustomers = migrateCustomers;
}
