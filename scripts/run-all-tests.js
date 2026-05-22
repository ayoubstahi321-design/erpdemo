#!/usr/bin/env node
/**
 * 🧪 SCRIPT DE TESTING AUTOMATIZADO
 * 
 * Ejecuta una suite completa de tests y genera reporte
 * Uso: node scripts/run-all-tests.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 INICIANDO SUITE COMPLETA DE TESTS\n');
console.log('═══════════════════════════════════════\n');

const results = {
  tests: {},
  startTime: new Date(),
  passed: 0,
  failed: 0
};

function runCommand(name, command, continueOnError = false) {
  console.log(`\n▶️  ${name}...`);
  console.log(`   Comando: ${command}\n`);
  
  try {
    const output = execSync(command, { 
      stdio: 'inherit',
      encoding: 'utf-8'
    });
    
    console.log(`✅ ${name} - PASADO\n`);
    results.tests[name] = { status: 'PASS', time: new Date() };
    results.passed++;
    return true;
  } catch (error) {
    console.error(`❌ ${name} - FALLIDO\n`);
    results.tests[name] = { 
      status: 'FAIL', 
      error: error.message,
      time: new Date()
    };
    results.failed++;
    
    if (!continueOnError) {
      throw error;
    }
    return false;
  }
}

async function main() {
  try {
    // 1. Lint
    runCommand(
      'ESLint - Code Quality',
      'npm run lint',
      true // Continuar si hay warnings
    );

    // 2. Type Check
    runCommand(
      'TypeScript - Type Check',
      'npx tsc --noEmit'
    );

    // 3. Unit Tests
    runCommand(
      'Vitest - Unit Tests',
      'npm run test -- --run --reporter=verbose'
    );

    // 4. Integration Tests
    runCommand(
      'Integration Tests',
      'npm run test -- --run src/test/integration.test.ts',
      true // Puede fallar si no hay conexión a Supabase
    );

    // 5. Build
    runCommand(
      'Vite - Production Build',
      'npm run build'
    );

    // 6. Coverage
    runCommand(
      'Test Coverage Report',
      'npm run test:coverage -- --run --reporter=verbose',
      true
    );

    // Reporte final
    console.log('\n\n═══════════════════════════════════════');
    console.log('📊 RESUMEN DE TESTS');
    console.log('═══════════════════════════════════════\n');
    
    const duration = ((new Date() - results.startTime) / 1000).toFixed(2);
    const total = results.passed + results.failed;
    const successRate = ((results.passed / total) * 100).toFixed(1);
    
    console.log(`⏱️  Tiempo total: ${duration}s`);
    console.log(`✅ Tests pasados: ${results.passed}/${total}`);
    console.log(`❌ Tests fallidos: ${results.failed}/${total}`);
    console.log(`📈 Tasa de éxito: ${successRate}%\n`);

    // Detalle por test
    Object.entries(results.tests).forEach(([name, result]) => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    // Guardar reporte
    const reportPath = path.join(__dirname, '..', 'test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Reporte guardado en: ${reportPath}\n`);

    // Exit code
    if (results.failed > 0) {
      console.log('⚠️  Algunos tests fallaron. Revisar arriba.\n');
      process.exit(1);
    } else {
      console.log('🎉 ¡TODOS LOS TESTS PASARON!\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ ERROR CRÍTICO EN TESTING:\n');
    console.error(error.message);
    process.exit(1);
  }
}

main();
