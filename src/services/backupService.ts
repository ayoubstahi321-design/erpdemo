/**
 * Backup Service
 * Handles backup and restore operations for the ERP system
 */

import { supabase } from './supabaseClient';
import pako from 'pako';

export interface BackupData {
  version: string;
  timestamp: string;
  tables: {
    products: any[];
    sales: any[];
    sale_items: any[];
    payments: any[];
    customers: any[];
    warehouses: any[];
    stock_levels: any[];
    transfers: any[];
    transfer_items: any[];
    returns: any[];
    return_items: any[];
    document_counters: any[];
    profiles: any[];
    audit_logs: any[];
  };
  metadata: {
    user_email?: string;
    app_version?: string;
  };
}

/**
 * Creates a complete backup of all Supabase data
 */
export async function createBackup(userEmail?: string): Promise<{ success: boolean; data?: Blob; error?: string }> {
  try {
    console.log('🔄 Starting backup process...');

    // Fetch all tables in parallel
    const [
      productsRes,
      salesRes,
      saleItemsRes,
      paymentsRes,
      customersRes,
      warehousesRes,
      stockLevelsRes,
      transfersRes,
      transferItemsRes,
      returnsRes,
      returnItemsRes,
      documentCountersRes,
      profilesRes,
      auditLogsRes,
    ] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('sale_items').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('warehouses').select('*'),
      supabase.from('stock_levels').select('*'),
      supabase.from('transfers').select('*'),
      supabase.from('transfer_items').select('*'),
      supabase.from('returns').select('*'),
      supabase.from('return_items').select('*'),
      supabase.from('document_counters').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('audit_logs').select('*').limit(1000),
    ]);

    // Check for errors
    const errors = [
      productsRes, salesRes, saleItemsRes, paymentsRes, customersRes, warehousesRes,
      stockLevelsRes, transfersRes, transferItemsRes, returnsRes, returnItemsRes,
      documentCountersRes, profilesRes, auditLogsRes
    ].filter(res => res.error);

    if (errors.length > 0) {
      console.error('❌ Backup failed:', errors);
      return { success: false, error: `Failed to fetch data: ${errors[0].error?.message}` };
    }

    // Create backup object
    const backup: BackupData = {
      version: '3.0',
      timestamp: new Date().toISOString(),
      tables: {
        products: productsRes.data || [],
        sales: salesRes.data || [],
        sale_items: saleItemsRes.data || [],
        payments: paymentsRes.data || [],
        customers: customersRes.data || [],
        warehouses: warehousesRes.data || [],
        stock_levels: stockLevelsRes.data || [],
        transfers: transfersRes.data || [],
        transfer_items: transferItemsRes.data || [],
        returns: returnsRes.data || [],
        return_items: returnItemsRes.data || [],
        document_counters: documentCountersRes.data || [],
        profiles: profilesRes.data || [],
        audit_logs: auditLogsRes.data || [],
      },
      metadata: {
        user_email: userEmail,
        app_version: '1.0.0',
      },
    };

    // Convert to JSON
    const jsonString = JSON.stringify(backup, null, 2);
    console.log(`📊 Backup size: ${(jsonString.length / 1024).toFixed(2)} KB`);

    // Compress with gzip
    const compressed = pako.gzip(jsonString);
    console.log(`📦 Compressed size: ${(compressed.length / 1024).toFixed(2)} KB`);

    // Create blob
    const blob = new Blob([compressed], { type: 'application/gzip' });

    console.log('✅ Backup created successfully');
    return { success: true, data: blob };
  } catch (error: any) {
    console.error('❌ Backup error:', error);
    return { success: false, error: error.message || 'Unknown error during backup' };
  }
}

/**
 * Downloads a backup file to the user's computer
 */
export function downloadBackup(blob: Blob): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `azmol-erp-backup-${timestamp}.gz`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log(`💾 Backup downloaded: ${filename}`);
}

/**
 * Upsert helper: inserts rows in batches, using onConflict to update existing records.
 * Returns the number of successfully upserted rows.
 */
