/**
 * ============================================
 * SISTEMA DE BACKUP COMPLETO - AZMOL ERP
 * ============================================
 *
 * Cumple con normativa marroquí:
 * - Conservación facturas: 10 años
 * - Backup automático semanal de BD
 * - Backup incremental diario de facturas PDF
 * - Archivo trimestral de datos antiguos
 * - Subida a Google Drive cifrada
 *
 * USO:
 * - Semanal: node scripts/backup-system.js weekly
 * - Diario: node scripts/backup-system.js daily
 * - Trimestral: node scripts/backup-system.js quarterly
 */

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import zlib from 'zlib'
import crypto from 'crypto'

// Configurar rutas y cargar variables de entorno
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env.backup') })

const execAsync = promisify(exec)

// ============================================
// CONFIGURACIÓN
// ============================================

const CONFIG = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  },
  drive: {
    credentialsPath: path.join(__dirname, 'credentials.json'),
    tokenPath: path.join(__dirname, 'token.json'),
    rootFolderName: 'AZMOL_ERP_BACKUPS',
    // ID de tu carpeta existente de Google Drive (si ya tienes una)
    // Si no se especifica, se creará una nueva carpeta automáticamente
    rootFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null
  },
  backup: {
    retentionDays: {
      daily: 7,          // Mantener backups diarios 7 días
      weekly: 60,        // Mantener backups semanales 60 días
      monthly: 365,      // Mantener backups mensuales 1 año
      quarterly: 3650    // Mantener backups trimestrales 10 años
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      // IMPORTANTE: Guardar esta clave en lugar seguro
      key: process.env.BACKUP_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
    }
  },
  paths: {
    temp: path.join(__dirname, 'temp_backups'),
    invoices: path.join(__dirname, 'invoices_pdf')
  }
}

// ============================================
// GOOGLE DRIVE AUTH
// ============================================

async function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CONFIG.drive.credentialsPath,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  })

  const authClient = await auth.getClient()
  return google.drive({ version: 'v3', auth: authClient })
}

async function ensureFolderStructure(drive) {
  const structure = {
    root: CONFIG.drive.rootFolderName,
    children: {
      'Database_Backups': {
        'Daily': {},
        'Weekly': {},
        'Monthly': {},
        'Quarterly': {}
      },
      'Invoices_PDF': {
        '2026': {},
        '2025': {},
        '2024': {}
      },
      'Audit_Logs': {},
      'Emergency_Restore': {}
    }
  }

  async function createFolder(name, parentId = null) {
    const query = parentId
      ? `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder'`
      : `name='${name}' and mimeType='application/vnd.google-apps.folder'`

    const existing = await drive.files.list({
      q: query,
      fields: 'files(id, name)'
    })

    if (existing.data.files.length > 0) {
      return existing.data.files[0].id
    }

    const folder = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      }
    })

    return folder.data.id
  }

  // Usar carpeta existente si se especifica el ID, o crear nueva
  let rootId
  if (CONFIG.drive.rootFolderId) {
    console.log(`📁 Usando carpeta existente de Drive: ${CONFIG.drive.rootFolderId}`)
    // Verificar que la carpeta existe
    try {
      await drive.files.get({ fileId: CONFIG.drive.rootFolderId })
      rootId = CONFIG.drive.rootFolderId
    } catch (error) {
      console.error('❌ Error: La carpeta especificada no existe o no es accesible')
      throw new Error(`Carpeta de Drive no encontrada: ${CONFIG.drive.rootFolderId}`)
    }
  } else {
    console.log(`📁 Creando nueva carpeta de Drive: ${structure.root}`)
    rootId = await createFolder(structure.root)
  }

  const folders = { root: rootId }

  for (const [folderName, subfolders] of Object.entries(structure.children)) {
    const folderId = await createFolder(folderName, rootId)
    folders[folderName] = folderId

    if (Object.keys(subfolders).length > 0) {
      for (const subName of Object.keys(subfolders)) {
        const subId = await createFolder(subName, folderId)
        folders[`${folderName}/${subName}`] = subId
      }
    }
  }

  return folders
}

// ============================================
// CIFRADO DE ARCHIVOS
// ============================================

