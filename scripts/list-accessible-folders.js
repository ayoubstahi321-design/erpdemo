/**
 * Listar todas las carpetas accesibles por el Service Account
 */

import dotenv from 'dotenv'
import { google } from 'googleapis'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
dotenv.config({ path: path.join(__dirname, '.env.backup') })

async function listAccessibleFolders() {
  console.log('\n📂 CARPETAS ACCESIBLES POR SERVICE ACCOUNT\n')
  console.log('='.repeat(50))

  try {
    const credentialsPath = path.join(__dirname, 'credentials.json')

    const auth = new google.auth.GoogleAuth({
      keyFile: credentialsPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    })

    const authClient = await auth.getClient()
    const serviceAccountEmail = authClient.email || 'No disponible'
    console.log(`📧 Service Account: ${serviceAccountEmail}\n`)

    const drive = google.drive({ version: 'v3', auth: authClient })

    // Listar todas las carpetas compartidas con el Service Account
    console.log('🔍 Buscando carpetas compartidas...\n')

    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder'",
      pageSize: 100,
      fields: 'files(id, name, parents, owners, shared, sharedWithMeTime)',
      orderBy: 'modifiedTime desc'
    })

    const folders = response.data.files

    if (!folders || folders.length === 0) {
      console.log('❌ No se encontraron carpetas accesibles')
      console.log('\n💡 ESTO SIGNIFICA QUE:')
      console.log('   1. La carpeta NO se compartió con el Service Account')
      console.log('   2. O se compartió hace muy poco (puede tardar unos minutos)')
      console.log('\n📋 PARA COMPARTIR:')
      console.log('   1. Abre tu carpeta en Drive')
      console.log('   2. Clic en el ícono de compartir (👤+)')
      console.log(`   3. Agrega: ${serviceAccountEmail}`)
      console.log('   4. Permisos: Editor')
      console.log('   5. Desmarca "Notificar"')
      console.log('   6. Clic en "Compartir"\n')
      return
    }

    console.log(`✅ Encontradas ${folders.length} carpetas:\n`)

    folders.forEach((folder, index) => {
      console.log(`${index + 1}. 📁 ${folder.name}`)
      console.log(`   ID: ${folder.id}`)
      if (folder.shared) {
        console.log(`   ✓ Compartida`)
      }
      if (folder.sharedWithMeTime) {
        console.log(`   🕒 Compartida el: ${new Date(folder.sharedWithMeTime).toLocaleString()}`)
      }
      console.log('')
    })

    // Verificar específicamente la carpeta del usuario
    const targetFolderId = '1h-kJ2GVVNQwiwOIgjfMGfjVtRs8K2Kl0'
    const targetFolder = folders.find(f => f.id === targetFolderId)

    if (targetFolder) {
      console.log('='.repeat(50))
      console.log('🎉 ¡LA CARPETA OBJETIVO ESTÁ ACCESIBLE!')
      console.log('='.repeat(50))
      console.log(`\n📁 Carpeta encontrada: ${targetFolder.name}`)
      console.log(`🆔 ID: ${targetFolder.id}`)
      console.log('\n✅ El sistema de backup está listo para usar')
      console.log('   Ejecuta: npm run backup:test\n')
    } else {
      console.log('='.repeat(50))
      console.log('⚠️  LA CARPETA OBJETIVO NO ESTÁ ACCESIBLE')
      console.log('='.repeat(50))
      console.log(`\nBuscada: ${targetFolderId}`)
      console.log('\n💡 Posibles causas:')
      console.log('   1. La carpeta no se ha compartido aún')
      console.log('   2. Se compartió pero los permisos no se han propagado')
      console.log('   3. El ID de la carpeta es incorrecto')
      console.log('\n📋 Solución:')
      console.log('   1. Ve a: https://drive.google.com/drive/folders/1h-kJ2GVVNQwiwOIgjfMGfjVtRs8K2Kl0')
      console.log('   2. Haz clic en el ícono de compartir')
      console.log(`   3. Verifica que está: ${serviceAccountEmail}`)
      console.log('   4. Verifica que tiene permisos de "Editor"')
      console.log('   5. Si acabas de compartir, espera 1-2 minutos')
      console.log('   6. Ejecuta este script de nuevo\n')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error('\nDetalles:', error)
  }
}

listAccessibleFolders()