async function upsertTable(
  table: string,
  rows: any[],
  onConflict: string = 'id',
  batchSize: number = 200
): Promise<{ count: number; error?: string }> {
  if (!rows || rows.length === 0) return { count: 0 };

  let upserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false });

    if (error) {
      console.error(`❌ Error upserting ${table} (batch ${i / batchSize + 1}):`, error.message);
      return { count: upserted, error: `${table}: ${error.message}` };
    }
    upserted += batch.length;
  }
  return { count: upserted };
}

/**
 * Restores data from a backup file.
 * Uses upsert (insert or update on conflict) in foreign-key-safe order.
 * Skips profiles and audit_logs (sensitive system data).
 */
export async function restoreBackup(file: File): Promise<{ success: boolean; error?: string; stats?: Record<string, number> }> {
  try {
    console.log('🔄 Starting restore process...');

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Decompress
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });
    const backup: BackupData = JSON.parse(decompressed);

    console.log('📦 Backup loaded:', {
      version: backup.version,
      timestamp: backup.timestamp,
      tables: Object.keys(backup.tables).length,
    });

    // Validate backup structure
    if (!backup.version || !backup.timestamp || !backup.tables) {
      return { success: false, error: 'Invalid backup file format' };
    }

    const stats: Record<string, number> = {};
    const errors: string[] = [];

    // Restore in foreign-key-safe order:
    // 1. Independent tables first (no FK dependencies)
    // 2. Then dependent tables
    const restoreOrder: { table: string; key: keyof BackupData['tables']; onConflict: string }[] = [
      { table: 'warehouses',         key: 'warehouses',         onConflict: 'id' },
      { table: 'customers',          key: 'customers',          onConflict: 'id' },
      { table: 'products',           key: 'products',           onConflict: 'id' },
      { table: 'document_counters',  key: 'document_counters',  onConflict: 'id' },
      { table: 'stock_levels',       key: 'stock_levels',       onConflict: 'id' },
      { table: 'sales',              key: 'sales',              onConflict: 'id' },
      { table: 'sale_items',         key: 'sale_items',         onConflict: 'id' },
      { table: 'payments',           key: 'payments',           onConflict: 'id' },
      { table: 'transfers',          key: 'transfers',          onConflict: 'id' },
      { table: 'transfer_items',     key: 'transfer_items',     onConflict: 'id' },
      { table: 'returns',            key: 'returns',            onConflict: 'id' },
      { table: 'return_items',       key: 'return_items',       onConflict: 'id' },
    ];

    for (const { table, key, onConflict } of restoreOrder) {
      const rows = backup.tables[key];
      if (!rows || rows.length === 0) {
        stats[table] = 0;
        continue;
      }

      console.log(`📥 Restoring ${table}: ${rows.length} records...`);
      const result = await upsertTable(table, rows, onConflict);
      stats[table] = result.count;

      if (result.error) {
        errors.push(result.error);
        console.error(`⚠️ Partial restore for ${table}: ${result.count}/${rows.length}`);
      } else {
        console.log(`✅ ${table}: ${result.count} records restored`);
      }
    }

    if (errors.length > 0) {
      console.warn('⚠️ Restore completed with errors:', errors);
      return {
        success: true,
        error: `Restored with ${errors.length} warning(s): ${errors[0]}`,
        stats,
      };
    }

    console.log('✅ Restore completed successfully', stats);
    return { success: true, stats };
  } catch (error: any) {
    console.error('❌ Restore error:', error);
    return { success: false, error: error.message || 'Unknown error during restore' };
  }
}

/**
 * Validates a backup file without restoring
 */
export async function validateBackup(file: File): Promise<{ valid: boolean; info?: any; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const decompressed = pako.ungzip(uint8Array, { to: 'string' });
    const backup: BackupData = JSON.parse(decompressed);

    return {
      valid: true,
      info: {
        version: backup.version,
        timestamp: backup.timestamp,
        recordCount: {
          products: backup.tables.products?.length || 0,
          sales: backup.tables.sales?.length || 0,
          payments: backup.tables.payments?.length || 0,
          customers: backup.tables.customers?.length || 0,
          warehouses: backup.tables.warehouses?.length || 0,
          stock_levels: backup.tables.stock_levels?.length || 0,
          document_counters: backup.tables.document_counters?.length || 0,
        },
        metadata: backup.metadata,
      },
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