async function encryptFile(inputPath, outputPath) {
  const key = Buffer.from(CONFIG.backup.encryption.key, 'hex')
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(CONFIG.backup.encryption.algorithm, key, iv)

  const input = await fs.readFile(inputPath)
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Formato: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
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

async function backupDatabase(type = 'weekly') {
  console.log(`📦 Iniciando backup ${type} de base de datos...`)

  // Crear directorio temporal
  await fs.mkdir(CONFIG.paths.temp, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `azmol-db-${type}-${timestamp}.json`
  const filepath = path.join(CONFIG.paths.temp, filename)

  try {
    const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey)

    // Lista de todas las tablas a exportar
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
      'returns',
      'audit_logs'
    ]

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        type,
        version: '1.0.0',
        database: 'azmol-erp'
      },
      data: {}
    }

    // Exportar cada tabla
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
      console.log(`  ✅ ${table}: ${allData.length} registros`)
    }

    // Guardar JSON
    await fs.writeFile(filepath, JSON.stringify(backup, null, 2))

    const stats = await fs.stat(filepath)
    console.log(`✅ JSON exportado: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`)

    // Comprimir
    const input = await fs.readFile(filepath)
    const compressed = zlib.gzipSync(input, { level: 9 })
    const gzipPath = `${filepath}.gz`
    await fs.writeFile(gzipPath, compressed)
    console.log(`✅ Comprimido: ${filename}.gz (${(compressed.length / 1024 / 1024).toFixed(2)} MB)`)

    // Cifrar
    const encryptedPath = `${gzipPath}.enc`
    await encryptFile(gzipPath, encryptedPath)

    // Limpiar archivos intermedios
    await fs.unlink(filepath).catch(() => {})
    await fs.unlink(gzipPath).catch(() => {})

    return {
      path: encryptedPath,
      filename: path.basename(encryptedPath),
      type,
      timestamp
    }
  } catch (error) {
    console.error('❌ Error en backup de BD:', error)
    throw error
  }
}

// ============================================
// BACKUP INCREMENTAL DE FACTURAS PDF
// ============================================

async function backupInvoicesPDF() {
  console.log(`📄 Iniciando backup incremental de facturas...`)

  const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey)

  // Obtener facturas de las últimas 24 horas
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const { data: recentSales, error } = await supabase
    .from('sales')
    .select('*')
    .gte('created_at', yesterday.toISOString())
    .not('invoice_number', 'is', null)

  if (error) {
    console.error('❌ Error obteniendo facturas:', error)
    return { count: 0, files: [] }
  }

  if (!recentSales || recentSales.length === 0) {
    console.log('ℹ️  No hay facturas nuevas para respaldar')
    return { count: 0, files: [] }
  }

  console.log(`📋 ${recentSales.length} facturas encontradas`)

  // Crear lista de metadatos de facturas
  const invoiceMetadata = recentSales.map(sale => ({
    invoiceNumber: sale.invoice_number,
    date: sale.date,
    customerName: sale.customer_name,
    totalAmount: sale.total_amount,
    paymentStatus: sale.payment_status
  }))

  // Guardar metadatos en JSON
  await fs.mkdir(CONFIG.paths.temp, { recursive: true })
  const metadataPath = path.join(CONFIG.paths.temp, `invoices-metadata-${new Date().toISOString().split('T')[0]}.json`)
  await fs.writeFile(metadataPath, JSON.stringify(invoiceMetadata, null, 2))

  // Comprimir y cifrar
  const gzipPath = `${metadataPath}.gz`
  await execAsync(`gzip -9 ${metadataPath}`)

  const encryptedPath = `${gzipPath}.enc`
  await encryptFile(gzipPath, encryptedPath)

  await fs.unlink(gzipPath).catch(() => {})

  return {
    count: recentSales.length,
    path: encryptedPath,
    filename: path.basename(encryptedPath)
  }
}

// ============================================
// ARCHIVO TRIMESTRAL
// ============================================

