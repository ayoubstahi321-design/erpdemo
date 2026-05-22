/**
 * Product Migration Script
 *
 * Migrates product data (including stock levels) from localStorage to Supabase PostgreSQL
 *
 * Usage from browser console:
 *   await window.migrateProducts()
 */

import { dataService, KEYS } from '../services/dataService';
import { supabaseService } from '../services/supabaseService';
import { Product } from '../types';

interface MigrationReport {
  timestamp: string;
  migrated: number;
  skipped: number;
  errors: string[];
  duration: number;
}

export async function migrateProducts(): Promise<MigrationReport> {
  const startTime = Date.now();
  const results = { migrated: 0, skipped: 0, errors: [] as string[] };

  console.log('\n🚀 ===== PRODUCT MIGRATION TO SUPABASE ===== 🚀\n');

  // Load products from localStorage
  const products = dataService.load<Product[]>(KEYS.PRODUCTS, []);
  console.log(`📦 Found ${products.length} products in localStorage\n`);

  if (products.length === 0) {
    console.log('⚠️  No products to migrate\n');
    return {
      timestamp: new Date().toISOString(),
      ...results,
      duration: Date.now() - startTime,
    };
  }

  // Create backup
  const backup = dataService.createBackup({ 
    products,
    customers: [],
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

  // Migrate each product
  for (const product of products) {
    try {
      // Check if already exists
      const existing = await supabaseService.products.getById(product.id);
      if (existing) {
        console.log(`⏭️  Skipped: ${product.name} (already exists)`);
        results.skipped++;
      } else {
        // Create product with stock levels
        // The service will handle normalizing stockLevels into stock_levels table
        await supabaseService.products.create(product);

        const stockLevels = product.stockLevels || {};
        const totalStock = Object.values(stockLevels).reduce((a, b) => a + b, 0);
        console.log(`✅ Migrated: ${product.name} (SKU: ${product.sku}, Stock: ${totalStock})`);
        results.migrated++;
      }
    } catch (error: any) {
      const errorMsg = `${product.name}: ${error.message}`;
      console.error(`❌ Error: ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }

  const duration = Date.now() - startTime;

  console.log('\n📊 ===== MIGRATION SUMMARY ===== 📊\n');
  console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log(`✅ Migrated: ${results.migrated} products`);
  console.log(`⏭️  Skipped: ${results.skipped} products`);
  console.log(`❌ Errors: ${results.errors.length}\n`);

  if (results.errors.length > 0) {
    console.log('⚠️  ERRORS:\n', results.errors);
  }

  if (results.migrated > 0) {
    console.log('🎉 Migration completed! Refresh the page to see data from Supabase.\n');
    console.log('💡 TIP: Products include normalized stock levels across warehouses.\n');
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
    migrateProducts: typeof migrateProducts;
  }
}

if (typeof window !== 'undefined') {
  window.migrateProducts = migrateProducts;
}
