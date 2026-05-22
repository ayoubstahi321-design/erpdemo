#!/usr/bin/env node
/**
 * 🧪 SUITE DE TESTING GLOBAL COMPLETO
 * 
 * Ejecuta todos los tests posibles para validar el sistema
 * después de aplicar mejoras
 * 
 * Uso: npm run test:global
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  log('\n' + '═'.repeat(60), 'cyan');
  log(`  ${title}`, 'bright');
  log('═'.repeat(60) + '\n', 'cyan');
}

function run(command, continueOnError = false) {
  try {
    execSync(command, { stdio: 'inherit', encoding: 'utf-8' });
    return true;
  } catch (error) {
    if (!continueOnError) {
      throw error;
    }
    return false;
  }
}

const results = {
  startTime: new Date(),
  tests: [],
  passed: 0,
  failed: 0,
  skipped: 0
};

function test(name, command, { critical = false, skip = false } = {}) {
  const icon = critical ? '🔴' : '⚪';
  log(`\n${icon} ${name}...`, 'cyan');
  
  if (skip) {
    log('⊘ OMITIDO', 'yellow');
    results.tests.push({ name, status: 'SKIP' });
    results.skipped++;
    return null;
  }

  const startTime = Date.now();
  const success = run(command, !critical);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  if (success) {
    log(`✅ PASADO (${duration}s)`, 'green');
    results.tests.push({ name, status: 'PASS', duration });
    results.passed++;
  } else {
    log(`❌ FALLIDO (${duration}s)`, 'red');
    results.tests.push({ name, status: 'FAIL', duration });
    results.failed++;
    if (critical) {
      throw new Error(`Test crítico fallido: ${name}`);
    }
  }
  
  return success;
}

async function main() {
  log('\n🚀 INICIANDO SUITE DE TESTING GLOBAL', 'bright');
  log('    Validación completa del sistema después de mejoras\n', 'cyan');

  try {
    // ========================================
    // FASE 1: VALIDACIÓN DE CÓDIGO
    // ========================================
    section('FASE 1: VALIDACIÓN DE CÓDIGO');
    
    test(
      '1.1 ESLint - Calidad de código',
      'npm run lint',
      { critical: false }
    );
    
    test(
      '1.2 TypeScript - Type checking',
      'npx tsc --noEmit',
      { critical: true }
    );

    // ========================================
    // FASE 2: TESTS UNITARIOS
    // ========================================
    section('FASE 2: TESTS UNITARIOS');
    
    test(
      '2.1 Tests de utilidades (pricing, fuzzySearch)',
      'npm run test -- --run src/utils/__tests__',
      { critical: true }
    );
    
    test(
      '2.2 Tests de hooks (usePagination)',
      'npm run test -- --run src/hooks/__tests__',
      { critical: false }
    );
    
    test(
      '2.3 Tests de servicios (supabaseService)',
      'npm run test -- --run src/services/__tests__',
      { critical: false } // Puede fallar si no hay mock correcto
    );

    // ========================================
    // FASE 3: TESTS DE INTEGRACIÓN
    // ========================================
    section('FASE 3: TESTS DE INTEGRACIÓN');
    
    log('\n⚠️  NOTA: Tests de integración requieren conexión a Supabase', 'yellow');
    log('   Si fallan, verifica tus variables de entorno\n', 'yellow');
    
    test(
      '3.1 Flujo completo de negocio',
      'npm run test -- --run src/test/integration.test.ts',
      { critical: false, skip: false }
    );

    // ========================================
    // FASE 4: BUILD Y DEPLOYMENT
    // ========================================
    section('FASE 4: BUILD Y DEPLOYMENT');
    
    test(
      '4.1 Build de producción',
      'npm run build',
      { critical: true }
    );
    
    test(
      '4.2 Verificar tamaño del bundle',
      'node -e "const stats = require(\'./dist/.vite/manifest.json\'); console.log(\'Bundle size OK\');"',
      { critical: false, skip: true } // Skip por ahora
    );

    // ========================================
    // FASE 5: COBERTURA DE TESTS
    // ========================================
    section('FASE 5: COBERTURA DE TESTS');
    
    test(
      '5.1 Generar reporte de cobertura',
      'npm run test:coverage -- --run',
      { critical: false }
    );

    // ========================================
    // FASE 6: VERIFICACIONES ADICIONALES
    // ========================================
    section('FASE 6: VERIFICACIONES ADICIONALES');
    
    log('\n📋 Verificando archivos críticos...', 'cyan');
    
    const criticalFiles = [
      'src/services/supabaseClient.ts',
      'src/services/supabaseService.ts',
      'src/hooks/useSupabaseData.ts',
      'src/App.tsx',
      'src/main.tsx',
      'supabase-complete-schema.sql',
      '.env.example',
      'package.json',
      'vercel.json'
    ];
    
    let missingFiles = 0;
    criticalFiles.forEach(file => {
      const exists = fs.existsSync(path.join(__dirname, '..', file));
      if (exists) {
        log(`  ✅ ${file}`, 'green');
      } else {
        log(`  ❌ ${file} - NO ENCONTRADO`, 'red');
        missingFiles++;
      }
    });
    
    if (missingFiles > 0) {
      log(`\n⚠️  Faltan ${missingFiles} archivos críticos`, 'yellow');
      results.failed++;
    } else {
      log('\n✅ Todos los archivos críticos presentes', 'green');
      results.passed++;
    }

    // ========================================
    // REPORTE FINAL
    // ========================================
    section('📊 REPORTE FINAL');
    
    const duration = ((new Date() - results.startTime) / 1000).toFixed(2);
    const total = results.passed + results.failed + results.skipped;
    const successRate = total > 0 ? ((results.passed / (results.passed + results.failed)) * 100).toFixed(1) : 0;
    
    log(`⏱️  Tiempo total: ${duration}s`, 'cyan');
    log(`✅ Tests pasados: ${results.passed}`, 'green');
    log(`❌ Tests fallidos: ${results.failed}`, 'red');
    log(`⊘ Tests omitidos: ${results.skipped}`, 'yellow');
    log(`📈 Tasa de éxito: ${successRate}%\n`, 'bright');

    // Detalle por test
    log('Detalle de resultados:\n', 'bright');
    results.tests.forEach(({ name, status, duration }) => {
      const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⊘';
      const time = duration ? ` (${duration}s)` : '';
      log(`${icon} ${name}${time}`);
    });

    // Guardar reporte JSON
    const reportPath = path.join(__dirname, '..', 'test-global-report.json');
    const report = {
      ...results,
      duration: parseFloat(duration),
      successRate: parseFloat(successRate),
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Reporte guardado en: test-global-report.json`, 'cyan');

    // Verificar cobertura si existe
    const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
      const total = coverage.total;
      
      log('\n📊 COBERTURA DE TESTS:', 'bright');
      log(`   Líneas: ${total.lines.pct}%`, total.lines.pct >= 70 ? 'green' : 'yellow');
      log(`   Funciones: ${total.functions.pct}%`, total.functions.pct >= 70 ? 'green' : 'yellow');
      log(`   Branches: ${total.branches.pct}%`, total.branches.pct >= 65 ? 'green' : 'yellow');
      log(`   Statements: ${total.statements.pct}%`, total.statements.pct >= 70 ? 'green' : 'yellow');
      
      if (total.lines.pct < 70) {
        log('\n⚠️  Cobertura de líneas por debajo del objetivo (70%)', 'yellow');
      } else {
        log('\n✅ Cobertura de tests cumple con los objetivos', 'green');
      }
    }

    // Recomendaciones
    log('\n💡 RECOMENDACIONES:', 'bright');
    
    if (results.failed > 0) {
      log('   🔴 Hay tests fallidos - revisar arriba para detalles', 'red');
      log('   → Prioridad: Arreglar tests fallidos antes de producción', 'yellow');
    }
    
    if (successRate < 80) {
      log('   ⚠️  Tasa de éxito < 80% - mejorar cobertura', 'yellow');
    }
    
    if (results.failed === 0 && successRate >= 90) {
      log('   🎉 ¡Sistema validado! Listo para testing manual', 'green');
      log('   → Siguiente paso: Ejecutar TESTING-GUIDE.md (checklist manual)', 'cyan');
    }

    // Exit code
    if (results.failed > 0) {
      log('\n⚠️  ATENCIÓN: Algunos tests fallaron', 'yellow');
      log('   Revisa los errores arriba antes de continuar\n', 'yellow');
      process.exit(1);
    } else {
      log('\n🎉 ¡TODOS LOS TESTS PASARON!', 'green');
      log('   El sistema está técnicamente validado\n', 'green');
      process.exit(0);
    }

  } catch (error) {
    log('\n❌ ERROR CRÍTICO:', 'red');
    log(`   ${error.message}\n`, 'red');
    process.exit(1);
  }
}

// Ejecutar
main();