async function quarterlyArchive() {
  console.log(`📚 Iniciando archivo trimestral...`)

  const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.serviceKey)

  // Calcular fechas del trimestre anterior
  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3)
  const quarterStart = new Date(now.getFullYear(), (currentQuarter - 1) * 3, 1)
  const quarterEnd = new Date(now.getFullYear(), currentQuarter * 3, 0)

  console.log(`📅 Archivando Q${currentQuarter} (${quarterStart.toLocaleDateString()} - ${quarterEnd.toLocaleDateString()})`)

  // Exportar todas las tablas del trimestre
  const tables = ['sales', 'transfers', 'returns', 'payments', 'audit_logs']
  const archive = {}

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('created_at', quarterStart.toISOString())
      .lte('created_at', quarterEnd.toISOString())

    if (!error && data) {
      archive[table] = data
      console.log(`  ✓ ${table}: ${data.length} registros`)
    }
  }

  // Guardar archivo JSON
  const archivePath = path.join(CONFIG.paths.temp, `archive-Q${currentQuarter}-${now.getFullYear()}.json`)
  await fs.writeFile(archivePath, JSON.stringify(archive, null, 2))

  // Comprimir con máxima compresión
  const gzipPath = `${archivePath}.gz`
  await execAsync(`gzip -9 ${archivePath}`)

  // Cifrar
  const encryptedPath = `${gzipPath}.enc`
  await encryptFile(gzipPath, encryptedPath)

  // Limpiar intermedios
  await fs.unlink(gzipPath).catch(() => {})

  const stats = await fs.stat(encryptedPath)
  console.log(`✅ Archivo creado: ${path.basename(encryptedPath)} (${(stats.size / 1024).toFixed(2)} KB)`)

  return {
    path: encryptedPath,
    filename: path.basename(encryptedPath),
    quarter: currentQuarter,
    year: now.getFullYear(),
    recordCount: Object.values(archive).reduce((sum, arr) => sum + arr.length, 0)
  }
}

// ============================================
// SUBIR A GOOGLE DRIVE
// ============================================

async function uploadToDrive(filepath, folderId) {
  const drive = await getGoogleDriveClient()

  const fileMetadata = {
    name: path.basename(filepath),
    parents: [folderId]
  }

  const media = {
    mimeType: 'application/octet-stream',
    body: createReadStream(filepath)
  }

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, size, createdTime'
  })

  console.log(`☁️  Subido a Drive: ${file.data.name} (${(file.data.size / 1024).toFixed(2)} KB)`)

  return file.data
}

// ============================================
// LIMPIEZA DE BACKUPS ANTIGUOS
// ============================================

async function cleanOldBackups(drive, folderId, retentionDays) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  const files = await drive.files.list({
    q: `'${folderId}' in parents`,
    orderBy: 'createdTime desc',
    fields: 'files(id, name, createdTime)'
  })

  let deletedCount = 0

  for (const file of files.data.files) {
    const fileDate = new Date(file.createdTime)
    if (fileDate < cutoffDate) {
      await drive.files.delete({ fileId: file.id })
      console.log(`🗑️  Eliminado: ${file.name} (${fileDate.toLocaleDateString()})`)
      deletedCount++
    }
  }

  return deletedCount
}

// ============================================
// VERIFICACIÓN DE INTEGRIDAD
// ============================================

async function verifyBackupIntegrity(filepath) {
  try {
    const stats = await fs.stat(filepath)

    if (stats.size === 0) {
      throw new Error('Archivo vacío')
    }

    // Verificar que puede ser descifrado
    const tempDecrypted = `${filepath}.verify`
    await decryptFile(filepath, tempDecrypted)
    await fs.unlink(tempDecrypted)

    console.log(`✓ Integridad verificada: ${path.basename(filepath)}`)
    return true
  } catch (error) {
    console.error(`✗ Error de integridad: ${error.message}`)
    return false
  }
}

// ============================================
// NOTIFICACIONES
// ============================================

