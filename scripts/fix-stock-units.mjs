/**
 * fix-stock-units.mjs
 *
 * Fixes stock_levels where quantity is stored as BOXES instead of UNITS.
 * Pattern: old transfers (boxes_entered IS NULL) stored box count in quantity.
 * Fix: multiply by units_per_box for all affected rows.
 *
 * Run: node scripts/fix-stock-units.mjs
 * Run dry-run: node scripts/fix-stock-units.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mkehxermgmdqsogmlaqq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZWh4ZXJtZ21kcXNvZ21sYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTY5NTk3MiwiZXhwIjoyMDgxMjcxOTcyfQ.I3cGTLcMTXmCi__zttVNb8S1HYVKal6E4QBlooIqD-Q';

const isDryRun = process.argv.includes('--dry-run');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log(isDryRun ? '=== DRY RUN (no changes will be made) ===' : '=== LIVE RUN — applying fixes ===');
  console.log('');

  // Step 1: Get all products with units_per_box > 1
  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, sku, name, units_per_box')
    .gt('units_per_box', 1);

  if (prodError) throw prodError;
  console.log(`Found ${products.length} products with units_per_box > 1\n`);

  // Step 2: For each product, get transfers (boxes_entered IS NULL, Completed)
  // and compare with current stock_levels
  const fixes = [];

  for (const product of products) {
    // Get all warehouses that have stock for this product
    const { data: stockRows, error: stockError } = await supabase
      .from('stock_levels')
      .select('warehouse_id, quantity')
      .eq('product_id', product.id)
      .gt('quantity', 0);

    if (stockError) throw stockError;
    if (!stockRows || stockRows.length === 0) continue;

    for (const stockRow of stockRows) {
      // Get net old transfers (boxes_entered IS NULL) for this product + warehouse
      const { data: transfers, error: tError } = await supabase
        .from('transfer_items')
        .select(`
          quantity,
          transfers!inner(
            to_warehouse_id,
            from_warehouse_id,
            status
          )
        `)
        .eq('product_id', product.id)
        .is('boxes_entered', null)
        .eq('transfers.status', 'Completed')
        .or(`to_warehouse_id.eq.${stockRow.warehouse_id},from_warehouse_id.eq.${stockRow.warehouse_id}`, { foreignTable: 'transfers' });

      if (tError) throw tError;
      if (!transfers || transfers.length === 0) continue;

      // Calculate net
      let netBoxes = 0;
      for (const t of transfers) {
        const tr = t.transfers;
        if (tr.to_warehouse_id === stockRow.warehouse_id) {
          netBoxes += t.quantity;
        } else {
          netBoxes -= t.quantity;
        }
      }

      if (netBoxes <= 0) continue;

      // Check if current stock matches the net boxes count exactly
      if (stockRow.quantity === netBoxes) {
        const corrected = netBoxes * product.units_per_box;
        fixes.push({
          product_id: product.id,
          warehouse_id: stockRow.warehouse_id,
          name: product.name,
          ref: product.sku,
          units_per_box: product.units_per_box,
          old_quantity: stockRow.quantity,
          new_quantity: corrected,
        });
      }
    }
  }

  console.log(`\n=== ${fixes.length} rows to fix ===\n`);

  for (const fix of fixes) {
    console.log(`  ${fix.ref} | ${fix.name}`);
    console.log(`    Warehouse: ${fix.warehouse_id}`);
    console.log(`    ${fix.old_quantity} boxes × ${fix.units_per_box} upb = ${fix.new_quantity} units`);
    console.log('');
  }

  if (isDryRun) {
    console.log('DRY RUN complete. Run without --dry-run to apply changes.');
    return;
  }

  if (fixes.length === 0) {
    console.log('Nothing to fix. All stock_levels appear correct.');
    return;
  }

  // Apply fixes
  console.log('\n=== Applying fixes... ===\n');
  let successCount = 0;
  let errorCount = 0;

  for (const fix of fixes) {
    const { error } = await supabase
      .from('stock_levels')
      .update({ quantity: fix.new_quantity })
      .eq('product_id', fix.product_id)
      .eq('warehouse_id', fix.warehouse_id);

    if (error) {
      console.error(`  ❌ FAILED: ${fix.ref} - ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ✅ Fixed: ${fix.ref} | ${fix.name} → ${fix.new_quantity} units`);
      successCount++;
    }
  }

  console.log(`\n=== Done: ${successCount} fixed, ${errorCount} errors ===`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
