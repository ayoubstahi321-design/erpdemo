/**
 * Script automatizado para reemplazar console.* con logger.*
 * Procesa archivos TypeScript/TSX y agrega imports necesarios
 */

import * as fs from 'fs';
import * as path from 'path';

// Archivos objetivo (basado en grep anterior)
const TARGET_FILES = [
  'src/hooks/useRealtime.ts',
  'src/hooks/useSessionMonitor.ts',
  'src/utils/registerSW.ts',
  'src/services/dataService.ts',
  'src/utils/csvImportExport.ts',
  'src/hooks/useLocalStorage.ts',
  'src/components/Dashboard.tsx',
  'src/services/supabaseService.ts',
  'src/services/supabaseClient.ts',
  'src/services/aiService.ts',
  'src/components/PrintableDocument.tsx',
  'src/services/discountService.ts',
  'src/hooks/useCSVExport.ts',
  'src/hooks/useCameraScanner.ts',
  'src/components/Layout.tsx',
  'src/components/Inventory.tsx',
  'src/components/AIAssistant.tsx',
];

interface ConsoleReplacement {
  from: RegExp;
  to: (match: string, ...args: any[]) => string;
}

// Mapeo de console.X a logger.X
const REPLACEMENTS: ConsoleReplacement[] = [
  // console.log() → logger.debug()
  {
    from: /console\.log\((.*?)\);?/g,
    to: (match, args) => `logger.debug(${args});`
  },
  // console.warn() → logger.warn()
  {
    from: /console\.warn\((.*?)\);?/g,
    to: (match, args) => `logger.warn(${args});`
  },
  // console.error() → logger.error()
  {
    from: /console\.error\((.*?)\);?/g,
    to: (match, args) => `logger.error(${args});`
  },
  // console.info() → logger.info()
  {
    from: /console\.info\((.*?)\);?/g,
    to: (match, args) => `logger.info(${args});`
  },
  // console.debug() → logger.debug()
  {
    from: /console\.debug\((.*?)\);?/g,
    to: (match, args) => `logger.debug(${args});`
  },
];

function addLoggerImport(content: string): string {
  // Check if logger import already exists
  if (content.includes("import { logger }")) {
    return content;
  }

  // Find the last import statement
  const importRegex = /^import .+from .+;$/gm;
  const imports = content.match(importRegex);

  if (imports && imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    const lastImportIndex = content.lastIndexOf(lastImport);
    const insertPosition = lastImportIndex + lastImport.length;

    return (
      content.slice(0, insertPosition) +
      "\nimport { logger } from '../utils/logger';" +
      content.slice(insertPosition)
    );
  }

  // If no imports found, add at the beginning
  return "import { logger } from '../utils/logger';\n" + content;
}

function processFile(filePath: string): void {
  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Archivo no encontrado: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  let changeCount = 0;

  // Apply all replacements
  REPLACEMENTS.forEach(({ from, to }) => {
    const matches = content.match(from);
    if (matches) {
      changeCount += matches.length;
      content = content.replace(from, to);
    }
  });

  if (changeCount === 0) {
    console.log(`✓ ${filePath} - Ya está limpio`);
    return;
  }

  // Add logger import if needed
  content = addLoggerImport(content);

  // Write back to file
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`✅ ${filePath} - ${changeCount} console.* reemplazados`);
}

function main() {
  console.log('🧹 Iniciando limpieza automatizada de console.logs...\n');

  let totalFiles = 0;
  let totalReplacements = 0;

  TARGET_FILES.forEach(file => {
    try {
      processFile(file);
      totalFiles++;
    } catch (error) {
      console.error(`❌ Error procesando ${file}:`, error);
    }
  });

  console.log(`\n✨ Limpieza completada:`);
  console.log(`   - Archivos procesados: ${totalFiles}`);
  console.log(`   - Total de reemplazos: ${totalReplacements}`);
}

main();
