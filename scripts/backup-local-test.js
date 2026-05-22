/**
 * ============================================
 * TEST LOCAL DE BACKUP - AZMOL ERP
 * ============================================
 *
 * Prueba el sistema de backup SIN subir a Google Drive
 * Útil para verificar que todo funciona antes de configurar Drive
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import zlib from 'zlib'
import crypto from 'crypto'

// Configurar rutas y cargar variables de entorno
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env.backup') })

const CONFIG = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  backup: {
    encryption: {
      algorithm: 'aes-256-gcm',
      key: process.env.BACKUP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
    }
  },
  paths: {
    temp: 'C:\\Users\\basma\\Desktop\\azmol backup'
  }
}

// ============================================
// CIFRADO
// ============================================

async function encryptFile(inputPath, outputPath) {
  const key = Buffer.from(CONFIG.backup.encryption.key, 'hex')
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(CONFIG.backup.encryption.algorithm, key, iv)

  const input = await fs.readFile(inputPath)
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
  const authTag = cipher.getAuthTag()

  const output = Buffer.concat([iv, authTag, encrypted])
  await fs.writeFile(outputPath, output)

  console.log(`🔒 Archivo cifrado: ${path.basename(outputPath)}`)
  return outputPath
}

async function decryptFile(inputPath, outputPath) {
  const key = Buffer.from(CONFIG.backup.encryption.key, 'hex')
  const data = await fs.readFile(inputPath)

  const iv = data.slice(0, 16)
  const authTag = data.slice(16, 32)
  const encrypted = data.slice(32)

  const decipher = crypto.createDecipheriv(CONFIG.backup.encryption.algorithm, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  await fs.writeFile(outputPath, decrypted)

  console.log(`🔓 Archivo descifrado: ${path.basename(outputPath)}`)
  return outputPath
}

// ============================================
// BACKUP DE BASE DE DATOS
// ============================================

async function backupDatabase() {
  console.log(`\n📦 Iniciando backup de base de datos...\n`)

  await fs.mkdir(CONFIG.paths.temp, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `azmol-db-test-${timestamp}.json`
  const filepath = path.join(CONFIG.paths.temp, filename)

  try {
    const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey)

    const tables = [
      'warehouses',
      'customers',
      'products',
      'sales',
      'sale_items',
      'users',
      'stock_levels',
      'payments',
      'settings',
      'transfers',
      'transfer_items',
      'returns',
      'return_items',
      'audit_logs',
      'price_history',
      'volume_discounts',
      'customer_discounts',
      'promotions'
    ]

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        type: 'test',
        version: '1.0.0',
        database: 'azmol-erp'
      },
      data: {}
    }

    let totalRecords = 0

    for (const table of tables) {
      console.log(`  📋 Exportando ${table}...`)

      let allData = []
      let page = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) {
          // Si la tabla no existe, continuar con la siguiente
          if (error.code === 'PGRST116' || error.code === '42P01' || error.code === 'PGRST205') {
            console.log(`  ⚠️  Tabla ${table} no existe, omitiendo...`)
            break
          }
          console.error(`  ❌ Error en tabla ${table}:`, error)
          break // Continuar con siguiente tabla en lugar de lanzar error
        }

        if (!data || data.length === 0) break

        allData = allData.concat(data)

        if (data.length < pageSize) break
        page++
      }

      backup.data[table] = allData
      totalRecords += allData.length
      console.log(`  ✅ ${table}: ${allData.length} registros`)
    }

    // Guardar JSON
    await fs.writeFile(filepath, JSON.stringify(backup, null, 2))
    const stats = await fs.stat(filepath)
    console.log(`\n✅ JSON exportado: ${filename}`)
    console.log(`   Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Total registros: ${totalRecords}`)

    // Comprimir
    const input = await fs.readFile(filepath)
    const compressed = zlib.gzipSync(input, { level: 9 })
    const gzipPath = `${filepath}.gz`
    await fs.writeFile(gzipPath, compressed)
    const compressionRatio = ((1 - compressed.length / stats.size) * 100).toFixed(1)
    console.log(`\n✅ Comprimido: ${filename}.gz`)
    console.log(`   Tamaño: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Compresión: ${compressionRatio}% reducción`)

    // Cifrar
    const encryptedPath = `${gzipPath}.enc`
    await encryptFile(gzipPath, encryptedPath)
    const encStats = await fs.stat(encryptedPath)
    console.log(`   Tamaño cifrado: ${(encStats.size / 1024 / 1024).toFixed(2)} MB`)

    // Verificar integridad
    console.log(`\n🔍 Verificando integridad...`)
    const tempDecrypted = `${encryptedPath}.verify`
    await decryptFile(encryptedPath, tempDecrypted)
    const decryptedData = await fs.readFile(tempDecrypted)

    if (Buffer.compare(compressed, decryptedData) === 0) {
      console.log(`✅ Integridad verificada correctamente`)
    } else {
      throw new Error('Fallo en verificación de integridad')
    }

    await fs.unlink(tempDecrypted)

    // Limpiar archivos intermedios (mantener solo .enc)
    await fs.unlink(filepath).catch(() => {})
    await fs.unlink(gzipPath).catch(() => {})

    console.log(`\n✅ BACKUP LOCAL COMPLETADO\n`)
    console.log(`📁 Archivo guardado en: ${encryptedPath}`)
    console.log(`\n💡 Para restaurar este backup:`)
    console.log(`   node scripts/restore-backup.js restore ${path.basename(encryptedPath)}`)

    return encryptedPath
  } catch (error) {
    console.error('\n❌ ERROR EN BACKUP\n', error)
    throw error
  }
}

// ============================================
// EJECUTAR
// ============================================

backupDatabase().catch(console.error)
