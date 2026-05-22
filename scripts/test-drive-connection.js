/**
 * Script de diagnóstico para verificar conexión con Google Drive
 */

import dotenv from 'dotenv'
import { google } from 'googleapis'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env.backup') })

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1h-kJ2GVVNQwiwOIgjfMGfjVtRs8K2Kl0'

async function testDriveConnection() {
  console.log('\n🔍 DIAGNÓSTICO DE GOOGLE DRIVE\n')
  console.log('='.repeat(50))

  try {
    // 1. Verificar que credentials.json existe
    console.log('\n1️⃣ Verificando archivo credentials.json...')
    const credentialsPath = path.join(__dirname, 'credentials.json')
    console.log(`   Ruta: ${credentialsPath}`)

    // 2. Crear cliente de autenticación
    console.log('\n2️⃣ Creando cliente de autenticación...')
    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    })

    const authClient = await auth.getClient()
    console.log('   ✅ Cliente de autenticación creado')

    // 3. Obtener información de la cuenta de servicio
    const serviceAccountEmail = authClient.email || 'No disponible'
    console.log(`   📧 Service Account: ${serviceAccountEmail}`)

    // 4. Crear cliente de Drive
    console.log('\n3️⃣ Conectando con Google Drive API...')
    const drive = google.drive({ version: 'v3', auth: authClient })
    console.log('   ✅ Cliente de Drive creado')

    // 5. Probar acceso a la carpeta específica
    console.log(`\n4️⃣ Probando acceso a carpeta: ${FOLDER_ID}...`)
    try {
      const folderInfo = await drive.files.get({
        fileId: FOLDER_ID,
        fields: 'id, name, mimeType, owners, permissions'
      })

      console.log('   ✅ ¡Carpeta encontrada!')
      console.log(`   📁 Nombre: ${folderInfo.data.name}`)
      console.log(`   🆔 ID: ${folderInfo.data.id}`)
      console.log(`   📂 Tipo: ${folderInfo.data.mimeType}`)

      if (folderInfo.data.owners) {
        console.log('   👤 Propietarios:')
        folderInfo.data.owners.forEach(owner => {
          console.log(`      - ${owner.emailAddress || owner.displayName}`)
        })
      }

    } catch (error) {
      console.log('   ❌ Error al acceder a la carpeta')
      console.log(`   Código: ${error.code}`)
      console.log(`   Mensaje: ${error.message}`)

      if (error.code === 404) {
        console.log('\n   💡 POSIBLES CAUSAS:')
        console.log('      1. El ID de la carpeta es incorrecto')
        console.log('      2. La carpeta no se compartió con el Service Account')
        console.log(`      3. Verifica que compartiste con: ${serviceAccountEmail}`)
      } else if (error.code === 403) {
        console.log('\n   💡 POSIBLES CAUSAS:')
        console.log('      1. El Service Account no tiene permisos')
        console.log(`      2. Comparte la carpeta con: ${serviceAccountEmail}`)
        console.log('      3. Dale permisos de "Editor"')
      }

      throw error
    }

    // 6. Listar contenido de la carpeta
    console.log('\n5️⃣ Listando contenido de la carpeta...')
    const filesList = await drive.files.list({
      q: `'${FOLDER_ID}' in parents`,
      pageSize: 10,
      fields: 'files(id, name, mimeType, createdTime)'
    })

    if (filesList.data.files.length === 0) {
      console.log('   📭 La carpeta está vacía')
    } else {
      console.log(`   📄 Archivos encontrados: ${filesList.data.files.length}`)
      filesList.data.files.forEach(file => {
        console.log(`      - ${file.name} (${file.mimeType})`)
      })
    }

    // 7. Probar creación de carpeta de prueba
    console.log('\n6️⃣ Probando creación de carpeta de prueba...')
    const testFolder = await drive.files.create({
      requestBody: {
        name: 'test-backup-connection',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [FOLDER_ID]
      }
    })

    console.log('   ✅ Carpeta de prueba creada exitosamente')
    console.log(`   🆔 ID: ${testFolder.data.id}`)

    // Eliminar carpeta de prueba
    await drive.files.delete({ fileId: testFolder.data.id })
    console.log('   🗑️  Carpeta de prueba eliminada')

    console.log('\n' + '='.repeat(50))
    console.log('✅ DIAGNÓSTICO COMPLETADO - TODO FUNCIONA CORRECTAMENTE')
    console.log('='.repeat(50) + '\n')

    console.log('🎉 El sistema de backup está listo para usar!')
    console.log('   Ejecuta: npm run backup:test')

  } catch (error) {
    console.log('\n' + '='.repeat(50))
    console.log('❌ DIAGNÓSTICO FALLIDO')
    console.log('='.repeat(50))
    console.log('\nError completo:')
    console.error(error)

    console.log('\n📋 PASOS PARA RESOLVER:')
    console.log('1. Abre Google Drive: https://drive.google.com/')
    console.log(`2. Busca la carpeta con ID: ${FOLDER_ID}`)
    console.log('3. Haz clic derecho → Compartir')
    console.log('4. Agrega este email con permisos de "Editor":')
    console.log(`   azmol-backup-service@azmolstock.iam.gserviceaccount.com`)
    console.log('5. Desmarca "Notificar a las personas"')
    console.log('6. Haz clic en "Compartir"')
    console.log('7. Ejecuta nuevamente: npm run backup:test\n')
  }
}

testDriveConnection()
