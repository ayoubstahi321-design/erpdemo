/**
 * GitHub Actions Backup Script
 * Connects to Supabase and exports all tables as compressed JSON.
 * Designed to run in GitHub Actions with secrets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Uses service role key to bypass RLS and read all tables.
 *
 * Usage: node scripts/github-backup.mjs
 * Output: backups/azmol-erp-backup-<timestamp>.gz
 */

import { createClient } from '@supabase/supabase-js';
import { gzipSync } from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Read from env (GitHub Secrets)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Need SUPABASE_URL (or VITE_SUPABASE_URL) and SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// All tables to back up (same as in-app backup, version 3.0)
const TABLES = [
  'products',
  'sales',
  'sale_items',
  'payments',
  'customers',
  'warehouses',
  'stock_levels',
  'transfers',
  'transfer_items',
  'returns',
  'return_items',
  'document_counters',
  'profiles',
  'audit_logs',
];

async function fetchTable(name, limit) {
  const query = supabase.from(name).select('*');
  if (limit) query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.warn(`  Warning: ${name} -> ${error.message}`);
    return [];
  }
  return data || [];
}

async function main() {
  console.log('Starting GitHub Actions backup...');

  const tables = {};
  for (const name of TABLES) {
    const limit = name === 'audit_logs' ? 1000 : undefined;
    tables[name] = await fetchTable(name, limit);
    console.log(`  ${name}: ${tables[name].length} records`);
  }

  const backup = {
    version: '3.0',
    timestamp: new Date().toISOString(),
    tables,
    metadata: {
      source: 'github-actions',
      app_version: '1.0.0',
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const compressed = gzipSync(json, { level: 9 });

  // Write to backups/ directory
  const outDir = path.join(ROOT, 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `azmol-erp-backup-${ts}.gz`;
  const outPath = path.join(outDir, filename);

  fs.writeFileSync(outPath, compressed);

  const sizeMB = (compressed.length / 1024 / 1024).toFixed(2);
  console.log(`Backup saved: ${filename} (${sizeMB} MB)`);

  // Write summary for GitHub Actions
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = [
      '## Backup Summary',
      `| Table | Records |`,
      `|-------|---------|`,
      ...TABLES.map(t => `| ${t} | ${tables[t].length} |`),
      '',
      `**File:** \`${filename}\``,
      `**Size:** ${sizeMB} MB`,
      `**Timestamp:** ${backup.timestamp}`,
    ];
    fs.appendFileSync(summary, lines.join('\n'));
  }
}

main().catch(err => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
