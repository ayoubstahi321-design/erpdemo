/**
 * ============================================
 * SISTEMA DE RESTAURACIÓN - AZMOL ERP
 * ============================================
 *
 * Restaura backups desde Google Drive
 *
 * USO:
 * - Listar backups: node scripts/restore-backup.js list
 * - Restaurar específico: node scripts/restore-backup.js restore <backup-id>
 * - Restaurar último: node scripts/restore-backup.js restore-latest
 */

import { google } from 'googleapis'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import readline from 'readline'

const execAsync = promisify(exec)

const CONFIG = {
  drive: {
    credentialsPath: './credentials.json',
    rootFolderName: 'AZMOL_ERP_BACKUPS'
  },
  encryption: {
    algorithm: 'aes-256-gcm',
    key: process.env.BACKUP_ENCRYPTION_KEY
  },
  restore: {
    tempPath: './temp_restore'
  }
}

// ============================================
// UTILIDADES
// ============================================

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close()
      resolve(answer)
    })
  })
}

async function decryptFile(inputPath, outputPath) {
  const key = Buffer.from(CONFIG.encryption.key, 'hex')
  const data = await fs.readFile(inputPath)

  const iv = data.slice(0, 16)
  const authTag = data.slice(16, 32)
  const encrypted = data.slice(32)

  const decipher = crypto.createDecipheriv(CONFIG.encryption.algorithm, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  await fs.writeFile(outputPath, decrypted)

  console.log(`🔓 Descifrado: ${path.basename(outputPath)}`)
  return outputPath
}

// ============================================
// GOOGLE DRIVE
// ============================================

async function getGoogleDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CONFIG.drive.credentialsPath,
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  })

  const authClient = await auth.getClient()
  return google.drive({ version: 'v3', auth: authClient })
}

async function findRootFolder(drive) {
  const folders = await drive.files.list({
    q: `name='${CONFIG.drive.rootFolderName}' and mimeType='application/vnd.google-apps.folder'`,
    fields: 'files(id, name)'
  })

  if (folders.data.files.length === 0) {
    throw new Error(`Carpeta raíz '${CONFIG.drive.rootFolderName}' no encontrada`)
  }

  return folders.data.files[0].id
}