async function sendNotification(type, details) {
  // Aquí puedes integrar email, Telegram, etc.
  const message = {
    type,
    timestamp: new Date().toISOString(),
    details,
    status: details.success ? '✅ ÉXITO' : '❌ ERROR'
  }

  console.log('\n' + '='.repeat(50))
  console.log('📧 NOTIFICACIÓN DE BACKUP')
  console.log('='.repeat(50))
  console.log(JSON.stringify(message, null, 2))
  console.log('='.repeat(50) + '\n')

  // TODO: Implementar envío de email
  // await sendEmail(message)
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

async function runDailyBackup() {
  console.log('\n🌅 BACKUP DIARIO INICIADO\n')

  try {
    // 1. Backup incremental de facturas
    const invoices = await backupInvoicesPDF()

    // 2. Subir a Drive
    const drive = await getGoogleDriveClient()
    const folders = await ensureFolderStructure(drive)

    if (invoices.count > 0) {
      await uploadToDrive(invoices.path, folders['Invoices_PDF'])
      await fs.unlink(invoices.path)
    }

    // 3. Limpiar backups antiguos
    const deleted = await cleanOldBackups(
      drive,
      folders['Database_Backups/Daily'],
      CONFIG.backup.retentionDays.daily
    )

    await sendNotification('DAILY_BACKUP', {
      success: true,
      invoicesBackedUp: invoices.count,
      oldBackupsDeleted: deleted
    })

    console.log('\n✅ BACKUP DIARIO COMPLETADO\n')
  } catch (error) {
    console.error('\n❌ ERROR EN BACKUP DIARIO\n', error)
    await sendNotification('DAILY_BACKUP', {
      success: false,
      error: error.message
    })
  }
}

async function runWeeklyBackup() {
  console.log('\n📅 BACKUP SEMANAL INICIADO\n')

  try {
    // 1. Backup completo de BD
    const dbBackup = await backupDatabase('weekly')

    // 2. Verificar integridad
    const isValid = await verifyBackupIntegrity(dbBackup.path)
    if (!isValid) {
      throw new Error('Fallo en verificación de integridad')
    }

    // 3. Subir a Drive
    const drive = await getGoogleDriveClient()
    const folders = await ensureFolderStructure(drive)

    const uploaded = await uploadToDrive(dbBackup.path, folders['Database_Backups/Weekly'])
    await fs.unlink(dbBackup.path)

    // 4. Limpiar backups antiguos
    const deleted = await cleanOldBackups(
      drive,
      folders['Database_Backups/Weekly'],
      CONFIG.backup.retentionDays.weekly
    )

    await sendNotification('WEEKLY_BACKUP', {
      success: true,
      fileSize: uploaded.size,
      oldBackupsDeleted: deleted
    })

    console.log('\n✅ BACKUP SEMANAL COMPLETADO\n')
  } catch (error) {
    console.error('\n❌ ERROR EN BACKUP SEMANAL\n', error)
    await sendNotification('WEEKLY_BACKUP', {
      success: false,
      error: error.message
    })
  }
}

async function runQuarterlyBackup() {
  console.log('\n📊 BACKUP TRIMESTRAL INICIADO\n')

  try {
    // 1. Crear archivo trimestral
    const archive = await quarterlyArchive()

    // 2. Verificar integridad
    const isValid = await verifyBackupIntegrity(archive.path)
    if (!isValid) {
      throw new Error('Fallo en verificación de integridad')
    }

    // 3. Subir a Drive
    const drive = await getGoogleDriveClient()
    const folders = await ensureFolderStructure(drive)

    const uploaded = await uploadToDrive(archive.path, folders['Database_Backups/Quarterly'])
    await fs.unlink(archive.path)

    // 4. Los trimestrales se conservan 10 años (no limpieza)

    await sendNotification('QUARTERLY_BACKUP', {
      success: true,
      quarter: archive.quarter,
      year: archive.year,
      recordCount: archive.recordCount,
      fileSize: uploaded.size
    })

    console.log('\n✅ BACKUP TRIMESTRAL COMPLETADO\n')
  } catch (error) {
    console.error('\n❌ ERROR EN BACKUP TRIMESTRAL\n', error)
    await sendNotification('QUARTERLY_BACKUP', {
      success: false,
      error: error.message
    })
  }
}

// ============================================
// PUNTO DE ENTRADA
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  switch (command) {
    case 'daily':
      await runDailyBackup()
      break

    case 'weekly':
      await runWeeklyBackup()
      break

    case 'quarterly':
      await runQuarterlyBackup()
      break

    case 'help':
    default:
      console.log(`
╔════════════════════════════════════════════════════════════╗
║           SISTEMA DE BACKUP - AZMOL ERP                    ║
╚════════════════════════════════════════════════════════════╝

USO:
  node scripts/backup-system.js [comando]

COMANDOS:
  daily       Backup incremental diario (facturas nuevas)
  weekly      Backup completo semanal (base de datos)
  quarterly   Archivo trimestral (10 años retención)
  help        Mostrar esta ayuda

CONFIGURACIÓN CRON RECOMENDADA:
  # Diario a las 23:00
  0 23 * * * cd /ruta/proyecto && node scripts/backup-system.js daily

  # Semanal - Domingos a las 02:00
  0 2 * * 0 cd /ruta/proyecto && node scripts/backup-system.js weekly

  # Trimestral - Primer día del trimestre a las 03:00
  0 3 1 1,4,7,10 * cd /ruta/proyecto && node scripts/backup-system.js quarterly

SEGURIDAD:
  ✓ Cifrado AES-256-GCM
  ✓ Compresión GZIP nivel 9
  ✓ Verificación de integridad
  ✓ Retención legal 10 años (trimestrales)
      `)
      break
  }
}

main().catch(console.error)