async function listBackups(drive, type = 'all') {
  const rootId = await findRootFolder(drive)

  // Buscar carpeta Database_Backups
  const dbBackupsFolder = await drive.files.list({
    q: `name='Database_Backups' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder'`,
    fields: 'files(id)'
  })

  if (dbBackupsFolder.data.files.length === 0) {
    throw new Error('Carpeta Database_Backups no encontrada')
  }

  const dbFolderId = dbBackupsFolder.data.files[0].id

  // Listar todas las subcarpetas (Daily, Weekly, Monthly, Quarterly)
  const subfolders = await drive.files.list({
    q: `'${dbFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
    fields: 'files(id, name)'
  })

  const backups = []

  for (const folder of subfolders.data.files) {
    const files = await drive.files.list({
      q: `'${folder.id}' in parents`,
      orderBy: 'createdTime desc',
      fields: 'files(id, name, size, createdTime)'
    })

    for (const file of files.data.files) {
      backups.push({
        id: file.id,
        name: file.name,
        type: folder.name.toLowerCase(),
        size: parseInt(file.size),
        createdAt: new Date(file.createdTime),
        folderId: folder.id
      })
    }
  }

  // Filtrar por tipo si se especifica
  if (type !== 'all') {
    return backups.filter(b => b.type === type)
  }

  return backups.sort((a, b) => b.createdAt - a.createdAt)
}

async function downloadBackup(drive, fileId, destPath) {
  console.log(`📥 Descargando backup...`)

  const dest = fs.createWriteStream(destPath)

  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  )

  return new Promise((resolve, reject) => {
    response.data
      .on('end', () => {
        console.log(`✅ Descargado: ${path.basename(destPath)}`)
        resolve(destPath)
      })
      .on('error', reject)
      .pipe(dest)
  })
}

// ============================================
// RESTAURACIÓN
// ============================================

async function restoreDatabase(backupPath) {
  console.log(`\n🔄 INICIANDO RESTAURACIÓN DE BASE DE DATOS\n`)

  // Crear directorio temporal
  await fs.mkdir(CONFIG.restore.tempPath, { recursive: true })

  try {
    // 1. Descifrar
    console.log('1️⃣ Descifrando backup...')
    const decryptedPath = backupPath.replace('.enc', '')
    await decryptFile(backupPath, decryptedPath)

    // 2. Descomprimir
    console.log('2️⃣ Descomprimiendo...')
    await execAsync(`gunzip ${decryptedPath}`)
    const sqlPath = decryptedPath.replace('.gz', '')

    // 3. ADVERTENCIA
    console.log('\n⚠️  ADVERTENCIA ⚠️')
    console.log('═'.repeat(50))
    console.log('Esta operación SOBRESCRIBIRÁ la base de datos actual.')
    console.log('Se recomienda hacer un backup manual antes de continuar.')
    console.log('═'.repeat(50) + '\n')

    const confirm = await askQuestion('¿Desea continuar? (escriba "SI" para confirmar): ')

    if (confirm !== 'SI') {
      console.log('❌ Restauración cancelada')
      return false
    }

    // 4. Restaurar
    console.log('3️⃣ Restaurando base de datos...')
    const restoreCommand = `psql "${process.env.VITE_SUPABASE_URL.replace('https://', 'postgresql://postgres:')}${process.env.SUPABASE_DB_PASSWORD}@${process.env.VITE_SUPABASE_URL.split('.')[0].replace('https://', '')}.supabase.co:5432/postgres" < ${sqlPath}`

    await execAsync(restoreCommand)

    console.log('4️⃣ Limpiando archivos temporales...')
    await fs.rm(CONFIG.restore.tempPath, { recursive: true })

    console.log('\n✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE\n')
    return true

  } catch (error) {
    console.error('\n❌ ERROR EN RESTAURACIÓN\n', error)
    // Limpiar archivos temporales en caso de error
    await fs.rm(CONFIG.restore.tempPath, { recursive: true }).catch(() => {})
    return false
  }
}

// ============================================
// COMANDOS
// ============================================

async function commandList() {
  console.log('\n📋 BACKUPS DISPONIBLES\n')

  const drive = await getGoogleDriveClient()
  const backups = await listBackups(drive)

  if (backups.length === 0) {
    console.log('No se encontraron backups')
    return
  }

  console.log('ID'.padEnd(25) + 'TIPO'.padEnd(12) + 'FECHA'.padEnd(20) + 'TAMAÑO')
  console.log('─'.repeat(70))

  for (const backup of backups) {
    const id = backup.id.slice(0, 22) + '...'
    const type = backup.type.toUpperCase()
    const date = backup.createdAt.toLocaleString('es-ES')
    const size = `${(backup.size / 1024).toFixed(2)} KB`

    console.log(
      id.padEnd(25) +
      type.padEnd(12) +
      date.padEnd(20) +
      size
    )
  }

  console.log('\n💡 Para restaurar: node scripts/restore-backup.js restore <ID>\n')
}

async function commandRestore(backupId) {
  console.log(`\n🔍 Buscando backup ${backupId}...\n`)

  const drive = await getGoogleDriveClient()

  // Descargar backup
  const downloadPath = path.join(CONFIG.restore.tempPath, `backup-${Date.now()}.enc`)
  await fs.mkdir(CONFIG.restore.tempPath, { recursive: true })

  await downloadBackup(drive, backupId, downloadPath)

  // Restaurar
  await restoreDatabase(downloadPath)
}

async function commandRestoreLatest(type = 'weekly') {
  console.log(`\n🔍 Buscando último backup ${type}...\n`)

  const drive = await getGoogleDriveClient()
  const backups = await listBackups(drive, type)

  if (backups.length === 0) {
    console.log(`❌ No se encontraron backups de tipo '${type}'`)
    return
  }

  const latest = backups[0]
  console.log(`✓ Encontrado: ${latest.name} (${latest.createdAt.toLocaleString('es-ES')})`)

  // Descargar backup
  const downloadPath = path.join(CONFIG.restore.tempPath, latest.name)
  await fs.mkdir(CONFIG.restore.tempPath, { recursive: true })

  await downloadBackup(drive, latest.id, downloadPath)

  // Restaurar
  await restoreDatabase(downloadPath)
}

// ============================================
// PUNTO DE ENTRADA
// ============================================

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'help'

  // Verificar clave de cifrado
  if (!CONFIG.encryption.key) {
    console.error('❌ ERROR: BACKUP_ENCRYPTION_KEY no está configurada')
    console.error('Agregar en .env.backup o como variable de entorno')
    process.exit(1)
  }

  switch (command) {
    case 'list':
      await commandList()
      break

    case 'restore':
      if (!args[1]) {
        console.error('❌ ERROR: Debe especificar el ID del backup')
        console.error('Uso: node scripts/restore-backup.js restore <backup-id>')
        process.exit(1)
      }
      await commandRestore(args[1])
      break

    case 'restore-latest':
      const type = args[1] || 'weekly'
      await commandRestoreLatest(type)
      break

    case 'help':
    default:
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         SISTEMA DE RESTAURACIÓN - AZMOL ERP                ║
╚════════════════════════════════════════════════════════════╝

USO:
  node scripts/restore-backup.js [comando] [opciones]

COMANDOS:
  list                      Listar todos los backups disponibles
  restore <backup-id>       Restaurar un backup específico
  restore-latest [tipo]     Restaurar el backup más reciente
                           (tipo: daily, weekly, monthly, quarterly)
  help                      Mostrar esta ayuda

EJEMPLOS:
  # Listar backups
  node scripts/restore-backup.js list

  # Restaurar backup específico
  node scripts/restore-backup.js restore 1abc2def3ghi...

  # Restaurar último backup semanal
  node scripts/restore-backup.js restore-latest weekly

  # Restaurar último backup trimestral
  node scripts/restore-backup.js restore-latest quarterly

⚠️  IMPORTANTE:
  - La restauración SOBRESCRIBE la base de datos actual
  - Se recomienda hacer backup manual antes de restaurar
  - La clave de cifrado debe estar configurada en .env.backup
      `)
      break
  }
}

main().catch(console.error)
